/**
 * supabase/functions/send-welcome/index.ts
 * Sends a branded welcome email to a new Cadi user immediately after signup.
 *
 * POST { email, firstName, businessName }
 * Public — no JWT required (called before email confirmation completes).
 *
 * Environment variables:
 *   RESEND_API_KEY            — re_...
 *   APP_ORIGIN                — https://app.cadi.cleaning
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const APP_ORIGIN     = Deno.env.get("APP_ORIGIN") ?? "https://app.cadi.cleaning";
const FROM           = "Cadi <hello@cadi.cleaning>";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

function buildWelcomeEmail(firstName: string, businessName: string): string {
  const greeting = firstName ? `Hi ${firstName},` : "Hi there,";
  const biz = businessName || "your business";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
</head>
<body style="margin:0;padding:0;background:#0a0a14;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a14;padding:48px 20px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

        <!-- Logo -->
        <tr><td style="padding-bottom:32px;text-align:center;">
          <span style="font-size:24px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;">Cadi</span>
        </td></tr>

        <!-- Main card -->
        <tr><td style="background:#111120;border:1px solid rgba(153,197,255,0.12);border-radius:20px;overflow:hidden;">

          <!-- Top accent -->
          <div style="height:3px;background:linear-gradient(90deg,#1f48ff,#99c5ff,#1f48ff);"></div>

          <div style="padding:40px 40px 32px;">
            <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:rgba(153,197,255,0.45);letter-spacing:0.1em;text-transform:uppercase;">Welcome to Cadi</p>
            <h1 style="margin:0 0 20px;font-size:26px;font-weight:900;color:#ffffff;line-height:1.25;">
              ${greeting}<br/>You're set up and ready to go.
            </h1>
            <p style="margin:0 0 28px;font-size:15px;color:rgba(153,197,255,0.6);line-height:1.7;">
              We've created your Cadi account for <strong style="color:rgba(153,197,255,0.85);">${biz}</strong>.
              Here's everything you can do from day one:
            </p>

            <!-- Feature list -->
            <table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:32px;">
              ${[
                ["📅", "Schedule jobs", "Drag-and-drop scheduler with route optimisation"],
                ["💷", "Send invoices", "Professional invoices and quotes in seconds"],
                ["👥", "Manage customers", "Up to 50 customers on the free plan"],
                ["💬", "Front Desk AI", "Website chat that books site visits for you (Pro)"],
                ["📊", "Money tracker", "Track income, expenses and your tax reserve (Pro)"],
              ].map(([icon, title, desc]) => `
              <tr>
                <td style="width:36px;vertical-align:top;padding:0 12px 16px 0;">
                  <span style="font-size:20px;">${icon}</span>
                </td>
                <td style="vertical-align:top;padding-bottom:16px;">
                  <p style="margin:0 0 2px;font-size:14px;font-weight:700;color:#ffffff;">${title}</p>
                  <p style="margin:0;font-size:13px;color:rgba(153,197,255,0.45);">${desc}</p>
                </td>
              </tr>`).join("")}
            </table>

            <!-- CTA -->
            <table cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
              <tr><td style="background:#1f48ff;border-radius:12px;">
                <a href="${APP_ORIGIN}/dashboard"
                  style="display:inline-block;padding:15px 32px;font-size:14px;font-weight:900;color:#ffffff;text-decoration:none;letter-spacing:0.01em;">
                  Open Cadi →
                </a>
              </td></tr>
            </table>

            <p style="margin:0;font-size:14px;color:rgba(153,197,255,0.45);line-height:1.6;">
              Any questions? Just reply to this email — we're a real team and we read every message.
            </p>
          </div>

        </td></tr>

        <!-- Footer -->
        <tr><td style="padding-top:28px;text-align:center;">
          <p style="margin:0 0 4px;font-size:12px;color:rgba(153,197,255,0.2);">
            Cadi · Built for cleaning businesses across the UK
          </p>
          <p style="margin:0;font-size:11px;color:rgba(153,197,255,0.15);">
            <a href="${APP_ORIGIN}" style="color:rgba(153,197,255,0.25);text-decoration:none;">app.cadi.cleaning</a>
            &nbsp;·&nbsp;
            <a href="mailto:support@cadi.cleaning" style="color:rgba(153,197,255,0.25);text-decoration:none;">support@cadi.cleaning</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST")   return json({ error: "Method not allowed" }, 405);

  if (!RESEND_API_KEY) {
    console.warn("send-welcome: RESEND_API_KEY not set, skipping email");
    return json({ ok: true, skipped: true });
  }

  let body: { email?: string; firstName?: string; businessName?: string };
  try { body = await req.json(); }
  catch { return json({ error: "Invalid JSON" }, 400); }

  const { email, firstName = "", businessName = "" } = body;
  if (!email) return json({ error: "email required" }, 400);

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type":  "application/json",
    },
    body: JSON.stringify({
      from:    FROM,
      to:      [email],
      subject: `Welcome to Cadi, ${firstName || "there"} 👋`,
      html:    buildWelcomeEmail(firstName, businessName),
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("send-welcome Resend error:", err);
    return json({ error: "Email send failed" }, 502);
  }

  return json({ ok: true });
});
