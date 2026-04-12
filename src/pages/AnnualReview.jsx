// src/components/AnnualReviewTab.jsx
// Cadi — Annual Review + 90-Day Sprint (definitive merged version)
//
// Merges the existing annual review component with the new sprint system.
//
// Six sections (sidebar nav):
//   📊  Numbers      — financial summary, monthly chart, YoY comparison
//   👥  Clients      — client growth, job stats, year highlights
//   🎯  Goals        — goals hit/missed, what to improve, wins
//   ⭐  Self review  — 8-area star rating, overall score
//   🚀  Next year    — income target, data-driven insights, vision, growth tiers
//   🏃  Sprint       — 90-day sprint planner + AI audit
//
// What each source contributed:
//   Existing:  year selector, print/PDF, star ratings, list editors, monthly chart,
//              data-driven insights, three growth tiers, best/worst month cards
//   New:       brand-navy sidebar, hero banner, profit margin ring, top clients,
//              expense breakdown, sprint planner, AI audit, habit tracker
//
// Props:
//   accountsData — live from useAccountsData hook (optional, falls back to demo)
//   onNavigate   — callback to switch to another tab
//
// Usage:
//   import AnnualReviewTab from './components/AnnualReviewTab'
//   <AnnualReviewTab accountsData={accountsData} onNavigate={setActiveTab} />

import { useState, useCallback, useMemo } from "react";
import { useAuth } from "../context/AuthContext";

// ─── Year data ─────────────────────────────────────────────────────────────────
// Multi-year support — users can review any past year
const YEAR_CATALOGUE = {
  "2025/26": {
    income: 54200, prevIncome: 44800,
    expenses: 9840, prevExpenses: 8200,
    jobsCompleted: 412, avgJobValue: 131,
    clientsStart: 18, clientsEnd: 31, clientsLost: 4,
    bestMonth: { name: "September", value: 5800 },
    worstMonth: { name: "January", value: 3600 },
    topClients: [
      { name: "Greenfield Office", revenue: 5400, type: "commercial",  visits: 52 },
      { name: "Park View Flats",   revenue: 4680, type: "commercial",  visits: 48 },
      { name: "Kensington Block",  revenue: 4160, type: "exterior",    visits: 52 },
      { name: "Johnson",           revenue: 3120, type: "residential", visits: 52 },
      { name: "Nexus HQ",         revenue: 2800, type: "commercial",  visits: 12 },
    ],
    expenseBreakdown: [
      { label: "Van & mileage",     amount: 3820, pct: 39 },
      { label: "Cleaning supplies", amount: 2160, pct: 22 },
      { label: "Insurance",         amount: 1440, pct: 15 },
      { label: "Phone & software",  amount: 864,  pct: 9  },
      { label: "Uniform & PPE",     amount: 480,  pct: 5  },
      { label: "Training",          amount: 360,  pct: 4  },
      { label: "Other",             amount: 576,  pct: 6  },
    ],
    monthlyData: [
      { m:"Apr",income:3800,exp:720},{ m:"May",income:4200,exp:750},
      { m:"Jun",income:4600,exp:780},{ m:"Jul",income:5800,exp:900},
      { m:"Aug",income:4900,exp:860},{ m:"Sep",income:4200,exp:800},
      { m:"Oct",income:3600,exp:740},{ m:"Nov",income:4100,exp:760},
      { m:"Dec",income:4800,exp:820},{ m:"Jan",income:5200,exp:860},
      { m:"Feb",income:4600,exp:840},{ m:"Mar",income:4400,exp:810},
    ],
  },
  "2024/25": {
    income: 44800, prevIncome: 32100,
    expenses: 8200, prevExpenses: 6400,
    jobsCompleted: 308, avgJobValue: 145,
    clientsStart: 11, clientsEnd: 18, clientsLost: 2,
    bestMonth: { name: "October", value: 4600 },
    worstMonth: { name: "April",  value: 2600 },
    topClients: [
      { name: "Greenfield Office", revenue: 4320, type: "commercial",  visits: 48 },
      { name: "Johnson",           revenue: 3120, type: "residential", visits: 52 },
      { name: "Kensington Block",  revenue: 2880, type: "exterior",    visits: 36 },
    ],
    expenseBreakdown: [
      { label: "Van & mileage",     amount: 3100, pct: 38 },
      { label: "Cleaning supplies", amount: 1900, pct: 23 },
      { label: "Insurance",         amount: 1280, pct: 16 },
      { label: "Other",             amount: 1920, pct: 23 },
    ],
    monthlyData: [
      { m:"Apr",income:2600,exp:580},{ m:"May",income:3200,exp:630},
      { m:"Jun",income:3600,exp:660},{ m:"Jul",income:4000,exp:700},
      { m:"Aug",income:4200,exp:720},{ m:"Sep",income:4100,exp:710},
      { m:"Oct",income:4600,exp:750},{ m:"Nov",income:4100,exp:710},
      { m:"Dec",income:3800,exp:680},{ m:"Jan",income:3400,exp:650},
      { m:"Feb",income:3600,exp:660},{ m:"Mar",income:3600,exp:660},
    ],
  },
  "2023/24": {
    income: 32100, prevIncome: 21400,
    expenses: 6400, prevExpenses: 4800,
    jobsCompleted: 196, avgJobValue: 163,
    clientsStart: 4,  clientsEnd: 11, clientsLost: 1,
    bestMonth: { name: "November", value: 3400 },
    worstMonth: { name: "April",   value: 1600 },
    topClients: [
      { name: "Johnson",  revenue: 2880, type: "residential", visits: 48 },
      { name: "Williams", revenue: 2160, type: "residential", visits: 36 },
    ],
    expenseBreakdown: [
      { label: "Van & mileage",     amount: 2400, pct: 38 },
      { label: "Cleaning supplies", amount: 1500, pct: 23 },
      { label: "Insurance",         amount: 1100, pct: 17 },
      { label: "Other",             amount: 1400, pct: 22 },
    ],
    monthlyData: [
      { m:"Apr",income:1600,exp:410},{ m:"May",income:2000,exp:450},
      { m:"Jun",income:2400,exp:490},{ m:"Jul",income:2800,exp:530},
      { m:"Aug",income:3000,exp:560},{ m:"Sep",income:3200,exp:580},
      { m:"Oct",income:3100,exp:570},{ m:"Nov",income:3400,exp:600},
      { m:"Dec",income:2800,exp:540},{ m:"Jan",income:2600,exp:520},
      { m:"Feb",income:2400,exp:490},{ m:"Mar",income:2800,exp:540},
    ],
  },
};

const AVAILABLE_YEARS = Object.keys(YEAR_CATALOGUE);

function enrichYear(yr, raw) {
  const profit     = raw.income - raw.expenses;
  const margin     = raw.income > 0 ? (profit / raw.income) * 100 : 0;
  const taxEst     = Math.max(0, (profit - 12570) * 0.20 + Math.max(0, profit - 12570) * 0.09);
  const netAfterTax= profit - taxEst;
  const yoyIncome  = raw.prevIncome > 0 ? ((raw.income - raw.prevIncome) / raw.prevIncome) * 100 : 0;
  const yoyProfit  = raw.prevIncome - raw.prevExpenses > 0
    ? ((profit - (raw.prevIncome - raw.prevExpenses)) / (raw.prevIncome - raw.prevExpenses)) * 100 : 0;
  return { ...raw, yr, profit, margin, taxEst, netAfterTax, yoyIncome, yoyProfit };
}

// ─── Sprint / habit config ─────────────────────────────────────────────────────
const SPRINT_GOAL_TEMPLATES = [
  { category: "Revenue",    icon: "💷", placeholder: "e.g. Hit £6,000 revenue this month"      },
  { category: "Clients",    icon: "👥", placeholder: "e.g. Sign 2 new commercial contracts"    },
  { category: "Operations", icon: "⚙️", placeholder: "e.g. Set up automated invoice reminders" },
  { category: "Personal",   icon: "🎯", placeholder: "e.g. Take every Friday afternoon off"    },
];

const HABITS = [
  { id:"h1", label:"Log all jobs & income same day",   icon:"📋" },
  { id:"h2", label:"Send invoices within 24 hours",    icon:"📤" },
  { id:"h3", label:"Review money dashboard (Monday)",  icon:"💷" },
  { id:"h4", label:"Log mileage after every route",    icon:"🚐" },
  { id:"h5", label:"Follow up 1 lapsed client/week",   icon:"📞" },
  { id:"h6", label:"Review accounts tab (Friday)",     icon:"📊" },
];

// ─── Format helpers ────────────────────────────────────────────────────────────
const fmt  = n => `£${Math.round(Math.abs(+n)).toLocaleString()}`;
const fmtK = n => n >= 1000 ? `£${(n/1000).toFixed(1)}k` : `£${Math.round(n)}`;
const pct  = n => `${Math.round(+n)}%`;
const sign = n => n >= 0 ? `+${Math.round(n)}%` : `${Math.round(n)}%`;

// ─── Shared UI ─────────────────────────────────────────────────────────────────
const Card = ({ children, className = "" }) =>
  <div className={`bg-white border border-gray-200 rounded-sm ${className}`}>{children}</div>;

const SL = ({ children, className = "" }) =>
  <p className={`text-xs font-bold tracking-widest uppercase text-gray-400 ${className}`}>{children}</p>;

function Chip({ children, color = "blue" }) {
  const s = {
    blue:   "bg-blue-50 text-brand-blue border-blue-200",
    green:  "bg-emerald-50 text-emerald-700 border-emerald-200",
    warn:   "bg-amber-50 text-amber-700 border-amber-200",
    red:    "bg-red-50 text-red-700 border-red-200",
    navy:   "bg-brand-navy text-white border-brand-navy",
    sky:    "bg-brand-skyblue/20 text-brand-navy border-brand-skyblue",
    gray:   "bg-gray-100 text-gray-500 border-gray-200",
    orange: "bg-orange-50 text-orange-700 border-orange-200",
    gold:   "bg-yellow-50 text-yellow-700 border-yellow-200",
  };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-bold border ${s[color]}`}>{children}</span>;
}

function Alert({ type = "blue", children }) {
  const s = { warn:"bg-amber-50 border-amber-200 text-amber-800", green:"bg-emerald-50 border-emerald-200 text-emerald-800", blue:"bg-blue-50 border-blue-200 text-blue-800", gold:"bg-yellow-50 border-yellow-200 text-yellow-800", red:"bg-red-50 border-red-200 text-red-800" };
  const icons = { warn:"⚠️", green:"✅", blue:"ℹ️", gold:"💡", red:"🚨" };
  return <div className={`flex gap-3 p-3 border text-sm leading-relaxed rounded-sm ${s[type]}`}><span className="shrink-0 mt-0.5">{icons[type]}</span><div>{children}</div></div>;
}

// Big stat card (like ScalingTab RStat)
function RStat({ label, value, accent = "text-brand-navy", sub, change }) {
  return (
    <div className="bg-gray-50 border border-gray-100 rounded-sm p-4">
      <SL className="mb-1">{label}</SL>
      <p className={`text-2xl font-bold tabular-nums ${accent}`}>{value}</p>
      {sub    && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      {change !== undefined && (
        <p className={`text-xs font-bold mt-1 ${change >= 0 ? "text-emerald-600" : "text-red-500"}`}>
          {change >= 0 ? "↑" : "↓"} {Math.abs(Math.round(change))}% vs last year
        </p>
      )}
    </div>
  );
}

// Star rating row (from existing component)
function StarRow({ label, value, onChange, readonly = false }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
      <p className="text-sm text-gray-700">{label}</p>
      <div className="flex gap-1">
        {[1,2,3,4,5].map(s => (
          <button
            key={s}
            onClick={() => !readonly && onChange?.(s)}
            className={`text-lg leading-none transition-transform ${readonly ? "" : "hover:scale-110 cursor-pointer"}`}
            style={{ fontSize: 18 }}
          >
            <span className={s <= value ? "text-yellow-400" : "text-gray-200"}>★</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// List editor (from existing component, re-skinned)
function ListEditor({ items, onChange, placeholder, color = "blue" }) {
  const [newItem, setNewItem] = useState("");
  const add = () => {
    if (!newItem.trim()) return;
    onChange([...items, newItem.trim()]);
    setNewItem("");
  };
  const remove = i => onChange(items.filter((_, idx) => idx !== i));
  const colorMap = {
    blue:   "bg-blue-50 border-blue-100",
    green:  "bg-emerald-50 border-emerald-100",
    red:    "bg-red-50 border-red-100",
    amber:  "bg-amber-50 border-amber-100",
    gray:   "bg-gray-50 border-gray-100",
  };
  const dotColor = {
    blue:   "text-brand-blue",
    green:  "text-emerald-600",
    red:    "text-red-500",
    amber:  "text-amber-600",
    gray:   "text-gray-400",
  };
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className={`flex items-center gap-3 px-3 py-2.5 border rounded-sm ${colorMap[color]}`}>
          <span className={`text-sm font-bold shrink-0 ${dotColor[color]}`}>✓</span>
          <span className="text-sm text-gray-800 flex-1">{item}</span>
          <button onClick={() => remove(i)} className="text-gray-300 hover:text-red-400 transition-colors text-sm shrink-0">✕</button>
        </div>
      ))}
      <div className="flex gap-2">
        <input
          type="text"
          value={newItem}
          onChange={e => setNewItem(e.target.value)}
          onKeyDown={e => e.key === "Enter" && add()}
          placeholder={placeholder}
          className="flex-1 border border-gray-200 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-brand-blue"
        />
        <button
          onClick={add}
          className="px-4 py-2 bg-brand-navy text-white text-xs font-bold rounded-sm hover:bg-brand-blue transition-colors"
        >
          Add
        </button>
      </div>
    </div>
  );
}

// Monthly bar chart (from existing, re-skinned)
function MonthlyChart({ data, year }) {
  const maxVal = Math.max(...data.map(d => d.income), 1);
  return (
    <div>
      <div className="flex items-center gap-4 text-xs mb-3">
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-brand-blue rounded-sm" /><span className="text-gray-500">Income</span></div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-brand-skyblue/60 rounded-sm" /><span className="text-gray-500">Expenses</span></div>
      </div>
      <div className="flex items-end gap-1.5 h-36 group">
        {data.map(({ m, income, exp }) => (
          <div key={m} className="flex-1 flex flex-col items-center gap-1 relative">
            <div className="hidden group-hover:block absolute bottom-full mb-1 whitespace-nowrap bg-brand-navy text-white text-xs px-2 py-1 rounded-sm z-10 pointer-events-none">
              {m}: {fmt(income)}
            </div>
            <div className="w-full flex items-end gap-0.5 h-32">
              <div className="flex-1 bg-brand-blue rounded-sm transition-all" style={{ height:`${(income/maxVal)*100}%` }} />
              <div className="flex-1 bg-brand-skyblue/50 rounded-sm transition-all" style={{ height:`${(exp/maxVal)*100}%` }} />
            </div>
            <span className="text-xs text-gray-400">{m}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Print / PDF view (from existing, extended with Cadi branding)
function PrintView({ data, year, ratings, goalsHit, goalsMissed, highlights, improvements, onClose }) {
  const avgRating = Object.values(ratings).reduce((a,b)=>a+b,0) / Object.keys(ratings).length;
  return (
    <div className="fixed inset-0 z-50 bg-white overflow-y-auto">
      <div className="max-w-3xl mx-auto p-8">
        <div className="flex items-center justify-between mb-8 print:hidden">
          <button onClick={onClose} className="px-4 py-2 border border-gray-200 text-sm font-bold text-gray-500 rounded-sm hover:border-gray-300 transition-colors">← Back</button>
          <button onClick={() => window.print()} className="flex items-center gap-2 px-5 py-2.5 bg-brand-navy text-white text-sm font-bold rounded-sm hover:bg-brand-blue transition-colors">
            🖨️ Print / Save PDF
          </button>
        </div>

        {/* Header */}
        <div className="bg-brand-navy rounded-sm p-8 text-white mb-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold tracking-widest uppercase text-brand-skyblue mb-4">Cadi Business Review</p>
              <h1 className="text-3xl font-bold">Annual Business Review</h1>
              <p className="text-brand-skyblue text-lg mt-1">Tax year {year}</p>
            </div>
            <div className="text-right">
              <p className="text-brand-skyblue text-sm">Net profit</p>
              <p className="text-4xl font-bold mt-1 tabular-nums">{fmt(data.profit)}</p>
              <p className="text-brand-skyblue text-sm mt-1">{pct(data.margin)} margin</p>
            </div>
          </div>
        </div>

        {/* Key numbers */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            { label:"Total income",  val:fmt(data.income),   border:"border-l-emerald-500" },
            { label:"Total expenses",val:fmt(data.expenses),  border:"border-l-red-400"     },
            { label:"Net profit",    val:fmt(data.profit),   border:"border-l-brand-blue"  },
            { label:"Tax estimate",  val:fmt(data.taxEst),   border:"border-l-amber-400"   },
          ].map(({ label, val, border }) => (
            <div key={label} className={`bg-white border-l-4 ${border} border border-gray-100 p-4 rounded-sm`}>
              <p className="text-xl font-bold text-brand-navy tabular-nums">{val}</p>
              <p className="text-xs text-gray-400 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Monthly chart */}
        <div className="bg-white border border-gray-100 rounded-sm p-5 mb-6">
          <h3 className="font-bold text-brand-navy mb-4">Monthly income vs expenses</h3>
          <MonthlyChart data={data.monthlyData} year={year} />
        </div>

        {/* Client stats */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            { label:"Clients at start",  val:data.clientsStart },
            { label:"Clients at end",    val:data.clientsEnd   },
            { label:"Net growth",        val:`+${data.clientsEnd-data.clientsStart}` },
            { label:"Jobs completed",    val:data.jobsCompleted },
          ].map(({ label, val }) => (
            <div key={label} className="bg-gray-50 rounded-sm p-4 text-center">
              <p className="text-2xl font-bold text-brand-navy">{val}</p>
              <p className="text-xs text-gray-400 mt-1">{label}</p>
            </div>
          ))}
        </div>

        {/* Goals */}
        <div className="grid grid-cols-2 gap-5 mb-6">
          <div className="bg-white border border-gray-100 rounded-sm p-5">
            <h3 className="font-bold text-brand-navy mb-3 flex items-center gap-2"><span className="text-emerald-500">✓</span> Goals hit</h3>
            {goalsHit.map((g,i) => <div key={i} className="text-sm text-gray-700 mb-1.5 flex gap-2"><span className="text-emerald-500 shrink-0">✓</span>{g}</div>)}
          </div>
          <div className="bg-white border border-gray-100 rounded-sm p-5">
            <h3 className="font-bold text-brand-navy mb-3 flex items-center gap-2"><span className="text-red-400">✕</span> Goals missed</h3>
            {goalsMissed.map((g,i) => <div key={i} className="text-sm text-gray-700 mb-1.5 flex gap-2"><span className="text-red-400 shrink-0">✕</span>{g}</div>)}
          </div>
        </div>

        {/* Self assessment */}
        <div className="bg-white border border-gray-100 rounded-sm p-5 mb-6">
          <h3 className="font-bold text-brand-navy mb-4">Self assessment</h3>
          <div className="grid grid-cols-2 gap-x-8">
            {Object.entries(ratings).map(([label, value]) => (
              <StarRow key={label} label={label} value={value} readonly />
            ))}
          </div>
          <div className="mt-4 text-center border-t border-gray-100 pt-4">
            <p className="text-xs text-gray-400 mb-1">Overall score</p>
            <p className="text-3xl font-bold text-brand-navy">{avgRating.toFixed(1)} / 5.0</p>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-brand-navy rounded-sm p-5 text-white text-center">
          <p className="font-bold text-lg mb-1">Looking ahead to next year</p>
          <p className="text-brand-skyblue/80 text-sm">
            {fmt(data.profit)} profit · {data.clientsEnd} active clients · {pct(data.margin)} margin.
            Focus on retention, pricing confidence, and one new service.
          </p>
        </div>
        <p className="text-xs text-gray-400 text-center mt-4">Generated by Cadi · {new Date().toLocaleDateString("en-GB")}</p>
      </div>
    </div>
  );
}

// ─── SECTION: Numbers ──────────────────────────────────────────────────────────
function NumbersSection({ data }) {
  return (
    <div className="space-y-5">
      {/* Hero */}
      <div className="bg-brand-navy rounded-sm p-6 text-white">
        <p className="text-xs font-bold tracking-widest uppercase text-brand-skyblue mb-3">Tax year {data.yr}</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label:"Total income",  val:fmt(data.income),   sub: sign(data.yoyIncome)+" vs last year" },
            { label:"Net profit",    val:fmt(data.profit),   sub: pct(data.margin)+" margin"           },
            { label:"Tax estimate",  val:fmt(data.taxEst),   sub: "Income tax + Class 4 NI"            },
            { label:"Take-home",     val:fmt(data.netAfterTax), sub: sign(data.yoyProfit)+" vs last year" },
          ].map(({ label, val, sub }) => (
            <div key={label} className="bg-white/10 rounded-sm p-4">
              <p className="text-xs text-brand-skyblue font-bold uppercase tracking-widest mb-1">{label}</p>
              <p className="text-2xl font-bold text-white tabular-nums">{val}</p>
              <p className="text-xs text-brand-skyblue/70 mt-0.5">{sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <RStat label="Gross income"    value={fmt(data.income)}        accent="text-brand-navy"   change={data.yoyIncome} sub={`Target achieved: ${data.income>=54000?"✓ Yes":"Missed"}`} />
        <RStat label="Net profit"      value={fmt(data.profit)}        accent="text-emerald-600"  change={data.yoyProfit} />
        <RStat label="Profit margin"   value={pct(data.margin)}        accent={data.margin>=70?"text-emerald-600":"text-amber-600"} sub="Industry avg: 65%" />
        <RStat label="Total expenses"  value={fmt(data.expenses)}      accent="text-red-500"      sub={`${pct((data.expenses/data.income)*100)} of income`} />
        <RStat label="Tax estimate"    value={fmt(data.taxEst)}        accent="text-amber-600"    sub="Guide only — ask your accountant" />
        <RStat label="Net take-home"   value={fmt(data.netAfterTax)}   accent="text-brand-navy"   sub="After all estimated tax" />
      </div>

      {/* Monthly chart */}
      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <SL>Monthly income vs expenses</SL>
          <div className="flex gap-4 text-xs text-gray-400">
            <span>Peak: <strong className="text-brand-navy">{fmt(data.bestMonth.value)}</strong> ({data.bestMonth.name})</span>
            <span>Avg: <strong className="text-brand-navy">{fmt(data.income/12)}</strong></span>
          </div>
        </div>
        <div className="p-5">
          <MonthlyChart data={data.monthlyData} year={data.yr} />
        </div>
        <div className="grid grid-cols-3 gap-px bg-gray-200 border-t border-gray-200">
          {[
            { label:"This year",  val:fmt(data.income),      accent:"text-brand-navy" },
            { label:"Last year",  val:fmt(data.prevIncome),  accent:"text-gray-400"   },
            { label:"Growth",     val:`+${fmt(data.income-data.prevIncome)}`, accent:"text-emerald-600" },
          ].map(({ label, val, accent }) => (
            <div key={label} className="bg-white px-4 py-3 text-center">
              <SL className="mb-0.5">{label}</SL>
              <p className={`text-sm font-bold tabular-nums ${accent}`}>{val}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Best / worst month */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-emerald-50 border border-emerald-200 rounded-sm p-5">
          <SL className="text-emerald-600 mb-1">Best month</SL>
          <p className="text-xl font-bold text-emerald-800">{data.bestMonth.name}</p>
          <p className="text-2xl font-bold text-emerald-600 tabular-nums mt-1">{fmt(data.bestMonth.value)}</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-sm p-5">
          <SL className="text-red-500 mb-1">Quietest month</SL>
          <p className="text-xl font-bold text-red-700">{data.worstMonth.name}</p>
          <p className="text-2xl font-bold text-red-500 tabular-nums mt-1">{fmt(data.worstMonth.value)}</p>
        </div>
      </div>

      {/* Expense breakdown */}
      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <SL>Expenses — {fmt(data.expenses)} total</SL>
          <Chip color="green">SA103 mapped</Chip>
        </div>
        <div className="divide-y divide-gray-100">
          {data.expenseBreakdown.map(({ label, amount, pct: p }) => (
            <div key={label} className="flex items-center gap-3 px-4 py-2.5">
              <span className="text-xs text-gray-500 w-36 shrink-0">{label}</span>
              <div className="flex-1 h-3 bg-gray-100 rounded-sm overflow-hidden">
                <div className="h-full bg-brand-blue/50 rounded-sm" style={{ width:`${p}%` }} />
              </div>
              <span className="text-xs font-mono font-semibold text-gray-700 w-12 text-right">{fmt(amount)}</span>
              <span className="text-xs text-gray-400 w-8 text-right">{p}%</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Margin insight ring */}
      <Card className="p-5 border-l-4 border-l-brand-blue">
        <div className="flex items-start gap-5">
          <div className="relative w-20 h-20 shrink-0">
            <svg viewBox="0 0 80 80" className="w-20 h-20 -rotate-90">
              <circle cx="40" cy="40" r="32" fill="none" stroke="#e5e7eb" strokeWidth="7" />
              <circle cx="40" cy="40" r="32" fill="none"
                stroke={data.margin >= 65 ? "#10b981" : "#f59e0b"}
                strokeWidth="7" strokeLinecap="round"
                strokeDasharray={`${2*Math.PI*32}`}
                strokeDashoffset={`${2*Math.PI*32*(1-Math.min(data.margin/100,1))}`} />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm font-bold text-brand-navy">{Math.round(data.margin)}%</span>
            </div>
          </div>
          <div>
            <SL className="mb-1">Profit margin analysis</SL>
            <p className="text-lg font-bold text-brand-navy">{pct(data.margin)} net profit margin</p>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">
              Industry average for cleaning businesses is <strong>55–65%</strong>.
              Your {Math.round(data.margin)}% margin puts you <strong className={data.margin>=65?"text-emerald-600":"text-amber-600"}>{data.margin>=65?"above":"at"} industry average</strong>.
              Every 1% margin improvement at your revenue is worth <strong>{fmt(data.income*0.01)}/year</strong>.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ─── SECTION: Clients ──────────────────────────────────────────────────────────
function ClientsSection({ data, highlights, setHighlights }) {
  const TYPE_DOT = { residential:"bg-emerald-500", commercial:"bg-brand-blue", exterior:"bg-orange-500" };
  const netGrowth = data.clientsEnd - data.clientsStart;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <RStat label="Clients at start"  value={data.clientsStart}              accent="text-brand-navy" />
        <RStat label="Clients at end"    value={data.clientsEnd}                accent="text-brand-navy" />
        <RStat label="Net growth"        value={`+${netGrowth}`}               accent="text-emerald-600" sub={`+${Math.round((netGrowth/Math.max(data.clientsStart,1))*100)}% growth`} />
        <RStat label="Clients lost"      value={data.clientsLost}               accent={data.clientsLost>3?"text-red-500":"text-amber-600"} sub={data.clientsLost===0?"Perfect retention":""} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <RStat label="Jobs completed"   value={data.jobsCompleted.toLocaleString()} accent="text-brand-navy" />
        <RStat label="Avg job value"    value={fmt(data.avgJobValue)}               accent="text-brand-blue" />
        <RStat label="Jobs per month"   value={Math.round(data.jobsCompleted/12)}   accent="text-brand-navy" sub="average" />
      </div>

      {/* Top clients */}
      {data.topClients?.length > 0 && (
        <Card className="overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100"><SL>Top clients by revenue</SL></div>
          <div className="divide-y divide-gray-100">
            {data.topClients.map((c, i) => (
              <div key={c.name} className="flex items-center gap-3 px-4 py-3">
                <div className="w-7 h-7 rounded-full bg-brand-navy text-white flex items-center justify-center text-xs font-bold shrink-0">{i+1}</div>
                <div className={`w-2 h-2 rounded-full shrink-0 ${TYPE_DOT[c.type]}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800">{c.name}</p>
                  <p className="text-xs text-gray-400">{c.visits} visits · {c.type}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold tabular-nums text-brand-navy">{fmt(c.revenue)}</p>
                  <p className="text-xs text-gray-400">{pct((c.revenue/data.income)*100)} of income</p>
                </div>
                <div className="w-20 h-2 bg-gray-100 rounded-sm overflow-hidden">
                  <div className="h-full bg-brand-blue/50 rounded-sm" style={{ width:`${(c.revenue/data.topClients[0].revenue)*100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100"><SL>Year highlights</SL></div>
        <div className="p-4">
          <ListEditor items={highlights} onChange={setHighlights} placeholder="Add a highlight from the year…" color="blue" />
        </div>
      </Card>
    </div>
  );
}

// ─── SECTION: Goals ────────────────────────────────────────────────────────────
function GoalsSection({ wins, setWins, goalsHit, setGoalsHit, goalsMissed, setGoalsMissed, improvements, setImprovements }) {
  return (
    <div className="space-y-5">
      {/* Wins */}
      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 bg-emerald-50/50">
          <SL className="text-emerald-700">Your wins this year 🏆</SL>
          <p className="text-xs text-gray-400 mt-0.5">These are auto-generated from your accounts — add your own too</p>
        </div>
        <div className="p-4">
          <ListEditor items={wins} onChange={setWins} placeholder="Add another win…" color="green" />
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <SL>Goals we hit ✅</SL>
          <p className="text-xs text-gray-400 mt-0.5">Be honest — what did you actually achieve?</p>
        </div>
        <div className="p-4">
          <ListEditor items={goalsHit} onChange={setGoalsHit} placeholder="Add a goal you hit…" color="green" />
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <SL>Goals we missed ❌</SL>
          <p className="text-xs text-gray-400 mt-0.5">No shame — missing a goal is useful information</p>
        </div>
        <div className="p-4">
          <ListEditor items={goalsMissed} onChange={setGoalsMissed} placeholder="Add a goal that wasn't reached…" color="red" />
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <SL>What to improve next year</SL>
        </div>
        <div className="p-4">
          <ListEditor items={improvements} onChange={setImprovements} placeholder="Add something to improve…" color="amber" />
        </div>
      </Card>
    </div>
  );
}

// ─── SECTION: Self review ─────────────────────────────────────────────────────
function SelfReview({ ratings, setRatings }) {
  const updateRating = useCallback((label, value) => {
    setRatings(r => ({ ...r, [label]: value }));
  }, [setRatings]);

  const avgRating = useMemo(() => {
    const vals = Object.values(ratings);
    return vals.reduce((a,b)=>a+b,0) / vals.length;
  }, [ratings]);

  const scoreMessage = avgRating >= 4.5 ? "Exceptional year" : avgRating >= 3.5 ? "Strong performance" : avgRating >= 2.5 ? "Solid foundations" : "Room to grow — and that's a good thing";
  const lowestAreas = Object.entries(ratings).filter(([,v]) => v <= 2).map(([k]) => k);

  return (
    <div className="space-y-5">
      <Alert type="gold">
        <strong>Rate yourself honestly</strong> — a 3 is good. A 5 you haven't earned yet. The areas where you score low are exactly where your growth lives next year.
      </Alert>

      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <SL>Rate your year — 1 to 5</SL>
        </div>
        <div className="px-5 py-2">
          {Object.entries(ratings).map(([label, value]) => (
            <StarRow key={label} label={label} value={value} onChange={v => updateRating(label, v)} />
          ))}
        </div>
      </Card>

      {/* Overall score */}
      <div className="bg-brand-navy rounded-sm p-6 text-white text-center">
        <SL className="text-brand-skyblue mb-3">Overall self-score</SL>
        <p className="text-6xl font-bold tabular-nums">{avgRating.toFixed(1)}</p>
        <p className="text-brand-skyblue mt-1">out of 5.0</p>
        <div className="flex justify-center gap-1 mt-3">
          {[1,2,3,4,5].map(s => (
            <span key={s} className="text-2xl">{s <= Math.round(avgRating) ? "★" : "☆"}</span>
          ))}
        </div>
        <p className="text-sm font-semibold mt-3">{scoreMessage}</p>
      </div>

      {/* Focus areas */}
      {lowestAreas.length > 0 && (
        <Card className="p-4 border-l-4 border-l-amber-400">
          <SL className="mb-2">Focus areas for next year</SL>
          <p className="text-sm text-gray-600 mb-3">Your lowest-rated areas — put these in your 90-day sprint goals:</p>
          <div className="space-y-1.5">
            {lowestAreas.map(area => (
              <div key={area} className="flex items-center gap-2 text-sm">
                <span className="text-amber-500 font-bold">→</span>
                <span className="text-gray-800 font-medium">{area}</span>
                <span className="text-xs text-gray-400">— rated {ratings[area]}/5</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── SECTION: Next year ────────────────────────────────────────────────────────
function NextYearSection({ data, nextYearGoals, setNextYearGoals, vision, setVision }) {
  const [incomeTarget, setIncomeTarget] = useState(Math.round(data.income * 1.2 / 1000) * 1000);
  const growth    = incomeTarget - data.income;
  const growthPct = Math.round((growth / data.income) * 100);

  // Data-driven insights (from existing component)
  const insights = [
    {
      icon: "📈",
      text: `To hit ${fmt(Math.round(data.income*1.2))} next year (20% growth), you need ${fmt(Math.round((data.income*0.2)/12))} more per month — about ${Math.ceil((data.income*0.2)/data.avgJobValue)} extra jobs.`,
    },
    {
      icon: "💷",
      text: `Your average job is ${fmt(data.avgJobValue)}. A 10% price rise adds ${fmt(Math.round(data.jobsCompleted*data.avgJobValue*0.1))} annually with the same number of jobs.`,
    },
    {
      icon: "👥",
      text: `You lost ${data.clientsLost} client${data.clientsLost!==1?"s":""} this year. Retaining just 2 more adds ${fmt(data.avgJobValue*24)} over 12 months.`,
    },
    {
      icon: "📊",
      text: `Your profit margin is ${pct(data.margin)}. Cutting expenses by 10% adds ${fmt(Math.round(data.expenses*0.1))} to your profit without winning a single extra job.`,
    },
  ];

  return (
    <div className="space-y-5">
      {/* Income target slider */}
      <Card className="overflow-hidden border-t-2 border-t-brand-blue">
        <div className="px-4 py-3 border-b border-gray-100"><SL>Income target</SL></div>
        <div className="p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-4xl font-bold tabular-nums text-brand-navy">{fmt(incomeTarget)}</p>
              <p className="text-sm text-gray-400 mt-1">
                {growth > 0 ? `↑ ${growthPct}% growth on this year` : "Same as this year"} · {fmt(Math.round(incomeTarget/12))}/month
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400 mb-0.5">This year</p>
              <p className="text-lg font-bold text-gray-400 tabular-nums">{fmt(data.income)}</p>
            </div>
          </div>
          <input type="range" min={data.income*0.9} max={data.income*3} step={500}
            value={incomeTarget} onChange={e => setIncomeTarget(+e.target.value)}
            className="w-full accent-brand-blue mb-3" />
          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden mb-2">
            <div className="h-full bg-brand-blue rounded-full" style={{ width:`${Math.min((data.income/incomeTarget)*100,100)}%` }} />
          </div>
          <div className="flex justify-between text-xs text-gray-400 mb-4">
            <span>This year: {fmt(data.income)}</span>
            <span className="text-brand-blue font-bold">{fmt(incomeTarget)} target</span>
          </div>

          {/* Three growth tiers (from existing component) */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label:"Conservative +10%", val:fmt(Math.round(data.income*1.1)), active:growthPct>=8&&growthPct<15 },
              { label:"Realistic +20%",    val:fmt(Math.round(data.income*1.2)), active:growthPct>=15&&growthPct<30 },
              { label:"Ambitious +35%",    val:fmt(Math.round(data.income*1.35)),active:growthPct>=30 },
            ].map(({ label, val, active }) => (
              <button
                key={label}
                onClick={() => {
                  const multiplier = label.includes("10") ? 1.1 : label.includes("20") ? 1.2 : 1.35;
                  setIncomeTarget(Math.round(data.income*multiplier/500)*500);
                }}
                className={`text-center p-3 border rounded-sm transition-colors ${active ? "bg-brand-navy text-white border-brand-navy" : "bg-gray-50 border-gray-200 hover:border-brand-blue"}`}
              >
                <p className={`text-sm font-bold tabular-nums ${active?"text-white":"text-brand-navy"}`}>{val}</p>
                <p className={`text-xs mt-0.5 ${active?"text-brand-skyblue":"text-gray-400"}`}>{label}</p>
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Data-driven insights (from existing component) */}
      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 bg-brand-skyblue/10">
          <SL>Based on your {data.yr} numbers</SL>
          <p className="text-xs text-gray-400 mt-0.5">These are calculated from your actual data — not generic advice</p>
        </div>
        <div className="divide-y divide-gray-100">
          {insights.map(({ icon, text }, i) => (
            <div key={i} className="flex items-start gap-3 px-4 py-3.5">
              <span className="text-lg shrink-0 mt-0.5">{icon}</span>
              <p className="text-sm text-gray-700 leading-relaxed">{text}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Goals for next year */}
      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100"><SL>Goals for next year</SL></div>
        <div className="p-4">
          <ListEditor items={nextYearGoals} onChange={setNextYearGoals} placeholder="Add a goal for next year…" color="blue" />
        </div>
      </Card>

      {/* Vision */}
      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <SL>Vision statement</SL>
          <p className="text-xs text-gray-400 mt-0.5">One sentence: where will your business be in 12 months?</p>
        </div>
        <div className="p-4">
          <textarea
            value={vision}
            onChange={e => setVision(e.target.value)}
            rows={3}
            placeholder="e.g. By April 2027, I'll be running a team of two cleaners, earning £60k, and taking every Friday off…"
            className="w-full border border-gray-200 rounded-sm px-3 py-2.5 text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:border-brand-blue resize-none"
          />
          {vision && (
            <div className="mt-3 bg-brand-navy/5 border border-brand-navy/10 rounded-sm p-3">
              <p className="text-xs text-gray-400 mb-1">Your vision</p>
              <p className="text-sm text-brand-navy font-medium italic">"{vision}"</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

// ─── SECTION: Sprint ───────────────────────────────────────────────────────────
function SprintSection() {
  const [sprintActive,   setSprintActive]   = useState(false);
  const [sprintGoals,    setSprintGoals]    = useState(
    SPRINT_GOAL_TEMPLATES.map((g, i) => ({ ...g, id: i+1, text: "", target: "" }))
  );
  const [weekChecks,     setWeekChecks]     = useState({});
  const [currentWeek,    setCurrentWeek]    = useState(3);
  const [milestones,     setMilestones]     = useState([
    { week:4,  label:"4-week check-in",  done:false, note:"" },
    { week:8,  label:"8-week check-in",  done:false, note:"" },
    { week:13, label:"Sprint complete",  done:false, note:"" },
  ]);
  const [startDate,      setStartDate]      = useState(new Date().toISOString().split("T")[0]);
  // Audit
  const [showAudit,      setShowAudit]      = useState(false);
  const [auditLoading,   setAuditLoading]   = useState(false);
  const [audit,          setAudit]          = useState(null);
  const [auditError,     setAuditError]     = useState(null);

  const updateGoal = (id, field, val) =>
    setSprintGoals(prev => prev.map(g => g.id===id ? {...g,[field]:val} : g));

  const toggleCheck = (week, habitId) => {
    const key = `w${week}_${habitId}`;
    setWeekChecks(prev => ({ ...prev, [key]: !prev[key] }));
  };
  const isChecked = (week, habitId) => !!weekChecks[`w${week}_${habitId}`];

  const totalPossibleChecks = currentWeek * HABITS.length;
  const completedChecks     = Object.values(weekChecks).filter(Boolean).length;
  const habitScore          = totalPossibleChecks > 0 ? Math.round((completedChecks / totalPossibleChecks) * 100) : 0;
  const sprintPct           = Math.round((currentWeek / 13) * 100);

  const generateAudit = async () => {
    setAuditLoading(true);
    setAuditError(null);
    try {
      const milestoneNotes = milestones.filter(m=>m.note).map(m=>`Week ${m.week}: "${m.note}"`).join("\n");
      const goalsList = sprintGoals.filter(g=>g.text).map(g=>`${g.category}: "${g.text}" (measure: ${g.target||"not set"})`).join("\n");

      const prompt = `You are a business coach for UK professional cleaning businesses. Analyse this 90-day sprint and give an honest, motivating audit.

Sprint data:
- Goals: ${goalsList || "None set"}
- Habit score: ${habitScore}% (${completedChecks}/${totalPossibleChecks} habits completed over ${currentWeek} weeks)
- Milestone notes: ${milestoneNotes || "None provided"}
- Sprint completion: ${sprintPct}% (week ${currentWeek} of 13)

Respond ONLY with valid JSON (no markdown, no extra text):
{
  "overallScore": number,
  "grade": "A+|A|B+|B|C|D",
  "headline": "string max 15 words",
  "whatWorked": ["string","string","string"],
  "whatToImprove": ["string","string","string"],
  "habitInsight": "string one sentence",
  "nextSprintFocus": ["string","string","string"],
  "motivatingClose": "string max 20 words"
}`;

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 700,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (!response.ok) throw new Error(`API ${response.status}`);
      const res  = await response.json();
      const text = res.content?.[0]?.text ?? "";
      setAudit(JSON.parse(text.replace(/```json|```/g,"").trim()));
    } catch (err) {
      console.error(err);
      setAuditError("Couldn't generate the audit. Check your connection and try again.");
    } finally {
      setAuditLoading(false);
    }
  };

  if (showAudit) {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={() => { setShowAudit(false); setAudit(null); }} className="text-gray-400 hover:text-brand-navy text-sm transition-colors">← Sprint</button>
          <h3 className="text-lg font-bold text-brand-navy">Sprint audit</h3>
        </div>

        {/* Sprint summary */}
        <Card className="overflow-hidden">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-gray-200">
            {[
              { label:"Habit score",      val:`${habitScore}%`,    accent:habitScore>=70?"text-emerald-600":"text-amber-600" },
              { label:"Goals set",        val:`${sprintGoals.filter(g=>g.text).length}/4`, accent:"text-brand-navy" },
              { label:"Habits checked",   val:`${completedChecks}/${totalPossibleChecks}`, accent:"text-brand-navy" },
              { label:"Check-ins done",   val:`${milestones.filter(m=>m.done).length}/3`,  accent:"text-brand-navy" },
            ].map(({ label, val, accent }) => (
              <div key={label} className="bg-white px-4 py-3">
                <SL className="mb-0.5">{label}</SL>
                <p className={`text-xl font-bold tabular-nums ${accent}`}>{val}</p>
              </div>
            ))}
          </div>
        </Card>

        {!audit && !auditLoading && (
          <div className="text-center py-10">
            <p className="text-4xl mb-3">🤖</p>
            <p className="text-base font-bold text-brand-navy mb-2">Ready to run your AI audit</p>
            <p className="text-sm text-gray-400 mb-6 max-w-sm mx-auto">Cadi analyses your habit data, goal completion, and check-in notes to give you a personalised sprint report.</p>
            <button onClick={generateAudit} className="px-8 py-3 bg-brand-navy text-white text-xs font-bold uppercase tracking-widest hover:bg-brand-blue transition-colors rounded-sm">
              🤖 Generate sprint audit
            </button>
          </div>
        )}

        {auditLoading && (
          <Card className="p-8 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="w-10 h-10 border-[3px] border-brand-blue border-t-transparent rounded-full animate-spin" />
              <p className="text-sm font-semibold text-brand-navy">Analysing your sprint…</p>
              <p className="text-xs text-gray-400">Reading habit data, goals, and milestone notes</p>
            </div>
          </Card>
        )}

        {auditError && <Alert type="warn">{auditError}</Alert>}

        {audit && (
          <div className="space-y-4">
            <Card className="overflow-hidden border-t-2 border-t-brand-navy">
              <div className="bg-brand-navy px-5 py-5 text-white">
                <div className="flex items-start gap-5">
                  <div className={`w-20 h-20 rounded-sm flex items-center justify-center text-4xl font-bold shrink-0 ${
                    audit.grade?.startsWith("A") ? "bg-emerald-500 text-white" :
                    audit.grade?.startsWith("B") ? "bg-brand-blue text-white" :
                    "bg-amber-500 text-white"
                  }`}>{audit.grade}</div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-brand-skyblue mb-2">AI audit · {audit.overallScore}/100</p>
                    <p className="text-xl font-bold text-white">{audit.headline}</p>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="overflow-hidden border-t-2 border-t-emerald-500">
              <div className="px-4 py-3 border-b border-gray-100 bg-emerald-50/50"><SL className="text-emerald-700">What worked</SL></div>
              <div className="divide-y divide-gray-100">
                {audit.whatWorked?.map((item,i) => (
                  <div key={i} className="flex items-start gap-3 px-4 py-3">
                    <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">✓</div>
                    <p className="text-sm text-gray-800">{item}</p>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="overflow-hidden border-t-2 border-t-amber-400">
              <div className="px-4 py-3 border-b border-gray-100 bg-amber-50/50"><SL className="text-amber-700">What to improve</SL></div>
              <div className="divide-y divide-gray-100">
                {audit.whatToImprove?.map((item,i) => (
                  <div key={i} className="flex items-start gap-3 px-4 py-3">
                    <div className="w-5 h-5 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">→</div>
                    <p className="text-sm text-gray-800">{item}</p>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-4 border-l-4 border-l-brand-blue">
              <SL className="mb-2">Habit insight</SL>
              <p className="text-sm text-gray-700 leading-relaxed">{audit.habitInsight}</p>
            </Card>

            <Card className="overflow-hidden border-t-2 border-t-brand-navy">
              <div className="px-4 py-3 border-b border-gray-100 bg-brand-navy/5"><SL>Next sprint — focus areas</SL></div>
              <div className="divide-y divide-gray-100">
                {audit.nextSprintFocus?.map((item,i) => (
                  <div key={i} className="flex items-start gap-3 px-4 py-3">
                    <div className="w-6 h-6 rounded-sm bg-brand-navy text-white flex items-center justify-center text-xs font-bold shrink-0">{i+1}</div>
                    <p className="text-sm text-gray-800">{item}</p>
                  </div>
                ))}
              </div>
            </Card>

            {audit.motivatingClose && (
              <div className="bg-brand-navy rounded-sm p-5 text-center">
                <p className="text-lg font-bold text-white">{audit.motivatingClose}</p>
              </div>
            )}
            <button onClick={() => { setAudit(null); }} className="w-full py-2.5 border border-gray-200 text-gray-500 text-xs font-bold uppercase rounded-sm hover:border-brand-blue hover:text-brand-blue transition-colors">Re-run audit</button>
          </div>
        )}
      </div>
    );
  }

  if (!sprintActive) {
    return (
      <div className="space-y-5">
        <Card className="overflow-hidden border-t-2 border-t-brand-blue">
          <div className="p-8 text-center">
            <p className="text-5xl mb-4">🚀</p>
            <h3 className="text-xl font-bold text-brand-navy mb-2">Start a 90-day sprint</h3>
            <p className="text-sm text-gray-500 leading-relaxed max-w-md mx-auto mb-6">
              A focused 13-week push with weekly habits, milestone check-ins, and an AI audit at the end. Used by the fastest-growing cleaning businesses to break through plateaus.
            </p>
            <div className="grid grid-cols-3 gap-3 max-w-md mx-auto mb-6">
              {[["🎯","Set 4 sprint goals"],["📋","Track 6 weekly habits"],["🤖","AI audit at the end"]].map(([icon,label]) => (
                <div key={label} className="bg-gray-50 border border-gray-100 rounded-sm p-3">
                  <p className="text-2xl mb-1">{icon}</p>
                  <p className="text-xs font-semibold text-gray-600">{label}</p>
                </div>
              ))}
            </div>
            <div className="mb-5">
              <label className="block text-xs font-bold tracking-widest uppercase text-gray-400 mb-1">Sprint start date</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="border border-gray-200 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-brand-blue" />
            </div>
            <button onClick={() => setSprintActive(true)} className="px-8 py-3 bg-brand-navy text-white text-sm font-bold uppercase tracking-widest hover:bg-brand-blue transition-colors rounded-sm">
              🚀 Start sprint
            </button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <Card className="overflow-hidden border-t-2 border-t-brand-blue">
        <div className="bg-brand-navy px-5 py-4 flex items-center justify-between text-white">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-brand-skyblue">90-day sprint · active</p>
            <p className="text-lg font-bold mt-0.5">Week {currentWeek} of 13</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-xs text-brand-skyblue">{sprintPct}% complete</p>
              <p className="text-xs text-brand-skyblue/60">{habitScore}% habit score</p>
            </div>
            <div className="flex gap-1">
              <button onClick={() => setCurrentWeek(w=>Math.max(1,w-1))} className="w-7 h-7 rounded-sm bg-white/10 hover:bg-white/20 text-white text-sm flex items-center justify-center">‹</button>
              <button onClick={() => setCurrentWeek(w=>Math.min(13,w+1))} className="w-7 h-7 rounded-sm bg-white/10 hover:bg-white/20 text-white text-sm flex items-center justify-center">›</button>
            </div>
          </div>
        </div>
        <div className="h-2 bg-gray-100">
          <div className="h-full bg-brand-blue transition-all duration-500" style={{ width:`${sprintPct}%` }} />
        </div>
        <div className="grid grid-cols-3 gap-px bg-gray-200">
          {[
            { label:"Habit score",    val:`${habitScore}%`, accent:habitScore>=70?"text-emerald-600":"text-amber-600" },
            { label:"Goals set",      val:`${sprintGoals.filter(g=>g.text).length}/4`, accent:"text-brand-navy" },
            { label:"Weeks tracked",  val:currentWeek, accent:"text-brand-navy" },
          ].map(({ label, val, accent }) => (
            <div key={label} className="bg-white px-4 py-3 text-center">
              <SL className="mb-0.5">{label}</SL>
              <p className={`text-xl font-bold tabular-nums ${accent}`}>{val}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Goals */}
      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100"><SL>Sprint goals</SL></div>
        <div className="divide-y divide-gray-100">
          {sprintGoals.map(g => (
            <div key={g.id} className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-base">{g.icon}</span>
                <span className="text-xs font-bold tracking-widest uppercase text-gray-400">{g.category}</span>
              </div>
              <input type="text" value={g.text} onChange={e => updateGoal(g.id,"text",e.target.value)} placeholder={g.placeholder}
                className="w-full border border-gray-200 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-brand-blue mb-2" />
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-400 shrink-0">Measure it:</label>
                <input type="text" value={g.target} onChange={e => updateGoal(g.id,"target",e.target.value)} placeholder="e.g. £6,000 on the money dashboard"
                  className="flex-1 border border-gray-200 rounded-sm px-2 py-1 text-xs focus:outline-none focus:border-brand-blue" />
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Habit tracker */}
      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <SL>Week {currentWeek} habits</SL>
          <Chip color={habitScore>=70?"green":habitScore>=40?"warn":"red"}>{completedChecks}/{totalPossibleChecks} checked</Chip>
        </div>
        {/* Week strip */}
        <div className="flex overflow-x-auto border-b border-gray-100">
          {Array.from({length:Math.min(currentWeek,13)},(_,i)=>{
            const w = i+1;
            const wChecked = HABITS.filter(h=>isChecked(w,h.id)).length;
            return (
              <button key={w} onClick={()=>setCurrentWeek(w)}
                className={`flex-shrink-0 flex flex-col items-center px-4 py-2 border-b-2 transition-all text-xs ${currentWeek===w?"border-brand-blue text-brand-blue":"border-transparent text-gray-400 hover:text-gray-700"}`}>
                <span className="font-bold">W{w}</span>
                <span className={`text-xs mt-0.5 ${wChecked===HABITS.length?"text-emerald-500":"text-gray-300"}`}>{wChecked}/{HABITS.length}</span>
              </button>
            );
          })}
        </div>
        <div className="divide-y divide-gray-100">
          {HABITS.map(h => {
            const checked = isChecked(currentWeek, h.id);
            return (
              <label key={h.id} className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors ${checked?"bg-emerald-50/50":""}`}>
                <div onClick={()=>toggleCheck(currentWeek,h.id)}
                  className={`w-5 h-5 rounded-sm border-2 flex items-center justify-center shrink-0 transition-colors ${checked?"bg-emerald-500 border-emerald-500":"border-gray-300 hover:border-brand-blue"}`}>
                  {checked && <span className="text-white text-xs font-bold">✓</span>}
                </div>
                <span className="text-base shrink-0">{h.icon}</span>
                <span className={`text-sm ${checked?"text-emerald-800 line-through decoration-emerald-400":"text-gray-700"}`}>{h.label}</span>
              </label>
            );
          })}
        </div>
        <div className="px-4 py-3 border-t border-gray-100 bg-gray-50">
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>Week {currentWeek} progress</span>
            <span className="font-bold">{HABITS.filter(h=>isChecked(currentWeek,h.id)).length}/{HABITS.length}</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-brand-blue rounded-full transition-all"
              style={{ width:`${(HABITS.filter(h=>isChecked(currentWeek,h.id)).length/HABITS.length)*100}%` }} />
          </div>
        </div>
      </Card>

      {/* Milestone check-ins */}
      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100"><SL>Milestone check-ins</SL></div>
        <div className="divide-y divide-gray-100">
          {milestones.map(m => {
            const unlocked = currentWeek >= m.week;
            return (
              <div key={m.week} className={`p-4 ${!unlocked?"opacity-40":""}`}>
                <div className="flex items-center gap-3 mb-2">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${m.done?"bg-emerald-500 text-white":unlocked?"bg-brand-blue text-white":"bg-gray-200 text-gray-400"}`}>
                    {m.done?"✓":`W${m.week}`}
                  </div>
                  <p className={`text-sm font-semibold ${m.done?"text-emerald-800":"text-gray-800"}`}>{m.label}</p>
                  {m.done && <Chip color="green">Complete</Chip>}
                </div>
                {unlocked && (
                  <div className="flex gap-2">
                    <textarea value={m.note} onChange={e=>setMilestones(prev=>prev.map(x=>x.week===m.week?{...x,note:e.target.value}:x))}
                      rows={2} placeholder={`How's the sprint going at week ${m.week}?`}
                      className="flex-1 border border-gray-200 rounded-sm px-3 py-2 text-xs text-gray-700 focus:outline-none focus:border-brand-blue resize-none" />
                    {!m.done && (
                      <button onClick={()=>setMilestones(prev=>prev.map(x=>x.week===m.week?{...x,done:true}:x))}
                        className="px-3 py-2 bg-brand-navy text-white text-xs font-bold rounded-sm hover:bg-brand-blue transition-colors shrink-0">
                        Mark done
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <button onClick={()=>setShowAudit(true)}
        className="w-full py-3 bg-emerald-600 text-white text-xs font-bold uppercase tracking-widest hover:bg-emerald-700 transition-colors rounded-sm">
        🤖 Run sprint audit (AI) →
      </button>
    </div>
  );
}

// ─── ROOT ──────────────────────────────────────────────────────────────────────
export default function AnnualReviewTab({ accountsData, onNavigate }) {
  const { user } = useAuth();
  const isLive = Boolean(user);
  const EMPTY_YEAR_DATA = {
    income: 0,
    prevIncome: 0,
    expenses: 0,
    prevExpenses: 0,
    jobsCompleted: 0,
    avgJobValue: 0,
    clientsStart: 0,
    clientsEnd: 0,
    clientsLost: 0,
    bestMonth: { name: "N/A", value: 0 },
    worstMonth: { name: "N/A", value: 0 },
    topClients: [],
    expenseBreakdown: [],
    monthlyData: [
      { m:"Apr",income:0,exp:0},{ m:"May",income:0,exp:0},{ m:"Jun",income:0,exp:0},
      { m:"Jul",income:0,exp:0},{ m:"Aug",income:0,exp:0},{ m:"Sep",income:0,exp:0},
      { m:"Oct",income:0,exp:0},{ m:"Nov",income:0,exp:0},{ m:"Dec",income:0,exp:0},
      { m:"Jan",income:0,exp:0},{ m:"Feb",income:0,exp:0},{ m:"Mar",income:0,exp:0},
    ],
  };
  const yearCatalogue = isLive ? { "Current Year": EMPTY_YEAR_DATA } : YEAR_CATALOGUE;
  const availableYears = Object.keys(yearCatalogue);

  const [selectedYear, setSelectedYear] = useState(availableYears[0]);
  const [section,      setSection]      = useState("numbers");
  const [showPrint,    setShowPrint]    = useState(false);

  const rawData = yearCatalogue[selectedYear] ?? EMPTY_YEAR_DATA;
  const data    = useMemo(() => enrichYear(selectedYear, rawData), [selectedYear, rawData]);

  // All editable state at the root — never resets on tab or year change
  const [wins,          setWins]          = useState(isLive ? [] : ["Grew income by 21% year-on-year","Added 2 new commercial clients worth £10,080 combined","Profit margin above industry average of 65%","Fully claimed all mileage — HMRC 45p/mile relief","No overdue invoices for the last 6 months"]);
  const [goalsHit,      setGoalsHit]      = useState(isLive ? [] : ["Reached 30 clients","Launched commercial cleaning","Hired first team member"]);
  const [goalsMissed,   setGoalsMissed]   = useState(isLive ? [] : ["Hit £60k revenue target","Launch website"]);
  const [highlights,    setHighlights]    = useState(isLive ? [] : ["Won first commercial contract worth £320/month","Highest ever monthly revenue in July","Added 3 end of tenancy specialist jobs"]);
  const [improvements,  setImprovements]  = useState(isLive ? [] : ["Reduce fuel costs by batching jobs better","Chase outstanding invoices faster","Invest in better equipment"]);
  const [nextYearGoals, setNextYearGoals] = useState(isLive ? [] : ["Hit £65,000 revenue","Grow to 40 active clients","Launch website and Google reviews campaign","Hire a second part-time cleaner"]);
  const [vision,        setVision]        = useState("");
  const [ratings,       setRatings]       = useState({
    "Customer service":      4,
    "Quality of work":       5,
    "Punctuality":           4,
    "Financial management":  3,
    "Marketing & growth":    3,
    "Staff management":      4,
    "Work-life balance":     3,
    "Systems & organisation":4,
  });

  const NAV = [
    { id:"numbers", icon:"📊", label:"Numbers",     sub:"Financial summary"  },
    { id:"clients", icon:"👥", label:"Clients",     sub:"Growth & highlights"},
    { id:"goals",   icon:"🎯", label:"Goals",       sub:"Wins, hits, misses" },
    { id:"ratings", icon:"⭐", label:"Self review", sub:"Honest self-score"  },
    { id:"next",    icon:"🚀", label:"Next year",   sub:"Targets & vision"   },
    { id:"sprint",  icon:"🏃", label:"90-day sprint",sub:"Focused growth push"},
  ];

  if (showPrint) {
    return <PrintView data={data} year={selectedYear} ratings={ratings}
      goalsHit={goalsHit} goalsMissed={goalsMissed} highlights={highlights}
      improvements={improvements} onClose={()=>setShowPrint(false)} />;
  }

  return (
    <div className="flex h-full bg-gray-50/50">

      {/* Sidebar */}
      <aside className="w-56 shrink-0 bg-brand-navy border-r border-brand-navy/20 flex flex-col py-4 overflow-y-auto">
        {/* Year selector */}
        <div className="px-4 mb-5">
          <p className="text-xs font-bold tracking-widest uppercase text-brand-skyblue mb-2">Tax year</p>
          <select
            value={selectedYear}
            onChange={e => setSelectedYear(e.target.value)}
            className="w-full bg-white/10 text-white text-sm font-bold rounded-sm px-3 py-2 border-0 focus:outline-none focus:ring-1 focus:ring-brand-skyblue"
          >
            {availableYears.map(y => <option key={y} value={y} className="bg-brand-navy">{y}</option>)}
          </select>
        </div>

        {/* Nav */}
        {NAV.map(n => (
          <button key={n.id} onClick={() => setSection(n.id)}
            className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-all border-l-2 ${
              section===n.id
                ? "border-brand-skyblue bg-white/10 text-white"
                : "border-transparent text-brand-skyblue/60 hover:text-white hover:bg-white/5 hover:border-white/20"
            }`}>
            <span className="text-lg shrink-0 mt-0.5">{n.icon}</span>
            <div>
              <p className={`text-sm font-semibold ${section===n.id?"text-white":""}`}>{n.label}</p>
              <p className={`text-xs mt-0.5 ${section===n.id?"text-brand-skyblue":"text-brand-skyblue/40"}`}>{n.sub}</p>
            </div>
          </button>
        ))}

        {/* Print button */}
        <div className="mt-auto mx-4 space-y-2">
          <button onClick={() => setShowPrint(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-sm transition-colors">
            🖨️ Generate report
          </button>
          <div className="flex items-center gap-2 px-3 py-2 bg-white/10 rounded-sm">
            <span className={`w-2 h-2 rounded-full shrink-0 ${accountsData?"bg-emerald-400 animate-pulse":"bg-gray-400"}`} />
            <span className="text-xs text-white font-semibold">{accountsData?"Accounts live":"Demo data"}</span>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto p-6">
        {section==="numbers" && <NumbersSection data={data} />}
        {section==="clients" && <ClientsSection data={data} highlights={highlights} setHighlights={setHighlights} />}
        {section==="goals"   && <GoalsSection wins={wins} setWins={setWins} goalsHit={goalsHit} setGoalsHit={setGoalsHit} goalsMissed={goalsMissed} setGoalsMissed={setGoalsMissed} improvements={improvements} setImprovements={setImprovements} />}
        {section==="ratings" && <SelfReview ratings={ratings} setRatings={setRatings} />}
        {section==="next"    && <NextYearSection data={data} nextYearGoals={nextYearGoals} setNextYearGoals={setNextYearGoals} vision={vision} setVision={setVision} />}
        {section==="sprint"  && <SprintSection />}
      </main>
    </div>
  );
}
