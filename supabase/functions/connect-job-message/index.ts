/**
 * supabase/functions/connect-job-message/index.ts
 *
 * Post a message to a job's back-and-forth thread (typically used while the
 * job is in approval_status='queried' so the sub and FM can resolve the
 * query without losing context). Server detects whether the caller is the
 * sub or an FM-org member, writes the row with the correct author_role,
 * and emails the other side.
 *
 * Audit-logged. Rate-limited 60/min/user.
 *
 * POST { job_id, body }
 *   → { ok, message_id, author_role }
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

function renderEmail(opts: {
  authorRole: "sub" | "fm";
  siteName:   string;
  body:       string;
  openUrl:    string;
}): { subject: string; html: string } {
  const fromLabel = opts.authorRole === "sub" ? "the contractor" : "the FM";
  const headline  = `New message from ${fromLabel} — ${opts.siteName}`;
  const safeHeadline = htmlEscape(headline);
  return {
    subject: headline,
    html: `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;background:#f8fafc;margin:0;padding:24px;">
      <div style="max-width:520px;margin:0 auto;background:white;border-radius:12px;padding:28px;border:1px solid #e2e8f0;">
        <h1 style="margin:0 0 8px;font-size:18px;color:#0f172a;">${safeHeadline}</h1>
        <p style="margin:16px 0;padding:14px;background:#f1f5f9;border-radius:8px;font-size:14px;color:#0f172a;line-height:1.5;white-space:pre-wrap;">${htmlEscape(opts.body)}</p>
        <p style="margin:20px 0 0;"><a href="${opts.openUrl}" style="display:inline-block;padding:10px 20px;background:#ea580c;color:white;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">Open Cadi →</a></p>
      </div>
    </body></html>`,
  };
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
      p_bucket: "connect_job_message", p_key: user.id, p_limit: 60, p_window_ms: 60000,
    });
    const rlRow = Array.isArray(rl) ? rl[0] : rl;
    if (rlRow && !rlRow.ok) {
      const retry = Math.max(1, Math.ceil((new Date(rlRow.reset_at).getTime() - Date.now()) / 1000));
      return json({ error: "Too many requests" }, 429, { "Retry-After": String(retry) });
    }

    const body = await req.json().catch(() => ({})) as { job_id?: string; body?: string };
    const jobId   = body.job_id;
    const message = (body.body ?? "").trim().slice(0, 4000);

    if (!jobId || !message) return json({ error: "job_id and body required" }, 400);

    const { data: job, error: jobErr } = await sb
      .from("jobs")
      .select(`id, sub_user_id, fm_organisation_id, site:sites ( name )`)
      .eq("id", jobId)
      .maybeSingle();
    if (jobErr) return json({ error: jobErr.message }, 500);
    if (!job)   return json({ error: "Job not found" }, 404);

    // Determine author role + recipient for the email notification
    let authorRole: "sub" | "fm" | null = null;
    let recipientUserId: string | null = null;

    if (job.sub_user_id === user.id) {
      authorRole = "sub";
      // Recipient: any FM-org member. We email the org's main contact —
      // for now grab the first profile in the FM org and use them.
      if (job.fm_organisation_id) {
        const { data: fmProfile } = await sb
          .from("profiles")
          .select("id")
          .eq("fm_organisation_id", job.fm_organisation_id)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        recipientUserId = fmProfile?.id ?? null;
      }
    } else {
      // Check FM membership
      const { data: caller } = await sb
        .from("profiles")
        .select("fm_organisation_id")
        .eq("id", user.id)
        .maybeSingle();
      if (caller?.fm_organisation_id && caller.fm_organisation_id === job.fm_organisation_id) {
        authorRole = "fm";
        recipientUserId = job.sub_user_id;
      }
    }

    if (!authorRole) {
      return json({ error: "You are not party to this job" }, 403);
    }

    const { data: msgRow, error: msgErr } = await sb
      .from("job_messages")
      .insert({
        job_id:      jobId,
        author_id:   user.id,
        author_role: authorRole,
        body:        message,
      })
      .select("id, created_at")
      .single();
    if (msgErr) return json({ error: msgErr.message }, 500);

    // Audit
    await sb.from("audit_log").insert({
      actor_id: user.id,
      action:   "connect_job_message",
      category: "connect",
      detail:   { job_id: jobId, author_role: authorRole, message_id: msgRow?.id },
      ip:       ip === "unknown" ? null : ip,
      user_agent: ua || null,
    }).then(() => {}).catch(() => {});

    // Notify other side (best-effort)
    if (recipientUserId) {
      const toEmail = await getUserEmail(sb, recipientUserId);
      if (toEmail) {
        // Sub opens /connect/completion; FM opens FM-Ops Approval. Both
        // land on a screen where the thread is visible.
        const openUrl = authorRole === "sub"
          ? `${APP_ORIGIN}/fm-ops/approval`
          : `${APP_ORIGIN}/connect/completion`;
        // deno-lint-ignore no-explicit-any
        const siteName = (job as any).site?.name ?? "the job";
        const { subject, html } = renderEmail({
          authorRole, siteName, body: message, openUrl,
        });
        sendEmail(toEmail, subject, html).then(() => {}).catch(() => {});
      }
    }

    return json({
      ok: true,
      message_id:  msgRow?.id,
      author_role: authorRole,
    });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
