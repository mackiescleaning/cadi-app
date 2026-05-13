/**
 * supabase/functions/send-invoice/index.ts
 * Cadi — sends a fully-rendered HTML invoice email via Resend.
 *
 * Reads from invoice_templates for per-business branding: brand_colour,
 * logo_position, payment_terms_note, bank_details, footer_message,
 * invoice_number_format, and increments next_invoice_number on send.
 *
 * Environment variables:
 *   RESEND_API_KEY             — re_...
 *   RESEND_FROM                — e.g. "Cadi <invoices@cadi.cleaning>"
 *   APP_ORIGIN                 — e.g. https://cadi.cleaning
 *   SUPABASE_URL               — auto-injected
 *   SUPABASE_SERVICE_ROLE_KEY  — auto-injected
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const RESEND_FROM    = Deno.env.get("RESEND_FROM") ?? "Cadi <invoices@cadi.cleaning>";

const CORS = {
  "Access-Control-Allow-Origin":  Deno.env.get("APP_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

function fmt2(n: number) {
  return `£${n.toFixed(2)}`;
}

function fmtDate(s: string) {
  if (!s) return "";
  return new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function renderInvoiceNumber(format: string, seq: number): string {
  const year  = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, "0");
  return format
    .replace("{seq}",   String(seq).padStart(3, "0"))
    .replace("{year}",  String(year))
    .replace("{month}", month);
}

interface InvoiceTemplate {
  id: string;
  brand_colour: string;
  logo_position: "top_left" | "top_centre" | "top_right";
  payment_terms_note: string | null;
  bank_details: string | null;
  footer_message: string | null;
  invoice_number_format: string;
  next_invoice_number: number;
}

function buildHtml({
  personalMessage,
  invoiceNum,
  customer,
  lines,
  subtotal,
  vatAmount,
  total,
  terms,
  dueDate,
  businessName,
  businessAddress,
  businessEmail,
  tmpl,
}: {
  personalMessage: string;
  invoiceNum: string;
  customer: { name: string; address?: string; email?: string };
  lines: { desc: string; qty: number; rate: number; serviceDate?: string }[];
  subtotal: number;
  vatAmount: number;
  total: number;
  terms: string;
  dueDate: string;
  businessName: string;
  businessAddress?: string;
  businessEmail?: string;
  tmpl: Partial<InvoiceTemplate> | null;
}) {
  const brandColour = tmpl?.brand_colour || "#010a4f";
  const bankBlock   = tmpl?.bank_details
    ? `
    <div style="margin-top:24px;padding:16px;background:#f8f9ff;border-radius:8px;border:1px solid #e8ecff">
      <p style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#888;margin:0 0 8px">Bank details</p>
      <pre style="font-size:13px;color:#1a1a2e;margin:0;font-family:inherit;white-space:pre-wrap">${tmpl.bank_details.replace(/</g, "&lt;")}</pre>
      <p style="font-size:13px;color:#1a1a2e;margin:6px 0 0">Reference: <strong>${invoiceNum}</strong></p>
    </div>`
    : "";

  const footerMsg = tmpl?.footer_message
    ? `<p style="font-size:12px;color:#888;margin:3px 0">${tmpl.footer_message.replace(/</g, "&lt;")}</p>`
    : "";

  const effectiveTerms = tmpl?.payment_terms_note || terms || "Net 14";

  const lineRows = lines
    .filter(l => l.desc && l.rate)
    .map(l => {
      const amount = (l.qty || 1) * l.rate;
      return `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #f0f0f5;vertical-align:top">
          <div style="font-size:14px;color:#1a1a2e;font-weight:600">${l.desc}</div>
          ${l.serviceDate ? `<div style="font-size:12px;color:#888;margin-top:2px">${fmtDate(l.serviceDate)}</div>` : ""}
        </td>
        <td style="padding:10px 0;border-bottom:1px solid #f0f0f5;text-align:right;font-size:14px;color:#1a1a2e;font-weight:600;white-space:nowrap;vertical-align:top">
          ${fmt2(amount)}
        </td>
      </tr>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Invoice ${invoiceNum}</title>
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;background:#f5f7fa;margin:0;padding:24px 0">

  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto">

    <!-- Header -->
    <tr><td style="padding:0 0 8px">
      <div style="background:${brandColour};border-radius:12px 12px 0 0;padding:28px 32px">
        <p style="color:#99c5ff;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;margin:0 0 4px">Invoice</p>
        <p style="color:#fff;font-size:24px;font-weight:900;margin:0 0 2px">${invoiceNum}</p>
        <p style="color:rgba(255,255,255,0.6);font-size:13px;margin:0">from ${businessName}</p>
      </div>
    </td></tr>

    <!-- Body card -->
    <tr><td>
      <div style="background:#fff;border-radius:0 0 12px 12px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,0.06)">

        <!-- Personal message -->
        <p style="font-size:15px;color:#1a1a2e;line-height:1.6;margin:0 0 24px;white-space:pre-wrap">${personalMessage.replace(/</g,"&lt;").replace(/>/g,"&gt;")}</p>
        <p style="font-size:14px;color:#555;margin:0 0 28px">Have a great day,<br><strong style="color:#1a1a2e">${businessName}</strong></p>

        <!-- Divider -->
        <hr style="border:none;border-top:1px solid #eef0f8;margin:0 0 24px">

        <!-- Invoice to + Terms -->
        <div style="display:flex;gap:32px;margin-bottom:24px;flex-wrap:wrap">
          <div>
            <p style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#888;margin:0 0 6px">Invoice to</p>
            <p style="font-size:14px;color:#1a1a2e;font-weight:600;margin:0 0 2px">${customer.name}</p>
            ${customer.address ? `<p style="font-size:13px;color:#555;margin:0;white-space:pre-wrap">${customer.address.replace(/</g,"&lt;")}</p>` : ""}
          </div>
          <div>
            <p style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#888;margin:0 0 6px">Terms</p>
            <p style="font-size:14px;color:#1a1a2e;font-weight:600;margin:0 0 2px">${effectiveTerms}</p>
            ${dueDate ? `<p style="font-size:13px;color:#555;margin:0">Due ${fmtDate(dueDate)}</p>` : ""}
          </div>
        </div>

        <!-- Line items -->
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px">
          ${lineRows}
          ${vatAmount > 0 ? `
          <tr>
            <td style="padding:8px 0;text-align:right;font-size:13px;color:#888" colspan="1">VAT (20%)</td>
            <td style="padding:8px 0;text-align:right;font-size:13px;color:#888;white-space:nowrap">${fmt2(vatAmount)}</td>
          </tr>` : ""}
        </table>

        <!-- Balance due -->
        <div style="background:#f0f4ff;border-radius:10px;padding:16px 20px;display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <p style="font-size:14px;font-weight:700;color:#1a1a2e;margin:0">Balance due</p>
          <p style="font-size:26px;font-weight:900;color:${brandColour};margin:0;font-variant-numeric:tabular-nums">${fmt2(total)}</p>
        </div>

        ${bankBlock}

        <!-- Footer -->
        <hr style="border:none;border-top:1px solid #eef0f8;margin:28px 0 20px">
        <div>
          <p style="font-size:13px;font-weight:700;color:#1a1a2e;margin:0 0 2px">${businessName}</p>
          ${businessAddress ? `<p style="font-size:12px;color:#888;margin:0 0 2px">${businessAddress}</p>` : ""}
          ${businessEmail   ? `<p style="font-size:12px;color:#888;margin:0"><a href="mailto:${businessEmail}" style="color:${brandColour};text-decoration:none">${businessEmail}</a></p>` : ""}
          ${footerMsg}
        </div>
        <p style="font-size:11px;color:#bbb;margin:16px 0 0">Sent via <a href="https://cadi.cleaning" style="color:${brandColour};text-decoration:none">Cadi</a></p>
      </div>
    </td></tr>
  </table>
</body>
</html>`;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    // ── Auth ────────────────────────────────────────────────────────────────
    const SUPABASE_URL  = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(SUPABASE_URL, SERVICE_KEY);

    const token = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
    const { data: { user }, error: authErr } = await sb.auth.getUser(token);
    if (authErr || !user) return json({ error: "Unauthorized" }, 401);

    // ── Parse body ──────────────────────────────────────────────────────────
    const body = await req.json();
    const {
      invoiceId,
      to,
      subject,
      personalMessage = "Here's your invoice! We appreciate your prompt payment.",
      customer = {},
      lines = [],
      subtotal = 0,
      vatAmount = 0,
      total = 0,
      terms,
      dueDate,
      businessName,
      businessAddress,
      replyTo,
    } = body;

    if (!to || !subject) {
      return json({ error: "Missing required fields: to, subject" }, 400);
    }

    // ── Fetch invoice template for this business ────────────────────────────
    const { data: biz } = await sb
      .from("businesses")
      .select("id")
      .eq("owner_user_id", user.id)
      .single();

    let tmpl: Partial<InvoiceTemplate> | null = null;
    let invoiceNum = body.invoiceNum || `INV-${Date.now()}`;

    if (biz) {
      const { data: templateRow } = await sb
        .from("invoice_templates")
        .select("*")
        .eq("business_id", biz.id)
        .maybeSingle();

      if (templateRow) {
        tmpl = templateRow as InvoiceTemplate;
        // Use format + current seq for the invoice number
        invoiceNum = renderInvoiceNumber(
          tmpl.invoice_number_format || "INV-{seq}",
          tmpl.next_invoice_number || 1,
        );
        // Increment the sequence counter
        await sb
          .from("invoice_templates")
          .update({ next_invoice_number: (tmpl.next_invoice_number || 1) + 1 })
          .eq("id", tmpl.id);
      }
    }

    // ── Build plain-text fallback ───────────────────────────────────────────
    const lineText = lines
      .filter((l: { desc: string; rate: number }) => l.desc && l.rate)
      .map((l: { desc: string; qty: number; rate: number; serviceDate?: string }) => {
        const amt = (l.qty || 1) * l.rate;
        return `${l.serviceDate ? fmtDate(l.serviceDate) + "  " : ""}${l.desc}  £${amt.toFixed(2)}`;
      })
      .join("\n");

    const effectiveTerms = tmpl?.payment_terms_note || terms || "Net 14";
    const bankBlock = tmpl?.bank_details ? `\nBank details:\n${tmpl.bank_details}\nReference: ${invoiceNum}` : "";

    const plainText = [
      personalMessage,
      "",
      `Have a great day, ${businessName}`,
      "",
      `Invoice to: ${customer.name || ""}`,
      customer.address ? customer.address : "",
      "",
      `Invoice: ${invoiceNum}`,
      effectiveTerms ? `Terms: ${effectiveTerms}` : "",
      dueDate ? `Due: ${fmtDate(dueDate)}` : "",
      "",
      lineText,
      "",
      `Balance due: £${total.toFixed(2)}`,
      bankBlock,
      tmpl?.footer_message ? `\n${tmpl.footer_message}` : "",
    ].filter(l => l !== undefined).join("\n");

    // ── Build HTML ──────────────────────────────────────────────────────────
    const htmlEmail = buildHtml({
      personalMessage,
      invoiceNum,
      customer,
      lines,
      subtotal,
      vatAmount,
      total,
      terms,
      dueDate,
      businessName,
      businessAddress,
      businessEmail: replyTo,
      tmpl,
    });

    // ── Send via Resend ─────────────────────────────────────────────────────
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from:     RESEND_FROM,
        to:       [to],
        subject,
        text:     plainText,
        html:     htmlEmail,
        reply_to: replyTo || undefined,
      }),
    });

    if (!resendRes.ok) {
      const err = await resendRes.text();
      console.error("Resend error:", err);
      return json({ error: "Email delivery failed" }, 502);
    }

    // ── Log + update invoice ────────────────────────────────────────────────
    if (invoiceId) {
      await sb.from("invoice_sends").insert({
        owner_id:        user.id,
        invoice_id:      invoiceId,
        recipient_email: to,
        status:          "sent",
        provider:        "resend",
      });

      await sb.from("invoices")
        .update({ sent_at: new Date().toISOString(), status: "sent" })
        .eq("id", invoiceId)
        .eq("owner_id", user.id);
    }

    return json({ ok: true, invoiceNum });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("send-invoice error:", msg);
    return json({ error: msg }, 500);
  }
});
