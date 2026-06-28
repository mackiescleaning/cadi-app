/**
 * supabase/functions/fm-invite-accept/index.ts
 *
 * JWT required. Caller has just signed up / signed in via the InviteAccept
 * React flow. This:
 *   1. Resolves the token → fm_invitations row
 *   2. Verifies it's still claimable (status='pending', not expired)
 *   3. Marks the invitation claimed by the caller
 *   4. Sets profiles.fm_organisation_id on the caller (with admin/member role
 *      noted in profiles — kept simple for now, role flag lives on the
 *      invitation only)
 *
 * Email-match is enforced: the caller's auth email must equal the
 * invitation's email (lowercase compare). Stops cross-account hijacking.
 *
 * Rate-limited 10/min per (IP + token).
 *
 * POST { token } → { ok, fm_organisation_id, role }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    const body = await req.json().catch(() => ({}));
    const token = body.token;
    if (!token) return json({ error: "token required" }, 400);

    // Rate-limit by IP + token combo
    const { data: rl } = await sb.rpc("check_and_increment_rate_limit", {
      p_bucket: "fm_invite_accept", p_key: `${ip}:${token.slice(0, 16)}`,
      p_limit: 10, p_window_ms: 60000,
    });
    const rlRow = Array.isArray(rl) ? rl[0] : rl;
    if (rlRow && !rlRow.ok) {
      const retry = Math.max(1, Math.ceil((new Date(rlRow.reset_at).getTime() - Date.now()) / 1000));
      return json({ error: "Too many requests" }, 429, { "Retry-After": String(retry) });
    }

    // Load invite
    const { data: invite } = await sb
      .from("fm_invitations")
      .select("id, fm_organisation_id, email, role, status, expires_at, claimed_by_user_id")
      .eq("token", token)
      .maybeSingle();
    if (!invite) return json({ error: "Invitation not found" }, 404);

    if (invite.status === "claimed") {
      // Already claimed — if by this user, treat as success (idempotent)
      if (invite.claimed_by_user_id === user.id) {
        return json({
          ok: true,
          already_claimed: true,
          fm_organisation_id: invite.fm_organisation_id,
          role: invite.role,
        });
      }
      return json({ error: "Invitation has already been claimed" }, 409);
    }
    if (invite.status !== "pending") {
      return json({ error: `Invitation is ${invite.status}` }, 409);
    }
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      // Mark expired so it stops looking pending
      await sb.from("fm_invitations").update({ status: "expired" }).eq("id", invite.id);
      return json({ error: "Invitation has expired" }, 409);
    }

    // Email match (case-insensitive)
    const callerEmail = (user.email ?? "").toLowerCase();
    const inviteEmail = (invite.email ?? "").toLowerCase();
    if (callerEmail && inviteEmail && callerEmail !== inviteEmail) {
      return json({
        error: `This invitation was sent to ${inviteEmail}. Sign in with that email to accept.`,
      }, 403);
    }

    const now = new Date().toISOString();

    // 1. Claim invitation
    const { error: claimErr } = await sb
      .from("fm_invitations")
      .update({
        status:             "claimed",
        claimed_by_user_id: user.id,
        claimed_at:         now,
      })
      .eq("id", invite.id)
      .eq("status", "pending");
    if (claimErr) return json({ error: `Could not claim: ${claimErr.message}` }, 500);

    // 2. Set profile.fm_organisation_id (admin role goes on the invite; we
    // don't carry it onto the profile yet — keep the surface area small.)
    await sb
      .from("profiles")
      .update({ fm_organisation_id: invite.fm_organisation_id })
      .eq("id", user.id);

    // 3. Audit
    await sb.from("audit_log").insert({
      actor_id: user.id,
      action:   "fm_invitation_claimed",
      category: "fm_ops",
      detail:   {
        invitation_id:      invite.id,
        fm_organisation_id: invite.fm_organisation_id,
        role:               invite.role,
      },
      ip:       ip === "unknown" ? null : ip,
      user_agent: ua || null,
    }).then(() => {}).catch(() => {});

    return json({
      ok:                 true,
      fm_organisation_id: invite.fm_organisation_id,
      role:               invite.role,
    });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
