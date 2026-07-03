/**
 * supabase/functions/connect-schedule-visit/index.ts
 *
 * Sub-schedules-own-visits pattern. For a visit_spec assigned to the caller,
 * create a scheduled jobs row for a specific date/time. Runs on the sub's
 * schedule (their van, their staff availability, their weather), not a cron.
 *
 * The FM's Schedule view then simply renders whatever jobs the sub has
 * created — no separate confirmation loop.
 *
 * POST { visit_spec_id, date, start_hour? }
 *   → { ok, job_id }
 *
 * Rate-limited 60/min/user.
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

// YYYY-MM-DD only — no timezone drama. Rejects malformed inputs.
function isValidDateStr(s: string): boolean {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(s).getTime());
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

    const { data: rl } = await sb.rpc("check_and_increment_rate_limit", {
      p_bucket: "connect_schedule_visit", p_key: user.id, p_limit: 60, p_window_ms: 60000,
    });
    const rlRow = Array.isArray(rl) ? rl[0] : rl;
    if (rlRow && !rlRow.ok) {
      const retry = Math.max(1, Math.ceil((new Date(rlRow.reset_at).getTime() - Date.now()) / 1000));
      return json({ error: "Too many requests" }, 429, { "Retry-After": String(retry) });
    }

    const body = await req.json().catch(() => ({})) as {
      visit_spec_id?: string; date?: string; start_hour?: number;
    };
    const specId = body.visit_spec_id;
    const date   = body.date;
    // Default 09:00 if not provided — most cleans start morning
    let startHour = typeof body.start_hour === "number" ? body.start_hour : 9;

    if (!specId || !date) return json({ error: "visit_spec_id + date required" }, 400);
    if (!isValidDateStr(date)) return json({ error: "date must be YYYY-MM-DD" }, 400);
    if (startHour < 0 || startHour > 23.75) startHour = 9;

    // Reject past dates (allow today itself so a sub can log an unplanned drop-in)
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const requested = new Date(date + "T00:00:00Z");
    if (requested < today) {
      return json({ error: "Pick today or a future date." }, 400);
    }

    // Load visit_spec; must be assigned to the caller
    const { data: spec, error: specErr } = await sb
      .from("visit_specs")
      .select(`
        id, contract_id, site_id, fm_organisation_id, frequency, scope,
        duration_minutes, price_per_visit, assigned_sub_user_id, status, deleted_at
      `)
      .eq("id", specId)
      .maybeSingle();

    if (specErr) return json({ error: specErr.message }, 500);
    if (!spec)   return json({ error: "Visit spec not found" }, 404);
    if (spec.deleted_at) return json({ error: "Visit spec is closed" }, 410);
    if (spec.assigned_sub_user_id !== user.id) {
      return json({ error: "You're not assigned to this visit spec" }, 403);
    }
    if (!["assigned", "active"].includes(spec.status)) {
      return json({ error: `Visit spec is not schedulable (status: ${spec.status})` }, 409);
    }

    // Guard against duplicate scheduling for the same day
    const { data: dup } = await sb
      .from("jobs")
      .select("id")
      .eq("visit_spec_id", specId)
      .eq("sub_user_id", user.id)
      .eq("date", date)
      .is("deleted_at", null)
      .maybeSingle();
    if (dup) {
      return json({ error: "You've already scheduled a visit for that date.", existing_job_id: dup.id }, 409);
    }

    const durationHrs = spec.duration_minutes ? Math.max(0.25, spec.duration_minutes / 60) : 1;

    const { data: job, error: jobErr } = await sb.from("jobs").insert({
      visit_spec_id:      specId,
      sub_user_id:        user.id,
      site_id:            spec.site_id,
      fm_organisation_id: spec.fm_organisation_id,
      status:             "scheduled",
      approval_status:    "pending",
      date,
      start_hour:         startHour,
      duration_hrs:       durationHrs,
      price:              spec.price_per_visit,
      service:            spec.scope,
    }).select("id").single();

    if (jobErr) return json({ error: jobErr.message }, 500);

    // Bump visit_spec.status to 'active' on first schedule so the FM sees
    // it's live (was 'assigned' before the sub picked a date).
    if (spec.status === "assigned") {
      await sb.from("visit_specs")
        .update({ status: "active", updated_at: new Date().toISOString() })
        .eq("id", specId);
    }

    await sb.from("audit_log").insert({
      actor_id: user.id,
      action:   "connect_visit_scheduled",
      category: "connect",
      detail:   {
        visit_spec_id: specId,
        job_id:        job.id,
        date,
        start_hour:    startHour,
        fm_organisation_id: spec.fm_organisation_id,
      },
      ip:       ip === "unknown" ? null : ip,
      user_agent: ua || null,
    }).then(() => {}).catch(() => {});

    return json({ ok: true, job_id: job.id });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
