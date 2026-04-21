// src/pages/MoneyTracker.jsx
// Cadi — Money Tab v2
// AI money coach · bulk expense sorter · P&L by period · open banking ready

import { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { createMoneyEntry, listMoneyEntries } from "../lib/db/moneyDb";
import { listQuotes, updateQuoteStatus } from "../lib/db/quotesDb";
import { useAuth } from "../context/AuthContext";
import { useInvoices } from "../context/InvoiceContext";

// ─── Expense categories ───────────────────────────────────────────────────────
const EXPENSE_CATS = [
  { id: "fuel",      label: "Fuel",       emoji: "⛽", dot: "#f59e0b", pill: "bg-amber-500/15 border-amber-500/25 text-amber-300"  },
  { id: "supplies",  label: "Supplies",   emoji: "🧴", dot: "#3b82f6", pill: "bg-blue-500/15 border-blue-500/25 text-blue-300"    },
  { id: "equipment", label: "Equipment",  emoji: "🔧", dot: "#8b5cf6", pill: "bg-purple-500/15 border-purple-500/25 text-purple-300"},
  { id: "insurance", label: "Insurance",  emoji: "🛡️", dot: "#10b981", pill: "bg-emerald-500/15 border-emerald-500/25 text-emerald-300"},
  { id: "marketing", label: "Marketing",  emoji: "📣", dot: "#f43f5e", pill: "bg-rose-500/15 border-rose-500/25 text-rose-300"    },
  { id: "vehicle",   label: "Vehicle",    emoji: "🚐", dot: "#06b6d4", pill: "bg-cyan-500/15 border-cyan-500/25 text-cyan-300"    },
  { id: "other",     label: "Other",      emoji: "📦", dot: "#6b7280", pill: "bg-gray-500/15 border-gray-500/25 text-gray-300"    },
];

const catById = (id) => EXPENSE_CATS.find(c => c.id === id) ?? EXPENSE_CATS[EXPENSE_CATS.length - 1];

// ─── Demo / default data ──────────────────────────────────────────────────────
const DEFAULT_ACCOUNTS = {
  vatRegistered: false, frsRate: 12, isLimitedCostTrader: false,
  taxRate: 0.20, annualTarget: 0, ytdIncome: 0,
  ytdExpenses: 0, estimatedTaxBill: 0,
  taxReserve: 0, taxReserveTarget: 0,
};

const DEMO_WEEK = [
  { day: "Mon", date: 6,  revenue: 380, jobs: 4, done: true  },
  { day: "Tue", date: 7,  revenue: 460, jobs: 3, done: false, isToday: true },
  { day: "Wed", date: 8,  revenue: 220, jobs: 2, done: false },
  { day: "Thu", date: 9,  revenue: 180, jobs: 2, done: false },
  { day: "Fri", date: 10, revenue: 0,   jobs: 0, done: false },
  { day: "Sat", date: 11, revenue: 0,   jobs: 0, done: false },
  { day: "Sun", date: 12, revenue: 0,   jobs: 0, done: false },
];

// Invoice data comes from InvoiceContext (shared with InvoiceGenerator & AccountsTab)

const DEMO_TRANSACTIONS = [
  { id: "t1", date: "2026-04-07", customer: "Johnson",           amount: 60,  type: "residential", status: "paid" },
  { id: "t2", date: "2026-04-07", customer: "Greenfield Office", amount: 120, type: "commercial",  status: "paid" },
  { id: "t3", date: "2026-04-06", customer: "Davies",            amount: 80,  type: "residential", status: "paid" },
  { id: "t4", date: "2026-04-06", customer: "Miller",            amount: 280, type: "residential", status: "paid" },
  { id: "t5", date: "2026-04-03", customer: "Nexus HQ",          amount: 200, type: "commercial",  status: "paid" },
  { id: "t6", date: "2026-04-03", customer: "Harrington",        amount: 85,  type: "exterior",    status: "unpaid" },
];

const DEMO_EXPENSES = [
  { id: "e1", date: "2026-04-07", label: "Shell fuel stop",    amount: 48.20, category: "fuel"      },
  { id: "e2", date: "2026-04-06", label: "Prochem chemicals",  amount: 112.00, category: "supplies" },
  { id: "e3", date: "2026-04-05", label: "New WFP brush head", amount: 34.99, category: "equipment" },
  { id: "e4", date: "2026-04-04", label: "Van service",        amount: 180.00, category: "vehicle"  },
  { id: "e5", date: "2026-04-02", label: "Google Ads",         amount: 60.00, category: "marketing" },
  { id: "e6", date: "2026-04-01", label: "Public liability ins",amount: 52.00, category: "insurance" },
  { id: "e7", date: "2026-03-28", label: "Fuel",               amount: 41.00, category: "fuel"      },
  { id: "e8", date: "2026-03-26", label: "Cleaning cloths bulk",amount: 29.50, category: "supplies"  },
];

const MONTHLY_DATA = [
  { month: "Nov", income: 4820, expenses: 960,  isCurrent: false },
  { month: "Dec", income: 3640, expenses: 720,  isCurrent: false },
  { month: "Jan", income: 5210, expenses: 1040, isCurrent: false },
  { month: "Feb", income: 4960, expenses: 980,  isCurrent: false },
  { month: "Mar", income: 5380, expenses: 1060, isCurrent: false },
  { month: "Apr", income: 3820, expenses: 557,  isCurrent: true  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt   = (n) => `£${Math.round(n).toLocaleString()}`;
const fmt2  = (n) => `£${Number(n).toFixed(2)}`;
const fmtPct = (n) => `${Math.round(n)}%`;

function toISODate(value) { return new Date(value).toISOString().slice(0, 10); }

function buildLastSixMonths(entries) {
  const now = new Date();
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    months.push({ key, month: d.toLocaleDateString("en-GB", { month: "short" }), income: 0, expenses: 0, isCurrent: i === 0 });
  }
  const byKey = new Map(months.map(m => [m.key, m]));
  for (const entry of entries) {
    const date = new Date(entry.date);
    if (isNaN(date.getTime())) continue;
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const month = byKey.get(key);
    if (!month) continue;
    if (entry.kind === "expense") month.expenses += Number(entry.amount) || 0;
    else month.income += Number(entry.amount) || 0;
  }
  return months;
}

// Build AI insights based on real data
function buildInsights(accounts, monthlyData, expenses) {
  const insights = [];
  const curr     = monthlyData.find(m => m.isCurrent) ?? { income: 0, expenses: 0 };
  const prev     = monthlyData.filter(m => !m.isCurrent).at(-1) ?? { income: 0, expenses: 0 };
  const taxShort = Math.max(accounts.taxReserveTarget - accounts.taxReserve, 0);
  const expRatio = curr.income > 0 ? curr.expenses / curr.income : 0;
  const vsLast   = curr.income - prev.income;
  const fuelSpend = expenses.filter(e => e.category === "fuel").reduce((s,e) => s + Number(e.amount), 0);
  const suppliesSpend = expenses.filter(e => e.category === "supplies").reduce((s,e) => s + Number(e.amount), 0);

  if (taxShort > 500) insights.push({
    id: "tax", type: "warn", emoji: "🏦",
    title: `Tax pot needs a top-up — £${Math.round(taxShort)} short`,
    body:  `You're ${fmtPct((accounts.taxReserve / Math.max(accounts.taxReserveTarget, 1)) * 100)} funded. Set aside ${Math.round((accounts.taxRate || 0.2) * 100)}p from every £1 you collect until you're covered. Next tax bill won't be a surprise.`,
    cta:   "Log a transfer",
  });

  if (vsLast > 200) insights.push({
    id: "growth", type: "win", emoji: "🚀",
    title: `Up ${fmt(vsLast)} vs last month — you're growing`,
    body:  `${curr.month} is already ${fmtPct((curr.income / Math.max(prev.income, 1)) * 100)} of last month. If this holds, you'll hit your annual target ahead of schedule.`,
    cta:   null,
  });

  if (expRatio > 0.22) insights.push({
    id: "expenses", type: "tip", emoji: "💡",
    title: `Expenses are ${fmtPct(expRatio * 100)} of income this month`,
    body:  "Buying cleaning supplies in bulk (Prochem, Premiere) typically saves 18–25% vs retail. A fuel card with cashback can also cut 3–5p per litre.",
    cta:   "See saving tips",
  });

  if (fuelSpend > 120) insights.push({
    id: "fuel", type: "tip", emoji: "⛽",
    title: `Fuel is ${fmt(fuelSpend)} this period — worth optimising`,
    body:  "Route optimisation on your Scheduler tab can cut daily mileage by 15–20%. At today's prices that's easily £30–50/month back in your pocket.",
    cta:   "Open Routes",
  });

  if (suppliesSpend > 0 && suppliesSpend < 80) insights.push({
    id: "bulk", type: "tip", emoji: "🧴",
    title: "You're buying supplies in small batches",
    body:  "Spending under £80/month on supplies usually means buying as-needed at RRP. One bulk order per quarter can save £150–£200/year on the same products.",
    cta:   null,
  });

  if (insights.length === 0) insights.push({
    id: "great", type: "win", emoji: "✅",
    title: "Everything looks healthy this month",
    body:  `Expenses in check, tax reserve on track. Keep logging payments promptly to keep your P&L accurate. ${curr.income > 0 ? `You've retained ${fmtPct(((curr.income - curr.expenses - curr.income * 0.25) / curr.income) * 100)} of gross income this month.` : ""}`,
    cta:   null,
  });

  return insights;
}

// ─── Glassmorphism primitives ─────────────────────────────────────────────────
function GCard({ children, className = "" }) {
  return (
    <div className={`relative rounded-2xl border border-[rgba(153,197,255,0.12)] bg-[rgba(255,255,255,0.04)] overflow-hidden ${className}`}>
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#99c5ff]/50 to-transparent" />
      {children}
    </div>
  );
}

function SectionLabel({ children, className = "" }) {
  return <p className={`text-[10px] font-black tracking-[0.15em] uppercase text-[rgba(153,197,255,0.45)] ${className}`}>{children}</p>;
}

// ─── Open Banking Banner ──────────────────────────────────────────────────────
function OpenBankingBanner() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#1f48ff]/30 bg-gradient-to-r from-[#1f48ff]/10 via-[#1f48ff]/5 to-transparent p-4">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-[#1f48ff]/60 via-[#99c5ff]/40 to-transparent" />
      <div className="flex items-start gap-3 sm:items-center sm:gap-4">
        <div className="shrink-0 w-10 h-10 rounded-xl bg-[#1f48ff]/20 border border-[#1f48ff]/30 flex items-center justify-center text-xl">🏦</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-black text-white">Open banking — coming soon</p>
            <button onClick={() => setDismissed(true)} className="shrink-0 text-[rgba(153,197,255,0.35)] hover:text-white text-lg leading-none -mt-1">×</button>
          </div>
          <p className="text-xs text-[rgba(153,197,255,0.6)] mt-0.5">Auto-import transactions · zero manual entry · instant expense categorisation · real-time cash flow</p>
          <span className="inline-block mt-2 px-3 py-1 rounded-full text-xs font-bold bg-[#1f48ff]/20 border border-[#1f48ff]/40 text-[#99c5ff]">Notify me</span>
        </div>
      </div>
    </div>
  );
}

// ─── Period Hero ─────────────────────────────────────────────────────────────
const PERIODS = ["Day", "Week", "Month", "Quarter"];

function PeriodHero({ period, setPeriod, weekRevenue, monthIncome, monthlyData, accounts }) {
  const curr = monthlyData.find(m => m.isCurrent) ?? { income: 0, expenses: 0 };
  const prev = monthlyData.filter(m => !m.isCurrent).at(-1) ?? { income: 0, expenses: 0 };

  // Quarter = sum of last 3 months
  const qIncome   = monthlyData.slice(-3).reduce((s,m) => s + m.income, 0);
  const qExpenses = monthlyData.slice(-3).reduce((s,m) => s + m.expenses, 0);

  // Dynamic labels
  const todayDate = new Date();
  const todayLabel = todayDate.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  const qNum = Math.floor(todayDate.getMonth() / 3) + 1;
  const qMonthNames = monthlyData.slice(-3).map(m => m.month).join(" · ");

  const heroMap = {
    Day:     { value: curr.income > 0 ? Math.round(curr.income / todayDate.getDate()) : 0, label: "daily average", vs: "", vsUp: true, sub: todayLabel },
    Week:    { value: weekRevenue, label: "earned this week", vs: weekRevenue > 0 ? `${fmt(weekRevenue)} logged` : "No income this week yet", vsUp: weekRevenue > 0, sub: `Week of ${todayDate.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` },
    Month:   { value: curr.income, label: `earned this month`, vs: curr.income > prev.income ? `+${fmt(curr.income - prev.income)} vs ${prev.month}` : prev.income > 0 ? `${fmt(Math.abs(curr.income - prev.income))} vs ${prev.month}` : "", vsUp: curr.income >= prev.income, sub: accounts.annualTarget > 0 ? `${fmtPct(curr.income / Math.max(accounts.annualTarget / 12, 1) * 100)} of monthly target` : "" },
    Quarter: { value: qIncome, label: `Q${qNum} income`, vs: qExpenses > 0 ? `${fmt(qExpenses)} expenses · ${fmtPct((1 - qExpenses / Math.max(qIncome, 1)) * 100)} retained` : "", vsUp: true, sub: qMonthNames },
  };

  const hero = heroMap[period];
  const taxAside = hero.value * (accounts.taxRate || 0.20);

  return (
    <GCard className="p-5">
      {/* Period tabs */}
      <div className="flex gap-1 mb-5 p-1 bg-[rgba(0,0,0,0.2)] rounded-xl w-fit">
        {PERIODS.map(p => (
          <button key={p} onClick={() => setPeriod(p)}
            className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${
              period === p
                ? "bg-[#1f48ff] text-white shadow-lg shadow-[#1f48ff]/30"
                : "text-[rgba(153,197,255,0.5)] hover:text-white"
            }`}>
            {p}
          </button>
        ))}
      </div>

      <div className="flex items-end justify-between gap-4">
        <div>
          <SectionLabel className="mb-2">{hero.label}</SectionLabel>
          <p className="text-5xl font-black text-white leading-none tabular-nums">{fmt(hero.value)}</p>
          <div className="flex items-center gap-3 mt-2.5">
            <span className={`text-sm font-bold ${hero.vsUp ? "text-emerald-400" : "text-red-400"}`}>{hero.vs}</span>
          </div>
          <p className="text-xs text-[rgba(153,197,255,0.45)] mt-1">{hero.sub}</p>
        </div>

        {/* Tax ring */}
        <div className="shrink-0 flex flex-col items-center gap-1.5">
          <div className="relative w-16 h-16">
            <svg viewBox="0 0 64 64" className="w-16 h-16 -rotate-90">
              <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(153,197,255,0.08)" strokeWidth="6" />
              <circle cx="32" cy="32" r="26" fill="none"
                stroke={accounts.taxReserve >= accounts.taxReserveTarget ? "#10b981" : "#f59e0b"}
                strokeWidth="6" strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 26}`}
                strokeDashoffset={`${2 * Math.PI * 26 * (1 - Math.min(accounts.taxReserve / Math.max(accounts.taxReserveTarget, 1), 1))}`}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[11px] font-black text-white">{fmtPct((accounts.taxReserve / Math.max(accounts.taxReserveTarget, 1)) * 100)}</span>
            </div>
          </div>
          <p className="text-[9px] font-bold tracking-wider uppercase text-[rgba(153,197,255,0.35)]">Tax pot</p>
        </div>
      </div>

      {/* Mini income/tax/available strip */}
      {hero.value > 0 && (
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[
            { label: "Gross",     val: fmt(hero.value),       color: "text-white"         },
            { label: "Tax (25%)", val: `-${fmt(taxAside)}`,   color: "text-amber-400"     },
            { label: "Available", val: fmt(hero.value * 0.75),color: "text-emerald-400"   },
          ].map(({ label, val, color }) => (
            <div key={label} className="text-center px-2 py-2 rounded-xl bg-[rgba(153,197,255,0.04)] border border-[rgba(153,197,255,0.08)]">
              <p className="text-[9px] font-bold tracking-wider uppercase text-[rgba(153,197,255,0.35)] mb-0.5">{label}</p>
              <p className={`text-sm font-black tabular-nums ${color}`}>{val}</p>
            </div>
          ))}
        </div>
      )}
    </GCard>
  );
}

// ─── AI Coach Panel ───────────────────────────────────────────────────────────
function AiCoachPanel({ insights, onNavigate }) {
  const [idx, setIdx] = useState(0);
  const tip = insights[idx] ?? insights[0];
  if (!tip) return null;

  const typeStyle = {
    warn: "border-amber-500/25 bg-amber-500/5",
    win:  "border-emerald-500/25 bg-emerald-500/5",
    tip:  "border-[#1f48ff]/25 bg-[#1f48ff]/5",
  };

  return (
    <GCard className="overflow-visible">
      <div className="px-4 py-3 border-b border-[rgba(153,197,255,0.08)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-[#1f48ff] flex items-center justify-center">
            <svg width="12" height="12" viewBox="0 0 28 28" fill="none"><path d="M7 14C7 10.134 10.134 7 14 7C16.209 7 18.18 8.014 19.5 9.6L17.4 11.35C16.56 10.34 15.35 9.7 14 9.7C11.624 9.7 9.7 11.624 9.7 14C9.7 16.376 11.624 18.3 14 18.3C15.35 18.3 16.56 17.66 17.4 16.65L19.5 18.4C18.18 19.986 16.209 21 14 21C10.134 21 7 17.866 7 14Z" fill="white"/></svg>
          </div>
          <SectionLabel>Cadi money coach</SectionLabel>
        </div>
        {insights.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[rgba(153,197,255,0.35)]">{idx + 1} / {insights.length}</span>
            <div className="flex gap-1">
              <button onClick={() => setIdx(i => Math.max(0, i - 1))}
                className="w-6 h-6 rounded-lg border border-[rgba(153,197,255,0.12)] text-[rgba(153,197,255,0.4)] hover:text-white hover:border-[rgba(153,197,255,0.3)] transition-all text-xs flex items-center justify-center">‹</button>
              <button onClick={() => setIdx(i => Math.min(insights.length - 1, i + 1))}
                className="w-6 h-6 rounded-lg border border-[rgba(153,197,255,0.12)] text-[rgba(153,197,255,0.4)] hover:text-white hover:border-[rgba(153,197,255,0.3)] transition-all text-xs flex items-center justify-center">›</button>
            </div>
          </div>
        )}
      </div>

      <div className={`m-4 rounded-xl border p-4 ${typeStyle[tip.type] ?? typeStyle.tip}`}>
        <div className="flex items-start gap-3">
          <span className="text-2xl shrink-0 mt-0.5">{tip.emoji}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-white leading-snug mb-1.5">{tip.title}</p>
            <p className="text-xs text-[rgba(153,197,255,0.65)] leading-relaxed">{tip.body}</p>
            {tip.cta && (
              <button
                onClick={() => {
                  const ctaRoutes = { "Log a transfer": "money", "See saving tips": "inventory", "Open Routes": "routes" };
                  const route = ctaRoutes[tip.cta];
                  if (route) onNavigate?.(route);
                }}
                className="mt-3 px-3 py-1.5 rounded-lg text-xs font-black border border-[rgba(153,197,255,0.2)] text-[rgba(153,197,255,0.7)] hover:text-white hover:border-[rgba(153,197,255,0.4)] transition-all">
                {tip.cta} →
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Dot navigation */}
      {insights.length > 1 && (
        <div className="flex justify-center gap-1.5 pb-4">
          {insights.map((_, i) => (
            <button key={i} onClick={() => setIdx(i)}
              className={`w-1.5 h-1.5 rounded-full transition-all ${i === idx ? "bg-[#1f48ff] w-4" : "bg-[rgba(153,197,255,0.2)]"}`} />
          ))}
        </div>
      )}
    </GCard>
  );
}

// ─── P&L Waterfall ────────────────────────────────────────────────────────────
function PnLWaterfall({ period, monthlyData, weekRevenue, weekExpenses, dayIncome, dayExpenses }) {
  const curr     = monthlyData.find(m => m.isCurrent) ?? { income: 0, expenses: 0 };
  const qMonths  = monthlyData.slice(-3);
  const qIncome  = qMonths.reduce((s,m) => s + m.income, 0);
  const qExp     = qMonths.reduce((s,m) => s + m.expenses, 0);

  const dataMap = {
    Day:     { income: dayIncome || 0,    expenses: dayExpenses || 0,  label: "Today"        },
    Week:    { income: weekRevenue || 0,  expenses: weekExpenses || 0, label: "This week"    },
    Month:   { income: curr.income, expenses: curr.expenses, label: `${curr.month}` },
    Quarter: { income: qIncome, expenses: qExp, label: "This quarter" },
  };

  const d       = dataMap[period] ?? dataMap.Month;
  const taxRate = 0.20; // default — will be overridden by accounts when passed
  const tax     = Math.round(d.income * taxRate);
  const profit  = Math.max(d.income - d.expenses - tax, 0);
  const retPct  = d.income > 0 ? Math.round((profit / d.income) * 100) : 0;
  const maxBar  = d.income;

  const rows = [
    { label: "Gross income",  val: d.income,         bar: 100,                                   color: "bg-[#1f48ff]",        text: "text-[#99c5ff]",    sign: "" },
    { label: "Expenses",      val: d.expenses,        bar: d.income > 0 ? (d.expenses / maxBar) * 100 : 0,  color: "bg-rose-500",         text: "text-rose-400",     sign: "−" },
    { label: "Tax reserve",   val: tax,               bar: d.income > 0 ? (tax / maxBar) * 100 : 0,         color: "bg-amber-400",        text: "text-amber-400",    sign: "−" },
    { label: "Take-home",     val: profit,            bar: d.income > 0 ? (profit / maxBar) * 100 : 0,      color: "bg-emerald-400",      text: "text-emerald-400",  sign: "", bold: true },
  ];

  // 6-month chart
  const maxM = Math.max(...monthlyData.map(m => m.income), 1);

  return (
    <GCard className="overflow-hidden">
      <div className="px-4 pt-4 pb-3 border-b border-[rgba(153,197,255,0.08)] flex items-center justify-between">
        <SectionLabel>P&L breakdown — {d.label}</SectionLabel>
        <span className="text-[10px] font-black text-emerald-400">{retPct}% retained</span>
      </div>

      <div className="p-4 space-y-3">
        {rows.map(({ label, val, bar, color, text, sign, bold }) => (
          <div key={label} className="flex items-center gap-3">
            <span className={`text-[11px] shrink-0 w-24 ${bold ? "font-black text-white" : "font-semibold text-[rgba(153,197,255,0.5)]"}`}>{label}</span>
            <div className="flex-1 h-4 rounded-full bg-[rgba(153,197,255,0.05)] overflow-hidden">
              <div className={`h-full ${color} rounded-full transition-all duration-700`} style={{ width: `${Math.max(bar, 1)}%` }} />
            </div>
            <span className={`text-xs font-black tabular-nums w-20 text-right shrink-0 ${bold ? `${text} text-sm` : text}`}>
              {sign}{fmt(val)}
            </span>
          </div>
        ))}

        {/* Divider */}
        <div className="border-t border-[rgba(153,197,255,0.08)] pt-3">
          <div className="flex justify-between items-center">
            <div className="flex gap-4 flex-wrap">
              {[
                { label: "Expense ratio", val: fmtPct(d.income > 0 ? (d.expenses / d.income) * 100 : 0), good: d.income > 0 && (d.expenses / d.income) < 0.22 },
                { label: "Tax rate",      val: "25%",  good: true },
                { label: "Net margin",    val: fmtPct(retPct), good: retPct >= 55 },
              ].map(({ label, val, good }) => (
                <div key={label} className="text-center">
                  <p className="text-[9px] font-bold tracking-wider uppercase text-[rgba(153,197,255,0.3)] mb-0.5">{label}</p>
                  <p className={`text-sm font-black ${good ? "text-emerald-400" : "text-amber-400"}`}>{val}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 6-month income bars */}
      <div className="border-t border-[rgba(153,197,255,0.08)] px-4 pt-3 pb-4">
        <p className="text-[9px] font-bold tracking-widest uppercase text-[rgba(153,197,255,0.3)] mb-3">6-month income trend</p>
        <div className="flex items-end gap-1.5 h-16">
          {monthlyData.map((m) => {
            const pct = (m.income / maxM) * 100;
            const expPct = m.income > 0 ? (m.expenses / m.income) * 100 : 0;
            return (
              <div key={m.month} className="flex-1 flex flex-col items-center gap-1 group">
                <div className="relative w-full">
                  <div className={`w-full rounded-t-sm transition-all ${m.isCurrent ? "bg-[#1f48ff]" : "bg-[rgba(153,197,255,0.12)] group-hover:bg-[rgba(153,197,255,0.2)]"}`}
                    style={{ height: `${Math.max(pct * 0.55, 3)}px` }} />
                  {/* expense overlay */}
                  <div className="absolute bottom-0 left-0 right-0 bg-rose-500/30 rounded-t-sm"
                    style={{ height: `${Math.max(expPct * 0.55 * (pct/100), 2)}px` }} />
                </div>
                <span className={`text-[9px] font-bold ${m.isCurrent ? "text-[#99c5ff]" : "text-[rgba(153,197,255,0.3)]"}`}>{m.month}</span>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-3 mt-2">
          <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#1f48ff]" /><span className="text-[9px] text-[rgba(153,197,255,0.35)]">Income</span></div>
          <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-rose-500/50" /><span className="text-[9px] text-[rgba(153,197,255,0.35)]">Expenses</span></div>
        </div>
      </div>
    </GCard>
  );
}

// ─── Week Day Grid ────────────────────────────────────────────────────────────
function WeekGrid({ weekData }) {
  const maxRev = Math.max(...weekData.map(d => d.revenue), 1);
  const total  = weekData.reduce((s,d) => s + d.revenue, 0);
  const earned = weekData.filter(d => d.done || d.isToday).reduce((s,d) => s + d.revenue, 0);

  return (
    <GCard className="overflow-hidden">
      <div className="px-4 py-3 border-b border-[rgba(153,197,255,0.08)] flex items-center justify-between">
        <SectionLabel>This week</SectionLabel>
        <span className="text-xs text-[rgba(153,197,255,0.45)]">{fmt(total)} scheduled · {weekData.reduce((s,d)=>s+d.jobs,0)} jobs</span>
      </div>
      <div className="grid grid-cols-7 gap-px bg-[rgba(153,197,255,0.04)] p-px">
        {weekData.map((d) => (
          <div key={d.day} className={`flex flex-col items-center py-3 px-1 text-center rounded-sm ${
            d.isToday ? "bg-[#1f48ff]/20" : d.done ? "bg-emerald-500/5" : "bg-[rgba(255,255,255,0.02)]"
          }`}>
            <p className={`text-[9px] font-black tracking-widest uppercase mb-2 ${d.isToday ? "text-[#99c5ff]" : d.done ? "text-emerald-400" : "text-[rgba(153,197,255,0.3)]"}`}>{d.day}</p>
            <div className="w-full h-10 flex items-end justify-center mb-2">
              {d.revenue > 0
                ? <div className={`w-3 rounded-sm transition-all ${d.isToday ? "bg-[#1f48ff]" : d.done ? "bg-emerald-400" : "bg-[rgba(153,197,255,0.2)]"}`}
                    style={{ height: `${Math.max((d.revenue / maxRev) * 38, 4)}px` }} />
                : <div className="w-3 h-1 rounded-full bg-[rgba(153,197,255,0.1)]" />
              }
            </div>
            <p className={`text-[11px] font-black tabular-nums ${d.isToday ? "text-white" : d.done ? "text-emerald-400" : d.revenue > 0 ? "text-[rgba(153,197,255,0.6)]" : "text-[rgba(153,197,255,0.2)]"}`}>
              {d.revenue > 0 ? fmt(d.revenue) : "—"}
            </p>
            <p className={`text-[9px] mt-0.5 ${d.isToday ? "text-[#99c5ff]" : "text-[rgba(153,197,255,0.3)]"}`}>
              {d.isToday ? "today" : d.done ? "✓" : d.jobs > 0 ? `${d.jobs}j` : "—"}
            </p>
          </div>
        ))}
      </div>
      {/* Progress bar */}
      <div className="px-4 py-3 border-t border-[rgba(153,197,255,0.08)]">
        <div className="flex justify-between text-[10px] text-[rgba(153,197,255,0.4)] mb-1.5">
          <span>Week progress</span>
          <span className="font-black text-white">{fmt(earned)} <span className="font-normal text-[rgba(153,197,255,0.4)]">of {fmt(total)}</span></span>
        </div>
        <div className="h-1.5 bg-[rgba(153,197,255,0.06)] rounded-full overflow-hidden">
          <div className="h-full bg-emerald-400 rounded-full transition-all duration-700"
            style={{ width: `${Math.min((earned / Math.max(total, 1)) * 100, 100)}%` }} />
        </div>
      </div>
    </GCard>
  );
}

// ─── Expense Sorter ───────────────────────────────────────────────────────────
function AddExpenseModal({ onSave, onClose }) {
  const [amount,   setAmount]   = useState("");
  const [label,    setLabel]    = useState("");
  const [category, setCategory] = useState("fuel");
  const [date,     setDate]     = useState(new Date().toISOString().slice(0, 10));

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl border border-[rgba(153,197,255,0.15)] bg-gradient-to-br from-[#010a4f] via-[#05124a] to-[#0d1e78] overflow-hidden shadow-2xl">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#99c5ff]/50 to-transparent" />
        <div className="px-5 py-4 border-b border-[rgba(153,197,255,0.1)] flex items-center justify-between">
          <p className="text-sm font-black text-white">Log an expense</p>
          <button onClick={onClose} className="text-[rgba(153,197,255,0.4)] hover:text-white text-xl leading-none">×</button>
        </div>
        <div className="p-5 space-y-4">
          {/* Amount */}
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-[rgba(153,197,255,0.05)] border border-[rgba(153,197,255,0.12)]">
            <span className="text-lg font-black text-[rgba(153,197,255,0.5)]">£</span>
            <input type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)}
              placeholder="0.00" autoFocus
              className="flex-1 bg-transparent text-2xl font-black text-white placeholder-[rgba(153,197,255,0.15)] focus:outline-none w-0 min-w-0" />
          </div>

          {/* Label */}
          <input type="text" value={label} onChange={e => setLabel(e.target.value)}
            placeholder="What was it? (e.g. Shell fuel stop)"
            className="w-full px-4 py-3 rounded-xl bg-[rgba(153,197,255,0.05)] border border-[rgba(153,197,255,0.12)] text-sm text-white placeholder-[rgba(153,197,255,0.25)] focus:outline-none focus:border-[rgba(153,197,255,0.3)] transition-colors" />

          {/* Category */}
          <div>
            <p className="text-[10px] font-black tracking-widest uppercase text-[rgba(153,197,255,0.4)] mb-2">Category</p>
            <div className="flex flex-wrap gap-1.5">
              {EXPENSE_CATS.map(c => (
                <button key={c.id} onClick={() => setCategory(c.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black border transition-all ${
                    category === c.id ? "bg-[#1f48ff] text-white border-[#1f48ff]" : `${c.pill} border`
                  }`}>
                  {c.emoji} {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Date */}
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl bg-[rgba(153,197,255,0.05)] border border-[rgba(153,197,255,0.12)] text-sm text-[rgba(153,197,255,0.7)] focus:outline-none focus:border-[rgba(153,197,255,0.3)] transition-colors" />

          <div className="flex gap-2">
            <button
              disabled={!parseFloat(amount)}
              onClick={() => { onSave({ amount: parseFloat(amount), label: label || "Expense", category, date }); onClose(); }}
              className={`flex-1 py-3 rounded-xl text-xs font-black transition-all ${parseFloat(amount) ? "bg-[#1f48ff] text-white hover:bg-[#3a5eff]" : "bg-[rgba(153,197,255,0.05)] text-[rgba(153,197,255,0.25)] cursor-not-allowed"}`}>
              Save expense
            </button>
            <button onClick={onClose} className="px-5 py-3 rounded-xl border border-[rgba(153,197,255,0.12)] text-[rgba(153,197,255,0.5)] text-xs font-black hover:text-white hover:border-[rgba(153,197,255,0.3)] transition-all">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ExpenseSorter({ expenses, onAdd, onBulkCategorize, onBulkDelete }) {
  const [catFilter,   setCatFilter]   = useState("all");
  const [sortBy,      setSortBy]      = useState("recent");
  const [selected,    setSelected]    = useState(new Set());
  const [showAdd,     setShowAdd]     = useState(false);
  const [bulkCat,     setBulkCat]     = useState(null);

  const filtered = useMemo(() => {
    let list = catFilter === "all" ? expenses : expenses.filter(e => e.category === catFilter);
    if (sortBy === "amount") list = [...list].sort((a, b) => b.amount - a.amount);
    else if (sortBy === "category") list = [...list].sort((a, b) => a.category.localeCompare(b.category));
    else list = [...list].sort((a, b) => new Date(b.date) - new Date(a.date));
    return list;
  }, [expenses, catFilter, sortBy]);

  const totalFiltered = filtered.reduce((s,e) => s + Number(e.amount), 0);
  const allSelected   = filtered.length > 0 && filtered.every(e => selected.has(e.id));

  // Category spend breakdown
  const catTotals = useMemo(() => {
    const map = {};
    for (const e of expenses) {
      map[e.category] = (map[e.category] ?? 0) + Number(e.amount);
    }
    return map;
  }, [expenses]);

  const topCat = Object.entries(catTotals).sort((a,b) => b[1]-a[1])[0];

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <>
      {showAdd && <AddExpenseModal onSave={onAdd} onClose={() => setShowAdd(false)} />}

      <GCard className="overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-[rgba(153,197,255,0.08)] flex items-center justify-between">
          <div>
            <SectionLabel>Expenses</SectionLabel>
            {topCat && (
              <p className="text-[10px] text-[rgba(153,197,255,0.4)] mt-0.5">
                Biggest: {catById(topCat[0]).emoji} {catById(topCat[0]).label} — {fmt(topCat[1])}
              </p>
            )}
          </div>
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1f48ff]/20 border border-[#1f48ff]/40 text-xs font-black text-white hover:bg-[#1f48ff]/35 transition-colors">
            + Add expense
          </button>
        </div>

        {/* Category spend pills */}
        <div className="px-4 pt-3 pb-2">
          <div className="flex gap-1.5 flex-wrap">
            <button onClick={() => setCatFilter("all")}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-black border transition-all ${catFilter === "all" ? "bg-[#1f48ff] text-white border-[#1f48ff]" : "border-[rgba(153,197,255,0.12)] text-[rgba(153,197,255,0.5)] hover:text-white"}`}>
              All · {fmt(expenses.reduce((s,e)=>s+Number(e.amount),0))}
            </button>
            {EXPENSE_CATS.filter(c => catTotals[c.id]).map(c => (
              <button key={c.id} onClick={() => setCatFilter(c.id)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-black border transition-all ${catFilter === c.id ? "bg-[#1f48ff] text-white border-[#1f48ff]" : `${c.pill} border`}`}>
                {c.emoji} {fmt(catTotals[c.id])}
              </button>
            ))}
          </div>
        </div>

        {/* Sort + bulk actions row */}
        <div className="px-4 py-2 border-y border-[rgba(153,197,255,0.06)] flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            {/* Select all */}
            <button onClick={() => setSelected(allSelected ? new Set() : new Set(filtered.map(e => e.id)))}
              className="w-4 h-4 rounded border border-[rgba(153,197,255,0.2)] flex items-center justify-center text-[8px] text-[rgba(153,197,255,0.5)] hover:border-[rgba(153,197,255,0.4)] transition-all shrink-0">
              {allSelected ? "✓" : ""}
            </button>
            <span className="text-[10px] text-[rgba(153,197,255,0.35)] ml-1">
              {selected.size > 0 ? `${selected.size} selected` : `${filtered.length} items · ${fmt(totalFiltered)}`}
            </span>
          </div>

          {selected.size > 0 ? (
            <div className="flex items-center gap-1.5">
              <select value={bulkCat ?? ""} onChange={e => setBulkCat(e.target.value)}
                className="bg-[rgba(153,197,255,0.06)] border border-[rgba(153,197,255,0.15)] rounded-lg px-2 py-1 text-[10px] text-white focus:outline-none">
                <option value="">Move to…</option>
                {EXPENSE_CATS.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
              </select>
              {bulkCat && (
                <button onClick={() => { onBulkCategorize([...selected], bulkCat); setSelected(new Set()); setBulkCat(null); }}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-black bg-[#1f48ff]/20 border border-[#1f48ff]/40 text-white hover:bg-[#1f48ff]/35 transition-colors">
                  Apply
                </button>
              )}
              <button onClick={() => { onBulkDelete([...selected]); setSelected(new Set()); }}
                className="px-2.5 py-1 rounded-lg text-[10px] font-black bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors">
                Delete
              </button>
            </div>
          ) : (
            <div className="flex gap-1">
              {["recent","amount","category"].map(s => (
                <button key={s} onClick={() => setSortBy(s)}
                  className={`px-2 py-1 rounded-md text-[9px] font-black capitalize transition-all ${sortBy === s ? "bg-[#1f48ff]/20 text-[#99c5ff] border border-[#1f48ff]/30" : "text-[rgba(153,197,255,0.3)] hover:text-[rgba(153,197,255,0.6)]"}`}>
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Expense rows */}
        <div className="divide-y divide-[rgba(153,197,255,0.05)] max-h-80 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-2xl mb-2">📭</p>
              <p className="text-sm font-bold text-[rgba(153,197,255,0.4)]">No expenses yet</p>
              <p className="text-xs text-[rgba(153,197,255,0.25)] mt-0.5">Tap "+ Add expense" to log one</p>
            </div>
          ) : (
            filtered.map(e => {
              const cat = catById(e.category);
              const isSelected = selected.has(e.id);
              return (
                <div key={e.id}
                  className={`flex items-center gap-3 px-4 py-3 transition-colors ${isSelected ? "bg-[#1f48ff]/10" : "hover:bg-[rgba(153,197,255,0.03)]"}`}>
                  {/* Checkbox */}
                  <button onClick={() => toggleSelect(e.id)}
                    className={`w-4 h-4 rounded border flex items-center justify-center text-[8px] transition-all shrink-0 ${
                      isSelected ? "bg-[#1f48ff] border-[#1f48ff] text-white" : "border-[rgba(153,197,255,0.15)] text-[rgba(153,197,255,0.4)]"
                    }`}>
                    {isSelected ? "✓" : ""}
                  </button>
                  {/* Dot */}
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cat.dot }} />
                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-white truncate">{e.label}</p>
                    <p className="text-[10px] text-[rgba(153,197,255,0.4)]">
                      {new Date(e.date).toLocaleDateString("en-GB", { day:"numeric", month:"short" })} · {cat.emoji} {cat.label}
                    </p>
                  </div>
                  <p className="text-sm font-black text-[rgba(153,197,255,0.8)] tabular-nums shrink-0">{fmt2(e.amount)}</p>
                </div>
              );
            })
          )}
        </div>
      </GCard>
    </>
  );
}

// ─── Income Stream ────────────────────────────────────────────────────────────
function IncomeStream({ transactions, invoices, onLogPayment, onReminder }) {
  const TYPE_DOT = { residential: "#10b981", commercial: "#1f48ff", exterior: "#f59e0b" };
  const overdueCount = invoices.filter(i => i.status === "overdue").length;
  const unpaidTotal  = invoices.filter(i => i.status !== "paid").reduce((s,i) => s + i.amount, 0);

  return (
    <GCard className="overflow-hidden">
      <div className="px-4 py-3 border-b border-[rgba(153,197,255,0.08)] flex items-center justify-between">
        <SectionLabel>Income stream</SectionLabel>
        {unpaidTotal > 0 && (
          <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border ${
            overdueCount > 0 ? "bg-red-500/10 border-red-500/25 text-red-400" : "bg-amber-500/10 border-amber-500/25 text-amber-400"
          }`}>
            {overdueCount > 0 ? `🔴 ${overdueCount} overdue` : `⏳ ${fmt(unpaidTotal)} unpaid`}
          </span>
        )}
      </div>

      {/* Unpaid invoices */}
      {invoices.filter(i => i.status !== "paid").length > 0 && (
        <div className="px-4 py-3 border-b border-[rgba(153,197,255,0.06)]">
          <p className="text-[10px] font-black tracking-widest uppercase text-[rgba(153,197,255,0.3)] mb-2">Awaiting payment</p>
          <div className="space-y-1.5">
            {invoices.filter(i => i.status !== "paid").map(inv => (
              <div key={inv.id} className={`flex items-center justify-between px-3 py-2 rounded-xl border ${
                inv.status === "overdue" ? "bg-red-500/5 border-red-500/20" : "bg-[rgba(153,197,255,0.03)] border-[rgba(153,197,255,0.1)]"
              }`}>
                <div>
                  <p className="text-xs font-bold text-white">{inv.customer}</p>
                  <p className="text-[10px] text-[rgba(153,197,255,0.4)]">{inv.status === "overdue" ? "⚠️ Overdue" : "Pending"} · due {new Date(inv.dueDate).toLocaleDateString("en-GB",{day:"numeric",month:"short"})}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black text-white tabular-nums">{fmt2(inv.amount)}</span>
                  <button onClick={() => onReminder(inv)}
                    className="px-2 py-1 rounded-lg text-[10px] font-black bg-[rgba(153,197,255,0.08)] border border-[rgba(153,197,255,0.12)] text-[rgba(153,197,255,0.6)] hover:text-white hover:border-[rgba(153,197,255,0.3)] transition-all">
                    Chase
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent payments */}
      <div className="divide-y divide-[rgba(153,197,255,0.05)]">
        {transactions.slice(0, 6).map(t => (
          <div key={t.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[rgba(153,197,255,0.02)] transition-colors">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: TYPE_DOT[t.type] ?? "#6b7280" }} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white truncate">{t.customer}</p>
              <p className="text-[10px] text-[rgba(153,197,255,0.4)]">
                {new Date(t.date).toLocaleDateString("en-GB",{day:"numeric",month:"short"})} · {t.type}
              </p>
            </div>
            <div className="text-right">
              <p className={`text-sm font-black tabular-nums ${t.status === "paid" ? "text-emerald-400" : "text-red-400"}`}>
                {t.status === "paid" ? "+" : ""}{fmt2(t.amount)}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="px-4 py-3 border-t border-[rgba(153,197,255,0.06)]">
        <button onClick={onLogPayment}
          className="w-full py-3 rounded-xl bg-[#1f48ff]/15 border border-[#1f48ff]/30 text-xs font-black text-white hover:bg-[#1f48ff]/25 transition-colors">
          💷 Log payment received
        </button>
      </div>
    </GCard>
  );
}

// ─── Money Goals & Gamification ───────────────────────────────────────────────
function MoneyGoals({ accounts, weekRevenue, monthlyData, transactions = [], onNavigate }) {
  const curr       = monthlyData.find(m => m.isCurrent) ?? { income: 0 };
  const prev       = monthlyData.filter(m => !m.isCurrent).at(-1) ?? { income: 1 };
  const monthPct   = Math.round((curr.income / Math.max(accounts.annualTarget / 12, 1)) * 100);
  const ytdPct     = Math.round((accounts.ytdIncome / Math.max(accounts.annualTarget, 1)) * 100);
  const remaining  = Math.max(accounts.annualTarget - accounts.ytdIncome, 0);
  const taxMonth   = (() => { const m = new Date().getMonth(); return m >= 3 ? m - 3 + 1 : m + 9 + 1; })();
  const monthsLeft = Math.max(1, 12 - taxMonth);
  const needed     = Math.round(remaining / monthsLeft);
  const beatingMonth = curr.income > prev.income;
  // Streak from transactions this week
  const streak = (() => {
    const today = new Date();
    let count = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      if (transactions.some(t => t.date === dateStr)) count++;
      else if (i > 0) break;
    }
    return count;
  })();

  // If no annual target set, show setup prompt
  if (!accounts.annualTarget || accounts.annualTarget <= 0) {
    return (
      <GCard className="overflow-hidden">
        <div className="px-4 py-3 border-b border-[rgba(153,197,255,0.08)]">
          <SectionLabel>Goals & milestones</SectionLabel>
        </div>
        <div className="p-6 text-center">
          <span className="text-3xl mb-3 block">🎯</span>
          <p className="text-sm font-bold text-white mb-1">Set your annual target</p>
          <p className="text-xs text-[rgba(153,197,255,0.5)] mb-4">Add an income target in Settings to track progress and unlock milestones.</p>
          <button onClick={() => onNavigate?.("settings")} className="px-4 py-2 text-xs font-bold text-white bg-[#1f48ff] rounded-xl hover:bg-[#3a5eff] transition-colors">
            Go to Settings →
          </button>
        </div>
      </GCard>
    );
  }

  return (
    <GCard className="overflow-hidden">
      <div className="px-4 py-3 border-b border-[rgba(153,197,255,0.08)]">
        <SectionLabel>Goals & milestones</SectionLabel>
      </div>
      <div className="p-4 space-y-4">

        {/* Annual target */}
        <div>
          <div className="flex justify-between items-end mb-2">
            <div>
              <p className="text-[10px] font-black tracking-widest uppercase text-[rgba(153,197,255,0.35)] mb-0.5">Annual target {(() => { const now = new Date(); const y = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1; return `${y}/${(y+1).toString().slice(2)}`; })()}</p>
              <div className="flex items-baseline gap-1.5">
                <p className="text-xl font-black text-white tabular-nums">{fmt(accounts.ytdIncome)}</p>
                <p className="text-xs text-[rgba(153,197,255,0.4)]">of {fmt(accounts.annualTarget)}</p>
              </div>
            </div>
            <p className="text-2xl font-black text-[#99c5ff] tabular-nums">{ytdPct}%</p>
          </div>
          <div className="relative h-3 bg-[rgba(153,197,255,0.06)] rounded-full overflow-hidden">
            {[25,50,75].map(q => (
              <div key={q} className="absolute top-0 w-px h-full bg-[rgba(153,197,255,0.1)]" style={{ left: `${q}%` }} />
            ))}
            <div className={`h-full rounded-full transition-all duration-700 ${ytdPct >= 100 ? "bg-emerald-400" : "bg-[#1f48ff]"}`}
              style={{ width: `${Math.min(ytdPct, 100)}%` }} />
          </div>
          <div className="flex justify-between text-[9px] text-[rgba(153,197,255,0.3)] mt-1.5">
            {(() => { const now = new Date(); const y = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1; const q = Math.floor(now.getMonth() / 3) + 1; return <><span>Apr {y}</span><span>Q{q} now</span><span>Mar {y + 1}</span></>; })()}
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-2">
          <div className="px-3 py-3 rounded-xl bg-[rgba(153,197,255,0.04)] border border-[rgba(153,197,255,0.08)]">
            <p className="text-[9px] font-black tracking-widest uppercase text-[rgba(153,197,255,0.3)] mb-1">Still to earn</p>
            <p className="text-lg font-black text-white tabular-nums">{fmt(remaining)}</p>
          </div>
          <div className="px-3 py-3 rounded-xl bg-[rgba(153,197,255,0.04)] border border-[rgba(153,197,255,0.08)]">
            <p className="text-[9px] font-black tracking-widest uppercase text-[rgba(153,197,255,0.3)] mb-1">Needed/month</p>
            <p className={`text-lg font-black tabular-nums ${needed > 5500 ? "text-amber-400" : "text-white"}`}>{fmt(needed)}</p>
          </div>
        </div>

        {/* Fun motivational badges */}
        <div className="space-y-2">
          <p className="text-[9px] font-black tracking-widest uppercase text-[rgba(153,197,255,0.3)]">This period</p>
          <div className="flex flex-wrap gap-2">
            {beatingMonth && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                <span className="text-xs">🔥</span>
                <span className="text-[10px] font-black text-emerald-400">Beating last month</span>
              </div>
            )}
            {monthPct >= 50 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1f48ff]/10 border border-[#1f48ff]/20">
                <span className="text-xs">🎯</span>
                <span className="text-[10px] font-black text-[#99c5ff]">Halfway to target</span>
              </div>
            )}
            {streak > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20">
                <span className="text-xs">⚡</span>
                <span className="text-[10px] font-black text-amber-400">{streak}-day active streak</span>
              </div>
            )}
            {accounts.taxReserve >= accounts.taxReserveTarget && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20">
                <span className="text-xs">🏦</span>
                <span className="text-[10px] font-black text-purple-400">Tax fully covered</span>
              </div>
            )}
          </div>
        </div>

        {/* Beat last month challenge */}
        <div className="px-3 py-3 rounded-xl border border-[rgba(153,197,255,0.1)] bg-[rgba(153,197,255,0.03)]">
          <p className="text-[10px] font-black tracking-widest uppercase text-[rgba(153,197,255,0.35)] mb-2">
            Beat {prev.month ?? "last month"} challenge
          </p>
          <div className="flex items-center gap-2 mb-2">
            <p className="text-xs text-[rgba(153,197,255,0.5)]">Target to beat:</p>
            <p className="text-xs font-black text-white">{fmt(prev.income)}</p>
          </div>
          <div className="h-2 bg-[rgba(153,197,255,0.06)] rounded-full overflow-hidden mb-1.5">
            <div className={`h-full rounded-full transition-all duration-700 ${curr.income >= prev.income ? "bg-emerald-400" : "bg-[#1f48ff]"}`}
              style={{ width: `${Math.min((curr.income / Math.max(prev.income, 1)) * 100, 100)}%` }} />
          </div>
          <p className={`text-[10px] font-black ${curr.income >= prev.income ? "text-emerald-400" : "text-[rgba(153,197,255,0.5)]"}`}>
            {curr.income >= prev.income ? `✓ Achieved! +${fmt(curr.income - prev.income)}` : `${fmt(Math.max(prev.income - curr.income, 0))} to go — you've got this 💪`}
          </p>
        </div>
      </div>
    </GCard>
  );
}

// ─── Log Payment Modal ────────────────────────────────────────────────────────
function LogPaymentModal({ invoices, onConfirm, onClose }) {
  const [selected, setSelected] = useState(invoices[0]?.id ?? "other");
  const [amount,   setAmount]   = useState(invoices[0]?.amount ?? "");
  const inv = invoices.find(i => i.id === selected);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl border border-[rgba(153,197,255,0.15)] bg-gradient-to-br from-[#010a4f] via-[#05124a] to-[#0d1e78] overflow-hidden shadow-2xl">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#99c5ff]/50 to-transparent" />
        <div className="px-5 py-4 border-b border-[rgba(153,197,255,0.1)] flex items-center justify-between">
          <p className="text-sm font-black text-white">Log payment received</p>
          <button onClick={onClose} className="text-[rgba(153,197,255,0.4)] hover:text-white text-xl leading-none">×</button>
        </div>
        <div className="p-5 space-y-4">
          {invoices.length > 0 && (
            <div className="rounded-xl border border-[rgba(153,197,255,0.1)] overflow-hidden divide-y divide-[rgba(153,197,255,0.06)]">
              {invoices.map(inv => (
                <button key={inv.id} onClick={() => { setSelected(inv.id); setAmount(inv.amount); }}
                  className={`w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors ${selected === inv.id ? "bg-[#1f48ff]/15" : "hover:bg-[rgba(153,197,255,0.04)]"}`}>
                  <div>
                    <p className="text-sm font-bold text-white">{inv.customer}</p>
                    <p className="text-[10px] text-[rgba(153,197,255,0.4)]">{inv.type}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-emerald-400 tabular-nums">{fmt2(inv.amount)}</p>
                    <p className={`text-[10px] font-bold ${inv.status==="overdue" ? "text-red-400" : "text-amber-400"}`}>{inv.status}</p>
                  </div>
                </button>
              ))}
              <button onClick={() => { setSelected("other"); setAmount(""); }}
                className={`w-full px-4 py-2.5 text-left text-xs text-[rgba(153,197,255,0.5)] hover:bg-[rgba(153,197,255,0.04)] transition-colors ${selected === "other" ? "bg-[#1f48ff]/10" : ""}`}>
                Other / cash job
              </button>
            </div>
          )}
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-[rgba(153,197,255,0.05)] border border-[rgba(153,197,255,0.12)]">
            <span className="text-lg font-black text-[rgba(153,197,255,0.5)]">£</span>
            <input type="number" value={amount} step="0.01" min="0" onChange={e => setAmount(e.target.value)} placeholder="0.00" autoFocus
              className="flex-1 bg-transparent text-2xl font-black text-white placeholder-[rgba(153,197,255,0.15)] focus:outline-none w-0 min-w-0" />
          </div>
          {parseFloat(amount) > 0 && (
            <div className="rounded-xl border border-[rgba(153,197,255,0.1)] overflow-hidden divide-y divide-[rgba(153,197,255,0.06)] text-sm">
              {[
                { l: "Payment received",    v: fmt2(parseFloat(amount)),             c: "text-emerald-400" },
                { l: "Set aside for tax",   v: `−${fmt2(parseFloat(amount)*0.25)}`,  c: "text-amber-400"  },
                { l: "Available to spend",  v: fmt2(parseFloat(amount)*0.75),        c: "text-white font-black" },
              ].map(({ l, v, c }) => (
                <div key={l} className="flex justify-between px-4 py-2.5">
                  <span className="text-[rgba(153,197,255,0.5)] text-xs">{l}</span>
                  <span className={`text-xs tabular-nums ${c}`}>{v}</span>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <button disabled={!parseFloat(amount)}
              onClick={() => { onConfirm({ invoiceId: selected, amount: parseFloat(amount) }); onClose(); }}
              className={`flex-1 py-3 rounded-xl text-xs font-black transition-all ${parseFloat(amount) ? "bg-[#1f48ff] text-white hover:bg-[#3a5eff]" : "bg-[rgba(153,197,255,0.05)] text-[rgba(153,197,255,0.25)] cursor-not-allowed"}`}>
              ✓ Confirm payment
            </button>
            <button onClick={onClose} className="px-5 py-3 rounded-xl border border-[rgba(153,197,255,0.12)] text-[rgba(153,197,255,0.5)] text-xs font-black hover:text-white transition-all">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Reminder Modal ───────────────────────────────────────────────────────────
function ReminderModal({ invoice, onClose }) {
  const daysOver = invoice ? Math.round((new Date() - new Date(invoice.dueDate)) / 86400000) : 0;
  const [msg, setMsg] = useState(
    invoice ? `Hi, I hope you're well. This is a friendly reminder that your invoice for ${fmt2(invoice.amount)} is ${daysOver > 0 ? `${daysOver} day${daysOver > 1 ? "s" : ""} overdue` : "due shortly"}. Please let me know if you have any questions. Many thanks.` : ""
  );
  const [sent, setSent] = useState(false);

  if (sent) return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-sm rounded-2xl border border-[rgba(153,197,255,0.15)] bg-gradient-to-br from-[#010a4f] via-[#05124a] to-[#0d1e78] p-8 text-center">
        <p className="text-4xl mb-3">✅</p>
        <p className="text-lg font-black text-white mb-1">Reminder sent</p>
        <p className="text-sm text-[rgba(153,197,255,0.5)] mb-6">Logged to {invoice?.customer}'s record.</p>
        <button onClick={onClose} className="px-6 py-2.5 bg-[#1f48ff] text-white text-xs font-black rounded-xl hover:bg-[#3a5eff] transition-colors">Done</button>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl border border-[rgba(153,197,255,0.15)] bg-gradient-to-br from-[#010a4f] via-[#05124a] to-[#0d1e78] overflow-hidden shadow-2xl">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#99c5ff]/50 to-transparent" />
        <div className="px-5 py-4 border-b border-[rgba(153,197,255,0.1)] flex items-center justify-between">
          <p className="text-sm font-black text-white">Send payment reminder</p>
          <button onClick={onClose} className="text-[rgba(153,197,255,0.4)] hover:text-white text-xl leading-none">×</button>
        </div>
        <div className="p-5 space-y-4">
          {invoice && (
            <div className="rounded-xl border border-[rgba(153,197,255,0.1)] divide-y divide-[rgba(153,197,255,0.06)]">
              {[
                { l: "Client", v: invoice.customer, c: "text-white" },
                { l: "Amount", v: fmt2(invoice.amount), c: "text-emerald-400" },
                { l: "Status", v: daysOver > 0 ? `${daysOver} days overdue` : "Pending", c: daysOver > 0 ? "text-red-400" : "text-amber-400" },
              ].map(({ l, v, c }) => (
                <div key={l} className="flex justify-between px-4 py-2.5">
                  <span className="text-xs text-[rgba(153,197,255,0.4)]">{l}</span>
                  <span className={`text-xs font-bold ${c}`}>{v}</span>
                </div>
              ))}
            </div>
          )}
          <textarea value={msg} onChange={e => setMsg(e.target.value)} rows={5}
            className="w-full px-4 py-3 rounded-xl bg-[rgba(153,197,255,0.05)] border border-[rgba(153,197,255,0.12)] text-sm text-[rgba(153,197,255,0.8)] focus:outline-none focus:border-[rgba(153,197,255,0.3)] resize-none transition-colors" />
          <div className="flex gap-2">
            <button onClick={() => setSent(true)} className="flex-1 py-3 rounded-xl bg-[#1f48ff] text-white text-xs font-black hover:bg-[#3a5eff] transition-colors">
              📤 Send reminder
            </button>
            <button onClick={onClose} className="px-5 py-3 rounded-xl border border-[rgba(153,197,255,0.12)] text-[rgba(153,197,255,0.5)] text-xs font-black hover:text-white transition-all">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export default function MoneyTab({ accountsData, schedulerData, onNavigate: onNavigateProp }) {
  const routerNavigate = useNavigate();
  const onNavigate = onNavigateProp || ((tab) => routerNavigate(`/${tab}`));
  const { user } = useAuth();
  const isLive = Boolean(user);
  const accounts = { ...DEFAULT_ACCOUNTS, ...(accountsData ?? {}) };

  // Build dynamic week grid from real dates
  const weekData = useMemo(() => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const dayOfWeek = today.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(today);
    monday.setDate(today.getDate() + mondayOffset);

    const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    return DAYS.map((day, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      const isPast = dateStr < todayStr;

      // Get revenue from scheduler data if available
      let revenue = 0;
      let jobs = 0;
      if (schedulerData?.weekJobs) {
        const dayJobs = schedulerData.weekJobs.filter(j =>
          j.isoDate === dateStr || j.day === i
        );
        revenue = dayJobs.reduce((s, j) => s + (j.revenue || j.price || 0), 0);
        jobs = dayJobs.length || dayJobs.reduce((s, j) => s + (j.jobs || 0), 0);
      }

      return {
        day,
        date: d.getDate(),
        revenue,
        jobs,
        done: isPast && revenue > 0,
        isToday: dateStr === todayStr,
      };
    });
  }, [schedulerData]);

  // ── Invoice state — demo uses shared context; live uses DB-fetched quotes ─────
  const { simpleInvoices, patchInvoice } = useInvoices();
  const [liveInvoices, setLiveInvoices] = useState([]);
  const invoices = isLive ? liveInvoices : simpleInvoices;

  const [transactions, setTransactions] = useState(isLive ? [] : DEMO_TRANSACTIONS);
  const [monthlyData,  setMonthlyData]  = useState(isLive ? buildLastSixMonths([]) : MONTHLY_DATA);
  const [expenses,     setExpenses]     = useState(isLive ? [] : DEMO_EXPENSES);
  const [period,       setPeriod]       = useState("Month");
  const [showPayment,  setShowPayment]  = useState(false);
  const [showReminder, setShowReminder] = useState(false);
  const [reminderInv,  setReminderInv]  = useState(null);

  useEffect(() => {
    if (!isLive) return; // demo mode uses context data — no DB fetch needed
    let mounted = true;
    (async () => {
      try {
        const [quoteRows, moneyRows] = await Promise.all([listQuotes(250), listMoneyEntries(1000)]);
        if (!mounted) return;
        const mappedInvoices = quoteRows.map(q => {
          const created = new Date(q.created_at || Date.now());
          const due = new Date(created); due.setDate(created.getDate() + 7);
          let status = q.status === "paid" ? "paid" : "pending";
          if (status !== "paid" && (Date.now() - due.getTime()) / 86400000 > 0) status = "overdue";
          return { id: q.id, customer: q.job_label || q.payload?.customer || "Customer", amount: Number(q.price) || 0, sentDate: toISODate(created), dueDate: toISODate(due), status, type: q.type || "residential" };
        });
        const incomeRows  = moneyRows.filter(m => m.kind === "income");
        const expenseRows = moneyRows.filter(m => m.kind === "expense");
        const mappedTx    = incomeRows.map(m => ({ id: m.id, date: m.date, customer: m.client || "Payment received", amount: Number(m.amount) || 0, type: "residential", status: "paid" })).sort((a,b) => new Date(b.date)-new Date(a.date));
        const mappedExp   = expenseRows.map(m => ({ id: m.id, date: m.date, label: m.description || m.client || "Expense", amount: Number(m.amount) || 0, category: m.category || "other" }));
        setLiveInvoices(mappedInvoices);
        setTransactions(mappedTx);
        setMonthlyData(buildLastSixMonths(moneyRows));
        setExpenses(mappedExp);
      } catch {
        if (!mounted) return;
        setLiveInvoices([]); setTransactions([]); setMonthlyData(buildLastSixMonths([])); setExpenses([]);
      }
    })();
    return () => { mounted = false; };
  }, [isLive]);

  const weekRevenue    = weekData.reduce((s,d) => s + (d.done || d.isToday ? d.revenue : 0), 0);
  const monthIncome    = monthlyData.find(m => m.isCurrent)?.income ?? 0;
  const unpaidInvoices = invoices.filter(i => i.status !== "paid");
  const insights       = useMemo(() => buildInsights(accounts, monthlyData, expenses), [accounts, monthlyData, expenses]);

  const [saveError, setSaveError] = useState(null);

  const handlePaymentConfirm = async ({ invoiceId, amount }) => {
    setSaveError(null);
    const invoice = invoices.find(i => i.id === invoiceId);
    const today = new Date().toISOString().slice(0, 10);

    try {
      // Save to DB first
      await createMoneyEntry({ quoteId: invoiceId !== "other" ? invoiceId : null, client: invoice?.customer || "Payment received", amount, date: today, method: "bank", kind: "income" });
      if (invoiceId && invoiceId !== "other") await updateQuoteStatus(invoiceId, "paid");

      // Only update UI after DB success
      if (isLive) {
        setLiveInvoices(prev => prev.map(i => i.id === invoiceId ? { ...i, status: "paid" } : i));
      } else {
        patchInvoice(invoiceId, { status: "paid", paidAt: new Date().toISOString() });
      }
      setTransactions(prev => [{ id: `t${Date.now()}`, date: today, customer: invoice?.customer ?? "Payment received", amount, type: invoice?.type ?? "residential", status: "paid" }, ...prev]);
      const curr = monthlyData.find(m => m.isCurrent);
      if (curr) setMonthlyData(prev => prev.map(m => m.isCurrent ? { ...m, income: m.income + amount } : m));
    } catch (err) {
      console.error('Failed to save payment:', err);
      setSaveError('Payment could not be saved. Please try again.');
      setTimeout(() => setSaveError(null), 5000);
    }
  };

  const handleAddExpense = async (exp) => {
    setSaveError(null);
    try {
      await createMoneyEntry({ client: exp.label, amount: exp.amount, date: exp.date, category: exp.category, kind: "expense" });

      // Only update UI after DB success
      const newExp = { id: `e${Date.now()}`, ...exp };
      setExpenses(prev => [newExp, ...prev]);
      const curr = monthlyData.find(m => m.isCurrent);
      if (curr) setMonthlyData(prev => prev.map(m => m.isCurrent ? { ...m, expenses: m.expenses + exp.amount } : m));
    } catch (err) {
      console.error('Failed to save expense:', err);
      setSaveError('Expense could not be saved. Please try again.');
      setTimeout(() => setSaveError(null), 5000);
    }
  };

  const handleBulkCategorize = async (ids, newCat) => {
    setExpenses(prev => prev.map(e => ids.includes(e.id) ? { ...e, category: newCat } : e));
    // TODO: persist category changes to money_entries when update endpoint is added
  };

  const handleBulkDelete = async (ids) => {
    setExpenses(prev => prev.filter(e => !ids.includes(e.id)));
    // TODO: delete from money_entries when delete endpoint is added
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#010a4f] via-[#05124a] to-[#0d1e78] relative">
      {/* Grid texture */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{ backgroundImage: "linear-gradient(rgba(153,197,255,0.5) 1px,transparent 1px),linear-gradient(90deg,rgba(153,197,255,0.5) 1px,transparent 1px)", backgroundSize: "32px 32px" }} />

      <div className="relative max-w-3xl mx-auto px-4 py-6 space-y-4">

        {/* Error toast */}
        {saveError && (
          <div className="px-4 py-3 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center gap-2">
            <span className="text-red-400 text-sm font-bold">!</span>
            <p className="text-xs text-red-300 font-semibold flex-1">{saveError}</p>
          </div>
        )}

        {/* Open banking banner */}
        <OpenBankingBanner />

        {/* Period hero */}
        <PeriodHero
          period={period}
          setPeriod={setPeriod}
          weekRevenue={weekRevenue}
          monthIncome={monthIncome}
          monthlyData={monthlyData}
          accounts={accounts}
        />

        {/* AI coach */}
        <AiCoachPanel insights={insights} onNavigate={onNavigate} />

        {/* P&L waterfall */}
        <PnLWaterfall period={period} monthlyData={monthlyData}
          weekRevenue={weekRevenue}
          weekExpenses={expenses.filter(e => { const d = new Date(); const mon = new Date(d); mon.setDate(d.getDate() - (d.getDay() === 0 ? 6 : d.getDay() - 1)); return e.date >= mon.toISOString().split('T')[0]; }).reduce((s,e) => s + e.amount, 0)}
          dayIncome={transactions.filter(t => t.date === new Date().toISOString().split('T')[0]).reduce((s,t) => s + t.amount, 0)}
          dayExpenses={expenses.filter(e => e.date === new Date().toISOString().split('T')[0]).reduce((s,e) => s + e.amount, 0)}
        />

        {/* Two-col on wider screens */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <WeekGrid weekData={weekData} />
          <MoneyGoals accounts={accounts} weekRevenue={weekRevenue} monthlyData={monthlyData} transactions={transactions} onNavigate={onNavigate} />
        </div>

        {/* Expense sorter */}
        <ExpenseSorter
          expenses={expenses}
          onAdd={handleAddExpense}
          onBulkCategorize={handleBulkCategorize}
          onBulkDelete={handleBulkDelete}
        />

        {/* Income stream */}
        <IncomeStream
          transactions={transactions}
          invoices={invoices}
          onLogPayment={() => setShowPayment(true)}
          onReminder={(inv) => { setReminderInv(inv ?? unpaidInvoices[0] ?? null); setShowReminder(true); }}
        />

        {/* Footer */}
        <div className="flex items-center gap-2 py-2 px-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          <p className="text-[10px] text-[rgba(153,197,255,0.3)]">
            Figures sync with your{" "}
            <button onClick={() => onNavigate?.("accounts")} className="text-[#99c5ff] font-bold hover:text-white underline underline-offset-2 transition-colors">Accounts tab</button>
            {" "}· Open banking connection coming soon
          </p>
        </div>
      </div>

      {/* Modals */}
      {showPayment  && <LogPaymentModal invoices={unpaidInvoices} onConfirm={handlePaymentConfirm} onClose={() => setShowPayment(false)} />}
      {showReminder && <ReminderModal   invoice={reminderInv}    onClose={() => setShowReminder(false)} />}
    </div>
  );
}
