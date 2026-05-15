/**
 * supabase/functions/weekly-report/index.ts
 * Cadi — Weekly Cadi Report generation + delivery
 *
 * Triggered by pg_cron every Monday at 08:00 UTC (business timezone approximation).
 * Also callable manually with { action: "generate", businessId? } for testing.
 *
 * Auth: cron invocations use x-cron-secret header.
 *       Manual invocations use bearer token (calls own business only).
 *
 * Tier behaviour:
 *   Free:     basic in-app report only (Haiku, no email)
 *   Pro/Max:  richer in-app report (Sonnet) + email delivery via Resend
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const RESEND_API_KEY    = Deno.env.get("RESEND_API_KEY") ?? "";
const CRON_SECRET       = Deno.env.get("CRON_SECRET") ?? "";
const APP_URL           = "https://app.cadi.cleaning";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

// ── Date helpers ──────────────────────────────────────────────────────────────

function lastMonday(from = new Date()) {
  const d = new Date(from);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Mon = 0 in this calc
  d.setHours(0, 0, 0, 0);
  return d;
}

function prevMonday(from: Date) {
  const d = new Date(from);
  d.setDate(d.getDate() - 7);
  return d;
}

function toDateStr(d: Date) { return d.toISOString().split("T")[0]; }

// ── AI report generation ──────────────────────────────────────────────────────

async function generateReport(
  isPro: boolean,
  params: {
    businessName:      string;
    ownerFirstName:    string;
    weekEnding:        string;
    focusArea:         string | null;
    metrics:           Record<string, unknown>;
    previousMetrics:   Record<string, unknown>;
    transactions:      Array<{ amount: number; category: string; description: string; transaction_date: string }>;
  },
): Promise<{
  headline: string;
  numbers_section: string;
  focus_section: string;
  notes_section: string | null;
  suggestion_section: string;
}> {
  const { businessName, ownerFirstName, weekEnding, focusArea, metrics, previousMetrics } = params;
  const m  = metrics   as Record<string, number>;
  const pm = previousMetrics as Record<string, number>;

  const pct = (cur: number, prev: number) =>
    prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null;

  const jobsDelta     = pct(m.jobs ?? 0, pm.jobs ?? 0);
  const revenueDelta  = pct(m.revenue ?? 0, pm.revenue ?? 0);

  if (!ANTHROPIC_API_KEY) {
    const headline = `${ownerFirstName}, here's your week at ${businessName}.`;
    const numbers  = [
      m.jobs      !== undefined ? `Jobs completed: **${m.jobs}**${jobsDelta !== null ? ` (${jobsDelta >= 0 ? "+" : ""}${jobsDelta}% vs last week)` : ""}` : null,
      m.revenue   !== undefined ? `Revenue invoiced: **£${Math.round(m.revenue).toLocaleString("en-GB")}**${revenueDelta !== null ? ` (${revenueDelta >= 0 ? "+" : ""}${revenueDelta}%)` : ""}` : null,
      m.newCustomers ? `New customers: **${m.newCustomers}**` : null,
    ].filter(Boolean).join("\n");

    return {
      headline,
      numbers_section:    numbers || "A quiet week.",
      focus_section:      focusArea ? `Your focus is: ${focusArea}. Keep going.` : "No focus set yet — the walkthrough will help you pick one.",
      notes_section:      null,
      suggestion_section: "Keep the momentum going this week.",
    };
  }

  const model = isPro ? "claude-sonnet-4-6" : "claude-haiku-4-5";

  const prompt = `You are Cadi, writing a weekly report for ${ownerFirstName} who runs ${businessName}, a UK cleaning business.
Week ending: ${weekEnding}
${focusArea ? `Focus area they chose: ${focusArea}` : "No focus area set yet."}

THIS WEEK:
- Jobs completed: ${m.jobs ?? "unknown"}
- Revenue invoiced: £${Math.round(m.revenue ?? 0).toLocaleString("en-GB")}${revenueDelta !== null ? ` (${revenueDelta >= 0 ? "+" : ""}${revenueDelta}% vs last week)` : ""}
- New customers: ${m.newCustomers ?? 0}
- Invoices chased: ${m.invoicesChased ?? 0}
- Unpaid invoices: £${Math.round(m.unpaidTotal ?? 0).toLocaleString("en-GB")} across ${m.unpaidCount ?? 0}

Write 4 sections in plain text (no markdown headers, just the content):

HEADLINE: One sentence. The single most interesting observation. Specific. Not "you completed X jobs" — find something more interesting. Mention ${ownerFirstName} by name.

NUMBERS: 3-4 bullet points (use **bold** for key numbers). Only include metrics that moved. Skip static ones. Format each as: bullet point text.

FOCUS: 2-3 sentences on progress against their focus area: "${focusArea ?? "not set yet"}". Acknowledge wins, gently note if no progress. If no focus set, encourage them to do the walkthrough.

SUGGESTION: One specific, actionable thought for next week. Just one. Make it concrete.

Return JSON: {"headline": "...", "numbers": "...", "focus": "...", "suggestion": "..."}
Keep total words to 200-250. Warm UK English tone. Like a friend who knows business.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method:  "POST",
    headers: {
      "x-api-key":         ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "Content-Type":      "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 800,
      messages:   [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) throw new Error(`Anthropic error ${res.status}`);
  const aiData = await res.json();
  const text   = aiData.content?.[0]?.text ?? "";

  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      return {
        headline:           parsed.headline ?? "",
        numbers_section:    parsed.numbers  ?? "",
        focus_section:      parsed.focus    ?? "",
        notes_section:      null,
        suggestion_section: parsed.suggestion ?? "",
      };
    }
  } catch { /* fall through */ }

  return {
    headline:           `${ownerFirstName}, here's your week at ${businessName}.`,
    numbers_section:    `Jobs: ${m.jobs ?? 0} | Revenue: £${Math.round(m.revenue ?? 0).toLocaleString("en-GB")}`,
    focus_section:      focusArea ? `Focus: ${focusArea}` : "No focus set yet.",
    notes_section:      null,
    suggestion_section: "Keep going this week.",
  };
}

// ── Email HTML ────────────────────────────────────────────────────────────────

function buildEmailHtml(report: {
  headline: string; numbers_section: string; focus_section: string;
  notes_section: string | null; suggestion_section: string;
}, params: { ownerFirstName: string; businessName: string; weekRange: string; reportId: string }) {
  const { ownerFirstName, weekRange, reportId } = params;
  const viewUrl = `${APP_URL}/reports/${reportId}`;

  const mdToBold = (s: string) => s.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  const bulletToHtml = (s: string) => {
    const lines = s.split("\n").filter(Boolean);
    if (lines.every(l => l.startsWith("-") || l.startsWith("•"))) {
      return `<ul style="margin:0;padding-left:20px">${lines.map(l =>
        `<li style="margin-bottom:6px">${mdToBold(l.replace(/^[-•]\s*/, ""))}</li>`,
      ).join("")}</ul>`;
    }
    return `<p style="margin:0">${mdToBold(s)}</p>`;
  };

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Your weekly report</title></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif">
<div style="max-width:560px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">

  <div style="background:#010b52;padding:24px 32px;display:flex;justify-content:space-between;align-items:center">
    <span style="color:#fff;font-weight:900;font-size:18px;letter-spacing:-0.5px">Cadi</span>
    <span style="color:rgba(153,197,255,0.6);font-size:12px">${weekRange}</span>
  </div>

  <div style="padding:32px">
    <p style="margin:0 0 24px;font-size:22px;font-weight:800;color:#0f172a;line-height:1.3">${report.headline}</p>

    <div style="margin-bottom:24px">
      <p style="margin:0 0 10px;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#94a3b8">This week, in numbers</p>
      ${bulletToHtml(report.numbers_section)}
    </div>

    <div style="background:#f8fafc;border-radius:8px;padding:16px 20px;margin-bottom:24px">
      <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#94a3b8">Your focus</p>
      <p style="margin:0;font-size:14px;color:#334155;line-height:1.6">${mdToBold(report.focus_section)}</p>
    </div>

    ${report.notes_section ? `
    <div style="margin-bottom:24px">
      <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#94a3b8">Something I noticed</p>
      <p style="margin:0;font-size:14px;color:#334155;line-height:1.6">${mdToBold(report.notes_section)}</p>
    </div>` : ""}

    <div style="border-top:1px solid #e2e8f0;padding-top:20px;margin-top:4px">
      <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#94a3b8">One thought for next week</p>
      <p style="margin:0;font-size:14px;color:#334155;line-height:1.6">${mdToBold(report.suggestion_section)}</p>
    </div>
  </div>

  <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:16px 32px;text-align:center">
    <a href="${viewUrl}" style="color:#4f78ff;font-size:13px;text-decoration:none">Read this in Cadi →</a>
    <p style="margin:8px 0 0;font-size:11px;color:#94a3b8">Reply to this email if you want Cadi to focus on something different next week.</p>
  </div>
</div>
</body></html>`;
}

// ── Metrics computation ───────────────────────────────────────────────────────

async function computeMetrics(
  sb: ReturnType<typeof createClient>,
  userId: string,
  businessId: string,
  weekStart: string,
  weekEnd: string,
) {
  const [
    { count: jobs },
    { data: invoiceRows },
    { count: newCustomers },
    { data: txRows },
  ] = await Promise.all([
    sb.from("jobs").select("*", { count: "exact", head: true })
      .eq("owner_id", userId).gte("start_time", weekStart).lt("start_time", weekEnd),
    sb.from("invoices").select("lines, status, due_date")
      .eq("owner_id", userId).gte("created_at", weekStart).lt("created_at", weekEnd),
    sb.from("customers").select("*", { count: "exact", head: true })
      .eq("owner_id", userId).gte("created_at", weekStart).lt("created_at", weekEnd),
    sb.from("transactions").select("amount, category")
      .eq("business_id", businessId).gte("transaction_date", weekStart).lt("transaction_date", weekEnd),
  ]);

  const revenue = (invoiceRows ?? []).reduce((sum: number, inv: { lines: Array<{ rate: number; qty: number }> }) =>
    sum + (inv.lines ?? []).reduce((s: number, l: { rate: number; qty: number }) => s + (l.rate ?? 0) * (l.qty ?? 1), 0), 0);

  const { count: unpaidCount } = await sb
    .from("invoices").select("*", { count: "exact", head: true })
    .eq("owner_id", userId).in("status", ["sent", "viewed", "overdue"]);

  const { data: unpaidRows } = await sb
    .from("invoices").select("lines").eq("owner_id", userId).in("status", ["sent", "viewed", "overdue"]);
  const unpaidTotal = (unpaidRows ?? []).reduce((sum: number, inv: { lines: Array<{ rate: number; qty: number }> }) =>
    sum + (inv.lines ?? []).reduce((s: number, l: { rate: number; qty: number }) => s + (l.rate ?? 0) * (l.qty ?? 1), 0), 0);

  const { data: txBalance } = await sb
    .from("transactions").select("amount").eq("business_id", businessId).limit(1);
  void txBalance;

  const weekIncome = (txRows ?? [])
    .filter((t: { amount: number }) => t.amount > 0)
    .reduce((s: number, t: { amount: number }) => s + t.amount, 0);

  return {
    jobs:         jobs ?? 0,
    revenue,
    newCustomers: newCustomers ?? 0,
    weekIncome,
    unpaidCount:  unpaidCount ?? 0,
    unpaidTotal,
    invoicesChased: 0,
  };
}

// ── Process one business ──────────────────────────────────────────────────────

async function processOneBusiness(
  sb: ReturnType<typeof createClient>,
  business: { id: string; name: string; owner_id: string },
  weekStart: Date,
) {
  const userId     = business.owner_id;
  const businessId = business.id;
  const weekEnd    = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 7);
  const prevStart  = prevMonday(weekStart);

  const weekStartStr = toDateStr(weekStart);
  const weekEndStr   = toDateStr(weekEnd);
  const prevStartStr = toDateStr(prevStart);

  // Skip if report already exists for this week
  const { data: exists } = await sb
    .from("weekly_reports")
    .select("id").eq("business_id", businessId).eq("week_starting", weekStartStr).maybeSingle();
  if (exists) return null;

  const [{ data: profile }, { data: { user: authUser } }] = await Promise.all([
    sb.from("profiles").select("first_name, stripe_subscription_id").eq("id", userId).single(),
    sb.auth.admin.getUserById(userId),
  ]);
  if (!profile) return null;

  const isPro  = !!profile.stripe_subscription_id;
  const email  = authUser?.email ?? null;

  // Get focus area from most recent completed walkthrough
  const { data: walk } = await sb
    .from("walkthroughs").select("chosen_focus_area")
    .eq("business_id", businessId).not("completed_at", "is", null)
    .order("completed_at", { ascending: false }).limit(1).maybeSingle();

  const focusArea = walk?.chosen_focus_area ?? null;

  const [metrics, previousMetrics] = await Promise.all([
    computeMetrics(sb, userId, businessId, weekStartStr, weekEndStr),
    computeMetrics(sb, userId, businessId, prevStartStr, weekStartStr),
  ]);

  const ownerFirstName = profile.first_name ?? business.name ?? "there";
  const weekRange      = `${new Date(weekStart).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${new Date(weekEnd).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;

  const report = await generateReport(isPro, {
    businessName:    business.name,
    ownerFirstName,
    weekEnding:      weekEndStr,
    focusArea,
    metrics,
    previousMetrics,
    transactions:    [],
  });

  const { data: saved, error: saveErr } = await sb.from("weekly_reports").insert({
    business_id:            businessId,
    week_starting:          weekStartStr,
    week_ending:            weekEndStr,
    generated_at:           new Date().toISOString(),
    metrics_snapshot:       metrics,
    previous_week_metrics:  previousMetrics,
    focus_area_at_time:     focusArea,
    headline:               report.headline,
    numbers_section:        report.numbers_section,
    focus_section:          report.focus_section,
    notes_section:          report.notes_section,
    suggestion_section:     report.suggestion_section,
    delivered_in_app:       true,
    delivered_in_app_at:    new Date().toISOString(),
  }).select("id").single();

  if (saveErr || !saved) return null;

  // Send email for Pro users
  if (isPro && email && RESEND_API_KEY) {
    const html       = buildEmailHtml(report, { ownerFirstName, businessName: business.name, weekRange, reportId: saved.id });
    const subjectVariants = [
      `${ownerFirstName}, this week at ${business.name}`,
      `Quick read on your week, ${ownerFirstName}`,
      `Monday morning — your week in numbers`,
    ];
    const subject = subjectVariants[new Date().getDate() % subjectVariants.length];

    await fetch("https://api.resend.com/emails", {
      method:  "POST",
      headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: "Cadi <reports@cadi.cleaning>", to: email, subject, html }),
    }).catch(() => { /* non-fatal */ });

    await sb.from("weekly_reports").update({
      delivered_email: true, delivered_email_at: new Date().toISOString(),
    }).eq("id", saved.id);
  }

  return saved.id;
}

// ── Main handler ──────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const isCron = req.headers.get("x-cron-secret") === CRON_SECRET && CRON_SECRET !== "";

  try {
    const body   = await req.json().catch(() => ({})) as Record<string, unknown>;
    const action = (body.action as string) ?? "generate_all";

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ── generate for calling user (manual / test) ─────────────────────────────
    if (action === "generate" && !isCron) {
      const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
      const { data: { user } } = await sb.auth.getUser(token);
      if (!user) return json({ error: "Unauthorized" }, 401);

      const { data: biz } = await sb
        .from("businesses").select("id, name, owner_user_id").eq("owner_user_id", user.id).single();
      if (!biz) return json({ error: "Business not found" }, 404);

      const weekStart = lastMonday();
      const reportId  = await processOneBusiness(sb, { ...biz, owner_id: biz.owner_user_id }, weekStart);
      return json({ success: true, reportId });
    }

    // ── cron: generate for all eligible businesses ────────────────────────────
    if (isCron || action === "generate_all") {
      const weekStart = lastMonday();

      // Businesses with completed Phase 1 + active bank connection
      const { data: businesses } = await sb
        .from("businesses")
        .select("id, name, owner_user_id")
        .not("owner_user_id", "is", null);

      let generated = 0;
      for (const biz of (businesses ?? [])) {
        // Check bank connection exists
        const { data: conn } = await sb
          .from("bank_connections").select("id")
          .eq("business_id", biz.id).eq("is_active", true).limit(1).maybeSingle();
        if (!conn) continue;

        try {
          const id = await processOneBusiness(sb, { ...biz, owner_id: biz.owner_user_id }, weekStart);
          if (id) generated++;
        } catch (e) {
          console.error(`Weekly report failed for ${biz.id}:`, e);
        }
      }

      return json({ success: true, generated });
    }

    return json({ error: `Unknown action: ${action}` }, 400);

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("weekly-report error:", msg);
    return json({ error: msg }, 500);
  }
});
