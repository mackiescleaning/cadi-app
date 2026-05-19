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
 *   invoice.payment_succeeded       — payment recovered → restore tier
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

const SUPABASE_URL  = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_KEY    = Deno.env.get("RESEND_API_KEY") ?? "";
const APP_URL       = Deno.env.get("APP_URL") ?? "https://app.cadi.cleaning";

const sb = createClient(SUPABASE_URL, SERVICE_KEY);

const ALERT_EMAIL = "rhianna@mackies.cleaning";

async function sendAlert(subject: string, body: string): Promise<void> {
  if (!RESEND_KEY) return;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Cadi Alerts <hello@cadi.cleaning>",
        to: ALERT_EMAIL,
        subject,
        text: body,
      }),
    });
  } catch { /* alert failure must never affect the webhook response */ }
}

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
      const { data: lookup } = await sb
        .from("profiles")
        .select("id, stripe_customer_id, subscription_tier")
        .eq("stripe_customer_id", customerId);
      console.warn("no match for customerId — lookup result:", JSON.stringify(lookup));
      sendAlert(
        `Stripe webhook: no profile matched customer ${customerId}`,
        `A Stripe event tried to set tier="${tier}" but no profile row matched stripe_customer_id="${customerId}".\n\nDB lookup: ${JSON.stringify(lookup)}\n\nCheck the Supabase dashboard and manually update the profile if needed.`,
      );
    }
  }
}

// ── Upgrade confirmation email ─────────────────────────────────────────────────

function buildUpgradeEmail(firstName: string, businessName: string): string {
  const name = firstName || businessName || "there";
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Welcome to Cadi Pro</title></head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f2f5;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#010a4f;border-radius:16px;overflow:hidden;" cellpadding="0" cellspacing="0">

        <!-- Top shine -->
        <tr><td style="height:2px;background:linear-gradient(90deg,transparent,#99c5ff,transparent);"></td></tr>

        <!-- Header -->
        <tr><td style="padding:32px 32px 24px;text-align:center;">
          <p style="margin:0 0 20px;font-size:22px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;">Cadi</p>
          <div style="display:inline-block;width:64px;height:64px;border-radius:50%;background:rgba(31,72,255,0.2);border:1px solid rgba(31,72,255,0.4);line-height:64px;text-align:center;font-size:28px;">✨</div>
          <h1 style="margin:16px 0 8px;font-size:24px;font-weight:900;color:#ffffff;">You're on Cadi Pro, ${name}!</h1>
          <p style="margin:0;font-size:15px;color:rgba(255,255,255,0.55);">Your subscription is live. Here's everything that's now unlocked.</p>
        </td></tr>

        <!-- Feature list -->
        <tr><td style="padding:0 32px 28px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            ${[
              ["📊", "Money tracker, P&L &amp; tax reserve"],
              ["🏛️", "HMRC MTD self-assessment submissions"],
              ["💳", "Invoice chasing &amp; GoCardless direct debit"],
              ["👥", "Staff management (up to 5 crew)"],
              ["💬", "Front Desk AI web chat agent"],
              ["⭐", "Unlimited review requests"],
            ].map(([emoji, label]) => `
            <tr>
              <td style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
                <table cellpadding="0" cellspacing="0"><tr>
                  <td style="width:32px;font-size:16px;">${emoji}</td>
                  <td style="font-size:14px;color:rgba(255,255,255,0.75);">${label}</td>
                  <td style="width:20px;text-align:right;font-size:14px;color:#34d399;">✓</td>
                </tr></table>
              </td>
            </tr>`).join("")}
          </table>
        </td></tr>

        <!-- CTA -->
        <tr><td style="padding:0 32px 32px;text-align:center;">
          <a href="${APP_URL}/dashboard" style="display:inline-block;padding:14px 32px;background:#1f48ff;color:#ffffff;font-size:14px;font-weight:900;text-decoration:none;border-radius:12px;">
            Open Cadi →
          </a>
          <p style="margin:16px 0 0;font-size:12px;color:rgba(255,255,255,0.25);">
            Questions? Reply to this email or contact <a href="mailto:support@cadi.cleaning" style="color:rgba(153,197,255,0.5);">support@cadi.cleaning</a>
          </p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:20px 32px;border-top:1px solid rgba(255,255,255,0.08);text-align:center;">
          <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.2);">
            Cadi · <a href="${APP_URL}/settings" style="color:rgba(153,197,255,0.3);text-decoration:underline;">Manage subscription</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

async function sendUpgradeEmail(userId: string, tier: string): Promise<void> {
  if (tier !== "pro" && tier !== "max") return;
  if (!RESEND_KEY) { console.warn("RESEND_API_KEY not set — skipping upgrade email"); return; }

  const { data: authUser } = await sb.auth.admin.getUserById(userId);
  const email = authUser?.user?.email;
  if (!email) { console.warn(`sendUpgradeEmail: no email for user ${userId}`); return; }

  const { data: profile } = await sb.from("profiles")
    .select("first_name, business_name")
    .eq("id", userId)
    .single();

  const html = buildUpgradeEmail(profile?.first_name ?? "", profile?.business_name ?? "");
  const res  = await fetch("https://api.resend.com/emails", {
    method:  "POST",
    headers: { "Authorization": `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body:    JSON.stringify({
      from:    "Cadi <hello@cadi.cleaning>",
      to:      email,
      subject: "You're on Cadi Pro — here's what's unlocked",
      html,
    }),
  });
  if (!res.ok) {
    console.error("sendUpgradeEmail Resend error:", await res.text());
  } else {
    console.log(`sendUpgradeEmail: sent to ${email}`);
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

          // Send upgrade confirmation email (fire-and-forget — don't fail the webhook on email error)
          if (active === "pro" || active === "max") {
            const { data: rows } = await sb.from("profiles").select("id").eq("stripe_customer_id", customerId).limit(1);
            const userId = rows?.[0]?.id;
            if (userId) sendUpgradeEmail(userId, active).catch(e => console.error("sendUpgradeEmail failed:", e));
          }
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
      case "invoice.payment_succeeded": {
        const invoice        = event.data.object as Stripe.Invoice;
        const customerId     = invoice.customer as string;
        const subscriptionId = invoice.subscription as string | null;
        // Only act on subscription invoices (not one-off charges)
        if (!subscriptionId) break;
        const sub      = await stripe.subscriptions.retrieve(subscriptionId);
        const tier     = tierFromMetadata(sub.metadata as Record<string, string>);
        const active   = tierForStatus(sub.status, tier);
        const renewsAt = new Date(sub.current_period_end * 1000).toISOString();
        await updateProfileByCustomer(customerId, active, sub.id, renewsAt);
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
    sendAlert(
      `Stripe webhook handler threw on ${event.type}`,
      `Event ID: ${event.id}\nType: ${event.type}\nError: ${msg}\n\nCheck Supabase edge function logs for the full trace.`,
    );
    return new Response(JSON.stringify({ received: true, handlerError: msg }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
});
