/**
 * supabase/functions/connect-listing-question/index.ts
 *
 * Post a question or answer on a marketplace listing's Q&A thread.
 * Enforces:
 *   • Listing must be in status 'open' or 'bidding' (pre-award only)
 *   • Caller is either the assigned FM org (answer) or a sub who can see
 *     the listing (question). RLS on the table itself covers the rest.
 *
 * Deployed with --no-verify-jwt=false (default) so we still get a JWT.
 *
 * POST { listing_id, body, parent_id? }
 *   → { ok, id, author_role }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "content-type, apikey, authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (data: unknown, status = 200, extra: Record<string, string> = {}) =>
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

    // Rate limit — 30 posts/min per user (light abuse guard, generous
    // enough for legit rapid-fire Q&A during a bid window).
    const { data: rl } = await sb.rpc("check_and_increment_rate_limit", {
      p_bucket: "connect_listing_question", p_key: user.id, p_limit: 30, p_window_ms: 60000,
    });
    const rlRow = Array.isArray(rl) ? rl[0] : rl;
    if (rlRow && !rlRow.ok) {
      const retry = Math.max(1, Math.ceil((new Date(rlRow.reset_at).getTime() - Date.now()) / 1000));
      return json({ error: "Too many requests" }, 429, { "Retry-After": String(retry) });
    }

    const body = await req.json().catch(() => ({})) as {
      listing_id?: string; body?: string; parent_id?: string | null;
    };
    const listingId = body.listing_id;
    const text = (body.body ?? "").trim().slice(0, 2000);
    const parentId = body.parent_id ?? null;

    if (!listingId || !text) return json({ error: "listing_id and body required" }, 400);

    // Listing must exist and be pre-award
    const { data: listing } = await sb
      .from("marketplace_listings")
      .select("id, status, fm_organisation_id")
      .eq("id", listingId)
      .maybeSingle();
    if (!listing) return json({ error: "Listing not found" }, 404);
    if (!["open", "bidding"].includes(listing.status)) {
      return json({ error: "Listing is closed — Q&A is only available before award." }, 409);
    }

    // Determine role: FM org member → 'fm', otherwise → 'sub'
    const { data: caller } = await sb
      .from("profiles")
      .select("fm_organisation_id")
      .eq("id", user.id)
      .maybeSingle();
    const isFm = caller?.fm_organisation_id && caller.fm_organisation_id === listing.fm_organisation_id;
    const authorRole = isFm ? "fm" : "sub";

    // Insert. RLS also validates but we've already vetted here.
    const { data: inserted, error: insErr } = await sb
      .from("marketplace_listing_qa")
      .insert({
        listing_id:  listingId,
        author_id:   user.id,
        author_role: authorRole,
        body:        text,
        parent_id:   parentId,
      })
      .select("id, created_at")
      .single();
    if (insErr) return json({ error: insErr.message }, 500);

    // Audit
    await sb.from("audit_log").insert({
      actor_id: user.id,
      action:   "connect_listing_qa_posted",
      category: "connect",
      detail:   { listing_id: listingId, message_id: inserted?.id, author_role: authorRole },
    }).then(() => {}).catch(() => {});

    return json({ ok: true, id: inserted?.id, author_role: authorRole });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
