/**
 * supabase/functions/invite-accept/index.ts
 *
 * JWT-required endpoint — accept an accountant invite.
 *
 * Replaces the client-side update on `account_members` so that anon callers
 * can no longer reach the table directly.
 *
 * ALSO enforces the previously-missing check that the authenticated user's
 * email matches the invited email (`InviteAccept` allowed magic-link with a
 * different email than was invited — P1 in the audit).
 *
 * POST { token }  →  { ok: true, member_id, owner_id }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL  = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "content-type, apikey, authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST")    return json({ error: "Method not allowed" }, 405);

  try {
    // Authed user — required
    const sb = createClient(SUPABASE_URL, SERVICE_KEY);
    const authHeader = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
    const { data: { user }, error: authErr } = await sb.auth.getUser(authHeader);
    if (authErr || !user) return json({ error: "Unauthorized" }, 401);

    const { token } = await req.json() as { token?: string };
    if (!token || typeof token !== "string" || token.length < 16) {
      return json({ error: "Invalid token" }, 400);
    }

    const { data: member, error: lookupErr } = await sb
      .from("account_members")
      .select("id, owner_id, member_email, status, expires_at")
      .eq("invite_token", token)
      .maybeSingle();

    if (lookupErr || !member) return json({ error: "Invite not found" }, 404);
    if (member.status !== "pending") {
      return json({ error: "This invite has already been accepted or revoked." }, 410);
    }
    if (member.expires_at && new Date(member.expires_at) < new Date()) {
      return json({ error: "This invite has expired." }, 410);
    }

    // Email match enforcement — the magic link could have been sent to a
    // different address than the one invited. Reject case-insensitively.
    const invitedEmail = (member.member_email ?? "").toLowerCase().trim();
    const authedEmail  = (user.email          ?? "").toLowerCase().trim();
    if (!invitedEmail || invitedEmail !== authedEmail) {
      return json({
        error: `This invite was sent to ${member.member_email}. Sign in with that email to accept.`,
      }, 403);
    }

    const { error: updateErr } = await sb
      .from("account_members")
      .update({
        member_user_id: user.id,
        status:         "active",
        accepted_at:    new Date().toISOString(),
      })
      .eq("id", member.id)
      .eq("status", "pending"); // race guard

    if (updateErr) return json({ error: updateErr.message }, 500);

    // Write audit row (non-fatal if the table doesn't accept the insert — accept still succeeded)
    await sb.from("account_member_audit").insert({
      member_id: member.id,
      owner_id:  member.owner_id,
      actor_id:  user.id,
      action:    "invited",
      detail:    { event: "accepted" },
    }).then(() => {}).catch(() => {});

    return json({ ok: true, member_id: member.id, owner_id: member.owner_id });
  } catch (e) {
    const message = (e as Error).message ?? "Server error";
    return json({ error: message }, 500);
  }
});
