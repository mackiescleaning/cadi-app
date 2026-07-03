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
import { htmlEscape, htmlEscapeMultiline } from "../_shared/htmlEscape.ts";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "content-type, apikey, authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const RESEND_FROM    = Deno.env.get("RESEND_FROM")    ?? "Cadi <team@cadi.cleaning>";
const APP_ORIGIN     = Deno.env.get("APP_ORIGIN")     ?? "https://app.cadi.cleaning";

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!RESEND_API_KEY || !to) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: RESEND_FROM, to: [to], subject, html }),
    });
    return res.ok;
  } catch { return false; }
}

// deno-lint-ignore no-explicit-any
async function getUserEmail(sb: any, userId: string): Promise<string | null> {
  try {
    const { data, error } = await sb.auth.admin.getUserById(userId);
    if (error || !data?.user?.email) return null;
    return data.user.email as string;
  } catch { return null; }
}

function renderDecisionEmail(opts: {
  decision: "approved" | "queried" | "rejected";
  siteName: string;
  serviceDate: string;
  note: string | null;
  jobsUrl: string;
}): { subject: string; html: string } {
  const { decision, siteName, serviceDate, note, jobsUrl } = opts;
  const headline =
    decision === "approved" ? "Job approved" :
    decision === "queried"  ? "Job queried — they need a bit more info" :
                              "Job rejected — please redo";
  const lead =
    decision === "approved" ? "Your invoice draft is ready in Cadi Connect." :
    decision === "queried"  ? "The FM has flagged a query against your job. Open Cadi Connect to read and respond." :
                              "The FM has rejected this job and the site is back in your upcoming list to redo. Their reason is below.";
  const noteBlock = note
    ? `<p style="margin:16px 0;padding:12px 14px;background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;color:#7c2d12;font-size:14px;line-height:1.5;"><strong>Their note:</strong><br/>${htmlEscapeMultiline(note)}</p>`
    : "";
  return {
    subject: `${headline} — ${siteName}`,
    html: `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;background:#f8fafc;margin:0;padding:24px;">
      <div style="max-width:520px;margin:0 auto;background:white;border-radius:12px;padding:28px;border:1px solid #e2e8f0;">
        <h1 style="margin:0 0 8px;font-size:20px;color:#0f172a;">${htmlEscape(headline)}</h1>
        <p style="margin:0 0 4px;font-size:14px;color:#475569;"><strong>${htmlEscape(siteName)}</strong> · service date ${htmlEscape(serviceDate)}</p>
        <p style="margin:16px 0;font-size:14px;color:#334155;line-height:1.6;">${htmlEscape(lead)}</p>
        ${noteBlock}
        <p style="margin:24px 0 0;"><a href="${jobsUrl}" style="display:inline-block;padding:10px 20px;background:#ea580c;color:white;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">Open Cadi Connect →</a></p>
      </div>
    </body></html>`,
  };
}

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
      rating_stars?: number; rating_comment?: string;
    };
    const jobId = body.job_id;
    const decision = body.decision;
    const note = (body.note ?? "").slice(0, 2000) || null;

    // Optional rating on approve — the FM can 1-5 star + comment. Only
    // applies when decision === 'approved'. Silently ignored otherwise so
    // the client can pass the fields unconditionally.
    const ratingStarsRaw = body.rating_stars;
    const ratingStars = (typeof ratingStarsRaw === "number"
      && Number.isFinite(ratingStarsRaw)
      && ratingStarsRaw >= 1 && ratingStarsRaw <= 5)
      ? Math.round(ratingStarsRaw)
      : null;
    const ratingComment = typeof body.rating_comment === "string"
      ? body.rating_comment.trim().slice(0, 2000) || null
      : null;

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

    // Update job approval state. For rejection, also reset the job to
    // 'scheduled' and clear completion metadata so it appears back in the
    // sub's upcoming list — the contractor must redo the clean from scratch.
    const patch: Record<string, unknown> = {
      approval_status:     decision,
      approved_by_user_id: user.id,
      approved_at:         decision === "approved" ? now : null,
      query_note:          decision === "queried"  ? note : null,
      rejection_note:      decision === "rejected" ? note : null,
    };
    if (decision === "rejected") {
      patch.status                  = "scheduled";
      patch.completion_marked_at    = null;
      patch.completion_method       = null;
      patch.actual_duration_minutes = null;
    }

    const { error: updErr } = await sb
      .from("jobs")
      .update(patch)
      .eq("id", jobId)
      .eq("fm_organisation_id", caller.fm_organisation_id);
    if (updErr) return json({ error: updErr.message }, 500);

    // On rejection, wipe the working-table data so the contractor sees a
    // clean slate. The audit_log keeps the full history (what photos
    // existed, what notes were written) — nothing is truly lost.
    if (decision === "rejected") {
      await sb.from("job_checkins").delete().eq("job_id", jobId).then(() => {}).catch(() => {});
      await sb.from("job_evidence").delete().eq("job_id", jobId).then(() => {}).catch(() => {});
    }

    let invoiceId: string | null = null;

    if (decision === "approved" && job.sub_user_id) {
      // Auto-draft the sub's invoice. Net value comes from job.price OR
      // visit_spec.price_per_visit. VAT defaults to 0 — sub adjusts on submit.
      const netValue = Number(job.price ?? job.visit_spec?.price_per_visit ?? 0);
      const reference = `INV-${jobId.slice(0, 8).toUpperCase()}`;
      // deno-lint-ignore no-explicit-any
      const siteName = (job as any).site?.name ?? "Cleaning service";
      const lineDescription =
        `${siteName}${job.date ? " · " + job.date : ""}`;

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

      // Also write the line item so the (now multi-line capable) invoice
      // has its source job tracked. If invRow is null (conflict path), look
      // up the existing invoice id by job_id to attach a line.
      if (!invoiceId) {
        const { data: existing } = await sb
          .from("connect_invoices")
          .select("id")
          .eq("job_id", jobId)
          .maybeSingle();
        invoiceId = existing?.id ?? null;
      }
      if (invoiceId) {
        // Skip if a line for this job already exists on this invoice (cycle).
        const { data: existingLine } = await sb
          .from("connect_invoice_lines")
          .select("id")
          .eq("invoice_id", invoiceId)
          .eq("job_id", jobId)
          .maybeSingle();
        if (!existingLine) {
          await sb.from("connect_invoice_lines").insert({
            invoice_id:   invoiceId,
            job_id:       jobId,
            description:  lineDescription,
            service_date: job.date,
            net_value:    netValue,
            vat_value:    0,
          }).then(() => {}).catch(() => {});
        }
      }

      // Reputation event — input for the Connect score recompute (Phase 3.5)
      await sb.from("reputation_events").insert({
        cleaner_user_id: job.sub_user_id,
        event_type:      "job_approved",
        value:           1,
        source_fm_id:    job.fm_organisation_id,
        job_id:          jobId,
      }).then(() => {}).catch(() => {});

      // Optional star rating + comment — attaches to the same job so the
      // sub sees it on their profile AND the score engine picks it up.
      if (ratingStars != null) {
        await sb.from("job_ratings").upsert({
          job_id:             jobId,
          sub_user_id:        job.sub_user_id,
          fm_organisation_id: job.fm_organisation_id,
          rated_by_user_id:   user.id,
          stars:              ratingStars,
          comment:            ratingComment,
          updated_at:         now,
        }, { onConflict: "job_id" }).then(() => {}).catch(() => {});
        // Extra reputation event so the score engine can shift on rating
        // alone (e.g. 5-star lifts, 2-star drags) without re-running the
        // approved event.
        await sb.from("reputation_events").insert({
          cleaner_user_id: job.sub_user_id,
          event_type:      "job_rated",
          value:           ratingStars,
          source_fm_id:    job.fm_organisation_id,
          job_id:          jobId,
        }).then(() => {}).catch(() => {});
      }
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

    // Notify sub by email (best-effort — never blocks the response)
    if (job.sub_user_id) {
      const subEmail = await getUserEmail(sb, job.sub_user_id);
      if (subEmail) {
        const { subject, html } = renderDecisionEmail({
          decision:    decision as "approved" | "queried" | "rejected",
          siteName:    job.site?.name ?? "your site",
          serviceDate: job.date ?? "",
          note,
          jobsUrl:     `${APP_ORIGIN}/connect/completion`,
        });
        sendEmail(subEmail, subject, html).then(() => {}).catch(() => {});
      }
    }

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
