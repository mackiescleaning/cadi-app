/**
 * supabase/functions/fm-approve-application/index.ts
 *
 * Cadi-admin only. Approves a pending fm_applications row:
 *   1. Creates fm_organisations row from the application's company_name
 *   2. Creates fm_invitations row with a fresh token (admin role)
 *   3. Updates fm_applications: status='approved', fm_organisation_id,
 *      invitation_id, reviewed_by_user_id, reviewed_at
 *   4. Sends invite email via Resend → /invite/:token?source=fm-ops
 *
 * POST { application_id, send_email? }
 *   → { ok, fm_organisation_id, invitation_id, token, email_sent }
 *
 * Audit-logged. Rate-limited 30/min per user.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const RESEND_FROM    = Deno.env.get("RESEND_FROM")    ?? "Cadi <team@cadi.cleaning>";
const APP_ORIGIN     = Deno.env.get("APP_ORIGIN")     ?? "https://app.cadi.cleaning";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "content-type, apikey, authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json", ...extra },
  });

function clientIp(req) {
  const xff = req.headers.get("x-forwarded-for") ?? "";
  return xff.split(",")[0].trim() || (req.headers.get("x-real-ip") ?? "unknown");
}

function makeToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST")    return json({ error: "Method not allowed" }, 405);

  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL"),
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
    );

    const authHeader = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
    const { data: { user }, error: authErr } = await sb.auth.getUser(authHeader);
    if (authErr || !user) return json({ error: "Unauthorized" }, 401);

    const ip = clientIp(req);
    const ua = req.headers.get("user-agent") ?? "";

    // Caller must be a Cadi admin
    const { data: caller } = await sb
      .from("profiles")
      .select("id, is_cadi_admin")
      .eq("id", user.id)
      .single();
    if (!caller?.is_cadi_admin) {
      return json({ error: "Cadi-admin only" }, 403);
    }

    // Rate-limit 30/min per user
    const { data: rl } = await sb.rpc("check_and_increment_rate_limit", {
      p_bucket: "fm_approve_app", p_key: user.id, p_limit: 30, p_window_ms: 60000,
    });
    const rlRow = Array.isArray(rl) ? rl[0] : rl;
    if (rlRow && !rlRow.ok) {
      const retry = Math.max(1, Math.ceil((new Date(rlRow.reset_at).getTime() - Date.now()) / 1000));
      return json({ error: "Too many requests" }, 429, { "Retry-After": String(retry) });
    }

    const body = await req.json().catch(() => ({}));
    const applicationId = body.application_id;
    const sendEmail = body.send_email !== false;
    if (!applicationId) return json({ error: "application_id required" }, 400);

    // Load application
    const { data: app, error: aErr } = await sb
      .from("fm_applications")
      .select("id, status, company_name, contact_name, contact_email, fm_organisation_id, invitation_id")
      .eq("id", applicationId)
      .maybeSingle();
    if (aErr) return json({ error: aErr.message }, 500);
    if (!app) return json({ error: "Application not found" }, 404);
    if (app.status === "approved") {
      return json({
        ok: true,
        already_approved: true,
        fm_organisation_id: app.fm_organisation_id,
        invitation_id:     app.invitation_id,
      });
    }
    if (app.status === "rejected") {
      return json({ error: "Application was already rejected" }, 409);
    }

    // 1. Create the FM organisation
    const { data: org, error: orgErr } = await sb
      .from("fm_organisations")
      .insert({ name: app.company_name })
      .select("id, name")
      .single();
    if (orgErr) return json({ error: `Could not create FM org: ${orgErr.message}` }, 500);

    // 2. Create the invitation row
    const token = makeToken();
    const { data: inv, error: invErr } = await sb
      .from("fm_invitations")
      .insert({
        fm_organisation_id:    org.id,
        invited_by_user_id:    user.id,
        email:                 app.contact_email.toLowerCase(),
        contact_name:          app.contact_name,
        role:                  "admin",
        token,
        source_application_id: applicationId,
      })
      .select("id, token")
      .single();
    if (invErr) return json({ error: `Could not create invitation: ${invErr.message}` }, 500);

    // 3. Update application
    const now = new Date().toISOString();
    await sb
      .from("fm_applications")
      .update({
        status:              "approved",
        reviewed_by_user_id: user.id,
        reviewed_at:         now,
        fm_organisation_id:  org.id,
        invitation_id:       inv.id,
      })
      .eq("id", applicationId);

    // 4. Send email (best-effort)
    let emailSent = false;
    if (sendEmail && RESEND_API_KEY && app.contact_email) {
      const inviteUrl = `${APP_ORIGIN}/invite/${token}?source=fm-ops`;
      const html = renderInviteEmail({
        contactName: app.contact_name,
        companyName: app.company_name,
        inviteUrl,
      });
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from:    RESEND_FROM,
            to:      [app.contact_email],
            subject: `Welcome to Cadi for FM — claim your portal`,
            html,
          }),
        });
        emailSent = res.ok;
      } catch (_) { /* swallow */ }
    }

    // 5. Audit
    await sb.from("audit_log").insert({
      actor_id: user.id,
      action:   "fm_application_approved",
      category: "fm_ops",
      detail:   {
        application_id:     applicationId,
        fm_organisation_id: org.id,
        invitation_id:      inv.id,
        email_sent:         emailSent,
      },
      ip:       ip === "unknown" ? null : ip,
      user_agent: ua || null,
    }).then(() => {}).catch(() => {});

    return json({
      ok:                 true,
      fm_organisation_id: org.id,
      invitation_id:      inv.id,
      token:              inv.token,
      email_sent:         emailSent,
    });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

function renderInviteEmail({ contactName, companyName, inviteUrl }) {
  const who = contactName ? `Hi ${contactName},` : "Hi there,";
  return `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;padding:40px 20px">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
        <tr><td style="padding-bottom:32px;text-align:center">
          <span style="font-size:22px;font-weight:900;color:#ffffff;letter-spacing:-0.5px">Cadi for FM</span>
        </td></tr>
        <tr><td style="background:#111118;border:1px solid rgba(194,65,12,0.15);border-radius:16px;padding:40px">
          <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:rgba(255,165,80,0.65);letter-spacing:0.08em;text-transform:uppercase">${companyName} · Application approved</p>
          <h1 style="margin:0 0 16px;font-size:24px;font-weight:900;color:#ffffff;line-height:1.2">
            ${who} welcome to Cadi for FM
          </h1>
          <p style="margin:0 0 28px;font-size:15px;color:rgba(255,255,255,0.65);line-height:1.6">
            We've created your FM portal for <strong style="color:#ffffff">${companyName}</strong>.
            Click below to set up your account and start uploading contracts.
          </p>
          <table cellpadding="0" cellspacing="0" style="margin-bottom:28px">
            <tr><td style="background:#C2410C;border-radius:10px">
              <a href="${inviteUrl}" style="display:inline-block;padding:14px 28px;font-size:14px;font-weight:900;color:#ffffff;text-decoration:none">
                Claim my FM portal →
              </a>
            </td></tr>
          </table>
          <p style="margin:0 0 8px;font-size:13px;color:rgba(255,255,255,0.4)">Or paste this into your browser:</p>
          <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.3);word-break:break-all">${inviteUrl}</p>
        </td></tr>
        <tr><td style="padding-top:24px;text-align:center">
          <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.25)">
            Sent by Cadi · <a href="${APP_ORIGIN}" style="color:rgba(255,255,255,0.35)">app.cadi.cleaning</a>
          </p>
          <p style="margin:4px 0 0;font-size:11px;color:rgba(255,255,255,0.2)">
            Link expires in 60 days.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}
