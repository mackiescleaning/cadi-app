/**
 * supabase/functions/stripe-webhook/index.ts
 * Cadi — Stripe webhook handler.
 *
 * Flips profiles.plan between "free" and "pro" based on subscription lifecycle.
 * Idempotent: handles retries from Stripe without side-effects.
 *
 * IMPORTANT: deploy with verify_jwt: false. Stripe authenticates via its own
 * signing secret in the Stripe-Signature header; no Supabase JWT is sent.
 *
 * Events handled:
 *   checkout.session.completed      — user finished checkout → mark pro, save subscription id
 *   customer.subscription.updated   — status changed (trialing, active, past_due, canceled, ...)
 *   customer.subscription.deleted   — subscription ended → revert to free
 *   invoice.payment_failed          — card declined / payment failed → revert to free
 *
 * Environment variables:
 *   STRIPE_SECRET_KEY          — sk_test_... or sk_live_...
 *   STRIPE_WEBHOOK_SECRET      — whsec_... (from Stripe Dashboard → Webhooks)
 *   SUPABASE_URL               — auto-injected
 *   SUPABASE_SERVICE_ROLE_KEY  — auto-injected
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0?target=denonext";

const STRIPE_SECRET_KEY     = Deno.env.get("STRIPE_SECRET_KEY")!;
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const sb = createClient(SUPABASE_URL, SERVICE_KEY);

/** "trialing" and "active" count as paid Pro. Anything else falls back to free. */
function planForStatus(status: string): "pro" | "free" {
  return status === "active" || status === "trialing" ? "pro" : "free";
}

async function updatePlanByCustomer(
  customerId: string,
  plan: "pro" | "free",
  subscriptionId: string | null,
  renewsAt: string | null,
) {
  const { error } = await sb
    .from("profiles")
    .update({
      plan,
      stripe_subscription_id:     subscriptionId,
      stripe_subscription_renews: renewsAt,
    })
    .eq("stripe_customer_id", customerId);
  if (error) console.error("profiles update failed:", error.message);
}

serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  const signature = req.headers.get("Stripe-Signature");
  if (!signature) return new Response("Missing Stripe-Signature", { status: 400 });

  const rawBody = await req.text();
  let event: Stripe.Event;
  try {
    // constructEventAsync is required in Deno (crypto is async)
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Signature verification failed:", msg);
    return new Response(`Webhook signature error: ${msg}`, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string | null;
        if (subscriptionId) {
          // Pull the subscription to get status + current_period_end
          const sub = await stripe.subscriptions.retrieve(subscriptionId);
          const renewsAt = new Date(sub.current_period_end * 1000).toISOString();
          await updatePlanByCustomer(customerId, planForStatus(sub.status), sub.id, renewsAt);
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.created": {
        const sub = event.data.object as Stripe.Subscription;
        const renewsAt = new Date(sub.current_period_end * 1000).toISOString();
        await updatePlanByCustomer(sub.customer as string, planForStatus(sub.status), sub.id, renewsAt);
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await updatePlanByCustomer(sub.customer as string, "free", null, null);
        break;
      }
      case "invoice.payment_failed": {
        // Card declined or payment couldn't be collected — revert to free so the
        // user can't keep accessing Pro features while payment is unresolved.
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        await updatePlanByCustomer(customerId, "free", null, null);
        break;
      }
      default:
        // Ignore other events — subscribe only to what we handle above
        break;
    }
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`stripe-webhook error on ${event.type}:`, msg);
    // Return 200 anyway to stop Stripe from retrying on our bug — we logged it
    return new Response(JSON.stringify({ received: true, handlerError: msg }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
});
