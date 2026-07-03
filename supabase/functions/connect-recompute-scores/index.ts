/**
 * supabase/functions/connect-recompute-scores/index.ts
 *
 * Recomputes Cadi Connect Score for every active Connect sub from raw
 * activity in the last 90 days. Writes connect_score, connect_tier,
 * connect_score_status, score_breakdown, score_recomputed_at on profiles.
 *
 * Scoring formula (max 100):
 *   Approval rate        35 pts — % of completed jobs approved
 *   Reject rate (inverse) 20 pts — fewer rejects = higher
 *   Query rate  (inverse) 15 pts — fewer queries = higher
 *   On-time check-in     10 pts — within 30 min of jobs.start_hour
 *   Evidence quality     10 pts — capped at 3 photos/job
 *   Site contact rate     5 pts — % jobs with a named witness at checkout
 *   Response time         5 pts — median minutes to first sub reply on a query
 *
 * Volume gate: under 5 completed jobs in the window → status='building',
 * score frozen at a neutral 70 so they appear in the marketplace but
 * without an inflated reputation.
 *
 * Tier mapping:
 *   ≥93 elite  ·  ≥80 verified  ·  ≥70 eligible  ·  < 70 building
 *
 * Designed to be called by pg_cron daily; also callable manually by a
 * Cadi admin (header check).
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "content-type, apikey, authorization, x-event-dispatcher-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// Per-metric weights (sum to 100). FM rating added migration 072 — took
// share from approval / reject / query so the sum stays 100 and no wild
// score jumps occur on the next recompute for existing subs.
const W = {
  approval:   30,   // was 35
  reject:     15,   // was 20
  query:      10,   // was 15
  fmRating:   15,   // NEW
  oncheck:    10,
  evidence:   10,
  contact:    5,
  response:   5,
};

const VOLUME_FLOOR  = 5;          // min completed jobs in window to be 'scored'
const WINDOW_DAYS   = 90;
const BUILDING_SCORE = 70;        // neutral score for low-volume subs
const ONCHECK_TOLERANCE_MIN = 30; // "on time" if checkin within ±30m of start

function tierFor(score: number): "elite" | "verified" | "eligible" {
  if (score >= 93) return "elite";
  if (score >= 80) return "verified";
  return "eligible";
}

function median(nums: number[]): number {
  if (!nums.length) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// Score a single sub from the raw rows. Pure function — easy to unit-test.
function scoreOne(opts: {
  completedJobs:   number;
  approvedJobs:    number;
  rejectedJobs:    number;
  queriedJobs:     number;
  onTimeCheckins:  number;
  totalCheckins:   number;
  photoCount:      number;
  jobsWithPhotos:  number;
  siteContactYes:  number;
  jobsWithContact: number;
  responseTimesMin: number[];
  ratings:          number[];   // 1-5 stars, empty if no ratings
}): { score: number; tier: string; status: string; breakdown: Record<string, unknown> } {
  const {
    completedJobs, approvedJobs, rejectedJobs, queriedJobs,
    onTimeCheckins, totalCheckins,
    photoCount, jobsWithPhotos,
    siteContactYes, jobsWithContact,
    responseTimesMin,
    ratings,
  } = opts;

  // Volume gate
  if (completedJobs < VOLUME_FLOOR) {
    return {
      score:  BUILDING_SCORE,
      tier:   "eligible",
      status: "building",
      breakdown: {
        window_days:    WINDOW_DAYS,
        jobs_in_window: completedJobs,
        status_reason:  `Building reputation — ${completedJobs} of ${VOLUME_FLOOR} jobs needed to be fully scored`,
        score:          BUILDING_SCORE,
      },
    };
  }

  // Per-metric rates (0..1)
  const approvalRate = approvedJobs / completedJobs;
  const rejectRate   = rejectedJobs / completedJobs;
  const queryRate    = queriedJobs  / completedJobs;
  const onCheckRate  = totalCheckins > 0 ? onTimeCheckins / totalCheckins : 1; // assume on time if no checkins recorded
  const avgPhotos    = jobsWithPhotos > 0 ? photoCount / jobsWithPhotos : 0;
  const evidenceRate = Math.min(1, avgPhotos / 3); // cap at 3 photos
  const contactRate  = jobsWithContact > 0 ? siteContactYes / jobsWithContact : 0;
  const medianResp   = responseTimesMin.length > 0 ? median(responseTimesMin) : 0;
  // Response time: <=60 min = 100%, >=1440 min (24h) = 0%, linear in between
  const responseRate = responseTimesMin.length === 0
    ? 1                                                        // no queries to respond to → don't penalise
    : Math.max(0, Math.min(1, (1440 - medianResp) / (1440 - 60)));

  // FM star rating — average over the window, 0..5 mapped to 0..1. If no
  // ratings exist we DON'T penalise (rate = 1.0) so subs aren't punished
  // for FMs who haven't opted into star-rating. Once the FM starts rating,
  // the signal replaces the neutral baseline.
  const avgRating = ratings.length > 0
    ? ratings.reduce((s, r) => s + r, 0) / ratings.length
    : null;
  const ratingRate = avgRating == null ? 1 : Math.max(0, Math.min(1, avgRating / 5));

  const ptsApproval = approvalRate     * W.approval;
  const ptsReject   = (1 - rejectRate) * W.reject;
  const ptsQuery    = (1 - queryRate)  * W.query;
  const ptsRating   = ratingRate       * W.fmRating;
  const ptsOncheck  = onCheckRate      * W.oncheck;
  const ptsEvidence = evidenceRate     * W.evidence;
  const ptsContact  = contactRate      * W.contact;
  const ptsResponse = responseRate     * W.response;

  const raw = ptsApproval + ptsReject + ptsQuery + ptsRating + ptsOncheck + ptsEvidence + ptsContact + ptsResponse;
  const score = Math.max(0, Math.min(100, Math.round(raw * 10) / 10));

  return {
    score,
    tier:   tierFor(score),
    status: "scored",
    breakdown: {
      window_days:    WINDOW_DAYS,
      jobs_in_window: completedJobs,
      metrics: {
        approval_rate: {
          value: Math.round(approvalRate * 100), max: W.approval, pts: Math.round(ptsApproval * 10) / 10,
          desc:  `${approvedJobs} of ${completedJobs} jobs approved`,
        },
        reject_rate: {
          value: Math.round(rejectRate * 100), max: W.reject, pts: Math.round(ptsReject * 10) / 10,
          desc:  rejectedJobs === 0 ? "No rejections" : `${rejectedJobs} of ${completedJobs} jobs rejected`,
        },
        query_rate: {
          value: Math.round(queryRate * 100), max: W.query, pts: Math.round(ptsQuery * 10) / 10,
          desc:  queriedJobs === 0 ? "No queries" : `${queriedJobs} of ${completedJobs} jobs queried`,
        },
        fm_rating: {
          value: avgRating == null ? null : Math.round(avgRating * 10) / 10,
          max:   W.fmRating,
          pts:   Math.round(ptsRating * 10) / 10,
          desc:  ratings.length === 0
            ? "No FM star ratings yet — neutral until an FM rates a job"
            : `Avg ${(Math.round(avgRating * 10) / 10).toFixed(1)}★ from ${ratings.length} rating${ratings.length === 1 ? '' : 's'}`,
        },
        on_time_check_in: {
          value: Math.round(onCheckRate * 100), max: W.oncheck, pts: Math.round(ptsOncheck * 10) / 10,
          desc:  totalCheckins === 0 ? "No check-ins yet" : `${onTimeCheckins} of ${totalCheckins} check-ins within ±${ONCHECK_TOLERANCE_MIN}m of scheduled start`,
        },
        evidence_quality: {
          value: Math.round(avgPhotos * 10) / 10, max: W.evidence, pts: Math.round(ptsEvidence * 10) / 10,
          desc:  `Avg ${(Math.round(avgPhotos * 10) / 10).toFixed(1)} photos per job (target: 3)`,
        },
        site_contact: {
          value: Math.round(contactRate * 100), max: W.contact, pts: Math.round(ptsContact * 10) / 10,
          desc:  jobsWithContact === 0 ? "No checkouts with contact captured" : `${siteContactYes} of ${jobsWithContact} jobs had a named site contact`,
        },
        response_time: {
          value: Math.round(medianResp), max: W.response, pts: Math.round(ptsResponse * 10) / 10,
          desc:  responseTimesMin.length === 0
            ? "No queries to respond to"
            : `Median response: ${Math.round(medianResp)}m`,
        },
      },
      score,
      tier: tierFor(score),
    },
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST")    return json({ error: "Method not allowed" }, 405);

  // Caller is either pg_cron via event_dispatcher (header check) or a Cadi admin.
  const dispatcherSecret = Deno.env.get("EVENT_DISPATCHER_SECRET") ?? "";
  const headerSecret     = req.headers.get("x-event-dispatcher-secret") ?? "";
  const isCron = dispatcherSecret && headerSecret && dispatcherSecret === headerSecret;

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  if (!isCron) {
    const authHeader = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
    const { data: { user }, error: authErr } = await sb.auth.getUser(authHeader);
    if (authErr || !user) return json({ error: "Unauthorized" }, 401);
    const { data: caller } = await sb.from("profiles").select("is_cadi_admin").eq("id", user.id).maybeSingle();
    if (!caller?.is_cadi_admin) return json({ error: "Cadi admin only" }, 403);
  }

  const windowStart = new Date();
  windowStart.setUTCDate(windowStart.getUTCDate() - WINDOW_DAYS);
  const windowStartIso = windowStart.toISOString();
  const windowStartDate = windowStartIso.slice(0, 10);

  // Find every sub_user_id that's touched a job in the window
  const { data: activeJobs } = await sb
    .from("jobs")
    .select("sub_user_id")
    .not("sub_user_id", "is", null)
    .gte("created_at", windowStartIso);
  const subIds = Array.from(new Set((activeJobs ?? []).map(r => r.sub_user_id as string)));

  const results: Array<{ sub_user_id: string; score: number; tier: string; status: string }> = [];

  for (const subId of subIds) {
    // Pull all the rows we need for this sub in one round-trip-ish per table
    const [jobsRes, checkinsRes, evidenceRes, msgsRes, ratingsRes] = await Promise.all([
      sb.from("jobs")
        .select("id, status, approval_status, completion_marked_at, start_hour, date")
        .eq("sub_user_id", subId)
        .gte("created_at", windowStartIso),
      sb.from("job_checkins")
        .select("job_id, action, checked_in_at, customer_on_site")
        .eq("sub_user_id", subId)
        .gte("checked_in_at", windowStartIso),
      sb.from("job_evidence")
        .select("job_id, type, created_at")
        .eq("owner_id", subId)
        .gte("created_at", windowStartIso),
      sb.from("job_messages")
        .select("job_id, author_role, created_at")
        .eq("author_id", subId)
        .gte("created_at", windowStartIso),
      sb.from("job_ratings")
        .select("stars")
        .eq("sub_user_id", subId)
        .gte("created_at", windowStartIso),
    ]);

    const jobs     = jobsRes.data     ?? [];
    const checkins = checkinsRes.data ?? [];
    const evidence = evidenceRes.data ?? [];
    const msgs     = msgsRes.data     ?? [];
    const ratings  = (ratingsRes.data ?? []).map((r: { stars: number }) => Number(r.stars)).filter((n: number) => Number.isFinite(n));

    const completedJobs = jobs.filter((j: { completion_marked_at: string | null }) => j.completion_marked_at != null);
    const completedIds  = new Set(completedJobs.map((j: { id: string }) => j.id));

    const approvedJobs = completedJobs.filter((j: { approval_status: string }) => j.approval_status === "approved").length;
    const rejectedJobs = completedJobs.filter((j: { approval_status: string }) => j.approval_status === "rejected").length;
    const queriedJobs  = completedJobs.filter((j: { approval_status: string }) => j.approval_status === "queried").length;

    // On-time check-in: only count rows where we have BOTH a scheduled start
    // (jobs.date + jobs.start_hour) and a checkin row.
    const jobIndex = new Map<string, { date: string | null; start_hour: number | null }>(
      jobs.map(j => [j.id, { date: j.date, start_hour: j.start_hour }]),
    );
    let onTimeCheckins = 0;
    let totalCheckins  = 0;
    for (const c of checkins) {
      if (c.action !== "checkin") continue;
      const j = jobIndex.get(c.job_id);
      if (!j || !j.date || j.start_hour == null) continue;
      totalCheckins++;
      const scheduled = new Date(j.date);
      scheduled.setUTCHours(0, 0, 0, 0);
      const hours = Math.floor(j.start_hour);
      const mins  = Math.round((j.start_hour - hours) * 60);
      scheduled.setUTCHours(hours, mins);
      const actual = new Date(c.checked_in_at);
      const deltaMin = Math.abs((actual.getTime() - scheduled.getTime()) / 60000);
      if (deltaMin <= ONCHECK_TOLERANCE_MIN) onTimeCheckins++;
    }

    // Evidence: total photo rows + jobs that have at least one photo
    const photoEvidence = evidence.filter(e => e.type !== "note");
    const photoCount    = photoEvidence.length;
    const jobsWithPhotos = new Set(photoEvidence.map(e => e.job_id)).size;

    // Site contact: out of checkouts with the field populated
    const checkouts = checkins.filter(c => c.action === "checkout" && c.customer_on_site !== null);
    const siteContactYes  = checkouts.filter(c => c.customer_on_site === true).length;
    const jobsWithContact = checkouts.length;

    // Response time: for each queried job, time from FM query → first sub message.
    // FM query timestamp = the audit_log entry; cheaper to approximate using
    // the queried-status jobs and the first sub-authored message on that job.
    // If sub never responded, count as "no data" rather than 24h penalty.
    const subMsgsByJob = new Map<string, string[]>();
    for (const m of msgs) {
      if (m.author_role !== "sub") continue;
      const arr = subMsgsByJob.get(m.job_id) ?? [];
      arr.push(m.created_at);
      subMsgsByJob.set(m.job_id, arr);
    }
    // Approximate query timestamps via audit_log
    const { data: queryAudits } = await sb
      .from("audit_log")
      .select("created_at, detail")
      .eq("action", "connect_job_queried")
      .eq("category", "connect")
      .gte("created_at", windowStartIso);
    const queryTimesByJob = new Map<string, string>();
    for (const a of queryAudits ?? []) {
      // deno-lint-ignore no-explicit-any
      const jobId = (a.detail as any)?.job_id as string | undefined;
      if (!jobId) continue;
      // Keep the most recent query time per job
      const existing = queryTimesByJob.get(jobId);
      if (!existing || existing < a.created_at) queryTimesByJob.set(jobId, a.created_at);
    }
    const responseTimesMin: number[] = [];
    for (const [jobId, queryAt] of queryTimesByJob) {
      if (!completedIds.has(jobId)) continue;
      const subReplies = (subMsgsByJob.get(jobId) ?? []).filter(t => t > queryAt).sort();
      if (subReplies.length === 0) continue;
      const deltaMin = (new Date(subReplies[0]).getTime() - new Date(queryAt).getTime()) / 60000;
      if (deltaMin >= 0) responseTimesMin.push(deltaMin);
    }

    const computed = scoreOne({
      completedJobs:   completedJobs.length,
      approvedJobs,
      rejectedJobs,
      queriedJobs,
      onTimeCheckins,
      totalCheckins,
      photoCount,
      jobsWithPhotos,
      siteContactYes,
      jobsWithContact,
      responseTimesMin,
      ratings,
    });

    const breakdown = { ...computed.breakdown, computed_at: new Date().toISOString() };

    await sb.from("profiles").update({
      connect_score:        computed.score,
      connect_tier:         computed.tier,
      connect_score_status: computed.status,
      score_breakdown:      breakdown,
      score_recomputed_at:  new Date().toISOString(),
    }).eq("id", subId);

    results.push({
      sub_user_id: subId,
      score:       computed.score,
      tier:        computed.tier,
      status:      computed.status,
    });
  }

  // unused for now but kept for symmetry / future job-since-last-run logic
  void windowStartDate;

  await sb.from("audit_log").insert({
    actor_id: null,
    action:   "connect_scores_recomputed",
    category: "connect",
    detail:   { count: results.length, window_days: WINDOW_DAYS },
  }).then(() => {}).catch(() => {});

  return json({ ok: true, recomputed: results.length, results });
});
