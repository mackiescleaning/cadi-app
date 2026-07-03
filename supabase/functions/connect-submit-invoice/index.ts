/**
 * supabase/functions/connect-submit-invoice/index.ts
 *
 * Sub submits a draft Connect invoice for FM review. Flips the invoice from
 * 'draft' to 'submitted', updates net/vat/total/note if the sub adjusted
 * them on the way out, stamps submitted_at, and emails the FM.
 *
 * Email routing: fm_accounts_settings.accounts_email first (FM's chosen
 * inbox for accounts), falling back to the primary FM-admin user's email
 * so the FM never misses a submission.
 *
 * Audit-logged. Rate-limited 30/min/user.
 *
 * POST { invoice_id, net_value?, vat_value?, note? }
 *   → { ok, invoice_id, status }
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
  subName:      string;
  fmName:       string;
  reference:    string;
  net:          number;
  vat:          number;
  total:        number;
  lineCount:    number;
  note:         string | null;
  accountsUrl:  string;
}): { subject: string; html: string } {
  const money = (n: number) => `£${Number(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const safeSubName = htmlEscape(opts.subName);
  const safeFmName  = htmlEscape(opts.fmName);
  const safeRef     = htmlEscape(opts.reference);
  const noteBlock = opts.note
    ? `<p style="margin:14px 0;padding:12px 14px;background:#f1f5f9;border-radius:8px;color:#0f172a;font-size:13px;line-height:1.5;"><strong>Sub's note:</strong><br/>${htmlEscapeMultiline(opts.note)}</p>`
    : "";
  return {
    subject: `${opts.subName} submitted an invoice — ${money(opts.total)}`,
    html: `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;background:#f8fafc;margin:0;padding:24px;">
      <div style="max-width:560px;margin:0 auto;background:white;border-radius:12px;padding:28px;border:1px solid #e2e8f0;">
        <h1 style="margin:0 0 8px;font-size:20px;color:#0f172a;">Invoice submitted</h1>
        <p style="margin:0 0 16px;font-size:14px;color:#475569;">
          <strong>${safeSubName}</strong> submitted invoice <strong>${safeRef}</strong> for your review.
        </p>
        <table style="width:100%;border-collapse:collapse;font-size:13px;color:#0f172a;margin:0 0 8px;">
          <tr><td style="padding:5px 0;color:#64748b;">Lines</td><td style="padding:5px 0;text-align:right;">${opts.lineCount} site${opts.lineCount === 1 ? '' : 's'}</td></tr>
          <tr><td style="padding:5px 0;color:#64748b;">Net</td><td style="padding:5px 0;text-align:right;">${money(opts.net)}</td></tr>
          <tr><td style="padding:5px 0;color:#64748b;">VAT</td><td style="padding:5px 0;text-align:right;">${money(opts.vat)}</td></tr>
          <tr style="border-top:1px solid #e2e8f0;"><td style="padding:8px 0 0;font-weight:800;">Total</td><td style="padding:8px 0 0;text-align:right;font-weight:800;">${money(opts.total)}</td></tr>
        </table>
        ${noteBlock}
        <p style="margin:20px 0 0;"><a href="${opts.accountsUrl}" style="display:inline-block;padding:10px 20px;background:#ea580c;color:white;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">Review in Accounts →</a></p>
        <p style="margin:16px 0 0;font-size:11px;color:#94a3b8;">Cadi Connect — you're seeing this because a contractor working with ${safeFmName} submitted their invoice.</p>
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

    // Rate limit
    const { data: rl } = await sb.rpc("check_and_increment_rate_limit", {
      p_bucket: "connect_submit_invoice", p_key: user.id, p_limit: 30, p_window_ms: 60000,
    });
    const rlRow = Array.isArray(rl) ? rl[0] : rl;
    if (rlRow && !rlRow.ok) {
      const retry = Math.max(1, Math.ceil((new Date(rlRow.reset_at).getTime() - Date.now()) / 1000));
      return json({ error: "Too many requests" }, 429, { "Retry-After": String(retry) });
    }

    const body = await req.json().catch(() => ({})) as {
      invoice_id?: string; net_value?: number; vat_value?: number; note?: string;
    };
    const invoiceId = body.invoice_id;
    if (!invoiceId) return json({ error: "invoice_id required" }, 400);

    // Load + verify ownership + state
    const { data: inv, error: invErr } = await sb
      .from("connect_invoices")
      .select(`
        id, reference, status, sub_user_id, fm_organisation_id, net_value, vat_value, note,
        sub:profiles!connect_invoices_sub_user_id_fkey ( id, business_name, first_name, last_name ),
        fm_organisation:fm_organisations ( id, name )
      `)
      .eq("id", invoiceId)
      .maybeSingle();
    if (invErr) return json({ error: invErr.message }, 500);
    if (!inv)   return json({ error: "Invoice not found" }, 404);
    if (inv.sub_user_id !== user.id) return json({ error: "This is not your invoice" }, 403);
    if (inv.status !== "draft") return json({ error: `Invoice is already ${inv.status}` }, 409);

    // Optional field overrides — the client's detail drawer lets the sub
    // tweak net/vat/note before submitting.
    const newNet = typeof body.net_value === "number" ? Number(body.net_value) : Number(inv.net_value ?? 0);
    const newVat = typeof body.vat_value === "number" ? Number(body.vat_value) : Number(inv.vat_value ?? 0);
    const newTotal = newNet + newVat;
    const newNote = typeof body.note === "string"
      ? body.note.slice(0, 2000)
      : (inv.note ?? null);

    if (!Number.isFinite(newNet) || !Number.isFinite(newVat) || newNet < 0 || newVat < 0) {
      return json({ error: "net_value and vat_value must be non-negative numbers" }, 400);
    }

    // Get line count for the email + audit context
    const { count: lineCount } = await sb
      .from("connect_invoice_lines")
      .select("id", { count: "exact", head: true })
      .eq("invoice_id", invoiceId);

    const submittedAt = new Date().toISOString();
    const { error: updErr } = await sb
      .from("connect_invoices")
      .update({
        status:       "submitted",
        submitted_at: submittedAt,
        net_value:    newNet,
        vat_value:    newVat,
        total_value:  newTotal,
        note:         newNote,
        updated_at:   submittedAt,
      })
      .eq("id", invoiceId)
      .eq("sub_user_id", user.id);
    if (updErr) return json({ error: updErr.message }, 500);

    // Audit
    await sb.from("audit_log").insert({
      actor_id: user.id,
      action:   "connect_invoice_submitted",
      category: "connect",
      detail:   {
        invoice_id:         invoiceId,
        fm_organisation_id: inv.fm_organisation_id,
        total_value:        newTotal,
        line_count:         lineCount ?? 0,
      },
      ip:       ip === "unknown" ? null : ip,
      user_agent: ua || null,
    }).then(() => {}).catch(() => {});

    // Email routing — accounts_email preferred, then the earliest-created
    // FM admin's user email so nothing falls through the cracks.
    let toEmail: string | null = null;
    const { data: fmSettings } = await sb
      .from("fm_accounts_settings")
      .select("accounts_email")
      .eq("fm_organisation_id", inv.fm_organisation_id)
      .maybeSingle();
    if (fmSettings?.accounts_email) toEmail = fmSettings.accounts_email;

    if (!toEmail) {
      const { data: fmProfile } = await sb
        .from("profiles")
        .select("id")
        .eq("fm_organisation_id", inv.fm_organisation_id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (fmProfile?.id) toEmail = await getUserEmail(sb, fmProfile.id);
    }

    if (toEmail) {
      // deno-lint-ignore no-explicit-any
      const subRow = (inv as any).sub as { business_name?: string; first_name?: string; last_name?: string } | null;
      const subName =
        subRow?.business_name ||
        [subRow?.first_name, subRow?.last_name].filter(Boolean).join(" ") ||
        "A Cadi Connect contractor";
      // deno-lint-ignore no-explicit-any
      const fmName = ((inv as any).fm_organisation?.name as string) ?? "your organisation";
      const { subject, html } = renderEmail({
        subName,
        fmName,
        reference:  inv.reference ?? invoiceId.slice(0, 8),
        net:        newNet,
        vat:        newVat,
        total:      newTotal,
        lineCount:  lineCount ?? 0,
        note:       newNote,
        accountsUrl: `${APP_ORIGIN}/fm-ops/accounts`,
      });
      sendEmail(toEmail, subject, html).then(() => {}).catch(() => {});
    }

    return json({ ok: true, invoice_id: invoiceId, status: "submitted", email_sent_to: toEmail });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
