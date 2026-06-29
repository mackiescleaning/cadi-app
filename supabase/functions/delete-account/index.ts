/**
 * supabase/functions/delete-account/index.ts
 * Permanently deletes a Cadi user account:
 *   1. Cancels any active Stripe subscription immediately
 *   2. Deletes the Supabase auth user (cascades to profiles via FK)
 *
 * POST — requires a valid user JWT in Authorization header.
 * No body required.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0?target=denonext";
import { writeAudit } from "../_shared/auditLog.ts";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
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
  if (req.method !== "POST")   return json({ error: "Method not allowed" }, 405);

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(SUPABASE_URL, SERVICE_KEY);

    // Authenticate the requesting user
    const token = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
    const { data: { user }, error: authErr } = await sb.auth.getUser(token);
    if (authErr || !user) return json({ error: "Unauthorized" }, 401);

    // Fetch their Stripe customer ID and current tier
    const { data: profile } = await sb
      .from("profiles")
      .select("stripe_customer_id, subscription_tier")
      .eq("id", user.id)
      .single();

    // Build the full set of Stripe customers to clean up. profile.stripe_customer_id
    // only points at the LATEST one — if the user previously had a Checkout flow
    // that minted an earlier customer (the orphan-customer pattern), we'd miss
    // its subs and keep firing webhooks forever. Also search by email.
    const customerIds = new Set<string>();
    if (profile?.stripe_customer_id) customerIds.add(profile.stripe_customer_id);
    if (user.email) {
      try {
        const byEmail = await stripe.customers.list({ email: user.email, limit: 10 });
        for (const c of byEmail.data) customerIds.add(c.id);
      } catch (lookupErr) {
        console.error("Stripe customer lookup by email failed:", lookupErr);
      }
    }

    // Statuses that still generate webhooks / billable activity. canceled /
    // incomplete_expired / ended are already terminal.
    const CANCELLABLE = ["active", "trialing", "past_due", "unpaid"] as const;

    for (const customerId of customerIds) {
      for (const status of CANCELLABLE) {
        try {
          const subs = await stripe.subscriptions.list({
            customer: customerId,
            status,
            limit: 10,
          });
          for (const sub of subs.data) {
            await stripe.subscriptions.cancel(sub.id);
          }
        } catch (stripeErr) {
          // Per-customer / per-status failures are logged but do not block the
          // remaining cleanup or the auth-user delete itself.
          console.error(`Stripe cancel failed for ${customerId} (${status}):`, stripeErr);
        }
      }
    }

    // Write the audit entry BEFORE deleting the user — once the auth row is
    // gone, the RLS policy on audit_log would prevent the row from being
    // visible to anyone except service-role. We want a permanent record that
    // this account was deleted (UK GDPR Art 30 audit trail).
    await writeAudit(sb, req, {
      ownerId:  user.id,
      actorId:  user.id,
      action:   "account_delete",
      category: "account",
      detail:   {
        email:                 user.email,
        stripe_customers_swept: customerIds.size,
        last_subscription_tier: profile?.subscription_tier ?? null,
      },
    });

    // Delete the auth user — Supabase cascades this to profiles via FK
    const { error: deleteErr } = await sb.auth.admin.deleteUser(user.id);
    if (deleteErr) {
      console.error("deleteUser error:", deleteErr);
      return json({ error: "Failed to delete account. Please contact support@cadi.cleaning" }, 500);
    }

    return json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("delete-account error:", msg);
    return json({ error: msg }, 500);
  }
});
