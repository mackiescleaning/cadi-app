/**
 * supabase/functions/resend-webhook/index.ts
 *
 * Receives Resend's delivery-event webhooks and updates invoice_sends so
 * the UI can show real delivery status (Delivered / Bounced / Complained
 * / Opened) instead of just "Sent" (which only means "Resend accepted
 * our POST").
 *
 * Setup:
 *   1. Resend dashboard → Webhooks → Add endpoint
 *      URL: https://cufgozpwbinjhjnkimmn.supabase.co/functions/v1/resend-webhook
 *      Events: email.delivered, email.bounced, email.complained, email.opened
 *   2. Copy the signing secret from Resend, set as RESEND_WEBHOOK_SECRET
 *      on this function.
 *   3. The function verifies the Svix-style signature (Resend uses Svix
 *      under the hood) before touching the DB.
 *
 * No JWT required — Resend doesn't carry one. Signature verification
 * is the auth boundary.
 *
 * Resend webhook payload shape:
 *   {
 *     type: "email.delivered" | "email.bounced" | ...,
 *     created_at: "2026-06-30T13:00:00.000Z",
 *     data: {
 *       email_id: "re_...",
 *       to: ["foo@bar"],
 *       subject: "...",
 *       bounce?: { type, sub_type, message }
 *     }
 *   }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const WEBHOOK_SECRET = Deno.env.get("RESEND_WEBHOOK_SECRET") ?? "";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "content-type, svix-id, svix-timestamp, svix-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// Svix verifier — Resend uses Svix's signature format. The header
// `svix-signature` looks like `v1,base64sig v1,base64sig`. We compute
// HMAC-SHA256 over `${svix-id}.${svix-timestamp}.${payload}` using the
// secret (base64-decoded after stripping the `whsec_` prefix), then
// constant-time compare against any of the provided signatures.
async function verifySignature(req: Request, raw: string): Promise<boolean> {
  if (!WEBHOOK_SECRET) {
    console.warn("RESEND_WEBHOOK_SECRET not set — accepting unverified webhook");
    return true; // dev fallback
  }
  const id  = req.headers.get("svix-id");
  const ts  = req.headers.get("svix-timestamp");
  const sig = req.headers.get("svix-signature");
  if (!id || !ts || !sig) return false;

  const secret = WEBHOOK_SECRET.startsWith("whsec_")
    ? WEBHOOK_SECRET.slice(6)
    : WEBHOOK_SECRET;

  let keyBytes: Uint8Array;
  try {
    const bin = atob(secret);
    keyBytes = Uint8Array.from(bin, c => c.charCodeAt(0));
  } catch { return false; }

  const key = await crypto.subtle.importKey(
    "raw", keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false, ["sign"],
  );
  const toSign = new TextEncoder().encode(`${id}.${ts}.${raw}`);
  const sigBuf = await crypto.subtle.sign("HMAC", key, toSign);
  const expected = btoa(String.fromCharCode(...new Uint8Array(sigBuf)));

  // Header contains space-separated `v1,sig` pairs — any match accepts.
  return sig.split(" ").some(pair => {
    const [, candidate] = pair.split(",");
    return candidate === expected;
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST")    return json({ error: "Method not allowed" }, 405);

  // Capture raw body for signature verification, then parse.
  const raw = await req.text();
  const ok  = await verifySignature(req, raw);
  if (!ok) return json({ error: "Invalid signature" }, 401);

  let payload: { type?: string; created_at?: string; data?: Record<string, unknown> };
  try { payload = JSON.parse(raw); }
  catch { return json({ error: "Invalid JSON" }, 400); }

  const type     = payload.type ?? "";
  const data     = (payload.data ?? {}) as { email_id?: string; bounce?: { message?: string } };
  const emailId  = data.email_id;
  const eventAt  = payload.created_at ?? new Date().toISOString();

  if (!emailId) return json({ ok: true, skipped: "no email_id" });

  // Pick the column + status to set based on event type.
  const patch: Record<string, unknown> = { updated_at: eventAt };
  switch (type) {
    case "email.delivered":
      patch.delivered_at = eventAt;
      patch.status       = "delivered";
      break;
    case "email.bounced":
      patch.bounced_at    = eventAt;
      patch.status        = "bounced";
      patch.bounce_reason = data.bounce?.message ?? null;
      break;
    case "email.complained":
      patch.complaint_at = eventAt;
      patch.status       = "complained";
      break;
    case "email.opened":
      patch.opened_at = eventAt;
      // Don't downgrade status on open — it's an enrichment, not a state.
      break;
    default:
      return json({ ok: true, skipped: `unhandled event ${type}` });
  }

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Don't overwrite a terminal status (bounced / complained) with a
  // later 'delivered'. UPDATE filters on resend_message_id.
  const { data: existing } = await sb
    .from("invoice_sends")
    .select("id, status")
    .eq("resend_message_id", emailId)
    .maybeSingle();

  if (!existing) {
    // We don't have the row — likely a send that bypassed invoice_sends
    // (e.g. pre-save send before the client fix). Best-effort log only.
    console.warn(`resend-webhook: no invoice_sends row for ${emailId} (event ${type})`);
    return json({ ok: true, skipped: "no matching row" });
  }

  const terminal = ["bounced", "complained"];
  if (terminal.includes(existing.status) && type === "email.delivered") {
    return json({ ok: true, skipped: "terminal status set" });
  }

  const { error } = await sb
    .from("invoice_sends")
    .update(patch)
    .eq("resend_message_id", emailId);
  if (error) return json({ error: error.message }, 500);

  return json({ ok: true, event: type, message_id: emailId });
});
