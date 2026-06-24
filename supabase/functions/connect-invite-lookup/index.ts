/**
 * supabase/functions/connect-invite-lookup/index.ts
 *
 * Anon endpoint — resolves a Cadi Connect invite token to display details on
 * /invite/:token?source=connect before the sub signs in.
 *
 * Why a function and not a public read on sub_invitations?
 * The table is RLS-locked. The token IS the access credential — we look it
 * up server-side with the service role and return only the safe fields a
 * UI needs (FM name, company name, contact name).
 *
 * POST { token } → { ok, fm_name, company_name, contact_name, email, expires_at }
 *                · status 404 if not found / expired / claimed
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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST")    return json({ error: "Method not allowed" }, 405);

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { token } = await req.json().catch(() => ({})) as { token?: string };
    if (!token || typeof token !== "string" || token.length < 16) {
      return json({ error: "Invalid token" }, 400);
    }

    const { data: invite, error } = await supabase
      .from("sub_invitations")
      .select("id, fm_organisation_id, company_name, contact_name, email, status, expires_at")
      .eq("token", token)
      .maybeSingle();

    if (error || !invite)               return json({ error: "Invite not found" }, 404);
    if (invite.status !== "pending")    return json({ error: "This invite has already been used or revoked." }, 410);
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return json({ error: "This invite has expired." }, 410);
    }

    const { data: fmOrg } = await supabase
      .from("fm_organisations")
      .select("name")
      .eq("id", invite.fm_organisation_id)
      .single();

    return json({
      ok: true,
      fm_name:      fmOrg?.name ?? "an FM partner",
      company_name: invite.company_name,
      contact_name: invite.contact_name,
      email:        invite.email,
      expires_at:   invite.expires_at,
    });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
