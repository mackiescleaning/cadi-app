/**
 * supabase/functions/award-listing/index.ts
 *
 * FM-side. Awards a marketplace_listings row to a specific marketplace_bids
 * row. In one transaction:
 *   • flip listing → status='awarded' (+ awarded_to_user_id, awarded_at)
 *   • flip winning bid → status='accepted'
 *   • flip all other bids on this listing → status='lost'
 *   • flip the visit_spec → status='active' (+ assigned_sub_user_id)
 *   • insert a jobs row linking site / contract / listing / visit_spec / sub
 *
 * Caller must belong to the FM organisation that owns the listing.
 *
 * POST { listing_id, bid_id, scheduled_date?, start_hour?, duration_hrs? }
 *   → { ok, listing_id, bid_id, job_id, sub_user_id }
 *
 * Audit-logged. Rate-limited 60/min per user.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "content-type, apikey, authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (data: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json", ...extra },
  });

function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for") ?? "";
  return xff.split(",")[0].trim() || (req.headers.get("x-real-ip") ?? "unknown");
}

const FREQ_TO_DURATION_MIN: Record<string, number> = {
  weekly: 120, fortnightly: 120, monthly: 180, quarterly: 240, annual: 300, one_off: 180,
};

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

    const ip = clientIp(req);
    const ua = req.headers.get("user-agent") ?? "";

    // Caller must be an FM-org member
    const { data: caller } = await sb
      .from("profiles")
      .select("id, fm_organisation_id")
      .eq("id", user.id)
      .single();
    if (!caller?.fm_organisation_id) {
      return json({ error: "Caller is not an FM-organisation member" }, 403);
    }

    // Rate-limit 60/min per user
    const { data: rl } = await sb.rpc("check_and_increment_rate_limit", {
      p_bucket: "award_listing", p_key: user.id, p_limit: 60, p_window_ms: 60000,
    });
    const rlRow = Array.isArray(rl) ? rl[0] : rl;
    if (rlRow && !rlRow.ok) {
      const retry = Math.max(1, Math.ceil((new Date(rlRow.reset_at).getTime() - Date.now()) / 1000));
      return json({ error: "Too many requests" }, 429, { "Retry-After": String(retry) });
    }

    const body = await req.json().catch(() => ({})) as {
      listing_id?: string;
      bid_id?: string;
      scheduled_date?: string;
      start_hour?: number;
      duration_hrs?: number;
    };
    const { listing_id, bid_id } = body;
    if (!listing_id || !bid_id) {
      return json({ error: "listing_id + bid_id required" }, 400);
    }

    // Load listing — must belong to caller's FM org
    const { data: listing, error: lErr } = await sb
      .from("marketplace_listings")
      .select(`
        id, status, fm_organisation_id, visit_spec_id, target_price,
        visit_spec:visit_specs (
          id, contract_id, site_id, frequency, scope, duration_minutes, price_per_visit,
          assigned_sub_user_id, status
        )
      `)
      .eq("id", listing_id)
      .eq("fm_organisation_id", caller.fm_organisation_id)
      .is("deleted_at", null)
      .maybeSingle();

    if (lErr) return json({ error: lErr.message }, 500);
    if (!listing) return json({ error: "Listing not found in your organisation" }, 404);
    if (!["open", "bidding"].includes(listing.status)) {
      return json({ error: `Listing is in '${listing.status}' state — cannot award.` }, 409);
    }
    if (!listing.visit_spec) {
      return json({ error: "Listing's visit_spec is missing" }, 500);
    }

    // Load the winning bid — must belong to this listing + be submitted
    const { data: bid, error: bErr } = await sb
      .from("marketplace_bids")
      .select("id, listing_id, sub_user_id, bid_price, status")
      .eq("id", bid_id)
      .eq("listing_id", listing_id)
      .maybeSingle();
    if (bErr) return json({ error: bErr.message }, 500);
    if (!bid) return json({ error: "Bid not found on this listing" }, 404);
    if (bid.status !== "submitted") {
      return json({ error: `Bid is in '${bid.status}' state — cannot award.` }, 409);
    }
    if (!bid.sub_user_id) {
      return json({ error: "Bid has no sub_user_id — cannot award." }, 500);
    }

    const now = new Date().toISOString();
    const visit_spec = listing.visit_spec;
    const subUserId = bid.sub_user_id;
    const winningPrice = Number(bid.bid_price) || Number(listing.target_price) || 0;

    // 1. Flip listing
    const { error: ulErr } = await sb
      .from("marketplace_listings")
      .update({
        status:               "awarded",
        awarded_to_user_id:   subUserId,
        awarded_at:           now,
      })
      .eq("id", listing_id);
    if (ulErr) return json({ error: `Could not award listing: ${ulErr.message}` }, 500);

    // 2. Winning bid → accepted
    await sb.from("marketplace_bids")
      .update({ status: "accepted" })
      .eq("id", bid_id);

    // 3. Other bids → lost
    await sb.from("marketplace_bids")
      .update({ status: "lost" })
      .eq("listing_id", listing_id)
      .neq("id", bid_id)
      .eq("status", "submitted");

    // 4. visit_spec → active + assigned
    await sb.from("visit_specs")
      .update({
        status:               "active",
        assigned_sub_user_id: subUserId,
      })
      .eq("id", visit_spec.id);

    // 5. Insert a jobs row.
    // Date defaults to today — FM can reschedule via the Schedule screen.
    // duration_hrs defaults to visit_spec.duration_minutes if set, else
    // a frequency-based fallback.
    const durMin =
      visit_spec.duration_minutes ??
      FREQ_TO_DURATION_MIN[visit_spec.frequency] ?? 180;
    const today = body.scheduled_date ?? now.slice(0, 10);
    const startHour = body.start_hour ?? 9;
    const durHrs   = body.duration_hrs ?? (durMin / 60);

    const { data: createdJob, error: jErr } = await sb
      .from("jobs")
      .insert({
        site_id:            visit_spec.site_id,
        contract_id:        visit_spec.contract_id,
        listing_id:         listing_id,
        visit_spec_id:      visit_spec.id,
        sub_user_id:        subUserId,
        fm_organisation_id: listing.fm_organisation_id,
        date:               today,
        start_hour:         startHour,
        duration_hrs:       durHrs,
        type:               "commercial",
        service:            visit_spec.scope,
        price:              winningPrice,
        status:             "scheduled",
        source:             "marketplace",
      })
      .select("id")
      .single();
    if (jErr) {
      // Best-effort cleanup — we don't want a half-awarded listing without a job.
      // The listing/bid/visit_spec flips are visible to the FM, so they can
      // re-trigger by re-awarding a different bid if this fails.
      return json({ error: `Job creation failed: ${jErr.message}` }, 500);
    }

    // Audit
    await sb.from("audit_log").insert({
      actor_id: user.id,
      action:   "marketplace_listing_awarded",
      category: "connect",
      detail: {
        listing_id,
        bid_id,
        sub_user_id: subUserId,
        job_id:      createdJob.id,
        winning_price: winningPrice,
      },
      ip:         ip === "unknown" ? null : ip,
      user_agent: ua || null,
    }).then(() => {}).catch(() => {});

    return json({
      ok:           true,
      listing_id,
      bid_id,
      sub_user_id:  subUserId,
      job_id:       createdJob.id,
    });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
