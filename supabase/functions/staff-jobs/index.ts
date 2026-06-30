/**
 * supabase/functions/staff-jobs/index.ts
 * Authenticated by short-lived staff JWT (Authorization: Bearer <token>).
 * The token is issued by staff-auth POST on PIN success.
 *
 * GET   → jobs assigned to this staff member, last 7 days + next 35 days
 * PATCH { job_id, status } → updates job status (scheduled/in-progress/complete)
 *
 * Schema notes (post migration 019):
 * - team_members is canonical (business_id = owner_id UUID).
 * - jobs.assignee_ids uuid[] is canonical staff link.
 * - jobs.assignees jsonb name array is kept as a display fallback and
 *   honoured here for any rows the backfill couldn't match by name.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireStaffAuth } from "../_shared/staffJwt.ts";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "content-type, apikey, authorization",
  "Access-Control-Allow-Methods": "GET, PATCH, OPTIONS",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

const ALLOWED_STATUSES = new Set(["scheduled", "in-progress", "complete"]);

type StaffRecord = { id: string; full_name: string };

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  // All non-OPTIONS routes require a valid staff JWT. claims.sub = member id,
  // claims.biz = owner_id. We re-verify the member is still active each call.
  let claims;
  try { claims = await requireStaffAuth(req); }
  catch { return json({ error: "Unauthorized" }, 401); }

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Look up the member from JWT claims — also catches deactivated staff
  // whose JWT hasn't expired yet (revocation by deactivation).
  async function loadStaff(memberId: string, ownerId: string): Promise<StaffRecord | null> {
    const { data } = await sb
      .from("team_members")
      .select("id, first_name, last_name")
      .eq("id", memberId)
      .eq("business_id", ownerId)
      .eq("is_active", true)
      .single();
    if (!data) return null;
    const full_name = [data.first_name, data.last_name].filter(Boolean).join(" ").trim();
    return { id: data.id, full_name };
  }

  function isAssigned(job: Record<string, unknown>, staff: StaffRecord): boolean {
    const ids = Array.isArray(job.assignee_ids) ? job.assignee_ids as string[] : [];
    if (ids.includes(staff.id)) return true;
    const names = Array.isArray(job.assignees) ? job.assignees as string[] : [];
    if (names.includes(staff.full_name)) return true;
    if (job.assignee === staff.full_name) return true;
    return false;
  }

  const staff = await loadStaff(claims.sub, claims.biz);
  if (!staff) return json({ error: "Unauthorized" }, 401);

  if (req.method === "GET") {
    const from = new Date(); from.setDate(from.getDate() - 7);
    const to   = new Date(); to.setDate(to.getDate() + 35);

    const { data: jobs, error } = await sb
      .from("jobs")
      .select("*")
      .eq("owner_id", claims.biz)
      .gte("date", from.toISOString().slice(0, 10))
      .lte("date", to.toISOString().slice(0, 10))
      .order("date")
      .order("start_hour");

    if (error) {
      console.error("staff-jobs GET error:", error);
      return json({ error: "Failed to load jobs" }, 500);
    }

    return json({ jobs: (jobs ?? []).filter(j => isAssigned(j, staff)) });
  }

  if (req.method === "PATCH") {
    let body: { job_id?: string; status?: string };
    try { body = await req.json(); }
    catch { return json({ error: "Invalid JSON" }, 400); }

    const { job_id, status } = body;
    if (!job_id || !status)                    return json({ error: "job_id and status required" }, 400);
    if (!ALLOWED_STATUSES.has(status))         return json({ error: "Invalid status" }, 400);

    const { data: job } = await sb
      .from("jobs")
      .select("id, assignee_ids, assignees, assignee")
      .eq("id", job_id)
      .eq("owner_id", claims.biz)
      .single();

    if (!job) return json({ error: "Job not found" }, 404);
    if (!isAssigned(job as Record<string, unknown>, staff)) {
      return json({ error: "Not assigned to this job" }, 403);
    }

    const { error: updateErr } = await sb
      .from("jobs")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", job_id);

    if (updateErr) {
      console.error("staff-jobs PATCH error:", updateErr);
      return json({ error: "Failed to update job" }, 500);
    }
    return json({ ok: true });
  }

  return json({ error: "Method not allowed" }, 405);
});
