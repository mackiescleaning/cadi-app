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
  mode?: string; clean_type?: string; frequency?: string; bedrooms?: number; postcode?: string;
  access_notes?: string; role?: string; premises_type?: string; situation?: string;
  size?: string; timeline?: string; compliance_flag?: string;
}): string {
  const { name, company, phone, email, sectorLabel, serviceLabels, address, notes, businessName, enquirySource,
    mode, clean_type, frequency, bedrooms, postcode, access_notes, role, premises_type, situation, size, timeline, compliance_flag } = opts;
  const sourceLabel = enquirySource === "widget_chat" ? "From the website chat widget" : "From the website enquiry form";

  function row(label: string, value: string | number | undefined | null, href?: string) {
    if (!value) return "";
    const cell = href
      ? `<a href="${href}" style="color:#1D1B8E;font-weight:600;">${value}</a>`
      : `<span style="color:#010a4f;">${value}</span>`;
    return `<tr><td style="color:#6b7280;padding:6px 0;width:110px;font-size:13px;vertical-align:top;">${label}</td><td style="font-size:13px;">${cell}</td></tr>`;
  }

  const rows = [
    row("Name",      name ? `${name}${role ? ` (${role})` : ""}${company ? ` — ${company}` : ""}` : ""),
    row("Phone",     phone, `tel:${phone}`),
    row("Email",     email, `mailto:${email}`),
    row("Type",      mode ? (mode.charAt(0).toUpperCase() + mode.slice(1)) : ""),
    row("Clean type", clean_type),
    row("Frequency", frequency),
    row("Bedrooms",  bedrooms),
    row("Postcode",  postcode),
    row("Premises",  premises_type),
    row("Situation", situation),
    row("Size",      size),
    row("Timeline",  timeline),
    row("Sector",    sectorLabel),
    row("Services",  serviceLabels.length ? serviceLabels.join(", ") : ""),
    row("Address",   address),
    row("Access",    access_notes),
    compliance_flag ? `<tr><td colspan="2" style="padding:8px 0 0;font-size:12px;color:#b45309;font-weight:600;">⚠ ${compliance_flag}</td></tr>` : "",
    row("Notes",     notes?.length ? notes.join(", ") : ""),
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
    // Chat-specific fields
    mode,
    clean_type, frequency, bedrooms, postcode,
    access_notes,
    role, premises_type, situation, size, timeline, compliance_flag,
  } = body as {
    business_id: string;
    name?: string; company?: string; phone?: string; email?: string;
    sector?: string; services?: string[]; notes?: string[]; address?: string;
    mode?: string;
    clean_type?: string; frequency?: string; bedrooms?: number; postcode?: string;
    access_notes?: string;
    role?: string; premises_type?: string; situation?: string; size?: string;
    timeline?: string; compliance_flag?: string;
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
  let isPro = false;

  if (biz?.owner_user_id) {
    const { data: profile } = await sb
      .from("profiles")
      .select("business_name, brand_voice, subscription_tier, plan")
      .eq("id", biz.owner_user_id)
      .maybeSingle();

    const brandVoice = profile?.brand_voice as Record<string, string> | null;
    bizName = brandVoice?.business_name ?? profile?.business_name ?? "Cleaning Services";

    const tier = (profile?.subscription_tier === "pro" || profile?.subscription_tier === "max")
      ? profile.subscription_tier
      : (profile?.plan === "pro" || profile?.plan === "max")
        ? profile.plan
        : "lite";
    isPro = tier === "pro" || tier === "max";

    const { data: { user } } = await sb.auth.admin.getUserById(biz.owner_user_id);
    ownerEmail = user?.email ?? null;
  }

  // ── Monthly limit check (lite plan only) ──────────────────────────────────
  if (!isPro) {
    const thisMonth = new Date().toISOString().slice(0, 7) + "-01";
    const { data: allowed, error: rpcErr } = await sb.rpc("check_and_consume_fd_limit", {
      p_business_id: business_id,
      p_month:       thisMonth,
      p_limit:       10,
    });
    if (rpcErr) {
      console.error("fd limit check error:", rpcErr);
      // Fail open — don't block a real lead because of a DB hiccup
    } else if (!allowed) {
      return json({ error: "Monthly site visit request limit reached", limit_reached: true }, 429);
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

  // Human-readable labels for chat-collected fields
  const MODE_LABELS: Record<string, string> = {
    residential: "Residential", exterior: "Exterior", commercial: "Commercial",
  };
  const CLEAN_TYPE_LABELS: Record<string, string> = {
    regular: "Regular clean", "one-off": "One-off clean",
    "end of tenancy": "End of tenancy", "after builders": "After builders",
  };
  const FREQ_LABELS: Record<string, string> = {
    weekly: "Weekly", fortnightly: "Fortnightly", monthly: "Monthly",
    four_weekly: "Every 4 weeks", "one_off": "One-off",
  };

  const summaryLines = [
    name    ? `**Name:** ${name}${company ? ` — ${company}` : ""}${role ? ` (${role})` : ""}` : null,
    phone   ? `**Phone:** ${phone}` : null,
    email   ? `**Email:** ${email}` : null,
    mode          ? `**Type:** ${MODE_LABELS[mode] ?? mode}` : null,
    clean_type    ? `**Clean type:** ${CLEAN_TYPE_LABELS[clean_type] ?? clean_type}` : null,
    frequency     ? `**Frequency:** ${FREQ_LABELS[frequency] ?? frequency}` : null,
    bedrooms      ? `**Bedrooms:** ${bedrooms}` : null,
    postcode      ? `**Postcode:** ${postcode}` : null,
    premises_type ? `**Premises:** ${premises_type}` : null,
    situation     ? `**Situation:** ${situation}` : null,
    size          ? `**Size:** ${size}` : null,
    timeline      ? `**Timeline:** ${timeline}` : null,
    sectorLabel          ? `**Sector:** ${sectorLabel}` : null,
    serviceLabels.length ? `**Services:** ${serviceLabels.join(", ")}` : null,
    address       ? `**Address:** ${address}` : null,
    access_notes  ? `**Access:** ${access_notes}` : null,
    compliance_flag ? `**Compliance:** ${compliance_flag}` : null,
    notes?.length ? `**Notes:** ${notes.join(", ")}` : null,
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
      mode,
      clean_type, frequency, bedrooms, postcode,
      access_notes,
      role, premises_type, situation, size, timeline, compliance_flag,
      summary: summaryLines,
      lead_id: lead?.id ?? null,
    },
    reasoning: `New site visit request from the Mackies website. ${name ?? ""}${role ? ` (${role})` : ""}${company ? ` — ${company}` : ""} is interested in ${serviceLabels.length ? serviceLabels.join(", ") : mode ? `${MODE_LABELS[mode] ?? mode} cleaning` : "cleaning services"}.`,
  }).select("id").single();

  if (actionErr) {
    console.error("agent_actions insert error:", actionErr);
    return json({ error: "Failed to create inbox item" }, 500);
  }

  // ── Send emails (fire and forget — don't block the response) ──────────────
  const enquirySource = body.enquiry_source as string | undefined;
  const emailOpts = {
    name, company, phone, email, sectorLabel, serviceLabels, address, notes,
    businessName: bizName, enquirySource,
    mode, clean_type, frequency, bedrooms, postcode,
    access_notes, role, premises_type, situation, size, timeline, compliance_flag,
  };

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
