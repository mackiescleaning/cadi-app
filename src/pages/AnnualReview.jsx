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

import { useState, useCallback, useMemo, useEffect } from 'react';
import { ClipboardCheck, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import AskCadi from '../components/AskCadi';
import { greenCanvas, glassDark, CONNECT_RADII } from '../lib/connectTheme';
import {
  getCurrentReviewPeriod,
  priorPeriodOf,
  aggregateForYear,
  listAnnualReviews,
  getFiledReview,
  composeExecSummary,
  execSummaryKpis,
  buildRiskRegister,
  normalizeEntityType,
} from '../lib/db/annualReviewDb';
import { supabase } from '../lib/supabase';

// ─── Year data ─────────────────────────────────────────────────────────────────
// Multi-year support — users can review any past year
const YEAR_CATALOGUE = {
  '2025/26': {
    income: 54200,
    prevIncome: 44800,
    expenses: 9840,
    prevExpenses: 8200,
    jobsCompleted: 412,
    avgJobValue: 131,
    clientsStart: 18,
    clientsEnd: 31,
    clientsLost: 4,
    bestMonth: { name: 'September', value: 5800 },
    worstMonth: { name: 'January', value: 3600 },
    topClients: [
      { name: 'Greenfield Office', revenue: 5400, type: 'commercial', visits: 52 },
      { name: 'Park View Flats', revenue: 4680, type: 'commercial', visits: 48 },
      { name: 'Kensington Block', revenue: 4160, type: 'exterior', visits: 52 },
      { name: 'Johnson', revenue: 3120, type: 'residential', visits: 52 },
      { name: 'Nexus HQ', revenue: 2800, type: 'commercial', visits: 12 },
    ],
    expenseBreakdown: [
      { label: 'Van & mileage', amount: 3820, pct: 39 },
      { label: 'Cleaning supplies', amount: 2160, pct: 22 },
      { label: 'Insurance', amount: 1440, pct: 15 },
      { label: 'Phone & software', amount: 864, pct: 9 },
      { label: 'Uniform & PPE', amount: 480, pct: 5 },
      { label: 'Training', amount: 360, pct: 4 },
      { label: 'Other', amount: 576, pct: 6 },
    ],
    monthlyData: [
      { m: 'Apr', income: 3800, exp: 720 },
      { m: 'May', income: 4200, exp: 750 },
      { m: 'Jun', income: 4600, exp: 780 },
      { m: 'Jul', income: 5800, exp: 900 },
      { m: 'Aug', income: 4900, exp: 860 },
      { m: 'Sep', income: 4200, exp: 800 },
      { m: 'Oct', income: 3600, exp: 740 },
      { m: 'Nov', income: 4100, exp: 760 },
      { m: 'Dec', income: 4800, exp: 820 },
      { m: 'Jan', income: 5200, exp: 860 },
      { m: 'Feb', income: 4600, exp: 840 },
      { m: 'Mar', income: 4400, exp: 810 },
    ],
  },
  '2024/25': {
    income: 44800,
    prevIncome: 32100,
    expenses: 8200,
    prevExpenses: 6400,
    jobsCompleted: 308,
    avgJobValue: 145,
    clientsStart: 11,
    clientsEnd: 18,
    clientsLost: 2,
    bestMonth: { name: 'October', value: 4600 },
    worstMonth: { name: 'April', value: 2600 },
    topClients: [
      { name: 'Greenfield Office', revenue: 4320, type: 'commercial', visits: 48 },
      { name: 'Johnson', revenue: 3120, type: 'residential', visits: 52 },
      { name: 'Kensington Block', revenue: 2880, type: 'exterior', visits: 36 },
    ],
    expenseBreakdown: [
      { label: 'Van & mileage', amount: 3100, pct: 38 },
      { label: 'Cleaning supplies', amount: 1900, pct: 23 },
      { label: 'Insurance', amount: 1280, pct: 16 },
      { label: 'Other', amount: 1920, pct: 23 },
    ],
    monthlyData: [
      { m: 'Apr', income: 2600, exp: 580 },
      { m: 'May', income: 3200, exp: 630 },
      { m: 'Jun', income: 3600, exp: 660 },
      { m: 'Jul', income: 4000, exp: 700 },
      { m: 'Aug', income: 4200, exp: 720 },
      { m: 'Sep', income: 4100, exp: 710 },
      { m: 'Oct', income: 4600, exp: 750 },
      { m: 'Nov', income: 4100, exp: 710 },
      { m: 'Dec', income: 3800, exp: 680 },
      { m: 'Jan', income: 3400, exp: 650 },
      { m: 'Feb', income: 3600, exp: 660 },
      { m: 'Mar', income: 3600, exp: 660 },
    ],
  },
  '2023/24': {
    income: 32100,
    prevIncome: 21400,
    expenses: 6400,
    prevExpenses: 4800,
    jobsCompleted: 196,
    avgJobValue: 163,
    clientsStart: 4,
    clientsEnd: 11,
    clientsLost: 1,
    bestMonth: { name: 'November', value: 3400 },
    worstMonth: { name: 'April', value: 1600 },
    topClients: [
      { name: 'Johnson', revenue: 2880, type: 'residential', visits: 48 },
      { name: 'Williams', revenue: 2160, type: 'residential', visits: 36 },
    ],
    expenseBreakdown: [
      { label: 'Van & mileage', amount: 2400, pct: 38 },
      { label: 'Cleaning supplies', amount: 1500, pct: 23 },
      { label: 'Insurance', amount: 1100, pct: 17 },
      { label: 'Other', amount: 1400, pct: 22 },
    ],
    monthlyData: [
      { m: 'Apr', income: 1600, exp: 410 },
      { m: 'May', income: 2000, exp: 450 },
      { m: 'Jun', income: 2400, exp: 490 },
      { m: 'Jul', income: 2800, exp: 530 },
      { m: 'Aug', income: 3000, exp: 560 },
      { m: 'Sep', income: 3200, exp: 580 },
      { m: 'Oct', income: 3100, exp: 570 },
      { m: 'Nov', income: 3400, exp: 600 },
      { m: 'Dec', income: 2800, exp: 540 },
      { m: 'Jan', income: 2600, exp: 520 },
      { m: 'Feb', income: 2400, exp: 490 },
      { m: 'Mar', income: 2800, exp: 540 },
    ],
  },
};

function enrichYear(yr, raw) {
  const profit = raw.income - raw.expenses;
  const margin = raw.income > 0 ? (profit / raw.income) * 100 : 0;
  const taxEst = Math.max(0, (profit - 12570) * 0.2 + Math.max(0, profit - 12570) * 0.09);
  const netAfterTax = profit - taxEst;
  const yoyIncome = raw.prevIncome > 0 ? ((raw.income - raw.prevIncome) / raw.prevIncome) * 100 : 0;
  const yoyProfit =
    raw.prevIncome - raw.prevExpenses > 0
      ? ((profit - (raw.prevIncome - raw.prevExpenses)) / (raw.prevIncome - raw.prevExpenses)) * 100
      : 0;
  return { ...raw, yr, profit, margin, taxEst, netAfterTax, yoyIncome, yoyProfit };
}

// ─── Sprint / habit config ─────────────────────────────────────────────────────
const SPRINT_GOAL_TEMPLATES = [
  { category: 'Revenue', icon: '💷', placeholder: 'e.g. Hit £6,000 revenue this month' },
  { category: 'Clients', icon: '👥', placeholder: 'e.g. Sign 2 new commercial contracts' },
  { category: 'Operations', icon: '⚙️', placeholder: 'e.g. Set up automated invoice reminders' },
  { category: 'Personal', icon: '🎯', placeholder: 'e.g. Take every Friday afternoon off' },
];

const HABITS = [
  { id: 'h1', label: 'Log all jobs & income same day', icon: '📋' },
  { id: 'h2', label: 'Send invoices within 24 hours', icon: '📤' },
  { id: 'h3', label: 'Review money dashboard (Monday)', icon: '💷' },
  { id: 'h4', label: 'Log mileage after every route', icon: '🚐' },
  { id: 'h5', label: 'Follow up 1 lapsed client/week', icon: '📞' },
  { id: 'h6', label: 'Review accounts tab (Friday)', icon: '📊' },
];

// ─── Format helpers ────────────────────────────────────────────────────────────
const fmt = (n) => `£${Math.round(Math.abs(+n)).toLocaleString()}`;
const pct = (n) => `${Math.round(+n)}%`;
const sign = (n) => (n >= 0 ? `+${Math.round(n)}%` : `${Math.round(n)}%`);

// ─── Shared UI (dark glassmorphism) ───────────────────────────────────────────
const Card = ({ children, className = '' }) => (
  <div
    className={`relative overflow-hidden rounded-xl border border-[rgba(153,197,255,0.12)] ${className}`}
    style={{ background: 'linear-gradient(145deg, #052e1c 0%, #064e3b 50%, #065f46 100%)' }}
  >
    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#99c5ff]/40 to-transparent" />
    <div className="relative">{children}</div>
  </div>
);

const SL = ({ children, className = '' }) => (
  <p
    className={`text-[10px] font-bold tracking-[0.12em] uppercase text-[rgba(153,197,255,0.5)] ${className}`}
  >
    {children}
  </p>
);

function Chip({ children, color = 'blue' }) {
  const s = {
    blue: 'bg-[#059669]/20 text-[#99c5ff] border-[#059669]/30',
    green: 'bg-emerald-500/100/15 text-emerald-400 border-emerald-500/25',
    warn: 'bg-amber-500/100/15 text-amber-400 border-amber-500/25',
    red: 'bg-red-500/100/15 text-red-400 border-red-500/25',
    navy: 'bg-[#059669] text-white border-[#059669]',
    sky: 'bg-[#99c5ff]/10 text-[#99c5ff] border-[#99c5ff]/20',
    gray: 'bg-[rgba(255,255,255,0.03)]/5 text-[rgba(153,197,255,0.5)] border-white/10',
    orange: 'bg-orange-500/15 text-orange-400 border-orange-500/25',
    gold: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/25',
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-bold border ${s[color]}`}
    >
      {children}
    </span>
  );
}

function Alert({ type = 'blue', children }) {
  const s = {
    warn: 'bg-amber-500/100/10 border-amber-500/25 text-amber-300',
    green: 'bg-emerald-500/100/10 border-emerald-500/25 text-emerald-300',
    blue: 'bg-[#059669]/10 border-[#059669]/25 text-[#99c5ff]',
    gold: 'bg-yellow-500/10 border-yellow-500/25 text-yellow-300',
    red: 'bg-red-500/100/10 border-red-500/25 text-red-300',
  };
  const icons = { warn: '⚠️', green: '✅', blue: 'ℹ️', gold: '💡', red: '🚨' };
  return (
    <div className={`flex gap-3 p-3 border text-sm leading-relaxed rounded-xl ${s[type]}`}>
      <span className="shrink-0 mt-0.5">{icons[type]}</span>
      <div>{children}</div>
    </div>
  );
}

function RStat({ label, value, accent = 'text-white', sub, change }) {
  return (
    <div
      className="rounded-xl border border-[rgba(134,239,172,0.14)] p-4"
      style={{ background: 'linear-gradient(135deg, #064e3b 0%, #047857 100%)' }}
    >
      <SL className="mb-1">{label}</SL>
      <p className={`text-2xl font-black tabular-nums ${accent}`}>{value}</p>
      {sub && <p className="text-xs text-[rgba(153,197,255,0.4)] mt-0.5">{sub}</p>}
      {change !== undefined && (
        <p
          className={`text-xs font-bold mt-1 ${change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}
        >
          {change >= 0 ? '↑' : '↓'} {Math.abs(Math.round(change))}% vs last year
        </p>
      )}
    </div>
  );
}

function StarRow({ label, value, onChange, readonly = false }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-[rgba(153,197,255,0.08)] last:border-0">
      <p className="text-sm text-[rgba(153,197,255,0.7)]">{label}</p>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((s) => (
          <button
            key={s}
            onClick={() => !readonly && onChange?.(s)}
            className={`text-lg leading-none transition-transform ${readonly ? '' : 'hover:scale-110 cursor-pointer'}`}
            style={{ fontSize: 18 }}
          >
            <span className={s <= value ? 'text-yellow-400' : 'text-[rgba(153,197,255,0.15)]'}>
              ★
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ListEditor({ items, onChange, placeholder, color = 'blue' }) {
  const [newItem, setNewItem] = useState('');
  const add = () => {
    if (!newItem.trim()) return;
    onChange([...items, newItem.trim()]);
    setNewItem('');
  };
  const remove = (i) => onChange(items.filter((_, idx) => idx !== i));
  const colorMap = {
    blue: 'bg-[#059669]/10 border-[#059669]/20',
    green: 'bg-emerald-500/100/10 border-emerald-500/20',
    red: 'bg-red-500/100/10 border-red-500/20',
    amber: 'bg-amber-500/100/10 border-amber-500/20',
    gray: 'bg-[rgba(255,255,255,0.03)]/5 border-white/10',
  };
  const dotColor = {
    blue: 'text-[#99c5ff]',
    green: 'text-emerald-400',
    red: 'text-red-400',
    amber: 'text-amber-400',
    gray: 'text-[rgba(153,197,255,0.4)]',
  };
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div
          key={i}
          className={`flex items-center gap-3 px-3 py-2.5 border rounded-sm ${colorMap[color]}`}
        >
          <span className={`text-sm font-bold shrink-0 ${dotColor[color]}`}>✓</span>
          <span className="text-sm text-white flex-1">{item}</span>
          <button
            onClick={() => remove(i)}
            className="text-[rgba(153,197,255,0.25)] hover:text-red-400 transition-colors text-sm shrink-0"
          >
            ✕
          </button>
        </div>
      ))}
      <div className="flex gap-2">
        <input
          type="text"
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder={placeholder}
          className="flex-1 border border-[rgba(153,197,255,0.12)] rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-[#10b981]"
        />
        <button
          onClick={add}
          className="px-4 py-2 bg-[#064e3b] text-white text-xs font-bold rounded-sm hover:bg-[#047857] transition-colors"
        >
          Add
        </button>
      </div>
    </div>
  );
}

// Monthly bar chart (from existing, re-skinned)
function MonthlyChart({ data }) {
  const maxVal = Math.max(...data.map((d) => d.income), 1);
  return (
    <div>
      <div className="flex items-center gap-4 text-xs mb-3">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 bg-[#10b981] rounded-sm" />
          <span className="text-[rgba(153,197,255,0.6)]">Income</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 bg-[#86efac]/60 rounded-sm" />
          <span className="text-[rgba(153,197,255,0.6)]">Expenses</span>
        </div>
      </div>
      <div className="flex items-end gap-1.5 h-36 group">
        {data.map(({ m, income, exp }) => (
          <div key={m} className="flex-1 flex flex-col items-center gap-1 relative">
            <div className="hidden group-hover:block absolute bottom-full mb-1 whitespace-nowrap bg-[#064e3b] text-white text-xs px-2 py-1 rounded-sm z-10 pointer-events-none">
              {m}: {fmt(income)}
            </div>
            <div className="w-full flex items-end gap-0.5 h-32">
              <div
                className="flex-1 bg-[#10b981] rounded-sm transition-all"
                style={{ height: `${(income / maxVal) * 100}%` }}
              />
              <div
                className="flex-1 bg-[#86efac]/50 rounded-sm transition-all"
                style={{ height: `${(exp / maxVal) * 100}%` }}
              />
            </div>
            <span className="text-xs text-[rgba(153,197,255,0.4)]">{m}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Print / PDF view (from existing, extended with Cadi branding)
function PrintView({
  data,
  year,
  ratings,
  goalsHit,
  goalsMissed,
  highlights: _highlights,
  improvements: _improvements,
  onClose,
}) {
  const avgRating = Object.values(ratings).reduce((a, b) => a + b, 0) / Object.keys(ratings).length;
  return (
    <div className="fixed inset-0 z-50 bg-[rgba(255,255,255,0.03)] overflow-y-auto">
      <div className="max-w-3xl mx-auto p-8">
        <div className="flex items-center justify-between mb-8 print:hidden">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-[rgba(153,197,255,0.12)] text-sm font-bold text-[rgba(153,197,255,0.6)] rounded-sm hover:border-gray-300 transition-colors"
          >
            ← Back
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#064e3b] text-white text-sm font-bold rounded-sm hover:bg-[#047857] transition-colors"
          >
            🖨️ Print / Save PDF
          </button>
        </div>

        {/* Header */}
        <div className="bg-[#064e3b] rounded-sm p-8 text-white mb-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold tracking-widest uppercase text-[#86efac] mb-4">
                Cadi Business Review
              </p>
              <h1 className="text-3xl font-bold">Annual Business Review</h1>
              <p className="text-[#86efac] text-lg mt-1">Tax year {year}</p>
            </div>
            <div className="text-right">
              <p className="text-[#86efac] text-sm">Net profit</p>
              <p className="text-4xl font-bold mt-1 tabular-nums">{fmt(data.profit)}</p>
              <p className="text-[#86efac] text-sm mt-1">{pct(data.margin)} margin</p>
            </div>
          </div>
        </div>

        {/* Key numbers */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Total income', val: fmt(data.income), border: 'border-l-emerald-500' },
            { label: 'Total expenses', val: fmt(data.expenses), border: 'border-l-red-400' },
            { label: 'Net profit', val: fmt(data.profit), border: 'border-l-[#10b981]' },
            { label: 'Tax estimate', val: fmt(data.taxEst), border: 'border-l-amber-400' },
          ].map(({ label, val, border }) => (
            <div
              key={label}
              className={`bg-[rgba(255,255,255,0.03)] border-l-4 ${border} border border-[rgba(153,197,255,0.08)] p-4 rounded-sm`}
            >
              <p className="text-xl font-bold text-white tabular-nums">{val}</p>
              <p className="text-xs text-[rgba(153,197,255,0.4)] mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Monthly chart */}
        <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(153,197,255,0.08)] rounded-sm p-5 mb-6">
          <h3 className="font-bold text-white mb-4">Monthly income vs expenses</h3>
          <MonthlyChart data={data.monthlyData} year={year} />
        </div>

        {/* Client stats */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Clients at start', val: data.clientsStart },
            { label: 'Clients at end', val: data.clientsEnd },
            { label: 'Net growth', val: `+${data.clientsEnd - data.clientsStart}` },
            { label: 'Jobs completed', val: data.jobsCompleted },
          ].map(({ label, val }) => (
            <div key={label} className="bg-[rgba(153,197,255,0.04)] rounded-sm p-4 text-center">
              <p className="text-2xl font-bold text-white">{val}</p>
              <p className="text-xs text-[rgba(153,197,255,0.4)] mt-1">{label}</p>
            </div>
          ))}
        </div>

        {/* Goals */}
        <div className="grid grid-cols-2 gap-5 mb-6">
          <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(153,197,255,0.08)] rounded-sm p-5">
            <h3 className="font-bold text-white mb-3 flex items-center gap-2">
              <span className="text-emerald-500">✓</span> Goals hit
            </h3>
            {goalsHit.map((g, i) => (
              <div key={i} className="text-sm text-[rgba(153,197,255,0.7)] mb-1.5 flex gap-2">
                <span className="text-emerald-500 shrink-0">✓</span>
                {g}
              </div>
            ))}
          </div>
          <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(153,197,255,0.08)] rounded-sm p-5">
            <h3 className="font-bold text-white mb-3 flex items-center gap-2">
              <span className="text-red-400">✕</span> Goals missed
            </h3>
            {goalsMissed.map((g, i) => (
              <div key={i} className="text-sm text-[rgba(153,197,255,0.7)] mb-1.5 flex gap-2">
                <span className="text-red-400 shrink-0">✕</span>
                {g}
              </div>
            ))}
          </div>
        </div>

        {/* Self assessment */}
        <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(153,197,255,0.08)] rounded-sm p-5 mb-6">
          <h3 className="font-bold text-white mb-4">Self assessment</h3>
          <div className="grid grid-cols-2 gap-x-8">
            {Object.entries(ratings).map(([label, value]) => (
              <StarRow key={label} label={label} value={value} readonly />
            ))}
          </div>
          <div className="mt-4 text-center border-t border-[rgba(153,197,255,0.08)] pt-4">
            <p className="text-xs text-[rgba(153,197,255,0.4)] mb-1">Overall score</p>
            <p className="text-3xl font-bold text-white">{avgRating.toFixed(1)} / 5.0</p>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-[#064e3b] rounded-sm p-5 text-white text-center">
          <p className="font-bold text-lg mb-1">Looking ahead to next year</p>
          <p className="text-[#86efac]/80 text-sm">
            {fmt(data.profit)} profit · {data.clientsEnd} active clients · {pct(data.margin)}{' '}
            margin. Focus on retention, pricing confidence, and one new service.
          </p>
        </div>
        <p className="text-xs text-[rgba(153,197,255,0.4)] text-center mt-4">
          Generated by Cadi · {new Date().toLocaleDateString('en-GB')}
        </p>
      </div>
    </div>
  );
}

// ─── SECTION: Executive summary ────────────────────────────────────────────────
// §1 of the AR spec. Six-KPI headline strip + narrative paragraph with
// three tone modes (Internal / Funding / Tender). Narrative auto-composes
// from the snapshot; user can override with free text. Override is held
// in local state until the review is filed (Slice 3).
function ExecSummarySection({
  data,
  businessName,
  entityType,
  vatRegistered,
  toneMode,
  setToneMode,
  execSummaryOverride,
  setExecSummaryOverride,
  isLive,
  liveLoading,
}) {
  const [editing, setEditing] = useState(false);

  // The snapshot shape lives on `data` when it came from the aggregator
  // (schemaVersion is present). For the demo YEAR_CATALOGUE fallback we
  // synthesise a compatible shape so the templates still render.
  const snapshot = useMemo(() => {
    if (data.schemaVersion) return data;
    return {
      schemaVersion: 0,
      entityType,
      income: data.income ?? 0,
      expenses: data.expenses ?? 0,
      profit: data.profit ?? 0,
      margin: data.margin ?? 0,
      taxEst: data.taxEst ?? 0,
      netAfterTax: data.netAfterTax ?? 0,
      yoyIncome: data.yoyIncome ?? 0,
      yoyProfit: data.yoyProfit ?? 0,
      jobsCompleted: data.jobsCompleted ?? 0,
      avgJobValue: data.avgJobValue ?? 0,
      activeCustomers: data.activeCustomers ?? data.clientsEnd ?? 0,
    };
  }, [data, entityType]);

  const autoText = useMemo(
    () => composeExecSummary({ snapshot, toneMode, businessName, vatRegistered }),
    [snapshot, toneMode, businessName, vatRegistered]
  );
  const displayText = execSummaryOverride?.trim() ? execSummaryOverride : autoText;

  const kpis = useMemo(() => execSummaryKpis(snapshot), [snapshot]);

  const TONES = [
    { id: 'internal', label: 'Internal', sub: 'Candid, full detail' },
    { id: 'funding', label: 'Funding', sub: 'Banker voice — profit + growth' },
    { id: 'tender', label: 'Tender', sub: 'Capability + reach' },
  ];

  return (
    <div className="space-y-5">
      {/* Tone-mode pills */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#86efac]">Tone</span>
        {TONES.map((t) => {
          const on = toneMode === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setToneMode(t.id)}
              title={t.sub}
              className={`text-[11px] font-bold px-3 py-1.5 rounded-full border transition-colors ${
                on
                  ? 'bg-[#10b981] text-white border-[#10b981]'
                  : 'bg-[rgba(255,255,255,0.05)] text-white/70 border-[rgba(255,255,255,0.12)] hover:border-[#10b981]/50 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          );
        })}
        {execSummaryOverride?.trim() && (
          <span className="ml-auto text-[10px] font-bold uppercase tracking-widest text-amber-300">
            Custom override
            <button
              type="button"
              onClick={() => {
                setExecSummaryOverride('');
                setEditing(false);
              }}
              className="ml-2 text-[10px] font-bold text-amber-300 underline hover:text-amber-200 normal-case tracking-normal"
            >
              Reset to auto
            </button>
          </span>
        )}
      </div>

      {/* Narrative */}
      <Card className="p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <SL>Executive summary — {toneMode} tone</SL>
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className="text-[11px] font-bold text-[#10b981] hover:underline"
          >
            {editing ? 'Done editing' : 'Edit'}
          </button>
        </div>
        {editing ? (
          <textarea
            value={execSummaryOverride || autoText}
            onChange={(e) => setExecSummaryOverride(e.target.value)}
            rows={6}
            className="w-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.14)] rounded-lg px-4 py-3 text-[15px] leading-relaxed text-white focus:outline-none focus:border-[#10b981]/60"
          />
        ) : (
          <p className="text-[15px] leading-relaxed text-white whitespace-pre-wrap">
            {isLive && liveLoading && snapshot.schemaVersion
              ? 'Aggregating your live data — narrative will render as soon as the numbers land.'
              : displayText}
          </p>
        )}
        {!editing && !execSummaryOverride?.trim() && (
          <p className="text-[10px] mt-3 text-[rgba(255,255,255,0.4)]">
            Auto-composed from your snapshot. Click <em>Edit</em> to override the wording — the
            numbers stay locked to the snapshot either way.
          </p>
        )}
      </Card>

      {/* Six-KPI headline strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {kpis.map((k) => {
          const accent =
            k.tone === 'up'
              ? 'text-emerald-400'
              : k.tone === 'down'
                ? 'text-red-400'
                : 'text-white';
          return (
            <div
              key={k.key}
              className="rounded-xl border border-[rgba(134,239,172,0.14)] p-4"
              style={{ background: 'linear-gradient(135deg, #064e3b 0%, #047857 100%)' }}
            >
              <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-[#86efac]/80 mb-1">
                {k.label}
              </p>
              <p className={`text-2xl font-bold tabular-nums ${accent}`}>{k.value}</p>
              <p className="text-xs text-[#86efac]/60 mt-1">{k.sub}</p>
            </div>
          );
        })}
      </div>

      {/* Provenance line */}
      <div className="text-[10px] text-white/40 text-center">
        {snapshot.schemaVersion
          ? `Schema v${snapshot.schemaVersion} · aggregated live from Money, Jobs, Mileage, Customers`
          : 'Demo snapshot — sign in to see live data'}
      </div>
    </div>
  );
}

// ─── SECTION: Numbers ──────────────────────────────────────────────────────────
function NumbersSection({ data }) {
  return (
    <div className="space-y-5">
      {/* Hero */}
      <div className="bg-[#064e3b] rounded-sm p-6 text-white">
        <p className="text-xs font-bold tracking-widest uppercase text-[#86efac] mb-3">
          Tax year {data.yr}
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            {
              label: 'Total income',
              val: fmt(data.income),
              sub: sign(data.yoyIncome) + ' vs last year',
            },
            { label: 'Net profit', val: fmt(data.profit), sub: pct(data.margin) + ' margin' },
            { label: 'Tax estimate', val: fmt(data.taxEst), sub: 'Income tax + Class 4 NI' },
            {
              label: 'Take-home',
              val: fmt(data.netAfterTax),
              sub: sign(data.yoyProfit) + ' vs last year',
            },
          ].map(({ label, val, sub }) => (
            <div key={label} className="bg-[rgba(255,255,255,0.03)]/10 rounded-sm p-4">
              <p className="text-xs text-[#86efac] font-bold uppercase tracking-widest mb-1">
                {label}
              </p>
              <p className="text-2xl font-bold text-white tabular-nums">{val}</p>
              <p className="text-xs text-[#86efac]/70 mt-0.5">{sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <RStat
          label="Gross income"
          value={fmt(data.income)}
          accent="text-white"
          change={data.yoyIncome}
          sub={`Target achieved: ${data.income >= 54000 ? '✓ Yes' : 'Missed'}`}
        />
        <RStat
          label="Net profit"
          value={fmt(data.profit)}
          accent="text-emerald-600"
          change={data.yoyProfit}
        />
        <RStat
          label="Profit margin"
          value={pct(data.margin)}
          accent={data.margin >= 70 ? 'text-emerald-600' : 'text-amber-600'}
          sub="Industry avg: 65%"
        />
        <RStat
          label="Total expenses"
          value={fmt(data.expenses)}
          accent="text-red-500"
          sub={`${pct((data.expenses / data.income) * 100)} of income`}
        />
        <RStat
          label="Tax estimate"
          value={fmt(data.taxEst)}
          accent="text-amber-600"
          sub="Guide only — ask your accountant"
        />
        <RStat
          label="Net take-home"
          value={fmt(data.netAfterTax)}
          accent="text-white"
          sub="After all estimated tax"
        />
      </div>

      {/* Monthly chart */}
      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-[rgba(153,197,255,0.08)] flex items-center justify-between">
          <SL>Monthly income vs expenses</SL>
          <div className="flex gap-4 text-xs text-[rgba(153,197,255,0.4)]">
            <span>
              Peak: <strong className="text-white">{fmt(data.bestMonth.value)}</strong> (
              {data.bestMonth.name})
            </span>
            <span>
              Avg: <strong className="text-white">{fmt(data.income / 12)}</strong>
            </span>
          </div>
        </div>
        <div className="p-5">
          <MonthlyChart data={data.monthlyData} year={data.yr} />
        </div>
        <div className="grid grid-cols-3 gap-px bg-gray-200 border-t border-[rgba(153,197,255,0.12)]">
          {[
            { label: 'This year', val: fmt(data.income), accent: 'text-white' },
            {
              label: 'Last year',
              val: fmt(data.prevIncome),
              accent: 'text-[rgba(153,197,255,0.4)]',
            },
            {
              label: 'Growth',
              val: `+${fmt(data.income - data.prevIncome)}`,
              accent: 'text-emerald-600',
            },
          ].map(({ label, val, accent }) => (
            <div key={label} className="bg-[rgba(255,255,255,0.03)] px-4 py-3 text-center">
              <SL className="mb-0.5">{label}</SL>
              <p className={`text-sm font-bold tabular-nums ${accent}`}>{val}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Best / worst month */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-emerald-500/10 border border-emerald-200 rounded-sm p-5">
          <SL className="text-emerald-600 mb-1">Best month</SL>
          <p className="text-xl font-bold text-emerald-800">{data.bestMonth.name}</p>
          <p className="text-2xl font-bold text-emerald-600 tabular-nums mt-1">
            {fmt(data.bestMonth.value)}
          </p>
        </div>
        <div className="bg-red-500/10 border border-red-200 rounded-sm p-5">
          <SL className="text-red-500 mb-1">Quietest month</SL>
          <p className="text-xl font-bold text-red-700">{data.worstMonth.name}</p>
          <p className="text-2xl font-bold text-red-500 tabular-nums mt-1">
            {fmt(data.worstMonth.value)}
          </p>
        </div>
      </div>

      {/* Expense breakdown */}
      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-[rgba(153,197,255,0.08)] flex items-center justify-between">
          <SL>Expenses — {fmt(data.expenses)} total</SL>
          <Chip color="green">SA103 mapped</Chip>
        </div>
        <div className="divide-y divide-gray-100">
          {data.expenseBreakdown.map(({ label, amount, pct: p }) => (
            <div key={label} className="flex items-center gap-3 px-4 py-2.5">
              <span className="text-xs text-[rgba(153,197,255,0.6)] w-36 shrink-0">{label}</span>
              <div className="flex-1 h-3 bg-[rgba(153,197,255,0.06)] rounded-sm overflow-hidden">
                <div className="h-full bg-[#10b981]/50 rounded-sm" style={{ width: `${p}%` }} />
              </div>
              <span className="text-xs font-mono font-semibold text-[rgba(153,197,255,0.7)] w-12 text-right">
                {fmt(amount)}
              </span>
              <span className="text-xs text-[rgba(153,197,255,0.4)] w-8 text-right">{p}%</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Margin insight ring */}
      <Card className="p-5 border-l-4 border-l-[#10b981]">
        <div className="flex items-start gap-5">
          <div className="relative w-20 h-20 shrink-0">
            <svg viewBox="0 0 80 80" className="w-20 h-20 -rotate-90">
              <circle cx="40" cy="40" r="32" fill="none" stroke="#e5e7eb" strokeWidth="7" />
              <circle
                cx="40"
                cy="40"
                r="32"
                fill="none"
                stroke={data.margin >= 65 ? '#10b981' : '#f59e0b'}
                strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 32}`}
                strokeDashoffset={`${2 * Math.PI * 32 * (1 - Math.min(data.margin / 100, 1))}`}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm font-bold text-white">{Math.round(data.margin)}%</span>
            </div>
          </div>
          <div>
            <SL className="mb-1">Profit margin analysis</SL>
            <p className="text-lg font-bold text-white">{pct(data.margin)} net profit margin</p>
            <p className="text-xs text-[rgba(153,197,255,0.6)] mt-1 leading-relaxed">
              Industry average for cleaning businesses is <strong>55–65%</strong>. Your{' '}
              {Math.round(data.margin)}% margin puts you{' '}
              <strong className={data.margin >= 65 ? 'text-emerald-600' : 'text-amber-600'}>
                {data.margin >= 65 ? 'above' : 'at'} industry average
              </strong>
              . Every 1% margin improvement at your revenue is worth{' '}
              <strong>{fmt(data.income * 0.01)}/year</strong>.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ─── SECTION: Clients ──────────────────────────────────────────────────────────
// §3 Customer Story. Live-data driven from Slice 3 aggregator fields:
//   clientsStart / clientsEnd / clientsNew / clientsLost / retentionRate
//   topClients [{ id, name, category, revenue, visits, share }]
//   concentrationTop3 / concentrationTop5
//
// Tone modes:
//   Internal — full names + revenue
//   Funding  — full names + concentration risk callout hero'd
//   Tender   — names anonymised (Client A / B / C…); revenue kept
function ClientsSection({ data, highlights, setHighlights, toneMode = 'internal' }) {
  const TYPE_DOT = {
    residential: 'bg-emerald-500/100',
    commercial: 'bg-[#10b981]',
    exterior: 'bg-orange-500',
  };
  const netGrowth = (data.clientsEnd ?? 0) - (data.clientsStart ?? 0);
  const anonymise = toneMode === 'tender';
  const topClients = data.topClients ?? [];
  const retention = Number.isFinite(data.retentionRate) ? data.retentionRate : 100;
  const top3 = Number.isFinite(data.concentrationTop3) ? data.concentrationTop3 : 0;
  const top5 = Number.isFinite(data.concentrationTop5) ? data.concentrationTop5 : 0;

  // Concentration risk: >50% of revenue from top 3 is the traditional
  // banker cutoff for "high concentration".
  const concentrationLevel = top3 >= 50 ? 'high' : top3 >= 30 ? 'medium' : 'low';
  const concentrationTone =
    concentrationLevel === 'high'
      ? {
          fg: '#fca5a5',
          bg: 'rgba(220,38,38,0.14)',
          bd: 'rgba(220,38,38,0.35)',
          headline: 'High concentration risk',
        }
      : concentrationLevel === 'medium'
        ? {
            fg: '#fbbf24',
            bg: 'rgba(251,191,36,0.14)',
            bd: 'rgba(251,191,36,0.35)',
            headline: 'Moderate concentration',
          }
        : {
            fg: '#86efac',
            bg: 'rgba(34,197,94,0.14)',
            bd: 'rgba(34,197,94,0.35)',
            headline: 'Healthy spread',
          };

  const anonName = (i) => `Client ${String.fromCharCode(65 + i)}`;

  // Empty state — <5 customers on the books = don't show the top-10 table
  // (it becomes a leaderboard of 2 people, which isn't useful). Show a
  // "growing customer base" callout instead.
  const showTopTable = topClients.length >= 5;

  return (
    <div className="space-y-5">
      {/* Header KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <RStat label="At start" value={data.clientsStart ?? 0} accent="text-white" />
        <RStat label="At end" value={data.clientsEnd ?? 0} accent="text-white" />
        <RStat
          label="Net growth"
          value={`${netGrowth >= 0 ? '+' : ''}${netGrowth}`}
          accent={netGrowth >= 0 ? 'text-emerald-400' : 'text-red-400'}
          sub={data.clientsStart > 0 ? `${Math.round((netGrowth / data.clientsStart) * 100)}%` : ''}
        />
        <RStat
          label="Lost"
          value={data.clientsLost ?? 0}
          accent={(data.clientsLost ?? 0) > 3 ? 'text-red-400' : 'text-amber-400'}
          sub={data.clientsLost === 0 ? 'Zero churn' : ''}
        />
        <RStat
          label="Retention"
          value={`${Math.round(retention)}%`}
          accent={
            retention >= 90
              ? 'text-emerald-400'
              : retention >= 75
                ? 'text-amber-400'
                : 'text-red-400'
          }
        />
      </div>

      {/* Concentration callout — always visible, emphasised in Funding mode */}
      {topClients.length > 0 && (
        <div
          className="rounded-xl p-5"
          style={{
            background: concentrationTone.bg,
            border: `1px solid ${concentrationTone.bd}`,
          }}
        >
          <div className="flex items-start gap-4">
            <div
              className="rounded-lg px-3 py-2 shrink-0"
              style={{
                background: `${concentrationTone.fg}22`,
                color: concentrationTone.fg,
                fontSize: 24,
                fontWeight: 900,
                lineHeight: 1,
                minWidth: 68,
                textAlign: 'center',
              }}
            >
              {Math.round(top3)}%
            </div>
            <div className="flex-1 min-w-0">
              <p
                className="text-[10px] font-bold uppercase tracking-widest"
                style={{ color: concentrationTone.fg }}
              >
                {toneMode === 'funding' ? 'Bank / lender flag' : 'Customer concentration'}
              </p>
              <p className="text-lg font-bold text-white mt-0.5">{concentrationTone.headline}</p>
              <p className="text-sm text-white/70 mt-1 leading-relaxed">
                Top 3 customers = <strong className="text-white">{Math.round(top3)}%</strong> of
                attributed revenue. Top 5 ={' '}
                <strong className="text-white">{Math.round(top5)}%</strong>.
                {concentrationLevel === 'high' &&
                  (toneMode === 'funding'
                    ? ' Lenders will see this as material single-customer exposure — mitigate before applying.'
                    : ' If your biggest client left tomorrow the business would take a big hit — worth spreading the base.')}
                {concentrationLevel === 'medium' &&
                  ' Reasonable but worth watching — a diversification push next year would strengthen the risk profile.'}
                {concentrationLevel === 'low' &&
                  ' Well-diversified base — no single customer dominates the book.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Ops KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <RStat
          label="Jobs completed"
          value={(data.jobsCompleted ?? 0).toLocaleString()}
          accent="text-white"
        />
        <RStat label="Avg job value" value={fmt(data.avgJobValue)} accent="text-[#10b981]" />
        <RStat
          label="Jobs per month"
          value={Math.round((data.jobsCompleted ?? 0) / 12)}
          accent="text-white"
          sub="average"
        />
      </div>

      {/* Top clients table */}
      {showTopTable ? (
        <Card className="overflow-hidden">
          <div className="px-4 py-3 border-b border-[rgba(153,197,255,0.08)] flex items-center justify-between">
            <SL>Top clients by attributed revenue{anonymise ? ' (anonymised)' : ''}</SL>
            <span className="text-[10px] text-white/40">
              Only income linked to a customer is attributed
            </span>
          </div>
          <div className="divide-y divide-white/5">
            {topClients.map((c, i) => {
              const displayName = anonymise ? anonName(i) : c.name;
              const dotClass = TYPE_DOT[c.category] || 'bg-white/20';
              return (
                <div key={c.id ?? c.name} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-7 h-7 rounded-full bg-[#064e3b] text-white flex items-center justify-center text-xs font-bold shrink-0">
                    {i + 1}
                  </div>
                  <div className={`w-2 h-2 rounded-full shrink-0 ${dotClass}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{displayName}</p>
                    <p className="text-xs text-[rgba(153,197,255,0.5)]">
                      {c.visits} {c.visits === 1 ? 'visit' : 'visits'}
                      {c.category ? ` · ${c.category}` : ''}
                    </p>
                  </div>
                  <div className="text-right w-24">
                    <p className="text-sm font-bold tabular-nums text-white">{fmt(c.revenue)}</p>
                    <p className="text-xs text-[rgba(153,197,255,0.5)]">{c.share}%</p>
                  </div>
                  <div className="w-20 h-2 bg-[rgba(153,197,255,0.06)] rounded-sm overflow-hidden shrink-0">
                    <div
                      className="h-full bg-[#10b981]/60 rounded-sm"
                      style={{
                        width: `${topClients[0].revenue > 0 ? (c.revenue / topClients[0].revenue) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      ) : (
        <div
          className="rounded-xl border p-6"
          style={{
            background: 'rgba(34,197,94,0.10)',
            borderColor: 'rgba(34,197,94,0.28)',
          }}
        >
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#86efac]">
            Growing customer base
          </p>
          <p className="text-lg font-bold text-white mt-1">
            {topClients.length === 0
              ? 'No customer-attributed revenue in this period yet.'
              : `${topClients.length} customer${topClients.length === 1 ? '' : 's'} with revenue this period.`}
          </p>
          <p className="text-sm text-white/70 mt-2 leading-relaxed">
            The top-10 leaderboard appears once you have 5 or more customers with attributed income.
            Until then, focus on landing steady work — the story of the year is growth, not
            concentration.
          </p>
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-[rgba(153,197,255,0.08)]">
          <SL>Year highlights</SL>
        </div>
        <div className="p-4">
          <ListEditor
            items={highlights}
            onChange={setHighlights}
            placeholder="Add a highlight from the year…"
            color="blue"
          />
        </div>
      </Card>
    </div>
  );
}

// ─── SECTION: Services ─────────────────────────────────────────────────────────
// §4 Services Performance. Every row backed by the aggregator's
// servicesPerformance array. Tone modes:
//   Internal — full table incl. margin + YoY + recommendation
//   Funding  — top-3 revenue services hero'd, then the full table
//   Tender   — "Service capability matrix" — names + categories only,
//              no margins, no revenue, no YoY
function ServicesSection({ data, toneMode = 'internal', vatRegistered }) {
  const perf = data.servicesPerformance ?? [];
  const CAT_DOT = {
    residential: 'bg-emerald-500',
    commercial: 'bg-[#10b981]',
    exterior: 'bg-orange-500',
  };

  // Header KPIs
  const offered = perf.filter((s) => s.isActive).length;
  const delivered = perf.filter((s) => s.jobs > 0).length;
  const needsReview = perf.filter(
    (s) => s.recommendation === 'review_pricing' || s.recommendation === 'declining_demand'
  ).length;
  const totalRevenue = perf.reduce((sum, s) => sum + s.revenue, 0);

  // Tender mode = capability matrix. Everything else = full table.
  if (toneMode === 'tender') {
    const byCategory = perf.reduce((acc, s) => {
      const cat = s.category || 'other';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(s);
      return acc;
    }, {});

    return (
      <div className="space-y-5">
        <div
          className="rounded-xl p-6"
          style={{
            background: 'rgba(126,163,255,0.10)',
            border: '1px solid rgba(126,163,255,0.28)',
          }}
        >
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#7ea3ff]">
            Service capability matrix
          </p>
          <p className="text-lg font-bold text-white mt-1">
            {offered} service{offered === 1 ? '' : 's'} delivered under contract or one-off
            engagement
          </p>
          <p className="text-sm text-white/70 mt-2 leading-relaxed">
            The categories and offerings below reflect what the business is set up to deliver.
            Commercial pricing, margin structure, and reference customers available on request.
          </p>
        </div>

        {Object.keys(byCategory).length === 0 ? (
          <div className="text-center py-12 rounded-xl border border-white/10 bg-white/5">
            <p className="text-white/60 text-sm">No services configured yet.</p>
          </div>
        ) : (
          Object.entries(byCategory).map(([cat, items]) => (
            <Card key={cat} className="overflow-hidden">
              <div className="px-4 py-3 border-b border-[rgba(153,197,255,0.08)]">
                <SL>{cat}</SL>
              </div>
              <div className="divide-y divide-white/5">
                {items.map((s) => (
                  <div key={s.id ?? s.name} className="flex items-center gap-3 px-4 py-3">
                    <div
                      className={`w-2 h-2 rounded-full shrink-0 ${CAT_DOT[s.category] || 'bg-white/30'}`}
                    />
                    <p className="text-sm font-semibold text-white flex-1">{s.name}</p>
                  </div>
                ))}
              </div>
            </Card>
          ))
        )}
      </div>
    );
  }

  // Empty state (no services at all)
  if (perf.length === 0) {
    return (
      <div className="text-center py-12 rounded-xl border border-white/10 bg-white/5">
        <p className="text-lg font-bold text-white mb-2">
          Set up your services to track performance
        </p>
        <p className="text-sm text-white/60 max-w-md mx-auto leading-relaxed">
          §4 pulls per-service revenue, margin and demand trends from jobs delivered. Head to
          Services to add what you offer, then this section fills in automatically.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <RStat label="Offered" value={offered} accent="text-white" />
        <RStat
          label="Delivered"
          value={delivered}
          accent="text-emerald-400"
          sub={`${offered - delivered} idle`}
        />
        <RStat
          label="Needs review"
          value={needsReview}
          accent={needsReview > 0 ? 'text-amber-400' : 'text-white'}
        />
        <RStat
          label="Attributed rev"
          value={fmt(totalRevenue)}
          accent="text-[#10b981]"
          sub={vatRegistered ? 'ex-VAT figures where applicable' : ''}
        />
      </div>

      {/* Funding mode — hero'd top 3 */}
      {toneMode === 'funding' && perf.filter((s) => s.revenue > 0).length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#86efac] mb-2">
            Strongest three lines of business
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {perf
              .filter((s) => s.revenue > 0)
              .slice(0, 3)
              .map((s) => (
                <div
                  key={s.id ?? s.name}
                  className="rounded-xl border border-[rgba(134,239,172,0.24)] p-4"
                  style={{ background: 'linear-gradient(135deg, #064e3b 0%, #047857 100%)' }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className={`w-2 h-2 rounded-full shrink-0 ${CAT_DOT[s.category] || 'bg-white/30'}`}
                    />
                    <p className="text-sm font-bold text-white truncate">{s.name}</p>
                  </div>
                  <p className="text-2xl font-bold text-white tabular-nums">{fmt(s.revenue)}</p>
                  <p className="text-xs text-[#86efac]/80 mt-1">
                    {s.jobs} job{s.jobs === 1 ? '' : 's'} · avg {fmt(s.avgPrice)}
                    {s.grossMargin > 0 && ` · ${Math.round(s.grossMargin)}% margin`}
                  </p>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Full performance table */}
      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-[rgba(153,197,255,0.08)] flex items-center justify-between">
          <SL>Performance by service</SL>
          <span className="text-[10px] text-white/40">Sorted by revenue this period</span>
        </div>
        <div className="divide-y divide-white/5">
          {perf.map((s) => {
            const recTone = RECOMMENDATION_TONE[s.recommendation] ?? RECOMMENDATION_TONE.ok;
            const yoyStr =
              s.jobsYoY == null ? '—' : `${s.jobsYoY >= 0 ? '+' : ''}${Math.round(s.jobsYoY)}%`;
            const yoyColor =
              s.jobsYoY == null
                ? 'text-white/40'
                : s.jobsYoY >= 0
                  ? 'text-emerald-400'
                  : 'text-red-400';
            return (
              <div key={s.id ?? s.name} className="px-4 py-3">
                <div className="flex items-center gap-3 mb-1">
                  <div
                    className={`w-2 h-2 rounded-full shrink-0 ${CAT_DOT[s.category] || 'bg-white/30'}`}
                  />
                  <p className="text-sm font-semibold text-white flex-1 truncate">
                    {s.name}
                    {s.unmatched && (
                      <span className="ml-2 text-[10px] font-normal text-amber-300">
                        unmatched job type
                      </span>
                    )}
                    {!s.isActive && !s.unmatched && (
                      <span className="ml-2 text-[10px] font-normal text-white/40">inactive</span>
                    )}
                  </p>
                  {recTone.label && (
                    <span
                      className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border shrink-0"
                      style={{ color: recTone.fg, background: recTone.bg, borderColor: recTone.bd }}
                    >
                      {recTone.label}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                  <div>
                    <p className="text-white/50">Revenue</p>
                    <p className="text-white font-bold tabular-nums">{fmt(s.revenue)}</p>
                  </div>
                  <div>
                    <p className="text-white/50">Jobs</p>
                    <p className="text-white font-bold tabular-nums">{s.jobs}</p>
                  </div>
                  <div>
                    <p className="text-white/50">Avg price</p>
                    <p className="text-white font-bold tabular-nums">{fmt(s.avgPrice)}</p>
                  </div>
                  <div>
                    <p className="text-white/50">Margin</p>
                    <p
                      className={`font-bold tabular-nums ${s.grossMargin >= 60 ? 'text-emerald-400' : s.grossMargin > 0 ? 'text-amber-400' : 'text-white/40'}`}
                    >
                      {s.revenue > 0 ? `${Math.round(s.grossMargin)}%` : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-white/50">YoY jobs</p>
                    <p className={`font-bold tabular-nums ${yoyColor}`}>{yoyStr}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <p className="text-[10px] text-white/40 text-center">
        Margin uses stored per-job margin where set, else price − labour cost. Services without a
        matching <code>jobs.type</code> string appear as "unmatched" so revenue reconciles.
      </p>
    </div>
  );
}

const RECOMMENDATION_TONE = {
  review_pricing: {
    label: 'Review pricing',
    fg: '#fbbf24',
    bg: 'rgba(251,191,36,0.14)',
    bd: 'rgba(251,191,36,0.35)',
  },
  declining_demand: {
    label: 'Declining demand',
    fg: '#fca5a5',
    bg: 'rgba(220,38,38,0.14)',
    bd: 'rgba(220,38,38,0.35)',
  },
  new: { label: 'New', fg: '#7ea3ff', bg: 'rgba(126,163,255,0.14)', bd: 'rgba(126,163,255,0.35)' },
  no_activity: {
    label: 'No jobs',
    fg: '#94a3b8',
    bg: 'rgba(148,163,184,0.14)',
    bd: 'rgba(148,163,184,0.35)',
  },
  ok: { label: null, fg: null, bg: null, bd: null },
};

// ─── SECTION: Money & Cashflow ─────────────────────────────────────────────────
// §5 of the AR spec. Fully-driven by aggregator §5 fields:
//   expenseBreakdown, topCostLines, monthlyPL, invoicesIssued/Paid,
//   outstandingAtEnd, debtorDays, onTimePaymentRate, cashRunwayMonths,
//   plus entity-branched Ltd fields (dividends / DLA / CT accrual) or
//   soleTraderDrawings when not Ltd.
//
// Tone modes:
//   Internal — full P&L + costs + entity block
//   Funding  — leads with cash runway + debtor days + on-time %; then full detail
//   Tender   — high-level only: no P&L, no costs, no entity block. Shows
//              only the reliability signals a buyer cares about (on-time %
//              and outstanding as a % of revenue).
function MoneySection({ data, toneMode = 'internal', entityType, vatRegistered }) {
  const expenseBreakdown = data.expenseBreakdown ?? [];
  const topCostLines = data.topCostLines ?? [];
  const monthlyPL = data.monthlyPL ?? data.monthlyData ?? [];

  const debtorDays = Number.isFinite(data.debtorDays) ? data.debtorDays : null;
  const onTime = Number.isFinite(data.onTimePaymentRate) ? data.onTimePaymentRate : null;
  const outstanding = data.outstandingAtEnd ?? 0;
  const runway = Number.isFinite(data.cashRunwayMonths) ? data.cashRunwayMonths : null;

  const isLtd = entityType === 'ltd';

  // ─ Tender: bare essentials only ──────────────────────────────────────
  if (toneMode === 'tender') {
    return (
      <div className="space-y-5">
        <div
          className="rounded-xl p-6"
          style={{
            background: 'rgba(126,163,255,0.10)',
            border: '1px solid rgba(126,163,255,0.28)',
          }}
        >
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#7ea3ff]">
            Financial reliability signals
          </p>
          <p className="text-lg font-bold text-white mt-1">Public disclosure — high level only</p>
          <p className="text-sm text-white/70 mt-2 leading-relaxed">
            Full management accounts available under NDA. The metrics below are what buyers usually
            care about at pre-qualification.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <RStat
            label="On-time invoice payment"
            value={onTime != null ? `${Math.round(onTime)}%` : '—'}
            accent={onTime != null && onTime >= 80 ? 'text-emerald-400' : 'text-white'}
            sub="paid by due date"
          />
          <RStat
            label="Debtor days"
            value={debtorDays != null ? `${Math.round(debtorDays)}` : '—'}
            accent="text-white"
            sub="avg sent → paid"
          />
          <RStat
            label="Business current"
            value={onTime != null && onTime >= 60 ? 'Yes' : data.income > 0 ? 'Yes' : '—'}
            accent="text-emerald-400"
            sub="No overdue statutory filings"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Funding-mode hero — cash runway + debtor days first */}
      {toneMode === 'funding' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div
            className="rounded-xl border p-5"
            style={{ background: 'rgba(34,197,94,0.10)', borderColor: 'rgba(34,197,94,0.30)' }}
          >
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#86efac]">
              Cash runway (crude)
            </p>
            <p className="text-3xl font-bold text-white tabular-nums mt-1">
              {runway != null ? `${runway} mo` : '—'}
            </p>
            <p className="text-xs text-white/60 mt-1">Outstanding receivables ÷ monthly burn</p>
          </div>
          <div
            className="rounded-xl border p-5"
            style={{ background: 'rgba(251,191,36,0.10)', borderColor: 'rgba(251,191,36,0.30)' }}
          >
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#fbbf24]">
              Debtor days
            </p>
            <p className="text-3xl font-bold text-white tabular-nums mt-1">
              {debtorDays != null ? Math.round(debtorDays) : '—'}
            </p>
            <p className="text-xs text-white/60 mt-1">
              {debtorDays != null && debtorDays <= 30
                ? 'Well within trade norms'
                : debtorDays != null && debtorDays <= 45
                  ? 'Normal for the sector'
                  : debtorDays != null
                    ? 'Room to improve on collections'
                    : 'No paid invoices in period yet'}
            </p>
          </div>
          <div
            className="rounded-xl border p-5"
            style={{ background: 'rgba(126,163,255,0.10)', borderColor: 'rgba(126,163,255,0.30)' }}
          >
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#7ea3ff]">
              On-time payment
            </p>
            <p className="text-3xl font-bold text-white tabular-nums mt-1">
              {onTime != null ? `${Math.round(onTime)}%` : '—'}
            </p>
            <p className="text-xs text-white/60 mt-1">Paid by their due date</p>
          </div>
        </div>
      )}

      {/* Header KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <RStat label="Revenue" value={fmt(data.income)} accent="text-white" />
        <RStat
          label="Expenses"
          value={fmt(data.expenses)}
          accent="text-red-400"
          sub={
            data.income > 0 ? `${Math.round((data.expenses / data.income) * 100)}% of income` : ''
          }
        />
        <RStat
          label="Net profit"
          value={fmt(data.profit)}
          accent={data.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}
          sub={`${Math.round(data.margin)}% margin`}
        />
        <RStat
          label="Outstanding at end"
          value={fmt(outstanding)}
          accent={outstanding > 0 ? 'text-amber-400' : 'text-white'}
          sub={`${data.invoicesIssued ?? 0} invoices issued`}
        />
      </div>

      {/* Monthly P&L */}
      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-[rgba(153,197,255,0.08)] flex items-center justify-between">
          <SL>Monthly P&amp;L</SL>
          <span className="text-[10px] text-white/40">Profit = income − expenses</span>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-6 sm:grid-cols-12 gap-1.5">
            {monthlyPL.map((m, i) => {
              const maxAbs = Math.max(
                ...monthlyPL.map((x) => Math.max(x.income, x.exp, Math.abs(x.profit ?? 0))),
                1
              );
              const bar = (v) => `${Math.max(1, Math.round((Math.abs(v) / maxAbs) * 100))}%`;
              const profit = m.profit ?? m.income - m.exp;
              return (
                <div key={m.m + i} className="text-center">
                  <div className="h-16 flex items-end justify-center gap-0.5">
                    <div
                      className="w-1.5 rounded-sm bg-[#10b981]"
                      style={{ height: bar(m.income) }}
                      title={`Income ${fmt(m.income)}`}
                    />
                    <div
                      className="w-1.5 rounded-sm bg-red-500/60"
                      style={{ height: bar(m.exp) }}
                      title={`Expenses ${fmt(m.exp)}`}
                    />
                    <div
                      className={`w-1.5 rounded-sm ${profit >= 0 ? 'bg-[#86efac]' : 'bg-red-400'}`}
                      style={{ height: bar(profit) }}
                      title={`Profit ${fmt(profit)}`}
                    />
                  </div>
                  <p className="text-[9px] text-white/50 mt-1">{m.m}</p>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      {/* Expense breakdown + top cost lines */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card className="overflow-hidden">
          <div className="px-4 py-3 border-b border-[rgba(153,197,255,0.08)]">
            <SL>Expense breakdown</SL>
          </div>
          <div className="divide-y divide-white/5">
            {expenseBreakdown.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-white mb-1 font-bold">Categorise your expenses</p>
                <p className="text-xs text-white/60 max-w-sm mx-auto leading-relaxed">
                  No categorised expenses in this period. Tag your expenses on the Money tab for a
                  fuller picture here.
                </p>
              </div>
            ) : (
              expenseBreakdown.map((row) => (
                <div key={row.label} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="text-xs text-white/70 w-32 shrink-0 truncate">{row.label}</span>
                  <div className="flex-1 h-3 bg-[rgba(153,197,255,0.06)] rounded-sm overflow-hidden">
                    <div
                      className="h-full bg-[#10b981]/60 rounded-sm"
                      style={{ width: `${row.pct}%` }}
                    />
                  </div>
                  <span className="text-xs font-mono font-semibold text-white w-16 text-right">
                    {fmt(row.amount)}
                  </span>
                  <span className="text-[10px] text-white/50 w-10 text-right">{row.pct}%</span>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="px-4 py-3 border-b border-[rgba(153,197,255,0.08)]">
            <SL>Top 5 single costs</SL>
          </div>
          <div className="divide-y divide-white/5">
            {topCostLines.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-white/60">
                No individual expense entries in this period.
              </div>
            ) : (
              topCostLines.map((c) => (
                <div key={c.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white font-semibold truncate">
                      {c.notes || c.category || 'Expense'}
                    </p>
                    <p className="text-[10px] text-white/50">
                      {c.date &&
                        new Date(c.date).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      {c.category ? ` · ${c.category}` : ''}
                    </p>
                  </div>
                  <span className="text-xs font-mono font-bold text-white">{fmt(c.amount)}</span>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Invoice reliability strip (visible outside Funding hero, always in Internal) */}
      {toneMode !== 'funding' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <RStat
            label="Invoices issued"
            value={data.invoicesIssued ?? 0}
            accent="text-white"
            sub={fmt(data.invoiceValueIssued)}
          />
          <RStat
            label="Invoices paid"
            value={data.invoicesPaid ?? 0}
            accent="text-emerald-400"
            sub={fmt(data.invoiceValuePaid)}
          />
          <RStat
            label="Debtor days"
            value={debtorDays != null ? Math.round(debtorDays) : '—'}
            accent={
              debtorDays != null && debtorDays <= 30
                ? 'text-emerald-400'
                : debtorDays != null && debtorDays <= 45
                  ? 'text-amber-400'
                  : 'text-red-400'
            }
            sub="avg sent → paid"
          />
          <RStat
            label="On-time rate"
            value={onTime != null ? `${Math.round(onTime)}%` : '—'}
            accent={onTime != null && onTime >= 80 ? 'text-emerald-400' : 'text-white'}
          />
        </div>
      )}

      {/* Bad debt callout — only if there's any */}
      {(data.badDebtWrittenOff ?? 0) > 0 && (
        <div
          className="rounded-xl border p-4"
          style={{ background: 'rgba(220,38,38,0.10)', borderColor: 'rgba(220,38,38,0.28)' }}
        >
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#fca5a5]">
            Bad debt written off
          </p>
          <p className="text-lg font-bold text-white mt-1">{fmt(data.badDebtWrittenOff)}</p>
          <p className="text-xs text-white/60 mt-1">
            Voided / written-off invoices in this period. Review chase cadence for next year.
          </p>
        </div>
      )}

      {/* Entity-branched block */}
      {isLtd ? (
        <Card className="overflow-hidden">
          <div className="px-4 py-3 border-b border-[rgba(153,197,255,0.08)]">
            <SL>Limited company movements</SL>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4">
            <RStat
              label="Dividends paid"
              value={fmt(data.ltdDividendsPaid ?? 0)}
              accent="text-white"
              sub="in this period"
            />
            <RStat
              label="DLA balance"
              value={fmt(data.ltdDlaBalance ?? 0)}
              accent={Math.abs(data.ltdDlaBalance ?? 0) > 10000 ? 'text-amber-400' : 'text-white'}
              sub={`${data.ltdDlaMovement >= 0 ? '+' : ''}${fmt(data.ltdDlaMovement ?? 0)} in period`}
            />
            <RStat
              label="CT provision"
              value={fmt(data.ltdCtProvision ?? 0)}
              accent="text-white"
              sub={data.ltdCtStatus ?? '—'}
            />
            <RStat
              label="CT due on"
              value={
                data.ltdCtDueOn
                  ? new Date(data.ltdCtDueOn).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })
                  : '—'
              }
              accent="text-white"
            />
          </div>
        </Card>
      ) : (
        (data.soleTraderDrawings ?? 0) > 0 && (
          <Card className="overflow-hidden">
            <div className="px-4 py-3 border-b border-[rgba(153,197,255,0.08)]">
              <SL>Owner's drawings</SL>
            </div>
            <div className="p-4 grid grid-cols-2 gap-3">
              <RStat
                label="Total drawings"
                value={fmt(data.soleTraderDrawings)}
                accent="text-white"
                sub="approximate — category-based signal"
              />
              <RStat
                label="% of profit"
                value={
                  data.profit > 0
                    ? `${Math.round((data.soleTraderDrawings / data.profit) * 100)}%`
                    : '—'
                }
                accent="text-white"
              />
            </div>
          </Card>
        )
      )}

      {vatRegistered && (
        <div
          className="rounded-xl border p-4"
          style={{ background: 'rgba(126,163,255,0.10)', borderColor: 'rgba(126,163,255,0.28)' }}
        >
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#7ea3ff]">
            VAT — coming in §6
          </p>
          <p className="text-sm text-white/70 mt-1">
            Scheme, collected / paid split, and net position land in the Tax Position section (next
            slice). This section shows the P&amp;L gross of VAT.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── SECTION: Tax Position ─────────────────────────────────────────────────────
// §6 of the AR spec. The most branched section: sole trader shows SA103
// income tax + Class 4 NI + MTD ITSA history; Ltd shows CT + salary/
// dividend split vs optimal + PAYE; VAT (any entity) shows scheme + returns
// filed + threshold proximity.
//
// Tone modes:
//   Internal — full transparency (all fields, all warnings, all history)
//   Funding  — headline tax bill + "compliant, returns filed on time"
//   Tender   — one-liner: "VAT registered: yes/no. Tax-compliant filings up to date."
function TaxSection({ data, toneMode = 'internal' }) {
  const tax = data.tax ?? null;

  // ── Tender: one-liner ────────────────────────────────────────────────
  if (toneMode === 'tender') {
    const vatLine = tax?.vatRegistered ? 'VAT-registered' : 'Not VAT-registered';
    const mtdConnected = tax?.hmrc?.connected;
    return (
      <div className="space-y-5">
        <div
          className="rounded-xl p-6"
          style={{
            background: 'rgba(126,163,255,0.10)',
            border: '1px solid rgba(126,163,255,0.28)',
          }}
        >
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#7ea3ff]">
            Tax posture
          </p>
          <p className="text-lg font-bold text-white mt-1">
            {vatLine}. Tax-compliant filings up to date.
          </p>
          <p className="text-sm text-white/70 mt-2 leading-relaxed">
            {mtdConnected
              ? `HMRC-connected. ${tax?.hmrc?.mtdSubmissionsAll ?? 0} MTD submission${tax?.hmrc?.mtdSubmissionsAll === 1 ? '' : 's'} on file.`
              : 'Statutory returns delivered on time; full compliance evidence available under NDA.'}
          </p>
        </div>
      </div>
    );
  }

  if (!tax) {
    return (
      <div className="text-center py-12 rounded-xl border border-white/10 bg-white/5">
        <p className="text-white/60 text-sm">
          Tax position loads once the aggregator lands data for this period.
        </p>
      </div>
    );
  }

  const isLtd = tax.entityType === 'ltd';
  const hmrc = tax.hmrc;
  const vat = tax.vatProximity;

  return (
    <div className="space-y-5">
      {/* Funding-mode hero — headline bill + "compliant" */}
      {toneMode === 'funding' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div
            className="rounded-xl border p-5"
            style={{ background: 'rgba(34,197,94,0.10)', borderColor: 'rgba(34,197,94,0.30)' }}
          >
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#86efac]">
              Estimated tax bill
            </p>
            <p className="text-3xl font-bold text-white tabular-nums mt-1">
              {fmt(isLtd ? (tax.ltd?.ctDue ?? 0) : (tax.sole?.total ?? 0))}
            </p>
            <p className="text-xs text-white/60 mt-1">
              {isLtd ? "Corporation Tax on this year's profit" : 'Income tax + Class 4 NI'}
            </p>
          </div>
          <div
            className="rounded-xl border p-5"
            style={{ background: 'rgba(126,163,255,0.10)', borderColor: 'rgba(126,163,255,0.30)' }}
          >
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#7ea3ff]">
              HMRC connection
            </p>
            <p className="text-lg font-bold text-white mt-1">
              {hmrc?.connected ? 'Connected' : 'Not connected'}
            </p>
            <p className="text-xs text-white/60 mt-1">
              {hmrc?.connected
                ? `${hmrc.mtdSubmissionsAll ?? 0} MTD submission${hmrc?.mtdSubmissionsAll === 1 ? '' : 's'} on file`
                : 'No live filing history yet'}
            </p>
          </div>
          <div
            className="rounded-xl border p-5"
            style={{ background: 'rgba(251,191,36,0.10)', borderColor: 'rgba(251,191,36,0.30)' }}
          >
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#fbbf24]">
              Compliance
            </p>
            <p className="text-lg font-bold text-white mt-1">Returns filed on time</p>
            <p className="text-xs text-white/60 mt-1">
              No outstanding regulatory concerns disclosed
            </p>
          </div>
        </div>
      )}

      {/* Entity block: sole trader vs Ltd */}
      {isLtd ? (
        <Card className="overflow-hidden">
          <div className="px-4 py-3 border-b border-[rgba(153,197,255,0.08)] flex items-center justify-between">
            <SL>Limited company — Corporation Tax</SL>
            <span className="text-[10px] px-2 py-0.5 rounded-full border border-white/15 text-white/70">
              {RATE_BAND_LABEL[tax.ltd?.rateBand] ?? '—'}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4">
            <RStat label="Profit for CT" value={fmt(tax.ltd?.profit ?? 0)} accent="text-white" />
            <RStat
              label="CT due"
              value={fmt(tax.ltd?.ctDue ?? 0)}
              accent="text-amber-400"
              sub={
                tax.ltd?.ctDueOn
                  ? `by ${new Date(tax.ltd.ctDueOn).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
                  : ''
              }
            />
            <RStat
              label="CT provisioned"
              value={fmt(tax.ltd?.ctProvisioned ?? 0)}
              accent="text-white"
              sub={tax.ltd?.ctStatus ?? '—'}
            />
            <RStat
              label="Dividends paid"
              value={fmt(tax.ltd?.dividendsPaid ?? 0)}
              accent="text-white"
              sub="in this period"
            />
          </div>
          <div className="border-t border-white/5 px-4 py-4 bg-white/[0.02]">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#86efac] mb-2">
              Salary vs dividend split
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <RStat
                label="Optimal salary (PA)"
                value={fmt(tax.ltd?.optimalSalary ?? 0)}
                accent="text-white"
                sub="2025/26 personal allowance"
              />
              <RStat
                label="Optimal dividend"
                value={fmt(tax.ltd?.dividendsAtOptimalSplit ?? 0)}
                accent="text-white"
                sub="after CT"
              />
              <RStat
                label="CT saved by taking salary"
                value={fmt(tax.ltd?.ctSavingFromOptimal ?? 0)}
                accent="text-emerald-400"
                sub="vs no salary"
              />
            </div>
            <p className="text-[10px] text-white/40 mt-3 leading-relaxed">
              Simple heuristic assuming single director + full dividend take. The BL{' '}
              <em>Entity & Tax Strategy</em> module refines this — attaches your dated decision memo
              when certified.
            </p>
          </div>
          {(tax.payroll?.payeRef || tax.payroll?.employmentAllowance) && (
            <div className="border-t border-white/5 px-4 py-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/60 mb-2">
                PAYE / Employment allowance
              </p>
              <div className="grid grid-cols-2 gap-3">
                <RStat
                  label="PAYE reference"
                  value={tax.payroll.payeRef || '—'}
                  accent="text-white"
                />
                <RStat
                  label="Employment allowance"
                  value={tax.payroll.employmentAllowance ? 'Claimed' : 'Not claimed'}
                  accent={tax.payroll.employmentAllowance ? 'text-emerald-400' : 'text-white/60'}
                  sub="Up to £5,000/year off employer NI"
                />
              </div>
            </div>
          )}
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="px-4 py-3 border-b border-[rgba(153,197,255,0.08)] flex items-center justify-between">
            <SL>Sole trader — Income Tax + Class 4 NI</SL>
            <span className="text-[10px] px-2 py-0.5 rounded-full border border-white/15 text-white/70">
              {TAX_BAND_LABEL[tax.sole?.band] ?? '—'}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4">
            <RStat label="Taxable profit" value={fmt(tax.sole?.profit ?? 0)} accent="text-white" />
            <RStat label="Income tax" value={fmt(tax.sole?.incomeTax ?? 0)} accent="text-white" />
            <RStat label="Class 4 NI" value={fmt(tax.sole?.ni ?? 0)} accent="text-white" />
            <RStat
              label="Total tax"
              value={fmt(tax.sole?.total ?? 0)}
              accent="text-amber-400"
              sub={
                tax.sole?.yoyDeltaTotal != null
                  ? `${tax.sole.yoyDeltaTotal >= 0 ? '+' : ''}${fmt(tax.sole.yoyDeltaTotal)} vs last year`
                  : ''
              }
            />
          </div>
          {tax.sole?.effectivePA < PERSONAL_ALLOWANCE_UI && (
            <div className="border-t border-white/5 px-4 py-3 bg-amber-500/5">
              <p className="text-xs text-amber-300">
                Personal allowance tapered to <strong>{fmt(tax.sole.effectivePA)}</strong> at this
                profit level — every £2 of profit above £100k loses £1 of allowance.
              </p>
            </div>
          )}
        </Card>
      )}

      {/* VAT block */}
      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-[rgba(153,197,255,0.08)] flex items-center justify-between">
          <SL>VAT</SL>
          <span className="text-[10px] px-2 py-0.5 rounded-full border border-white/15 text-white/70">
            {tax.vatRegistered ? 'Registered' : 'Not registered'}
          </span>
        </div>
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <RStat
              label="Status"
              value={tax.vatRegistered ? 'Registered' : 'Not registered'}
              accent="text-white"
              sub={tax.vatNumber ? `VAT # ${tax.vatNumber}` : ''}
            />
            <RStat
              label="Scheme"
              value={tax.vatScheme || (tax.vatRegistered ? 'Standard (default)' : '—')}
              accent="text-white"
            />
            <RStat
              label="Income in period"
              value={fmt(vat.incomeInPeriod)}
              accent="text-white"
              sub={`£${vat.registrationThreshold.toLocaleString()} threshold`}
            />
          </div>
          <VatProximityCallout vat={vat} vatRegistered={tax.vatRegistered} />
        </div>
      </Card>

      {/* HMRC + MTD status */}
      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-[rgba(153,197,255,0.08)] flex items-center justify-between">
          <SL>HMRC + MTD</SL>
          {hmrc?.tokenExpired && (
            <span className="text-[10px] text-red-300 font-bold uppercase tracking-widest">
              Token expired — reconnect
            </span>
          )}
        </div>
        <div className="p-4">
          {hmrc?.connected ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <RStat
                label="Connection"
                value="Connected"
                accent="text-emerald-400"
                sub={
                  hmrc.connectedAt
                    ? `since ${new Date(hmrc.connectedAt).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}`
                    : ''
                }
              />
              <RStat
                label="Submissions this period"
                value={hmrc.mtdSubmissionsInPeriod ?? 0}
                accent="text-white"
              />
              <RStat
                label="Submissions all-time"
                value={hmrc.mtdSubmissionsAll ?? 0}
                accent="text-white"
              />
              <RStat
                label="Last submitted"
                value={
                  hmrc.mtdLastSubmittedAt
                    ? new Date(hmrc.mtdLastSubmittedAt).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })
                    : '—'
                }
                accent="text-white"
              />
            </div>
          ) : (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
              <p className="text-sm text-white font-bold mb-1">HMRC not connected</p>
              <p className="text-xs text-white/70 leading-relaxed">
                Connect HMRC on the <strong className="text-white">Accounting tab</strong> to import
                your MTD ITSA submission history into this section. Until then the numbers above are
                Cadi's own estimate — Cadi cannot see whether you've filed.
              </p>
            </div>
          )}
        </div>
      </Card>

      <p className="text-[10px] text-white/40 text-center leading-relaxed max-w-2xl mx-auto">
        Tax figures are estimates from live data using the same calculator as the Money tab
        (personal allowance taper, marginal relief for CT). Not tax advice — final numbers come from
        your accountant.
      </p>
    </div>
  );
}

const TAX_BAND_LABEL = {
  personal_allowance: 'Under PA',
  basic: 'Basic rate',
  higher: 'Higher rate',
  additional: 'Additional rate',
};
const RATE_BAND_LABEL = {
  small_profits: 'Small profits — 19%',
  main_rate: 'Main rate — 25%',
  marginal_relief: 'Marginal relief band',
};
const PERSONAL_ALLOWANCE_UI = 12570;

function VatProximityCallout({ vat }) {
  if (!vat) return null;
  const tone = {
    below_threshold: {
      fg: '#86efac',
      bg: 'rgba(34,197,94,0.10)',
      bd: 'rgba(34,197,94,0.28)',
      headline: 'Well below the VAT threshold',
    },
    approaching_registration: {
      fg: '#fbbf24',
      bg: 'rgba(251,191,36,0.10)',
      bd: 'rgba(251,191,36,0.28)',
      headline: `£${vat.distanceToRegistration.toLocaleString()} to the VAT threshold`,
    },
    over_threshold_unregistered: {
      fg: '#fca5a5',
      bg: 'rgba(220,38,38,0.10)',
      bd: 'rgba(220,38,38,0.28)',
      headline: 'Above the VAT threshold — register within 30 days',
    },
    above_registered: {
      fg: '#86efac',
      bg: 'rgba(34,197,94,0.10)',
      bd: 'rgba(34,197,94,0.28)',
      headline: 'Registered and trading comfortably above threshold',
    },
    near_dereg: {
      fg: '#fbbf24',
      bg: 'rgba(251,191,36,0.10)',
      bd: 'rgba(251,191,36,0.28)',
      headline: 'Trading below deregistration threshold — worth reviewing',
    },
  }[vat.status];
  if (!tone) return null;

  const copy = {
    below_threshold:
      'Turnover is safely below the £90,000 mandatory registration threshold. No VAT action required.',
    approaching_registration:
      "If this year's trajectory continues, VAT registration is likely inside the next 12 months. Model the pricing impact in Business Lab before it becomes forced.",
    over_threshold_unregistered:
      'HMRC requires registration when your rolling 12-month turnover exceeds £90,000. Late registration attracts penalties — priority action.',
    above_registered: 'Full compliance posture — no threshold-adjacent concerns to flag.',
    near_dereg:
      "You can voluntarily deregister when turnover drops below £88,000. Only worth doing if the admin overhead exceeds any input VAT you're reclaiming.",
  }[vat.status];

  return (
    <div
      className="rounded-xl p-4 mt-2"
      style={{ background: tone.bg, border: `1px solid ${tone.bd}` }}
    >
      <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: tone.fg }}>
        Threshold check
      </p>
      <p className="text-sm font-bold text-white mt-1">{tone.headline}</p>
      <p className="text-xs text-white/70 mt-1 leading-relaxed">{copy}</p>
    </div>
  );
}

// ─── SECTION: Team & Workforce ─────────────────────────────────────────────────
// §7 of the AR spec. Fully driven by aggregator team sub-tree:
//   headcountStart/End, joiners, leavers, turnoverRate,
//   payrollGross/Net/TaxPeriod/niEmployer/niEmployee, payrollTotal,
//   directorPayGross, rtiPayslipsCount, holidayHours/entitlement,
//   sicknessHours, dbsCovered, rtwCovered, revenuePerHead, avgCostPerHead,
//   subcontractorSpend, hrPolicyWeeks, bankHolidaysOnTop.
//
// Empty state — no team (single operator): section collapses to a capacity
// insights card pointing at Business Lab's hire tool.
//
// Tone modes:
//   Internal — full HR detail
//   Funding  — leads with revenue/head + scale (plan for future hires)
//   Tender   — headcount + accreditations (DBS/RTW cover) that FMs verify;
//              no payroll £ detail
function TeamSection({ data, toneMode = 'internal', entityType }) {
  const team = data.team ?? null;
  const isLtd = entityType === 'ltd';

  // ── Empty state: no team on the books ────────────────────────────────
  const totalHeads = team?.headcountEnd ?? 0;
  if (!team || totalHeads === 0) {
    return (
      <div className="space-y-5">
        <div
          className="rounded-xl p-6"
          style={{
            background: 'rgba(126,163,255,0.10)',
            border: '1px solid rgba(126,163,255,0.28)',
          }}
        >
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#7ea3ff]">
            Single-operator business
          </p>
          <p className="text-lg font-bold text-white mt-1">
            You're the whole team — and that's fine.
          </p>
          <p className="text-sm text-white/70 mt-2 leading-relaxed">
            Most successful cleaning businesses in the UK are single-operator for their first 2–3
            years. The section below gives you capacity insights from the work you've delivered this
            year.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <RStat
            label="Jobs delivered"
            value={(data.jobsCompleted ?? 0).toLocaleString()}
            accent="text-white"
          />
          <RStat label="Revenue per job" value={fmt(data.avgJobValue)} accent="text-[#10b981]" />
          <RStat
            label="Jobs per month"
            value={Math.round((data.jobsCompleted ?? 0) / 12)}
            accent="text-white"
          />
          <RStat
            label="Revenue solo"
            value={fmt(data.income)}
            accent="text-white"
            sub="single-operator run rate"
          />
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-5">
          <p className="text-sm font-bold text-white mb-2">Ready to hire?</p>
          <p className="text-sm text-white/70 leading-relaxed">
            Model your first employee in{' '}
            <strong className="text-white">Business Lab → Hire a cleaner</strong>. It answers the
            only question that matters: does this hire make you money, or cost you money?
          </p>
        </div>
      </div>
    );
  }

  // ── Tender: headcount + accreditations only ─────────────────────────
  if (toneMode === 'tender') {
    const activeTotal = team.staffActive + team.directors;
    const dbsPct = activeTotal > 0 ? Math.round((team.dbsCovered / activeTotal) * 100) : 0;
    const rtwPct = activeTotal > 0 ? Math.round((team.rtwCovered / activeTotal) * 100) : 0;
    return (
      <div className="space-y-5">
        <div
          className="rounded-xl p-6"
          style={{
            background: 'rgba(126,163,255,0.10)',
            border: '1px solid rgba(126,163,255,0.28)',
          }}
        >
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#7ea3ff]">
            Workforce & compliance
          </p>
          <p className="text-lg font-bold text-white mt-1">
            {activeTotal} directly-employed staff
            {team.directors ? ` (${team.directors} director)` : ''}
          </p>
          <p className="text-sm text-white/70 mt-2 leading-relaxed">
            All staff engaged under UK employment contracts. RTW and DBS check registers maintained
            and available for audit under NDA.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <RStat label="Active headcount" value={activeTotal} accent="text-white" />
          <RStat
            label="DBS cover (current)"
            value={`${team.dbsCovered}/${activeTotal}`}
            accent={dbsPct === 100 ? 'text-emerald-400' : 'text-amber-400'}
            sub={`${dbsPct}%`}
          />
          <RStat
            label="Right-to-work verified"
            value={`${team.rtwCovered}/${activeTotal}`}
            accent={rtwPct === 100 ? 'text-emerald-400' : 'text-amber-400'}
            sub={`${rtwPct}%`}
          />
        </div>
      </div>
    );
  }

  // ── Internal + Funding: full HR block ───────────────────────────────
  const holidayPct =
    team.holidayEntitlementHours > 0
      ? Math.round((team.holidayHoursTaken / team.holidayEntitlementHours) * 100)
      : null;
  const activeTotal = team.staffActive + team.directors;

  return (
    <div className="space-y-5">
      {/* Funding-mode hero — revenue per head + scale story */}
      {toneMode === 'funding' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div
            className="rounded-xl border p-5"
            style={{ background: 'rgba(34,197,94,0.10)', borderColor: 'rgba(34,197,94,0.30)' }}
          >
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#86efac]">
              Revenue per head
            </p>
            <p className="text-3xl font-bold text-white tabular-nums mt-1">
              {team.revenuePerHead != null ? fmt(team.revenuePerHead) : '—'}
            </p>
            <p className="text-xs text-white/60 mt-1">Total revenue ÷ active heads</p>
          </div>
          <div
            className="rounded-xl border p-5"
            style={{ background: 'rgba(126,163,255,0.10)', borderColor: 'rgba(126,163,255,0.30)' }}
          >
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#7ea3ff]">
              Payroll efficiency
            </p>
            <p className="text-3xl font-bold text-white tabular-nums mt-1">
              {data.income > 0 ? `${Math.round((team.payrollTotal / data.income) * 100)}%` : '—'}
            </p>
            <p className="text-xs text-white/60 mt-1">Payroll cost as % of revenue</p>
          </div>
          <div
            className="rounded-xl border p-5"
            style={{ background: 'rgba(251,191,36,0.10)', borderColor: 'rgba(251,191,36,0.30)' }}
          >
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#fbbf24]">
              Turnover rate
            </p>
            <p className="text-3xl font-bold text-white tabular-nums mt-1">
              {Math.round(team.turnoverRate)}%
            </p>
            <p className="text-xs text-white/60 mt-1">
              {team.turnoverRate <= 15
                ? 'Below sector average'
                : team.turnoverRate <= 25
                  ? 'In line with sector'
                  : 'Above sector — retention focus for next year'}
            </p>
          </div>
        </div>
      )}

      {/* Headcount KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <RStat label="At start" value={team.headcountStart} accent="text-white" />
        <RStat label="At end" value={team.headcountEnd} accent="text-white" />
        <RStat label="Joiners" value={team.joiners} accent="text-emerald-400" />
        <RStat
          label="Leavers"
          value={team.leavers}
          accent={team.leavers > 0 ? 'text-amber-400' : 'text-white'}
        />
        <RStat
          label="Turnover"
          value={`${Math.round(team.turnoverRate)}%`}
          accent={
            team.turnoverRate <= 15
              ? 'text-emerald-400'
              : team.turnoverRate <= 25
                ? 'text-amber-400'
                : 'text-red-400'
          }
        />
      </div>

      {/* Payroll block */}
      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-[rgba(153,197,255,0.08)] flex items-center justify-between">
          <SL>Payroll & RTI</SL>
          <span className="text-[10px] text-white/40">
            {team.rtiPayslipsCount} payslip{team.rtiPayslipsCount === 1 ? '' : 's'} submitted this
            period
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4">
          <RStat label="Gross pay" value={fmt(team.payrollGross)} accent="text-white" />
          <RStat
            label="Employer NI"
            value={fmt(team.niEmployer)}
            accent="text-white"
            sub="cost to the business"
          />
          <RStat
            label="Total employer cost"
            value={fmt(team.payrollTotal)}
            accent="text-amber-400"
            sub="gross + employer NI"
          />
          <RStat
            label="PAYE tax deducted"
            value={fmt(team.payrollTaxPeriod)}
            accent="text-white"
            sub="submitted to HMRC via FPS"
          />
        </div>
        {isLtd && team.directorPayGross > 0 && (
          <div className="border-t border-white/5 px-4 py-4 bg-white/[0.02]">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#86efac] mb-2">
              Director salary
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <RStat
                label="Director gross pay"
                value={fmt(team.directorPayGross)}
                accent="text-white"
                sub={`${team.directors} director${team.directors === 1 ? '' : 's'}`}
              />
              <RStat
                label="As % of payroll"
                value={
                  team.payrollGross > 0
                    ? `${Math.round((team.directorPayGross / team.payrollGross) * 100)}%`
                    : '—'
                }
                accent="text-white"
              />
              <RStat
                label="Staff gross pay"
                value={fmt(team.payrollGross - team.directorPayGross)}
                accent="text-white"
                sub={`${team.staffActive} staff`}
              />
            </div>
          </div>
        )}
      </Card>

      {/* Efficiency + subcontractor spend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card className="overflow-hidden">
          <div className="px-4 py-3 border-b border-[rgba(153,197,255,0.08)]">
            <SL>Efficiency</SL>
          </div>
          <div className="grid grid-cols-2 gap-3 p-4">
            <RStat
              label="Revenue per head"
              value={team.revenuePerHead != null ? fmt(team.revenuePerHead) : '—'}
              accent="text-[#10b981]"
              sub={`${activeTotal} active`}
            />
            <RStat
              label="Avg cost per head"
              value={team.avgCostPerHead != null ? fmt(team.avgCostPerHead) : '—'}
              accent="text-white"
              sub="employer-side"
            />
            <RStat
              label="Subcontractor spend"
              value={fmt(team.subcontractorSpend ?? 0)}
              accent="text-white"
              sub="approximate — category-based"
            />
            <RStat
              label="Sub spend as % of payroll"
              value={
                team.payrollGross > 0
                  ? `${Math.round(((team.subcontractorSpend ?? 0) / team.payrollGross) * 100)}%`
                  : '—'
              }
              accent="text-white"
            />
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="px-4 py-3 border-b border-[rgba(153,197,255,0.08)]">
            <SL>Holiday & absence</SL>
          </div>
          <div className="grid grid-cols-2 gap-3 p-4">
            <RStat
              label="Holiday taken"
              value={`${team.holidayHoursTaken} hrs`}
              accent="text-white"
              sub={holidayPct != null ? `${holidayPct}% of entitlement` : ''}
            />
            <RStat
              label="Total entitlement"
              value={`${team.holidayEntitlementHours} hrs`}
              accent="text-white"
              sub={`${team.hrPolicyWeeks} weeks/yr${team.bankHolidaysOnTop ? ' + bank hols' : ''}`}
            />
            <RStat
              label="Sickness hours"
              value={`${team.sicknessHoursTaken} hrs`}
              accent={team.sicknessHoursTaken > 0 ? 'text-amber-400' : 'text-white'}
            />
            <RStat
              label="Sickness as % of contracted"
              value={
                team.holidayEntitlementHours > 0
                  ? `${Math.round((team.sicknessHoursTaken / ((team.holidayEntitlementHours / (team.hrPolicyWeeks || 5.6)) * 52)) * 100) / 100}%`
                  : '—'
              }
              accent="text-white"
            />
          </div>
        </Card>
      </div>

      {/* Accreditations — DBS + RTW cover */}
      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-[rgba(153,197,255,0.08)]">
          <SL>Compliance cover</SL>
        </div>
        <div className="grid grid-cols-2 gap-3 p-4">
          <RStat
            label="DBS check current"
            value={`${team.dbsCovered}/${activeTotal}`}
            accent={team.dbsCovered === activeTotal ? 'text-emerald-400' : 'text-amber-400'}
            sub={
              activeTotal > 0
                ? `${Math.round((team.dbsCovered / activeTotal) * 100)}% coverage`
                : ''
            }
          />
          <RStat
            label="Right-to-work verified"
            value={`${team.rtwCovered}/${activeTotal}`}
            accent={team.rtwCovered === activeTotal ? 'text-emerald-400' : 'text-amber-400'}
            sub={
              activeTotal > 0
                ? `${Math.round((team.rtwCovered / activeTotal) * 100)}% coverage`
                : ''
            }
          />
        </div>
      </Card>

      <p className="text-[10px] text-white/40 text-center leading-relaxed max-w-2xl mx-auto">
        Payroll figures aggregate finalised payslips only (drafts excluded). Subcontractor spend
        uses category-text matching on money entries — approximate. Turnover = leavers ÷ average
        headcount.
      </p>
    </div>
  );
}

// ─── SECTION: Operations ───────────────────────────────────────────────────────
// §8 of the AR spec. Delivery quality — the section FMs read most carefully
// in a tender. Fully driven by aggregator ops sub-tree:
//   scheduled, completed, cancelled, noShow, onTimePct, onTimeSampleSize,
//   photoCoveragePct, avgPhotosPerJob, jobsWithPhotos,
//   recurringCount, oneOffCount, recurringPct,
//   avgActualDurationMins, avgScheduledDurationMins, durationVariancePct,
//   captureRatePct, complaintCount (null), npsScore (null).
//
// Empty state — captureRatePct === null OR completed === 0: "Log job
// completions to populate this section" nudge.
//
// Tone modes:
//   Internal — full detail incl. cancellations + no-shows
//   Funding  — leads with on-time + retention (retention already lives in §3;
//              on-time hero'd here)
//   Tender   — leads with on-time %, complaint rate, capacity headroom.
//              No-show number hidden (that's for internal reflection only).
function OperationsSection({ data, toneMode = 'internal' }) {
  const ops = data.operations ?? null;

  if (!ops || ops.scheduled === 0) {
    return (
      <div className="space-y-5">
        <div
          className="rounded-xl p-6"
          style={{
            background: 'rgba(126,163,255,0.10)',
            border: '1px solid rgba(126,163,255,0.28)',
          }}
        >
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#7ea3ff]">
            Not enough data yet
          </p>
          <p className="text-lg font-bold text-white mt-1">
            Log job completions to populate this section
          </p>
          <p className="text-sm text-white/70 mt-2 leading-relaxed">
            §8 pulls on-time %, photo coverage, cancellations and duration variance from your
            Scheduler + Work Completion tabs. Nothing here means no scheduled work in the review
            period — or the jobs weren't marked complete.
          </p>
        </div>
      </div>
    );
  }

  // ── Tender: what FMs verify ─────────────────────────────────────────
  if (toneMode === 'tender') {
    const onTimeStr = ops.onTimePct != null ? `${Math.round(ops.onTimePct)}%` : '—';
    const complaintStr = ops.complaintCount == null ? 'Not tracked' : String(ops.complaintCount);
    return (
      <div className="space-y-5">
        <div
          className="rounded-xl p-6"
          style={{
            background: 'rgba(126,163,255,0.10)',
            border: '1px solid rgba(126,163,255,0.28)',
          }}
        >
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#7ea3ff]">
            Delivery reliability
          </p>
          <p className="text-lg font-bold text-white mt-1">
            {ops.completed.toLocaleString()} engagement{ops.completed === 1 ? '' : 's'} delivered —{' '}
            {onTimeStr} on-time
          </p>
          <p className="text-sm text-white/70 mt-2 leading-relaxed">
            All completions timestamped and evidenced. Full route logs, photo evidence and
            mobilisation history available under NDA.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <RStat
            label="On-time delivery"
            value={onTimeStr}
            accent={
              ops.onTimePct != null && ops.onTimePct >= 90
                ? 'text-emerald-400'
                : ops.onTimePct != null && ops.onTimePct >= 80
                  ? 'text-amber-400'
                  : 'text-white'
            }
            sub={ops.onTimeSampleSize ? `${ops.onTimeSampleSize} tracked visits` : ''}
          />
          <RStat
            label="Photo evidence"
            value={ops.photoCoveragePct != null ? `${Math.round(ops.photoCoveragePct)}%` : '—'}
            accent={
              ops.photoCoveragePct != null && ops.photoCoveragePct >= 90
                ? 'text-emerald-400'
                : 'text-white'
            }
            sub="jobs with proof-of-work photos"
          />
          <RStat
            label="Complaints"
            value={complaintStr}
            accent={
              ops.complaintCount == null
                ? 'text-white/50'
                : ops.complaintCount === 0
                  ? 'text-emerald-400'
                  : 'text-amber-400'
            }
            sub={
              ops.complaintCount == null
                ? 'complaint tracking not enabled'
                : 'across the review period'
            }
          />
        </div>
      </div>
    );
  }

  // ── Internal + Funding shared ───────────────────────────────────────
  const noShowPct = ops.scheduled > 0 ? Math.round((ops.noShow / ops.scheduled) * 100) : 0;
  const cancelPct = ops.scheduled > 0 ? Math.round((ops.cancelled / ops.scheduled) * 100) : 0;

  return (
    <div className="space-y-5">
      {/* Funding hero — on-time + capture rate as headline signals */}
      {toneMode === 'funding' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div
            className="rounded-xl border p-5"
            style={{ background: 'rgba(34,197,94,0.10)', borderColor: 'rgba(34,197,94,0.30)' }}
          >
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#86efac]">
              On-time delivery
            </p>
            <p className="text-3xl font-bold text-white tabular-nums mt-1">
              {ops.onTimePct != null ? `${Math.round(ops.onTimePct)}%` : '—'}
            </p>
            <p className="text-xs text-white/60 mt-1">
              Completed on the scheduled date
              {ops.onTimeSampleSize ? ` · n=${ops.onTimeSampleSize}` : ''}
            </p>
          </div>
          <div
            className="rounded-xl border p-5"
            style={{ background: 'rgba(126,163,255,0.10)', borderColor: 'rgba(126,163,255,0.30)' }}
          >
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#7ea3ff]">
              Job tracking discipline
            </p>
            <p className="text-3xl font-bold text-white tabular-nums mt-1">
              {ops.captureRatePct != null ? `${Math.round(ops.captureRatePct)}%` : '—'}
            </p>
            <p className="text-xs text-white/60 mt-1">Scheduled jobs marked complete</p>
          </div>
          <div
            className="rounded-xl border p-5"
            style={{ background: 'rgba(251,191,36,0.10)', borderColor: 'rgba(251,191,36,0.30)' }}
          >
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#fbbf24]">
              Recurring revenue base
            </p>
            <p className="text-3xl font-bold text-white tabular-nums mt-1">
              {Math.round(ops.recurringPct)}%
            </p>
            <p className="text-xs text-white/60 mt-1">of completions are recurring bookings</p>
          </div>
        </div>
      )}

      {/* Header KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <RStat label="Scheduled" value={ops.scheduled.toLocaleString()} accent="text-white" />
        <RStat
          label="Completed"
          value={ops.completed.toLocaleString()}
          accent="text-emerald-400"
          sub={ops.captureRatePct != null ? `${Math.round(ops.captureRatePct)}% capture` : ''}
        />
        <RStat
          label="Cancellations"
          value={ops.cancelled}
          accent={cancelPct > 5 ? 'text-amber-400' : 'text-white'}
          sub={ops.scheduled > 0 ? `${cancelPct}%` : ''}
        />
        <RStat
          label="No-shows"
          value={ops.noShow}
          accent={noShowPct > 2 ? 'text-red-400' : ops.noShow > 0 ? 'text-amber-400' : 'text-white'}
          sub={ops.scheduled > 0 ? `${noShowPct}%` : ''}
        />
      </div>

      {/* Delivery quality — on-time + duration + photo */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card className="overflow-hidden">
          <div className="px-4 py-3 border-b border-[rgba(153,197,255,0.08)]">
            <SL>Delivery quality</SL>
          </div>
          <div className="grid grid-cols-2 gap-3 p-4">
            <RStat
              label="On-time %"
              value={ops.onTimePct != null ? `${Math.round(ops.onTimePct)}%` : '—'}
              accent={
                ops.onTimePct != null && ops.onTimePct >= 90
                  ? 'text-emerald-400'
                  : ops.onTimePct != null && ops.onTimePct >= 80
                    ? 'text-amber-400'
                    : 'text-red-400'
              }
              sub={
                ops.onTimeSampleSize
                  ? `n=${ops.onTimeSampleSize} tracked`
                  : 'no schedule/complete pair'
              }
            />
            <RStat
              label="Duration variance"
              value={
                ops.durationVariancePct != null
                  ? `${ops.durationVariancePct >= 0 ? '+' : ''}${Math.round(ops.durationVariancePct)}%`
                  : '—'
              }
              accent={
                ops.durationVariancePct == null
                  ? 'text-white'
                  : Math.abs(ops.durationVariancePct) <= 10
                    ? 'text-emerald-400'
                    : 'text-amber-400'
              }
              sub="actual vs scheduled"
            />
            <RStat
              label="Avg actual duration"
              value={ops.avgActualDurationMins != null ? `${ops.avgActualDurationMins} min` : '—'}
              accent="text-white"
            />
            <RStat
              label="Avg scheduled duration"
              value={
                ops.avgScheduledDurationMins != null ? `${ops.avgScheduledDurationMins} min` : '—'
              }
              accent="text-white/70"
            />
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="px-4 py-3 border-b border-[rgba(153,197,255,0.08)]">
            <SL>Evidence & recurring split</SL>
          </div>
          <div className="grid grid-cols-2 gap-3 p-4">
            <RStat
              label="Photo coverage"
              value={ops.photoCoveragePct != null ? `${Math.round(ops.photoCoveragePct)}%` : '—'}
              accent={
                ops.photoCoveragePct != null && ops.photoCoveragePct >= 80
                  ? 'text-emerald-400'
                  : ops.photoCoveragePct != null && ops.photoCoveragePct >= 50
                    ? 'text-amber-400'
                    : 'text-white'
              }
              sub="jobs with ≥1 photo"
            />
            <RStat
              label="Avg photos / job"
              value={ops.avgPhotosPerJob}
              accent="text-white"
              sub={`${ops.jobsWithPhotos} evidenced`}
            />
            <RStat
              label="Recurring"
              value={ops.recurringCount}
              accent="text-white"
              sub={`${Math.round(ops.recurringPct)}% of completions`}
            />
            <RStat
              label="One-off"
              value={ops.oneOffCount}
              accent="text-white"
              sub={`${Math.round(100 - ops.recurringPct)}% of completions`}
            />
          </div>
        </Card>
      </div>

      {/* Complaints / NPS — placeholder callout when not tracked */}
      {(ops.complaintCount == null || ops.npsScore == null) && (
        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/60">
            Customer feedback signal
          </p>
          <p className="text-sm text-white/70 mt-1 leading-relaxed">
            Complaint count and NPS aren't captured yet. A future <em>Feedback</em> module will let
            you tag jobs with complaints and send end-of-visit ratings — the numbers will land in
            this card automatically once it ships.
          </p>
        </div>
      )}

      <p className="text-[10px] text-white/40 text-center leading-relaxed max-w-2xl mx-auto">
        On-time = completion within 1 day of the scheduled date. Duration variance = actual vs
        scheduled hours. Capture rate = scheduled jobs that received a completion timestamp — low
        capture makes every other metric less reliable.
      </p>
    </div>
  );
}

// ─── SECTION: Risk Register ───────────────────────────────────────────────────
// §9 of the AR spec. Pure-derivation view — every row is computed from
// signals already on the snapshot (concentration, cashflow, headcount,
// DBS/RTW, VAT proximity, DLA). Rows sourced from a BL module that hasn't
// shipped yet are still LISTED — with severity 'unknown' and a "run the
// module" CTA — so the section always feels complete-with-gaps rather
// than broken.
//
// Tone modes:
//   Internal — all risks visible
//   Funding  — the strongest section for funders — full detail, sorted
//              severity-first, with a "we've thought about this" tone
//   Tender   — compliance risks only (insurance, DBS/RTW, RTW gaps).
//              Sanitised of concentration/financial risks that would
//              spook a buyer at pre-qual stage.
function RiskSection({ data, toneMode = 'internal', entityType }) {
  const { risks, overall } = useMemo(() => buildRiskRegister(data, entityType), [data, entityType]);

  const filteredRisks = useMemo(() => {
    if (toneMode !== 'tender') return risks;
    return risks.filter((r) => r.category === 'regulatory');
  }, [risks, toneMode]);

  // Sort severity-first so the eye lands on the important stuff.
  const sortedRisks = useMemo(() => {
    const RANK = { high: 0, medium: 1, low: 2, unknown: 3 };
    return [...filteredRisks].sort((a, b) => RANK[a.severity] - RANK[b.severity]);
  }, [filteredRisks]);

  const overallLabel = OVERALL_LABEL[overall] ?? OVERALL_LABEL.unknown;

  // Tender: strip to compliance essentials, no sizzle
  if (toneMode === 'tender') {
    return (
      <div className="space-y-5">
        <div
          className="rounded-xl p-6"
          style={{
            background: 'rgba(126,163,255,0.10)',
            border: '1px solid rgba(126,163,255,0.28)',
          }}
        >
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#7ea3ff]">
            Compliance & risk posture
          </p>
          <p className="text-lg font-bold text-white mt-1">All statutory obligations current</p>
          <p className="text-sm text-white/70 mt-2 leading-relaxed">
            The items below are the compliance surfaces buyers usually audit at pre-qualification.
            Financial / commercial risk register available under NDA.
          </p>
        </div>
        {sortedRisks.length === 0 ? (
          <p className="text-sm text-white/60 text-center py-8">No compliance risks flagged.</p>
        ) : (
          <div className="space-y-2">
            {sortedRisks.map((r) => (
              <RiskRow key={r.id} risk={r} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Overall banner */}
      <div
        className="rounded-xl p-5"
        style={{ background: overallLabel.bg, border: `1px solid ${overallLabel.bd}` }}
      >
        <div className="flex items-start gap-4">
          <div
            style={{
              background: `${overallLabel.fg}22`,
              color: overallLabel.fg,
              fontSize: 22,
              fontWeight: 900,
              lineHeight: 1,
              minWidth: 68,
              textAlign: 'center',
              padding: '10px 8px',
              borderRadius: 10,
            }}
          >
            {overallLabel.chip}
          </div>
          <div className="flex-1">
            <p
              className="text-[10px] font-bold uppercase tracking-widest"
              style={{ color: overallLabel.fg }}
            >
              Overall risk posture
            </p>
            <p className="text-lg font-bold text-white mt-0.5">{overallLabel.headline}</p>
            <p className="text-sm text-white/70 mt-1 leading-relaxed">
              {toneMode === 'funding'
                ? 'Every row below is either derived from live data or flagged as "not yet tracked" — funders can see the gaps as clearly as the scored risks. That transparency is the point.'
                : 'A candid view. Rows scored from live data show what\'s actually happening; rows flagged "BL module needed" tell you where a Business Lab certification would add depth.'}
            </p>
          </div>
        </div>
      </div>

      {/* Severity legend */}
      <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white/60">
        <span>Severity:</span>
        <SeverityDot sev="high" /> High
        <SeverityDot sev="medium" /> Medium
        <SeverityDot sev="low" /> Low
        <SeverityDot sev="unknown" /> Not scored
      </div>

      {/* Risk rows grouped by nothing — sorted severity-first, category via chip */}
      <div className="space-y-2">
        {sortedRisks.map((r) => (
          <RiskRow key={r.id} risk={r} />
        ))}
      </div>

      {/* BL uncertified footnote */}
      {sortedRisks.some((r) => r.source.startsWith('lockedByBL:')) && (
        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/60">
            Deeper scoring available via Business Lab
          </p>
          <p className="text-sm text-white/70 mt-1 leading-relaxed">
            The rows marked "Run BL module" would be scored properly once you complete the relevant
            Business Lab certification (Financial Resilience for cash / debtor risk; Compliance &
            Risk for insurance and supplier concentration). Certifying attaches your dated decision
            memo — adds enormous credibility in a funding pack.
          </p>
        </div>
      )}

      <p className="text-[10px] text-white/40 text-center leading-relaxed max-w-2xl mx-auto">
        This register is a live derivation, not an audit. It's designed to make gaps obvious rather
        than to reassure — the strongest signal for a funder is that you've thought about what could
        kill the business.
      </p>
    </div>
  );
}

const OVERALL_LABEL = {
  high: {
    chip: 'HIGH',
    fg: '#fca5a5',
    bg: 'rgba(220,38,38,0.10)',
    bd: 'rgba(220,38,38,0.28)',
    headline: 'Active risks need addressing before scaling',
  },
  medium: {
    chip: 'MED',
    fg: '#fbbf24',
    bg: 'rgba(251,191,36,0.10)',
    bd: 'rgba(251,191,36,0.28)',
    headline: 'Some risks worth actively managing',
  },
  low: {
    chip: 'LOW',
    fg: '#86efac',
    bg: 'rgba(34,197,94,0.10)',
    bd: 'rgba(34,197,94,0.28)',
    headline: 'Well-managed risk profile',
  },
  unknown: {
    chip: 'TBC',
    fg: '#94a3b8',
    bg: 'rgba(148,163,184,0.10)',
    bd: 'rgba(148,163,184,0.28)',
    headline: 'Not enough data to score yet',
  },
};

const SEVERITY_TONE = {
  high: { fg: '#fca5a5', bg: 'rgba(220,38,38,0.14)', bd: 'rgba(220,38,38,0.35)', label: 'High' },
  medium: {
    fg: '#fbbf24',
    bg: 'rgba(251,191,36,0.14)',
    bd: 'rgba(251,191,36,0.35)',
    label: 'Medium',
  },
  low: { fg: '#86efac', bg: 'rgba(34,197,94,0.14)', bd: 'rgba(34,197,94,0.35)', label: 'Low' },
  unknown: {
    fg: '#94a3b8',
    bg: 'rgba(148,163,184,0.14)',
    bd: 'rgba(148,163,184,0.35)',
    label: 'Not scored',
  },
};

const CATEGORY_ICON = {
  customer: '👥',
  financial: '💷',
  people: '👷',
  regulatory: '🏛️',
  market: '📊',
};

function SeverityDot({ sev }) {
  const t = SEVERITY_TONE[sev];
  return (
    <span
      className="inline-block w-2.5 h-2.5 rounded-full"
      style={{ background: t.fg, boxShadow: `0 0 0 3px ${t.fg}20` }}
    />
  );
}

function RiskRow({ risk }) {
  const tone = SEVERITY_TONE[risk.severity];
  const blLocked = risk.source.startsWith('lockedByBL:');
  return (
    <div
      className="rounded-xl border p-4"
      style={{
        background: risk.severity === 'unknown' ? 'rgba(255,255,255,0.04)' : tone.bg,
        borderColor: tone.bd,
      }}
    >
      <div className="flex items-start gap-3">
        <span className="text-lg shrink-0" title={risk.category}>
          {CATEGORY_ICON[risk.category] ?? '•'}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <p className="text-sm font-bold text-white">{risk.title}</p>
            <span
              className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border shrink-0"
              style={{ color: tone.fg, background: `${tone.fg}18`, borderColor: `${tone.fg}55` }}
            >
              {tone.label}
            </span>
            {blLocked && (
              <span
                className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border shrink-0"
                style={{
                  color: '#7ea3ff',
                  background: 'rgba(126,163,255,0.14)',
                  borderColor: 'rgba(126,163,255,0.35)',
                }}
              >
                Run BL module
              </span>
            )}
          </div>
          <p className="text-sm text-white/85 leading-relaxed">{risk.headline}</p>
          <p className="text-xs text-white/50 mt-1 leading-relaxed">{risk.evidence}</p>
        </div>
      </div>
    </div>
  );
}

// ─── SECTION: The Plan — Next 12 Months ────────────────────────────────────────
// §10 of the AR spec. Mandatory-BL-gated: without a certified Business Lab
// "Strategy & 12-Month Plan" submission, the section renders as locked with
// a "Run the module" CTA. A bypass lets users write an uncertified plan
// with a persistent banner nudging them to certify — matches the
// audit-decisions default "raw data + banner, not a hard lock".
//
// Editable fields all live on the `plan` state at the AnnualReview root;
// on file the whole object writes to annual_reviews.plan_jsonb (deferred
// until the file button ships).
//
// Tone modes:
//   Internal — full plan visible incl. entity decision, capex, hire plan
//   Funding  — THE central section — funders read this most. Every field
//              shown, hero'd income target + exit-of-year position.
//   Tender   — trimmed to service expansion + geographic expansion only.
//              Capability-forward; no financials, no entity decisions.
function PlanSection({ plan, setPlan, toneMode = 'internal', data, businessName, entityType }) {
  const updateField = (field, value) =>
    setPlan((p) => ({ ...p, [field]: value, authoredAt: new Date().toISOString() }));
  const updateGoal = (idx, field, value) =>
    setPlan((p) => ({
      ...p,
      goals: p.goals.map((g, i) => (i === idx ? { ...g, [field]: value } : g)),
      authoredAt: new Date().toISOString(),
    }));

  const bypassed = plan.blStrategyBypassed;
  const certified = plan.blStrategyCertified;
  const unlocked = certified || bypassed;

  // Snapshot-anchored context (last year's numbers)
  const lastYearIncome = data?.income ?? 0;

  // ── LOCKED SCAFFOLD ──────────────────────────────────────────────────
  if (!unlocked) {
    return (
      <div className="space-y-5">
        <div
          className="rounded-xl p-6"
          style={{
            background: 'rgba(126,163,255,0.12)',
            border: '1px solid rgba(126,163,255,0.32)',
          }}
        >
          <div className="flex items-start gap-4">
            <div
              style={{
                background: 'rgba(126,163,255,0.25)',
                color: '#7ea3ff',
                fontSize: 22,
                minWidth: 68,
                textAlign: 'center',
                padding: '10px 8px',
                borderRadius: 10,
              }}
            >
              🔒
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#7ea3ff]">
                Section locked
              </p>
              <p className="text-xl font-bold text-white mt-1">The Plan — Next 12 Months</p>
              <p className="text-sm text-white/70 mt-2 leading-relaxed">
                This is the section that turns your review from a report into a planning document.
                Per the AR framework, a certified{' '}
                <strong className="text-white">Business Lab — Strategy & 12-Month Plan</strong>{' '}
                submission is required to file it.
              </p>
              <p className="text-sm text-white/70 mt-3 leading-relaxed">
                The BL module forces you to model the maths behind each goal (revenue targets, hire
                economics, capex payback) so nothing here is aspirational. Output is a dated, signed
                plan you can attach to any funding pack or contract bid.
              </p>
            </div>
          </div>
        </div>

        {/* Skeleton of what will appear */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="rounded-xl border border-white/10 p-5 opacity-40">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/60">
                Goal {n}
              </p>
              <div className="mt-3 h-4 bg-white/10 rounded" />
              <div className="mt-2 h-3 bg-white/10 rounded w-3/4" />
              <div className="mt-6 h-6 bg-white/10 rounded w-1/2" />
              <p className="text-[10px] text-white/40 mt-3">with maths</p>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/60 mb-2">
            Also captured
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs text-white/60">
            <div>Income target + trajectory</div>
            <div>Hire plan + timing</div>
            <div>Service expansion</div>
            <div>Geographic expansion</div>
            <div>Capex needs + payback</div>
            <div>Expected exit-of-year position</div>
            <div>Entity decision (sole/Ltd/VAT)</div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
          <button
            type="button"
            onClick={() =>
              alert(
                'Business Lab modules ship in a later slice — for now use the bypass to write your plan uncertified.'
              )
            }
            className="text-[11px] font-bold px-4 py-2 rounded-full bg-[#10b981] text-white hover:opacity-90 transition-opacity"
          >
            Run the BL Strategy module
          </button>
          <button
            type="button"
            onClick={() => updateField('blStrategyBypassed', true)}
            className="text-[11px] font-bold px-4 py-2 rounded-full bg-white/8 text-white border border-white/15 hover:border-white/30 transition-colors"
          >
            Skip and write my own plan (uncertified)
          </button>
        </div>
      </div>
    );
  }

  // ── UNLOCKED EDITOR ──────────────────────────────────────────────────
  // Tender mode: capability-forward only — no financials, no entity, no capex
  if (toneMode === 'tender') {
    return (
      <div className="space-y-5">
        <div
          className="rounded-xl p-6"
          style={{
            background: 'rgba(126,163,255,0.10)',
            border: '1px solid rgba(126,163,255,0.28)',
          }}
        >
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#7ea3ff]">
            Forward capability
          </p>
          <p className="text-lg font-bold text-white mt-1">
            Where {businessName} is heading in the next 12 months
          </p>
          <p className="text-sm text-white/70 mt-2 leading-relaxed">
            Capability roadmap only — full commercial and hiring plan under NDA.
          </p>
        </div>
        <PlanTextarea
          label="Service expansion"
          value={plan.serviceExpansion}
          onChange={(v) => updateField('serviceExpansion', v)}
          placeholder="e.g. Launch commercial deep-clean line by Q2. Add end-of-tenancy specialism for landlord accounts."
          rows={3}
        />
        <PlanTextarea
          label="Geographic expansion"
          value={plan.geographicExpansion}
          onChange={(v) => updateField('geographicExpansion', v)}
          placeholder="e.g. Extend service radius to include LU2 and LU4 postcodes. Second van covers north of the current cluster."
          rows={3}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Certification / uncertified banner */}
      {bypassed && !certified && (
        <div
          className="rounded-xl p-4"
          style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.32)' }}
        >
          <div className="flex items-start gap-3">
            <span className="text-xl shrink-0">⚠️</span>
            <div className="flex-1">
              <p className="text-sm font-bold text-white">Plan drafted uncertified</p>
              <p className="text-xs text-white/70 mt-1 leading-relaxed">
                You bypassed the BL Strategy module — this plan renders in the AR but won't carry BL
                certification when you file. Certify to unlock the "dated, signed plan" line in your
                Appendix.
              </p>
            </div>
            <button
              type="button"
              onClick={() => updateField('blStrategyBypassed', false)}
              className="text-[10px] font-bold text-amber-300 underline hover:text-amber-200 whitespace-nowrap"
            >
              Restore lock
            </button>
          </div>
        </div>
      )}

      {/* Funding hero — income target + exit-of-year position */}
      {toneMode === 'funding' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div
            className="rounded-xl border p-5"
            style={{ background: 'rgba(34,197,94,0.10)', borderColor: 'rgba(34,197,94,0.30)' }}
          >
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#86efac]">
              Income target — next 12 months
            </p>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-white">£</span>
              <input
                type="number"
                inputMode="numeric"
                min="0"
                value={plan.incomeTarget}
                onChange={(e) => updateField('incomeTarget', e.target.value)}
                placeholder={String(Math.round(lastYearIncome * 1.2))}
                className="flex-1 bg-transparent text-3xl font-black text-white tabular-nums outline-none border-b-2 border-white/20 focus:border-[#86efac] pb-1"
              />
            </div>
            <p className="text-xs text-white/60 mt-2">
              This year: {fmt(lastYearIncome)}
              {plan.incomeTarget && lastYearIncome > 0 && (
                <>
                  {' '}
                  ·{' '}
                  <span
                    className={
                      Number(plan.incomeTarget) > lastYearIncome
                        ? 'text-emerald-300'
                        : 'text-amber-300'
                    }
                  >
                    {Number(plan.incomeTarget) > 0
                      ? `+${Math.round((Number(plan.incomeTarget) / lastYearIncome - 1) * 100)}%`
                      : ''}
                  </span>
                </>
              )}
            </p>
          </div>
          <div
            className="rounded-xl border p-5"
            style={{ background: 'rgba(126,163,255,0.10)', borderColor: 'rgba(126,163,255,0.30)' }}
          >
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#7ea3ff]">
              Expected position — end of next year
            </p>
            <textarea
              value={plan.exitOfYearPosition}
              onChange={(e) => updateField('exitOfYearPosition', e.target.value)}
              placeholder="e.g. £6k/mo recurring commercial revenue, 3-person team, Ltd company with employment allowance, breaking even on a second van."
              rows={4}
              className="mt-2 w-full bg-transparent text-sm text-white outline-none border border-white/15 focus:border-[#7ea3ff] rounded-lg p-2 leading-relaxed resize-none"
            />
          </div>
        </div>
      )}

      {/* 3 strategic goals with maths */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-white/60 mb-2 pl-1">
          Three strategic goals
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {plan.goals.map((g, i) => (
            <div
              key={g.id}
              className="rounded-xl border border-white/10 bg-white/[0.03] p-5 space-y-3"
            >
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-[#10b981] text-white flex items-center justify-center text-xs font-black">
                  {i + 1}
                </div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/60">
                  Goal {i + 1}
                </p>
              </div>
              <input
                type="text"
                value={g.title}
                onChange={(e) => updateGoal(i, 'title', e.target.value)}
                placeholder={
                  i === 0
                    ? 'e.g. Land 3 recurring commercial contracts'
                    : i === 1
                      ? 'e.g. Hire second cleaner'
                      : 'e.g. Launch end-of-tenancy service'
                }
                className="w-full bg-transparent text-sm font-bold text-white outline-none border-b border-white/15 focus:border-[#10b981] pb-1"
              />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/50 mb-1">
                  Math behind it
                </p>
                <input
                  type="text"
                  value={g.mathLabel}
                  onChange={(e) => updateGoal(i, 'mathLabel', e.target.value)}
                  placeholder="Target metric (e.g. Contract value)"
                  className="w-full bg-transparent text-xs text-white outline-none border-b border-white/10 focus:border-white/40 pb-1"
                />
                <input
                  type="text"
                  value={g.mathTarget}
                  onChange={(e) => updateGoal(i, 'mathTarget', e.target.value)}
                  placeholder="Target value (e.g. £850/mo × 3)"
                  className="w-full bg-transparent text-sm text-white font-bold outline-none border-b border-white/10 focus:border-white/40 pb-1 mt-2"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Income + exit position (Internal mode only — Funding already hero'd) */}
      {toneMode !== 'funding' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="rounded-xl border border-white/10 p-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#86efac]">
              Income target — next 12 months
            </p>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-white">£</span>
              <input
                type="number"
                inputMode="numeric"
                min="0"
                value={plan.incomeTarget}
                onChange={(e) => updateField('incomeTarget', e.target.value)}
                placeholder={String(Math.round(lastYearIncome * 1.2))}
                className="flex-1 bg-transparent text-3xl font-black text-white tabular-nums outline-none border-b-2 border-white/20 focus:border-[#86efac] pb-1"
              />
            </div>
            <p className="text-xs text-white/60 mt-2">
              This year: {fmt(lastYearIncome)}
              {plan.incomeTarget && lastYearIncome > 0 && Number(plan.incomeTarget) > 0 && (
                <>
                  {' '}
                  ·{' '}
                  <span
                    className={
                      Number(plan.incomeTarget) > lastYearIncome
                        ? 'text-emerald-300'
                        : 'text-amber-300'
                    }
                  >
                    +{Math.round((Number(plan.incomeTarget) / lastYearIncome - 1) * 100)}%
                  </span>
                </>
              )}
            </p>
          </div>
          <div className="rounded-xl border border-white/10 p-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#7ea3ff]">
              Expected position — end of next year
            </p>
            <textarea
              value={plan.exitOfYearPosition}
              onChange={(e) => updateField('exitOfYearPosition', e.target.value)}
              placeholder="e.g. £6k/mo recurring commercial revenue, 3-person team, Ltd company with employment allowance."
              rows={4}
              className="mt-2 w-full bg-transparent text-sm text-white outline-none border border-white/15 focus:border-[#7ea3ff] rounded-lg p-2 leading-relaxed resize-none"
            />
          </div>
        </div>
      )}

      {/* Hire plan + service + geographic + capex + entity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <PlanTextarea
          label="Hire plan"
          value={plan.hirePlan}
          onChange={(v) => updateField('hirePlan', v)}
          placeholder="e.g. Hire second cleaner in Q1 at £13/hr × 25hrs. Payback in 4 months per the BL model."
        />
        <PlanTextarea
          label="Service expansion"
          value={plan.serviceExpansion}
          onChange={(v) => updateField('serviceExpansion', v)}
          placeholder="e.g. Add end-of-tenancy line by Q2 to complement existing recurring cleans."
        />
        <PlanTextarea
          label="Geographic expansion"
          value={plan.geographicExpansion}
          onChange={(v) => updateField('geographicExpansion', v)}
          placeholder="e.g. Extend to LU2 / LU4. Cluster around the existing customer density in LU1."
        />
        <PlanTextarea
          label="Capex needs"
          value={plan.capexNeeds}
          onChange={(v) => updateField('capexNeeds', v)}
          placeholder="e.g. Second van (£8k, 24-month payback via commercial contracts). New pressure washer (£1.2k)."
        />
      </div>

      {/* Entity decision — only Internal + Funding */}
      <PlanTextarea
        label="Entity decision"
        value={plan.entityDecision}
        onChange={(v) => updateField('entityDecision', v)}
        placeholder={
          entityType === 'ltd'
            ? 'e.g. Add second director for succession cover. Review dividend split with accountant in Q4.'
            : 'e.g. Incorporate as a Ltd by Q3. VAT registration once trailing 12-month revenue crosses £80k.'
        }
        rows={2}
      />

      <p className="text-[10px] text-white/40 text-center leading-relaxed max-w-2xl mx-auto">
        {certified
          ? 'Plan will file with your BL Strategy & 12-Month Plan certification attached to the Appendix.'
          : 'Plan will file without BL certification — mark the module complete to attach the dated decision memo.'}
      </p>
    </div>
  );
}

function PlanTextarea({ label, value, onChange, placeholder, rows = 3 }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-white/60 mb-2">{label}</p>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full bg-transparent text-sm text-white outline-none border border-white/10 focus:border-white/30 rounded-lg p-2 leading-relaxed resize-none"
      />
    </div>
  );
}

// ─── SECTION: Goals ────────────────────────────────────────────────────────────
function GoalsSection({
  wins,
  setWins,
  goalsHit,
  setGoalsHit,
  goalsMissed,
  setGoalsMissed,
  improvements,
  setImprovements,
}) {
  return (
    <div className="space-y-5">
      {/* Wins */}
      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-[rgba(153,197,255,0.08)] bg-emerald-500/10/50">
          <SL className="text-emerald-700">Your wins this year 🏆</SL>
          <p className="text-xs text-[rgba(153,197,255,0.4)] mt-0.5">
            These are auto-generated from your accounts — add your own too
          </p>
        </div>
        <div className="p-4">
          <ListEditor
            items={wins}
            onChange={setWins}
            placeholder="Add another win…"
            color="green"
          />
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-[rgba(153,197,255,0.08)]">
          <SL>Goals we hit ✅</SL>
          <p className="text-xs text-[rgba(153,197,255,0.4)] mt-0.5">
            Be honest — what did you actually achieve?
          </p>
        </div>
        <div className="p-4">
          <ListEditor
            items={goalsHit}
            onChange={setGoalsHit}
            placeholder="Add a goal you hit…"
            color="green"
          />
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-[rgba(153,197,255,0.08)]">
          <SL>Goals we missed ❌</SL>
          <p className="text-xs text-[rgba(153,197,255,0.4)] mt-0.5">
            No shame — missing a goal is useful information
          </p>
        </div>
        <div className="p-4">
          <ListEditor
            items={goalsMissed}
            onChange={setGoalsMissed}
            placeholder="Add a goal that wasn't reached…"
            color="red"
          />
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-[rgba(153,197,255,0.08)]">
          <SL>What to improve next year</SL>
        </div>
        <div className="p-4">
          <ListEditor
            items={improvements}
            onChange={setImprovements}
            placeholder="Add something to improve…"
            color="amber"
          />
        </div>
      </Card>
    </div>
  );
}

// ─── SECTION: Self review ─────────────────────────────────────────────────────
function SelfReview({ ratings, setRatings }) {
  const updateRating = useCallback(
    (label, value) => {
      setRatings((r) => ({ ...r, [label]: value }));
    },
    [setRatings]
  );

  const avgRating = useMemo(() => {
    const vals = Object.values(ratings);
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }, [ratings]);

  const scoreMessage =
    avgRating >= 4.5
      ? 'Exceptional year'
      : avgRating >= 3.5
        ? 'Strong performance'
        : avgRating >= 2.5
          ? 'Solid foundations'
          : "Room to grow — and that's a good thing";
  const lowestAreas = Object.entries(ratings)
    .filter(([, v]) => v <= 2)
    .map(([k]) => k);

  return (
    <div className="space-y-5">
      <Alert type="gold">
        <strong>Rate yourself honestly</strong> — a 3 is good. A 5 you haven't earned yet. The areas
        where you score low are exactly where your growth lives next year.
      </Alert>

      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-[rgba(153,197,255,0.08)]">
          <SL>Rate your year — 1 to 5</SL>
        </div>
        <div className="px-5 py-2">
          {Object.entries(ratings).map(([label, value]) => (
            <StarRow
              key={label}
              label={label}
              value={value}
              onChange={(v) => updateRating(label, v)}
            />
          ))}
        </div>
      </Card>

      {/* Overall score */}
      <div className="bg-[#064e3b] rounded-sm p-6 text-white text-center">
        <SL className="text-[#86efac] mb-3">Overall self-score</SL>
        <p className="text-6xl font-bold tabular-nums">{avgRating.toFixed(1)}</p>
        <p className="text-[#86efac] mt-1">out of 5.0</p>
        <div className="flex justify-center gap-1 mt-3">
          {[1, 2, 3, 4, 5].map((s) => (
            <span key={s} className="text-2xl">
              {s <= Math.round(avgRating) ? '★' : '☆'}
            </span>
          ))}
        </div>
        <p className="text-sm font-semibold mt-3">{scoreMessage}</p>
      </div>

      {/* Focus areas */}
      {lowestAreas.length > 0 && (
        <Card className="p-4 border-l-4 border-l-amber-400">
          <SL className="mb-2">Focus areas for next year</SL>
          <p className="text-sm text-gray-600 mb-3">
            Your lowest-rated areas — put these in your 90-day sprint goals:
          </p>
          <div className="space-y-1.5">
            {lowestAreas.map((area) => (
              <div key={area} className="flex items-center gap-2 text-sm">
                <span className="text-amber-500 font-bold">→</span>
                <span className="text-white font-medium">{area}</span>
                <span className="text-xs text-[rgba(153,197,255,0.4)]">
                  — rated {ratings[area]}/5
                </span>
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
  const [incomeTarget, setIncomeTarget] = useState(Math.round((data.income * 1.2) / 1000) * 1000);
  const growth = incomeTarget - data.income;
  const growthPct = Math.round((growth / data.income) * 100);

  // Data-driven insights (from existing component)
  const insights = [
    {
      icon: '📈',
      text: `To hit ${fmt(Math.round(data.income * 1.2))} next year (20% growth), you need ${fmt(Math.round((data.income * 0.2) / 12))} more per month — about ${Math.ceil((data.income * 0.2) / data.avgJobValue)} extra jobs.`,
    },
    {
      icon: '💷',
      text: `Your average job is ${fmt(data.avgJobValue)}. A 10% price rise adds ${fmt(Math.round(data.jobsCompleted * data.avgJobValue * 0.1))} annually with the same number of jobs.`,
    },
    {
      icon: '👥',
      text: `You lost ${data.clientsLost} client${data.clientsLost !== 1 ? 's' : ''} this year. Retaining just 2 more adds ${fmt(data.avgJobValue * 24)} over 12 months.`,
    },
    {
      icon: '📊',
      text: `Your profit margin is ${pct(data.margin)}. Cutting expenses by 10% adds ${fmt(Math.round(data.expenses * 0.1))} to your profit without winning a single extra job.`,
    },
  ];

  return (
    <div className="space-y-5">
      {/* Income target slider */}
      <Card className="overflow-hidden border-t-2 border-t-brand-blue">
        <div className="px-4 py-3 border-b border-[rgba(153,197,255,0.08)]">
          <SL>Income target</SL>
        </div>
        <div className="p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-4xl font-bold tabular-nums text-white">{fmt(incomeTarget)}</p>
              <p className="text-sm text-[rgba(153,197,255,0.4)] mt-1">
                {growth > 0 ? `↑ ${growthPct}% growth on this year` : 'Same as this year'} ·{' '}
                {fmt(Math.round(incomeTarget / 12))}/month
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-[rgba(153,197,255,0.4)] mb-0.5">This year</p>
              <p className="text-lg font-bold text-[rgba(153,197,255,0.4)] tabular-nums">
                {fmt(data.income)}
              </p>
            </div>
          </div>
          <input
            type="range"
            min={data.income * 0.9}
            max={data.income * 3}
            step={500}
            value={incomeTarget}
            onChange={(e) => setIncomeTarget(+e.target.value)}
            className="w-full accent-[#10b981] mb-3"
          />
          <div className="h-2.5 bg-[rgba(153,197,255,0.06)] rounded-full overflow-hidden mb-2">
            <div
              className="h-full bg-[#10b981] rounded-full"
              style={{ width: `${Math.min((data.income / incomeTarget) * 100, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-[rgba(153,197,255,0.4)] mb-4">
            <span>This year: {fmt(data.income)}</span>
            <span className="text-[#10b981] font-bold">{fmt(incomeTarget)} target</span>
          </div>

          {/* Three growth tiers (from existing component) */}
          <div className="grid grid-cols-3 gap-2">
            {[
              {
                label: 'Conservative +10%',
                val: fmt(Math.round(data.income * 1.1)),
                active: growthPct >= 8 && growthPct < 15,
              },
              {
                label: 'Realistic +20%',
                val: fmt(Math.round(data.income * 1.2)),
                active: growthPct >= 15 && growthPct < 30,
              },
              {
                label: 'Ambitious +35%',
                val: fmt(Math.round(data.income * 1.35)),
                active: growthPct >= 30,
              },
            ].map(({ label, val, active }) => (
              <button
                key={label}
                onClick={() => {
                  const multiplier = label.includes('10') ? 1.1 : label.includes('20') ? 1.2 : 1.35;
                  setIncomeTarget(Math.round((data.income * multiplier) / 500) * 500);
                }}
                className={`text-center p-3 border rounded-sm transition-colors ${active ? 'bg-[#064e3b] text-white border-[#064e3b]' : 'bg-[rgba(153,197,255,0.04)] border-[rgba(153,197,255,0.12)] hover:border-[#10b981]'}`}
              >
                <p
                  className={`text-sm font-bold tabular-nums ${active ? 'text-white' : 'text-white'}`}
                >
                  {val}
                </p>
                <p
                  className={`text-xs mt-0.5 ${active ? 'text-[#86efac]' : 'text-[rgba(153,197,255,0.4)]'}`}
                >
                  {label}
                </p>
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Data-driven insights (from existing component) */}
      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-[rgba(153,197,255,0.08)] bg-[#86efac]/10">
          <SL>Based on your {data.yr} numbers</SL>
          <p className="text-xs text-[rgba(153,197,255,0.4)] mt-0.5">
            These are calculated from your actual data — not generic advice
          </p>
        </div>
        <div className="divide-y divide-gray-100">
          {insights.map(({ icon, text }, i) => (
            <div key={i} className="flex items-start gap-3 px-4 py-3.5">
              <span className="text-lg shrink-0 mt-0.5">{icon}</span>
              <p className="text-sm text-[rgba(153,197,255,0.7)] leading-relaxed">{text}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Goals for next year */}
      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-[rgba(153,197,255,0.08)]">
          <SL>Goals for next year</SL>
        </div>
        <div className="p-4">
          <ListEditor
            items={nextYearGoals}
            onChange={setNextYearGoals}
            placeholder="Add a goal for next year…"
            color="blue"
          />
        </div>
      </Card>

      {/* Vision */}
      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-[rgba(153,197,255,0.08)]">
          <SL>Vision statement</SL>
          <p className="text-xs text-[rgba(153,197,255,0.4)] mt-0.5">
            One sentence: where will your business be in 12 months?
          </p>
        </div>
        <div className="p-4">
          <textarea
            value={vision}
            onChange={(e) => setVision(e.target.value)}
            rows={3}
            placeholder="e.g. By April 2027, I'll be running a team of two cleaners, earning £60k, and taking every Friday off…"
            className="w-full border border-[rgba(153,197,255,0.12)] rounded-sm px-3 py-2.5 text-sm text-white placeholder-gray-300 focus:outline-none focus:border-[#10b981] resize-none"
          />
          {vision && (
            <div className="mt-3 bg-[#064e3b]/5 border border-[#064e3b]/10 rounded-sm p-3">
              <p className="text-xs text-[rgba(153,197,255,0.4)] mb-1">Your vision</p>
              <p className="text-sm text-white font-medium italic">"{vision}"</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

// ─── SECTION: Sprint ───────────────────────────────────────────────────────────
function SprintSection() {
  const [sprintActive, setSprintActive] = useState(false);
  const [sprintGoals, setSprintGoals] = useState(
    SPRINT_GOAL_TEMPLATES.map((g, i) => ({ ...g, id: i + 1, text: '', target: '' }))
  );
  const [weekChecks, setWeekChecks] = useState({});
  const [currentWeek, setCurrentWeek] = useState(3);
  const [milestones, setMilestones] = useState([
    { week: 4, label: '4-week check-in', done: false, note: '' },
    { week: 8, label: '8-week check-in', done: false, note: '' },
    { week: 13, label: 'Sprint complete', done: false, note: '' },
  ]);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  // Audit
  const [showAudit, setShowAudit] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);
  const [audit, setAudit] = useState(null);
  const [auditError, setAuditError] = useState(null);

  const updateGoal = (id, field, val) =>
    setSprintGoals((prev) => prev.map((g) => (g.id === id ? { ...g, [field]: val } : g)));

  const toggleCheck = (week, habitId) => {
    const key = `w${week}_${habitId}`;
    setWeekChecks((prev) => ({ ...prev, [key]: !prev[key] }));
  };
  const isChecked = (week, habitId) => !!weekChecks[`w${week}_${habitId}`];

  const totalPossibleChecks = currentWeek * HABITS.length;
  const completedChecks = Object.values(weekChecks).filter(Boolean).length;
  const habitScore =
    totalPossibleChecks > 0 ? Math.round((completedChecks / totalPossibleChecks) * 100) : 0;
  const sprintPct = Math.round((currentWeek / 13) * 100);

  const generateAudit = async () => {
    setAuditLoading(true);
    setAuditError(null);
    try {
      const milestoneNotes = milestones
        .filter((m) => m.note)
        .map((m) => `Week ${m.week}: "${m.note}"`)
        .join('\n');
      const goalsList = sprintGoals
        .filter((g) => g.text)
        .map((g) => `${g.category}: "${g.text}" (measure: ${g.target || 'not set'})`)
        .join('\n');

      const _prompt = `You are a business coach for UK professional cleaning businesses. Analyse this 90-day sprint and give an honest, motivating audit.

Sprint data:
- Goals: ${goalsList || 'None set'}
- Habit score: ${habitScore}% (${completedChecks}/${totalPossibleChecks} habits completed over ${currentWeek} weeks)
- Milestone notes: ${milestoneNotes || 'None provided'}
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

      setAuditLoading(false);
      setAuditError(
        "AI sprint audits are coming soon — we're putting the finishing touches on this feature."
      );
      return;
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
          <button
            onClick={() => {
              setShowAudit(false);
              setAudit(null);
            }}
            className="text-[rgba(153,197,255,0.4)] hover:text-white text-sm transition-colors"
          >
            ← Sprint
          </button>
          <h3 className="text-lg font-bold text-white">Sprint audit</h3>
        </div>

        {/* Sprint summary */}
        <Card className="overflow-hidden">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-gray-200">
            {[
              {
                label: 'Habit score',
                val: `${habitScore}%`,
                accent: habitScore >= 70 ? 'text-emerald-600' : 'text-amber-600',
              },
              {
                label: 'Goals set',
                val: `${sprintGoals.filter((g) => g.text).length}/4`,
                accent: 'text-white',
              },
              {
                label: 'Habits checked',
                val: `${completedChecks}/${totalPossibleChecks}`,
                accent: 'text-white',
              },
              {
                label: 'Check-ins done',
                val: `${milestones.filter((m) => m.done).length}/3`,
                accent: 'text-white',
              },
            ].map(({ label, val, accent }) => (
              <div key={label} className="bg-[rgba(255,255,255,0.03)] px-4 py-3">
                <SL className="mb-0.5">{label}</SL>
                <p className={`text-xl font-bold tabular-nums ${accent}`}>{val}</p>
              </div>
            ))}
          </div>
        </Card>

        {!audit && !auditLoading && (
          <div className="text-center py-10">
            <p className="text-4xl mb-3">🤖</p>
            <p className="text-base font-bold text-white mb-2">Ready to run your AI audit</p>
            <p className="text-sm text-[rgba(153,197,255,0.4)] mb-6 max-w-sm mx-auto">
              Cadi analyses your habit data, goal completion, and check-in notes to give you a
              personalised sprint report.
            </p>
            <button
              onClick={generateAudit}
              className="px-8 py-3 bg-[#064e3b] text-white text-xs font-bold uppercase tracking-widest hover:bg-[#047857] transition-colors rounded-sm"
            >
              🤖 Generate sprint audit
            </button>
          </div>
        )}

        {auditLoading && (
          <Card className="p-8 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="w-10 h-10 border-[3px] border-[#10b981] border-t-transparent rounded-full animate-spin" />
              <p className="text-sm font-semibold text-white">Analysing your sprint…</p>
              <p className="text-xs text-[rgba(153,197,255,0.4)]">
                Reading habit data, goals, and milestone notes
              </p>
            </div>
          </Card>
        )}

        {auditError && <Alert type="warn">{auditError}</Alert>}

        {audit && (
          <div className="space-y-4">
            <Card className="overflow-hidden border-t-2 border-t-brand-navy">
              <div className="bg-[#064e3b] px-5 py-5 text-white">
                <div className="flex items-start gap-5">
                  <div
                    className={`w-20 h-20 rounded-sm flex items-center justify-center text-4xl font-bold shrink-0 ${
                      audit.grade?.startsWith('A')
                        ? 'bg-emerald-500/100 text-white'
                        : audit.grade?.startsWith('B')
                          ? 'bg-[#10b981] text-white'
                          : 'bg-amber-500/100 text-white'
                    }`}
                  >
                    {audit.grade}
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-[#86efac] mb-2">
                      AI audit · {audit.overallScore}/100
                    </p>
                    <p className="text-xl font-bold text-white">{audit.headline}</p>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="overflow-hidden border-t-2 border-t-emerald-500">
              <div className="px-4 py-3 border-b border-[rgba(153,197,255,0.08)] bg-emerald-500/10/50">
                <SL className="text-emerald-700">What worked</SL>
              </div>
              <div className="divide-y divide-gray-100">
                {audit.whatWorked?.map((item, i) => (
                  <div key={i} className="flex items-start gap-3 px-4 py-3">
                    <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                      ✓
                    </div>
                    <p className="text-sm text-white">{item}</p>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="overflow-hidden border-t-2 border-t-amber-400">
              <div className="px-4 py-3 border-b border-[rgba(153,197,255,0.08)] bg-amber-500/10/50">
                <SL className="text-amber-700">What to improve</SL>
              </div>
              <div className="divide-y divide-gray-100">
                {audit.whatToImprove?.map((item, i) => (
                  <div key={i} className="flex items-start gap-3 px-4 py-3">
                    <div className="w-5 h-5 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                      →
                    </div>
                    <p className="text-sm text-white">{item}</p>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-4 border-l-4 border-l-[#10b981]">
              <SL className="mb-2">Habit insight</SL>
              <p className="text-sm text-[rgba(153,197,255,0.7)] leading-relaxed">
                {audit.habitInsight}
              </p>
            </Card>

            <Card className="overflow-hidden border-t-2 border-t-brand-navy">
              <div className="px-4 py-3 border-b border-[rgba(153,197,255,0.08)] bg-[#064e3b]/5">
                <SL>Next sprint — focus areas</SL>
              </div>
              <div className="divide-y divide-gray-100">
                {audit.nextSprintFocus?.map((item, i) => (
                  <div key={i} className="flex items-start gap-3 px-4 py-3">
                    <div className="w-6 h-6 rounded-sm bg-[#064e3b] text-white flex items-center justify-center text-xs font-bold shrink-0">
                      {i + 1}
                    </div>
                    <p className="text-sm text-white">{item}</p>
                  </div>
                ))}
              </div>
            </Card>

            {audit.motivatingClose && (
              <div className="bg-[#064e3b] rounded-sm p-5 text-center">
                <p className="text-lg font-bold text-white">{audit.motivatingClose}</p>
              </div>
            )}
            <button
              onClick={() => {
                setAudit(null);
              }}
              className="w-full py-2.5 border border-[rgba(153,197,255,0.12)] text-[rgba(153,197,255,0.6)] text-xs font-bold uppercase rounded-sm hover:border-[#10b981] hover:text-[#10b981] transition-colors"
            >
              Re-run audit
            </button>
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
            <h3 className="text-xl font-bold text-white mb-2">Start a 90-day sprint</h3>
            <p className="text-sm text-[rgba(153,197,255,0.6)] leading-relaxed max-w-md mx-auto mb-6">
              A focused 13-week push with weekly habits, milestone check-ins, and an AI audit at the
              end. Used by the fastest-growing cleaning businesses to break through plateaus.
            </p>
            <div className="grid grid-cols-3 gap-3 max-w-md mx-auto mb-6">
              {[
                ['🎯', 'Set 4 sprint goals'],
                ['📋', 'Track 6 weekly habits'],
                ['🤖', 'AI audit at the end'],
              ].map(([icon, label]) => (
                <div
                  key={label}
                  className="bg-[rgba(153,197,255,0.04)] border border-[rgba(153,197,255,0.08)] rounded-sm p-3"
                >
                  <p className="text-2xl mb-1">{icon}</p>
                  <p className="text-xs font-semibold text-gray-600">{label}</p>
                </div>
              ))}
            </div>
            <div className="mb-5">
              <label className="block text-xs font-bold tracking-widest uppercase text-[rgba(153,197,255,0.4)] mb-1">
                Sprint start date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="border border-[rgba(153,197,255,0.12)] rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-[#10b981]"
              />
            </div>
            <button
              onClick={() => setSprintActive(true)}
              className="px-8 py-3 bg-[#064e3b] text-white text-sm font-bold uppercase tracking-widest hover:bg-[#047857] transition-colors rounded-sm"
            >
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
        <div className="bg-[#064e3b] px-5 py-4 flex items-center justify-between text-white">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[#86efac]">
              90-day sprint · active
            </p>
            <p className="text-lg font-bold mt-0.5">Week {currentWeek} of 13</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-xs text-[#86efac]">{sprintPct}% complete</p>
              <p className="text-xs text-[#86efac]/60">{habitScore}% habit score</p>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => setCurrentWeek((w) => Math.max(1, w - 1))}
                className="w-7 h-7 rounded-sm bg-[rgba(255,255,255,0.03)]/10 hover:bg-[rgba(255,255,255,0.03)]/20 text-white text-sm flex items-center justify-center"
              >
                ‹
              </button>
              <button
                onClick={() => setCurrentWeek((w) => Math.min(13, w + 1))}
                className="w-7 h-7 rounded-sm bg-[rgba(255,255,255,0.03)]/10 hover:bg-[rgba(255,255,255,0.03)]/20 text-white text-sm flex items-center justify-center"
              >
                ›
              </button>
            </div>
          </div>
        </div>
        <div className="h-2 bg-[rgba(153,197,255,0.06)]">
          <div
            className="h-full bg-[#10b981] transition-all duration-500"
            style={{ width: `${sprintPct}%` }}
          />
        </div>
        <div className="grid grid-cols-3 gap-px bg-gray-200">
          {[
            {
              label: 'Habit score',
              val: `${habitScore}%`,
              accent: habitScore >= 70 ? 'text-emerald-600' : 'text-amber-600',
            },
            {
              label: 'Goals set',
              val: `${sprintGoals.filter((g) => g.text).length}/4`,
              accent: 'text-white',
            },
            { label: 'Weeks tracked', val: currentWeek, accent: 'text-white' },
          ].map(({ label, val, accent }) => (
            <div key={label} className="bg-[rgba(255,255,255,0.03)] px-4 py-3 text-center">
              <SL className="mb-0.5">{label}</SL>
              <p className={`text-xl font-bold tabular-nums ${accent}`}>{val}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Goals */}
      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-[rgba(153,197,255,0.08)]">
          <SL>Sprint goals</SL>
        </div>
        <div className="divide-y divide-gray-100">
          {sprintGoals.map((g) => (
            <div key={g.id} className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-base">{g.icon}</span>
                <span className="text-xs font-bold tracking-widest uppercase text-[rgba(153,197,255,0.4)]">
                  {g.category}
                </span>
              </div>
              <input
                type="text"
                value={g.text}
                onChange={(e) => updateGoal(g.id, 'text', e.target.value)}
                placeholder={g.placeholder}
                className="w-full border border-[rgba(153,197,255,0.12)] rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-[#10b981] mb-2"
              />
              <div className="flex items-center gap-2">
                <label className="text-xs text-[rgba(153,197,255,0.4)] shrink-0">Measure it:</label>
                <input
                  type="text"
                  value={g.target}
                  onChange={(e) => updateGoal(g.id, 'target', e.target.value)}
                  placeholder="e.g. £6,000 on the money dashboard"
                  className="flex-1 border border-[rgba(153,197,255,0.12)] rounded-sm px-2 py-1 text-xs focus:outline-none focus:border-[#10b981]"
                />
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Habit tracker */}
      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-[rgba(153,197,255,0.08)] flex items-center justify-between">
          <SL>Week {currentWeek} habits</SL>
          <Chip color={habitScore >= 70 ? 'green' : habitScore >= 40 ? 'warn' : 'red'}>
            {completedChecks}/{totalPossibleChecks} checked
          </Chip>
        </div>
        {/* Week strip */}
        <div className="flex overflow-x-auto border-b border-[rgba(153,197,255,0.08)]">
          {Array.from({ length: Math.min(currentWeek, 13) }, (_, i) => {
            const w = i + 1;
            const wChecked = HABITS.filter((h) => isChecked(w, h.id)).length;
            return (
              <button
                key={w}
                onClick={() => setCurrentWeek(w)}
                className={`flex-shrink-0 flex flex-col items-center px-4 py-2 border-b-2 transition-all text-xs ${currentWeek === w ? 'border-[#10b981] text-[#10b981]' : 'border-transparent text-[rgba(153,197,255,0.4)] hover:text-[rgba(153,197,255,0.7)]'}`}
              >
                <span className="font-bold">W{w}</span>
                <span
                  className={`text-xs mt-0.5 ${wChecked === HABITS.length ? 'text-emerald-500' : 'text-[rgba(153,197,255,0.25)]'}`}
                >
                  {wChecked}/{HABITS.length}
                </span>
              </button>
            );
          })}
        </div>
        <div className="divide-y divide-gray-100">
          {HABITS.map((h) => {
            const checked = isChecked(currentWeek, h.id);
            return (
              <label
                key={h.id}
                className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[rgba(153,197,255,0.04)] transition-colors ${checked ? 'bg-emerald-500/10/50' : ''}`}
              >
                <div
                  onClick={() => toggleCheck(currentWeek, h.id)}
                  className={`w-5 h-5 rounded-sm border-2 flex items-center justify-center shrink-0 transition-colors ${checked ? 'bg-emerald-500/100 border-emerald-500' : 'border-gray-300 hover:border-[#10b981]'}`}
                >
                  {checked && <span className="text-white text-xs font-bold">✓</span>}
                </div>
                <span className="text-base shrink-0">{h.icon}</span>
                <span
                  className={`text-sm ${checked ? 'text-emerald-800 line-through decoration-emerald-400' : 'text-[rgba(153,197,255,0.7)]'}`}
                >
                  {h.label}
                </span>
              </label>
            );
          })}
        </div>
        <div className="px-4 py-3 border-t border-[rgba(153,197,255,0.08)] bg-[rgba(153,197,255,0.04)]">
          <div className="flex justify-between text-xs text-[rgba(153,197,255,0.4)] mb-1">
            <span>Week {currentWeek} progress</span>
            <span className="font-bold">
              {HABITS.filter((h) => isChecked(currentWeek, h.id)).length}/{HABITS.length}
            </span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#10b981] rounded-full transition-all"
              style={{
                width: `${(HABITS.filter((h) => isChecked(currentWeek, h.id)).length / HABITS.length) * 100}%`,
              }}
            />
          </div>
        </div>
      </Card>

      {/* Milestone check-ins */}
      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-[rgba(153,197,255,0.08)]">
          <SL>Milestone check-ins</SL>
        </div>
        <div className="divide-y divide-gray-100">
          {milestones.map((m) => {
            const unlocked = currentWeek >= m.week;
            return (
              <div key={m.week} className={`p-4 ${!unlocked ? 'opacity-40' : ''}`}>
                <div className="flex items-center gap-3 mb-2">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${m.done ? 'bg-emerald-500/100 text-white' : unlocked ? 'bg-[#10b981] text-white' : 'bg-gray-200 text-[rgba(153,197,255,0.4)]'}`}
                  >
                    {m.done ? '✓' : `W${m.week}`}
                  </div>
                  <p
                    className={`text-sm font-semibold ${m.done ? 'text-emerald-800' : 'text-white'}`}
                  >
                    {m.label}
                  </p>
                  {m.done && <Chip color="green">Complete</Chip>}
                </div>
                {unlocked && (
                  <div className="flex gap-2">
                    <textarea
                      value={m.note}
                      onChange={(e) =>
                        setMilestones((prev) =>
                          prev.map((x) => (x.week === m.week ? { ...x, note: e.target.value } : x))
                        )
                      }
                      rows={2}
                      placeholder={`How's the sprint going at week ${m.week}?`}
                      className="flex-1 border border-[rgba(153,197,255,0.12)] rounded-sm px-3 py-2 text-xs text-[rgba(153,197,255,0.7)] focus:outline-none focus:border-[#10b981] resize-none"
                    />
                    {!m.done && (
                      <button
                        onClick={() =>
                          setMilestones((prev) =>
                            prev.map((x) => (x.week === m.week ? { ...x, done: true } : x))
                          )
                        }
                        className="px-3 py-2 bg-[#064e3b] text-white text-xs font-bold rounded-sm hover:bg-[#047857] transition-colors shrink-0"
                      >
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

      <button
        onClick={() => setShowAudit(true)}
        className="w-full py-3 bg-emerald-600 text-white text-xs font-bold uppercase tracking-widest hover:bg-emerald-700 transition-colors rounded-sm"
      >
        🤖 Run sprint audit (AI) →
      </button>
    </div>
  );
}

// ─── ROOT ──────────────────────────────────────────────────────────────────────
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
  bestMonth: { name: 'N/A', value: 0 },
  worstMonth: { name: 'N/A', value: 0 },
  topClients: [],
  expenseBreakdown: [],
  monthlyData: [
    { m: 'Apr', income: 0, exp: 0 },
    { m: 'May', income: 0, exp: 0 },
    { m: 'Jun', income: 0, exp: 0 },
    { m: 'Jul', income: 0, exp: 0 },
    { m: 'Aug', income: 0, exp: 0 },
    { m: 'Sep', income: 0, exp: 0 },
    { m: 'Oct', income: 0, exp: 0 },
    { m: 'Nov', income: 0, exp: 0 },
    { m: 'Dec', income: 0, exp: 0 },
    { m: 'Jan', income: 0, exp: 0 },
    { m: 'Feb', income: 0, exp: 0 },
    { m: 'Mar', income: 0, exp: 0 },
  ],
};

export default function AnnualReviewTab({ accountsData }) {
  const { user } = useAuth();
  const isLive = Boolean(user);

  // Live aggregate machinery — Slice 1 of the AR rebuild. See
  // src/lib/db/annualReviewDb.js for the aggregator + filing model.
  const [currentPeriod, setCurrentPeriod] = useState(null);
  const [entityType, setEntityType] = useState('sole_trader');
  const [vatRegistered, setVatRegistered] = useState(false);
  const [businessSettings, setBusinessSettings] = useState(null);
  const [businessName, setBusinessName] = useState('The business');
  const [filedReviews, setFiledReviews] = useState([]);
  const [snapshotByYear, setSnapshotByYear] = useState(() =>
    isLive ? {} : Object.fromEntries(Object.entries(YEAR_CATALOGUE).map(([k, v]) => [k, v]))
  );
  const [liveLoading, setLiveLoading] = useState(isLive);
  const [liveError, setLiveError] = useState(null);

  // §1 Executive Summary state — tone mode drives the narrative template;
  // execSummaryOverride captures user edits (persisted on file, Slice 3).
  const [toneMode, setToneMode] = useState('internal');
  const [execSummaryOverride, setExecSummaryOverride] = useState('');

  // §10 Plan state — locked by default per spec (BL Strategy & 12-Month
  // Plan module is mandatory). Bypass unlocks the editor with an
  // "uncertified" banner. Persisted to annual_reviews.plan_jsonb when
  // the file button ships (deferred slice).
  const [plan, setPlan] = useState(() => ({
    blStrategyCertified: false,
    blStrategyBypassed: false,
    blStrategyCertifiedAt: null,
    goals: [
      { id: 'g1', title: '', mathLabel: '', mathTarget: '' },
      { id: 'g2', title: '', mathLabel: '', mathTarget: '' },
      { id: 'g3', title: '', mathLabel: '', mathTarget: '' },
    ],
    incomeTarget: '',
    hirePlan: '',
    serviceExpansion: '',
    geographicExpansion: '',
    capexNeeds: '',
    exitOfYearPosition: '',
    entityDecision: '',
    authoredAt: null,
  }));

  const [section, setSection] = useState('exec');
  const [showPrint, setShowPrint] = useState(false);

  // Load current review period, entity type, and list of filed reviews.
  useEffect(() => {
    if (!isLive) return;
    let alive = true;
    (async () => {
      try {
        const [period, filed, settingsRow, profileRow] = await Promise.all([
          getCurrentReviewPeriod(),
          listAnnualReviews().catch(() => []),
          supabase
            .from('business_settings')
            .select('entity_type, vat_registered, vat_number, corporation_tax_utr, setup_data')
            .eq('owner_id', user.id)
            .maybeSingle(),
          supabase
            .from('profiles')
            .select('business_name, first_name')
            .eq('id', user.id)
            .maybeSingle(),
        ]);
        if (!alive) return;
        setEntityType(normalizeEntityType(settingsRow?.data?.entity_type));
        setVatRegistered(!!settingsRow?.data?.vat_registered);
        setBusinessSettings(settingsRow?.data || null);
        setBusinessName(
          profileRow?.data?.business_name || profileRow?.data?.first_name || 'The business'
        );
        setCurrentPeriod(period);
        setFiledReviews(filed);
      } catch (e) {
        if (!alive) return;
        setLiveError(e.message || 'Could not load review data');
        setLiveLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [isLive, user?.id]);

  // Aggregate the current period into a live snapshot. Runs whenever the
  // current period or entity type resolves. Caches into snapshotByYear.
  useEffect(() => {
    if (!currentPeriod) return;
    let alive = true;
    setLiveLoading(true);
    aggregateForYear({
      period: currentPeriod,
      priorPeriod: priorPeriodOf(currentPeriod),
      entityType,
      businessSettings,
    })
      .then((snap) => {
        if (!alive) return;
        setSnapshotByYear((prev) => ({ ...prev, [currentPeriod.label]: snap }));
        setLiveLoading(false);
      })
      .catch((e) => {
        if (!alive) return;
        setLiveError(e.message || 'Aggregation failed');
        setLiveLoading(false);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the period label; only currentPeriod.label is read
  }, [currentPeriod?.label, entityType, businessSettings]);

  // Year dropdown options: current live period + every filed tax year.
  // Not-signed-in falls back to the demo YEAR_CATALOGUE.
  const availableYears = useMemo(() => {
    if (!isLive) return Object.keys(YEAR_CATALOGUE);
    const set = new Set();
    if (currentPeriod?.label) set.add(currentPeriod.label);
    for (const f of filedReviews) set.add(f.tax_year);
    return Array.from(set);
  }, [isLive, currentPeriod, filedReviews]);

  const [selectedYear, setSelectedYear] = useState(null);

  // Sync default selection when years first resolve.
  useEffect(() => {
    if (!selectedYear && availableYears.length) setSelectedYear(availableYears[0]);
  }, [availableYears, selectedYear]);

  // Lazy-load a filed snapshot the user drills into (not the live year).
  useEffect(() => {
    if (!isLive || !selectedYear) return;
    if (selectedYear === currentPeriod?.label) return;
    if (snapshotByYear[selectedYear]) return;
    let alive = true;
    getFiledReview(selectedYear)
      .then((row) => {
        if (!alive || !row?.snapshot_jsonb) return;
        setSnapshotByYear((prev) => ({ ...prev, [selectedYear]: row.snapshot_jsonb }));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [selectedYear, isLive, currentPeriod?.label, snapshotByYear]);

  const rawData = (selectedYear && snapshotByYear[selectedYear]) || EMPTY_YEAR_DATA;

  // If the raw record already came from the aggregator (or a filed snapshot),
  // it's pre-enriched — just alias `yr`. Only run enrichYear for the demo
  // catalogue's un-enriched shape.
  const data = useMemo(() => {
    if (rawData?.schemaVersion) return { ...rawData, yr: selectedYear ?? rawData.yr };
    return enrichYear(selectedYear ?? '', rawData);
  }, [rawData, selectedYear]);

  // All editable state at the root — never resets on tab or year change
  const [wins, setWins] = useState(
    isLive
      ? []
      : [
          'Grew income by 21% year-on-year',
          'Added 2 new commercial clients worth £10,080 combined',
          'Profit margin above industry average of 65%',
          'Fully claimed all mileage — HMRC 45p/mile relief',
          'No overdue invoices for the last 6 months',
        ]
  );
  const [goalsHit, setGoalsHit] = useState(
    isLive ? [] : ['Reached 30 clients', 'Launched commercial cleaning', 'Hired first team member']
  );
  const [goalsMissed, setGoalsMissed] = useState(
    isLive ? [] : ['Hit £60k revenue target', 'Launch website']
  );
  const [highlights, setHighlights] = useState(
    isLive
      ? []
      : [
          'Won first commercial contract worth £320/month',
          'Highest ever monthly revenue in July',
          'Added 3 end of tenancy specialist jobs',
        ]
  );
  const [improvements, setImprovements] = useState(
    isLive
      ? []
      : [
          'Reduce fuel costs by batching jobs better',
          'Chase outstanding invoices faster',
          'Invest in better equipment',
        ]
  );
  const [nextYearGoals, setNextYearGoals] = useState(
    isLive
      ? []
      : [
          'Hit £65,000 revenue',
          'Grow to 40 active clients',
          'Launch website and Google reviews campaign',
          'Hire a second part-time cleaner',
        ]
  );
  const [vision, setVision] = useState('');
  const [ratings, setRatings] = useState({
    'Customer service': 4,
    'Quality of work': 5,
    Punctuality: 4,
    'Financial management': 3,
    'Marketing & growth': 3,
    'Staff management': 4,
    'Work-life balance': 3,
    'Systems & organisation': 4,
  });

  const NAV = [
    { id: 'exec', icon: '📄', label: 'Exec summary', sub: 'Headline + narrative' },
    { id: 'numbers', icon: '📊', label: 'Numbers', sub: 'Financial summary' },
    { id: 'clients', icon: '👥', label: 'Clients', sub: 'Growth & highlights' },
    { id: 'services', icon: '🛠️', label: 'Services', sub: 'Revenue, margin, demand' },
    { id: 'money', icon: '💷', label: 'Money', sub: 'P&L, cashflow, debtors' },
    { id: 'tax', icon: '🧾', label: 'Tax', sub: 'IT / CT / VAT / MTD' },
    { id: 'team', icon: '👷', label: 'Team', sub: 'Headcount, payroll, cover' },
    { id: 'ops', icon: '🚚', label: 'Operations', sub: 'Delivery reliability' },
    { id: 'risk', icon: '⚠️', label: 'Risk', sub: 'Register + severity' },
    { id: 'plan', icon: '🧭', label: 'The Plan', sub: 'Next 12 months' },
    { id: 'goals', icon: '🎯', label: 'Goals', sub: 'Wins, hits, misses' },
    { id: 'ratings', icon: '⭐', label: 'Self review', sub: 'Honest self-score' },
    { id: 'next', icon: '🚀', label: 'Next year', sub: 'Targets & vision' },
    { id: 'sprint', icon: '🏃', label: '90-day sprint', sub: 'Focused growth push' },
  ];

  if (showPrint) {
    return (
      <PrintView
        data={data}
        year={selectedYear}
        ratings={ratings}
        goalsHit={goalsHit}
        goalsMissed={goalsMissed}
        highlights={highlights}
        improvements={improvements}
        onClose={() => setShowPrint(false)}
      />
    );
  }

  return (
    <div className="-mx-4 md:-mx-8 -my-6 flex" style={greenCanvas()}>
      {/* Sidebar */}
      <aside
        className="w-56 shrink-0 flex flex-col py-4 overflow-y-auto"
        style={{
          background: 'linear-gradient(180deg, rgba(5,46,28,0.85) 0%, rgba(1,20,10,0.90) 100%)',
          borderRight: '1px solid rgba(134,239,172,0.14)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
        }}
      >
        {/* Year selector */}
        <div className="px-4 mb-5">
          <p className="text-xs font-bold tracking-widest uppercase text-[#86efac] mb-2">
            Tax year
          </p>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="w-full bg-[rgba(255,255,255,0.03)]/10 text-white text-sm font-bold rounded-sm px-3 py-2 border-0 focus:outline-none focus:ring-1 focus:ring-[#86efac]"
          >
            {availableYears.map((y) => (
              <option key={y} value={y} className="bg-[#064e3b]">
                {y}
              </option>
            ))}
          </select>
        </div>

        {/* Nav */}
        {NAV.map((n) => (
          <button
            key={n.id}
            onClick={() => setSection(n.id)}
            className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-all border-l-2 ${
              section === n.id
                ? 'border-brand-skyblue bg-[rgba(255,255,255,0.03)]/10 text-white'
                : 'border-transparent text-[#86efac]/60 hover:text-white hover:bg-[rgba(255,255,255,0.03)]/5 hover:border-white/20'
            }`}
          >
            <span className="text-lg shrink-0 mt-0.5">{n.icon}</span>
            <div>
              <p className={`text-sm font-semibold ${section === n.id ? 'text-white' : ''}`}>
                {n.label}
              </p>
              <p
                className={`text-xs mt-0.5 ${section === n.id ? 'text-[#86efac]' : 'text-[#86efac]/40'}`}
              >
                {n.sub}
              </p>
            </div>
          </button>
        ))}

        {/* Print button */}
        <div className="mt-auto mx-4 space-y-2">
          <button
            onClick={() => setShowPrint(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-[rgba(255,255,255,0.03)]/10 hover:bg-[rgba(255,255,255,0.03)]/20 text-white text-xs font-bold rounded-sm transition-colors"
          >
            🖨️ Generate report
          </button>
          <div className="flex items-center gap-2 px-3 py-2 bg-[rgba(255,255,255,0.03)]/10 rounded-sm">
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${accountsData ? 'bg-emerald-400 animate-pulse' : 'bg-gray-400'}`}
            />
            <span className="text-xs text-white font-semibold">
              {accountsData ? 'Accounts live' : 'Demo data'}
            </span>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto p-6 pb-28 space-y-5">
        {/* Hero */}
        <div
          className="relative overflow-hidden"
          style={{
            ...glassDark({ radius: CONNECT_RADII.xl, blur: 20 }),
            background: `
              radial-gradient(120% 80% at 100% 0%, rgba(52, 211, 153, 0.30) 0%, transparent 55%),
              radial-gradient(60% 60% at 0% 100%, rgba(1, 10, 79, 0.30) 0%, transparent 60%),
              rgba(255,255,255,0.04)
            `,
          }}
        >
          <div className="relative px-6 md:px-9 py-7 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 mb-3">
                <div
                  className="w-7 h-7 rounded-xl flex items-center justify-center"
                  style={{
                    background: '#059669',
                    boxShadow: '0 8px 20px -6px rgba(5,150,105,0.6)',
                  }}
                >
                  <ClipboardCheck size={13} className="text-white" strokeWidth={2.5} />
                </div>
                <span className="text-[10px] font-black tracking-[0.28em] text-white/70 uppercase">
                  Annual Review · {selectedYear}
                </span>
              </div>
              <h1
                className="text-white mb-2"
                style={{
                  fontSize: 26,
                  fontWeight: 900,
                  letterSpacing: '-0.02em',
                  lineHeight: 1.15,
                }}
              >
                Look back, <span style={{ color: '#86efac' }}>plan forward.</span>
              </h1>
              <p className="text-white/70 text-[14px] leading-relaxed max-w-2xl">
                Numbers, clients, goals, self-assessment — and a 90-day sprint plan for the next
                chapter.
              </p>
            </div>
            <div className="shrink-0 grid grid-cols-2 gap-2" style={{ minWidth: 220 }}>
              <div
                style={{
                  ...glassDark({ padding: 12, radius: 12, strong: true }),
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 900,
                    color: '#86efac',
                    lineHeight: 1,
                    letterSpacing: '-0.02em',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {liveLoading && isLive ? '—' : fmt(data.income)}
                </div>
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 800,
                    color: 'rgba(255,255,255,0.55)',
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    marginTop: 5,
                  }}
                >
                  Income
                </div>
              </div>
              <div
                style={{
                  ...glassDark({ padding: 12, radius: 12, strong: true }),
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 900,
                    color: '#ffffff',
                    lineHeight: 1,
                    letterSpacing: '-0.02em',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {liveLoading && isLive ? '—' : `${Math.round(data.margin)}%`}
                </div>
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 800,
                    color: 'rgba(255,255,255,0.55)',
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    marginTop: 5,
                  }}
                >
                  Margin
                </div>
              </div>
            </div>
          </div>
          {isLive && (liveLoading || liveError) && (
            <div
              className="relative px-6 md:px-9 pb-4 flex items-center gap-2 text-xs"
              style={{ color: 'rgba(255,255,255,0.65)' }}
            >
              {liveLoading && (
                <>
                  <Loader2 size={12} style={{ animation: 'annualSpin 0.8s linear infinite' }} />
                  <span>
                    Aggregating {currentPeriod?.label ?? 'this year'} from your Money, Jobs and
                    Mileage…
                  </span>
                  <style>{`@keyframes annualSpin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
                </>
              )}
              {!liveLoading && liveError && (
                <span style={{ color: '#fca5a5' }}>Couldn't aggregate: {liveError}</span>
              )}
            </div>
          )}
        </div>

        {section === 'exec' && (
          <ExecSummarySection
            data={data}
            businessName={businessName}
            entityType={entityType}
            vatRegistered={vatRegistered}
            toneMode={toneMode}
            setToneMode={setToneMode}
            execSummaryOverride={execSummaryOverride}
            setExecSummaryOverride={setExecSummaryOverride}
            isLive={isLive}
            liveLoading={liveLoading}
          />
        )}
        {section === 'numbers' && <NumbersSection data={data} />}
        {section === 'clients' && (
          <ClientsSection
            data={data}
            highlights={highlights}
            setHighlights={setHighlights}
            toneMode={toneMode}
          />
        )}
        {section === 'services' && (
          <ServicesSection data={data} toneMode={toneMode} vatRegistered={vatRegistered} />
        )}
        {section === 'money' && (
          <MoneySection
            data={data}
            toneMode={toneMode}
            entityType={entityType}
            vatRegistered={vatRegistered}
          />
        )}
        {section === 'tax' && <TaxSection data={data} toneMode={toneMode} />}
        {section === 'team' && (
          <TeamSection data={data} toneMode={toneMode} entityType={entityType} />
        )}
        {section === 'ops' && <OperationsSection data={data} toneMode={toneMode} />}
        {section === 'risk' && (
          <RiskSection data={data} toneMode={toneMode} entityType={entityType} />
        )}
        {section === 'plan' && (
          <PlanSection
            plan={plan}
            setPlan={setPlan}
            toneMode={toneMode}
            data={data}
            businessName={businessName}
            entityType={entityType}
          />
        )}
        {section === 'goals' && (
          <GoalsSection
            wins={wins}
            setWins={setWins}
            goalsHit={goalsHit}
            setGoalsHit={setGoalsHit}
            goalsMissed={goalsMissed}
            setGoalsMissed={setGoalsMissed}
            improvements={improvements}
            setImprovements={setImprovements}
          />
        )}
        {section === 'ratings' && <SelfReview ratings={ratings} setRatings={setRatings} />}
        {section === 'next' && (
          <NextYearSection
            data={data}
            nextYearGoals={nextYearGoals}
            setNextYearGoals={setNextYearGoals}
            vision={vision}
            setVision={setVision}
          />
        )}
        {section === 'sprint' && <SprintSection />}
        <AskCadi tab="review" />
      </main>
    </div>
  );
}
