/**
 * supabase/functions/create-portal/index.ts
 * Cadi — opens a Stripe Billing Portal session so the user can manage their
 * subscription (cancel, update card, download invoices).
 *
 * Returns { url } — client redirects to it. User clicks "Return to Cadi" in
 * the portal and lands back at APP_URL/billing.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0?target=denonext";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const APP_URL           = Deno.env.get("APP_URL") ?? "https://app.cadi.cleaning";

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

  try {
    const SUPABASE_URL  = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(SUPABASE_URL, SERVICE_KEY);
    const token = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
    const { data: { user }, error: authErr } = await sb.auth.getUser(token);
    if (authErr || !user) return json({ error: "Unauthorized" }, 401);

    const { data: profile } = await sb
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .single();

    if (!profile?.stripe_customer_id) {
      return json({ error: "No Stripe customer on file — start a subscription first" }, 400);
    }

    const body = await req.json().catch(() => ({}));
    const returnUrl = (body.returnUrl as string) || `${APP_URL}/settings`;

    const portal = await stripe.billingPortal.sessions.create({
      customer:   profile.stripe_customer_id,
      return_url: returnUrl,
    });

    return json({ url: portal.url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("create-portal error:", msg);
    return json({ error: msg }, 500);
  }
});
