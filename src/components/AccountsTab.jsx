// src/components/AccountsTab.jsx
// Cadi — Accounts · glassmorphism redesign
// HMRC Connect · MTD ITSA · live InvoiceContext data · SA103 mapping

import { useState, useMemo, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { useInvoices, invTotal, invCustomerName } from "../context/InvoiceContext";
import { useHmrc } from "../hooks/useHmrc";
import { supabase } from "../lib/supabase";
import { useBusinessId } from "../hooks/useBusinessId";
import { getBusinessSettings } from "../lib/db/settingsDb";
import { useYtdExpenses, CATEGORY_TO_SA103 } from "../hooks/useYtdExpenses";
import { useYtdIncome, SOURCE_DISPLAY } from "../hooks/useYtdIncome";
import { currentTaxYear, taxYearStart, taxYearLabel, parseTaxYearLabel, recentTaxYears, today } from "../lib/taxYear";
import { calculateCT, calcSelfEmployedTax } from "../lib/taxCalc";

// ─── Calculator logic (unchanged) ────────────────────────────────────────────
const FRS_RATES = {
  "cleaning-domestic":   12.0,
  "cleaning-commercial": 12.0,
  "maintenance":          9.5,
  "limited-cost":        16.5,
};
function calculateVAT({ turnover, businessType, goods, otherInput, firstYear }) {
  const gross       = turnover * 1.20;
  const vatCharged  = turnover * 0.20;
  const goodsVAT    = goods * 0.20;
  const totalInput  = goodsVAT + otherInput;
  const standardPay = vatCharged - totalInput;
  const goodsPct    = gross > 0 ? (goods / gross) * 100 : 0;
  const isLimited   = goodsPct < 2 || goods < 250;
  const baseRate    = isLimited ? 16.5 : (FRS_RATES[businessType] ?? 12.0);
  const discount    = (!isLimited && firstYear) ? 1.0 : 0;
  const frsRate     = baseRate - discount;
  const frsPay      = gross * (frsRate / 100);
  const saving      = standardPay - frsPay;
  return { gross, vatCharged, totalInput, standardPay, frsRate, frsPay, saving, isLimited, goodsPct, annualSaving: saving * 4 };
}
// Tax functions live in src/lib/taxCalc.js — shared with MoneyTracker so the
// two tabs always agree on the user's tax bill.
// (imported below; this stub kept for git-history continuity)

function calculatePension(monthly, profit) {
  const annual        = monthly * 12;
  const govTopup      = annual * 0.25;
  const totalIn       = annual + govTopup;
  const rate          = profit > 50270 ? 0.40 : profit > 12570 ? 0.20 : 0;
  const taxSaved      = annual * rate;
  const effectiveCost = annual - taxSaved;
  return { annual, govTopup, totalIn, taxSaved, effectiveCost, rate };
}

// ─── Quarterly data helpers ───────────────────────────────────────────────────
const TAX_QUARTERS = [
  { id: "Q1", label: "Q1", from: "04-06", to: "07-05", due: "Aug 5"  },
  { id: "Q2", label: "Q2", from: "07-06", to: "10-05", due: "Nov 5"  },
  { id: "Q3", label: "Q3", from: "10-06", to: "01-05", due: "Feb 5"  },
  { id: "Q4", label: "Q4", from: "01-06", to: "04-05", due: "May 5"  },
];

function getQuarterBounds(year, q) {
  // year = start year of tax year, e.g. 2026 for 2026/27
  if (q.id === "Q3") {
    return { start: `${year}-${q.from}`, end: `${year + 1}-01-05` };
  }
  if (q.id === "Q4") {
    return { start: `${year + 1}-01-06`, end: `${year + 1}-04-05` };
  }
  return { start: `${year}-${q.from}`, end: `${year}-${q.to}` };
}

function getQuarterIncome(invoices, start, end) {
  return invoices
    .filter(inv => {
      if (inv.status !== "paid" || !inv.paidAt) return false;
      const d = inv.paidAt.slice(0, 10);
      return d >= start && d <= end;
    })
    .reduce((s, inv) => s + invTotal(inv), 0);
}

// ─── Glass design system ──────────────────────────────────────────────────────
const fmt  = (n) => `£${Math.round(n).toLocaleString()}`;
const fmt2 = (n) => `£${Number(n).toFixed(2)}`;

function GCard({ children, className = "" }) {
  return (
    <div className={`relative bg-[rgba(255,255,255,0.04)] border border-[rgba(153,197,255,0.12)] rounded-2xl overflow-hidden ${className}`}>
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#99c5ff]/50 to-transparent" />
      {children}
    </div>
  );
}

function SL({ children, className = "" }) {
  return (
    <p className={`text-[10px] font-black tracking-[0.15em] uppercase text-[rgba(153,197,255,0.45)] ${className}`}>
      {children}
    </p>
  );
}

function GInput({ label, ...props }) {
  return (
    <div>
      {label && <SL className="mb-1.5">{label}</SL>}
      <input
        {...props}
        className="w-full px-3 py-2.5 text-sm text-white bg-[rgba(153,197,255,0.06)] border border-[rgba(153,197,255,0.15)] rounded-xl focus:outline-none focus:border-[rgba(153,197,255,0.4)] placeholder-[rgba(153,197,255,0.25)]"
      />
    </div>
  );
}

function GSelect({ label, children, ...props }) {
  return (
    <div>
      {label && <SL className="mb-1.5">{label}</SL>}
      <select
        {...props}
        className="w-full px-3 py-2.5 text-sm text-white bg-[rgba(153,197,255,0.06)] border border-[rgba(153,197,255,0.15)] rounded-xl focus:outline-none focus:border-[rgba(153,197,255,0.4)]"
      >
        {children}
      </select>
    </div>
  );
}

function GStatCard({ label, value, sub, valueColor = "text-white" }) {
  return (
    <GCard className="p-4">
      <SL className="mb-1">{label}</SL>
      <p className={`text-2xl font-black tabular-nums ${valueColor}`}>{value}</p>
      {sub && <p className="text-[11px] text-[rgba(153,197,255,0.45)] mt-0.5">{sub}</p>}
    </GCard>
  );
}

function GAlert({ type = "blue", children }) {
  const styles = {
    blue:  "bg-[#1f48ff]/08 border-[#1f48ff]/20 text-[#99c5ff]",
    green: "bg-emerald-500/08 border-emerald-500/20 text-emerald-300",
    warn:  "bg-amber-500/08 border-amber-500/20 text-amber-300",
    red:   "bg-red-500/08 border-red-500/20 text-red-300",
    gold:  "bg-yellow-500/08 border-yellow-500/20 text-yellow-200",
  };
  const icons = { blue: "ℹ️", green: "✅", warn: "⚠️", red: "🔴", gold: "💡" };
  return (
    <div className={`flex gap-3 p-3.5 rounded-xl border text-xs leading-relaxed ${styles[type]}`}>
      <span className="shrink-0 mt-0.5">{icons[type]}</span>
      <div>{children}</div>
    </div>
  );
}

function GChip({ children, color = "blue" }) {
  const styles = {
    blue:   "bg-[#1f48ff]/10 border-[#1f48ff]/20 text-[#99c5ff]",
    green:  "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
    amber:  "bg-amber-500/10 border-amber-500/20 text-amber-400",
    red:    "bg-red-500/10 border-red-500/20 text-red-400",
    ghost:  "bg-[rgba(153,197,255,0.06)] border-[rgba(153,197,255,0.12)] text-[rgba(153,197,255,0.5)]",
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black border ${styles[color]}`}>
      {children}
    </span>
  );
}

function SectionDivider({ label, right }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <SL>{label}</SL>
      <div className="flex-1 h-px bg-[rgba(153,197,255,0.08)]" />
      {right}
    </div>
  );
}

// ─── TAB: Overview ────────────────────────────────────────────────────────────
function OverviewTab({ setActiveTab, entityType = 'sole_trader', bizSettings = {} }) {
  const { invoices } = useInvoices();
  const { user } = useAuth();
  const isDemo  = user?.id === 'demo-user';
  const isLtd   = entityType === 'limited_company';

  const YTD_START   = taxYearStart();
  const ytdPaid     = invoices.filter(i => i.status === "paid" && (i.paidAt ?? "").slice(0, 10) >= YTD_START);
  const ytdIncome   = ytdPaid.reduce((s, i) => s + invTotal(i), 0);
  const outstanding = invoices.filter(i => i.status !== "paid" && i.status !== "draft")
                               .reduce((s, i) => s + invTotal(i), 0);
  const overdue     = invoices.filter(i => i.status === "overdue")
                               .reduce((s, i) => s + invTotal(i), 0);

  const ytdExpData   = useYtdExpenses(currentTaxYear());
  const ytdExpenses  = isDemo ? 557 : ytdExpData.ytdTotal;
  const netProfit    = Math.max(0, ytdIncome - ytdExpenses);
  const annualTarget = isDemo ? 65000 : (Number(bizSettings.annual_target) || 0);
  const ytdAll       = isDemo ? 41820 : ytdIncome;
  const ytdPct       = annualTarget > 0 ? Math.round((ytdAll / annualTarget) * 100) : 0;

  // ── Tax estimate — branches on entity type ───────────────────────────────
  // Sole traders: use the banded income tax + Class 4 NI calculator from taxCalc.js
  //   so the YTD estimate matches the Money tab's TaxEstimate card exactly.
  // Limited co: corporation tax with marginal-relief band.
  const directorSalary     = isLtd ? (bizSettings.director_salary_annual ?? 12570) : 0;
  const annualisedProfit   = isLtd ? Math.max(0, (ytdAll * (12 / 1.5)) - directorSalary) : netProfit;
  const ctEst              = isLtd ? calculateCT(annualisedProfit) : 0;
  const seTax              = !isLtd ? calcSelfEmployedTax(netProfit) : null;
  const itEst              = isLtd ? 0 : seTax.total;
  const taxEst             = isLtd ? ctEst / (12 / 1.5) : itEst;
  const taxReserve         = isDemo ? 4260 : (Number(bizSettings.tax_reserve) || 0);
  const taxLabel           = isLtd ? "CT estimate (YTD)" : "Tax estimate";
  const taxSub             = isLtd
    ? `19% / 25% CT · £${Math.round(directorSalary / 1000)}k director salary`
    : seTax && seTax.total > 0
      ? `Income tax £${Math.round(seTax.incomeTax).toLocaleString()} + Class 4 NI £${Math.round(seTax.ni).toLocaleString()}`
      : 'No tax due — profit under personal allowance';

  const INSIGHTS = isLtd ? [
    { emoji: "💰", title: "Director salary vs dividends",          body: "Pay yourself up to £9,100 as salary (no NI), then extract remaining profits as dividends at 8.75%.", action: "tax-tools" },
    { emoji: "📦", title: "Claim AIA on company equipment",        body: "£1m Annual Investment Allowance — WFP, carpet cleaner, vans. Reduces your CT bill.", },
    { emoji: "🏛️", title: "CT600 — file within 12 months",         body: "Your CT600 must be filed within 12 months of your accounting year end. Cadi tracks the deadline.", action: "year-end" },
    { emoji: "🏢", title: "Companies House annual accounts",        body: "Private companies must file accounts 9 months after the year end. Missing the deadline is a £150 fine.", action: "year-end" },
  ] : isDemo ? [
    { emoji: "🚐", title: "Log 1,620 unlogged miles — save £729",  body: "At HMRC's 45p/mile rate you have £729 of unclaimed relief sitting idle.", action: "mileage" },
    { emoji: "🎯", title: "Pension contributions save £820/yr",    body: "£4,100 into a SIPP = £820 tax relief. Money for retirement AND off your bill.", action: "tax-tools" },
    { emoji: "⚙️", title: "Claim AIA on new equipment",            body: "WFP brush head, carpet cleaner — Annual Investment Allowance = 100% first-year relief." },
    { emoji: "🏛️", title: "Q1 MTD update due 5 Aug 2026",          body: "You're 6 days into Q1 2026/27. Your submission data is ready to preview.", action: "hmrc" },
  ] : [
    { emoji: "🚐", title: "Log every mile — 45p/mile HMRC relief", body: "Record business journeys in the Routes tab. Every mile cuts your tax bill.", action: "mileage" },
    { emoji: "🎯", title: "Pension contributions cut your tax",    body: "SIPP contributions get 20% tax relief on top. Save for retirement, pay less now.", action: "tax-tools" },
    { emoji: "⚙️", title: "Claim AIA on equipment",                body: "WFP brush head, carpet cleaner, van — Annual Investment Allowance = 100% first-year relief." },
    { emoji: "🏛️", title: "MTD ITSA quarterly updates",            body: "Cadi tracks your quarterly submission windows and maps spend to SA103 boxes.", action: "hmrc" },
  ];

  const asOfLabel  = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const expensesSub = isDemo
    ? "Demo · connect Money tab"
    : ytdExpData.loading
      ? "Loading…"
      : ytdExpenses > 0
        ? `From ${ytdExpData.rows.filter(r => r.source === 'bank').length} bank · ${ytdExpData.rows.filter(r => r.source === 'manual').length} manual`
        : "Connect bank or log expenses in Money tab";
  const headerSub  = isLtd
    ? "Corporation tax · director salary & dividends"
    : isDemo ? "Live from your invoices · demo expenses" : "Live from your invoices · connect Money tab for expenses";
  const periodLabel = isLtd ? `Accounting year · as of ${asOfLabel}` : `Tax year 2026/27 · As of ${asOfLabel}`;

  return (
    <div className="space-y-5">
      <div>
        <SL className="mb-0.5">{periodLabel}</SL>
        <h2 className="text-2xl font-black text-white">
          {isLtd ? "Company Tax Dashboard" : "Tax Dashboard"}
        </h2>
        <p className="text-xs text-[rgba(153,197,255,0.45)] mt-0.5">{headerSub}</p>
      </div>

      {/* Entity badge */}
      {isLtd && (
        <GAlert type="blue">
          <strong>Limited company</strong> — Corporation Tax applies. Director salary & dividends shown below.
          MTD ITSA does not apply to your company. CT600 is filed via HMRC online or your accountant.
        </GAlert>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <GStatCard label="YTD income received"  value={fmt(ytdIncome)}  valueColor="text-emerald-400" sub={`${ytdPaid.length} paid invoices`} />
        <GStatCard label="Outstanding"          value={fmt(outstanding)} valueColor={outstanding > 0 ? "text-amber-400" : "text-emerald-400"} sub={overdue > 0 ? `${fmt(overdue)} overdue` : "Nothing overdue"} />
        <GStatCard label="YTD expenses"         value={fmt(ytdExpenses)} valueColor="text-red-400"    sub={expensesSub} />
        <GStatCard label={taxLabel}             value={fmt(taxEst)}      valueColor="text-amber-400"  sub={taxSub} />
      </div>

      {/* Ltd: Director salary & dividend plan */}
      {isLtd && (
        <GCard className="p-4 space-y-3">
          <SL>Director salary & dividend planning</SL>
          <p className="text-[11px] text-[rgba(153,197,255,0.45)] leading-relaxed">
            Optimal structure: salary up to the secondary NI threshold (no NI for company or director), then pay remaining profits as dividends.
          </p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Director salary",    val: fmt(directorSalary),                     color: "text-white",       sub: "No NI either side" },
              { label: "Remaining profit",   val: fmt(Math.max(0, annualisedProfit)),       color: "text-emerald-400", sub: "Available as dividends" },
              { label: "Corporation Tax",    val: fmt(annualisedProfit > 0 ? ctEst : 0),   color: "text-amber-400",   sub: annualisedProfit <= 50000 ? "19% small profits" : "Marginal relief" },
            ].map(({ label, val, color, sub }) => (
              <div key={label} className="p-3 rounded-xl bg-[rgba(153,197,255,0.04)] border border-[rgba(153,197,255,0.08)]">
                <SL className="mb-1">{label}</SL>
                <p className={`text-lg font-black tabular-nums ${color}`}>{val}</p>
                <p className="text-[10px] text-[rgba(153,197,255,0.3)] mt-0.5">{sub}</p>
              </div>
            ))}
          </div>
          <GAlert type="gold">
            Dividend allowance is £500/yr — above that, basic-rate dividends are taxed at 8.75%.
            Your accountant can confirm the optimal salary/dividend split for your personal circumstances.
          </GAlert>
        </GCard>
      )}

      {/* Annual target */}
      <GCard className="p-4">
        <div className="flex items-center justify-between mb-2">
          <SL>Annual target progress</SL>
          {annualTarget > 0
            ? <span className="text-xs font-black text-white tabular-nums">{fmt(ytdAll)} / {fmt(annualTarget)}</span>
            : <span className="text-xs text-[rgba(153,197,255,0.4)]">Not set</span>}
        </div>
        {annualTarget > 0 ? (
          <>
            <div className="h-2 rounded-full bg-[rgba(153,197,255,0.08)] overflow-hidden">
              <div className="h-full rounded-full bg-[#1f48ff] transition-all" style={{ width: `${Math.min(ytdPct, 100)}%` }} />
            </div>
            <div className="flex justify-between mt-1.5 text-[10px] text-[rgba(153,197,255,0.35)]">
              <span>{ytdPct}% of {fmt(annualTarget)} target</span>
              <span>{fmt(annualTarget - ytdAll)} to go</span>
            </div>
          </>
        ) : (
          <p className="text-xs text-[rgba(153,197,255,0.55)]">Set a revenue target in Settings to track yearly progress.</p>
        )}
      </GCard>

      {/* Tax reserve */}
      <GCard className="p-4">
        <div className="flex items-center justify-between mb-1">
          <SL>Tax reserve</SL>
          <GChip color={taxReserve >= taxEst ? "green" : "amber"}>{taxReserve >= taxEst ? "✓ On track" : "⚠ Short"}</GChip>
        </div>
        <div className="flex items-baseline gap-2 mb-2">
          <span className="text-2xl font-black text-yellow-400 tabular-nums">{fmt(taxReserve)}</span>
          <span className="text-xs text-[rgba(153,197,255,0.4)]">saved of {fmt(Math.max(taxEst, isLtd ? 3000 : 5118))} needed</span>
        </div>
        <GAlert type="gold">
          {isLtd
            ? <>Set aside <strong>19–25% of company profit</strong> every quarter. CT is due 9 months after your year end — don't let it creep up.</>
            : <>Set aside <strong>25% of every invoice</strong> from day one. Every £100 banked now is one less surprise in January.</>
          }
        </GAlert>
      </GCard>

      {/* Income by type */}
      <GCard className="overflow-hidden">
        <div className="px-4 py-3 border-b border-[rgba(153,197,255,0.08)]">
          <SL>Income by type — YTD</SL>
        </div>
        {(isDemo ? [
          { label: "Residential",  pct: 52, color: "bg-emerald-500", val: "£21,747" },
          { label: "Commercial",   pct: 36, color: "bg-[#1f48ff]",   val: "£15,055" },
          { label: "Exterior",     pct: 12, color: "bg-amber-500",   val: "£5,018"  },
        ] : [
          { label: "Residential",  pct: 0, color: "bg-emerald-500", val: fmt(0) },
          { label: "Commercial",   pct: 0, color: "bg-[#1f48ff]",   val: fmt(0) },
          { label: "Exterior",     pct: 0, color: "bg-amber-500",   val: fmt(0) },
        ]).map(({ label, pct, color, val }) => (
          <div key={label} className="px-4 py-2.5 flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full shrink-0 ${color}`} />
            <div className="flex-1">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-[rgba(153,197,255,0.6)]">{label}</span>
                <span className="font-black text-white tabular-nums">{val}</span>
              </div>
              <div className="h-1 rounded-full bg-[rgba(153,197,255,0.08)] overflow-hidden">
                <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          </div>
        ))}
      </GCard>

      {/* Insights */}
      <SectionDivider label="Smart tax insights" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {INSIGHTS.map(({ emoji, title, body, action }) => (
          <GCard key={title} className="p-4 cursor-pointer hover:border-[rgba(153,197,255,0.25)] transition-colors"
            onClick={action ? () => setActiveTab(action) : undefined}>
            <span className="text-xl mb-2 block">{emoji}</span>
            <p className="text-xs font-black text-white mb-1">{title}</p>
            <p className="text-[11px] text-[rgba(153,197,255,0.45)] leading-relaxed">{body}</p>
            {action && <p className="text-[10px] font-black text-[#99c5ff] mt-2">Open →</p>}
          </GCard>
        ))}
      </div>
    </div>
  );
}

// ─── NINO entry form ─────────────────────────────────────────────────────────
function NinoForm({ onSave, saving }) {
  const [val, setVal] = useState("");
  const [err, setErr] = useState("");
  const clean = (v) => v.toUpperCase().replace(/\s/g, "");
  const valid = (v) => {
    // Format: first letter (no D F I Q U V), second letter (no D F I O Q U V), 6 digits, suffix A-D
    if (!/^[A-CEGHJ-PR-TW-Z][A-CEGHJ-NPR-TW-Z]\d{6}[A-D]$/.test(v)) return false;
    // Reserved prefixes that HMRC will reject
    const prefix = v.slice(0, 2);
    if (["BG","GB","KN","NK","NT","TN","ZZ"].includes(prefix)) return false;
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const nino = clean(val);
    if (!valid(nino)) { setErr("Invalid format — expected e.g. QQ123456C"); return; }
    setErr("");
    try { await onSave(nino); } catch (ex) { setErr(ex.message); }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-3 flex gap-2 items-end">
      <div className="flex-1">
        <GInput
          label="National Insurance Number"
          placeholder="QQ 12 34 56 C"
          value={val}
          maxLength={9}
          onChange={e => { setVal(e.target.value); setErr(""); }}
        />
        {err && <p className="text-red-400 text-[10px] mt-1">{err}</p>}
      </div>
      <button
        type="submit"
        disabled={saving}
        className="px-4 py-2.5 rounded-xl bg-[#1f48ff] text-white text-xs font-black hover:bg-[#3a5eff] transition-colors disabled:opacity-50">
        {saving ? "Saving…" : "Save"}
      </button>
    </form>
  );
}

// ─── Submit quarter confirmation modal ────────────────────────────────────────
function SubmitModal({ quarter, onConfirm, onCancel, loading }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <GCard className="p-5 max-w-sm w-full">
        <SL className="mb-1">Confirm MTD submission</SL>
        <p className="text-sm font-black text-white mb-2">Submit {quarter.label} to HMRC?</p>
        <p className="text-[11px] text-[rgba(153,197,255,0.45)] mb-4 leading-relaxed">
          You're submitting <strong className="text-white">{fmt(quarter.income)}</strong> income and{" "}
          <strong className="text-white">{fmt(quarter.expenses)}</strong> expenses for{" "}
          {quarter.start} to {quarter.end}. This is sent directly to HMRC via the MTD API.
        </p>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-[rgba(153,197,255,0.06)] border border-[rgba(153,197,255,0.12)] text-xs font-black text-white hover:border-[rgba(153,197,255,0.3)] transition-colors">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-[#1f48ff] text-white text-xs font-black hover:bg-[#3a5eff] transition-colors disabled:opacity-50">
            {loading ? "Submitting…" : "Submit to HMRC →"}
          </button>
        </div>
      </GCard>
    </div>
  );
}

// ─── HMRC calculation result display ─────────────────────────────────────────
function CalcResult({ calc }) {
  const tax = calc?.calculation?.taxCalculation;
  if (!tax) {
    return (
      <p className="text-xs text-[rgba(153,197,255,0.4)]">
        Calculation received — HMRC is processing. Check back shortly.
      </p>
    );
  }
  const itDue    = tax.incomeTax?.incomeTaxDue ?? tax.incomeTaxAndNicsCharged ?? 0;
  const nicDue   = tax.nics?.class4Nics?.class4NicsDue ?? 0;
  const total    = tax.totalIncomeTaxAndNicsDue ?? (itDue + nicDue);
  return (
    <div className="space-y-2">
      {[
        ["Income tax due",       fmt(itDue),  "text-amber-400"],
        ["Class 4 NIC due",      fmt(nicDue), "text-amber-400"],
        ["Total estimated bill", fmt(total),  "text-white"],
      ].map(([label, val, cls]) => (
        <div key={label} className="flex justify-between text-xs">
          <span className="text-[rgba(153,197,255,0.5)]">{label}</span>
          <span className={`font-black tabular-nums ${cls}`}>{val}</span>
        </div>
      ))}
      <p className="text-[10px] text-[rgba(153,197,255,0.3)] pt-1">
        In-year estimate from HMRC — final bill set after Final Declaration.
      </p>
    </div>
  );
}

// ─── TAB: HMRC Connect ────────────────────────────────────────────────────────
function HmrcTab({ entityType = 'sole_trader' }) {
  const { invoices } = useInvoices();
  const { user }     = useAuth();
  const isDemo       = user?.id === 'demo-user';
  const isLive       = Boolean(user) && !isDemo;

  // Real HMRC hook — no-ops when user isn't logged in or HMRC not connected
  const {
    connected,
    connecting,
    loading:          hmrcLoading,
    nino,
    obligations,
    lastCalculation,
    bsasData,
    error:            hmrcError,
    reconnectRequired,
    connectHmrc,
    disconnectHmrc,
    saveNino,
    submitAndCalculate,
    fetchObligations,
    triggerBsas,
    getBsas,
    submitFinalDeclaration,
  } = useHmrc();

  const [expandedQ,    setExpandedQ]    = useState("Q1");
  const [submitModal,  setSubmitModal]  = useState(null);  // quarter object | null
  const [submitBusy,   setSubmitBusy]   = useState(false);
  const [submitResult, setSubmitResult] = useState(null);  // { success, message }

  // End-of-year flow state
  const [bsasCalcId,   setBsasCalcId]   = useState(null);  // calculationId from triggerBsas
  const [eoyBusy,      setEoyBusy]      = useState(false);
  const [eoyResult,    setEoyResult]    = useState(null);   // { success, message }
  const [declared,     setDeclared]     = useState(false);  // final declaration done

  const TAX_YEAR = currentTaxYear();
  const ytdExpData = useYtdExpenses(TAX_YEAR);

  // Real quarterly income from InvoiceContext + expenses from bank + manual entries
  const qData = useMemo(() => {
    return TAX_QUARTERS.map(q => {
      const { start, end } = getQuarterBounds(TAX_YEAR, q);
      const income = getQuarterIncome(invoices, start, end);
      const demoExp = { Q1: 557, Q2: 980, Q3: 1040, Q4: 960 };
      const expenses = isDemo
        ? (demoExp[q.id] ?? 0)
        : (ytdExpData.byQuarter?.[q.id] ?? 0);

      // Group expenses by HMRC SA103 field for this quarter (real users only)
      const byHmrcField = {};
      if (!isDemo && Array.isArray(ytdExpData.rows)) {
        for (const r of ytdExpData.rows) {
          if (r.date < start || r.date > end) continue;
          const field = (CATEGORY_TO_SA103[r.category] || CATEGORY_TO_SA103.other).hmrcField;
          byHmrcField[field] = (byHmrcField[field] || 0) + r.amount;
        }
      } else if (isDemo) {
        byHmrcField.other = expenses;
      }

      const net = income - expenses;
      const tax = Math.max(0, (net - (12570 / 4)) * 0.20);
      return { ...q, start, end, income, expenses, net, tax, byHmrcField };
    });
  }, [invoices, isDemo, ytdExpData.byQuarter, ytdExpData.rows]);

  // MTD ITSA SA103 expense field mapping
  const SA103_FIELDS = [
    { field: "turnover",             box: "Box 15", label: "Turnover (gross receipts)"  },
    { field: "costOfGoods",          box: "Box 16", label: "Cost of goods / materials"  },
    { field: "travelCosts",          box: "Box 17", label: "Motor & travel costs"        },
    { field: "premisesRunningCosts", box: "Box 20", label: "Premises running costs"      },
    { field: "adminCosts",           box: "Box 21", label: "Phone, software & admin"     },
    { field: "advertisingCosts",     box: "Box 22", label: "Advertising & marketing"     },
    { field: "interest",             box: "Box 23", label: "Finance charges & interest"  },
    { field: "professionalFees",     box: "Box 24", label: "Legal & professional fees"   },
    { field: "other",                box: "Box 27", label: "Other allowable expenses"    },
  ];

  // Map HMRC obligation periods to quarter IDs by matching periodStartDate
  const obligationMap = useMemo(() => {
    const map = {};
    for (const ob of obligations) {
      const match = qData.find(q => q.start === ob.periodStartDate);
      if (match) map[match.id] = ob.status === 'Fulfilled' ? 'fulfilled' : 'open';
    }
    return map;
  }, [obligations, qData]);

  // Quarter status: from HMRC if loaded, else infer (Q1 = current, rest = future)
  const getQStatus = (qId) => {
    if (obligations.length > 0) return obligationMap[qId] ?? 'future';
    return qId === 'Q1' ? 'active' : 'future';
  };

  if (entityType === 'limited_company') {
    return (
      <div className="space-y-5">
        <div>
          <SL className="mb-0.5">Making Tax Digital · Corporation Tax</SL>
          <h2 className="text-2xl font-black text-white">HMRC Connect</h2>
        </div>
        <GCard className="p-5 space-y-4">
          <div className="flex items-start gap-4">
            <div className="text-3xl">🏢</div>
            <div>
              <p className="text-sm font-black text-white mb-1">MTD for Corporation Tax — not yet mandated</p>
              <p className="text-[11px] text-[rgba(153,197,255,0.55)] leading-relaxed">
                Making Tax Digital for Corporation Tax is confirmed by HMRC but has not yet been mandated.
                Your CT600 continues to be filed via HMRC Online Services or through your accountant.
              </p>
            </div>
          </div>
          <div className="space-y-2 pt-2 border-t border-[rgba(153,197,255,0.08)]">
            {[
              { icon: "📅", title: "CT600 deadline",          body: "File within 12 months of your accounting period end date." },
              { icon: "💷", title: "Corporation tax payment",  body: "Pay within 9 months and 1 day of your accounting period end." },
              { icon: "🏢", title: "Companies House accounts", body: "File annual accounts within 9 months of your period end." },
            ].map(({ icon, title, body }) => (
              <div key={title} className="flex gap-3 p-3 rounded-xl bg-[rgba(153,197,255,0.04)] border border-[rgba(153,197,255,0.06)]">
                <span className="text-base shrink-0">{icon}</span>
                <div>
                  <p className="text-xs font-black text-white">{title}</p>
                  <p className="text-[11px] text-[rgba(153,197,255,0.45)]">{body}</p>
                </div>
              </div>
            ))}
          </div>
          <GAlert type="blue">
            Cadi will support MTD for Corporation Tax when it becomes available. Until then, use the <strong>Year End</strong> tab to track your CT filing deadlines.
          </GAlert>
        </GCard>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <SL className="mb-0.5">Making Tax Digital · ITSA</SL>
        <h2 className="text-2xl font-black text-white">HMRC Connect</h2>
        <p className="text-xs text-[rgba(153,197,255,0.45)] mt-0.5">Quarterly submissions · SA103 mapping · Tax year 2026/27</p>
      </div>

      {/* Reconnect required banner */}
      {reconnectRequired && !connected && (
        <div className="px-4 py-3 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-start gap-3">
          <span className="text-amber-400 text-base mt-0.5">⚠</span>
          <div>
            <p className="text-sm font-bold text-amber-300">HMRC reconnection required</p>
            <p className="text-[11px] text-amber-300/70 mt-0.5">Your HMRC authorisation has expired. Click "Connect to HMRC" below to relink your account — your data is safe and no submissions will be lost.</p>
          </div>
        </div>
      )}

      {/* Connection card */}
      <GCard className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              {hmrcLoading
                ? <div className="w-2 h-2 rounded-full bg-[rgba(153,197,255,0.3)] animate-pulse" />
                : <div className={`w-2 h-2 rounded-full ${connected ? "bg-emerald-400 animate-pulse" : "bg-[rgba(153,197,255,0.3)]"}`} />
              }
              <SL>
                {hmrcLoading ? "Checking status…" : connected ? "Connected to HMRC" : "Not connected"}
              </SL>
            </div>
            <p className="text-sm font-black text-white mb-1">
              {connected ? "Cadi is linked to your HMRC account" : "Connect Cadi to HMRC"}
            </p>
            <p className="text-[11px] text-[rgba(153,197,255,0.45)] leading-relaxed max-w-sm">
              {connected
                ? `Quarterly updates submit directly to HMRC. ${nino ? `NINO: ${nino}` : "Add your NINO below to start."}`
                : "One-time OAuth2 authorisation. Cadi reads your obligations and submits quarterly income/expense summaries on your behalf — no HMRC login every quarter."}
            </p>
            {hmrcError && (
              <p className="text-red-400 text-[10px] mt-1.5">{hmrcError}</p>
            )}
            {/* NINO prompt when connected but no NINO saved */}
            {isLive && connected && !nino && (
              <NinoForm onSave={saveNino} saving={connecting} />
            )}
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            {!isLive && <GChip color="amber">Demo mode</GChip>}
            {isLive && !connected && (
              <button
                onClick={connectHmrc}
                disabled={connecting || hmrcLoading}
                className="px-4 py-2 rounded-xl bg-[#1f48ff] text-white text-xs font-black hover:bg-[#3a5eff] transition-colors whitespace-nowrap disabled:opacity-50">
                {connecting ? "Redirecting…" : "Connect to HMRC →"}
              </button>
            )}
            {isLive && connected && (
              <button
                onClick={disconnectHmrc}
                disabled={connecting}
                className="px-3 py-1.5 rounded-xl bg-[rgba(153,197,255,0.06)] border border-[rgba(153,197,255,0.12)] text-[10px] font-black text-[rgba(153,197,255,0.5)] hover:border-red-500/30 hover:text-red-400 transition-colors whitespace-nowrap disabled:opacity-50">
                {connecting ? "Disconnecting…" : "Disconnect"}
              </button>
            )}
            {!isLive && (
              <button
                disabled
                className="px-4 py-2 rounded-xl bg-[rgba(153,197,255,0.06)] border border-[rgba(153,197,255,0.12)] text-xs font-black text-[rgba(153,197,255,0.4)] whitespace-nowrap cursor-not-allowed">
                Connect to HMRC →
              </button>
            )}
          </div>
        </div>

        {/* Live: refresh obligations button */}
        {isLive && connected && nino && (
          <div className="mt-3 pt-3 border-t border-[rgba(153,197,255,0.08)] flex items-center justify-between">
            <p className="text-[10px] text-[rgba(153,197,255,0.4)]">
              {obligations.length > 0 ? `${obligations.length} obligation periods loaded` : "No obligations loaded yet"}
            </p>
            <button
              onClick={() => fetchObligations()}
              disabled={connecting}
              className="text-[10px] text-[#99c5ff] hover:text-white transition-colors font-black disabled:opacity-40">
              {connecting ? "Loading…" : "↻ Refresh obligations"}
            </button>
          </div>
        )}

        {/* What it does */}
        <div className="mt-4 pt-4 border-t border-[rgba(153,197,255,0.08)] grid grid-cols-3 gap-3">
          {[
            { icon: "📥", label: "Reads your obligations", desc: "Which quarters are due and when" },
            { icon: "📤", label: "Submits quarterly updates", desc: "Income + expense summaries to HMRC" },
            { icon: "🧮", label: "Pulls tax calculation", desc: "HMRC's estimated tax liability back" },
          ].map(({ icon, label, desc }) => (
            <div key={label} className="text-center">
              <div className="text-xl mb-1">{icon}</div>
              <p className="text-[10px] font-black text-white mb-0.5">{label}</p>
              <p className="text-[10px] text-[rgba(153,197,255,0.35)]">{desc}</p>
            </div>
          ))}
        </div>
      </GCard>

      {/* Submission result toast */}
      {submitResult && (
        <GAlert type={submitResult.success ? "green" : "red"}>
          {submitResult.message}
          <button onClick={() => setSubmitResult(null)} className="ml-2 opacity-50 hover:opacity-100">×</button>
        </GAlert>
      )}

      {/* HMRC tax calculation result */}
      {lastCalculation && (
        <GCard className="p-4">
          <div className="flex items-center justify-between mb-3">
            <SL>HMRC in-year tax estimate</SL>
            <GChip color="green">✓ From HMRC</GChip>
          </div>
          <CalcResult calc={lastCalculation} />
        </GCard>
      )}

      {/* MTD Mandation info */}
      <GAlert type="blue">
        <strong>Your MTD ITSA mandation date:</strong> April 2027 (income above £30,000 threshold).
        Early voluntary filing from April 2026. Soft landing in year one — no late submission penalties on Q1–Q4.
        Final Declaration replaces your Self Assessment return.
      </GAlert>

      {/* Quarterly obligations timeline */}
      <SectionDivider label="2026/27 quarterly obligations" right={<GChip color="ghost">Tax year 6 Apr 2026 – 5 Apr 2027</GChip>} />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {qData.map(q => {
          const status      = getQStatus(q.id);
          const isActive    = status === "active" || status === "open";
          const isFulfilled = status === "fulfilled";
          return (
            <button
              key={q.id}
              onClick={() => setExpandedQ(expandedQ === q.id ? null : q.id)}
              className={`rounded-xl border p-3 text-left transition-all ${
                expandedQ === q.id
                  ? "bg-[#1f48ff]/15 border-[#1f48ff]/40"
                  : isFulfilled
                  ? "bg-emerald-500/05 border-emerald-500/20 hover:border-emerald-500/35"
                  : isActive
                  ? "bg-[rgba(153,197,255,0.06)] border-[rgba(153,197,255,0.2)] hover:border-[rgba(153,197,255,0.35)]"
                  : "bg-[rgba(153,197,255,0.02)] border-[rgba(153,197,255,0.08)] hover:border-[rgba(153,197,255,0.2)]"
              }`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-black text-white">{q.label}</span>
                <span className={`w-2 h-2 rounded-full ${
                  isFulfilled ? "bg-emerald-400" : isActive ? "bg-amber-400 animate-pulse" : "bg-[rgba(153,197,255,0.2)]"
                }`} />
              </div>
              <p className="text-[10px] text-[rgba(153,197,255,0.4)] mb-1">{q.start.slice(5).replace("-", " ")} – {q.end.slice(5).replace("-", " ")}</p>
              <p className="text-[10px] font-bold text-[rgba(153,197,255,0.55)]">Due {q.due} {Number(q.end.slice(0,4)) + (q.id === "Q4" ? 1 : 0)}</p>
              {isFulfilled
                ? <div className="mt-1.5"><GChip color="green">✓ Submitted</GChip></div>
                : q.income > 0
                ? <p className="text-xs font-black text-emerald-400 tabular-nums mt-1.5">{fmt(q.income)}</p>
                : <p className="text-[10px] text-[rgba(153,197,255,0.25)] mt-1.5">{isActive ? "In progress" : "Not yet"}</p>
              }
            </button>
          );
        })}
      </div>

      {/* Expanded quarter detail */}
      {expandedQ && (() => {
        const q = qData.find(x => x.id === expandedQ);
        if (!q) return null;
        const status      = getQStatus(q.id);
        const isActive    = status === "active" || status === "open";
        const isFulfilled = status === "fulfilled";
        return (
          <GCard className="overflow-hidden">
            <div className="px-4 py-3 border-b border-[rgba(153,197,255,0.08)] flex items-center justify-between">
              <div>
                <SL className="mb-0">{q.label} · {q.start} to {q.end}</SL>
                <p className="text-sm font-black text-white">Submission Preview — SA103 fields</p>
              </div>
              {isFulfilled
                ? <GChip color="green">✓ Submitted</GChip>
                : isActive
                ? <GChip color="amber">⏳ Due {q.due} 2026</GChip>
                : null
              }
            </div>

            {/* Income/expense summary */}
            <div className="px-4 py-3 grid grid-cols-3 gap-3 border-b border-[rgba(153,197,255,0.06)]">
              <div>
                <SL className="mb-1">Income</SL>
                <p className="text-lg font-black text-emerald-400 tabular-nums">{fmt(q.income)}</p>
                <p className="text-[10px] text-[rgba(153,197,255,0.35)]">
                  {q.income > 0 ? "From paid invoices" : isActive ? "In progress" : "Not yet"}
                </p>
              </div>
              <div>
                <SL className="mb-1">Expenses</SL>
                <p className="text-lg font-black text-red-400 tabular-nums">−{fmt(q.expenses)}</p>
                <p className="text-[10px] text-[rgba(153,197,255,0.35)]">{isActive ? "From money tab" : "Demo"}</p>
              </div>
              <div>
                <SL className="mb-1">Net profit</SL>
                <p className={`text-lg font-black tabular-nums ${q.net >= 0 ? "text-white" : "text-red-400"}`}>{fmt(q.net)}</p>
                <p className="text-[10px] text-[rgba(153,197,255,0.35)]">Est. tax: {fmt(q.tax)}</p>
              </div>
            </div>

            {/* SA103 field mapping */}
            <div className="px-4 py-3 border-b border-[rgba(153,197,255,0.06)]">
              <SL className="mb-3">MTD ITSA API fields → SA103 boxes</SL>
              <div className="space-y-1">
                {SA103_FIELDS.map(({ box, label, field }) => {
                  let val, cls;
                  if (field === "turnover") {
                    val = q.income > 0 ? fmt(q.income) : "—";
                    cls = q.income > 0 ? "text-emerald-400" : "text-[rgba(153,197,255,0.2)]";
                  } else {
                    const amt = q.byHmrcField?.[field] || 0;
                    if (amt > 0) {
                      val = `−${fmt(amt)}`;
                      cls = "text-red-400";
                    } else {
                      val = "—";
                      cls = "text-[rgba(153,197,255,0.2)]";
                    }
                  }
                  return (
                    <div key={box} className="flex items-center gap-3 text-xs">
                      <span className="w-14 font-black text-[rgba(153,197,255,0.35)] shrink-0 font-mono text-[10px]">{box}</span>
                      <span className="flex-1 text-[rgba(153,197,255,0.55)]">{label}</span>
                      <span className={`font-black tabular-nums ${cls}`}>{val}</span>
                    </div>
                  );
                })}
                <div className="flex items-center gap-3 text-xs pt-2 border-t border-[rgba(153,197,255,0.06)] mt-2">
                  <span className="w-14 shrink-0" />
                  <span className="flex-1 font-black text-white">Net profit</span>
                  <span className={`font-black tabular-nums ${q.net >= 0 ? "text-white" : "text-red-400"}`}>{fmt(q.net)}</span>
                </div>
              </div>
            </div>

            <div className="px-4 py-3 flex gap-2">
              <button
                className="flex-1 py-2.5 rounded-xl bg-[rgba(153,197,255,0.06)] border border-[rgba(153,197,255,0.12)] text-xs font-black text-white hover:border-[rgba(153,197,255,0.3)] transition-colors"
                onClick={() => setExpandedQ(null)}>
                Close
              </button>
              {isLive && connected && nino ? (
                <button
                  onClick={() => setSubmitModal(q)}
                  disabled={connecting || submitBusy}
                  className="flex-1 py-2.5 rounded-xl bg-[#1f48ff] text-white text-xs font-black hover:bg-[#3a5eff] transition-colors disabled:opacity-50">
                  Submit to HMRC →
                </button>
              ) : (
                <button
                  disabled
                  title={!isLive ? "Log in to submit" : !connected ? "Connect HMRC first" : "Add your NINO first"}
                  className="flex-1 py-2.5 rounded-xl bg-[rgba(153,197,255,0.04)] border border-[rgba(153,197,255,0.08)] text-xs font-black text-[rgba(153,197,255,0.25)] cursor-not-allowed">
                  Submit to HMRC →
                </button>
              )}
            </div>
          </GCard>
        );
      })()}

      {/* Confirmation modal */}
      {submitModal && (
        <SubmitModal
          quarter={submitModal}
          loading={submitBusy}
          onCancel={() => setSubmitModal(null)}
          onConfirm={async () => {
            setSubmitBusy(true);
            try {
              // Build expenses payload from per-category SA103 mapping
              // (falls back to { other } only when no breakdown is available, e.g. demo)
              const expensesPayload = submitModal.byHmrcField && Object.keys(submitModal.byHmrcField).length > 0
                ? Object.fromEntries(
                    Object.entries(submitModal.byHmrcField).map(([k, v]) => [k, Math.round(v * 100) / 100])
                  )
                : { other: submitModal.expenses };
              await submitAndCalculate({
                periodStart: submitModal.start,
                periodEnd:   submitModal.end,
                income:      { turnover: submitModal.income },
                expenses:    expensesPayload,
                taxYear:     "2026-27",
              });
              setSubmitResult({ success: true, message: `${submitModal.label} submitted to HMRC successfully.` });
            } catch (ex) {
              setSubmitResult({ success: false, message: `Submission failed: ${ex.message}` });
            } finally {
              setSubmitBusy(false);
              setSubmitModal(null);
            }
          }}
        />
      )}

      {/* ── End of Year · BSAS + Final Declaration ─────────────────────────── */}
      <SectionDivider label="End of year · 2026/27" right={<GChip color="ghost">Due 31 Jan 2028</GChip>} />

      {/* EOY result toast */}
      {eoyResult && (
        <GAlert type={eoyResult.success ? "green" : "red"}>
          {eoyResult.message}
          <button onClick={() => setEoyResult(null)} className="ml-2 opacity-50 hover:opacity-100">×</button>
        </GAlert>
      )}

      {/* Step 1 — BSAS */}
      <GCard className="p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <SL className="mb-1">Step 1 · Business Source Adjustable Summary</SL>
            <p className="text-sm font-black text-white">Trigger your year-end BSAS</p>
            <p className="text-[11px] text-[rgba(153,197,255,0.45)] mt-1 leading-relaxed max-w-sm">
              After all 4 quarters are submitted, HMRC produces a cumulative summary of your income and expenses.
              Review it before the Final Declaration — this is where you can claim capital allowances and AIA.
            </p>
          </div>
          {bsasCalcId
            ? <GChip color="green">✓ Triggered</GChip>
            : <GChip color="ghost">Pending</GChip>
          }
        </div>

        {/* BSAS data summary when loaded */}
        {bsasData && (
          <div className="mb-3 p-3 rounded-xl bg-[rgba(153,197,255,0.04)] border border-[rgba(153,197,255,0.1)] space-y-1">
            <SL className="mb-2">BSAS summary · from HMRC</SL>
            {[
              { label: "Total income",   val: bsasData?.inputs?.incomeSourceData?.turnover },
              { label: "Total expenses", val: bsasData?.inputs?.expensesData?.totalExpenses },
              { label: "Net profit",     val: bsasData?.inputs?.netProfit },
            ].map(({ label, val }) => val != null && (
              <div key={label} className="flex justify-between text-xs">
                <span className="text-[rgba(153,197,255,0.55)]">{label}</span>
                <span className="font-black text-white tabular-nums">{fmt(val)}</span>
              </div>
            ))}
            <p className="text-[10px] text-[rgba(153,197,255,0.3)] pt-1">Calculation ID: {bsasCalcId}</p>
          </div>
        )}

        <div className="flex gap-2">
          {isLive && connected && nino ? (
            <>
              <button
                onClick={async () => {
                  setEoyBusy(true);
                  setEoyResult(null);
                  try {
                    const res = await triggerBsas({
                      periodStart: `${TAX_YEAR}-04-06`,
                      periodEnd:   `${TAX_YEAR + 1}-04-05`,
                    });
                    const calcId = res?.calculationId;
                    setBsasCalcId(calcId);
                    setEoyResult({ success: true, message: "BSAS triggered successfully." });
                    if (calcId) {
                      try { await getBsas("2026-27", calcId); } catch (_) { /* detail fetch is best-effort */ }
                    }
                  } catch (ex) {
                    setEoyResult({ success: false, message: `BSAS failed: ${ex.message}` });
                  } finally {
                    setEoyBusy(false);
                  }
                }}
                disabled={eoyBusy || connecting}
                className="flex-1 py-2.5 rounded-xl bg-[#1f48ff] text-white text-xs font-black hover:bg-[#3a5eff] transition-colors disabled:opacity-50">
                {eoyBusy ? "Triggering…" : bsasCalcId ? "↻ Re-trigger BSAS" : "Trigger BSAS →"}
              </button>
              {bsasCalcId && (
                <button
                  onClick={async () => {
                    setEoyBusy(true);
                    try {
                      await getBsas("2026-27", bsasCalcId);
                    } catch (ex) {
                      setEoyResult({ success: false, message: `Get BSAS failed: ${ex.message}` });
                    } finally {
                      setEoyBusy(false);
                    }
                  }}
                  disabled={eoyBusy}
                  className="px-4 py-2.5 rounded-xl bg-[rgba(153,197,255,0.06)] border border-[rgba(153,197,255,0.12)] text-xs font-black text-white hover:border-[rgba(153,197,255,0.3)] transition-colors disabled:opacity-50">
                  View
                </button>
              )}
            </>
          ) : (
            <button disabled className="flex-1 py-2.5 rounded-xl bg-[rgba(153,197,255,0.04)] border border-[rgba(153,197,255,0.08)] text-xs font-black text-[rgba(153,197,255,0.25)] cursor-not-allowed">
              Trigger BSAS →
            </button>
          )}
        </div>
      </GCard>

      {/* Step 2 — Final Declaration */}
      <GCard className="p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <SL className="mb-1">Step 2 · Final declaration · replaces self assessment</SL>
            <p className="text-sm font-black text-white">Due 31 January 2028</p>
            <p className="text-[11px] text-[rgba(153,197,255,0.45)] mt-1 leading-relaxed max-w-sm">
              Once you're happy with the BSAS figures, Cadi triggers an intent-to-finalise calculation
              then submits the Final Declaration — completing your tax year with HMRC.
            </p>
          </div>
          {declared
            ? <GChip color="green">✓ Declared</GChip>
            : <GChip color="ghost">Pending</GChip>
          }
        </div>

        {isLive && connected && nino ? (
          <button
            onClick={async () => {
              setEoyBusy(true);
              setEoyResult(null);
              try {
                await submitFinalDeclaration("2026-27");
                setDeclared(true);
                setEoyResult({ success: true, message: "Final Declaration submitted to HMRC. Tax year 2026/27 complete." });
              } catch (ex) {
                setEoyResult({ success: false, message: `Final Declaration failed: ${ex.message}` });
              } finally {
                setEoyBusy(false);
              }
            }}
            disabled={eoyBusy || connecting || declared}
            className="w-full py-2.5 rounded-xl bg-[#1f48ff] text-white text-xs font-black hover:bg-[#3a5eff] transition-colors disabled:opacity-50">
            {eoyBusy ? "Submitting…" : declared ? "✓ Declared" : "Submit Final Declaration →"}
          </button>
        ) : (
          <button disabled className="w-full py-2.5 rounded-xl bg-[rgba(153,197,255,0.04)] border border-[rgba(153,197,255,0.08)] text-xs font-black text-[rgba(153,197,255,0.25)] cursor-not-allowed">
            Submit Final Declaration →
          </button>
        )}
      </GCard>

      {/* Prior year */}
      <SectionDivider label="2025/26 · Completed year" />
      <GCard className="p-4 text-center">
        <p className="text-xs text-[rgba(153,197,255,0.4)]">
          Prior year HMRC submissions will appear here once loaded.
          Connect HMRC and use the obligations API with a prior-year date range to populate this view.
        </p>
      </GCard>
    </div>
  );
}

// ─── TAB: Invoice Records ─────────────────────────────────────────────────────
function IncomeTab() {
  const { invoices } = useInvoices();
  const { user }     = useAuth();
  const isDemo       = user?.id === 'demo-user';
  const [taxYear, setTaxYear] = useState(taxYearLabel());

  const TAX_YEARS   = recentTaxYears(3);
  const TODAY       = today();
  const yearStart   = (y) => `${y.split("/")[0]}-04-06`;
  const yearEnd     = (y) => `20${y.split("/")[1]}-04-05`;

  // Hand paid invoices into the YTD income hook so it can dedupe matched bank credits
  const paidInvoiceRows = useMemo(() =>
    invoices
      .filter(i => i.status === 'paid' && i.paidAt)
      .map(i => ({ id: i.id, customer: i.customer, num: i.num, paidAt: i.paidAt, _total: invTotal(i) })),
    [invoices]
  );
  const yearNum    = parseTaxYearLabel(taxYear) ?? currentTaxYear();
  const ytdIncome  = useYtdIncome(yearNum, paidInvoiceRows);

  const yearInvs = invoices.filter(inv => {
    const d = inv.date ?? "";
    return d >= yearStart(taxYear) && d <= yearEnd(taxYear);
  });

  const totalInvoiced    = yearInvs.reduce((s, i) => s + invTotal(i), 0);
  const totalReceived    = yearInvs.filter(i => i.status === "paid").reduce((s, i) => s + invTotal(i), 0);
  const totalOutstanding = totalInvoiced - totalReceived;
  const totalOverdue     = yearInvs.filter(i => i.status === "overdue").reduce((s, i) => s + invTotal(i), 0);

  const daysLate = (inv) =>
    Math.max(0, Math.round((new Date(TODAY) - new Date(inv.dueDate)) / 86400000));

  const unpaid      = yearInvs.filter(i => i.status !== "paid" && i.status !== "draft");
  const agedCurrent = unpaid.filter(i => daysLate(i) === 0);
  const aged30      = unpaid.filter(i => { const d = daysLate(i); return d > 0 && d <= 30; });
  const aged60      = unpaid.filter(i => { const d = daysLate(i); return d > 30 && d <= 60; });
  const aged90      = unpaid.filter(i => daysLate(i) > 60);
  const agedSum     = (arr) => arr.reduce((s, i) => s + invTotal(i), 0);

  const sorted  = [...yearInvs].sort((a, b) => new Date(b.date) - new Date(a.date));
  const byMonth = sorted.reduce((acc, inv) => {
    const m = new Date(inv.date).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
    if (!acc[m]) acc[m] = [];
    acc[m].push(inv);
    return acc;
  }, {});

  const invStatusMeta = (inv) => {
    const days = daysLate(inv);
    if (inv.status === "paid")    return { label: "Paid",    cls: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" };
    if (inv.status === "overdue" || (inv.status !== "draft" && days > 0))
                                  return { label: `${days}d overdue`, cls: "bg-red-500/10 border-red-500/20 text-red-400" };
    if (inv.status === "sent")    return { label: inv.viewedAt ? "Viewed" : "Sent", cls: "bg-[#1f48ff]/10 border-[#1f48ff]/20 text-[#99c5ff]" };
    return                               { label: "Draft",   cls: "bg-[rgba(153,197,255,0.06)] border-[rgba(153,197,255,0.12)] text-[rgba(153,197,255,0.4)]" };
  };

  const TYPE_STRIPE = { residential: "bg-emerald-500", commercial: "bg-[#1f48ff]", exterior: "bg-amber-500" };

  // Group income rows by month for display
  const incomeByMonth = useMemo(() => {
    const grouped = {};
    for (const row of ytdIncome.rows) {
      const m = new Date(row.date).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
      if (!grouped[m]) grouped[m] = [];
      grouped[m].push(row);
    }
    return grouped;
  }, [ytdIncome.rows]);

  const liveYtdIncome = isDemo ? totalReceived : ytdIncome.ytdTotal;
  const sourceTotals  = ytdIncome.bySource ?? {};
  const sourceList    = Object.entries(sourceTotals)
    .sort((a, b) => b[1] - a[1])
    .map(([key, total]) => ({ key, total, ...SOURCE_DISPLAY[key] }));

  return (
    <div className="space-y-5">
      <div>
        <SL className="mb-0.5">All money landing in your business · Tax year</SL>
        <h2 className="text-2xl font-black text-white">Income</h2>
        <p className="text-[11px] text-[rgba(153,197,255,0.45)] mt-0.5">
          Invoices · GoCardless · Stripe · Bank deposits · Cash — all in one place
        </p>
      </div>

      {/* Tax year selector */}
      <div className="flex items-center gap-2">
        <div className="flex gap-1 p-1 rounded-xl bg-[rgba(0,0,0,0.2)]">
          {TAX_YEARS.map(y => (
            <button key={y} onClick={() => setTaxYear(y)}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                taxYear === y ? "bg-[#1f48ff] text-white" : "text-[rgba(153,197,255,0.55)] hover:text-white"
              }`}>
              {y}
            </button>
          ))}
        </div>
        <span className="text-[10px] text-[rgba(153,197,255,0.35)]">{ytdIncome.rows.length} entries</span>
      </div>

      {/* Top-line stats */}
      <div className="grid grid-cols-2 gap-3">
        <GStatCard label="YTD income"      value={fmt(liveYtdIncome)}    valueColor="text-emerald-400" sub={`${ytdIncome.rows.length} payments received`} />
        <GStatCard label="Outstanding"     value={fmt(totalOutstanding)} valueColor={totalOutstanding > 0 ? "text-amber-400" : "text-emerald-400"} sub={`${unpaid.length} invoices awaiting`} />
        <GStatCard label="Overdue"         value={fmt(totalOverdue)}     valueColor={totalOverdue > 0 ? "text-red-400" : "text-emerald-400"} sub={totalOverdue > 0 ? "Chase up" : "Clear ✓"} />
        <GStatCard label="Sources"         value={String(sourceList.length || 0)} sub={sourceList.slice(0, 2).map(s => s.label).join(' · ') || 'None yet'} />
      </div>

      {/* Income by source breakdown */}
      {sourceList.length > 0 && (
        <>
          <SectionDivider label="Where your income comes from" right={<GChip color="green">{fmt(liveYtdIncome)} YTD</GChip>} />
          <GCard className="overflow-hidden divide-y divide-[rgba(153,197,255,0.05)]">
            {sourceList.map(({ key, total, label, icon, color }) => {
              const pct = liveYtdIncome > 0 ? (total / liveYtdIncome) * 100 : 0;
              const count = ytdIncome.rows.filter(r => r.source === key).length;
              return (
                <div key={key} className="px-4 py-3">
                  <div className="flex items-center gap-3 mb-1.5">
                    <span className="text-base shrink-0">{icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black text-white">{label}</p>
                      <p className="text-[10px] text-[rgba(153,197,255,0.4)]">{count} payment{count !== 1 ? 's' : ''}</p>
                    </div>
                    <p className="text-sm font-black tabular-nums text-white shrink-0">{fmt(total)}</p>
                    <span className="text-[10px] font-black tabular-nums text-[rgba(153,197,255,0.5)] w-10 text-right shrink-0">{Math.round(pct)}%</span>
                  </div>
                  <div className="h-1 rounded-full bg-[rgba(153,197,255,0.06)] overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: color }} />
                  </div>
                </div>
              );
            })}
          </GCard>
        </>
      )}

      {/* Aged debtors */}
      {unpaid.length > 0 && (
        <>
          <SectionDivider label="Awaiting payment" right={<GChip color="amber">{fmt(agedSum(unpaid))} owed</GChip>} />
          <GCard className="overflow-hidden divide-y divide-[rgba(153,197,255,0.05)]">
            {[
              { label: "Current — not yet due",     arr: agedCurrent, dot: "bg-[rgba(153,197,255,0.3)]", val: "text-[rgba(153,197,255,0.6)]" },
              { label: "1–30 days overdue",          arr: aged30,      dot: "bg-amber-400",               val: "text-amber-400"               },
              { label: "31–60 days overdue",         arr: aged60,      dot: "bg-orange-500",              val: "text-orange-400"              },
              { label: "60+ days (write-off risk)",  arr: aged90,      dot: "bg-red-500",                 val: "text-red-400"                 },
            ].map(({ label, arr, dot, val }) => (
              <div key={label} className="flex items-center gap-3 px-4 py-3">
                <div className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-[rgba(153,197,255,0.6)]">{label}</p>
                  {arr.length > 0 && <p className="text-[10px] text-[rgba(153,197,255,0.3)] mt-0.5">{arr.map(i => invCustomerName(i)).join(", ")}</p>}
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-xs font-black tabular-nums ${arr.length > 0 ? val : "text-[rgba(153,197,255,0.2)]"}`}>
                    {arr.length > 0 ? fmt2(agedSum(arr)) : "—"}
                  </p>
                  {arr.length > 0 && <p className="text-[10px] text-[rgba(153,197,255,0.3)]">{arr.length} inv.</p>}
                </div>
              </div>
            ))}
          </GCard>
        </>
      )}

      {/* Income stream by month */}
      {Object.entries(incomeByMonth).map(([month, rows]) => (
        <div key={month}>
          <SectionDivider label={month} right={<GChip color="ghost">{fmt(rows.reduce((s,r)=>s+r.amount,0))}</GChip>} />
          <GCard className="overflow-hidden divide-y divide-[rgba(153,197,255,0.05)]">
            {rows.map(row => {
              const src = SOURCE_DISPLAY[row.source] || SOURCE_DISPLAY.bank;
              return (
                <div key={row.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[rgba(153,197,255,0.02)] transition-colors">
                  <div className="w-0.5 self-stretch rounded-full shrink-0" style={{ backgroundColor: src.color }} />
                  <span className="text-base shrink-0">{src.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black text-white truncate">{row.label}</p>
                    <p className="text-[10px] text-[rgba(153,197,255,0.35)]">
                      {new Date(row.date).toLocaleDateString("en-GB",{day:"numeric",month:"short"})}
                      {row.sublabel ? ` · ${row.sublabel}` : ''}
                      {' · '}{src.label}
                    </p>
                  </div>
                  {row.confirmed && (
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full border bg-emerald-500/10 border-emerald-500/20 text-emerald-400 shrink-0">
                      Bank ✓
                    </span>
                  )}
                  <p className="text-xs font-black tabular-nums text-emerald-400 shrink-0">+{fmt2(row.amount)}</p>
                </div>
              );
            })}
          </GCard>
        </div>
      ))}

      {ytdIncome.loading && ytdIncome.rows.length === 0 && (
        <GCard className="p-8 text-center">
          <p className="text-sm text-[rgba(153,197,255,0.5)]">Loading income…</p>
        </GCard>
      )}

      {!ytdIncome.loading && ytdIncome.rows.length === 0 && (
        <GCard className="p-10 text-center">
          <p className="text-2xl mb-2">💰</p>
          <p className="text-sm font-black text-white">No income recorded yet</p>
          <p className="text-[11px] text-[rgba(153,197,255,0.4)] mt-1 leading-relaxed">
            Send your first invoice, connect your bank in the Money tab,<br/>or log a cash payment manually.
          </p>
        </GCard>
      )}

      {liveYtdIncome > 0 && (
        <GAlert type="blue">
          <strong>SA103 Box 15:</strong> Total received <strong>{fmt(liveYtdIncome)}</strong> is your declared
          turnover for {taxYear}. Outstanding <strong>{fmt(totalOutstanding)}</strong> counts once paid.
        </GAlert>
      )}
    </div>
  );
}

// ─── TAB: Expenses ────────────────────────────────────────────────────────────
const CAT_DISPLAY = {
  fuel:                  { icon: '⛽', name: 'Fuel & Vehicle Costs' },
  vehicle:               { icon: '🚐', name: 'Vehicle (lease, servicing)' },
  supplies:              { icon: '🧴', name: 'Cleaning Supplies & Materials' },
  equipment:             { icon: '🔧', name: 'Equipment & Tools' },
  insurance:             { icon: '🛡️', name: 'Business Insurance' },
  premises:              { icon: '🏠', name: 'Premises (rent, utilities)' },
  phone_internet:        { icon: '📱', name: 'Phone & Internet' },
  marketing:             { icon: '📢', name: 'Marketing & Advertising' },
  bank_charges:          { icon: '🏦', name: 'Bank Charges & Interest' },
  professional:          { icon: '⚖️', name: 'Professional Fees' },
  professional_services: { icon: '⚖️', name: 'Professional Services' },
  staff:                 { icon: '👥', name: 'Staff & Subcontractors' },
  tax_payment:           { icon: '🏛️', name: 'Tax Payments' },
  other:                 { icon: '📦', name: 'Other Allowable' },
  uncategorised:         { icon: '❓', name: 'Uncategorised — review' },
};

function ExpensesTab() {
  const { user } = useAuth();
  const isDemo   = user?.id === 'demo-user';
  const ytdExpData = useYtdExpenses(currentTaxYear());

  // Demo rows (kept for demo mode only)
  const demoCategories = [
    { icon: "🚐", name: "Van & Vehicle Costs",            sub: "Fuel · Insurance · MOT · Repairs",     amount: 2890, box: "Box 17" },
    { icon: "🚗", name: "Mileage (45p/mile HMRC rate)",   sub: "4,820 miles logged",                    amount: 2169, box: "Box 17" },
    { icon: "🧴", name: "Cleaning Supplies & Materials",  sub: "Products · chemicals · consumables",    amount: 1640, box: "Box 16" },
    { icon: "🛡️", name: "Business Insurance",             sub: "Public liability · employer's",         amount: 1200, box: "Box 20" },
    { icon: "👕", name: "Uniform, PPE & Workwear",        sub: "Logo'd clothing · gloves · masks",      amount:  380, box: "Box 27" },
    { icon: "📱", name: "Phone & Software (business %)",  sub: "Mobile plan · Cadi subscription",       amount:  720, box: "Box 21" },
    { icon: "🏠", name: "Use of Home as Office",          sub: "HMRC flat rate £26/mo",                 amount:  312, box: "Box 20" },
    { icon: "📢", name: "Marketing & Advertising",        sub: "Leaflets · Google Ads · website",       amount:  540, box: "Box 22" },
    { icon: "🏦", name: "Bank Charges & Professional",    sub: "Business account · accountant",         amount:  358, box: "Box 24" },
    { icon: "🎓", name: "Training & Development",         sub: "NCCA · CSSA · trade bodies",            amount:  300, box: "Box 27" },
  ];

  const fmtNum = n => `£${Math.round(n).toLocaleString()}`;
  const fmtSave = n => `~£${Math.round(n * 0.4).toLocaleString()}`;

  // Build live category rows from useYtdExpenses
  const liveCategories = Object.entries(ytdExpData.byCategory)
    .map(([catKey, total]) => {
      const display = CAT_DISPLAY[catKey] || { icon: '📦', name: catKey };
      const sa103   = CATEGORY_TO_SA103[catKey] || CATEGORY_TO_SA103.other;
      const count   = ytdExpData.rows.filter(r => r.category === catKey).length;
      const bank    = ytdExpData.rows.filter(r => r.category === catKey && r.source === 'bank').length;
      return {
        icon:   display.icon,
        name:   display.name,
        sub:    `${count} transaction${count !== 1 ? 's' : ''}${bank > 0 ? ` · ${bank} from bank` : ''}`,
        amount: total,
        box:    sa103.box,
      };
    })
    .sort((a, b) => b.amount - a.amount);

  const ytdTotal  = isDemo ? 8340 : ytdExpData.ytdTotal;
  const taxSaved  = ytdTotal * 0.4;
  const showRows  = isDemo ? demoCategories : liveCategories;

  return (
    <div className="space-y-5">
      <div>
        <SL className="mb-0.5">HMRC-categorised · Live from Money tab</SL>
        <h2 className="text-2xl font-black text-white">Expense Tracker</h2>
        <p className="text-xs text-[rgba(153,197,255,0.45)] mt-0.5">Auto-mapped to SA103 boxes on your MTD return</p>
      </div>

      {ytdExpData.loading && !isDemo ? (
        <GCard className="p-8 text-center">
          <p className="text-sm text-[rgba(153,197,255,0.5)]">Loading expenses…</p>
        </GCard>
      ) : ytdTotal === 0 && !isDemo ? (
        <GAlert type="amber">
          <strong>No expenses logged yet.</strong> Connect your bank in the Money tab to auto-import business spending, or add expenses manually. They'll appear here mapped to the right HMRC boxes.
        </GAlert>
      ) : (
        <>
          <GAlert type="green">
            <strong>Total allowable expenses YTD: {fmtNum(ytdTotal)}</strong> · saving approx. <strong>{fmtSave(ytdTotal).replace('~', '')} in tax</strong>.
            Each row maps to the exact SA103 box HMRC uses.
          </GAlert>

          <GCard className="overflow-hidden divide-y divide-[rgba(153,197,255,0.05)]">
            {showRows.map(({ icon, name, sub, amount, box }) => (
              <div key={name} className="flex items-center gap-3 px-4 py-3 hover:bg-[rgba(153,197,255,0.02)] transition-colors">
                <div className="w-8 h-8 rounded-xl bg-[rgba(153,197,255,0.06)] flex items-center justify-center text-base shrink-0">{icon}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-black text-white">{name}</p>
                  <p className="text-[10px] text-[rgba(153,197,255,0.35)] mt-0.5 truncate">{sub}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-black tabular-nums text-red-400">−{fmtNum(amount)}</p>
                  <p className="text-[10px] text-emerald-400">saves {fmtSave(amount)}</p>
                </div>
                <span className="text-[10px] font-black font-mono text-[rgba(153,197,255,0.3)] w-12 text-right shrink-0">{box}</span>
              </div>
            ))}
          </GCard>
        </>
      )}

      {!isDemo && ytdTotal > 0 && (
        <GAlert type="amber">
          <strong>Tip:</strong> Anything uncategorised? Head to the Money tab and tap the transaction — Cadi will remember the rule for next time.
        </GAlert>
      )}
    </div>
  );
}

// ─── TAB: VAT Planner ─────────────────────────────────────────────────────────
function VATTab({ bizSettings = {}, saveSettings }) {
  const { invoices } = useInvoices();
  const { user }     = useAuth();
  const isDemo       = user?.id === 'demo-user';

  // ── Rolling 12-month taxable turnover (VAT uses rolling 12mo, not tax year) ──
  const VAT_THRESHOLD = 90000;
  const rolling12Turnover = useMemo(() => {
    const now   = new Date();
    const start = new Date(now);
    start.setFullYear(start.getFullYear() - 1);
    const startStr = start.toISOString().slice(0, 10);
    const todayStr = now.toISOString().slice(0, 10);
    return invoices
      .filter(i => i.status === 'paid' && (i.paidAt ?? '').slice(0, 10) >= startStr && (i.paidAt ?? '').slice(0, 10) <= todayStr)
      .reduce((s, i) => s + invTotal(i), 0);
  }, [invoices]);

  // Run-rate projection: annualise from months with data
  const monthlyRunRate = useMemo(() => {
    const counts = {};
    invoices.filter(i => i.status === 'paid' && i.paidAt).forEach(i => {
      const mo = i.paidAt.slice(0, 7);
      counts[mo] = (counts[mo] ?? 0) + invTotal(i);
    });
    const vals = Object.values(counts);
    if (!vals.length) return 0;
    return vals.reduce((s, v) => s + v, 0) / vals.length;
  }, [invoices]);

  const liveTotal   = isDemo ? 41820 : rolling12Turnover;
  const runRate     = isDemo ? 3485  : monthlyRunRate;
  const headroom    = Math.max(0, VAT_THRESHOLD - liveTotal);
  const monthsToThreshold = runRate > 0 ? Math.ceil(headroom / runRate) : null;
  const threshPct   = Math.min(100, Math.round((liveTotal / VAT_THRESHOLD) * 100));

  // Seed the quarterly simulator from live run-rate (user can override)
  const [turnover,     setTurnover]     = useState(0);
  const [businessType, setBusinessType] = useState("cleaning-domestic");
  const [goods,        setGoods]        = useState(480);
  const [otherInput,   setOtherInput]   = useState(360);
  const [firstYear,    setFirstYear]    = useState(false);

  // Once run-rate is known, seed the simulator (only on first load)
  useEffect(() => {
    if (runRate > 0 && turnover === 0) setTurnover(Math.round(runRate));
  }, [runRate]); // eslint-disable-line react-hooks/exhaustive-deps

  // VRN / scheme — seeded from DB, saved back on blur
  const [vrn,        setVrn]       = useState(bizSettings.vat_number ?? "");
  const [vatScheme,  setVatScheme] = useState(bizSettings.vat_scheme ?? "none");
  const [vrnSaving,  setVrnSaving] = useState(false);

  // Sync if bizSettings load after mount
  useEffect(() => {
    if (bizSettings.vat_number != null) setVrn(bizSettings.vat_number);
    if (bizSettings.vat_scheme != null) setVatScheme(bizSettings.vat_scheme);
  }, [bizSettings.vat_number, bizSettings.vat_scheme]);

  const [saveError, setSaveError] = useState(null);
  async function persistVatFields(patch) {
    if (!saveSettings) return;
    setVrnSaving(true);
    setSaveError(null);
    try {
      await saveSettings(patch);
    } catch (err) {
      setSaveError(err?.message || 'Could not save — please try again.');
    } finally {
      setVrnSaving(false);
    }
  }

  const r      = calculateVAT({ turnover, businessType, goods, otherInput, firstYear });
  const frsWins = r.saving > 0;
  const fmtV   = (n) => `£${Math.abs(Math.round(n)).toLocaleString()}`;

  return (
    <div className="space-y-5">
      <div>
        <SL className="mb-0.5">VAT planning & optimisation</SL>
        <h2 className="text-2xl font-black text-white">VAT Planner</h2>
        <p className="text-xs text-[rgba(153,197,255,0.45)] mt-0.5">Threshold tracker · Flat Rate Scheme comparison · FRS rate: 12%</p>
      </div>

      {/* VAT Registration details */}
      <GCard className="p-4 space-y-3">
        <SL>VAT registration</SL>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <GInput
              label="VAT Registration Number (VRN)"
              placeholder="GB 123 4567 89"
              value={vrn}
              onChange={e => setVrn(e.target.value)}
              onBlur={() => persistVatFields({ vat_number: vrn.trim() || null })}
            />
            <p className="text-[10px] text-[rgba(153,197,255,0.3)] mt-1">
              GB format — saved automatically when you click away{vrnSaving ? " · Saving…" : ""}
            </p>
          </div>
          <div>
            <GSelect
              label="VAT scheme"
              value={vatScheme}
              onChange={e => { setVatScheme(e.target.value); persistVatFields({ vat_scheme: e.target.value }); }}
            >
              <option value="none">Not VAT registered</option>
              <option value="standard">Standard rate</option>
              <option value="flat_rate">Flat Rate Scheme (FRS)</option>
              <option value="cash">Cash Accounting</option>
              <option value="annual">Annual Accounting</option>
            </GSelect>
          </div>
        </div>
        {saveError && (
          <GAlert type="red"><strong>Couldn't save:</strong> {saveError}</GAlert>
        )}
        {!saveError && vatScheme === 'none' && (
          <GAlert type="blue">VAT API support coming — when you register, Cadi will be able to prepare and submit your VAT returns directly to HMRC.</GAlert>
        )}
        {!saveError && vatScheme !== 'none' && (
          <GAlert type="green">VAT scheme saved. Direct VAT return submission to HMRC is coming soon — Cadi will connect via the <strong>read:vat write:vat</strong> MTD scope.</GAlert>
        )}
      </GCard>

      {/* Threshold */}
      <GCard className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <SL>VAT registration threshold (£90,000)</SL>
          <GChip color={threshPct >= 100 ? "red" : threshPct > 85 ? "amber" : "ghost"}>
            {threshPct >= 100 ? "⚠ Exceeded" : `${threshPct}% of threshold`}
          </GChip>
        </div>
        <div>
          <p className="text-2xl font-black text-white tabular-nums mb-2">
            {fmtV(liveTotal)}{" "}
            <span className="text-sm text-[rgba(153,197,255,0.4)] font-normal">rolling 12 months</span>
          </p>
          <div className="h-2 rounded-full bg-[rgba(153,197,255,0.08)] overflow-hidden mb-1">
            <div
              className={`h-full rounded-full transition-all ${threshPct >= 100 ? "bg-red-500" : threshPct > 85 ? "bg-amber-500" : "bg-[#1f48ff]"}`}
              style={{ width: `${Math.min(threshPct, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-[rgba(153,197,255,0.35)]">
            <span>{fmtV(headroom)} headroom remaining</span>
            <span>{fmtV(VAT_THRESHOLD)} threshold</span>
          </div>
        </div>
        {threshPct < 100 && monthsToThreshold !== null && (
          <div className="flex items-center gap-2 pt-1 border-t border-[rgba(153,197,255,0.06)]">
            <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${monthsToThreshold <= 3 ? "bg-red-400" : monthsToThreshold <= 6 ? "bg-amber-400" : "bg-emerald-400"}`} />
            <p className="text-[11px] text-[rgba(153,197,255,0.5)]">
              At your current run rate of {fmtV(runRate)}/mo, you'd cross the threshold in{" "}
              <span className={`font-black ${monthsToThreshold <= 3 ? "text-red-400" : monthsToThreshold <= 6 ? "text-amber-400" : "text-emerald-400"}`}>
                ~{monthsToThreshold} month{monthsToThreshold !== 1 ? "s" : ""}
              </span>
            </p>
          </div>
        )}
        {threshPct >= 100 && (
          <GAlert type="red">
            <strong>Your rolling 12-month turnover has exceeded £90,000.</strong> You must register for VAT within 30 days of the month end when you crossed the threshold.
          </GAlert>
        )}
        {threshPct > 85 && threshPct < 100 && (
          <GAlert type="warn">
            You're close to the VAT threshold. Consider registering voluntarily now — it avoids a rushed registration and lets you reclaim input VAT from the registration date.
          </GAlert>
        )}
        {!isDemo && liveTotal === 0 && (
          <p className="text-[11px] text-[rgba(153,197,255,0.35)]">No paid invoices found in the last 12 months — log income in the Payments tab to track your threshold.</p>
        )}
      </GCard>

      {/* Simulator */}
      <GCard className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <SL>FRS vs standard VAT — quarterly comparison</SL>
          {runRate > 0 && !isDemo && <span className="text-[10px] text-[rgba(153,197,255,0.35)]">seeded from your avg monthly income</span>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <GInput label="Quarterly turnover (£)" type="number" value={turnover} onChange={e => setTurnover(parseFloat(e.target.value)||0)} />
          <GSelect label="Business type" value={businessType} onChange={e => setBusinessType(e.target.value)}>
            <option value="cleaning-domestic">Domestic cleaning (12%)</option>
            <option value="cleaning-commercial">Commercial cleaning (12%)</option>
            <option value="maintenance">Maintenance (9.5%)</option>
            <option value="limited-cost">Limited cost trader (16.5%)</option>
          </GSelect>
          <GInput label="Goods purchased (£)" type="number" value={goods} onChange={e => setGoods(parseFloat(e.target.value)||0)} />
          <GInput label="Other input VAT (£)" type="number" value={otherInput} onChange={e => setOtherInput(parseFloat(e.target.value)||0)} />
        </div>
        <label className="flex items-center gap-2 text-xs text-[rgba(153,197,255,0.6)] cursor-pointer">
          <input type="checkbox" checked={firstYear} onChange={e => setFirstYear(e.target.checked)} className="accent-[#1f48ff]" />
          First year on FRS (1% discount applies)
        </label>
      </GCard>

      <div className="grid grid-cols-2 gap-3">
        <GCard className="p-4">
          <SL className="mb-3">Standard VAT</SL>
          {[
            ["VAT charged to clients", fmtV(r.vatCharged), "text-emerald-400"],
            ["Input VAT to reclaim",   fmtV(r.totalInput),  "text-[rgba(153,197,255,0.6)]"],
            ["You pay HMRC",           fmtV(r.standardPay), "text-red-400"],
          ].map(([l, v, c]) => (
            <div key={l} className="flex justify-between text-xs py-1.5 border-b border-[rgba(153,197,255,0.06)]">
              <span className="text-[rgba(153,197,255,0.45)]">{l}</span>
              <span className={`font-black tabular-nums ${c}`}>{v}</span>
            </div>
          ))}
        </GCard>
        <GCard className={`p-4 ${frsWins ? "ring-1 ring-emerald-500/30" : ""}`}>
          <div className="flex items-center justify-between mb-3">
            <SL>Flat Rate ({r.frsRate}%)</SL>
            {frsWins && <GChip color="green">Recommended</GChip>}
          </div>
          {[
            ["Gross turnover",  fmtV(r.gross),    "text-[rgba(153,197,255,0.6)]"],
            ["FRS rate applied",`${r.frsRate}%`,   "text-[rgba(153,197,255,0.6)]"],
            ["You pay HMRC",    fmtV(r.frsPay),   "text-red-400"],
          ].map(([l, v, c]) => (
            <div key={l} className="flex justify-between text-xs py-1.5 border-b border-[rgba(153,197,255,0.06)]">
              <span className="text-[rgba(153,197,255,0.45)]">{l}</span>
              <span className={`font-black tabular-nums ${c}`}>{v}</span>
            </div>
          ))}
        </GCard>
      </div>

      {frsWins ? (
        <GAlert type="green">
          <strong>FRS saves you {fmtV(r.saving)}/quarter ({fmtV(r.annualSaving)}/year).</strong>{" "}
          As a cleaning business your FRS rate is 12% — you keep the difference between what you charge clients and what you pay HMRC.
        </GAlert>
      ) : (
        <GAlert type="blue">
          Standard VAT is better in your case — high input VAT to reclaim exceeds the FRS saving.
        </GAlert>
      )}

      {r.isLimited && (
        <GAlert type="amber">
          <strong>Limited Cost Trader test:</strong> Your goods spend ({r.goodsPct.toFixed(1)}% of gross) is below the 2% threshold.
          HMRC applies the 16.5% limited cost rate — FRS may not be beneficial.
        </GAlert>
      )}
    </div>
  );
}

// ─── TAB: Tax Tools (Efficiency + Pension + Mileage) ─────────────────────────
function TaxToolsTab({ setActiveTab }) {
  const [tool, setTool]   = useState("efficiency");
  const [monthly, setMonthly] = useState(250);
  const [profit,  setProfit]  = useState(33480);

  const r    = calculatePension(monthly, profit);
  const fmtP = (n) => `£${Math.round(n).toLocaleString()}`;
  const pct  = (r.rate * 100).toFixed(0);

  const score  = 74;
  const circ   = 213.6;
  const offset = circ * (1 - score / 100);

  const mileageRows = [
    { date: "6 Apr", journey: "Home → Johnson, SW4",     purpose: "Client visit",    miles: "8.4",  claim: "3.78" },
    { date: "6 Apr", journey: "Johnson → Greenfield",    purpose: "Client to client", miles: "4.1",  claim: "1.85" },
    { date: "7 Apr", journey: "Home → Supply depot",     purpose: "Supply run",       miles: "12.2", claim: "5.49" },
    { date: "8 Apr", journey: "Full route — 4 stops",    purpose: "Client visits",    miles: "31.6", claim: "14.22" },
  ];

  const TOOLS = [
    { id: "efficiency", label: "⚡ Tax Score" },
    { id: "pension",    label: "🎯 Pension"   },
    { id: "mileage",    label: "🚐 Mileage"   },
  ];

  return (
    <div className="space-y-5">
      <div>
        <SL className="mb-0.5">Tax optimisation toolkit</SL>
        <h2 className="text-2xl font-black text-white">Tax Tools</h2>
      </div>

      {/* Sub-tool pills */}
      <div className="flex gap-1 p-1 rounded-xl bg-[rgba(0,0,0,0.2)] w-fit">
        {TOOLS.map(t => (
          <button key={t.id} onClick={() => setTool(t.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
              tool === t.id ? "bg-[#1f48ff] text-white" : "text-[rgba(153,197,255,0.55)] hover:text-white"
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tax Efficiency */}
      {tool === "efficiency" && (
        <>
          <GCard className="p-4 flex gap-4 items-start">
            <div className="relative w-20 h-20 shrink-0">
              <svg viewBox="0 0 80 80" className="w-20 h-20 -rotate-90">
                <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(153,197,255,0.08)" strokeWidth="6" />
                <circle cx="40" cy="40" r="34" fill="none" stroke="#1f48ff" strokeWidth="6"
                  strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset} />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-black text-white">{score}</span>
                <span className="text-[10px] text-[rgba(153,197,255,0.4)]">/100</span>
              </div>
            </div>
            <div className="flex-1">
              <p className="text-sm font-black text-white mb-1">Good — but £1,847 of relief still unclaimed</p>
              <p className="text-[11px] text-[rgba(153,197,255,0.45)] leading-relaxed mb-3">Fix all 5 actions below and you'll pay roughly £1,847 less tax this year.</p>
              <div className="flex flex-wrap gap-1.5">
                <GChip color="green">✓ Mileage logged</GChip>
                <GChip color="green">✓ Insurance claimed</GChip>
                <GChip color="amber">⚠ Mileage incomplete</GChip>
                <GChip color="amber">⚠ No pension</GChip>
                <GChip color="red">✗ AIA not claimed</GChip>
              </div>
            </div>
          </GCard>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { emoji: "🚐", title: "Log 1,620 unlogged miles — save £729",         body: "At 45p/mile, 1,620 unlogged miles = £729 tax relief you're not claiming.",                        action: () => setTool("mileage"),  color: "border-emerald-500/30" },
              { emoji: "🎯", title: "Pension — save up to £820",                    body: "£4,100 into a SIPP = £820 tax relief PLUS the money is in your pension.",                          action: () => setTool("pension"),  color: "border-[#1f48ff]/30"    },
              { emoji: "⚙️", title: "AIA on equipment — up to £1,000 tax off",     body: "WFP brush, carpet cleaner, wet vac — Annual Investment Allowance = 100% first-year relief.",        action: undefined,                 color: "border-[#1f48ff]/30"    },
              { emoji: "🏠", title: "Claim use of home as office — £312/yr",        body: "25+ hrs admin at home? £26/mo HMRC flat rate, no receipts needed.",                                action: undefined,                 color: "border-amber-500/30"    },
              { emoji: "📚", title: "Training & CPD — ~£300 unclaimed",            body: "NCCA membership, cleaning courses, H&S training are all allowable.",                               action: undefined,                 color: "border-amber-500/30"    },
              { emoji: "🏦", title: "Your accountant fees are deductible",          body: "If Cadi replaces part of your accountant, that saving goes straight to profit.",                    action: undefined,                 color: "border-emerald-500/30"  },
            ].map(({ emoji, title, body, action, color }) => (
              <GCard key={title} className={`p-4 border-t-2 ${color} cursor-pointer hover:bg-[rgba(153,197,255,0.03)] transition-colors`} onClick={action}>
                <span className="text-xl mb-2 block">{emoji}</span>
                <p className="text-xs font-black text-white mb-1">{title}</p>
                <p className="text-[11px] text-[rgba(153,197,255,0.45)] leading-relaxed">{body}</p>
              </GCard>
            ))}
          </div>
        </>
      )}

      {/* Pension */}
      {tool === "pension" && (
        <>
          <GAlert type="gold">
            <strong>Key fact:</strong> Every £1 into a pension receives 20p government top-up at source.
            At your income level it also reduces your Payment on Account the following January.
          </GAlert>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <GCard className="p-4 space-y-4">
              <SL>Pension contribution simulator</SL>
              <GInput label="Annual taxable profit (£)" type="number" value={profit} onChange={e => setProfit(parseFloat(e.target.value)||0)} />
              <div>
                <SL className="mb-2">Monthly contribution: <span className="text-white">{fmtP(monthly)}</span></SL>
                <input type="range" min={0} max={1000} step={10} value={monthly}
                  onChange={e => setMonthly(parseInt(e.target.value))}
                  className="w-full accent-[#1f48ff]" />
                <div className="flex justify-between text-[10px] text-[rgba(153,197,255,0.35)] mt-1"><span>£0</span><span>£1,000/mo</span></div>
              </div>
              <GCard className="overflow-hidden divide-y divide-[rgba(153,197,255,0.05)]">
                {[
                  ["You pay (annual)",          fmtP(r.annual),          "text-[rgba(153,197,255,0.6)]"],
                  ["Govt top-up (20%)",          `+${fmtP(r.govTopup)}`,  "text-emerald-400"            ],
                  ["Total into pension",         fmtP(r.totalIn),         "text-white"                   ],
                  ["Your marginal rate",         `${pct}%`,               "text-[rgba(153,197,255,0.6)]"],
                  ["Income tax saved",           fmtP(r.taxSaved),        "text-emerald-400"            ],
                  ["Effective cost to you",      `${fmtP(r.effectiveCost)}/yr`, "text-white"            ],
                ].map(([label, val, c]) => (
                  <div key={label} className="flex justify-between px-3 py-2 text-xs">
                    <span className="text-[rgba(153,197,255,0.45)]">{label}</span>
                    <span className={`font-black tabular-nums ${c}`}>{val}</span>
                  </div>
                ))}
              </GCard>
            </GCard>

            <GCard className="p-4">
              <SL className="mb-4">Best options for self-employed cleaners</SL>
              <div className="space-y-3">
                {[
                  { name: "SIPP — Self-Invested Personal Pension", desc: "Max flexibility. Vanguard, AJ Bell, Hargreaves Lansdown. Contribute up to £60k/yr. Best for investment control." },
                  { name: "Nest Pension",                          desc: "Government-backed. 0.3% fees. Simple. Good if you employ staff — Nest covers both you and them." },
                  { name: "Lifetime ISA (under 40 only)",          desc: "25% govt bonus on up to £4k/yr. First home OR retirement. 25% penalty if accessed before 60." },
                ].map(({ name, desc }) => (
                  <div key={name} className="p-3 rounded-xl bg-[rgba(153,197,255,0.04)] border border-[rgba(153,197,255,0.1)]">
                    <p className="text-xs font-black text-white mb-1">{name}</p>
                    <p className="text-[11px] text-[rgba(153,197,255,0.45)] leading-relaxed">{desc}</p>
                  </div>
                ))}
              </div>
            </GCard>
          </div>

          {/* Tax bands */}
          <GCard className="overflow-hidden">
            <div className="px-4 py-3 border-b border-[rgba(153,197,255,0.08)]"><SL>2026/27 tax bands</SL></div>
            {[
              { band: "Personal Allowance", range: "£0 – £12,570",       rate: "0%",  tax: "£0",     save: "n/a",  color: "text-[rgba(153,197,255,0.4)]" },
              { band: "Basic Rate",         range: "£12,571 – £50,270",  rate: "20%", tax: "£4,096", save: "20p",  color: "text-[#99c5ff]", hl: true },
              { band: "Higher Rate",        range: "£50,271 – £125,140", rate: "40%", tax: "£0",     save: "40p",  color: "text-amber-400" },
              { band: "Class 4 NIC",        range: "£12,570 – £50,270",  rate: "9%",  tax: "£1,022", save: "indir", color: "text-red-400" },
            ].map(({ band, range, rate, tax, save, color, hl }) => (
              <div key={band} className={`grid grid-cols-5 px-4 py-2.5 text-xs border-b border-[rgba(153,197,255,0.05)] ${hl ? "bg-[#1f48ff]/05" : ""}`}>
                <span className="text-[rgba(153,197,255,0.6)]">{band}</span>
                <span className="text-[rgba(153,197,255,0.35)] font-mono text-[10px]">{range}</span>
                <span className={`font-black ${color}`}>{rate}</span>
                <span className={`font-mono font-black ${tax !== "£0" ? "text-amber-400" : "text-[rgba(153,197,255,0.2)]"}`}>{tax}</span>
                <span className={`font-mono text-[10px] ${save !== "n/a" && save !== "indir" ? "text-emerald-400 font-black" : "text-[rgba(153,197,255,0.2)]"}`}>{save}</span>
              </div>
            ))}
          </GCard>
        </>
      )}

      {/* Mileage */}
      {tool === "mileage" && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <GStatCard label="Miles logged"         value="4,820"  sub="of 10,000 at 45p/mile"   />
            <GStatCard label="Mileage claim value"  value="£2,169" valueColor="text-emerald-400" sub="Tax saving: ~£867" />
            <GStatCard label="Unlogged (est.)"      value="1,620"  valueColor="text-amber-400"   sub="~£729 unclaimed · Log now" />
            <GStatCard label="Remaining at 45p"     value="5,180"  sub="Before 25p rate kicks in" />
          </div>

          <GCard className="overflow-hidden">
            <div className="grid grid-cols-5 px-4 py-2.5 border-b border-[rgba(153,197,255,0.08)]">
              {["Date", "Journey", "Purpose", "Miles", "Claim"].map(h => (
                <SL key={h}>{h}</SL>
              ))}
            </div>
            <div className="divide-y divide-[rgba(153,197,255,0.05)]">
              {mileageRows.map(row => (
                <div key={row.journey} className="grid grid-cols-5 px-4 py-3 text-xs hover:bg-[rgba(153,197,255,0.02)] transition-colors">
                  <span className="text-[rgba(153,197,255,0.35)] font-mono">{row.date}</span>
                  <span className="text-white font-black truncate">{row.journey}</span>
                  <span>
                    <GChip color="blue">{row.purpose}</GChip>
                  </span>
                  <span className="font-mono text-[rgba(153,197,255,0.6)]">{row.miles}mi</span>
                  <span className="font-mono font-black text-emerald-400">£{row.claim}</span>
                </div>
              ))}
            </div>
          </GCard>

          <GAlert type="amber">
            <strong>Important:</strong> You cannot claim mileage rate AND actual vehicle costs for the same vehicle.
            Choose one method at tax year start and stick with it. Cadi compares both and recommends the better option.
          </GAlert>
        </>
      )}
    </div>
  );
}

// ─── TAB: Year End ────────────────────────────────────────────────────────────
function YearEndTab({ entityType = 'sole_trader', bizSettings = {}, isDemo = false }) {
  const { user } = useAuth();
  const { connected: hmrcConnected, obligations } = useHmrc();
  const [checked, setChecked] = useState({});
  const toggle = (k) => setChecked(p => ({ ...p, [k]: !p[k] }));
  const isLtd = entityType === 'limited_company';
  // Real users only see fake-data screens when explicitly in demo mode
  const showDemoData = isDemo || user?.id === 'demo-user';

  // For ltd: derive key dates from accounting_year_end_month (default March = 3)
  const yearEndMonth = bizSettings.accounting_year_end_month ?? 3;
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const yearEndLabel = MONTHS[yearEndMonth - 1];
  // CT payment: 9 months + 1 day after year end
  const ctPayMonth  = MONTHS[((yearEndMonth - 1 + 9) % 12)];
  // Companies House / CT600 filing: 12 months after year end (CT600), 9 months (CH)
  const chFilingMonth = MONTHS[((yearEndMonth - 1 + 9) % 12)];
  const ct600Month    = MONTHS[((yearEndMonth - 1 + 11) % 12)]; // 12 months but filed earlier usually

  // Demo timeline (only shown to demo user) — provides a populated example
  const demoTimeline = [
    { date: "7 Aug 2025",           title: "Q1 MTD Update — Submitted ✓",                      desc: "6 Apr – 5 Jul 2025. £14,210 income · £2,840 expenses.",                    status: "done"     },
    { date: "7 Nov 2025",           title: "Q2 MTD Update — Submitted ✓",                      desc: "6 Jul – 5 Oct 2025. £13,940 income · £2,780 expenses.",                    status: "done"     },
    { date: "5 Feb 2026",           title: "Q3 MTD Update — Submitted ✓",                      desc: "6 Oct – 5 Jan 2026. £13,670 income · £2,720 expenses.",                    status: "done"     },
    { date: "31 Jan 2026",          title: "2024/25 Final Paper SA — Submitted ✓",              desc: "Last traditional Self Assessment. Tax payment + Payment on Account paid.",   status: "done"     },
    { date: "6 Apr 2026",           title: "Tax Year 2026/27 Begins",                           desc: "MTD ITSA mandatory from April 2027 (income > £30k). Voluntary from now.",   status: "done"     },
    { date: "5 Aug 2026 · 115 days", title: "Q1 2026/27 MTD Update",                            desc: "6 Apr – 5 Jul 2026. In progress — 6 days of data logged.",                  status: "upcoming" },
    { date: "5 May 2027",           title: "Q4 2026/27 MTD Update",                            desc: "Final quarterly update for the 2026/27 tax year.",                          status: "future"   },
    { date: "31 Jan 2028",          title: "Final Declaration 2026/27",                        desc: "Replaces Self Assessment. Tax payment + 1st Payment on Account due.",        status: "future"   },
  ];

  // Real timeline — derived from useHmrc obligations + the standard MTD calendar
  const realTimeline = (() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const fmtDate = (s) => {
      try { return new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); } catch { return s; }
    };
    const obs = (obligations || []).map(o => ({
      date: fmtDate(o.due),
      title: `${o.periodKey || 'MTD'} Update${o.status === 'F' ? ' — Submitted ✓' : ''}`,
      desc: `${o.start || ''} – ${o.end || ''}`,
      status: o.status === 'F' ? 'done' : new Date(o.due) < today ? 'upcoming' : 'future',
    }));
    return obs;
  })();

  const timeline = showDemoData ? demoTimeline : realTimeline;

  // Checklist — only pre-tick items for demo. Live users start with everything unchecked.
  const checklist = showDemoData ? [
    { key: "income",    label: "All income logged for the quarter",         done: true  },
    { key: "receipts",  label: "All receipts scanned & categorised",        done: true  },
    { key: "mileage",   label: "Mileage log updated",                       done: false },
    { key: "van",       label: "Business use % confirmed for van",          done: false },
    { key: "aia",       label: "Capital equipment checked for AIA",         done: false },
    { key: "review",    label: "Figures reviewed before submitting",        done: false },
  ] : [
    { key: "income",    label: "All income logged for the quarter",         done: false },
    { key: "receipts",  label: "All receipts scanned & categorised",        done: false },
    { key: "mileage",   label: "Mileage log updated",                       done: false },
    { key: "van",       label: "Business use % confirmed for van",          done: false },
    { key: "aia",       label: "Capital equipment checked for AIA",         done: false },
    { key: "review",    label: "Figures reviewed before submitting",        done: false },
  ];

  const ltdTimeline = [
    { date: `31 ${yearEndLabel}`, title: "Accounting year end", desc: `Your company's accounting period closes. Start gathering P&L, payroll, and asset records.`, status: "upcoming" },
    { date: `${ctPayMonth} (9mo + 1 day)`, title: "Corporation Tax payment due", desc: "Pay CT to HMRC online. If you miss this, interest starts accruing immediately.", status: "future" },
    { date: `${chFilingMonth} (9 months)`, title: "Companies House — annual accounts", desc: "File full or abbreviated accounts. Private companies have 9 months from year end.", status: "future" },
    { date: `${ct600Month} (12 months)`, title: "CT600 filing deadline", desc: "Corporation Tax return must be filed with HMRC within 12 months of period end.", status: "future" },
    { date: "Annual", title: "Confirmation Statement", desc: "File at Companies House (due on your incorporation anniversary each year). £13 filing fee.", status: "future" },
    { date: "Each April", title: "PAYE year-end (P60s)", desc: "Issue P60 to each employee/director. RTI submissions continue monthly throughout the year.", status: "future" },
  ];

  const ltdChecklist = [
    { key: "income",    label: "All company income reconciled to bank" },
    { key: "expenses",  label: "All business expenses categorised with receipts" },
    { key: "payroll",   label: "Director salary / PAYE reconciled (RTI up to date)" },
    { key: "directors", label: "Director's loan account at zero or documented" },
    { key: "assets",    label: "Fixed asset register updated (capital allowances)" },
    { key: "ct600",     label: "CT600 completed and reviewed" },
    { key: "accounts",  label: "Annual accounts prepared for Companies House" },
    { key: "filed_ch",  label: "Accounts filed at Companies House" },
    { key: "filed_hmrc","label": "CT600 filed with HMRC" },
    { key: "ct_paid",   label: "Corporation Tax paid to HMRC" },
  ];

  if (isLtd) {
    return (
      <div className="space-y-5">
        <div>
          <SL className="mb-0.5">Never miss a deadline · Limited company</SL>
          <h2 className="text-2xl font-black text-white">Year End & Deadlines</h2>
          <p className="text-xs text-[rgba(153,197,255,0.45)] mt-0.5">
            Accounting year end: {yearEndLabel} · CT600 · Companies House · PAYE
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Ltd timeline */}
          <GCard className="p-4">
            <SL className="mb-4">Filing deadline timeline</SL>
            <div className="relative pl-4">
              <div className="absolute left-[7px] top-2 bottom-2 w-px bg-[rgba(153,197,255,0.1)]" />
              {ltdTimeline.map(({ date, title, desc, status }) => (
                <div key={title} className="relative mb-4 ml-4">
                  <div className={`absolute -left-[1.4rem] top-1 w-3 h-3 rounded-full border-2 ${
                    status === "done"     ? "bg-emerald-500 border-emerald-500" :
                    status === "upcoming" ? "bg-amber-400 border-amber-400 animate-pulse" :
                                            "bg-transparent border-[rgba(153,197,255,0.2)]"
                  }`} />
                  <p className={`text-[10px] font-mono mb-0.5 ${status === "upcoming" ? "text-amber-400 font-bold" : "text-[rgba(153,197,255,0.35)]"}`}>{date}</p>
                  <p className={`text-xs font-black mb-0.5 ${status === "done" ? "text-emerald-400" : status === "upcoming" ? "text-amber-300" : "text-[rgba(153,197,255,0.6)]"}`}>{title}</p>
                  <p className="text-[10px] text-[rgba(153,197,255,0.3)] leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </GCard>

          <div className="space-y-4">
            {/* Year-end checklist */}
            <GCard className="p-4">
              <SL className="mb-3">Year-end filing checklist</SL>
              <div className="space-y-2">
                {ltdChecklist.map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2.5 text-xs cursor-pointer">
                    <input type="checkbox" onChange={() => toggle(key)} checked={!!checked[key]} className="accent-[#1f48ff] w-4 h-4 shrink-0 rounded" />
                    <span className={checked[key] ? "text-[rgba(153,197,255,0.5)] line-through" : "text-white"}>{label}</span>
                  </label>
                ))}
              </div>
            </GCard>

            {/* CT600 export pack */}
            <GCard className="p-4">
              <SL className="mb-3">Accountant export pack</SL>
              <div className="space-y-2 mb-4">
                {[
                  "Full P&L — income by type, all expenses",
                  "CT600 workings (box-by-box breakdown)",
                  "Capital allowances schedule (AIA/WDA)",
                  "Director salary & dividends summary",
                  "Mileage log (HMRC-compliant format)",
                  "VAT return workings (if applicable)",
                ].map(item => (
                  <div key={item} className="flex items-start gap-2 text-xs">
                    <span className="text-emerald-400 shrink-0">✓</span>
                    <span className="text-[rgba(153,197,255,0.55)]">{item}</span>
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                {[
                  { icon: "📊", label: "Export CSV / Excel",      desc: "Xero & QuickBooks compatible" },
                  { icon: "📄", label: "Export PDF summary pack", desc: "Print-ready, CT600 workings on last page" },
                  { icon: "🔗", label: "Share accountant link",   desc: "Read-only live access — no files" },
                ].map(({ icon, label, desc }) => (
                  <button key={label} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[rgba(153,197,255,0.04)] border border-[rgba(153,197,255,0.1)] hover:border-[rgba(153,197,255,0.25)] transition-colors text-left">
                    <span className="text-base shrink-0">{icon}</span>
                    <div>
                      <p className="text-xs font-black text-white">{label}</p>
                      <p className="text-[10px] text-[rgba(153,197,255,0.35)]">{desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </GCard>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <SL className="mb-0.5">Never miss a deadline</SL>
        <h2 className="text-2xl font-black text-white">Year End & Deadlines</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Timeline */}
        <GCard className="p-4">
          <SL className="mb-4">HMRC deadline timeline</SL>
          {timeline.length === 0 ? (
            <div className="py-6 text-center">
              <p className="text-xs text-[rgba(153,197,255,0.55)] mb-3">
                {hmrcConnected
                  ? "No quarterly obligations yet — they'll appear here as soon as HMRC publishes them."
                  : "Connect HMRC to see your real quarterly deadlines and submission status."}
              </p>
              {!hmrcConnected && (
                <a href="#hmrc" className="inline-block px-4 py-2 rounded-xl bg-[#1f48ff] text-white text-xs font-black hover:bg-[#3a5eff] transition-colors">
                  Connect HMRC →
                </a>
              )}
            </div>
          ) : (
            <div className="relative pl-4">
              <div className="absolute left-[7px] top-2 bottom-2 w-px bg-[rgba(153,197,255,0.1)]" />
              {timeline.map(({ date, title, desc, status }) => (
                <div key={date + title} className="relative mb-4 ml-4">
                  <div className={`absolute -left-[1.4rem] top-1 w-3 h-3 rounded-full border-2 ${
                    status === "done"     ? "bg-emerald-500 border-emerald-500" :
                    status === "upcoming" ? "bg-amber-400 border-amber-400 animate-pulse" :
                                            "bg-transparent border-[rgba(153,197,255,0.2)]"
                  }`} />
                  <p className={`text-[10px] font-mono mb-0.5 ${status === "upcoming" ? "text-amber-400 font-bold" : "text-[rgba(153,197,255,0.35)]"}`}>{date}</p>
                  <p className={`text-xs font-black mb-0.5 ${status === "done" ? "text-emerald-400" : status === "upcoming" ? "text-amber-300" : "text-[rgba(153,197,255,0.6)]"}`}>{title}</p>
                  <p className="text-[10px] text-[rgba(153,197,255,0.3)] leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          )}
        </GCard>

        <div className="space-y-4">
          {/* Q1 checklist */}
          <GCard className="p-4">
            <SL className="mb-3">Q1 2026/27 submission checklist</SL>
            <div className="space-y-2">
              {checklist.map(({ key, label, done }) => (
                <label key={key} className="flex items-center gap-2.5 text-xs cursor-pointer group">
                  <input type="checkbox" defaultChecked={done} onChange={() => toggle(key)} className="accent-[#1f48ff] w-4 h-4 shrink-0 rounded" />
                  <span className={`${checked[key] || done ? "text-[rgba(153,197,255,0.6)]" : "text-white"}`}>{label}</span>
                </label>
              ))}
            </div>
            <button className="mt-4 w-full py-2.5 rounded-xl bg-[#1f48ff] text-white text-xs font-black hover:bg-[#3a5eff] transition-colors">
              Preview Q1 Submission →
            </button>
          </GCard>

          {/* Payments on account */}
          <GCard className="p-4">
            <SL className="mb-3">Payments on account</SL>
            <p className="text-[11px] text-[rgba(153,197,255,0.45)] leading-relaxed mb-3">
              If your tax bill exceeds £1,000, HMRC requires advance payments. Many first-time filers are caught off-guard — you pay 150% in January.
            </p>
            {showDemoData ? (
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="p-3 rounded-xl bg-[rgba(153,197,255,0.04)] border border-[rgba(153,197,255,0.1)]">
                  <SL className="mb-1">31 Jan 2028</SL>
                  <p className="text-lg font-black text-amber-400 tabular-nums">£7,677</p>
                  <p className="text-[10px] text-[rgba(153,197,255,0.35)]">Tax + 1st POA</p>
                </div>
                <div className="p-3 rounded-xl bg-[rgba(153,197,255,0.04)] border border-[rgba(153,197,255,0.1)]">
                  <SL className="mb-1">31 Jul 2028</SL>
                  <p className="text-lg font-black text-[#99c5ff] tabular-nums">£2,559</p>
                  <p className="text-[10px] text-[rgba(153,197,255,0.35)]">2nd POA</p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-[rgba(153,197,255,0.55)] mb-3">
                Your payments-on-account will appear here after you file your first Final Declaration via HMRC.
              </p>
            )}
            <GAlert type="gold">Set aside <strong>25% of every invoice</strong> from day one.</GAlert>
          </GCard>

          {/* Export */}
          <GCard className="p-4">
            <SL className="mb-3">Accountant export pack</SL>
            <div className="space-y-2 mb-4">
              {["Full P&L — income by type, all expenses", "SA103 box-by-box breakdown (ready to file)", "All 4 MTD quarterly figures", "Mileage log (HMRC-compliant format)", "Capital items & AIA calculations", "VAT return workings (if applicable)"].map(item => (
                <div key={item} className="flex items-start gap-2 text-xs">
                  <span className="text-emerald-400 shrink-0">✓</span>
                  <span className="text-[rgba(153,197,255,0.55)]">{item}</span>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              {[
                { icon: "📊", label: "Export CSV / Excel",        desc: "Xero & QuickBooks compatible" },
                { icon: "📄", label: "Export PDF summary pack",   desc: "Print-ready, SA103 on last page" },
                { icon: "🔗", label: "Share accountant link",     desc: "Read-only live access — no files" },
              ].map(({ icon, label, desc }) => (
                <button key={label} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[rgba(153,197,255,0.04)] border border-[rgba(153,197,255,0.1)] hover:border-[rgba(153,197,255,0.25)] transition-colors text-left">
                  <span className="text-base shrink-0">{icon}</span>
                  <div>
                    <p className="text-xs font-black text-white">{label}</p>
                    <p className="text-[10px] text-[rgba(153,197,255,0.35)]">{desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </GCard>
        </div>
      </div>
    </div>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export default function AccountsTab() {
  const { user }     = useAuth();
  const { invoices } = useInvoices();
  const businessId   = useBusinessId();
  const [activeTab, setActiveTab] = useState("overview");
  const [bizSettings, setBizSettings] = useState({
    entity_type: 'sole_trader',
    vat_number: null,
    vat_scheme: 'none',
    companies_house_number: null,
    corporation_tax_utr: null,
    director_salary_annual: 12570,
    accounting_year_end_month: 3,
    annual_target: 0,
    tax_reserve: 0,
    tax_reserve_target: 0,
  });

  const loadSettings = useCallback(async () => {
    try {
      const data = await getBusinessSettings();
      if (data) setBizSettings(prev => ({ ...prev, ...data }));
    } catch { /* keep defaults */ }
  }, []);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  const saveSettings = useCallback(async (patch) => {
    const { data: { user: u } } = await supabase.auth.getUser();
    if (!u?.id) throw new Error('Not signed in — settings cannot be saved.');
    const { error } = await supabase
      .from('business_settings')
      .upsert({ ...patch, owner_id: u.id }, { onConflict: 'owner_id' });
    if (error) throw error;
    setBizSettings(prev => ({ ...prev, ...patch }));
  }, []);

  const isDemo = user?.id === 'demo-user';
  const [demoEntityType, setDemoEntityType] = useState('sole_trader');
  const entityType = isDemo ? demoEntityType : (bizSettings.entity_type ?? 'sole_trader');

  const unpaidCount = invoices.filter(i => i.status !== "paid" && i.status !== "draft").length;

  const TABS = [
    { id: "overview",  label: "📊 Overview"      },
    { id: "hmrc",      label: "🏛️ HMRC Connect",  badge: "MTD" },
    { id: "income",    label: "💰 Income",         badge: unpaidCount > 0 ? String(unpaidCount) : undefined },
    { id: "expenses",  label: "💸 Expenses"       },
    { id: "vat",       label: "🔢 VAT"             },
    { id: "tax-tools", label: "⚡ Tax Tools"       },
    { id: "year-end",  label: "📅 Year End"        },
  ];

  const panels = {
    overview:    <OverviewTab  setActiveTab={setActiveTab} entityType={entityType} bizSettings={bizSettings} />,
    hmrc:        <HmrcTab entityType={entityType} />,
    income:      <IncomeTab />,
    expenses:    <ExpensesTab />,
    vat:         <VATTab bizSettings={bizSettings} saveSettings={saveSettings} />,
    "tax-tools": <TaxToolsTab setActiveTab={setActiveTab} />,
    "year-end":  <YearEndTab entityType={entityType} bizSettings={bizSettings} isDemo={isDemo} />,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#010a4f] via-[#05124a] to-[#0d1e78] relative">
      {/* Grid texture */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{ backgroundImage: "linear-gradient(rgba(153,197,255,0.5) 1px,transparent 1px),linear-gradient(90deg,rgba(153,197,255,0.5) 1px,transparent 1px)", backgroundSize: "32px 32px" }} />

      <div className="relative max-w-4xl mx-auto px-4 py-6 space-y-5">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <SL className="mb-0.5">Cadi Accounts</SL>
            <h1 className="text-3xl font-black text-white">Accounts</h1>
          </div>
          {isDemo && (
            <div className="shrink-0 flex items-center gap-1 p-1 rounded-xl bg-[rgba(0,0,0,0.2)]">
              {['sole_trader', 'limited_company'].map(et => (
                <button key={et} onClick={() => setDemoEntityType(et)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black whitespace-nowrap transition-all ${
                    demoEntityType === et ? 'bg-[#1f48ff] text-white' : 'text-[rgba(153,197,255,0.5)] hover:text-white'
                  }`}>
                  {et === 'sole_trader' ? 'Sole Trader' : 'Ltd Co'}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Pill nav — scrollable on mobile */}
        <div className="overflow-x-auto pb-1">
          <div className="flex gap-1 p-1 rounded-2xl bg-[rgba(0,0,0,0.2)] w-fit min-w-full sm:min-w-0">
            {TABS.map(({ id, label, badge }) => (
              <button key={id} onClick={() => setActiveTab(id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black whitespace-nowrap transition-all ${
                  activeTab === id
                    ? "bg-[#1f48ff] text-white"
                    : "text-[rgba(153,197,255,0.55)] hover:text-white hover:bg-[rgba(153,197,255,0.06)]"
                }`}>
                {label}
                {badge && (
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-black ${
                    activeTab === id ? "bg-white/20 text-white" : "bg-[rgba(153,197,255,0.1)] text-[rgba(153,197,255,0.6)]"
                  }`}>
                    {badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Panel */}
        {panels[activeTab]}
      </div>
    </div>
  );
}
