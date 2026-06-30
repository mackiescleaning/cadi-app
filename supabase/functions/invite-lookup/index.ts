/**
 * supabase/functions/invite-lookup/index.ts
 *
 * Public endpoint — accountant invite lookup by token.
 *
 * Replaces the previous client-side SELECT on `account_members` which required
 * an open RLS policy (`using (true)`) that let any anon caller enumerate every
 * pending invite token.
 *
 * Returns the minimum needed to render the InviteAccept screen — never the row
 * id, never the owner_id, never other rows.
 *
 * POST { token }  →  { business_name, role, member_email, expires_at, status }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit, clientIp, rateLimitedResponse } from "../_shared/rateLimit.ts";

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
    const { token } = await req.json() as { token?: string };
    if (!token || typeof token !== "string" || token.length < 16) {
      return json({ error: "Invalid token" }, 400);
    }

    const sb = createClient(SUPABASE_URL, SERVICE_KEY);

    // Rate limit: 10 lookups per IP per minute. Prevents anyone from grinding
    // through the token space if they ever guess the token format.
    const rl = await checkRateLimit(sb, {
      bucket:   "invite-lookup",
      key:      clientIp(req),
      limit:    10,
      windowMs: 60 * 1000,
    });
    if (!rl.ok) return rateLimitedResponse(CORS, rl.resetAt);

    const { data: member, error } = await sb
      .from("account_members")
      .select("role, member_email, status, expires_at, owner_id")
      .eq("invite_token", token)
      .maybeSingle();

    // Always return the same shape and the same status for "not found" and
    // "found but already used" to avoid leaking the existence of a token.
    if (error || !member) {
      return json({ error: "Invite not found" }, 404);
    }

    if (member.status !== "pending") {
      return json({ error: "This invite has already been accepted or revoked." }, 410);
    }

    if (member.expires_at && new Date(member.expires_at) < new Date()) {
      return json({ error: "This invite has expired." }, 410);
    }

    // Fetch business name — lives on profiles, not business_settings. Was
    // querying the wrong table previously, which always fell back to the
    // generic "your client" label.
    const { data: ownerProfile } = await sb
      .from("profiles")
      .select("business_name, first_name")
      .eq("id", member.owner_id)
      .maybeSingle();

    return json({
      role:          member.role,
      member_email:  member.member_email,
      expires_at:    member.expires_at,
      status:        member.status,
      business_name: ownerProfile?.business_name ?? ownerProfile?.first_name ?? "your client",
    });
  } catch (e) {
    const message = (e as Error).message ?? "Server error";
    return json({ error: message }, 500);
  }
});
