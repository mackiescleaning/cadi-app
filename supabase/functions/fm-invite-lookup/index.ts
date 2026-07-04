/**
 * supabase/functions/fm-invite-lookup/index.ts
 *
 * Public (no JWT). Looks up an fm_invitations row by token and returns
 * just enough for the React /invite/:token page to render its branded UI
 * without exposing PII to the world.
 *
 * Rate-limited 60/min by IP.
 *
 * POST { token } → { ok, invite: { fm_organisation_name, contact_name, email, role, status, expires_at } }
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

    // Rate-limit by IP
    const { data: rl } = await sb.rpc("check_and_increment_rate_limit", {
      p_bucket: "fm_invite_lookup", p_key: clientIp(req), p_limit: 60, p_window_ms: 60000,
    });
    const rlRow = Array.isArray(rl) ? rl[0] : rl;
    if (rlRow && !rlRow.ok) {
      const retry = Math.max(1, Math.ceil((new Date(rlRow.reset_at).getTime() - Date.now()) / 1000));
      return json({ error: "Too many requests" }, 429, { "Retry-After": String(retry) });
    }

    const body = await req.json().catch(() => ({}));
    const token = body.token;
    if (!token) return json({ error: "token required" }, 400);

    const { data: invite, error: iErr } = await sb
      .from("fm_invitations")
      .select(`
        id, email, contact_name, role, status, expires_at,
        fm_organisation:fm_organisations ( id, name )
      `)
      .eq("token", token)
      .maybeSingle();
    if (iErr) return json({ error: iErr.message }, 500);
    if (!invite) return json({ error: "Invitation not found" }, 404);

    // Only surface details (incl. the invited email / contact name) for a still-
    // valid invite. For claimed/revoked/expired invites, return a bare "no longer
    // valid" so a token-holder can't harvest the invitee's PII after the fact.
    const isExpired = invite.expires_at && new Date(invite.expires_at) < new Date();
    if (invite.status !== "pending" || isExpired) {
      return json({ ok: false, error: "This invitation is no longer valid." }, 410);
    }

    return json({
      ok: true,
      invite: {
        fm_organisation_name: invite.fm_organisation?.name ?? null,
        contact_name:         invite.contact_name,
        email:                invite.email,
        role:                 invite.role,
        status:               invite.status,
        expires_at:           invite.expires_at,
      },
    });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
