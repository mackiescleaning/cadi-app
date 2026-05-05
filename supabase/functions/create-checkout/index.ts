/**
 * supabase/functions/create-checkout/index.ts
 * Cadi — creates a Stripe Checkout Session for the Pro subscription.
 *
 * The client (ProUpgrade.jsx) calls this, gets back { url }, and redirects
 * the browser to Stripe-hosted checkout. Stripe handles card entry, then
 * redirects back to APP_URL/billing?success=true and fires the webhook.
 *
 * Environment variables:
 *   STRIPE_SECRET_KEY          — sk_test_... or sk_live_...
 *   STRIPE_PRICE_ID            — price_... for the £29/mo Cadi Pro subscription
 *   APP_URL                    — e.g. https://app.cadi.cleaning
 *   SUPABASE_URL               — auto-injected
 *   SUPABASE_SERVICE_ROLE_KEY  — auto-injected
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0?target=denonext";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const STRIPE_PRICE_ID   = Deno.env.get("STRIPE_PRICE_ID")!;
const APP_URL           = Deno.env.get("APP_URL") ?? "https://app.cadi.cleaning";

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion:     "2024-06-20",
  httpClient:     Stripe.createFetchHttpClient(),
});

const CORS = {
  "Access-Control-Allow-Origin":  Deno.env.get("APP_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    // ── Auth ────────────────────────────────────────────────────────────────
    const SUPABASE_URL  = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(SUPABASE_URL, SERVICE_KEY);
    const token = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
    const { data: { user }, error: authErr } = await sb.auth.getUser(token);
    if (authErr || !user) return json({ error: "Unauthorized" }, 401);

    // ── Get or create the Stripe customer for this user ─────────────────────
    const { data: profile } = await sb
      .from("profiles")
      .select("stripe_customer_id, plan, first_name, business_name")
      .eq("id", user.id)
      .single();

    let customerId = profile?.stripe_customer_id as string | null;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name:  profile?.business_name || profile?.first_name || undefined,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;
      await sb.from("profiles").update({ stripe_customer_id: customerId }).eq("id", user.id);
    }

    // ── Create the Checkout Session ─────────────────────────────────────────
    const body = await req.json().catch(() => ({}));
    const returnUrl = (body.returnUrl as string) || APP_URL;

    const session = await stripe.checkout.sessions.create({
      mode:                   "subscription",
      customer:               customerId,
      line_items:             [{ price: STRIPE_PRICE_ID, quantity: 1 }],
      allow_promotion_codes:  true,
      billing_address_collection: "auto",
      success_url: `${returnUrl}/settings?upgraded=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${returnUrl}/upgrade?canceled=1`,
      metadata:    { supabase_user_id: user.id },
    });

    return json({ url: session.url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("create-checkout error:", msg);
    return json({ error: msg }, 500);
  }
});
