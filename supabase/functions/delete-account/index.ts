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

    // Cancel active Stripe subscription if they have one
    if (profile?.stripe_customer_id) {
      try {
        const subscriptions = await stripe.subscriptions.list({
          customer: profile.stripe_customer_id,
          status: "active",
          limit: 5,
        });
        for (const sub of subscriptions.data) {
          await stripe.subscriptions.cancel(sub.id);
        }
        // Also catch trialing subscriptions
        const trialing = await stripe.subscriptions.list({
          customer: profile.stripe_customer_id,
          status: "trialing",
          limit: 5,
        });
        for (const sub of trialing.data) {
          await stripe.subscriptions.cancel(sub.id);
        }
      } catch (stripeErr) {
        // Log but don't block — account deletion proceeds even if Stripe cancel fails
        console.error("Stripe subscription cancel error:", stripeErr);
      }
    }

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
