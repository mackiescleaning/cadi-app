/**
 * supabase/functions/connect-export-accounts/index.ts
 *
 * FM-side. Three ops on one endpoint:
 *   POST { op: 'preview',   period_from, period_to } -> CSV body + counts
 *   POST { op: 'export',    period_from, period_to, file_format?, period_label? }
 *        -> writes accounts_exports row, flips invoices to 'exported', returns body
 *   POST { op: 'mark_paid', invoice_ids: [...] }
 *        -> flips invoices to 'paid', stamps payer/date, emails each sub
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "content-type, apikey, authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const RESEND_FROM    = Deno.env.get("RESEND_FROM")    ?? "Cadi <team@cadi.cleaning>";
const APP_ORIGIN     = Deno.env.get("APP_ORIGIN")     ?? "https://app.cadi.cleaning";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json" } });

function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for") ?? "";
  return xff.split(",")[0].trim() || (req.headers.get("x-real-ip") ?? "unknown");
}

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const out = [headers.join(",")];
  for (const r of rows) out.push(headers.map(h => csvEscape(r[h])).join(","));
  return out.join("\n");
}

// ── Per-accounting-platform export presets ──────────────────────────────────
// Each preset takes the canonical invoice shape (built below) and returns a
// row keyed by the EXACT column names the destination accounting system
// expects to see. Adding a new platform = one new entry here.

type FmSettings = {
  accounts_platform:           string;
  default_nominal_code:        string | null;
  default_vat_code:            string | null;
  default_payment_terms_days:  number | null;
};
type CanonicalInvoice = {
  supplier_code:  string;
  supplier_name:  string;
  reference:      string;
  service_date:   string;        // YYYY-MM-DD
  due_date:       string;        // YYYY-MM-DD
  description:    string;
  net_value:      number;
  vat_value:      number;
  total_value:    number;
  nominal_code:   string;
};

function fmtDDMMYYYY(d: string): string {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}
function fmtISO(d: string): string { return d ?? ""; }

// Sage T-code from VAT rate. Cleaning is typically T1 (20%) when sub is
// VAT registered, T9 (out of scope) when not. We infer from VAT > 0.
function sageVatCode(inv: CanonicalInvoice, fm: FmSettings): string {
  if (inv.vat_value > 0) {
    // Could be T1 (20%) or T5 (5%). 20% is the overwhelming default for cleaning.
    return "T1";
  }
  return fm.default_vat_code || "T9";
}

// Xero TaxType. "Output" + percentage suffix in API; CSV uses friendly labels.
function xeroTaxType(inv: CanonicalInvoice): string {
  if (inv.vat_value > 0) return "20% (VAT on Income)";
  return "No VAT";
}

const PRESETS: Record<string, {
  filename: (label: string) => string;
  build:    (rows: CanonicalInvoice[], fm: FmSettings) => Record<string, unknown>[];
}> = {
  // Sage 50 Purchase Invoice batch import (the "Easy Import" CSV format).
  sage_50: {
    filename: (label) => `sage50-purchase-invoices-${label}.csv`,
    build: (rows, fm) => rows.map(r => ({
      "A/C":     r.supplier_code,
      "Date":    fmtDDMMYYYY(r.service_date),
      "Ref":     r.reference,
      "N/C":     r.nominal_code,
      "Details": r.description,
      "Net":     r.net_value.toFixed(2),
      "T/C":     sageVatCode(r, fm),
      "Tax":     r.vat_value.toFixed(2),
    })),
  },

  // Sage Business Cloud Accounting CSV — broadly the same shape as Sage 50,
  // different header casing convention.
  sage_cloud: {
    filename: (label) => `sage-cloud-purchase-invoices-${label}.csv`,
    build: (rows, fm) => rows.map(r => ({
      "Supplier Reference": r.supplier_code,
      "Supplier Name":      r.supplier_name,
      "Date":               fmtDDMMYYYY(r.service_date),
      "Reference":          r.reference,
      "Description":        r.description,
      "Ledger Account":     r.nominal_code,
      "Net":                r.net_value.toFixed(2),
      "Tax Rate":           sageVatCode(r, fm),
      "Tax":                r.vat_value.toFixed(2),
      "Total":              r.total_value.toFixed(2),
    })),
  },

  // Xero — "Bills" CSV import. Xero uses ContactName-driven matching.
  xero: {
    filename: (label) => `xero-bills-${label}.csv`,
    build: (rows, _fm) => rows.map(r => ({
      "ContactName":   r.supplier_name,
      "InvoiceNumber": r.reference,
      "InvoiceDate":   fmtISO(r.service_date),
      "DueDate":       fmtISO(r.due_date),
      "Description":   r.description,
      "Quantity":      "1",
      "UnitAmount":    r.net_value.toFixed(2),
      "AccountCode":   r.nominal_code,
      "TaxType":       xeroTaxType(r),
    })),
  },

  // QuickBooks Online "Bills" import (Expenses → New → Bill → Import).
  quickbooks: {
    filename: (label) => `quickbooks-bills-${label}.csv`,
    build: (rows, _fm) => rows.map(r => ({
      "Bill No":      r.reference,
      "Supplier":     r.supplier_name,
      "Bill Date":    fmtISO(r.service_date),
      "Due Date":     fmtISO(r.due_date),
      "Terms":        "",
      "Memo":         r.description,
      "Account":      r.nominal_code,
      "Line Description": r.description,
      "Amount":       r.net_value.toFixed(2),
      "VAT":          r.vat_value > 0 ? "20% S" : "No VAT",
    })),
  },

  // FreeAgent — bills CSV.
  freeagent: {
    filename: (label) => `freeagent-bills-${label}.csv`,
    build: (rows, _fm) => rows.map(r => ({
      "Dated on":      fmtISO(r.service_date),
      "Due on":        fmtISO(r.due_date),
      "Reference":     r.reference,
      "Supplier":      r.supplier_name,
      "Description":   r.description,
      "Category":      r.nominal_code,
      "Amount":        r.net_value.toFixed(2),
      "VAT rate":      r.vat_value > 0 ? "20%" : "Out of Scope",
    })),
  },

  // Generic — all fields, no platform-specific headers. Use when an FM is on
  // a system we haven't built a preset for yet; they map columns manually.
  generic: {
    filename: (label) => `connect-invoices-${label}.csv`,
    build: (rows, _fm) => rows.map(r => ({
      "Supplier Code":   r.supplier_code,
      "Supplier Name":   r.supplier_name,
      "Invoice Ref":     r.reference,
      "Service Date":    fmtISO(r.service_date),
      "Due Date":        fmtISO(r.due_date),
      "Description":     r.description,
      "Nominal Code":    r.nominal_code,
      "Net":             r.net_value.toFixed(2),
      "VAT":             r.vat_value.toFixed(2),
      "Total":           r.total_value.toFixed(2),
    })),
  },
};

// Lazy-create or fetch a supplier code for (fm_org, sub) pair. Sequence is
// per-FM-org. Format: first 3 letters of business name (uppercased, alpha only)
// + 3-digit sequence. Conflicts retry with the next sequence number.
// deno-lint-ignore no-explicit-any
async function ensureSupplierCode(sb: any, fmOrgId: string, subUserId: string, subName: string): Promise<{ code: string; nominal_override: string | null }> {
  // Existing row?
  const { data: existing } = await sb
    .from("fm_supplier_codes")
    .select("supplier_code, nominal_code_override")
    .eq("fm_organisation_id", fmOrgId)
    .eq("sub_user_id", subUserId)
    .maybeSingle();
  if (existing) return { code: existing.supplier_code, nominal_override: existing.nominal_code_override };

  // Build a 3-letter stem from business name. Fall back to "SUB" if empty.
  const stem = (subName || "SUB")
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 3)
    .padEnd(3, "X");

  // Find the highest existing sequence for this stem so we don't recycle codes.
  const { data: takenRows } = await sb
    .from("fm_supplier_codes")
    .select("supplier_code")
    .eq("fm_organisation_id", fmOrgId)
    .like("supplier_code", `${stem}%`);
  const takenSeqs = new Set<number>(
    (takenRows ?? []).map((r: { supplier_code: string }) => {
      const m = /(\d+)$/.exec(r.supplier_code);
      return m ? parseInt(m[1], 10) : -1;
    }).filter((n: number) => n >= 0),
  );
  let seq = 1;
  while (takenSeqs.has(seq)) seq++;
  const candidate = `${stem}${String(seq).padStart(3, "0")}`;

  const { data: inserted, error } = await sb
    .from("fm_supplier_codes")
    .insert({
      fm_organisation_id: fmOrgId,
      sub_user_id:        subUserId,
      supplier_code:      candidate,
    })
    .select("supplier_code, nominal_code_override")
    .single();
  if (error) {
    // Most likely race condition on unique constraint — re-fetch.
    const { data: r2 } = await sb
      .from("fm_supplier_codes")
      .select("supplier_code, nominal_code_override")
      .eq("fm_organisation_id", fmOrgId)
      .eq("sub_user_id", subUserId)
      .maybeSingle();
    return { code: r2?.supplier_code || candidate, nominal_override: r2?.nominal_code_override ?? null };
  }
  return { code: inserted.supplier_code, nominal_override: inserted.nominal_code_override };
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

function renderPaidEmail(opts: {
  reference: string;
  fmName: string;
  totalValue: number;
  earningsUrl: string;
}): { subject: string; html: string } {
  const { reference, fmName, totalValue, earningsUrl } = opts;
  const amount = `£${totalValue.toFixed(2)}`;
  return {
    subject: `${fmName} marked ${reference} paid — ${amount}`,
    html: `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;background:#f8fafc;margin:0;padding:24px;">
      <div style="max-width:520px;margin:0 auto;background:white;border-radius:12px;padding:28px;border:1px solid #e2e8f0;">
        <h1 style="margin:0 0 8px;font-size:20px;color:#0f172a;">Invoice paid</h1>
        <p style="margin:0 0 4px;font-size:14px;color:#475569;"><strong>${reference}</strong> · ${fmName}</p>
        <p style="margin:16px 0;font-size:16px;color:#0f172a;line-height:1.5;"><strong>${amount}</strong> has been marked paid by ${fmName}. Funds should land in your account on their usual payment cycle.</p>
        <p style="margin:24px 0 0;"><a href="${earningsUrl}" style="display:inline-block;padding:10px 20px;background:#ea580c;color:white;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">View earnings →</a></p>
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

    const { data: caller } = await sb
      .from("profiles")
      .select("id, fm_organisation_id")
      .eq("id", user.id)
      .single();
    if (!caller?.fm_organisation_id) return json({ error: "Not an FM-organisation member" }, 403);
    const fmId = caller.fm_organisation_id;

    // Rate limit — generous for legitimate FM use (previews + exports +
    // mark-paid), tight enough to stop a runaway script scraping the
    // invoice queue in tight loops.
    const { data: rl } = await sb.rpc("check_and_increment_rate_limit", {
      p_bucket: "connect_export_accounts", p_key: user.id, p_limit: 60, p_window_ms: 60000,
    });
    const rlRow = Array.isArray(rl) ? rl[0] : rl;
    if (rlRow && !rlRow.ok) {
      const retry = Math.max(1, Math.ceil((new Date(rlRow.reset_at).getTime() - Date.now()) / 1000));
      return new Response(
        JSON.stringify({ error: "Too many requests" }),
        { status: 429, headers: { ...CORS, "Content-Type": "application/json", "Retry-After": String(retry) } },
      );
    }

    const body = await req.json().catch(() => ({}));
    const op = body.op;

    if (op === "mark_paid") {
      const ids = Array.isArray(body.invoice_ids) ? body.invoice_ids : [];
      if (ids.length === 0) return json({ error: "invoice_ids required" }, 400);
      const now = new Date().toISOString();
      const { data, error } = await sb
        .from("connect_invoices")
        .update({ status: "paid", paid_at: now, paid_marked_by_user_id: user.id })
        .in("id", ids)
        .eq("fm_organisation_id", fmId)
        .in("status", ["submitted", "exported"])
        .select("id, reference, total_value, sub_user_id");
      if (error) return json({ error: error.message }, 500);

      await sb.from("audit_log").insert({
        actor_id: user.id,
        action:   "connect_invoices_marked_paid",
        category: "connect",
        detail:   { fm_organisation_id: fmId, invoice_ids: data?.map(r => r.id), count: data?.length ?? 0 },
        ip:       ip === "unknown" ? null : ip,
        user_agent: ua || null,
      }).then(() => {}).catch(() => {});

      // Notify each sub by email (best-effort). One FM org name lookup, then
      // a getUserById per distinct sub. Fire-and-forget — never blocks the
      // response. Resend handles its own queueing if many subs are paid at once.
      if (data && data.length > 0) {
        (async () => {
          const { data: fmOrg } = await sb
            .from("fm_organisations")
            .select("name")
            .eq("id", fmId)
            .maybeSingle();
          const fmName = fmOrg?.name ?? "Your FM";
          const earningsUrl = `${APP_ORIGIN}/connect/earnings`;
          for (const inv of data) {
            if (!inv.sub_user_id) continue;
            const email = await getUserEmail(sb, inv.sub_user_id);
            if (!email) continue;
            const { subject, html } = renderPaidEmail({
              reference:   inv.reference ?? "your invoice",
              fmName,
              totalValue:  Number(inv.total_value) || 0,
              earningsUrl,
            });
            await sendEmail(email, subject, html);
          }
        })().catch(() => {});
      }

      return json({ ok: true, marked_paid: data?.length ?? 0 });
    }

    if (op !== "preview" && op !== "export") {
      return json({ error: "op must be preview | export | mark_paid" }, 400);
    }

    const from = body.period_from;
    const to   = body.period_to;
    if (!from || !to) return json({ error: "period_from + period_to required (YYYY-MM-DD)" }, 400);

    // FM accounts settings drive which preset we render. Lives in the
    // dedicated fm_accounts_settings table (migration 067). Default to
    // 'generic' when no row exists so a brand-new FM still gets a usable file.
    const { data: fmRow } = await sb
      .from("fm_accounts_settings")
      .select("accounts_platform, default_nominal_code, default_vat_code, default_payment_terms_days")
      .eq("fm_organisation_id", fmId)
      .maybeSingle();
    const fmSettings: FmSettings = {
      accounts_platform:           fmRow?.accounts_platform ?? "generic",
      default_nominal_code:        fmRow?.default_nominal_code ?? null,
      default_vat_code:            fmRow?.default_vat_code ?? null,
      default_payment_terms_days:  fmRow?.default_payment_terms_days ?? 30,
    };
    const preset = PRESETS[fmSettings.accounts_platform] ?? PRESETS.generic;

    const { data: invs, error: invErr } = await sb
      .from("connect_invoices")
      .select(`
        id, reference, service_date, net_value, vat_value, total_value, status, created_at, sub_user_id,
        sub:profiles!connect_invoices_sub_user_id_fkey ( id, business_name, first_name, last_name ),
        lines:connect_invoice_lines ( id, description, service_date, net_value )
      `)
      .eq("fm_organisation_id", fmId)
      .eq("status", "submitted")
      .gte("service_date", from)
      .lte("service_date", to)
      .order("service_date", { ascending: true });

    if (invErr) return json({ error: invErr.message }, 500);

    // Build canonical invoice rows. Each invoice is one CSV row (the
    // accounting platform's bill-level import); line-level detail goes into
    // the description so it's still searchable. Supplier code lazy-created
    // per (fm, sub) pair.
    const canonical: CanonicalInvoice[] = [];
    for (const i of (invs ?? []) as Array<Record<string, unknown>>) {
      const sub = i.sub as { business_name?: string; first_name?: string; last_name?: string } | null;
      const supplierName = sub?.business_name || `${sub?.first_name ?? ""} ${sub?.last_name ?? ""}`.trim() || "Unknown supplier";
      const { code: supplierCode, nominal_override } = await ensureSupplierCode(
        sb, fmId, i.sub_user_id as string, supplierName,
      );

      // Build a per-invoice description from the lines (cap at ~200 chars so
      // the CSV stays sane for FMs reading the import preview).
      const lines = (i.lines as Array<{ description: string; service_date?: string }>) ?? [];
      const description = lines.length === 0
        ? "Cleaning service"
        : lines.map(l => l.description).join("; ").slice(0, 200);

      const serviceDate = (i.service_date as string) ?? "";
      const dueDate = serviceDate
        ? (() => {
            const d = new Date(serviceDate);
            d.setUTCDate(d.getUTCDate() + (fmSettings.default_payment_terms_days ?? 30));
            return d.toISOString().slice(0, 10);
          })()
        : "";

      canonical.push({
        supplier_code:  supplierCode,
        supplier_name:  supplierName,
        reference:      (i.reference as string) ?? "",
        service_date:   serviceDate,
        due_date:       dueDate,
        description,
        net_value:      Number(i.net_value) || 0,
        vat_value:      Number(i.vat_value) || 0,
        total_value:    Number(i.total_value) || 0,
        nominal_code:   nominal_override || fmSettings.default_nominal_code || "",
      });
    }

    const rows = preset.build(canonical, fmSettings);
    const csv = toCsv(rows);
    const totalValue = canonical.reduce((s, r) => s + r.total_value, 0);

    if (op === "preview") {
      return json({
        ok:           true,
        platform:     fmSettings.accounts_platform,
        row_count:    canonical.length,
        total_value:  totalValue,
        csv,
      });
    }

    // op === 'export'
    const fileFormat = body.file_format === "excel" ? "excel" : "csv";
    const { data: exp, error: expErr } = await sb
      .from("accounts_exports")
      .insert({
        fm_organisation_id:  fmId,
        exported_by_user_id: user.id,
        period_label:        body.period_label ?? null,
        period_from:         from,
        period_to:           to,
        row_count:           canonical.length,
        total_value:         totalValue,
        file_format:         fileFormat,
      })
      .select("id")
      .single();
    if (expErr) return json({ error: expErr.message }, 500);

    const invoiceIds = (invs ?? []).map((i: { id: string }) => i.id);
    if (invoiceIds.length > 0) {
      const { error: updErr } = await sb
        .from("connect_invoices")
        .update({
          status:                "exported",
          exported_at:           new Date().toISOString(),
          exported_in_export_id: exp.id,
        })
        .in("id", invoiceIds)
        .eq("fm_organisation_id", fmId);
      if (updErr) return json({ error: updErr.message }, 500);
    }

    await sb.from("audit_log").insert({
      actor_id: user.id,
      action:   "connect_accounts_exported",
      category: "connect",
      detail:   { fm_organisation_id: fmId, export_id: exp.id, row_count: canonical.length, total_value: totalValue, platform: fmSettings.accounts_platform },
      ip:       ip === "unknown" ? null : ip,
      user_agent: ua || null,
    }).then(() => {}).catch(() => {});

    const periodLabel = (body.period_label ?? `${from}_to_${to}`).replace(/[^a-z0-9_-]/gi, "_");
    return json({
      ok:          true,
      export_id:   exp.id,
      platform:    fmSettings.accounts_platform,
      filename:    preset.filename(periodLabel),
      row_count:   canonical.length,
      total_value: totalValue,
      file_format: fileFormat,
      csv,
    });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
