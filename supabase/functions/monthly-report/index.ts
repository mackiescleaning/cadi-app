/**
 * supabase/functions/monthly-report/index.ts
 * Cadi — sends a plain-English monthly summary email to every user
 * who logged income/expenses in the previous calendar month.
 *
 * Triggered by pg_cron on the 1st of each month at 08:00 UTC.
 * Can also be called manually with { userId } for a test send.
 *
 * Auth: requires x-cron-secret header matching CRON_SECRET env var.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_KEY  = Deno.env.get("RESEND_API_KEY") ?? "";
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";
const APP_URL     = "https://app.cadi.cleaning";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

// ── Date helpers ──────────────────────────────────────────────────────────────
function prevMonthRange() {
  const now   = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const last  = new Date(now.getFullYear(), now.getMonth(), 0);
  return {
    start:     first.toISOString().slice(0, 10),
    end:       last.toISOString().slice(0, 10),
    monthName: first.toLocaleDateString("en-GB", { month: "long" }),
    year:      first.getFullYear(),
  };
}

function twoMonthsAgoRange() {
  const now   = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  const last  = new Date(now.getFullYear(), now.getMonth() - 1, 0);
  return { start: first.toISOString().slice(0, 10), end: last.toISOString().slice(0, 10) };
}

// ── Resend email ──────────────────────────────────────────────────────────────
async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method:  "POST",
    headers: { "Authorization": `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body:    JSON.stringify({ from: "Cadi <reports@cadi.cleaning>", to, subject, html }),
  });
  if (!res.ok) throw new Error(`Resend: ${await res.text()}`);
}

// ── Email template ────────────────────────────────────────────────────────────
const CAT_EMOJI: Record<string, string> = { fuel: "⛽", supplies: "🧴", equipment: "🔧", insurance: "🛡️", marketing: "📣", vehicle: "🚐", other: "📦" };
const CAT_LABEL: Record<string, string> = { fuel: "Fuel", supplies: "Supplies", equipment: "Equipment", insurance: "Insurance", marketing: "Marketing", vehicle: "Vehicle", other: "Other" };

function buildHtml({
  firstName, monthName, year, income, expenses, vsLast, topCatKey, topCatAmount,
}: {
  firstName: string; monthName: string; year: number;
  income: number; expenses: number; vsLast: number;
  topCatKey: string; topCatAmount: number;
}) {
  const profit  = income - expenses;
  const margin  = income > 0 ? Math.round((profit / income) * 100) : 0;
  const f       = (n: number) => `£${Math.round(Math.abs(n)).toLocaleString("en-GB")}`;
  const vsSign  = vsLast >= 0 ? "+" : "-";
  const vsColor = vsLast >= 0 ? "#16a34a" : "#dc2626";

  const lines: string[] = [];
  if (income > 0) lines.push(`${monthName} brought in <strong>${f(income)}</strong>.`);
  if (expenses > 0 && income > 0) lines.push(`After <strong>${f(expenses)}</strong> in expenses you kept <strong>${f(profit)}</strong> — a <strong>${margin}%</strong> margin.`);
  if (topCatKey && topCatAmount > 0) lines.push(`Your biggest cost was <strong>${CAT_LABEL[topCatKey] ?? topCatKey}</strong> at <strong>${f(topCatAmount)}</strong>.`);
  if (vsLast !== 0) lines.push(`That's <strong style="color:${vsColor}">${vsSign}${f(vsLast)}</strong> compared to the month before.`);
  const summary = lines.join(" ");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>${monthName} ${year} · Cadi report</title>
</head>
<body style="margin:0;padding:0;background:#eef2ff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#eef2ff;padding:32px 16px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

  <!-- Header -->
  <tr><td style="background:#010a4f;border-radius:16px 16px 0 0;padding:24px 32px;">
    <p style="margin:0;font-size:24px;font-weight:900;color:#fff;letter-spacing:-0.5px;">cadi<span style="color:#4d7fff;">.</span></p>
    <p style="margin:6px 0 0;font-size:12px;color:rgba(153,197,255,0.55);font-weight:600;letter-spacing:0.08em;text-transform:uppercase;">${monthName} ${year} &nbsp;·&nbsp; Monthly report</p>
  </td></tr>

  <!-- Body -->
  <tr><td style="background:#fff;padding:32px 32px 28px;">

    <p style="margin:0 0 24px;font-size:20px;font-weight:800;color:#0d1240;">Hi ${firstName} 👋</p>

    <!-- Hero income -->
    <div style="background:#f4f7ff;border-radius:16px;padding:28px 24px;text-align:center;margin-bottom:24px;border:1px solid #dde5ff;">
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#7a8ec4;">INCOME LAST MONTH</p>
      <p style="margin:0;font-size:52px;font-weight:900;color:#0d1240;letter-spacing:-2px;line-height:1;">${f(income)}</p>
      ${vsLast !== 0 ? `<p style="margin:10px 0 0;font-size:13px;font-weight:700;color:${vsColor};">${vsSign}${f(vsLast)} vs the month before</p>` : ""}
    </div>

    <!-- Three metrics -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr>
        <td width="33%" style="padding-right:5px;">
          <div style="background:#f0fdf4;border-radius:12px;padding:14px 10px;text-align:center;border:1px solid #bbf7d0;">
            <p style="margin:0 0 4px;font-size:9px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#16a34a;">INCOME</p>
            <p style="margin:0;font-size:16px;font-weight:900;color:#0d1240;">${f(income)}</p>
          </div>
        </td>
        <td width="33%" style="padding:0 2.5px;">
          <div style="background:#fffbeb;border-radius:12px;padding:14px 10px;text-align:center;border:1px solid #fde68a;">
            <p style="margin:0 0 4px;font-size:9px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#d97706;">EXPENSES</p>
            <p style="margin:0;font-size:16px;font-weight:900;color:#0d1240;">${f(expenses)}</p>
          </div>
        </td>
        <td width="33%" style="padding-left:5px;">
          <div style="background:#eef2ff;border-radius:12px;padding:14px 10px;text-align:center;border:1px solid #c7d2fe;">
            <p style="margin:0 0 4px;font-size:9px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#4d7fff;">KEPT</p>
            <p style="margin:0;font-size:16px;font-weight:900;color:${profit >= 0 ? "#0d1240" : "#dc2626"};">${f(profit)}</p>
          </div>
        </td>
      </tr>
    </table>

    <!-- Summary paragraph -->
    <div style="background:#f4f7ff;border-left:4px solid #4d7fff;border-radius:0 12px 12px 0;padding:16px 20px;margin-bottom:24px;">
      <p style="margin:0;font-size:14px;color:#2d3a6e;line-height:1.65;">${summary}</p>
    </div>

    ${topCatKey && topCatAmount > 0 ? `
    <!-- Top category -->
    <p style="margin:0 0 10px;font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#7a8ec4;">BIGGEST EXPENSE</p>
    <div style="display:inline-block;background:#f4f7ff;border-radius:100px;padding:9px 18px;margin-bottom:24px;border:1px solid #dde5ff;">
      <span style="font-size:15px;">${CAT_EMOJI[topCatKey] ?? "📦"}</span>
      <span style="font-size:13px;font-weight:700;color:#0d1240;margin-left:8px;">${CAT_LABEL[topCatKey] ?? topCatKey} &mdash; ${f(topCatAmount)}</span>
    </div>
    ` : ""}

    <!-- CTA -->
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr><td align="center" style="padding-top:4px;">
        <a href="${APP_URL}/money" style="display:inline-block;background:#1f48ff;color:#fff;font-size:14px;font-weight:800;text-decoration:none;padding:15px 36px;border-radius:12px;">View full dashboard &rarr;</a>
      </td></tr>
    </table>

  </td></tr>

  <!-- Footer -->
  <tr><td style="background:#010a4f;border-radius:0 0 16px 16px;padding:20px 32px;text-align:center;">
    <p style="margin:0;font-size:12px;color:rgba(153,197,255,0.5);">Sent by <strong style="color:rgba(153,197,255,0.8);">Cadi</strong> &middot; your AI money coach for cleaners</p>
    <p style="margin:8px 0 0;font-size:11px;"><a href="${APP_URL}/settings" style="color:rgba(153,197,255,0.4);text-decoration:underline;">Manage email preferences</a></p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

// ── Main handler ──────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const cronSecret = req.headers.get("x-cron-secret") ?? "";
  if (!CRON_SECRET || cronSecret !== CRON_SECRET) {
    return json({ error: "Unauthorized" }, 401);
  }

  try {
    const body       = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const testUserId = (body as Record<string, string>).userId;

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { start, end, monthName, year } = prevMonthRange();
    const prev = twoMonthsAgoRange();

    let q = sb.from("profiles").select("id, first_name, business_name").eq("email_reports", true);
    if (testUserId) q = q.eq("id", testUserId);
    const { data: profiles, error: pErr } = await q;
    if (pErr) throw pErr;
    if (!profiles?.length) return json({ sent: 0, reason: "no profiles" });

    let sent = 0;
    const errors: string[] = [];

    for (const profile of profiles) {
      try {
        const { data: authData } = await sb.auth.admin.getUserById(profile.id);
        const email = authData?.user?.email;
        if (!email) continue;

        const [bkCurr, meCurr, bkPrev, mePrev] = await Promise.all([
          sb.from("bank_transactions").select("amount, transaction_type, category")
            .eq("user_id", profile.id).eq("is_business", true)
            .gte("date", start).lte("date", end),
          sb.from("money_entries").select("amount, kind, category")
            .eq("owner_id", profile.id)
            .gte("date", start).lte("date", end),
          sb.from("bank_transactions").select("amount, transaction_type")
            .eq("user_id", profile.id).eq("is_business", true).eq("transaction_type", "credit")
            .gte("date", prev.start).lte("date", prev.end),
          sb.from("money_entries").select("amount, kind")
            .eq("owner_id", profile.id).eq("kind", "income")
            .gte("date", prev.start).lte("date", prev.end),
        ]);

        const bk = bkCurr.data ?? [];
        const me = meCurr.data ?? [];

        const income   = bk.filter(r => r.transaction_type === "credit").reduce((s, r) => s + Number(r.amount), 0)
                       + me.filter(r => r.kind === "income").reduce((s, r) => s + Number(r.amount), 0);
        const expenses = bk.filter(r => r.transaction_type === "debit").reduce((s, r) => s + Number(r.amount), 0)
                       + me.filter(r => r.kind === "expense").reduce((s, r) => s + Number(r.amount), 0);
        const prevIncome = (bkPrev.data ?? []).reduce((s, r) => s + Number(r.amount), 0)
                         + (mePrev.data ?? []).reduce((s, r) => s + Number(r.amount), 0);

        if (income === 0 && expenses === 0) continue;

        const catTotals: Record<string, number> = {};
        bk.filter(r => r.transaction_type === "debit" && r.category)
          .forEach(r => { catTotals[r.category] = (catTotals[r.category] ?? 0) + Number(r.amount); });
        me.filter(r => r.kind === "expense" && r.category)
          .forEach(r => { catTotals[r.category] = (catTotals[r.category] ?? 0) + Number(r.amount); });
        const [topCatKey = "", topCatAmount = 0] = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0] ?? [];

        const firstName = profile.first_name
          || (profile.business_name ? profile.business_name.split(" ")[0] : "there");

        const html = buildHtml({
          firstName, monthName, year, income, expenses,
          vsLast: income - prevIncome,
          topCatKey: String(topCatKey),
          topCatAmount: Number(topCatAmount),
        });

        await sendEmail(email, `Your ${monthName} in numbers, ${firstName}`, html);
        sent++;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`monthly-report user ${profile.id}:`, msg);
        errors.push(`${profile.id}: ${msg}`);
      }
    }

    return json({ sent, errors: errors.length ? errors : undefined });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("monthly-report error:", msg);
    return json({ error: msg }, 500);
  }
});
