/**
 * supabase/functions/crm-send-outreach/index.ts
 * Cadi — sends one customer_outreach email via Resend.
 *
 * POST { outreach_id: string }
 *
 * Called from the Customers tab when the owner approves/sends an upsell
 * email drafted by crm-sales-plan (or written manually). The caller's JWT
 * scopes every read/write via RLS, and the owner calling this endpoint IS
 * the approval — so draft / pending_approval / approved are all sendable.
 * Terminal states (sent, failed, dismissed) are rejected.
 *
 * Side effects on success:
 *   - customer_outreach: status 'sent', sent_at, resend_message_id
 *   - linked customer_service_calendar row (if any): status 'offered'
 *
 * Requires: RESEND_API_KEY. Without it the row is marked sent with
 * dry_run=true in the response (matches send-review-request behaviour).
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL      = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const RESEND_API_KEY    = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL        = "hello@cadi.cleaning";

const ALLOWED_ORIGINS = [
  Deno.env.get("APP_ORIGIN"),
  "https://cadi.cleaning",
  "https://app.cadi.cleaning",
].filter(Boolean);

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : (ALLOWED_ORIGINS[0] ?? "*");
  return {
    "Access-Control-Allow-Origin":  allowed,
    "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function buildEmailHtml(opts: { businessName: string; body: string }): string {
  const escaped = opts.body
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:40px 16px;background:#f5f7ff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(1,10,79,0.08);">

    <div style="background:#010a4f;padding:28px 36px;">
      <p style="margin:0;color:#ffffff;font-size:20px;font-weight:800;letter-spacing:-0.3px;">${opts.businessName}</p>
    </div>

    <div style="padding:32px 36px;">
      <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.65;">${escaped}</p>

      <p style="margin:0;font-size:14px;color:#374151;">
        Just reply to this email and we'll get you booked in.
      </p>

      <p style="margin:28px 0 0;font-size:11px;color:#9ca3af;border-top:1px solid #f3f4f6;padding-top:20px;line-height:1.6;">
        You received this because you're a customer of ${opts.businessName}.<br />
        Sent via <a href="https://cadi.cleaning" style="color:#1f48ff;text-decoration:none;">Cadi</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

const json = (cors: Record<string, string>, data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

serve(async (req: Request) => {
  const cors = corsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: cors });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response("Unauthorized", { status: 401, headers: cors });

  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authError } = await sb.auth.getUser();
  if (authError || !user) return new Response("Unauthorized", { status: 401, headers: cors });

  let body: { outreach_id?: string };
  try { body = await req.json(); }
  catch { return json(cors, { error: "Invalid JSON" }, 400); }

  const outreachId = body.outreach_id;
  if (!outreachId) return json(cors, { error: "Missing outreach_id" }, 400);

  // ── Load the outreach row + customer (RLS-scoped) ──────────────────────────
  const { data: outreach } = await sb
    .from("customer_outreach")
    .select("id, customer_id, calendar_id, subject, body, status")
    .eq("id", outreachId)
    .maybeSingle();

  if (!outreach) return json(cors, { error: "Outreach not found" }, 404);
  if (!["draft", "pending_approval", "approved"].includes(outreach.status)) {
    return json(cors, { error: `Outreach already in terminal state: ${outreach.status}` }, 409);
  }
  if (!outreach.subject || !outreach.body) {
    return json(cors, { error: "Outreach has no subject/body" }, 400);
  }

  const { data: customer } = await sb
    .from("customers")
    .select("id, name, email")
    .eq("id", outreach.customer_id)
    .maybeSingle();

  const toEmail = customer?.email ?? "";
  if (!toEmail.includes("@")) {
    await sb.from("customer_outreach").update({
      status: "failed",
      error:  "No email address for customer",
    }).eq("id", outreachId);
    return json(cors, { ok: false, reason: "No email address for customer" });
  }

  // ── Branding: the caller is the owner ──────────────────────────────────────
  const { data: prof } = await sb
    .from("profiles")
    .select("display_name, brand_voice")
    .eq("id", user.id)
    .maybeSingle();

  const brandVoice   = (prof?.brand_voice ?? {}) as Record<string, string>;
  const businessName = brandVoice.business_name ?? prof?.display_name ?? "Your cleaning service";

  if (!RESEND_API_KEY) {
    await sb.from("customer_outreach").update({
      status:  "sent",
      sent_at: new Date().toISOString(),
    }).eq("id", outreachId);
    return json(cors, {
      ok: true, sent: false, dry_run: true,
      to: toEmail, subject: outreach.subject,
      reason: "RESEND_API_KEY not set — email not actually sent",
    });
  }

  // ── Send via Resend ────────────────────────────────────────────────────────
  const emailRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from:     `${businessName} <${FROM_EMAIL}>`,
      reply_to: user.email ? [user.email] : undefined,
      to:       [toEmail],
      subject:  outreach.subject,
      html:     buildEmailHtml({ businessName, body: outreach.body }),
    }),
  });

  const emailData = await emailRes.json();

  if (!emailRes.ok) {
    await sb.from("customer_outreach").update({
      status: "failed",
      error:  JSON.stringify(emailData).slice(0, 500),
    }).eq("id", outreachId);
    return json(cors, { ok: false, error: emailData }, 500);
  }

  await sb.from("customer_outreach").update({
    status:            "sent",
    sent_at:           new Date().toISOString(),
    resend_message_id: emailData.id ?? null,
    error:             null,
  }).eq("id", outreachId);

  // The offer is now out — move the linked calendar entry along
  if (outreach.calendar_id) {
    await sb.from("customer_service_calendar")
      .update({ status: "offered" })
      .eq("id", outreach.calendar_id)
      .eq("status", "planned");
  }

  return json(cors, { ok: true, sent: true, email_id: emailData.id });
});
