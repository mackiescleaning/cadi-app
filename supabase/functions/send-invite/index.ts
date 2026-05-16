/**
 * supabase/functions/send-invite/index.ts
 * Cadi — sends a team invite email to an accountant / bookkeeper.
 *
 * Called by the owner after creating an account_members row.
 * Reads the invite_token and owner's business name, sends a branded email.
 *
 * Environment variables:
 *   RESEND_API_KEY            — re_...
 *   RESEND_FROM               — e.g. "Cadi <team@cadi.cleaning>"
 *   APP_ORIGIN                — https://app.cadi.cleaning
 *   SUPABASE_URL              — auto-injected
 *   SUPABASE_SERVICE_ROLE_KEY — auto-injected
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const RESEND_FROM    = Deno.env.get("RESEND_FROM") ?? "Cadi <team@cadi.cleaning>";
const APP_ORIGIN     = Deno.env.get("APP_ORIGIN")  ?? "https://app.cadi.cleaning";

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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Verify caller is authenticated
    const authHeader = req.headers.get("authorization") ?? "";
    const { data: { user }, error: authErr } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (authErr || !user) return json({ error: "Unauthorised" }, 401);

    const { member_id } = await req.json() as { member_id: string };
    if (!member_id) return json({ error: "member_id required" }, 400);

    // Load the invite row — must belong to the calling user
    const { data: member, error: mErr } = await supabase
      .from("account_members")
      .select("id, member_email, invite_token, role, owner_id")
      .eq("id", member_id)
      .eq("owner_id", user.id)
      .single();
    if (mErr || !member) return json({ error: "Invite not found" }, 404);

    // Load owner's business name
    const { data: biz } = await supabase
      .from("business_settings")
      .select("business_name")
      .eq("owner_id", user.id)
      .single();

    const bizName    = biz?.business_name ?? "your client";
    const inviteUrl  = `${APP_ORIGIN}/invite/${member.invite_token}`;
    const roleLabel  = member.role === "bookkeeper" ? "bookkeeper" : "accountant";

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;padding:40px 20px">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">

        <!-- Logo -->
        <tr><td style="padding-bottom:32px;text-align:center">
          <span style="font-size:22px;font-weight:900;color:#ffffff;letter-spacing:-0.5px">Cadi</span>
        </td></tr>

        <!-- Card -->
        <tr><td style="background:#111118;border:1px solid rgba(153,197,255,0.12);border-radius:16px;padding:40px">

          <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:rgba(153,197,255,0.5);letter-spacing:0.08em;text-transform:uppercase">Team invite</p>
          <h1 style="margin:0 0 16px;font-size:24px;font-weight:900;color:#ffffff;line-height:1.2">
            You've been invited to access ${bizName} on Cadi
          </h1>
          <p style="margin:0 0 32px;font-size:15px;color:rgba(153,197,255,0.65);line-height:1.6">
            ${bizName} has added you as their ${roleLabel} on Cadi — the MTD-ready accounting platform for UK sole traders and small businesses.
            Click below to accept the invite and access their account.
          </p>

          <!-- CTA -->
          <table cellpadding="0" cellspacing="0" style="margin-bottom:32px">
            <tr><td style="background:#1f48ff;border-radius:10px">
              <a href="${inviteUrl}" style="display:inline-block;padding:14px 28px;font-size:14px;font-weight:900;color:#ffffff;text-decoration:none">
                Accept invite →
              </a>
            </td></tr>
          </table>

          <p style="margin:0 0 8px;font-size:13px;color:rgba(153,197,255,0.4)">Or paste this link into your browser:</p>
          <p style="margin:0;font-size:12px;color:rgba(153,197,255,0.3);word-break:break-all">${inviteUrl}</p>

        </td></tr>

        <!-- Footer -->
        <tr><td style="padding-top:24px;text-align:center">
          <p style="margin:0;font-size:12px;color:rgba(153,197,255,0.25)">
            Sent by Cadi · <a href="${APP_ORIGIN}" style="color:rgba(153,197,255,0.35)">app.cadi.cleaning</a>
          </p>
          <p style="margin:4px 0 0;font-size:11px;color:rgba(153,197,255,0.2)">
            If you weren't expecting this invite, you can ignore this email.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const res = await fetch("https://api.resend.com/emails", {
      method:  "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from:    RESEND_FROM,
        to:      [member.member_email],
        subject: `You've been invited to access ${bizName} on Cadi`,
        html,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      return json({ error: "Email send failed", detail: err }, 502);
    }

    return json({ success: true });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
