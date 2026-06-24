/**
 * supabase/functions/connect-approve-job/index.ts
 *
 * FM-side. Reviews a sub's completed work and routes it on:
 *   • decision='approved' → flips job to approved, drafts a connect_invoices
 *     row for the sub, writes a positive reputation_event
 *   • decision='queried'  → flips job to queried with a note; sub resubmits
 *   • decision='rejected' → flips job to rejected with a note; FM portal can
 *     then re-dispatch via the schedule view
 *
 * Caller must belong to the FM organisation that owns the job.
 *
 * POST { job_id, decision, note? }
 *   → { ok, job_id, approval_status, invoice_id? }
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
  new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json", ...extra } });

function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for") ?? "";
  return xff.split(",")[0].trim() || (req.headers.get("x-real-ip") ?? "unknown");
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
      p_bucket: "connect_approve_job", p_key: user.id, p_limit: 60, p_window_ms: 60000,
    });
    const rlRow = Array.isArray(rl) ? rl[0] : rl;
    if (rlRow && !rlRow.ok) {
      const retry = Math.max(1, Math.ceil((new Date(rlRow.reset_at).getTime() - Date.now()) / 1000));
      return json({ error: "Too many requests" }, 429, { "Retry-After": String(retry) });
    }

    const body = await req.json().catch(() => ({})) as {
      job_id?: string; decision?: string; note?: string;
    };
    const jobId = body.job_id;
    const decision = body.decision;
    const note = (body.note ?? "").slice(0, 2000) || null;

    if (!jobId || !["approved","queried","rejected"].includes(decision || "")) {
      return json({ error: "job_id + decision (approved/queried/rejected) required" }, 400);
    }
    if ((decision === "queried" || decision === "rejected") && !note) {
      return json({ error: "A note is required when querying or rejecting." }, 400);
    }

    // Load job — must belong to caller's FM org
    const { data: job, error: jobErr } = await sb
      .from("jobs")
      .select(`
        id, status, approval_status, sub_user_id, fm_organisation_id,
        price, date,
        site:sites ( id, name ),
        visit_spec:visit_specs ( id, price_per_visit, scope, frequency )
      `)
      .eq("id", jobId)
      .eq("fm_organisation_id", caller.fm_organisation_id)
      .maybeSingle();

    if (jobErr) return json({ error: jobErr.message }, 500);
    if (!job)   return json({ error: "Job not found in your organisation" }, 404);
    if (job.status !== "complete") {
      return json({ error: "Only completed jobs can be approved/queried/rejected." }, 409);
    }

    const now = new Date().toISOString();

    // Update job approval state
    const patch: Record<string, unknown> = {
      approval_status:     decision,
      approved_by_user_id: user.id,
      approved_at:         decision === "approved" ? now : null,
      query_note:          decision === "queried"  ? note : null,
      rejection_note:      decision === "rejected" ? note : null,
    };

    const { error: updErr } = await sb
      .from("jobs")
      .update(patch)
      .eq("id", jobId)
      .eq("fm_organisation_id", caller.fm_organisation_id);
    if (updErr) return json({ error: updErr.message }, 500);

    let invoiceId: string | null = null;

    if (decision === "approved" && job.sub_user_id) {
      // Auto-draft the sub's invoice. Net value comes from job.price OR
      // visit_spec.price_per_visit. VAT defaults to 0 — sub adjusts on submit.
      const netValue = Number(job.price ?? job.visit_spec?.price_per_visit ?? 0);
      const reference = `INV-${jobId.slice(0, 8).toUpperCase()}`;

      const { data: invRow, error: invErr } = await sb
        .from("connect_invoices")
        .insert({
          job_id:             jobId,
          sub_user_id:        job.sub_user_id,
          fm_organisation_id: job.fm_organisation_id,
          reference,
          service_date:       job.date,
          net_value:          netValue,
          vat_value:          0,
          status:             "draft",
        })
        .select("id")
        .single();

      // Conflict on the per-job unique index is fine — invoice may already
      // exist from a previous approval cycle (queried → approved again).
      if (invErr && invErr.code !== "23505") {
        return json({ error: invErr.message }, 500);
      }
      invoiceId = invRow?.id ?? null;

      // Reputation event — input for the Connect score recompute (Phase 3.5)
      await sb.from("reputation_events").insert({
        cleaner_user_id: job.sub_user_id,
        event_type:      "job_approved",
        value:           1,
        source_fm_id:    job.fm_organisation_id,
        job_id:          jobId,
      }).then(() => {}).catch(() => {});
    } else if (decision === "rejected" && job.sub_user_id) {
      await sb.from("reputation_events").insert({
        cleaner_user_id: job.sub_user_id,
        event_type:      "job_rejected",
        value:           -1,
        source_fm_id:    job.fm_organisation_id,
        job_id:          jobId,
      }).then(() => {}).catch(() => {});
    }

    // Audit
    await sb.from("audit_log").insert({
      actor_id: user.id,
      action:   `connect_job_${decision}`,
      category: "connect",
      detail:   { job_id: jobId, fm_organisation_id: job.fm_organisation_id, sub_user_id: job.sub_user_id, invoice_id: invoiceId, note },
      ip:       ip === "unknown" ? null : ip,
      user_agent: ua || null,
    }).then(() => {}).catch(() => {});

    return json({
      ok: true,
      job_id:           jobId,
      approval_status:  decision,
      invoice_id:       invoiceId,
    });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
