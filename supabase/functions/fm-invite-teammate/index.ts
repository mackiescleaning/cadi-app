/**
 * supabase/functions/fm-invite-teammate/index.ts
 *
 * JWT required. Caller must be an FM-org member. Creates an fm_invitations
 * row for a new teammate and emails them.
 *
 * POST { email, contact_name?, role? } → { ok, invitation_id, token, email_sent }
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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

    const { data: caller } = await sb
      .from("profiles")
      .select("id, fm_organisation_id, first_name, last_name, business_name")
      .eq("id", user.id)
      .single();
    if (!caller?.fm_organisation_id) {
      return json({ error: "Caller is not an FM-organisation member" }, 403);
    }

    // Rate-limit 30/min per user
    const { data: rl } = await sb.rpc("check_and_increment_rate_limit", {
      p_bucket: "fm_invite_team", p_key: user.id, p_limit: 30, p_window_ms: 60000,
    });
    const rlRow = Array.isArray(rl) ? rl[0] : rl;
    if (rlRow && !rlRow.ok) {
      const retry = Math.max(1, Math.ceil((new Date(rlRow.reset_at).getTime() - Date.now()) / 1000));
      return json({ error: "Too many requests" }, 429, { "Retry-After": String(retry) });
    }

    const body = await req.json().catch(() => ({}));
    const email = (body.email ?? "").trim().toLowerCase();
    const contactName = body.contact_name?.trim() || null;
    // SECURITY (deferred): any FM-org member can currently request role:"admin".
    // Inert today — fm-invite-accept sets only fm_organisation_id on claim, never
    // a role, so no privilege is actually conferred. Before FM-member roles are
    // enforced on accept, gate admin invites on the caller being an org admin
    // (requires an FM-admin flag that doesn't exist in the schema yet).
    const role = body.role === "admin" ? "admin" : "member";

    if (!email || !EMAIL_RE.test(email)) {
      return json({ error: "Valid email required" }, 400);
    }

    // De-dupe: if a pending invite already exists for this email + org, return it
    const { data: existing } = await sb
      .from("fm_invitations")
      .select("id, token")
      .eq("fm_organisation_id", caller.fm_organisation_id)
      .eq("email", email)
      .eq("status", "pending")
      .maybeSingle();
    if (existing) {
      return json({
        ok: true,
        already_invited: true,
        invitation_id:   existing.id,
        token:           existing.token,
        email_sent:      false,
      });
    }

    // Get the org name for the email
    const { data: org } = await sb
      .from("fm_organisations")
      .select("name")
      .eq("id", caller.fm_organisation_id)
      .single();

    const token = makeToken();
    const { data: inv, error: invErr } = await sb
      .from("fm_invitations")
      .insert({
        fm_organisation_id: caller.fm_organisation_id,
        invited_by_user_id: user.id,
        email,
        contact_name:       contactName,
        role,
        token,
      })
      .select("id, token")
      .single();
    if (invErr) return json({ error: `Could not create invitation: ${invErr.message}` }, 500);

    // Send email (best-effort)
    let emailSent = false;
    if (RESEND_API_KEY) {
      const inviteUrl = `${APP_ORIGIN}/invite/${token}?source=fm-ops`;
      const inviterName =
        caller.business_name ||
        [caller.first_name, caller.last_name].filter(Boolean).join(" ") ||
        "Your colleague";
      const html = renderTeammateEmail({
        contactName,
        orgName: org?.name ?? "your team",
        inviterName,
        inviteUrl,
      });
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from:    RESEND_FROM,
            to:      [email],
            subject: `${inviterName} invited you to ${org?.name ?? "Cadi for FM"}`,
            html,
          }),
        });
        emailSent = res.ok;
      } catch (_) { /* swallow */ }
    }

    // Audit
    await sb.from("audit_log").insert({
      actor_id: user.id,
      action:   "fm_teammate_invited",
      category: "fm_ops",
      detail:   {
        fm_organisation_id: caller.fm_organisation_id,
        invitation_id:      inv.id,
        invitee_email:      email,
        role,
        email_sent:         emailSent,
      },
      ip:       ip === "unknown" ? null : ip,
      user_agent: ua || null,
    }).then(() => {}).catch(() => {});

    return json({
      ok:            true,
      invitation_id: inv.id,
      token:         inv.token,
      email_sent:    emailSent,
    });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

function renderTeammateEmail({ contactName, orgName, inviterName, inviteUrl }) {
  const who = contactName ? `Hi ${contactName},` : "Hi there,";
  return `
<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;padding:40px 20px">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
        <tr><td style="padding-bottom:32px;text-align:center">
          <span style="font-size:22px;font-weight:900;color:#ffffff;letter-spacing:-0.5px">Cadi for FM</span>
        </td></tr>
        <tr><td style="background:#111118;border:1px solid rgba(194,65,12,0.15);border-radius:16px;padding:40px">
          <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:rgba(255,165,80,0.65);letter-spacing:0.08em;text-transform:uppercase">${orgName} · Teammate invite</p>
          <h1 style="margin:0 0 16px;font-size:24px;font-weight:900;color:#ffffff;line-height:1.2">
            ${who} ${inviterName} added you to ${orgName} on Cadi
          </h1>
          <p style="margin:0 0 28px;font-size:15px;color:rgba(255,255,255,0.65);line-height:1.6">
            Click below to set up your access — takes about a minute.
          </p>
          <table cellpadding="0" cellspacing="0" style="margin-bottom:28px">
            <tr><td style="background:#C2410C;border-radius:10px">
              <a href="${inviteUrl}" style="display:inline-block;padding:14px 28px;font-size:14px;font-weight:900;color:#ffffff;text-decoration:none">
                Join ${orgName} →
              </a>
            </td></tr>
          </table>
          <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.3);word-break:break-all">${inviteUrl}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}
