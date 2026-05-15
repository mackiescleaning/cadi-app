/**
 * supabase/functions/stripe-webhook/index.ts
 * Cadi — Stripe webhook handler.
 *
 * Updates profiles.plan (legacy) and profiles.subscription_tier based on
 * subscription lifecycle events. Tier is read from subscription metadata
 * (set by create-checkout). Falls back to 'pro' if metadata is absent.
 *
 * IMPORTANT: deploy with verify_jwt: false.
 *
 * Events handled:
 *   checkout.session.completed      — new subscription → set tier
 *   customer.subscription.updated   — status or plan changed
 *   customer.subscription.created   — created via API
 *   customer.subscription.deleted   — ended → revert to lite
 *   invoice.payment_failed          — card declined → revert to lite
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

type Tier = "lite" | "pro" | "max";

function tierFromMetadata(metadata: Record<string, string> | null): Tier {
  const t = metadata?.tier;
  if (t === "pro" || t === "max") return t;
  return "pro"; // safe default for any subscription without metadata
}

function tierForStatus(status: string, tier: Tier): Tier | "lite" {
  return status === "active" || status === "trialing" ? tier : "lite";
}

async function updateProfileByCustomer(
  customerId: string,
  tier: Tier | "lite",
  subscriptionId: string | null,
  renewsAt: string | null,
) {
  const payload = {
    plan:                       tier === "lite" ? "free" : tier,
    subscription_tier:          tier,
    stripe_subscription_id:     subscriptionId,
    stripe_subscription_renews: renewsAt,
  };

  console.log(`updateProfileByCustomer: customerId=${customerId} tier=${tier}`, JSON.stringify(payload));

  const { data, error } = await sb
    .from("profiles")
    .update(payload)
    .eq("stripe_customer_id", customerId)
    .select("id, plan, subscription_tier");

  if (error) {
    console.error("profiles update failed:", error.message, error.details);
  } else {
    console.log(`profiles updated: ${data?.length ?? 0} row(s)`, JSON.stringify(data));
    if (!data?.length) {
      // No row matched — log what's in the DB for this customer to help diagnose
      const { data: lookup } = await sb
        .from("profiles")
        .select("id, stripe_customer_id, subscription_tier")
        .eq("stripe_customer_id", customerId);
      console.warn("no match for customerId — lookup result:", JSON.stringify(lookup));
    }
  }
}

serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  const signature = req.headers.get("Stripe-Signature");
  if (!signature) return new Response("Missing Stripe-Signature", { status: 400 });

  const rawBody = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Signature verification failed:", msg);
    return new Response(`Webhook signature error: ${msg}`, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session      = event.data.object as Stripe.Checkout.Session;
        const customerId   = session.customer as string;
        const subscriptionId = session.subscription as string | null;
        if (subscriptionId) {
          const sub      = await stripe.subscriptions.retrieve(subscriptionId);
          const tier     = tierFromMetadata(sub.metadata as Record<string, string>);
          const active   = tierForStatus(sub.status, tier);
          const renewsAt = new Date(sub.current_period_end * 1000).toISOString();
          await updateProfileByCustomer(customerId, active, sub.id, renewsAt);
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.created": {
        const sub      = event.data.object as Stripe.Subscription;
        const tier     = tierFromMetadata(sub.metadata as Record<string, string>);
        const active   = tierForStatus(sub.status, tier);
        const renewsAt = new Date(sub.current_period_end * 1000).toISOString();
        await updateProfileByCustomer(sub.customer as string, active, sub.id, renewsAt);
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await updateProfileByCustomer(sub.customer as string, "lite", null, null);
        break;
      }
      case "invoice.payment_failed": {
        const invoice    = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        await updateProfileByCustomer(customerId, "lite", null, null);
        break;
      }
      default:
        break;
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`stripe-webhook error on ${event.type}:`, msg);
    return new Response(JSON.stringify({ received: true, handlerError: msg }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
});
