/**
 * supabase/functions/receive-site-visit/index.ts
 * Receives a site visit enquiry from the Mackies website and:
 *   1. Creates a leads record
 *   2. Creates an agent_actions record (pending_approval) in Chris's inbox
 *   3. Emails Chris a notification
 *   4. Sends the customer an auto-reply (if email provided)
 *
 * POST { business_id, name, company?, phone, email, sector?, services?, notes?, address? }
 * No auth required — public endpoint called from the Mackies website form.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL         = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY       = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL           = "hello@cadi.cleaning";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });

const SECTOR_LABELS: Record<string, string> = {
  offices:     "Offices",
  retail:      "Retail",
  hospitality: "Hospitality & Leisure",
  education:   "Education",
  industrial:  "Industrial / Warehouse",
  healthcare:  "Healthcare",
  residential: "Residential",
  other:       "Other",
};

const SERVICE_LABELS: Record<string, string> = {
  windows:    "Window Cleaning",
  gutters:    "Gutter Clearing & Cleaning",
  pressure:   "Pressure Washing",
  roof:       "Roof Cleaning",
  fascia:     "Fascia & Soffit",
  "not-sure": "Advice needed",
};

async function sendEmail(to: string, subject: string, html: string, fromName: string) {
  if (!RESEND_API_KEY) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type":  "application/json",
    },
    body: JSON.stringify({
      from:    `${fromName} <${FROM_EMAIL}>`,
      to:      [to],
      subject,
      html,
    }),
  });
}

function buildChrisEmail(opts: {
  name?: string; company?: string; phone?: string; email?: string;
  sectorLabel?: string | null; serviceLabels: string[];
  address?: string; notes?: string[];
  businessName?: string; enquirySource?: string;
}): string {
  const { name, company, phone, email, sectorLabel, serviceLabels, address, notes, businessName, enquirySource } = opts;
  const sourceLabel = enquirySource === "widget_chat" ? "From the website chat widget" : "From the website enquiry form";
  const rows = [
    name    ? `<tr><td style="color:#6b7280;padding:6px 0;width:100px;font-size:13px;">Name</td><td style="font-size:13px;font-weight:600;color:#010a4f;">${name}${company ? ` — ${company}` : ""}</td></tr>` : "",
    phone   ? `<tr><td style="color:#6b7280;padding:6px 0;font-size:13px;">Phone</td><td style="font-size:13px;"><a href="tel:${phone}" style="color:#1D1B8E;font-weight:600;">${phone}</a></td></tr>` : "",
    email   ? `<tr><td style="color:#6b7280;padding:6px 0;font-size:13px;">Email</td><td style="font-size:13px;"><a href="mailto:${email}" style="color:#1D1B8E;">${email}</a></td></tr>` : "",
    sectorLabel ? `<tr><td style="color:#6b7280;padding:6px 0;font-size:13px;">Sector</td><td style="font-size:13px;color:#010a4f;">${sectorLabel}</td></tr>` : "",
    serviceLabels.length ? `<tr><td style="color:#6b7280;padding:6px 0;font-size:13px;">Services</td><td style="font-size:13px;color:#010a4f;">${serviceLabels.join(", ")}</td></tr>` : "",
    address ? `<tr><td style="color:#6b7280;padding:6px 0;font-size:13px;">Site</td><td style="font-size:13px;color:#010a4f;">${address}</td></tr>` : "",
    notes?.length ? `<tr><td style="color:#6b7280;padding:6px 0;font-size:13px;">Notes</td><td style="font-size:13px;color:#010a4f;">${notes.join(", ")}</td></tr>` : "",
  ].filter(Boolean).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:32px 16px;background:#f5f7ff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(1,10,79,0.08);">
    <div style="background:#010a4f;padding:24px 32px;">
      <p style="margin:0;color:#fff;font-size:18px;font-weight:800;letter-spacing:-0.3px;">New site visit request</p>
      <p style="margin:6px 0 0;color:#99c5ff;font-size:13px;">${sourceLabel}</p>
    </div>
    <div style="padding:28px 32px;">
      <table style="width:100%;border-collapse:collapse;">${rows}</table>
      <div style="margin-top:24px;">
        <a href="https://app.cadi.cleaning/inbox"
          style="display:inline-block;background:#1D1B8E;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:13px;font-weight:700;">
          View in Cadi inbox →
        </a>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function buildCustomerEmail(name?: string, businessName?: string): string {
  const greeting = name ? `Hi ${name},` : "Hi there,";
  const biz = businessName ?? "us";
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:32px 16px;background:#f5f7ff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(1,10,79,0.08);">
    <div style="background:#010a4f;padding:24px 32px;">
      <p style="margin:0;color:#fff;font-size:18px;font-weight:800;letter-spacing:-0.3px;">${biz}</p>
    </div>
    <div style="padding:28px 32px;">
      <p style="margin:0 0 16px;font-size:15px;color:#010a4f;font-weight:600;">${greeting}</p>
      <p style="margin:0 0 24px;font-size:14px;color:#374151;line-height:1.6;">
        Thanks for getting in touch. We've received your site visit request and will be in touch within a few hours to agree a convenient time.
      </p>
      <p style="margin:0;font-size:13px;color:#6b7280;">— The ${biz} team</p>
    </div>
  </div>
</body>
</html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST")    return json({ error: "Method not allowed" }, 405);

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return json({ error: "Invalid JSON" }, 400); }

  const {
    business_id,
    name, company, phone, email,
    sector, services, notes, address,
  } = body as {
    business_id: string;
    name?: string; company?: string; phone?: string; email?: string;
    sector?: string; services?: string[]; notes?: string[]; address?: string;
  };

  if (!business_id) return json({ error: "Missing business_id" }, 400);
  if (!name && !email && !phone) return json({ error: "Missing contact details" }, 400);

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // ── Look up business owner email and name ──────────────────────────────────
  const { data: biz } = await sb
    .from("businesses")
    .select("owner_user_id")
    .eq("id", business_id)
    .single();

  let ownerEmail: string | null = null;
  let bizName: string = "Cleaning Services";

  if (biz?.owner_user_id) {
    const { data: profile } = await sb
      .from("profiles")
      .select("display_name, brand_voice, email")
      .eq("id", biz.owner_user_id)
      .maybeSingle();

    const brandVoice = profile?.brand_voice as Record<string, string> | null;
    bizName = brandVoice?.business_name ?? profile?.display_name ?? "Cleaning Services";

    // Try profile email first, then auth admin API
    if (profile?.email) {
      ownerEmail = profile.email;
    } else {
      const { data: { user } } = await sb.auth.admin.getUserById(biz.owner_user_id);
      ownerEmail = user?.email ?? null;
    }
  }

  // ── Create lead ────────────────────────────────────────────────────────────
  const { data: lead } = await sb.from("leads").insert({
    business_id,
    name:           name ?? null,
    email:          email ?? null,
    phone:          phone ?? null,
    enquiry_source: "website_form",
    status:         "qualifying",
  }).select("id").single();

  // ── Build summary ──────────────────────────────────────────────────────────
  const sectorLabel   = sector ? (SECTOR_LABELS[sector] ?? sector) : null;
  const serviceLabels = (services ?? []).map(s => SERVICE_LABELS[s] ?? s);

  const summaryLines = [
    name    ? `**Name:** ${name}${company ? ` — ${company}` : ""}` : null,
    phone   ? `**Phone:** ${phone}` : null,
    email   ? `**Email:** ${email}` : null,
    sectorLabel          ? `**Sector:** ${sectorLabel}` : null,
    serviceLabels.length ? `**Services:** ${serviceLabels.join(", ")}` : null,
    notes?.length        ? `**Notes:** ${notes.join(", ")}` : null,
    address ? `**Site:** ${address}` : null,
  ].filter(Boolean).join("\n");

  // ── Insert agent_actions row ───────────────────────────────────────────────
  const { data: action, error: actionErr } = await sb.from("agent_actions").insert({
    business_id,
    agent:            "front_desk",
    action_type:      "site_visit_request",
    status:           "pending_approval",
    proposed_payload: {
      name, company, phone, email,
      sector, sector_label: sectorLabel,
      services, service_labels: serviceLabels,
      notes, address,
      summary: summaryLines,
      lead_id: lead?.id ?? null,
    },
    reasoning: `New site visit request from the Mackies website. ${name ?? ""}${company ? ` (${company})` : ""} is interested in ${serviceLabels.length ? serviceLabels.join(", ") : "exterior cleaning services"}.`,
  }).select("id").single();

  if (actionErr) {
    console.error("agent_actions insert error:", actionErr);
    return json({ error: "Failed to create inbox item" }, 500);
  }

  // ── Send emails (fire and forget — don't block the response) ──────────────
  const enquirySource = body.enquiry_source as string | undefined;
  const emailOpts = { name, company, phone, email, sectorLabel, serviceLabels, address, notes, businessName: bizName, enquirySource };

  await Promise.allSettled([
    ownerEmail
      ? sendEmail(
          ownerEmail,
          `New site visit request — ${name ?? ""}${company ? ` (${company})` : ""}`.trim(),
          buildChrisEmail(emailOpts),
          "Cadi",
        )
      : Promise.resolve(),
    email
      ? sendEmail(
          email,
          `Thanks for your enquiry — ${bizName}`,
          buildCustomerEmail(name, bizName),
          bizName,
        )
      : Promise.resolve(),
  ]);

  return json({ ok: true, action_id: action?.id, lead_id: lead?.id });
});
