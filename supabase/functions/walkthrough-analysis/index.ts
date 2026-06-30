/**
 * supabase/functions/walkthrough-analysis/index.ts
 * Cadi — Pre-computes walkthrough analysis from transactions data
 *
 * Called automatically after truelayer-api sync completes (fire-and-forget).
 * Can also be triggered manually.
 *
 * Actions:
 *   { action: "generate" } → compute + store walkthrough_analysis for calling business
 *   { action: "status" }   → check if analysis is ready
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

async function getUser(req: Request) {
  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  const { data: { user }, error } = await sb.auth.getUser(token);
  if (error || !user) throw new Error("Unauthorized");
  return { user, sb };
}

async function getBusinessId(sb: ReturnType<typeof createClient>, userId: string) {
  const { data } = await sb.from("businesses").select("id, name").eq("owner_user_id", userId).single();
  if (!data) throw new Error("Business not found");
  return data as { id: string; name: string };
}

// ── Data computation helpers ──────────────────────────────────────────────────

function fmt(n: number) { return Math.round(Math.abs(n)).toLocaleString("en-GB"); }

interface Tx {
  id: string;
  amount: number;
  category: string;
  transaction_date: string;
  description: string;
  merchant_name: string | null;
  matched_invoice_id: string | null;
  matched_customer_id: string | null;
  is_business: boolean | null;
}

function computeMoneyIn(txs: Tx[], periodDays: number) {
  const credits = txs.filter(t => t.amount > 0 && t.is_business !== false);
  const total   = credits.reduce((s, t) => s + t.amount, 0);

  // Group by matched customer
  const byCustomer = new Map<string, number>();
  for (const t of credits) {
    const key = t.matched_customer_id ?? t.merchant_name ?? t.description;
    byCustomer.set(key, (byCustomer.get(key) ?? 0) + t.amount);
  }
  const topCustomers = [...byCustomer.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, amount]) => ({ name, amount }));

  // Monthly breakdown
  const byMonth = new Map<string, number>();
  for (const t of credits) {
    const month = t.transaction_date.slice(0, 7);
    byMonth.set(month, (byMonth.get(month) ?? 0) + t.amount);
  }
  const monthlyRevenue = [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, amount]) => ({ month, amount }));

  // Income gaps: months with < 50% of average
  const avg = total / Math.max(monthlyRevenue.length, 1);
  const gaps = monthlyRevenue.filter(m => m.amount < avg * 0.5);

  // Unreconciled credits
  const unreconciled = credits.filter(t => !t.matched_invoice_id && t.amount > 20);

  return {
    total,
    periodDays,
    monthlyAverage: total / Math.max(periodDays / 30, 1),
    topCustomers,
    monthlyRevenue,
    incomeGaps: gaps,
    unreconciledCredits: unreconciled.map(t => ({
      amount:      t.amount,
      description: t.description,
      date:        t.transaction_date,
    })),
  };
}

function computeMoneyOut(txs: Tx[]) {
  const debits = txs.filter(t => t.amount < 0 && t.is_business !== false);
  const total  = debits.reduce((s, t) => s + Math.abs(t.amount), 0);

  const byCategory = new Map<string, number>();
  for (const t of debits) {
    const cat = t.category ?? "uncategorised";
    byCategory.set(cat, (byCategory.get(cat) ?? 0) + Math.abs(t.amount));
  }

  const categories = [...byCategory.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([category, amount]) => ({
      category,
      amount,
      pct: total > 0 ? Math.round((amount / total) * 100) : 0,
    }));

  // Detect potential subscriptions: same merchant, similar amount, monthly pattern
  const merchantAmounts = new Map<string, number[]>();
  for (const t of debits) {
    const key = t.merchant_name ?? t.description;
    if (!merchantAmounts.has(key)) merchantAmounts.set(key, []);
    merchantAmounts.get(key)!.push(Math.abs(t.amount));
  }

  const subscriptions = [...merchantAmounts.entries()]
    .filter(([, amounts]) => amounts.length >= 2 && amounts.every(a => Math.abs(a - amounts[0]) < 2))
    .map(([name, amounts]) => ({ name, monthlyAmount: amounts[0], occurrences: amounts.length }));

  return { total, categories, subscriptions };
}

function computeHoles(
  txs: Tx[],
  moneyOut: ReturnType<typeof computeMoneyOut>,
  openInvoices: Array<{ id: string; customer: { name?: string }; total?: number; due_date?: string }>,
) {
  const holes = [];

  // Unpaid invoices
  for (const inv of openInvoices.slice(0, 5)) {
    const customerName = inv.customer?.name ?? "A customer";
    const daysPast = inv.due_date
      ? Math.floor((Date.now() - new Date(inv.due_date).getTime()) / 86400000)
      : null;
    if (daysPast !== null && daysPast > 0) {
      holes.push({
        type:          "unpaid_invoice",
        title:         `${customerName}'s invoice hasn't been paid`,
        body:          `£${fmt(inv.total ?? 0)} invoice from ${daysPast} days ago is still outstanding.`,
        invoice_id:    inv.id,
        amount:        inv.total ?? 0,
        customer_name: customerName,
        days_overdue:  daysPast,
        confidence:    1.0,
        action_hint:   "chase",
      });
    }
  }

  // Subscription candidates
  for (const sub of moneyOut.subscriptions.slice(0, 3)) {
    holes.push({
      type:           "subscription",
      title:          `£${fmt(sub.monthlyAmount)}/month to ${sub.name}`,
      body:           `Looks like a recurring charge — ${sub.occurrences} times in the period.`,
      merchant:       sub.name,
      monthly_amount: sub.monthlyAmount,
      confidence:     0.8,
      action_hint:    "review",
    });
  }

  // Bank charges — accept both the Money-tab id (`bankfees`) and the legacy/AI id (`bank_charges`).
  const bankCharges = txs.filter(t => t.category === "bank_charges" || t.category === "bankfees");
  if (bankCharges.length > 0) {
    const total = bankCharges.reduce((s, t) => s + Math.abs(t.amount), 0);
    holes.push({
      type:       "bank_charges",
      title:      `£${fmt(total)} in bank charges`,
      body:       `${bankCharges.length} charge${bankCharges.length > 1 ? "s" : ""} this period. Worth a chat with your bank.`,
      amount:     total,
      confidence: 0.9,
      action_hint: "review",
    });
  }

  // Return top 5 by confidence
  return holes.sort((a, b) => b.confidence - a.confidence).slice(0, 5);
}

function computeHealth(moneyIn: ReturnType<typeof computeMoneyIn>, moneyOut: ReturnType<typeof computeMoneyOut>, periodDays: number) {
  const profit     = moneyIn.total - moneyOut.total;
  const monthlyPct = Math.max(periodDays / 30, 1);
  return {
    totalIn:        moneyIn.total,
    totalOut:       moneyOut.total,
    profit,
    monthlyProfit:  profit / monthlyPct,
    marginPct:      moneyIn.total > 0 ? Math.round((profit / moneyIn.total) * 100) : 0,
  };
}

// ── AI wins + watch-outs generation ──────────────────────────────────────────

async function generateInsights(
  moneyIn: ReturnType<typeof computeMoneyIn>,
  moneyOut: ReturnType<typeof computeMoneyOut>,
  holes: ReturnType<typeof computeHoles>,
  health: ReturnType<typeof computeHealth>,
  periodDays: number,
) {
  if (!ANTHROPIC_API_KEY) {
    // Fallback: compute rule-based insights
    return {
      wins: [
        {
          title: "Money is flowing",
          body:  `£${fmt(moneyIn.total)} came in over the last ${periodDays} days.`,
          category: "income",
        },
      ],
      watch_outs: [],
      suggested_focus_areas: [
        { title: "Chase unpaid invoices", body: "Follow up on any outstanding payments.", estimated_saving: null },
        { title: "Review subscriptions", body: "Check recurring charges are still earning their keep.", estimated_saving: null },
        { title: "Supplies to wholesale", body: "Moving to wholesale on supplies typically saves 30-40%.", estimated_saving: null },
      ],
    };
  }

  const prompt = `You are Cadi, a business advisor for a UK cleaning business. Analyse this financial data and generate insights.

Period: last ${periodDays} days
Total income: £${fmt(moneyIn.total)}
Total outgoings: £${fmt(moneyOut.total)}
Monthly profit: £${fmt(health.monthlyProfit)}
Margin: ${health.marginPct}%

Top income sources: ${moneyIn.topCustomers.slice(0, 3).map(c => `${c.name} (£${fmt(c.amount)})`).join(", ")}
Top spending categories: ${moneyOut.categories.slice(0, 5).map(c => `${c.category} £${fmt(c.amount)} (${c.pct}%)`).join(", ")}
Income gaps: ${moneyIn.incomeGaps.length > 0 ? moneyIn.incomeGaps.map(g => g.month).join(", ") : "none"}
Potential subscriptions: ${moneyOut.subscriptions.map(s => `${s.name} £${fmt(s.monthlyAmount)}/month`).join(", ")}

Return JSON with this exact structure:
{
  "wins": [{"title": "string", "body": "string (1-2 sentences, specific numbers)", "category": "string"}],
  "watch_outs": [{"title": "string", "body": "string (framed as question, specific)", "severity": "low|medium|high", "category": "string"}],
  "suggested_focus_areas": [{"title": "string (action-oriented, max 8 words)", "body": "string (1 sentence, specific £ savings if known)", "estimated_saving": number_or_null}]
}

Rules:
- 2-3 wins (find positives first — regulars, good categories, efficiency)
- 1-3 watch_outs (only if confidence is high, frame as questions not accusations)
- 3 suggested_focus_areas (quantified where possible, actionable)
- UK English, £ symbol, Cadi's warm tone
- Do not mention competitors (Xero, QuickBooks etc.)`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method:  "POST",
    headers: {
      "x-api-key":         ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "Content-Type":      "application/json",
    },
    body: JSON.stringify({
      model:      "claude-haiku-4-5",
      max_tokens: 1024,
      messages:   [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) throw new Error(`Anthropic error ${res.status}`);
  const aiData = await res.json();
  const text   = aiData.content?.[0]?.text ?? "";

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
  } catch { /* fall through */ }

  return {
    wins:                  [{ title: "Review complete", body: `Cadi has analysed ${periodDays} days of transactions.`, category: "general" }],
    watch_outs:            [],
    suggested_focus_areas: [
      { title: "Chase unpaid invoices",     body: "Follow up on outstanding payments.", estimated_saving: null },
      { title: "Review subscriptions",      body: "Check recurring charges are still needed.", estimated_saving: null },
      { title: "Supplies to wholesale",     body: "Wholesale prices typically save 30-40% vs retail.", estimated_saving: null },
    ],
  };
}

// ── Main handler ──────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const body   = await req.json() as Record<string, unknown>;
    const action = body.action as string;
    const { user, sb } = await getUser(req);
    const { id: businessId } = await getBusinessId(sb, user.id);

    // ── status ────────────────────────────────────────────────────────────────
    if (action === "status") {
      const today = new Date().toISOString().split("T")[0];

      const { data: analysis } = await sb
        .from("walkthrough_analysis")
        .select("id, generated_at, period_start_date, period_end_date")
        .eq("business_id", businessId)
        .eq("period_end_date", today)
        .maybeSingle();

      return json({ ready: !!analysis, analysis: analysis ?? null });
    }

    // ── generate ──────────────────────────────────────────────────────────────
    if (action === "generate") {
      const today = new Date().toISOString().split("T")[0];

      // Don't re-generate if fresh analysis exists (within 4 hours)
      const { data: existing } = await sb
        .from("walkthrough_analysis")
        .select("id, generated_at")
        .eq("business_id", businessId)
        .eq("period_end_date", today)
        .maybeSingle();

      if (existing) {
        const age = Date.now() - new Date(existing.generated_at).getTime();
        if (age < 4 * 60 * 60 * 1000) return json({ success: true, cached: true });
      }

      // Determine period
      const { data: conn } = await sb
        .from("bank_connections")
        .select("connected_at")
        .eq("business_id", businessId)
        .eq("is_active", true)
        .order("connected_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const { data: profile } = await sb
        .from("profiles")
        .select("stripe_subscription_id")
        .eq("id", user.id)
        .single();
      const isPro    = !!profile?.stripe_subscription_id;
      const daysBack = isPro ? 365 : 60;
      const fromDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000)
        .toISOString().split("T")[0];
      const connectedDate = conn?.connected_at?.split("T")[0] ?? fromDate;
      const periodStart   = connectedDate > fromDate ? connectedDate : fromDate;

      // Fetch transactions for the period
      const { data: txs } = await sb
        .from("transactions")
        .select("id, amount, category, transaction_date, description, merchant_name, matched_invoice_id, matched_customer_id, is_business")
        .eq("business_id", businessId)
        .gte("transaction_date", periodStart)
        .eq("is_hidden", false)
        .order("transaction_date", { ascending: false });

      const allTxs = (txs ?? []) as Tx[];
      const periodDays = Math.round(
        (new Date(today).getTime() - new Date(periodStart).getTime()) / 86400000,
      ) || 1;

      // Fetch open invoices for holes computation
      const { data: openInvoices } = await sb
        .from("invoices")
        .select("id, customer, lines, due_date, status")
        .eq("owner_id", user.id)
        .in("status", ["sent", "viewed", "overdue"])
        .order("due_date", { ascending: true })
        .limit(10);

      const invWithTotals = (openInvoices ?? []).map((inv: {
        id: string;
        customer: { name?: string };
        lines: Array<{ rate: number; qty: number }>;
        due_date?: string;
      }) => ({
        ...inv,
        total: (inv.lines ?? []).reduce((s: number, l: { rate: number; qty: number }) => s + (l.rate ?? 0) * (l.qty ?? 1), 0),
      }));

      // Compute all data sections
      const moneyIn  = computeMoneyIn(allTxs, periodDays);
      const moneyOut = computeMoneyOut(allTxs);
      const holes    = computeHoles(allTxs, moneyOut, invWithTotals);
      const health   = computeHealth(moneyIn, moneyOut, periodDays);
      const insights = await generateInsights(moneyIn, moneyOut, holes, health, periodDays);

      // Upsert analysis
      await sb.from("walkthrough_analysis").upsert({
        business_id:           businessId,
        period_start_date:     periodStart,
        period_end_date:       today,
        money_in_data:         moneyIn,
        money_out_data:        moneyOut,
        holes_data:            holes,
        health_data:           health,
        wins:                  insights.wins,
        watch_outs:            insights.watch_outs,
        suggested_focus_areas: insights.suggested_focus_areas,
        generated_at:          new Date().toISOString(),
      }, { onConflict: "business_id,period_end_date" });

      return json({ success: true });
    }

    return json({ error: `Unknown action: ${action}` }, 400);

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("walkthrough-analysis error:", msg);
    return json({ error: msg }, msg === "Unauthorized" ? 401 : 500);
  }
});
