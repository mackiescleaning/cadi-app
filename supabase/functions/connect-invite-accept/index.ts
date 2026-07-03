/**
 * supabase/functions/connect-invite-accept/index.ts
 *
 * JWT-required — accept a Cadi Connect subcontractor invite.
 *
 * Side effects (single transaction-like sequence):
 *   1. Marks the sub_invitations row claimed by the authed user
 *   2. Sets profiles.connect_unlocked_by_fm_id to the inviting FM
 *      (this is the "free Lite + Britannia Connect unlocked" wedge)
 *   3. Copies company_name → profiles.business_name (if empty)
 *      and trades/region into the connect_* columns
 *
 * Enforces:
 *   - Authenticated user
 *   - Token resolves to a pending, unexpired sub_invitations row
 *   - If the invite has an email, the authed user's email must match
 *     (case-insensitive). Stops a magic-link sent to a different address
 *     from being used to claim someone else's invite.
 *
 * POST { token } → { ok, fm_organisation_id, connect_unlocked: true }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "content-type, apikey, authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const jsonR = (data: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json", ...extra } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST")    return json({ error: "Method not allowed" }, 405);

  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const authHeader = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
    const { data: { user }, error: authErr } = await sb.auth.getUser(authHeader);
    if (authErr || !user) return json({ error: "Unauthorized" }, 401);

    // Rate limit per authed user — accepting invites shouldn't need more
    // than a handful of attempts, and this caps token-guessing by someone
    // who's created a fresh Supabase account.
    const { data: rl } = await sb.rpc("check_and_increment_rate_limit", {
      p_bucket: "connect_invite_accept", p_key: user.id, p_limit: 20, p_window_ms: 60000,
    });
    const rlRow = Array.isArray(rl) ? rl[0] : rl;
    if (rlRow && !rlRow.ok) {
      const retry = Math.max(1, Math.ceil((new Date(rlRow.reset_at).getTime() - Date.now()) / 1000));
      return jsonR({ error: "Too many requests" }, 429, { "Retry-After": String(retry) });
    }

    const { token } = await req.json().catch(() => ({})) as { token?: string };
    if (!token || typeof token !== "string" || token.length < 16) {
      return json({ error: "Invalid token" }, 400);
    }

    // 1 · Resolve the invite (must be pending + not expired)
    const { data: invite, error: lookupErr } = await sb
      .from("sub_invitations")
      .select("id, fm_organisation_id, company_name, contact_name, email, region, trades, status, expires_at")
      .eq("token", token)
      .maybeSingle();
    if (lookupErr || !invite)              return json({ error: "Invite not found" }, 404);
    if (invite.status !== "pending")       return json({ error: "This invite has already been used or revoked." }, 410);
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return json({ error: "This invite has expired." }, 410);
    }

    // 2 · Email-match enforcement (only when the invite carries an email)
    if (invite.email) {
      const invitedEmail = invite.email.toLowerCase().trim();
      const authedEmail  = (user.email ?? "").toLowerCase().trim();
      if (!authedEmail || invitedEmail !== authedEmail) {
        return json({
          error: `This invite was sent to ${invite.email}. Sign in with that email to accept.`,
        }, 403);
      }
    }

    // 3 · Mark invite claimed — race-guarded by status filter
    const { error: claimErr } = await sb
      .from("sub_invitations")
      .update({
        status:              "claimed",
        claimed_by_user_id:  user.id,
        claimed_at:          new Date().toISOString(),
      })
      .eq("id", invite.id)
      .eq("status", "pending");
    if (claimErr) return json({ error: claimErr.message }, 500);

    // 4 · Patch profile — set Connect-unlocked wedge + copy seed metadata
    //     (only fill blanks; never overwrite values the user already set)
    const { data: existing } = await sb
      .from("profiles")
      .select("business_name, connect_unlocked_by_fm_id, connect_region, connect_trades")
      .eq("id", user.id)
      .maybeSingle();

    const patch: Record<string, unknown> = {
      connect_unlocked_by_fm_id: invite.fm_organisation_id,
    };
    if (!existing?.business_name && invite.company_name) {
      patch.business_name = invite.company_name;
    }
    if (!existing?.connect_region && invite.region) {
      patch.connect_region = invite.region;
    }
    if ((!existing?.connect_trades || existing.connect_trades.length === 0) && Array.isArray(invite.trades) && invite.trades.length > 0) {
      patch.connect_trades = invite.trades;
    }

    const { error: patchErr } = await sb
      .from("profiles")
      .update(patch)
      .eq("id", user.id);
    if (patchErr) return json({ error: patchErr.message }, 500);

    return json({
      ok: true,
      fm_organisation_id: invite.fm_organisation_id,
      connect_unlocked: true,
    });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
