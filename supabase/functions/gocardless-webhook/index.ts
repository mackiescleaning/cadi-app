/**
 * supabase/functions/gocardless-webhook/index.ts
 * Cadi — GoCardless webhook receiver
 *
 * Register this URL in the GoCardless Dashboard → Developers → Webhooks:
 *   https://<your-project>.supabase.co/functions/v1/gocardless-webhook
 *
 * Environment variables:
 *   GC_WEBHOOK_SECRET     — from GoCardless Dashboard → Developers → Webhooks
 *   SUPABASE_URL          — auto-injected
 *   SUPABASE_SERVICE_ROLE_KEY — auto-injected
 *
 * Events handled:
 *   mandates.active                → mark customer mandate active
 *   mandates.cancelled             → mark customer mandate cancelled
 *   mandates.expired               → mark customer mandate expired
 *   mandates.failed                → mark customer mandate failed
 *   payments.confirmed             → update money entry status
 *   payments.paid_out              → update money entry status + mark invoice paid
 *   payments.failed                → update money entry status
 *   payments.cancelled             → update money entry status
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto }       from "https://deno.land/std@0.168.0/crypto/mod.ts";
import { encode }       from "https://deno.land/std@0.168.0/encoding/hex.ts";
import { timingSafeEqualStr } from "../_shared/timingSafeEqual.ts";

const GC_WEBHOOK_SECRET = Deno.env.get("GC_WEBHOOK_SECRET") ?? "";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "content-type, webhook-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

async function verifySignature(rawBody: string, signature: string): Promise<boolean> {
  // Fail closed: if the secret isn't configured we cannot verify, so we MUST
  // reject. The previous `return true` here let anyone forge `payment.confirmed`
  // events whenever the env var was unset or empty (security audit P0).
  if (!GC_WEBHOOK_SECRET) {
    throw new Error("GC_WEBHOOK_SECRET is not configured");
  }
  if (!signature) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(GC_WEBHOOK_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const expected = new TextDecoder().decode(encode(new Uint8Array(mac)));
  // Constant-time compare to avoid a signature-timing side channel.
  return timingSafeEqualStr(expected, signature);
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST")    return json({ error: "Method not allowed" }, 405);

  try {
    const rawBody  = await req.text();
    const signature = req.headers.get("Webhook-Signature") ?? "";

    if (!(await verifySignature(rawBody, signature))) {
      console.error("gocardless-webhook: signature mismatch");
      return json({ error: "Invalid signature" }, 401);
    }

    const payload = JSON.parse(rawBody) as { events: GCEvent[] };
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    for (const event of payload.events ?? []) {
      await handleEvent(sb, event);
    }

    return json({ received: true });

  } catch (err) {
    // Log full detail server-side, return generic 500 to GoCardless so we don't
    // leak misconfiguration (e.g. missing secret) in the response body.
    console.error("gocardless-webhook error:", err);
    return json({ error: "Webhook processing failed" }, 500);
  }
});

interface GCEvent {
  id:            string;
  action:        string;
  resource_type: string;
  links: {
    mandate?:      string;
    payment?:      string;
    organisation?: string;
  };
}

// deno-lint-ignore no-explicit-any
async function handleEvent(sb: any, event: GCEvent) {
  const { action, resource_type, links } = event;

  // ── Mandate events ────────────────────────────────────────────────────────
  if (resource_type === "mandates" && links.mandate) {
    const mandateId = links.mandate;
    const statusMap: Record<string, string> = {
      active:    "active",
      cancelled: "cancelled",
      expired:   "expired",
      failed:    "failed",
      reinstated: "active",
    };
    const newStatus = statusMap[action];
    if (newStatus) {
      await sb
        .from("customers")
        .update({ gc_mandate_status: newStatus, gc_mandate_id: mandateId })
        .eq("gc_mandate_id", mandateId);
    }

    // If we're receiving a mandate.created/active for the first time,
    // also try to match by mandate ID that may have just been stored
    if (action === "active" || action === "created") {
      await sb
        .from("customers")
        .update({ gc_mandate_id: mandateId, gc_mandate_status: "active" })
        .eq("gc_mandate_id", mandateId);
    }
  }

  // ── Payment events ────────────────────────────────────────────────────────
  if (resource_type === "payments" && links.payment) {
    const paymentId = links.payment;
    const statusMap: Record<string, string> = {
      created:             "pending_submission",
      submitted:           "submitted",
      confirmed:           "confirmed",
      paid_out:            "paid_out",
      failed:              "failed",
      cancelled:           "cancelled",
      customer_approval_denied: "failed",
    };
    const newStatus = statusMap[action];
    if (!newStatus) return;

    await sb
      .from("money_entries")
      .update({ gc_payment_status: newStatus })
      .eq("gc_payment_id", paymentId);

    // Mark invoice as paid when payment clears
    if (action === "paid_out" || action === "confirmed") {
      const { data: entry } = await sb
        .from("money_entries")
        .select("quote_id")
        .eq("gc_payment_id", paymentId)
        .single();

      if (entry?.quote_id) {
        await sb
          .from("quotes")
          .update({ status: "paid" })
          .eq("id", entry.quote_id);
      }
    }
  }
}
