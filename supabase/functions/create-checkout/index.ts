/**
 * supabase/functions/create-checkout/index.ts
 * Cadi — creates a Stripe Checkout Session for the chosen subscription tier.
 *
 * Client sends { tier: 'pro' | 'max', returnUrl?: string }
 * Function builds the line items for the tier and redirects to Stripe Checkout.
 *
 * Pricing:
 *   Pro — single flat price (STRIPE_PRO_PRICE_ID), £39/mo.
 *   Max — base + per-employee: STRIPE_MAX_PRICE_ID is the £99/mo base which
 *         includes MAX_INCLUDED_SEATS active staff; each active staff member
 *         beyond that adds one unit of STRIPE_MAX_SEAT_PRICE_ID (£5/mo). Seat
 *         quantity is taken from the caller's active staff_members at checkout.
 *         (Ongoing quantity sync as staff change is a separate job — see notes.)
 *   Launch discounts are handled by Stripe promotion codes (allow_promotion_codes).
 *
 * Environment variables:
 *   STRIPE_SECRET_KEY        — sk_live_...
 *   STRIPE_PRO_PRICE_ID      — price_... for the £39/mo Pro tier
 *   STRIPE_MAX_PRICE_ID      — price_... for the £99/mo Max base (incl. 5 staff)
 *   STRIPE_MAX_SEAT_PRICE_ID — price_... for the £5/mo per-employee seat add-on
 *   APP_URL                  — https://app.cadi.cleaning
 *   SUPABASE_URL             — auto-injected
 *   SUPABASE_SERVICE_ROLE_KEY — auto-injected
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0?target=denonext";

const STRIPE_SECRET_KEY        = Deno.env.get("STRIPE_SECRET_KEY")!;
const STRIPE_PRO_PRICE_ID      = Deno.env.get("STRIPE_PRO_PRICE_ID") ?? Deno.env.get("STRIPE_PRICE_ID")!;
const STRIPE_MAX_PRICE_ID      = Deno.env.get("STRIPE_MAX_PRICE_ID");
const STRIPE_MAX_SEAT_PRICE_ID = Deno.env.get("STRIPE_MAX_SEAT_PRICE_ID");
// Active staff included in the Max base before per-employee charges kick in.
const MAX_INCLUDED_SEATS = 5;
const APP_URL             = Deno.env.get("APP_URL") ?? "https://app.cadi.cleaning";
// Origins permitted for the client-supplied returnUrl. Anything else falls back
// to APP_URL — prevents open-redirect-via-Stripe-success-url. Comma-separated.
const ALLOWED_RETURN_ORIGINS = (Deno.env.get("ALLOWED_RETURN_ORIGINS") ?? APP_URL)
  .split(",").map((s: string) => s.trim()).filter(Boolean);

function safeReturnUrl(raw: string | undefined): string {
  if (!raw) return APP_URL;
  try {
    const u = new URL(raw);
    if (ALLOWED_RETURN_ORIGINS.includes(u.origin)) return raw;
  } catch { /* invalid URL — fall through */ }
  return APP_URL;
}

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});

const ALLOWED_ORIGINS = new Set([
  "https://app.cadi.cleaning",
  "https://cadi.cleaning",
  Deno.env.get("APP_ORIGIN"),
  Deno.env.get("APP_URL"),
].filter(Boolean) as string[]);

function corsHeaders(req: Request) {
  const origin = req.headers.get("Origin") ?? "";
  return {
    "Access-Control-Allow-Origin":  ALLOWED_ORIGINS.has(origin) ? origin : "https://app.cadi.cleaning",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

const json = (data: unknown, status: number, req: Request) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });

function basePriceForTier(tier: string): string | null {
  if (tier === "pro")  return STRIPE_PRO_PRICE_ID;
  if (tier === "max")  return STRIPE_MAX_PRICE_ID ?? null;
  return null;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(SUPABASE_URL, SERVICE_KEY);

    const token = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
    const { data: { user }, error: authErr } = await sb.auth.getUser(token);
    if (authErr || !user) return json({ error: "Unauthorized" }, 401, req);

    const body      = await req.json().catch(() => ({}));
    const tier      = (body.tier as string) ?? "pro";
    const returnUrl = safeReturnUrl(body.returnUrl as string | undefined);

    const basePrice = basePriceForTier(tier);
    if (!basePrice) {
      return json({ error: `No price configured for tier: ${tier}` }, 400, req);
    }

    // Line items: base for every tier; Max adds one per-employee seat unit for
    // each active staff member beyond the included allowance.
    const lineItems: { price: string; quantity: number }[] = [{ price: basePrice, quantity: 1 }];
    if (tier === "max" && STRIPE_MAX_SEAT_PRICE_ID) {
      const { count } = await sb
        .from("staff_members")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", user.id)
        .eq("active", true);
      const chargeableSeats = Math.max(0, (count ?? 0) - MAX_INCLUDED_SEATS);
      if (chargeableSeats > 0) {
        lineItems.push({ price: STRIPE_MAX_SEAT_PRICE_ID, quantity: chargeableSeats });
      }
    }

    const { data: profile } = await sb
      .from("profiles")
      .select("stripe_customer_id, subscription_tier, first_name, business_name")
      .eq("id", user.id)
      .single();

    let customerId = profile?.stripe_customer_id as string | null;

    if (!customerId) {
      // Dedupe by email — covers the orphan-customer pattern where a user
      // deletes their account, re-signs up with the same email, and Checkout
      // would otherwise mint a second Stripe customer alongside the abandoned
      // first one. Reuse the existing customer; refresh metadata to the new
      // supabase user id so webhooks resolve to the live profile.
      if (user.email) {
        const existing = await stripe.customers.list({ email: user.email, limit: 1 });
        if (existing.data.length > 0) {
          customerId = existing.data[0].id;
          await stripe.customers.update(customerId, {
            metadata: { supabase_user_id: user.id },
          });
        }
      }

      if (!customerId) {
        const customer = await stripe.customers.create({
          email:    user.email,
          name:     profile?.business_name || profile?.first_name || undefined,
          metadata: { supabase_user_id: user.id },
        });
        customerId = customer.id;
      }

      await sb.from("profiles").update({ stripe_customer_id: customerId }).eq("id", user.id);
    }

    const session = await stripe.checkout.sessions.create({
      mode:                        "subscription",
      customer:                    customerId,
      line_items:                  lineItems,
      allow_promotion_codes:       true,
      billing_address_collection:  "auto",
      success_url: `${returnUrl}/dashboard?upgraded=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${returnUrl}/upgrade?canceled=1`,
      metadata:    { supabase_user_id: user.id, tier },
      subscription_data: {
        metadata: { supabase_user_id: user.id, tier },
      },
    });

    return json({ url: session.url }, 200, req);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("create-checkout error:", msg);
    return json({ error: msg }, 500, req);
  }
});
