/**
 * supabase/functions/connect-checkout/index.ts
 *
 * Connect — sub taps Check-out on an in-progress job. Server validates GPS
 * against the site geo-fence, writes a job_checkins row, and flips
 * jobs.status to 'complete'. Optionally takes a sign-off note.
 *
 * Rate-limit: 30/min by user. Audit-log on success.
 *
 * POST { job_id, lat, lng, note? }
 *   → { ok, inside_geo_fence, distance_m, on_site_min, status }
 *   → 403 if outside fence or job not assigned to caller
 *   → 409 if job hasn't been checked-in yet
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

function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for") ?? "";
  return xff.split(",")[0].trim() || (req.headers.get("x-real-ip") ?? "unknown");
}

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

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

    const { data: rl, error: rlErr } = await sb.rpc("check_and_increment_rate_limit", {
      p_bucket: "connect_checkout", p_key: user.id, p_limit: 30, p_window_ms: 60000,
    });
    if (!rlErr) {
      const row = Array.isArray(rl) ? rl[0] : rl;
      if (row && !row.ok) {
        const retry = Math.max(1, Math.ceil((new Date(row.reset_at).getTime() - Date.now()) / 1000));
        return json({ error: "Too many requests" }, 429, { "Retry-After": String(retry) });
      }
    }

    const body = await req.json().catch(() => ({})) as {
      job_id?: string; lat?: number; lng?: number; note?: string;
    };
    const jobId = body.job_id;
    const lat   = Number(body.lat);
    const lng   = Number(body.lng);
    const note  = (body.note ?? "").slice(0, 1000);

    if (!jobId || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      return json({ error: "job_id, lat, lng required" }, 400);
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return json({ error: "lat/lng out of range" }, 400);
    }

    const { data: job, error: jobErr } = await sb
      .from("jobs")
      .select(`
        id, status, sub_user_id, business_id, fm_organisation_id,
        site:sites ( id, lat, lng, geo_fence_radius_m )
      `)
      .eq("id", jobId)
      .eq("sub_user_id", user.id)
      .maybeSingle();

    if (jobErr) return json({ error: jobErr.message }, 500);
    if (!job)   return json({ error: "Job not found or not yours" }, 404);

    // Must already be checked-in (status in_progress) — otherwise no sane
    // duration calc. Sub should hit check-in first.
    if (job.status !== "in_progress") {
      return json({ error: "Check in first." }, 409);
    }

    const site = job.site as { id: string; lat: number | null; lng: number | null; geo_fence_radius_m: number | null } | null;
    if (!site || site.lat == null || site.lng == null) {
      return json({ error: "Site has no GPS pinned." }, 400);
    }

    const radiusM = site.geo_fence_radius_m ?? 80;
    const distanceM = Math.round(haversineM(lat, lng, Number(site.lat), Number(site.lng)));
    const insideFence = distanceM <= radiusM;

    if (!insideFence) {
      return json({
        ok: false,
        inside_geo_fence: false,
        distance_m: distanceM,
        radius_m:   radiusM,
        error: `You're ${distanceM}m from the site — must be within ${radiusM}m to check out.`,
      }, 403);
    }

    // Find the check-in stamp to compute on-site minutes
    const { data: checkin } = await sb
      .from("job_checkins")
      .select("checked_in_at")
      .eq("job_id", jobId)
      .eq("sub_user_id", user.id)
      .eq("action", "checkin")
      .order("checked_in_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const checkedOutAt = new Date();
    const onSiteMin = checkin?.checked_in_at
      ? Math.round((checkedOutAt.getTime() - new Date(checkin.checked_in_at).getTime()) / 60000)
      : null;

    const { error: coErr } = await sb.from("job_checkins").insert({
      job_id:                jobId,
      sub_user_id:           user.id,
      action:                "checkout",
      lat,
      lng,
      checked_in_at:         checkedOutAt.toISOString(),
      note:                  note || null,
      inside_geo_fence:      true,
      distance_from_site_m:  distanceM,
      business_id:           job.business_id ?? null,
    });
    if (coErr) return json({ error: coErr.message }, 500);

    const { error: jobUpd } = await sb
      .from("jobs")
      .update({
        status: "complete",
        completion_marked_at: checkedOutAt.toISOString(),
        completion_method:    "geo_fence",
        actual_duration_minutes: onSiteMin,
      })
      .eq("id", jobId)
      .eq("sub_user_id", user.id);
    if (jobUpd) return json({ error: jobUpd.message }, 500);

    await sb.from("audit_log").insert({
      actor_id: user.id,
      action:   "connect_checkout",
      category: "connect",
      detail:   { job_id: jobId, distance_m: distanceM, on_site_min: onSiteMin, fm_organisation_id: job.fm_organisation_id },
      ip:       ip === "unknown" ? null : ip,
      user_agent: ua || null,
    }).then(() => {}).catch(() => {});

    return json({
      ok: true,
      inside_geo_fence: true,
      distance_m: distanceM,
      radius_m:   radiusM,
      on_site_min: onSiteMin,
      status:     "complete",
    });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
