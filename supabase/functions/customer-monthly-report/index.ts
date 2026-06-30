/**
 * supabase/functions/customer-monthly-report/index.ts
 *
 * Cadi — monthly customer-lifecycle digest. Sent on the 1st of each month
 * alongside the finance monthly-report. This one focuses on the people:
 *   • top 5 customers by spend (previous month)
 *   • churn list — lapsed or 90d+ since last visit
 *   • milestones THIS month — birthdays + customer-since anniversaries
 *   • upsell candidates from the in-app suggestion rules
 *   • MoM revenue delta from customer work
 *
 * Triggered by pg_cron with x-cron-secret. Accepts { userId } in the body
 * for a one-off test send. Mirrors the finance report's auth + sending
 * shape so ops only has one pattern to learn.
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

const DAY_MS = 86400000;

function prevMonthRange() {
  const now   = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const last  = new Date(now.getFullYear(), now.getMonth(), 0);
  return {
    start:     first.toISOString().slice(0, 10),
    end:       last.toISOString().slice(0, 10),
    monthName: first.toLocaleDateString("en-GB", { month: "long" }),
    year:      first.getFullYear(),
    monthIdx:  first.getMonth(), // 0-based
  };
}

function twoMonthsAgoRange() {
  const now   = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  const last  = new Date(now.getFullYear(), now.getMonth() - 1, 0);
  return { start: first.toISOString().slice(0, 10), end: last.toISOString().slice(0, 10) };
}

function thisMonthIdx() {
  return new Date().getMonth();
}

async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method:  "POST",
    headers: { "Authorization": `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body:    JSON.stringify({ from: "Cadi <reports@cadi.cleaning>", to, subject, html }),
  });
  if (!res.ok) throw new Error(`Resend: ${await res.text()}`);
}

// ── Customer suggestion mirror (matches src/pages/Customers/helpers.js) ──
// Trimmed to the cases that matter for a digest: VIP, lapsed, upsell-deep,
// crosssell-exterior, regular-conversion. Full rule parity isn't worth the
// code dup — these five capture ~90% of "you should reach out".
type CustomerLite = {
  id: string;
  name: string;
  lifetime_value: number;
  last_job_date: string | null;
  frequency: string | null;
  service_types: string[] | null;
};

function suggestionForCustomer(c: CustomerLite): { type: string; label: string } | null {
  const days = c.last_job_date ? Math.floor((Date.now() - new Date(c.last_job_date).getTime()) / DAY_MS) : null;
  const types = c.service_types || [];

  if (days != null && days > 180) return { type: 'winback', label: `${days}d since last visit — win-back` };
  if (c.lifetime_value > 500)     return { type: 'vip',     label: 'VIP — high lifetime value' };
  if (c.frequency === 'one-off' && days != null && days > 30)
    return { type: 'convert', label: 'Convert one-off to recurring' };
  if (types.includes('regular') && !types.includes('deep'))
    return { type: 'upsell-deep', label: 'Upsell — annual deep clean' };
  if (types.includes('regular') && !types.some((t) => ['exterior','windows','gutter'].includes(t)))
    return { type: 'crosssell-exterior', label: 'Cross-sell — exterior / windows' };
  return null;
}

// ── Email template ──────────────────────────────────────────────────────────

type TopCustomer  = { name: string; value: number };
type ChurnRow     = { name: string; days: number; value: number };
type MilestoneRow = { name: string; events: string[] };
type UpsellRow    = { name: string; label: string; value: number };

function buildHtml(opts: {
  firstName: string; monthName: string; year: number;
  monthRevenue: number; priorRevenue: number; activeCount: number;
  top: TopCustomer[]; churn: ChurnRow[]; milestones: MilestoneRow[]; upsell: UpsellRow[];
}) {
  const { firstName, monthName, year, monthRevenue, priorRevenue, activeCount, top, churn, milestones, upsell } = opts;
  const f      = (n: number) => `£${Math.round(Math.abs(n)).toLocaleString("en-GB")}`;
  const delta  = monthRevenue - priorRevenue;
  const dPct   = priorRevenue > 0 ? Math.round((delta / priorRevenue) * 100) : null;
  const dColor = delta >= 0 ? "#16a34a" : "#dc2626";
  const dSign  = delta >= 0 ? "+" : "-";

  const row = (cells: string) =>
    `<tr><td style="padding:10px 14px;border-bottom:1px solid #eef2ff;">${cells}</td></tr>`;

  const list = <T,>(arr: T[], render: (r: T) => string, empty: string) =>
    arr.length === 0
      ? `<p style="margin:0;padding:12px 0;font-size:13px;color:#7a8ec4;font-style:italic;">${empty}</p>`
      : `<table width="100%" cellpadding="0" cellspacing="0">${arr.map(render).join("")}</table>`;

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${monthName} ${year} · Cadi customers</title></head>
<body style="margin:0;padding:0;background:#eef2ff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#eef2ff;padding:32px 16px;"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

  <tr><td style="background:#010a4f;border-radius:16px 16px 0 0;padding:24px 32px;">
    <p style="margin:0;font-size:24px;font-weight:900;color:#fff;letter-spacing:-0.5px;">cadi<span style="color:#4d7fff;">.</span></p>
    <p style="margin:6px 0 0;font-size:12px;color:rgba(153,197,255,0.55);font-weight:600;letter-spacing:0.08em;text-transform:uppercase;">${monthName} ${year} &nbsp;·&nbsp; Customer pulse</p>
  </td></tr>

  <tr><td style="background:#fff;padding:32px 32px 28px;">

    <p style="margin:0 0 20px;font-size:20px;font-weight:800;color:#0d1240;">Hi ${firstName} 👋</p>
    <p style="margin:0 0 24px;font-size:14px;color:#2d3a6e;line-height:1.6;">Here's how your customers moved through ${monthName}.</p>

    <!-- Hero: month revenue from customers -->
    <div style="background:#f4f7ff;border-radius:16px;padding:24px;text-align:center;margin-bottom:24px;border:1px solid #dde5ff;">
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#7a8ec4;">${monthName.toUpperCase()} CUSTOMER REVENUE</p>
      <p style="margin:0;font-size:48px;font-weight:900;color:#0d1240;letter-spacing:-2px;line-height:1;">${f(monthRevenue)}</p>
      ${delta !== 0 && priorRevenue > 0 ? `<p style="margin:10px 0 0;font-size:13px;font-weight:700;color:${dColor};">${dSign}${f(delta)}${dPct !== null ? ` · ${dSign}${Math.abs(dPct)}%` : ''} vs prior month</p>` : ""}
      <p style="margin:10px 0 0;font-size:12px;color:#7a8ec4;">${activeCount} active customer${activeCount === 1 ? '' : 's'}</p>
    </div>

    <!-- Top 5 -->
    <p style="margin:0 0 8px;font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#7a8ec4;">TOP 5 BY SPEND</p>
    ${list(top, (c) => row(
      `<table width="100%"><tr><td style="font-size:13px;font-weight:700;color:#0d1240;">${c.name}</td><td align="right" style="font-size:13px;font-weight:800;color:#16a34a;">${f(c.value)}</td></tr></table>`
    ), 'No completed jobs last month.')}

    <!-- Milestones this month -->
    <p style="margin:24px 0 8px;font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#7a8ec4;">🎂 MILESTONES THIS MONTH</p>
    ${list(milestones, (m) => row(
      `<table width="100%"><tr><td style="font-size:13px;font-weight:700;color:#0d1240;">${m.name}</td><td align="right" style="font-size:12px;color:#7a8ec4;">${m.events.join(' · ')}</td></tr></table>`
    ), 'No birthdays or anniversaries this month.')}

    <!-- Upsell radar -->
    <p style="margin:24px 0 8px;font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#7a8ec4;">↗ UPSELL RADAR</p>
    ${list(upsell, (u) => row(
      `<table width="100%"><tr><td style="font-size:13px;font-weight:700;color:#0d1240;">${u.name}<br><span style="font-size:11px;font-weight:500;color:#7a8ec4;">${u.label}</span></td><td align="right" style="font-size:12px;color:#16a34a;font-weight:700;">${f(u.value)} LTV</td></tr></table>`
    ), 'No high-priority upsells flagged.')}

    <!-- Churn / win-back -->
    <p style="margin:24px 0 8px;font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#dc2626;">⚠ AT RISK / LAPSED</p>
    ${list(churn, (c) => row(
      `<table width="100%"><tr><td style="font-size:13px;font-weight:700;color:#0d1240;">${c.name}<br><span style="font-size:11px;color:#7a8ec4;">${c.days}d since last visit · ${f(c.value)} LTV</span></td></tr></table>`
    ), 'Everyone\'s been seen recently. 🎉')}

    <!-- CTA -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;">
      <tr><td align="center">
        <a href="${APP_URL}/customers" style="display:inline-block;background:#1f48ff;color:#fff;font-size:14px;font-weight:800;text-decoration:none;padding:15px 36px;border-radius:12px;">Open Customers →</a>
      </td></tr>
    </table>

  </td></tr>

  <tr><td style="background:#010a4f;border-radius:0 0 16px 16px;padding:20px 32px;text-align:center;">
    <p style="margin:0;font-size:12px;color:rgba(153,197,255,0.5);">Sent by <strong style="color:rgba(153,197,255,0.8);">Cadi</strong> · your cleaning business OS</p>
    <p style="margin:8px 0 0;font-size:11px;"><a href="${APP_URL}/settings" style="color:rgba(153,197,255,0.4);text-decoration:underline;">Manage email preferences</a></p>
  </td></tr>

</table></td></tr></table></body></html>`;
}

// ── Main handler ────────────────────────────────────────────────────────────
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

    const { start, end, monthName, year, monthIdx: prevMonthIdx } = prevMonthRange();
    const prior = twoMonthsAgoRange();
    const currentMonthIdx = thisMonthIdx();

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

        // Pull all owned customers (RLS bypassed by service role). Cap at
        // 5000 — big enough for any single owner; protects payload size.
        const { data: customers } = await sb
          .from("customers")
          .select("id, name, lifetime_value, last_job_date, frequency, service_types, status, birthday, customer_since, created_at")
          .eq("owner_id", profile.id)
          .neq("status", "archived")
          .limit(5000);

        const cs = customers ?? [];
        if (cs.length === 0) continue;

        // Month + prior month completed-job revenue (jobs are the source of
        // truth for monthly figures — lifetime_value on customer is cumulative).
        const [{ data: monthJobs }, { data: priorJobs }] = await Promise.all([
          sb.from("jobs").select("customer_id, customer, price, date")
            .eq("owner_id", profile.id).eq("status", "complete")
            .gte("date", start).lte("date", end),
          sb.from("jobs").select("price")
            .eq("owner_id", profile.id).eq("status", "complete")
            .gte("date", prior.start).lte("date", prior.end),
        ]);

        const monthRevenue = (monthJobs ?? []).reduce((s, j) => s + Number(j.price || 0), 0);
        const priorRevenue = (priorJobs ?? []).reduce((s, j) => s + Number(j.price || 0), 0);

        // Top 5 by month spend (preferred), fallback to lifetime if no
        // month-jobs (new owners / quiet month).
        const byCustomer = new Map<string, { name: string; value: number }>();
        for (const j of monthJobs ?? []) {
          const id = j.customer_id || j.customer || 'unknown';
          const name = j.customer || cs.find(c => c.id === j.customer_id)?.name || 'Unknown';
          const cur = byCustomer.get(id) ?? { name, value: 0 };
          cur.value += Number(j.price || 0);
          byCustomer.set(id, cur);
        }
        const top: TopCustomer[] = byCustomer.size > 0
          ? [...byCustomer.values()].sort((a, b) => b.value - a.value).slice(0, 5)
          : cs
              .filter((c) => Number(c.lifetime_value || 0) > 0)
              .sort((a, b) => Number(b.lifetime_value) - Number(a.lifetime_value))
              .slice(0, 5)
              .map((c) => ({ name: c.name, value: Number(c.lifetime_value) }));

        // Churn list — 90d+ since last visit OR explicitly lapsed.
        // Cap at 5 to keep email punchy.
        const churn: ChurnRow[] = cs
          .map((c) => {
            const days = c.last_job_date
              ? Math.floor((Date.now() - new Date(c.last_job_date).getTime()) / DAY_MS)
              : null;
            return { c, days };
          })
          .filter(({ c, days }) => c.status === 'lapsed' || (days != null && days > 90))
          .sort((a, b) => (b.days ?? 0) - (a.days ?? 0))
          .slice(0, 5)
          .map(({ c, days }) => ({ name: c.name, days: days ?? 0, value: Number(c.lifetime_value || 0) }));

        // Milestones THIS month (current calendar month, not prev).
        const milestones: MilestoneRow[] = cs
          .map((c) => {
            const events: string[] = [];
            if (c.birthday && new Date(c.birthday).getMonth() === currentMonthIdx) {
              events.push(`🎂 birthday ${new Date(c.birthday).getDate()}`);
            }
            const since = c.customer_since || c.created_at?.slice(0, 10);
            if (since && new Date(since).getMonth() === currentMonthIdx) {
              const yrs = Math.floor((Date.now() - new Date(since).getTime()) / (DAY_MS * 365.25));
              if (yrs >= 1) events.push(`🎉 ${yrs}yr anniversary`);
            }
            return events.length ? { name: c.name, events } : null;
          })
          .filter((x): x is MilestoneRow => x !== null)
          .slice(0, 5);

        // Upsell radar — top 5 by LTV among those flagged by the suggestion rules.
        const upsell: UpsellRow[] = cs
          .map((c) => {
            const sug = suggestionForCustomer({
              id: c.id, name: c.name,
              lifetime_value: Number(c.lifetime_value || 0),
              last_job_date: c.last_job_date,
              frequency: c.frequency,
              service_types: c.service_types,
            });
            return sug ? { name: c.name, label: sug.label, value: Number(c.lifetime_value || 0), priority: sug.type === 'winback' ? 2 : sug.type === 'vip' ? 1 : 0 } : null;
          })
          .filter((x): x is (UpsellRow & { priority: number }) => x !== null)
          .sort((a, b) => b.priority - a.priority || b.value - a.value)
          .slice(0, 5)
          .map(({ priority: _p, ...rest }) => rest);

        const activeCount = cs.filter((c) => c.status === 'active').length;

        const firstName = profile.first_name
          || (profile.business_name ? profile.business_name.split(" ")[0] : "there");

        // Nothing meaningful to report? Skip — avoid an empty email
        // landing on day one of a new owner's account.
        if (monthRevenue === 0 && top.length === 0 && churn.length === 0 && milestones.length === 0 && upsell.length === 0) continue;

        const html = buildHtml({
          firstName, monthName, year,
          monthRevenue, priorRevenue, activeCount,
          top, churn, milestones, upsell,
        });

        await sendEmail(email, `Your ${monthName} customer pulse, ${firstName}`, html);
        sent++;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`customer-monthly-report user ${profile.id}:`, msg);
        errors.push(`${profile.id}: ${msg}`);
      }
    }

    return json({ sent, errors: errors.length ? errors : undefined });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("customer-monthly-report error:", msg);
    return json({ error: msg }, 500);
  }
});
