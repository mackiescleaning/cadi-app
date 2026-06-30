/**
 * supabase/functions/connect-checkin/index.ts
 *
 * Connect — sub taps Check-in on a scheduled job. Server validates that the
 * device GPS sits inside the site's geo-fence (radius in metres on sites),
 * writes a job_checkins row, and flips jobs.status to 'in_progress'.
 *
 * Rate-limit: 30/min by user. Audit-log on success.
 *
 * POST { job_id, lat, lng, accuracy_m? }
 *   → { ok, inside_geo_fence, distance_m, status }
 *   → 403 if outside fence or job not assigned to caller
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

// Haversine distance in metres
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

    // Rate-limit by user — 30 check-ins per minute is well above any
    // legitimate workflow, but tight enough to stop runaway scripts.
    const { data: rl, error: rlErr } = await sb.rpc("check_and_increment_rate_limit", {
      p_bucket: "connect_checkin", p_key: user.id, p_limit: 30, p_window_ms: 60000,
    });
    if (!rlErr) {
      const row = Array.isArray(rl) ? rl[0] : rl;
      if (row && !row.ok) {
        const retry = Math.max(1, Math.ceil((new Date(row.reset_at).getTime() - Date.now()) / 1000));
        return json({ error: "Too many requests" }, 429, { "Retry-After": String(retry) });
      }
    }

    const body = await req.json().catch(() => ({})) as {
      job_id?: string; lat?: number; lng?: number; accuracy_m?: number;
    };
    const jobId = body.job_id;
    const lat   = Number(body.lat);
    const lng   = Number(body.lng);

    if (!jobId || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      return json({ error: "job_id, lat, lng required" }, 400);
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return json({ error: "lat/lng out of range" }, 400);
    }

    // Load the job + site, enforcing sub_user_id = caller via the predicate
    const { data: job, error: jobErr } = await sb
      .from("jobs")
      .select(`
        id, status, sub_user_id, site_id, business_id, fm_organisation_id,
        site:sites ( id, lat, lng, geo_fence_radius_m )
      `)
      .eq("id", jobId)
      .eq("sub_user_id", user.id)
      .maybeSingle();

    if (jobErr) return json({ error: jobErr.message }, 500);
    if (!job)   return json({ error: "Job not found or not yours" }, 404);

    const site = job.site as { id: string; lat: number | null; lng: number | null; geo_fence_radius_m: number | null } | null;
    if (!site || site.lat == null || site.lng == null) {
      return json({ error: "Site has no GPS pinned — ask your FM to set the site location." }, 400);
    }

    const radiusM = site.geo_fence_radius_m ?? 80;
    const distanceM = Math.round(haversineM(lat, lng, Number(site.lat), Number(site.lng)));
    const insideFence = distanceM <= radiusM;

    if (!insideFence) {
      // Don't write a check-in. Let the client retell the sub how far they are.
      return json({
        ok: false,
        inside_geo_fence: false,
        distance_m: distanceM,
        radius_m:   radiusM,
        error: `You're ${distanceM}m from the site — must be within ${radiusM}m to check in.`,
      }, 403);
    }

    // Write the check-in row. RLS allows it because sub_user_id matches.
    // business_id is intentionally omitted: jobs.business_id references the
    // residential `businesses` table, but job_checkins.business_id has an FK
    // to `profiles`. Passing jobs.business_id violates the FK. The column was
    // made nullable in migration 066, so omitting it on Connect checkins is
    // both correct and accepted by the schema.
    const { error: ciErr } = await sb.from("job_checkins").insert({
      job_id:                jobId,
      sub_user_id:           user.id,
      action:                "checkin",
      lat,
      lng,
      checked_in_at:         new Date().toISOString(),
      inside_geo_fence:      true,
      distance_from_site_m:  distanceM,
    });
    if (ciErr) return json({ error: ciErr.message }, 500);

    // Flip job status
    const { error: jobUpd } = await sb
      .from("jobs")
      .update({ status: "in_progress" })
      .eq("id", jobId)
      .eq("sub_user_id", user.id);
    if (jobUpd) return json({ error: jobUpd.message }, 500);

    // Audit — non-fatal
    await sb.from("audit_log").insert({
      actor_id: user.id,
      action:   "connect_checkin",
      category: "connect",
      detail:   { job_id: jobId, distance_m: distanceM, radius_m: radiusM, fm_organisation_id: job.fm_organisation_id },
      ip:       ip === "unknown" ? null : ip,
      user_agent: ua || null,
    }).then(() => {}).catch(() => {});

    return json({
      ok: true,
      inside_geo_fence: true,
      distance_m: distanceM,
      radius_m:   radiusM,
      status:     "in_progress",
    });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
