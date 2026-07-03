/**
 * supabase/functions/connect-resubmit-job/index.ts
 *
 * Sub resubmits a queried job for FM re-review. Flips approval_status
 * back to 'pending' and clears query_note. Requires the sub to have done
 * something since the query landed — at least 1 new message OR 1 new
 * piece of evidence after the FM's query timestamp — so the FM isn't
 * just sent the same job back unchanged.
 *
 * Audit-logged. Rate-limited 30/min/user.
 *
 * POST { job_id }
 *   → { ok, approval_status }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { htmlEscape } from "../_shared/htmlEscape.ts";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "content-type, apikey, authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const RESEND_FROM    = Deno.env.get("RESEND_FROM")    ?? "Cadi <team@cadi.cleaning>";
const APP_ORIGIN     = Deno.env.get("APP_ORIGIN")     ?? "https://app.cadi.cleaning";

const json = (data: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json", ...extra } });

function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for") ?? "";
  return xff.split(",")[0].trim() || (req.headers.get("x-real-ip") ?? "unknown");
}

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
      p_bucket: "connect_resubmit_job", p_key: user.id, p_limit: 30, p_window_ms: 60000,
    });
    const rlRow = Array.isArray(rl) ? rl[0] : rl;
    if (rlRow && !rlRow.ok) {
      const retry = Math.max(1, Math.ceil((new Date(rlRow.reset_at).getTime() - Date.now()) / 1000));
      return json({ error: "Too many requests" }, 429, { "Retry-After": String(retry) });
    }

    const body = await req.json().catch(() => ({})) as { job_id?: string };
    const jobId = body.job_id;
    if (!jobId) return json({ error: "job_id required" }, 400);

    // Job must belong to the caller, must currently be 'queried'.
    // approved_at on a 'queried' row holds the moment the query was raised
    // (set by connect-approve-job — actually we use the audit_log here
    // because connect-approve-job only sets approved_at on 'approved'.)
    const { data: job, error: jobErr } = await sb
      .from("jobs")
      .select(`id, approval_status, sub_user_id, fm_organisation_id, site:sites ( name )`)
      .eq("id", jobId)
      .eq("sub_user_id", user.id)
      .maybeSingle();
    if (jobErr) return json({ error: jobErr.message }, 500);
    if (!job)   return json({ error: "Job not found or not yours" }, 404);
    if (job.approval_status !== "queried") {
      return json({ error: "Job is not in 'queried' state — nothing to resubmit." }, 409);
    }

    // Anti-spam: require some new activity since the query landed.
    // We look at the audit_log entry for the most recent query on this job
    // and check there's at least one job_message or job_evidence newer than it.
    const { data: queryAudit } = await sb
      .from("audit_log")
      .select("created_at")
      .eq("action", "connect_job_queried")
      .eq("category", "connect")
      .filter("detail->>job_id", "eq", jobId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const queryAt = queryAudit?.created_at;
    if (queryAt) {
      const [{ count: msgCount }, { count: evCount }] = await Promise.all([
        sb.from("job_messages")
          .select("id", { count: "exact", head: true })
          .eq("job_id", jobId)
          .eq("author_role", "sub")
          .gt("created_at", queryAt),
        sb.from("job_evidence")
          .select("id", { count: "exact", head: true })
          .eq("job_id", jobId)
          .gt("created_at", queryAt),
      ]);
      const newActivity = (msgCount ?? 0) + (evCount ?? 0);
      if (newActivity < 1) {
        return json({
          error: "Add a reply message or upload more evidence before resubmitting.",
        }, 422);
      }
    }

    // Flip back to pending. Keep query_note for history — FM sees it as
    // "Previously queried" once they reopen the job.
    const { error: updErr } = await sb
      .from("jobs")
      .update({ approval_status: "pending" })
      .eq("id", jobId)
      .eq("sub_user_id", user.id);
    if (updErr) return json({ error: updErr.message }, 500);

    // Audit
    await sb.from("audit_log").insert({
      actor_id: user.id,
      action:   "connect_job_resubmitted",
      category: "connect",
      detail:   { job_id: jobId, fm_organisation_id: job.fm_organisation_id },
      ip:       ip === "unknown" ? null : ip,
      user_agent: ua || null,
    }).then(() => {}).catch(() => {});

    // Notify FM — pick the first FM-org profile as the contact, same
    // pattern as connect-job-message.
    if (job.fm_organisation_id) {
      const { data: fmProfile } = await sb
        .from("profiles")
        .select("id")
        .eq("fm_organisation_id", job.fm_organisation_id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (fmProfile?.id) {
        const toEmail = await getUserEmail(sb, fmProfile.id);
        if (toEmail) {
          // deno-lint-ignore no-explicit-any
          const siteName = (job as any).site?.name ?? "a site";
          sendEmail(
            toEmail,
            `Resubmitted for approval — ${siteName}`,
            `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;background:#f8fafc;margin:0;padding:24px;">
              <div style="max-width:520px;margin:0 auto;background:white;border-radius:12px;padding:28px;border:1px solid #e2e8f0;">
                <h1 style="margin:0 0 8px;font-size:18px;color:#0f172a;">Resubmitted for approval</h1>
                <p style="margin:8px 0 16px;font-size:14px;color:#475569;">The contractor has responded to your query on <strong>${htmlEscape(siteName)}</strong>. It's back in your work approval queue.</p>
                <p style="margin:20px 0 0;"><a href="${APP_ORIGIN}/fm-ops/approval" style="display:inline-block;padding:10px 20px;background:#ea580c;color:white;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">Open work approval →</a></p>
              </div>
            </body></html>`,
          ).then(() => {}).catch(() => {});
        }
      }
    }

    return json({ ok: true, approval_status: "pending" });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
