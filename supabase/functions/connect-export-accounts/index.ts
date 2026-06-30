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

    const { data: invs, error: invErr } = await sb
      .from("connect_invoices")
      .select(`
        id, reference, service_date, net_value, vat_value, total_value, status, created_at,
        sub:profiles!connect_invoices_sub_user_id_fkey ( id, business_name, first_name, last_name ),
        job:jobs ( id ),
        site:jobs ( id, site:sites ( id, name, postcode ) )
      `)
      .eq("fm_organisation_id", fmId)
      .eq("status", "submitted")
      .gte("service_date", from)
      .lte("service_date", to)
      .order("service_date", { ascending: true });

    if (invErr) return json({ error: invErr.message }, 500);

    const rows = (invs ?? []).map((i: Record<string, unknown>) => {
      const sub = i.sub as { business_name?: string; first_name?: string; last_name?: string } | null;
      const siteRow = i.site as { site?: { name?: string; postcode?: string } } | null;
      return {
        reference:    i.reference ?? "",
        service_date: i.service_date ?? "",
        sub:          sub?.business_name || `${sub?.first_name ?? ""} ${sub?.last_name ?? ""}`.trim(),
        site:         siteRow?.site?.name ?? "",
        postcode:     siteRow?.site?.postcode ?? "",
        net_value:    Number(i.net_value).toFixed(2),
        vat_value:    Number(i.vat_value).toFixed(2),
        total_value:  Number(i.total_value).toFixed(2),
      };
    });
    const csv = toCsv(rows);
    const totalValue = rows.reduce((s: number, r) => s + Number(r.total_value), 0);

    if (op === "preview") {
      return json({ ok: true, row_count: rows.length, total_value: totalValue, csv });
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
        row_count:           rows.length,
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
      detail:   { fm_organisation_id: fmId, export_id: exp.id, row_count: rows.length, total_value: totalValue },
      ip:       ip === "unknown" ? null : ip,
      user_agent: ua || null,
    }).then(() => {}).catch(() => {});

    return json({
      ok: true,
      export_id:   exp.id,
      row_count:   rows.length,
      total_value: totalValue,
      file_format: fileFormat,
      csv,
    });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
