/**
 * supabase/functions/send-review-request/index.ts
 * Sends a review request email for a given agent_action row.
 *
 * POST { action_id: string }
 *
 * Called from:
 *   - Inbox.jsx when the owner approves a send_review_request action
 *   - event-dispatcher when trust level is autonomous (fire-and-forget)
 *
 * Requires: RESEND_API_KEY environment variable.
 * From address: "reviews@cadi.cleaning" (domain must be verified in Resend).
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { tierForBusiness, isPaidTier } from "../_shared/entitlements.ts";

const SUPABASE_URL         = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY       = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL           = "reviews@cadi.cleaning";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });

// ─── Build email HTML ─────────────────────────────────────────────────────────

function buildEmailHtml(opts: {
  businessName: string;
  message:      string;
  reviewLink:   string;
}): string {
  const { businessName, message, reviewLink } = opts;
  const escaped = message
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>How did we do?</title>
</head>
<body style="margin:0;padding:40px 16px;background:#f5f7ff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(1,10,79,0.08);">

    <div style="background:#010a4f;padding:28px 36px;">
      <p style="margin:0;color:#ffffff;font-size:20px;font-weight:800;letter-spacing:-0.3px;">${businessName}</p>
    </div>

    <div style="padding:32px 36px;">
      <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.65;">${escaped}</p>

      <a href="${reviewLink}"
         style="display:inline-block;background:#1f48ff;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 28px;border-radius:12px;">
        ⭐&nbsp; Leave us a review
      </a>

      <p style="margin:28px 0 0;font-size:11px;color:#9ca3af;border-top:1px solid #f3f4f6;padding-top:20px;line-height:1.6;">
        You received this because you recently had a service from ${businessName}.<br />
        Sent via <a href="https://cadi.cleaning" style="color:#1f48ff;text-decoration:none;">Cadi</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

// ─── Main handler ─────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: CORS_HEADERS });
  }

  let body: { action_id?: string };
  try { body = await req.json(); }
  catch { return json({ error: "Invalid JSON" }, 400); }

  const { action_id } = body;
  if (!action_id) return json({ error: "Missing action_id" }, 400);

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Load the action row
  const { data: action } = await sb
    .from("agent_actions")
    .select("id, business_id, action_type, status, proposed_payload")
    .eq("id", action_id)
    .single();

  if (!action) return json({ error: "Action not found" }, 404);
  if (action.action_type !== "send_review_request") {
    return json({ error: "Action is not a review request" }, 400);
  }
  // Server-side entitlement gate: the Reviews agent is Pro/Max only. The client
  // hides it for Lite (and /review is tab-locked), but that is bypassable here.
  if (!isPaidTier(await tierForBusiness(sb, action.business_id))) {
    return json({ error: "The Reviews agent requires a Pro or Max plan.", upgrade_required: true }, 403);
  }
  // Allow approved or auto_sent — both mean "do it"
  if (!["approved", "auto_sent", "pending_approval"].includes(action.status)) {
    return json({ error: `Action already in terminal state: ${action.status}` }, 409);
  }

  const payload = (action.proposed_payload ?? {}) as Record<string, string>;
  const toEmail = payload.to;
  const customerName = payload.customer_name ?? "there";

  if (!toEmail || !toEmail.includes("@")) {
    // No email address — mark as failed and return gracefully
    await sb.from("agent_actions").update({
      status:  "failed",
      sent_at: new Date().toISOString(),
    }).eq("id", action_id);
    return json({ ok: false, reason: "No email address for customer" });
  }

  // Load business context
  const { data: biz } = await sb
    .from("businesses")
    .select("owner_user_id")
    .eq("id", action.business_id)
    .single();

  if (!biz) return json({ error: "Business not found" }, 404);

  const [{ data: prof }, { data: bizSettings }] = await Promise.all([
    sb.from("profiles").select("display_name, brand_voice").eq("id", biz.owner_user_id).single(),
    sb.from("business_settings").select("setup_data").eq("owner_id", biz.owner_user_id).single(),
  ]);

  const brandVoice   = prof?.brand_voice as Record<string, string> | null;
  const businessName = brandVoice?.business_name ?? prof?.display_name ?? "Your cleaning service";
  const sd           = (bizSettings?.setup_data ?? {}) as Record<string, unknown>;

  const reviewLink    = (sd.review_link as string) ?? "";
  const rawTemplate   = (sd.review_message_template as string) ??
    `Hi {{name}}, thank you so much — it was a pleasure. A quick review would mean the world to us 🙏`;
  const firstName     = customerName.split(" ")[0] || "there";
  const message       = rawTemplate.replace(/{{name}}/gi, firstName);
  const subject       = `How did we do, ${firstName}?`;

  if (!reviewLink) {
    // No review link configured — mark as failed
    await sb.from("agent_actions").update({
      status:  "failed",
      sent_at: new Date().toISOString(),
    }).eq("id", action_id);
    return json({ ok: false, reason: "No review link configured — set one in Settings → Reviews" });
  }

  if (!RESEND_API_KEY) {
    // No API key — log the payload but don't fail hard (allows testing)
    await sb.from("agent_actions").update({
      status:  "sent",
      sent_at: new Date().toISOString(),
    }).eq("id", action_id);
    return json({
      ok:      true,
      sent:    false,
      dry_run: true,
      to:      toEmail,
      subject,
      reason:  "RESEND_API_KEY not set — email not actually sent",
    });
  }

  // Send via Resend
  const emailRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from:    `${businessName} <${FROM_EMAIL}>`,
      to:      [toEmail],
      subject,
      html:    buildEmailHtml({ businessName, message, reviewLink }),
    }),
  });

  const emailData = await emailRes.json();

  if (!emailRes.ok) {
    await sb.from("agent_actions").update({
      status:  "failed",
      sent_at: new Date().toISOString(),
    }).eq("id", action_id);
    return json({ ok: false, error: emailData }, 500);
  }

  // Mark sent
  await sb.from("agent_actions").update({
    status:  "sent",
    sent_at: new Date().toISOString(),
  }).eq("id", action_id);

  return json({ ok: true, sent: true, email_id: emailData.id });
});
