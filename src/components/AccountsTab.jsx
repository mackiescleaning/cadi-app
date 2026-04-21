// src/components/AccountsTab.jsx
// Cadi — Accounts · glassmorphism redesign
// HMRC Connect · MTD ITSA · live InvoiceContext data · SA103 mapping

import { useState, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { useInvoices, invTotal, invCustomerName } from "../context/InvoiceContext";
import { useHmrc } from "../hooks/useHmrc";

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
function OverviewTab({ setActiveTab }) {
  const { invoices } = useInvoices();
  const { user } = useAuth();
  const isDemo = user?.id === 'demo-user';

  // Live figures from InvoiceContext
  const YTD_START = "2026-04-06";
  const ytdPaid    = invoices.filter(i => i.status === "paid" && (i.paidAt ?? "").slice(0, 10) >= YTD_START);
  const ytdIncome  = ytdPaid.reduce((s, i) => s + invTotal(i), 0);
  const outstanding = invoices.filter(i => i.status !== "paid" && i.status !== "draft")
                               .reduce((s, i) => s + invTotal(i), 0);
  const overdue     = invoices.filter(i => i.status === "overdue")
                               .reduce((s, i) => s + invTotal(i), 0);

  // Expenses, tax reserve and targets: demo-only preview values until MoneyTracker context is unified
  const ytdExpenses = isDemo ? 557 : 0;
  const taxRate     = 0.20;
  const netProfit   = Math.max(0, ytdIncome - ytdExpenses);
  const taxEst      = netProfit * taxRate;
  const taxReserve  = isDemo ? 4260 : 0;
  const annualTarget = 65000;
  const ytdAll       = isDemo ? 41820 : ytdIncome;
  const ytdPct       = annualTarget > 0 ? Math.round((ytdAll / annualTarget) * 100) : 0;

  const INSIGHTS = isDemo ? [
    { emoji: "🚐", title: "Log 1,620 unlogged miles — save £729", body: "At HMRC's 45p/mile rate you have £729 of unclaimed relief sitting idle.", action: "mileage" },
    { emoji: "🎯", title: "Pension contributions save £820/yr",   body: "£4,100 into a SIPP = £820 tax relief. Money for retirement AND off your bill.", action: "tax-tools" },
    { emoji: "⚙️", title: "Claim AIA on new equipment",           body: "WFP brush head, carpet cleaner — Annual Investment Allowance = 100% first-year relief." },
    { emoji: "🏛️", title: "Q1 MTD update due 5 Aug 2026",        body: "You're 6 days into Q1 2026/27. Your submission data is ready to preview.", action: "hmrc" },
  ] : [
    { emoji: "🚐", title: "Log every mile — 45p/mile HMRC relief", body: "Record business journeys in the Routes tab. Every mile cuts your tax bill.", action: "mileage" },
    { emoji: "🎯", title: "Pension contributions cut your tax",    body: "SIPP contributions get 20% tax relief on top. Save for retirement, pay less now.", action: "tax-tools" },
    { emoji: "⚙️", title: "Claim AIA on equipment",                body: "WFP brush head, carpet cleaner, van — Annual Investment Allowance = 100% first-year relief." },
    { emoji: "🏛️", title: "MTD ITSA quarterly updates",            body: "Cadi tracks your quarterly submission windows and maps spend to SA103 boxes.", action: "hmrc" },
  ];

  const asOfLabel = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const expensesSub = isDemo ? "Demo · connect Money tab" : "Log expenses in the Money tab";
  const headerSub = isDemo ? "Live from your invoices · demo expenses" : "Live from your invoices · connect Money tab for expenses";

  return (
    <div className="space-y-5">
      <div>
        <SL className="mb-0.5">Tax year 2026/27 · As of {asOfLabel}</SL>
        <h2 className="text-2xl font-black text-white">Tax Dashboard</h2>
        <p className="text-xs text-[rgba(153,197,255,0.45)] mt-0.5">{headerSub}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <GStatCard label="YTD income received"  value={fmt(ytdIncome)}  valueColor="text-emerald-400" sub={`${ytdPaid.length} paid invoices · 2026/27`} />
        <GStatCard label="Outstanding"          value={fmt(outstanding)} valueColor={outstanding > 0 ? "text-amber-400" : "text-emerald-400"} sub={overdue > 0 ? `${fmt(overdue)} overdue` : "Nothing overdue"} />
        <GStatCard label="YTD expenses"         value={fmt(ytdExpenses)} valueColor="text-red-400"    sub={expensesSub} />
        <GStatCard label="Tax estimate"         value={fmt(taxEst)}      valueColor="text-amber-400"  sub={`${(taxRate*100).toFixed(0)}% of net profit`} />
      </div>

      {/* Annual target */}
      <GCard className="p-4">
        <div className="flex items-center justify-between mb-2">
          <SL>Annual target progress</SL>
          <span className="text-xs font-black text-white tabular-nums">{fmt(ytdAll)} / {fmt(annualTarget)}</span>
        </div>
        <div className="h-2 rounded-full bg-[rgba(153,197,255,0.08)] overflow-hidden">
          <div className="h-full rounded-full bg-[#1f48ff] transition-all" style={{ width: `${Math.min(ytdPct, 100)}%` }} />
        </div>
        <div className="flex justify-between mt-1.5 text-[10px] text-[rgba(153,197,255,0.35)]">
          <span>{ytdPct}% of {fmt(annualTarget)} target</span>
          <span>{fmt(annualTarget - ytdAll)} to go</span>
        </div>
      </GCard>

      {/* Tax reserve */}
      <GCard className="p-4">
        <div className="flex items-center justify-between mb-1">
          <SL>Tax reserve</SL>
          <GChip color={taxReserve >= taxEst ? "green" : "amber"}>{taxReserve >= taxEst ? "✓ On track" : "⚠ Short"}</GChip>
        </div>
        <div className="flex items-baseline gap-2 mb-2">
          <span className="text-2xl font-black text-yellow-400 tabular-nums">{fmt(taxReserve)}</span>
          <span className="text-xs text-[rgba(153,197,255,0.4)]">saved of {fmt(Math.max(taxEst, 5118))} needed</span>
        </div>
        <GAlert type="gold">
          Set aside <strong>25% of every invoice</strong> from day one. Every £100 banked now is one less surprise in January.
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

      {/* AI-style insights */}
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
  const valid  = (v) => /^[A-CEGHJ-PR-TW-Z]{2}\d{6}[A-D]$/.test(v);

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

// ─── TAB: HMRC Connect ────────────────────────────────────────────────────────
function HmrcTab() {
  const { invoices } = useInvoices();
  const { user }     = useAuth();
  const isLive       = Boolean(user);
  const isDemo       = user?.id === 'demo-user';

  // Real HMRC hook — no-ops when user isn't logged in or HMRC not connected
  const {
    connected,
    connecting,
    loading:   hmrcLoading,
    nino,
    obligations,
    error:     hmrcError,
    connectHmrc,
    disconnectHmrc,
    saveNino,
    submitAndCalculate,
    fetchObligations,
  } = useHmrc();

  const [expandedQ,    setExpandedQ]    = useState("Q1");
  const [submitModal,  setSubmitModal]  = useState(null);  // quarter object | null
  const [submitBusy,   setSubmitBusy]   = useState(false);
  const [submitResult, setSubmitResult] = useState(null);  // { success, message }

  const TAX_YEAR = 2026; // 2026/27

  // Real quarterly income from InvoiceContext (cash basis)
  const qData = useMemo(() => {
    return TAX_QUARTERS.map(q => {
      const { start, end } = getQuarterBounds(TAX_YEAR, q);
      const income = getQuarterIncome(invoices, start, end);
      // Demo expenses per quarter (will come from shared expense context)
      const demoExp = { Q1: 557, Q2: 980, Q3: 1040, Q4: 960 };
      const expenses = isDemo ? (demoExp[q.id] ?? 0) : 0;
      const net = income - expenses;
      const tax = Math.max(0, (net - (12570 / 4)) * 0.20); // rough estimate
      return { ...q, start, end, income, expenses, net, tax };
    });
  }, [invoices]);

  // MTD ITSA SA103 expense field mapping
  const SA103_FIELDS = [
    { field: "turnover",              box: "Box 15", label: "Turnover (gross receipts)",   demo: "£3,820"  },
    { field: "costOfGoods",           box: "Box 16", label: "Cost of goods / materials",   demo: "−£112"   },
    { field: "travelCosts",           box: "Box 17", label: "Motor & travel costs",         demo: "−£220"   },
    { field: "premisesRunningCosts",  box: "Box 20", label: "Premises running costs",        demo: "—"       },
    { field: "adminCosts",            box: "Box 21", label: "Phone, software & admin",       demo: "−£60"    },
    { field: "advertisingCosts",      box: "Box 22", label: "Advertising & marketing",       demo: "−£60"    },
    { field: "interest",              box: "Box 23", label: "Finance charges & interest",    demo: "—"       },
    { field: "professionalFees",      box: "Box 24", label: "Legal & professional fees",     demo: "—"       },
    { field: "other",                 box: "Box 27", label: "Other allowable expenses",      demo: "−£105"   },
  ];

  const QUARTERLY_STATUS = { Q1: "active", Q2: "future", Q3: "future", Q4: "future" };

  return (
    <div className="space-y-5">
      <div>
        <SL className="mb-0.5">Making Tax Digital · ITSA</SL>
        <h2 className="text-2xl font-black text-white">HMRC Connect</h2>
        <p className="text-xs text-[rgba(153,197,255,0.45)] mt-0.5">Quarterly submissions · SA103 mapping · Tax year 2026/27</p>
      </div>

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
          const status = QUARTERLY_STATUS[q.id];
          const isActive = status === "active";
          return (
            <button
              key={q.id}
              onClick={() => setExpandedQ(expandedQ === q.id ? null : q.id)}
              className={`rounded-xl border p-3 text-left transition-all ${
                expandedQ === q.id
                  ? "bg-[#1f48ff]/15 border-[#1f48ff]/40"
                  : isActive
                  ? "bg-[rgba(153,197,255,0.06)] border-[rgba(153,197,255,0.2)] hover:border-[rgba(153,197,255,0.35)]"
                  : "bg-[rgba(153,197,255,0.02)] border-[rgba(153,197,255,0.08)] hover:border-[rgba(153,197,255,0.2)]"
              }`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-black text-white">{q.label}</span>
                <span className={`w-2 h-2 rounded-full ${
                  isActive ? "bg-amber-400 animate-pulse" : "bg-[rgba(153,197,255,0.2)]"
                }`} />
              </div>
              <p className="text-[10px] text-[rgba(153,197,255,0.4)] mb-1">{q.start.slice(5).replace("-", " ")} – {q.end.slice(5).replace("-", " ")}</p>
              <p className="text-[10px] font-bold text-[rgba(153,197,255,0.55)]">Due {q.due} {Number(q.end.slice(0,4)) + (q.id === "Q4" ? 1 : 0)}</p>
              {q.income > 0
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
        const isActive = QUARTERLY_STATUS[q.id] === "active";
        return (
          <GCard className="overflow-hidden">
            <div className="px-4 py-3 border-b border-[rgba(153,197,255,0.08)] flex items-center justify-between">
              <div>
                <SL className="mb-0">{q.label} · {q.start} to {q.end}</SL>
                <p className="text-sm font-black text-white">Submission Preview — SA103 fields</p>
              </div>
              {isActive && (
                <GChip color="amber">⏳ Due {q.due} 2026</GChip>
              )}
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
                {SA103_FIELDS.map(({ box, label, demo }) => (
                  <div key={box} className="flex items-center gap-3 text-xs">
                    <span className="w-14 font-black text-[rgba(153,197,255,0.35)] shrink-0 font-mono text-[10px]">{box}</span>
                    <span className="flex-1 text-[rgba(153,197,255,0.55)]">{label}</span>
                    <span className={`font-black tabular-nums ${demo.startsWith("−") ? "text-red-400" : demo === "—" ? "text-[rgba(153,197,255,0.2)]" : "text-emerald-400"}`}>{demo}</span>
                  </div>
                ))}
                <div className="flex items-center gap-3 text-xs pt-2 border-t border-[rgba(153,197,255,0.06)] mt-2">
                  <span className="w-14 shrink-0" />
                  <span className="flex-1 font-black text-white">Net profit submitted</span>
                  <span className="font-black text-white tabular-nums">{fmt(q.net > 0 ? q.net : 3263)}</span>
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
                  disabled={connecting || submitBusy || q.income <= 0}
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
              await submitAndCalculate({
                periodStart: submitModal.start,
                periodEnd:   submitModal.end,
                income:      { turnover: submitModal.income },
                expenses:    { other: submitModal.expenses },
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

      {/* Final Declaration */}
      <GCard className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <SL className="mb-1">Final declaration · replaces self assessment</SL>
            <p className="text-sm font-black text-white">Due 31 January 2028</p>
            <p className="text-[11px] text-[rgba(153,197,255,0.45)] mt-1 leading-relaxed max-w-sm">
              After Q4, submit your End of Period Statement (EOPS) — claim capital allowances, AIA on equipment, pension contributions.
              The Final Declaration consolidates everything. Cadi auto-populates from your full-year records.
            </p>
          </div>
          <GChip color="ghost">295 days</GChip>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          <GChip color="green">✓ Digital records kept</GChip>
          <GChip color="amber">⚠ Capital allowances to review</GChip>
          <GChip color="blue">ℹ Pension contributions to add</GChip>
        </div>
      </GCard>

      {/* Prior year */}
      <SectionDivider label="2025/26 · Completed year" />
      <GCard className="overflow-hidden divide-y divide-[rgba(153,197,255,0.05)]">
        {[
          { q: "Q1 2025/26", dates: "6 Apr – 5 Jul 2025", income: "£14,210", exp: "£2,840", status: "submitted" },
          { q: "Q2 2025/26", dates: "6 Jul – 5 Oct 2025", income: "£13,940", exp: "£2,780", status: "submitted" },
          { q: "Q3 2025/26", dates: "6 Oct – 5 Jan 2026", income: "£13,670", exp: "£2,720", status: "submitted" },
          { q: "Q4 2025/26", dates: "6 Jan – 5 Apr 2026", income: "£14,000", exp: "£2,800", status: "submitted" },
        ].map(({ q, dates, income, exp, status }) => (
          <div key={q} className="flex items-center gap-3 px-4 py-3">
            <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black text-white">{q}</p>
              <p className="text-[10px] text-[rgba(153,197,255,0.35)]">{dates}</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-black text-emerald-400 tabular-nums">{income}</p>
              <p className="text-[10px] text-red-400">{exp}</p>
            </div>
            <GChip color="green">✓ Submitted</GChip>
          </div>
        ))}
      </GCard>
    </div>
  );
}

// ─── TAB: Invoice Records ─────────────────────────────────────────────────────
function InvoiceRecordsTab() {
  const { invoices } = useInvoices();
  const [taxYear, setTaxYear] = useState("2026/27");

  const TAX_YEARS   = ["2024/25", "2025/26", "2026/27"];
  const TODAY       = "2026-04-12";
  const yearStart   = (y) => `${y.split("/")[0]}-04-01`;
  const yearEnd     = (y) => `20${y.split("/")[1]}-03-31`;

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

  return (
    <div className="space-y-5">
      <div>
        <SL className="mb-0.5">Tax year · All invoices · Aged debtors</SL>
        <h2 className="text-2xl font-black text-white">Invoice Records</h2>
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
        <span className="text-[10px] text-[rgba(153,197,255,0.35)]">{yearInvs.length} invoices</span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <GStatCard label="Total invoiced"  value={fmt(totalInvoiced)}    sub={`${yearInvs.length} invoices`} />
        <GStatCard label="Received"        value={fmt(totalReceived)}    valueColor="text-emerald-400" sub={`${yearInvs.filter(i=>i.status==="paid").length} paid`} />
        <GStatCard label="Outstanding"     value={fmt(totalOutstanding)} valueColor={totalOutstanding > 0 ? "text-amber-400" : "text-emerald-400"} sub={`${unpaid.length} unpaid`} />
        <GStatCard label="Overdue"         value={fmt(totalOverdue)}     valueColor={totalOverdue > 0 ? "text-red-400" : "text-emerald-400"} sub={totalOverdue > 0 ? "Action needed" : "Clear ✓"} />
      </div>

      {/* Aged debtors */}
      {unpaid.length > 0 && (
        <>
          <SectionDivider label="Aged debtors" right={<GChip color="amber">{fmt(agedSum(unpaid))} owed</GChip>} />
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

      {/* By month */}
      {Object.entries(byMonth).map(([month, invs]) => (
        <div key={month}>
          <SectionDivider label={month} right={<GChip color="ghost">{fmt(invs.reduce((s,i)=>s+invTotal(i),0))}</GChip>} />
          <GCard className="overflow-hidden divide-y divide-[rgba(153,197,255,0.05)]">
            {invs.map(inv => {
              const sm = invStatusMeta(inv);
              return (
                <div key={inv.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[rgba(153,197,255,0.02)] transition-colors">
                  <div className={`w-0.5 self-stretch rounded-full shrink-0 ${TYPE_STRIPE[inv.type] ?? "bg-[rgba(153,197,255,0.2)]"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black text-white">{invCustomerName(inv)}</p>
                    <p className="text-[10px] text-[rgba(153,197,255,0.35)]">{inv.num} · {new Date(inv.date).toLocaleDateString("en-GB",{day:"numeric",month:"short"})} · {inv.type}</p>
                  </div>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border shrink-0 ${sm.cls}`}>{sm.label}</span>
                  <p className="text-xs font-black tabular-nums text-white shrink-0">{fmt2(invTotal(inv))}</p>
                </div>
              );
            })}
          </GCard>
        </div>
      ))}

      {yearInvs.length === 0 && (
        <GCard className="p-10 text-center">
          <p className="text-2xl mb-2">🧾</p>
          <p className="text-sm font-black text-white">No invoices in {taxYear}</p>
          <p className="text-[11px] text-[rgba(153,197,255,0.4)] mt-1">Switch year above or create invoices in the Invoices tab.</p>
        </GCard>
      )}

      {totalReceived > 0 && (
        <GAlert type="blue">
          <strong>SA103 Box 15:</strong> Total received <strong>{fmt(totalReceived)}</strong> is your declared
          turnover for {taxYear}. Outstanding <strong>{fmt(totalOutstanding)}</strong> counts as income once paid.
        </GAlert>
      )}
    </div>
  );
}

// ─── TAB: Expenses ────────────────────────────────────────────────────────────
function ExpensesTab() {
  const categories = [
    { icon: "🚐", name: "Van & Vehicle Costs",            sub: "Fuel · Insurance · MOT · Repairs · Tax · Finance (business %)", amount: "−£2,890", save: "~£1,156", box: "Box 17" },
    { icon: "🚗", name: "Mileage (45p/mile HMRC rate)",   sub: "4,820 miles logged · Cannot combine with actual vehicle costs",   amount: "−£2,169", save: "~£867",  box: "Box 17" },
    { icon: "🧴", name: "Cleaning Supplies & Materials",  sub: "Products · chemicals · equipment · consumables used on jobs",     amount: "−£1,640", save: "~£656",  box: "Box 16" },
    { icon: "🛡️", name: "Business Insurance",             sub: "Public liability · employer's liability · van business use",      amount: "−£1,200", save: "~£480",  box: "Box 20" },
    { icon: "👕", name: "Uniform, PPE & Workwear",        sub: "Logo'd clothing · gloves · masks · boots · NOT everyday wear",    amount: "−£380",   save: "~£152",  box: "Box 27" },
    { icon: "📱", name: "Phone & Software (business %)",  sub: "Mobile plan · Cadi subscription · scheduling tools",              amount: "−£720",   save: "~£288",  box: "Box 21" },
    { icon: "🏠", name: "Use of Home as Office",          sub: "HMRC flat rate £26/mo (26+ hrs) or actual proportion",            amount: "−£312",   save: "~£125",  box: "Box 20" },
    { icon: "📢", name: "Marketing & Advertising",        sub: "Leaflets · Google Ads · website · business cards",                amount: "−£540",   save: "~£216",  box: "Box 22" },
    { icon: "🏦", name: "Bank Charges & Professional Fees", sub: "Business account fees · accountant fees · bank interest",      amount: "−£358",   save: "~£143",  box: "Box 24" },
    { icon: "🎓", name: "Training & Development",         sub: "Course fees · NCCA · CSSA memberships · trade bodies",            amount: "−£300",   save: "~£120",  box: "Box 27" },
  ];

  return (
    <div className="space-y-5">
      <div>
        <SL className="mb-0.5">HMRC-categorised · Every receipt tracked</SL>
        <h2 className="text-2xl font-black text-white">Expense Tracker</h2>
        <p className="text-xs text-[rgba(153,197,255,0.45)] mt-0.5">Auto-mapped to SA103 boxes on your MTD return</p>
      </div>

      <GAlert type="green">
        <strong>Total allowable expenses YTD: £8,340</strong> · saving approx. <strong>£3,336 in tax</strong>.
        Each row maps to the exact SA103 box HMRC uses.
      </GAlert>

      <GCard className="overflow-hidden divide-y divide-[rgba(153,197,255,0.05)]">
        {categories.map(({ icon, name, sub, amount, save, box }) => (
          <div key={name} className="flex items-center gap-3 px-4 py-3 hover:bg-[rgba(153,197,255,0.02)] transition-colors">
            <div className="w-8 h-8 rounded-xl bg-[rgba(153,197,255,0.06)] flex items-center justify-center text-base shrink-0">{icon}</div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black text-white">{name}</p>
              <p className="text-[10px] text-[rgba(153,197,255,0.35)] mt-0.5 truncate">{sub}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs font-black tabular-nums text-red-400">{amount}</p>
              <p className="text-[10px] text-emerald-400">saves {save}</p>
            </div>
            <span className="text-[10px] font-black font-mono text-[rgba(153,197,255,0.3)] w-12 text-right shrink-0">{box}</span>
          </div>
        ))}
      </GCard>

      <GAlert type="amber">
        <strong>Missing expenses check:</strong> Based on your business type you may also be able to claim:{" "}
        <strong>water-fed pole equipment (AIA)</strong> · <strong>carpet cleaner depreciation</strong> · <strong>storage unit rent</strong>.
      </GAlert>
    </div>
  );
}

// ─── TAB: VAT Planner ─────────────────────────────────────────────────────────
function VATTab() {
  const [turnover,     setTurnover]     = useState(13670);
  const [businessType, setBusinessType] = useState("cleaning-domestic");
  const [goods,        setGoods]        = useState(480);
  const [otherInput,   setOtherInput]   = useState(360);
  const [firstYear,    setFirstYear]    = useState(false);

  const r      = calculateVAT({ turnover, businessType, goods, otherInput, firstYear });
  const frsWins = r.saving > 0;
  const fmtV   = (n) => `£${Math.abs(Math.round(n)).toLocaleString()}`;
  const ytdTurnover = 41820;
  const threshold   = 90000;
  const threshPct   = Math.round((ytdTurnover / threshold) * 100);

  return (
    <div className="space-y-5">
      <div>
        <SL className="mb-0.5">VAT planning & optimisation</SL>
        <h2 className="text-2xl font-black text-white">VAT Planner</h2>
        <p className="text-xs text-[rgba(153,197,255,0.45)] mt-0.5">Threshold tracker · Flat Rate Scheme comparison · FRS rate: 12%</p>
      </div>

      {/* Threshold */}
      <GCard className="p-4">
        <div className="flex items-center justify-between mb-2">
          <SL>VAT registration threshold (£90,000)</SL>
          <GChip color={threshPct > 85 ? "amber" : "ghost"}>{threshPct}% of threshold</GChip>
        </div>
        <p className="text-2xl font-black text-white tabular-nums mb-2">{fmtV(ytdTurnover)} <span className="text-sm text-[rgba(153,197,255,0.4)] font-normal">YTD</span></p>
        <div className="h-2 rounded-full bg-[rgba(153,197,255,0.08)] overflow-hidden mb-1">
          <div className={`h-full rounded-full transition-all ${threshPct > 85 ? "bg-amber-500" : "bg-[#1f48ff]"}`} style={{ width: `${threshPct}%` }} />
        </div>
        <p className="text-[10px] text-[rgba(153,197,255,0.35)]">{fmtV(threshold - ytdTurnover)} headroom remaining before mandatory registration</p>
      </GCard>

      {/* Simulator */}
      <GCard className="p-4 space-y-4">
        <SL>FRS vs standard VAT — quarterly comparison</SL>
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
function YearEndTab() {
  const [checked, setChecked] = useState({});
  const toggle = (k) => setChecked(p => ({ ...p, [k]: !p[k] }));

  const timeline = [
    { date: "7 Aug 2025",           title: "Q1 MTD Update — Submitted ✓",                      desc: "6 Apr – 5 Jul 2025. £14,210 income · £2,840 expenses.",                    status: "done"     },
    { date: "7 Nov 2025",           title: "Q2 MTD Update — Submitted ✓",                      desc: "6 Jul – 5 Oct 2025. £13,940 income · £2,780 expenses.",                    status: "done"     },
    { date: "5 Feb 2026",           title: "Q3 MTD Update — Submitted ✓",                      desc: "6 Oct – 5 Jan 2026. £13,670 income · £2,720 expenses.",                    status: "done"     },
    { date: "31 Jan 2026",          title: "2024/25 Final Paper SA — Submitted ✓",              desc: "Last traditional Self Assessment. Tax payment + Payment on Account paid.",   status: "done"     },
    { date: "6 Apr 2026",           title: "Tax Year 2026/27 Begins",                           desc: "MTD ITSA mandatory from April 2027 (income > £30k). Voluntary from now.",   status: "done"     },
    { date: "5 Aug 2026 · 115 days","title": "Q1 2026/27 MTD Update",                          desc: "6 Apr – 5 Jul 2026. In progress — 6 days of data logged.",                  status: "upcoming" },
    { date: "5 May 2027",           title: "Q4 2026/27 MTD Update",                            desc: "Final quarterly update for the 2026/27 tax year.",                          status: "future"   },
    { date: "31 Jan 2028",          title: "Final Declaration 2026/27",                        desc: "Replaces Self Assessment. Tax payment + 1st Payment on Account due.",        status: "future"   },
  ];

  const checklist = [
    { key: "income",    label: "All income logged for the quarter",         done: true  },
    { key: "receipts",  label: "All receipts scanned & categorised",        done: true  },
    { key: "mileage",   label: "Mileage log updated",                       done: false },
    { key: "van",       label: "Business use % confirmed for van",          done: false },
    { key: "aia",       label: "Capital equipment checked for AIA",         done: false },
    { key: "review",    label: "Figures reviewed before submitting",        done: false },
  ];

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
          <div className="relative pl-4">
            <div className="absolute left-[7px] top-2 bottom-2 w-px bg-[rgba(153,197,255,0.1)]" />
            {timeline.map(({ date, title, desc, status }) => (
              <div key={date} className="relative mb-4 ml-4">
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
            <SL className="mb-3">Payments on account — 31 Jan 2028</SL>
            <p className="text-[11px] text-[rgba(153,197,255,0.45)] leading-relaxed mb-3">
              If your tax bill exceeds £1,000, HMRC requires advance payments. Many first-time filers are caught off-guard — you pay 150% in January.
            </p>
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
  const [activeTab, setActiveTab] = useState("overview");

  const unpaidCount = invoices.filter(i => i.status !== "paid" && i.status !== "draft").length;

  const TABS = [
    { id: "overview",  label: "📊 Overview"      },
    { id: "hmrc",      label: "🏛️ HMRC Connect",  badge: "MTD" },
    { id: "invoices",  label: "🧾 Invoices",       badge: unpaidCount > 0 ? String(unpaidCount) : undefined },
    { id: "expenses",  label: "💸 Expenses"       },
    { id: "vat",       label: "🔢 VAT"             },
    { id: "tax-tools", label: "⚡ Tax Tools"       },
    { id: "year-end",  label: "📅 Year End"        },
  ];

  const panels = {
    overview:  <OverviewTab  setActiveTab={setActiveTab} />,
    hmrc:      <HmrcTab />,
    invoices:  <InvoiceRecordsTab />,
    expenses:  <ExpensesTab />,
    vat:       <VATTab />,
    "tax-tools": <TaxToolsTab setActiveTab={setActiveTab} />,
    "year-end":  <YearEndTab />,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#010a4f] via-[#05124a] to-[#0d1e78] relative">
      {/* Grid texture */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{ backgroundImage: "linear-gradient(rgba(153,197,255,0.5) 1px,transparent 1px),linear-gradient(90deg,rgba(153,197,255,0.5) 1px,transparent 1px)", backgroundSize: "32px 32px" }} />

      <div className="relative max-w-4xl mx-auto px-4 py-6 space-y-5">

        {/* Header */}
        <div>
          <SL className="mb-0.5">Cadi Accounts</SL>
          <h1 className="text-3xl font-black text-white">Accounts</h1>
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
