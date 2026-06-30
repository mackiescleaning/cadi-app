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
const RESEND_FROM    = Deno.env.get("RESEND_FROM") ?? "Cadi <hello@cadi.cleaning>";

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
  vatRegistered,
  terms,
  issueDate,
  dueDate,
  businessName,
  businessAddress,
  businessEmail,
  vatNumber,
  companyNum,
  entityType,
  registeredOffice,
  privacyUrl,
  termsUrl,
  logoUrl,
  logoPosition,
  tmpl,
}: {
  personalMessage: string;
  invoiceNum: string;
  customer: { name: string; address?: string; email?: string };
  lines: { desc: string; qty: number; rate: number; serviceDate?: string }[];
  subtotal: number;
  vatAmount: number;
  total: number;
  vatRegistered?: boolean;
  terms: string;
  issueDate?: string;
  dueDate: string;
  businessName: string;
  businessAddress?: string;
  businessEmail?: string;
  vatNumber?: string;
  companyNum?: string;
  entityType?: string;
  registeredOffice?: string;
  privacyUrl?: string;
  termsUrl?: string;
  logoUrl?: string;
  logoPosition?: string;
  tmpl: Partial<InvoiceTemplate> | null;
}) {
  const brandColour    = tmpl?.brand_colour || "#010a4f";
  const effectiveTerms = tmpl?.payment_terms_note || terms || "Net 14";
  const issueDateStr   = issueDate ? fmtDate(issueDate) : fmtDate(new Date().toISOString());
  const dueDateStr     = dueDate   ? fmtDate(dueDate)   : "";

  // Logo alignment
  const logoAlign = logoPosition === "top_right" ? "right" : logoPosition === "top_centre" ? "center" : "left";
  const logoBlock = logoUrl
    ? `<div style="text-align:${logoAlign};margin-bottom:4px"><img src="${logoUrl}" alt="${businessName}" style="height:44px;max-width:160px;object-fit:contain" /></div>`
    : "";

  // Line items rows
  const lineRows = lines
    .filter(l => l.desc && l.rate)
    .map(l => {
      const qty    = l.qty || 1;
      const amount = qty * l.rate;
      return `
        <tr>
          <td style="padding:11px 8px 11px 0;border-bottom:1px solid #f0f0f5;font-size:13px;color:#1a1a2e;vertical-align:top">
            ${l.desc}
            ${l.serviceDate ? `<div style="font-size:11px;color:#aaa;margin-top:2px">${fmtDate(l.serviceDate)}</div>` : ""}
          </td>
          <td style="padding:11px 8px;border-bottom:1px solid #f0f0f5;font-size:13px;color:#888;text-align:center;vertical-align:top">${qty}</td>
          <td style="padding:11px 8px;border-bottom:1px solid #f0f0f5;font-size:13px;color:#888;text-align:right;white-space:nowrap;vertical-align:top">${fmt2(l.rate)}</td>
          <td style="padding:11px 0 11px 8px;border-bottom:1px solid #f0f0f5;font-size:13px;color:#1a1a2e;font-weight:600;text-align:right;white-space:nowrap;vertical-align:top">${fmt2(amount)}</td>
        </tr>`;
    })
    .join("");

  // Bank / payment details block
  const bankBlock = tmpl?.bank_details
    ? `<tr><td colspan="2">
        <div style="margin-top:20px;padding:14px 16px;background:#f8f9fc;border-radius:8px;border:1px solid #eaeef8">
          <p style="font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#aaa;margin:0 0 8px">Payment details</p>
          <pre style="font-size:12px;color:#444;margin:0;font-family:inherit;white-space:pre-wrap;line-height:1.6">${tmpl.bank_details.replace(/</g, "&lt;")}</pre>
          <p style="font-size:12px;color:#888;margin:8px 0 0">Reference: <strong style="color:#1a1a2e">${invoiceNum}</strong></p>
        </div>
      </td></tr>`
    : "";

  const footerMsg = tmpl?.footer_message
    ? `<p style="font-size:12px;color:#aaa;text-align:center;margin:0">${tmpl.footer_message.replace(/</g, "&lt;")}</p>`
    : "";

  // ─── Compliance footer ────────────────────────────────────────────────────
  // UK Ltd companies MUST display: registered name, company number, registered
  // office, place of registration on any business document including invoices.
  // Sole traders just need business name + trading address. VAT-registered
  // sellers must show their VAT number on every VAT invoice.
  const legalBits: string[] = [];
  if (entityType === "limited_company") {
    legalBits.push(`${businessName} — registered in England &amp; Wales`);
    if (companyNum) legalBits.push(`Company no. ${companyNum.replace(/</g, "&lt;")}`);
    if (registeredOffice) legalBits.push(`Registered office: ${registeredOffice.replace(/</g, "&lt;").replace(/\n/g, ", ")}`);
  } else if (businessAddress) {
    legalBits.push(businessAddress.replace(/</g, "&lt;").replace(/\n/g, ", "));
  }
  if (vatRegistered && vatNumber) legalBits.push(`VAT no. ${vatNumber.replace(/</g, "&lt;")}`);
  const legalLine = legalBits.length
    ? `<p style="font-size:10px;color:#bbb;text-align:center;margin:0 0 6px;line-height:1.6">${legalBits.join(" &middot; ")}</p>`
    : "";

  const safePrivacy = (privacyUrl || "https://cadi.cleaning/privacy").replace(/"/g, "");
  const safeTerms   = (termsUrl   || "https://cadi.cleaning/terms").replace(/"/g, "");
  const policyLinks = `
    <p style="font-size:11px;color:#bbb;text-align:center;margin:0 0 6px">
      <a href="${safePrivacy}" style="color:${brandColour};text-decoration:none;margin:0 8px">Privacy Policy</a>
      <span style="color:#ddd">·</span>
      <a href="${safeTerms}" style="color:${brandColour};text-decoration:none;margin:0 8px">Terms &amp; Conditions</a>
    </p>`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Invoice ${invoiceNum} from ${businessName}</title>
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;background:#f0f2f7;margin:0;padding:32px 16px">

  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto">
    <tr><td>

      <!-- Card -->
      <div style="background:#fff;border-radius:14px;box-shadow:0 4px 24px rgba(0,0,0,0.08);overflow:hidden">

        <!-- Brand accent bar -->
        <div style="height:5px;background:${brandColour}"></div>

        <!-- Header: logo/biz left, INVOICE right -->
        <table width="100%" cellpadding="0" cellspacing="0" style="padding:28px 32px 20px">
          <tr>
            <td style="vertical-align:top">
              ${logoBlock}
              <p style="font-size:${logoUrl ? 12 : 16}px;font-weight:${logoUrl ? 700 : 800};color:${logoUrl ? '#555' : brandColour};margin:0 0 2px">${businessName}</p>
              ${businessAddress ? `<p style="font-size:11px;color:#aaa;margin:0;white-space:pre-wrap">${businessAddress.replace(/</g,"&lt;")}</p>` : ""}
              ${businessEmail   ? `<p style="font-size:11px;color:#aaa;margin:2px 0 0"><a href="mailto:${businessEmail}" style="color:${brandColour};text-decoration:none">${businessEmail}</a></p>` : ""}
            </td>
            <td style="vertical-align:top;text-align:right">
              <p style="font-size:28px;font-weight:900;color:${brandColour};margin:0 0 4px;letter-spacing:-0.5px">INVOICE</p>
              <p style="font-size:14px;font-weight:700;color:#444;margin:0">${invoiceNum}</p>
            </td>
          </tr>
        </table>

        <!-- Invoice meta strip -->
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="padding:0 32px 20px">
            <table cellpadding="0" cellspacing="0" style="background:#f8f9fc;border-radius:10px;padding:12px 18px;width:100%">
              <tr>
                <td style="font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#aaa;padding-bottom:3px">Date issued</td>
                <td style="font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#aaa;padding-bottom:3px">Due date</td>
                ${effectiveTerms ? `<td style="font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#aaa;padding-bottom:3px">Terms</td>` : ""}
              </tr>
              <tr>
                <td style="font-size:13px;font-weight:600;color:#1a1a2e;padding-right:32px">${issueDateStr}</td>
                <td style="font-size:13px;font-weight:700;color:${brandColour}">${dueDateStr}</td>
                ${effectiveTerms ? `<td style="font-size:13px;font-weight:600;color:#1a1a2e">${effectiveTerms}</td>` : ""}
              </tr>
            </table>
          </td></tr>
        </table>

        <!-- Bill to + personal message -->
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:0 32px 20px;vertical-align:top;width:50%">
              <p style="font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#aaa;margin:0 0 6px">Bill to</p>
              <p style="font-size:14px;font-weight:700;color:#1a1a2e;margin:0 0 2px">${customer.name}</p>
              ${customer.address ? `<p style="font-size:12px;color:#888;margin:0;white-space:pre-wrap">${customer.address.replace(/</g,"&lt;")}</p>` : ""}
              ${customer.email   ? `<p style="font-size:12px;color:#aaa;margin:2px 0 0">${customer.email}</p>` : ""}
            </td>
            <td style="padding:0 32px 20px;vertical-align:top">
              <p style="font-size:13px;color:#555;line-height:1.65;margin:0;white-space:pre-wrap">${personalMessage.replace(/</g,"&lt;").replace(/>/g,"&gt;")}</p>
            </td>
          </tr>
        </table>

        <!-- Line items -->
        <table width="100%" cellpadding="0" cellspacing="0" style="padding:0 32px">
          <tr><td colspan="4" style="padding:0 0 2px">
            <table width="100%" cellpadding="0" cellspacing="0">
              <thead>
                <tr style="border-bottom:2px solid ${brandColour}">
                  <th style="font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#aaa;text-align:left;padding:0 8px 8px 0">Description</th>
                  <th style="font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#aaa;text-align:center;padding:0 8px 8px;width:40px">Qty</th>
                  <th style="font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#aaa;text-align:right;padding:0 8px 8px;width:70px">Rate</th>
                  <th style="font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#aaa;text-align:right;padding:0 0 8px 8px;width:70px">Amount</th>
                </tr>
              </thead>
              <tbody>${lineRows}</tbody>
            </table>
          </td></tr>
        </table>

        <!-- Totals -->
        <table width="100%" cellpadding="0" cellspacing="0" style="padding:16px 32px 8px">
          <tr>
            <td></td>
            <td style="width:220px">
              ${(vatRegistered || subtotal !== total) ? `
              <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #f0f0f5">
                <span style="font-size:12px;color:#888">Net total</span>
                <span style="font-size:12px;font-weight:600;color:#1a1a2e">${fmt2(subtotal)}</span>
              </div>` : ""}
              ${vatAmount > 0 ? `
              <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #f0f0f5">
                <span style="font-size:12px;color:#888">VAT (20%)</span>
                <span style="font-size:12px;font-weight:600;color:#1a1a2e">${fmt2(vatAmount)}</span>
              </div>` : ""}
              <div style="display:flex;justify-content:space-between;align-items:center;background:${brandColour};border-radius:8px;padding:12px 16px;margin-top:10px">
                <span style="font-size:13px;font-weight:700;color:#fff">Total due</span>
                <span style="font-size:22px;font-weight:900;color:#fff;font-variant-numeric:tabular-nums">${fmt2(total)}</span>
              </div>
            </td>
          </tr>
          ${bankBlock}
        </table>

        <!-- Footer -->
        <div style="padding:20px 32px 28px;border-top:1px solid #f2f2f7;margin-top:20px;text-align:center">
          ${footerMsg}
          ${legalLine}
          ${policyLinks}
          <p style="font-size:11px;color:#ccc;margin:6px 0 0">Sent via <a href="https://cadi.cleaning" style="color:${brandColour};text-decoration:none">Cadi</a></p>
        </div>

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
      vatRegistered = false,
      terms,
      dueDate,
      businessName,
      businessAddress,
      businessEmail,
      replyTo,
      bcc,
      // Compliance fields (rendered in footer + used on the PDF)
      vatNumber,
      companyNum,
      entityType,
      registeredOffice,
      privacyUrl,
      termsUrl,
      // PDF attachment (base64 string + filename) — generated client-side
      pdfBase64,
      pdfFilename,
      // Per-invoice bank details (override the template's stored block if provided)
      bankName,
      sortCode,
      accountNum,
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

    // ── Build bank details from per-invoice fields if provided ──────────────
    //    Takes precedence over tmpl.bank_details so users can override per send.
    const perInvoiceBank: string[] = [];
    if (bankName)  perInvoiceBank.push(`Bank: ${String(bankName).trim()}`);
    if (sortCode)  perInvoiceBank.push(`Sort code: ${String(sortCode).trim()}`);
    if (accountNum) perInvoiceBank.push(`Account no: ${String(accountNum).trim()}`);
    if (perInvoiceBank.length) {
      tmpl = { ...(tmpl ?? {}), bank_details: perInvoiceBank.join("\n") };
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

    // Plain-text compliance footer mirrors the HTML legal line + policy links.
    const legalBitsText: string[] = [];
    if (entityType === "limited_company") {
      legalBitsText.push(`${businessName} — registered in England & Wales`);
      if (companyNum) legalBitsText.push(`Company no. ${companyNum}`);
      if (registeredOffice) legalBitsText.push(`Registered office: ${registeredOffice.replace(/\n/g, ", ")}`);
    } else if (businessAddress) {
      legalBitsText.push(businessAddress.replace(/\n/g, ", "));
    }
    if (vatRegistered && vatNumber) legalBitsText.push(`VAT no. ${vatNumber}`);
    const legalLineText = legalBitsText.join(" · ");
    const privacyUrlText = privacyUrl || "https://cadi.cleaning/privacy";
    const termsUrlText   = termsUrl   || "https://cadi.cleaning/terms";

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
      vatRegistered ? `Net: £${subtotal.toFixed(2)}` : "",
      vatRegistered ? `VAT (20%): £${vatAmount.toFixed(2)}` : "",
      `Balance due: £${total.toFixed(2)}`,
      bankBlock,
      tmpl?.footer_message ? `\n${tmpl.footer_message}` : "",
      "",
      legalLineText ? `— ${legalLineText}` : "",
      `Privacy: ${privacyUrlText}`,
      `Terms: ${termsUrlText}`,
    ].filter(l => l !== undefined && l !== "").join("\n");

    // ── Build HTML ──────────────────────────────────────────────────────────
    const htmlEmail = buildHtml({
      personalMessage,
      invoiceNum,
      customer,
      lines,
      subtotal,
      vatAmount,
      total,
      vatRegistered,
      terms,
      dueDate,
      businessName,
      businessAddress,
      businessEmail: businessEmail || replyTo,
      vatNumber,
      companyNum,
      entityType,
      registeredOffice,
      privacyUrl,
      termsUrl,
      tmpl,
    });

    // ── Build dynamic FROM — shows business name in customer's inbox ────────
    //    Email address must stay on the verified cadi.cleaning domain, but
    //    the display name is what shows up in the customer's "From" field.
    const fromAddress = RESEND_FROM.match(/<([^>]+)>/)?.[1] || "hello@cadi.cleaning";
    const cleanName   = (businessName || "Cadi").replace(/[<>"]/g, "").trim();
    const dynamicFrom = `${cleanName} <${fromAddress}>`;

    // ── Build attachments (PDF copy of the invoice) ─────────────────────────
    const attachments: Array<{ filename: string; content: string }> = [];
    if (pdfBase64 && typeof pdfBase64 === "string" && pdfBase64.length > 100) {
      attachments.push({
        filename: pdfFilename || `${invoiceNum}.pdf`,
        content:  pdfBase64,
      });
    }

    // ── Send via Resend ─────────────────────────────────────────────────────
    //   - reply_to: customer replies go to the business, not Cadi
    //   - bcc:      business gets a copy of every invoice they send
    //   - attachments: PDF copy of the invoice
    const resendPayload: Record<string, unknown> = {
      from:     dynamicFrom,
      to:       [to],
      subject,
      text:     plainText,
      html:     htmlEmail,
      reply_to: replyTo || undefined,
    };
    if (bcc && typeof bcc === "string" && bcc.includes("@") && bcc.toLowerCase() !== String(to).toLowerCase()) {
      resendPayload.bcc = [bcc];
    }
    if (attachments.length) {
      resendPayload.attachments = attachments;
    }

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(resendPayload),
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
