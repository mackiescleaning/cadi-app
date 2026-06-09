// src/pages/MoneyTracker.jsx
// Cadi — Money Tab v2
// AI money coach · bulk expense sorter · P&L by period · open banking ready

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import AskCadi from "../components/AskCadi";
import { createMoneyEntry, listMoneyEntries, updateMoneyEntry, deleteMoneyEntry } from "../lib/db/moneyDb";
import { listQuotes, updateQuoteStatus } from "../lib/db/quotesDb";
import { getBusinessSettings, upsertBusinessSettings } from "../lib/db/settingsDb";
import { logMileage, listMileageLogs, calcMileageAllowance, MILEAGE_RATE_HIGH, MILEAGE_RATE_LOW, MILEAGE_THRESHOLD } from "../lib/db/mileageDb";
import { calcSelfEmployedTax as sharedCalcSelfEmployedTax, calculateCT as sharedCalculateCT } from "../lib/taxCalc";
import { useAuth } from "../context/AuthContext";
import { useInvoices } from "../context/InvoiceContext";
import { supabase } from "../lib/supabase";

// ─── Expense categories (with HMRC MTD mapping) ───────────────────────────────
const EXPENSE_CATS = [
  { id: "fuel",         label: "Fuel & travel",    emoji: "⛽", hmrc: "travelCosts",              dot: "#f59e0b", pill: "bg-amber-500/15 border-amber-500/25 text-amber-300"    },
  { id: "supplies",     label: "Supplies",          emoji: "🧴", hmrc: "costOfGoodsBought",        dot: "#3b82f6", pill: "bg-blue-500/15 border-blue-500/25 text-blue-300"      },
  { id: "equipment",    label: "Equipment",         emoji: "🔧", hmrc: "maintenanceCosts",         dot: "#8b5cf6", pill: "bg-purple-500/15 border-purple-500/25 text-purple-300"},
  { id: "insurance",    label: "Insurance",         emoji: "🛡️", hmrc: "otherAllowableCharges",    dot: "#10b981", pill: "bg-emerald-500/15 border-emerald-500/25 text-emerald-300"},
  { id: "marketing",    label: "Marketing",         emoji: "📣", hmrc: "advertisingCosts",         dot: "#f43f5e", pill: "bg-rose-500/15 border-rose-500/25 text-rose-300"      },
  { id: "vehicle",      label: "Vehicle",           emoji: "🚐", hmrc: "maintenanceCosts",         dot: "#06b6d4", pill: "bg-cyan-500/15 border-cyan-500/25 text-cyan-300"      },
  { id: "staff",        label: "Staff costs",       emoji: "👥", hmrc: "staffCosts",               dot: "#ec4899", pill: "bg-pink-500/15 border-pink-500/25 text-pink-300"      },
  { id: "premises",     label: "Premises",          emoji: "🏢", hmrc: "premisesRunningCosts",     dot: "#14b8a6", pill: "bg-teal-500/15 border-teal-500/25 text-teal-300"      },
  { id: "professional", label: "Professional fees", emoji: "⚖️",  hmrc: "professionalFees",        dot: "#7c3aed", pill: "bg-violet-500/15 border-violet-500/25 text-violet-300"},
  { id: "other",        label: "Other",             emoji: "📦", hmrc: "otherAllowableCharges",    dot: "#6b7280", pill: "bg-gray-500/15 border-gray-500/25 text-gray-300"      },
];

const catById = (id) => EXPENSE_CATS.find(c => c.id === id) ?? EXPENSE_CATS[EXPENSE_CATS.length - 1];

// ─── Merchant auto-suggest ─────────────────────────────────────────────────────
const MERCHANT_RULES = [
  { re: /shell|bp |esso|texaco|total ?energ|gulf|jet |petrol|diesel|morrisons fuel|tesco fuel|asda fuel/i,     cat: "fuel"         },
  { re: /prochem|chemspec|jangro|bunzl|cleanline|selgros|initial clean|janitorial|cloths|mop |bleach|detergent|cleaning supply|hygiene supply/i, cat: "supplies"  },
  { re: /screwfix|toolstation|b&?q |wickes|machine mart|karcher|numatic|henry hoover|dyson|vacuum|tool /i,    cat: "equipment"    },
  { re: /amazon|ebay|aliexpress/i,                                                                             cat: "equipment"    },
  { re: /insurance|aviva|axa |zurich|allianz|direct ?line|hiscox|simply business|premierline|covea/i,         cat: "insurance"    },
  { re: /google ads|meta ads|facebook|instagram|mailchimp|checkatrade|rated people|bark\.com|yell |adverti/i, cat: "marketing"    },
  { re: /kwik ?fit|halfords|mot |tyres?|car servi|vehicl repai|autoparts|evans halshaw/i,                     cat: "vehicle"      },
  { re: /sage |xero |quickbooks|accountant|bookkeep|hmrc |companies house|freeagent|clearbooks/i,             cat: "professional" },
  { re: /rent |rates |council tax|electricity|gas |water board|thames water|british gas|eon |edf |npower|broadband|bt |virgin media/i, cat: "premises" },
  { re: /wages |salary|payroll|staff pay/i,                                                                    cat: "staff"        },
];

function suggestCategory(merchantName = "", description = "") {
  const text = `${merchantName} ${description}`;
  for (const { re, cat } of MERCHANT_RULES) {
    if (re.test(text)) return cat;
  }
  return null;
}

// Estimated tax saving using basic-rate flat (20% IT + 6% Class 4 NI).
// Accurate for cleaning business owners earning £12,570–£50,270 — the vast majority.
function quickTaxSaving(amount) {
  return Math.round(amount * 0.26 * 100) / 100;
}

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
  return <p className={`text-[10px] font-black tracking-[0.15em] uppercase text-[rgba(153,197,255,0.55)] ${className}`}>{children}</p>;
}

// ─── Open Banking Banner ──────────────────────────────────────────────────────
function OpenBankingBanner({ bankTxs = [], setBankTxs, onSyncComplete, onExpenseFromBank }) {
  const { user } = useAuth();
  const [connected,         setConnected]         = useState(false);
  const [status,            setStatus]            = useState(null); // full status object from yapily-auth
  const [loading,           setLoading]           = useState(false);
  const [syncing,           setSyncing]           = useState(false);
  const [error,             setError]             = useState(null);
  const [success,           setSuccess]           = useState(null);
  const [showTxs,           setShowTxs]           = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [showAllClear,      setShowAllClear]      = useState(false);
  const [reviewIdx,         setReviewIdx]         = useState(0); // which needs-review tx to show

  const tlInvoke = async (fn, body) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('Your session has expired. Please sign in again to connect your bank.');
    }
    const { data, error: e } = await supabase.functions.invoke(fn, {
      body,
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (e) { let m = e.message; try { const rb = await e.context?.json?.(); if (rb?.error) m = rb.error; } catch {} throw new Error(m); }
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const refreshStatus = useCallback(() => {
    if (!user || user.id === 'demo-user') return;
    tlInvoke('yapily-auth', { action: 'status' })
      .then(d => { setConnected(!!d.connected); setStatus(d); })
      .catch(() => {});
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { refreshStatus(); }, [refreshStatus]);

  // Bank picker lives at /banking/connect — has the trust-gate UI + institution
  // selection. Going there guarantees a valid institutionId is passed downstream.
  const handleConnect = () => {
    window.location.href = '/banking/connect';
  };

  const handleSync = async () => {
    setSyncing(true); setError(null); setSuccess(null);
    try {
      const res = await tlInvoke('yapily-api', { action: 'sync', force: true });
      if (res?.needsReauth) {
        setError('Bank consent has expired — please reconnect.');
        refreshStatus();
        return;
      }
      if (res?.skipped) {
        setSuccess(res.reason === 'throttled' ? 'Already synced recently. Try again in a few minutes.' : 'Sync skipped.');
      } else {
        setSuccess(`Imported ${res.imported} transactions from ${res.accounts} account${res.accounts !== 1 ? 's' : ''}.`);
      }
      const txRes = await tlInvoke('yapily-api', { action: 'transactions', days: 90 });
      const txs = txRes.transactions ?? [];
      setBankTxs(txs);
      setShowTxs(true);
      onSyncComplete?.(txs);
      refreshStatus();
    } catch (e) { setError(e.message); refreshStatus(); } finally { setSyncing(false); }
  };

  const handleDisconnect = async () => {
    try { await tlInvoke('yapily-auth', { action: 'disconnect' }); setConnected(false); setBankTxs([]); setShowTxs(false); setConfirmDisconnect(false); onSyncComplete?.([]); }
    catch (e) { setError(e.message); setConfirmDisconnect(false); }
  };

  // Merchant key matching the backend's logic — lets us locally propagate rules
  // to all matching transactions so the user sees the count drop immediately.
  const mKey = (s) => (s || '').toLowerCase().replace(/\s+\d[\d\s*]+$/, '').replace(/[^a-z0-9\s]/g, '').trim().split(/\s+/).slice(0, 3).join(' ');

  const handleCategorise = async (txId, isBusiness, category) => {
    try {
      const tx = bankTxs.find(t => t.id === txId);
      const tKey = mKey(tx?.merchant_name || tx?.description);
      await tlInvoke('yapily-api', { action: 'categorise', transactionId: txId, isBusiness, category });
      // Backend propagates the rule to all matching merchants — mirror it locally
      setBankTxs(prev => {
        const updated = prev.map(t => {
          if (t.id === txId) return { ...t, is_business: isBusiness, categorised_by: 'user', category };
          if (tKey && mKey(t.merchant_name || t.description) === tKey && t.categorised_by !== 'user') {
            return { ...t, is_business: isBusiness, categorised_by: 'user', category };
          }
          return t;
        });
        const remaining = updated.filter(t => t.is_business === null || (t.category === 'uncategorised' && t.categorised_by !== 'user')).length;
        if (remaining === 0) { setShowAllClear(true); setTimeout(() => setShowAllClear(false), 4000); }
        setReviewIdx(0);
        return updated;
      });
      if (isBusiness && tx && Number(tx.amount) < 0) {
        onExpenseFromBank?.({
          id: `bk-${txId}`,
          date: tx.transaction_date || tx.date,
          label: tx.merchant_name || tx.description || 'Expense',
          amount: Math.abs(Number(tx.amount)) || 0,
          category: category || 'other',
        });
      }
    } catch (e) { setError(e.message); }
  };

  // Bulk action: mark ALL remaining uncategorised as personal (clears the queue fast for
  // sandbox / one-off accounts). Fires one categorise call per tx — they all dedupe by merchant rule.
  const handleBulkMarkPersonal = async () => {
    const remaining = bankTxs.filter(t => t.is_business === null || (t.category === 'uncategorised' && t.categorised_by !== 'user'));
    if (!remaining.length) return;
    if (!confirm(`Mark all ${remaining.length} remaining transactions as personal? You can change individual ones later.`)) return;
    setSyncing(true); setError(null);
    try {
      // Batch in chunks of 8 to avoid overwhelming the function
      for (let i = 0; i < remaining.length; i += 8) {
        const batch = remaining.slice(i, i + 8);
        await Promise.all(batch.map(t =>
          tlInvoke('yapily-api', { action: 'categorise', transactionId: t.id, isBusiness: false, category: 'personal' })
            .catch(() => {})
        ));
      }
      setBankTxs(prev => prev.map(t =>
        (t.is_business === null || (t.category === 'uncategorised' && t.categorised_by !== 'user'))
          ? { ...t, is_business: false, categorised_by: 'user', category: 'personal' }
          : t
      ));
      setShowAllClear(true); setTimeout(() => setShowAllClear(false), 4000);
    } catch (e) { setError(e.message); } finally { setSyncing(false); }
  };

  // Derive review/personal flags from real schema (no needs_review column — derive from is_business + confidence)
  const needsReview = bankTxs.filter(t => t.is_business === null || (t.category === 'uncategorised' && t.categorised_by !== 'user'));
  const business    = bankTxs.filter(t => t.is_business === true);
  const personal    = bankTxs.filter(t => t.is_business === false);
  const personalTotal = personal.filter(t => Number(t.amount) < 0).reduce((s, t) => s + Math.abs(Number(t.amount)), 0);

  if (user?.id === 'demo-user') return null;

  return (
    <div className="fs-exclude rounded-2xl border border-[#1f48ff]/30 bg-gradient-to-r from-[#1f48ff]/10 via-[#1f48ff]/5 to-transparent overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-[#1f48ff]/60 via-[#99c5ff]/40 to-transparent" />
      <div className="p-4">
        <div className="flex items-center gap-3">
          <div className="shrink-0 w-10 h-10 rounded-xl bg-[#1f48ff]/20 border border-[#1f48ff]/30 flex items-center justify-center text-xl">🏦</div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-white">
              {connected ? 'Bank connected' : 'Connect your bank'}
              {connected && <span className="ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400">Live</span>}
            </p>
            <p className="text-xs text-[rgba(153,197,255,0.6)] mt-0.5">
              {connected ? 'Auto-import transactions · smart categorisation · real P&L' : 'Auto-import transactions · zero manual entry · real-time cash flow'}
            </p>
          </div>
          {connected && (
            confirmDisconnect ? (
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-[rgba(153,197,255,0.5)]">Keep transactions?</span>
                <button onClick={handleDisconnect} className="text-[10px] text-red-400 font-bold hover:text-red-300 transition-colors">Yes, disconnect</button>
                <button onClick={() => setConfirmDisconnect(false)} className="text-[10px] text-[rgba(153,197,255,0.4)] hover:text-white transition-colors">Cancel</button>
              </div>
            ) : (
              <button onClick={() => setConfirmDisconnect(true)} className="text-[10px] text-[rgba(153,197,255,0.4)] hover:text-red-400 transition-colors">Disconnect</button>
            )
          )}
        </div>

        {/* Connection health — tells the truth when something's wrong */}
        {connected && status && (
          (() => {
            const rel = (iso) => {
              if (!iso) return null;
              const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
              if (mins < 1)   return 'just now';
              if (mins < 60)  return `${mins} min${mins === 1 ? '' : 's'} ago`;
              const hrs = Math.floor(mins / 60);
              if (hrs < 24)   return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
              const days = Math.floor(hrs / 24);
              return `${days} day${days === 1 ? '' : 's'} ago`;
            };
            if (status.needsReauth) {
              return (
                <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/8 px-3 py-2 flex items-center justify-between gap-3">
                  <p className="text-xs text-amber-300"><strong>Bank consent expired.</strong> Reconnect to keep your data flowing.</p>
                  <button onClick={handleConnect} className="text-[10px] font-bold px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30 transition-colors shrink-0">Reconnect →</button>
                </div>
              );
            }
            if (status.reconsentDaysLeft !== null && status.reconsentDaysLeft !== undefined && status.reconsentDaysLeft <= 14) {
              return (
                <div className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/4 px-3 py-2 flex items-center justify-between gap-3">
                  <p className="text-xs text-amber-300/80">Bank consent expires in {status.reconsentDaysLeft} day{status.reconsentDaysLeft === 1 ? '' : 's'} — reconnect to avoid interruption.</p>
                  <button onClick={handleConnect} className="text-[10px] font-bold px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 hover:bg-amber-500/25 transition-colors shrink-0">Reconnect →</button>
                </div>
              );
            }
            if (status.syncError) {
              return (
                <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/8 px-3 py-2">
                  <p className="text-xs text-red-300"><strong>Last sync failed:</strong> {status.syncError}</p>
                  <p className="text-[10px] text-red-300/60 mt-0.5">Tried {rel(status.lastSyncErrorAt)}. Click "Sync transactions" to retry.</p>
                </div>
              );
            }
            if (status.lastSyncAt) {
              return (
                <p className="mt-2 text-[10px] text-[rgba(153,197,255,0.5)]">
                  Last synced {rel(status.lastSyncAt)}
                  {status.accountCount > 1 ? ` · ${status.accountCount} accounts` : ''}
                </p>
              );
            }
            return null;
          })()
        )}

        <div className="mt-3 flex gap-2 flex-wrap">
          {!connected ? (
            <button onClick={handleConnect} disabled={loading}
              className="px-4 py-2 rounded-xl bg-[#1f48ff] text-white text-xs font-bold hover:bg-[#1f48ff]/80 transition-all disabled:opacity-50">
              {loading ? 'Connecting…' : '🔗 Connect bank account'}
            </button>
          ) : (
            <button onClick={handleSync} disabled={syncing}
              className="px-4 py-2 rounded-xl bg-[rgba(153,197,255,0.12)] border border-[rgba(153,197,255,0.2)] text-[#99c5ff] text-xs font-bold hover:bg-[rgba(153,197,255,0.2)] transition-all disabled:opacity-50">
              {syncing ? 'Syncing…' : '↻ Sync transactions'}
            </button>
          )}
          {connected && bankTxs.length > 0 && (
            <button onClick={() => setShowTxs(v => !v)}
              className="px-4 py-2 rounded-xl bg-[rgba(153,197,255,0.06)] border border-[rgba(153,197,255,0.12)] text-[rgba(153,197,255,0.6)] text-xs font-bold hover:text-[#99c5ff] transition-all">
              {showTxs ? 'Hide' : 'View'} transactions ({bankTxs.length})
            </button>
          )}
        </div>

        {error   && <p className="mt-2 text-xs text-red-400">{error}</p>}
        {success && <p className="mt-2 text-xs text-emerald-400">{success}</p>}

        {/* Sync progress indicator */}
        {syncing && (
          <div className="mt-3 rounded-xl border border-[#1f48ff]/30 bg-[#1f48ff]/8 px-4 py-3">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#4f78ff] animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-[#4f78ff] animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-[#4f78ff] animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <p className="text-xs font-bold text-[#99c5ff]">Syncing your transactions…</p>
            </div>
            <p className="text-[10px] text-[rgba(153,197,255,0.5)] leading-relaxed">
              Pulling in your transactions, categorising them, and matching payments to invoices. This usually takes 10–30 seconds — hang tight.
            </p>
            <div className="mt-2.5 h-0.5 rounded-full bg-[rgba(153,197,255,0.1)] overflow-hidden">
              <div className="h-full rounded-full bg-[#4f78ff] animate-pulse" style={{ width: '60%' }} />
            </div>
          </div>
        )}

        {/* Summary pills */}
        {bankTxs.length > 0 && (
          <div className="mt-3 grid grid-cols-3 gap-2">
            {[
              { label: 'Business', value: business.length, color: 'text-emerald-400' },
              { label: 'Personal', value: personal.length, color: 'text-amber-400' },
              { label: 'Review', value: needsReview.length, color: needsReview.length > 0 ? 'text-red-400' : 'text-[rgba(153,197,255,0.4)]' },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-xl bg-[rgba(153,197,255,0.05)] border border-[rgba(153,197,255,0.08)] p-2 text-center">
                <p className={`text-base font-black ${color}`}>{value}</p>
                <p className="text-[10px] text-[rgba(153,197,255,0.4)]">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Personal spend insight */}
        {personalTotal > 0 && (
          <div className="mt-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <p className="text-xs text-amber-300 font-bold">💡 Personal spend this period: £{personalTotal.toFixed(2)}</p>
            <p className="text-[10px] text-amber-300/70 mt-0.5">Not included in your P&L — check none slipped through as business.</p>
          </div>
        )}
      </div>

      {/* ── Smart review stack ── */}
      {needsReview.length > 0 && (() => {
        const tx = needsReview[reviewIdx] ?? needsReview[0];
        const txAmount = Math.abs(Number(tx.amount));
        const txKey = mKey(tx.merchant_name || tx.description);
        const sameMerchantCount = needsReview.filter(t => mKey(t.merchant_name || t.description) === txKey).length;
        const suggested = suggestCategory(tx.merchant_name, tx.description);
        const saving = quickTaxSaving(txAmount);
        const catOptions = EXPENSE_CATS.filter(c => c.id !== 'other');
        const pendingCat = tx._pendingCat ?? suggested ?? 'other';
        const catObj = catById(pendingCat);
        const setPendingCat = (cat) => setBankTxs(prev => prev.map(t => t.id === tx.id ? { ...t, _pendingCat: cat } : t));
        return (
          <div className="border-t border-amber-500/25">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-amber-500/8">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
                <p className="text-xs font-black text-amber-300">{needsReview.length} transaction{needsReview.length !== 1 ? 's' : ''} to sort</p>
              </div>
              {needsReview.length > 1 && (
                <p className="text-[10px] text-[rgba(153,197,255,0.5)]">
                  {reviewIdx + 1} of {needsReview.length}
                </p>
              )}
            </div>

            {/* ── How-it-works explainer ── */}
            <div className="px-4 pt-3">
              <div className="rounded-xl bg-[#1f48ff]/8 border border-[#1f48ff]/20 p-3">
                <p className="text-xs font-bold text-[#99c5ff] mb-1">👋 Help me learn your spending</p>
                <p className="text-[11px] text-[rgba(153,197,255,0.7)] leading-relaxed">
                  Tap <span className="font-bold text-amber-300">Personal</span> or <span className="font-bold text-emerald-300">Business</span>. Once I see a merchant twice I'll handle the rest automatically — so this gets faster as you go.
                </p>
              </div>
            </div>

            {/* ── Bulk actions ── */}
            {needsReview.length > 10 && (
              <div className="px-4 pt-3">
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={handleBulkMarkPersonal}
                    disabled={syncing}
                    className="flex-1 px-3 py-2 rounded-xl border border-amber-500/30 bg-amber-500/8 text-amber-300 text-[11px] font-bold hover:bg-amber-500/15 transition-all disabled:opacity-50">
                    {syncing ? 'Sorting…' : `🚫 Mark all ${needsReview.length} as personal`}
                  </button>
                </div>
                <p className="text-[10px] text-[rgba(153,197,255,0.4)] mt-1.5 leading-relaxed">
                  Quick clean-up — you can still flip individual ones to business later.
                </p>
              </div>
            )}

            {/* Card */}
            <div className="px-4 py-4 space-y-3">
              {/* Transaction info */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-base font-black text-white leading-tight truncate">{tx.merchant_name || tx.description}</p>
                  <p className="text-xs text-[rgba(153,197,255,0.5)] mt-0.5">{tx.transaction_date || tx.date}</p>
                </div>
                <p className={`text-2xl font-black tabular-nums shrink-0 ${Number(tx.amount) > 0 ? 'text-emerald-400' : 'text-white'}`}>
                  {Number(tx.amount) < 0 ? '−' : '+'}£{txAmount.toFixed(2)}
                </p>
              </div>

              {/* Auto-suggested category pill */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-lg">{catObj.emoji}</span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${catObj.pill}`}>{catObj.label}</span>
                {suggested
                  ? <span className="text-[10px] text-emerald-400/70">✨ Cadi guessed this</span>
                  : <span className="text-[10px] text-[rgba(153,197,255,0.5)]">Pick a category if business</span>
                }
              </div>

              {/* Category grid */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[rgba(153,197,255,0.5)] mb-1.5">If business, which category?</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {catOptions.map(c => (
                    <button key={c.id} onClick={() => setPendingCat(c.id)}
                      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold border transition-all ${
                        pendingCat === c.id
                          ? 'bg-[#1f48ff]/20 border-[#1f48ff]/60 text-white'
                          : 'border-[rgba(153,197,255,0.12)] text-[rgba(153,197,255,0.75)] hover:border-[rgba(153,197,255,0.35)] hover:text-white hover:bg-[rgba(153,197,255,0.04)]'
                      }`}>
                      <span>{c.emoji}</span>{c.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tax saving hint */}
              <div className="text-center py-0.5">
                <p className="text-xs text-emerald-400/80">
                  If business → <span className="font-black text-emerald-400">saves ~£{saving.toFixed(2)}</span> in tax
                </p>
              </div>

              {/* Action buttons */}
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => handleCategorise(tx.id, false, 'personal')}
                  className="py-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-300 text-sm font-black hover:bg-amber-500/20 active:scale-95 transition-all flex items-center justify-center gap-2">
                  ✗ Personal
                </button>
                <button onClick={() => handleCategorise(tx.id, true, pendingCat)}
                  className="py-3 rounded-xl border border-emerald-500/30 bg-emerald-500/15 text-emerald-300 text-sm font-black hover:bg-emerald-500/25 active:scale-95 transition-all flex items-center justify-center gap-2">
                  ✓ Business
                </button>
              </div>

              {/* Merchant propagation hint */}
              {sameMerchantCount > 1 && (
                <p className="text-[10px] text-center text-[#99c5ff]/70 leading-relaxed">
                  💡 You have {sameMerchantCount} transactions from this merchant — categorising one will sort them all.
                </p>
              )}

              {/* Skip button */}
              {needsReview.length > 1 && (
                <button
                  onClick={() => setReviewIdx(i => (i + 1) % needsReview.length)}
                  className="w-full py-2 text-[10px] text-[rgba(153,197,255,0.5)] hover:text-white font-semibold transition-colors">
                  ↷ Skip for now
                </button>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── All clear celebration ── */}
      {showAllClear && (
        <div className="border-t border-emerald-500/20 bg-emerald-500/5 px-4 py-5 text-center">
          <p className="text-3xl mb-2">🎉</p>
          <p className="text-sm font-black text-emerald-400">All caught up!</p>
          <p className="text-xs text-[rgba(153,197,255,0.55)] mt-1">Every transaction sorted. Your P&L is fully up to date.</p>
        </div>
      )}

      {/* ── Browse all transactions toggle ── */}
      {connected && bankTxs.length > 0 && needsReview.length === 0 && !showAllClear && (
        <div className="border-t border-[rgba(153,197,255,0.06)]">
          <button onClick={() => setShowTxs(v => !v)}
            className="w-full px-4 py-2.5 text-[11px] text-[rgba(153,197,255,0.4)] hover:text-[#99c5ff] font-semibold transition-colors flex items-center justify-center gap-1.5">
            {showTxs ? '↑ Hide' : '↓ Browse all'} transactions ({bankTxs.length})
          </button>
          {showTxs && (
            <div className="max-h-80 overflow-y-auto border-t border-[rgba(153,197,255,0.06)]">
              {bankTxs.map(tx => {
                const catObj = catById(tx.category);
                return (
                  <div key={tx.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-[rgba(153,197,255,0.04)] last:border-0">
                    <span className="text-base shrink-0">{catObj.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white font-semibold truncate">{tx.merchant_name || tx.description}</p>
                      <p className="text-[10px] text-[rgba(153,197,255,0.35)]">{tx.transaction_date || tx.date} · {catObj.label}</p>
                    </div>
                    <p className={`text-xs font-bold shrink-0 ${Number(tx.amount) > 0 ? 'text-emerald-400' : 'text-white'}`}>
                      {Number(tx.amount) < 0 ? '−' : '+'}£{Math.abs(Number(tx.amount)).toFixed(2)}
                    </p>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${tx.is_business ? 'text-emerald-400 bg-emerald-500/10' : 'text-amber-400 bg-amber-500/10'}`}>
                      {tx.is_business ? 'Biz' : 'Personal'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
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
  const effectiveTaxRate = accounts.ytdIncome > 0 ? accounts.taxReserveTarget / accounts.ytdIncome : 0;
  const taxAside = Math.round(hero.value * effectiveTaxRate);

  return (
    <GCard className="fs-exclude p-5">
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
          <p className="text-xs text-[rgba(153,197,255,0.55)] mt-1">{hero.sub}</p>
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
            { label: "Gross",     val: fmt(hero.value),                               color: "text-white"       },
            { label: "Tax (est.)", val: taxAside > 0 ? `-${fmt(taxAside)}` : "£0", color: taxAside > 0 ? "text-amber-400" : "text-emerald-400" },
            { label: "Available", val: fmt(hero.value - taxAside),                    color: "text-emerald-400" },
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
// ─── Monthly Report ───────────────────────────────────────────────────────────
function MonthlyReport({ monthlyData, expenses, accounts }) {
  const curr = monthlyData.find(m => m.isCurrent) ?? { income: 0, expenses: 0 };
  const prev = monthlyData.filter(m => !m.isCurrent).at(-1) ?? { income: 0, expenses: 0 };

  if (curr.income === 0 && curr.expenses === 0) return null;

  const now         = new Date();
  const monthName   = now.toLocaleDateString("en-GB", { month: "long" });
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysGone    = now.getDate();
  const daysLeft    = daysInMonth - daysGone;
  const profit      = curr.income - curr.expenses;
  const vsLast      = curr.income - prev.income;
  const vsLastPct   = prev.income > 0 ? vsLast / prev.income : 0;
  const onPace      = daysGone > 0 ? Math.round(curr.income / daysGone * daysInMonth) : curr.income;

  // Top expense category from actual expense list
  const catSpend = {};
  expenses.forEach(e => { if (e.category) catSpend[e.category] = (catSpend[e.category] || 0) + Number(e.amount); });
  const topCat    = Object.entries(catSpend).sort((a,b) => b[1]-a[1])[0];
  const topCatObj = topCat ? catById(topCat[0]) : null;

  // Annual target: sum all months / target
  const ytdIncome      = monthlyData.reduce((s,m) => s + m.income, 0);
  const targetProgress = accounts.annualTarget > 0 ? ytdIncome / accounts.annualTarget : null;

  // Plain-English narrative
  const sentences = [];
  if (daysLeft > 0) {
    if (vsLast > 50)  sentences.push(`${monthName} is already ${fmtPct(Math.abs(vsLastPct) * 100)} ahead of ${prev.month ?? "last month"} with ${daysLeft} day${daysLeft !== 1 ? "s" : ""} still to go.`);
    else if (vsLast < -50) sentences.push(`${monthName} is ${fmtPct(Math.abs(vsLastPct) * 100)} behind ${prev.month ?? "last month"} with ${daysLeft} day${daysLeft !== 1 ? "s" : ""} to turn it around.`);
    else sentences.push(`${monthName} is ${daysGone} days in — you've brought in ${fmt(curr.income)} so far.`);
  } else {
    sentences.push(`${monthName} closed with ${fmt(curr.income)} income.`);
  }

  if (curr.expenses > 0 && curr.income > 0) {
    sentences.push(`Expenses came to ${fmt(curr.expenses)} (${fmtPct(curr.expenses / curr.income * 100)} of income), leaving ${fmt(profit)} profit.`);
  }

  if (topCatObj && topCat[1] > 0) {
    sentences.push(`Biggest cost: ${topCatObj.label.toLowerCase()} at ${fmt(topCat[1])}.`);
  }

  if (targetProgress !== null) {
    sentences.push(`You're ${fmtPct(targetProgress * 100)} toward your ${fmt(accounts.annualTarget)} annual target.`);
  }

  return (
    <GCard className="fs-exclude p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <SectionLabel>{monthName} {now.getFullYear()}</SectionLabel>
          <p className="text-sm font-black text-white mt-0.5">Month in review</p>
        </div>
        <span className="text-2xl">📊</span>
      </div>

      <p className="text-sm text-[rgba(153,197,255,0.8)] leading-relaxed">{sentences.join(" ")}</p>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {[
          { label: "Income",   value: fmt(curr.income),   color: "text-emerald-400" },
          { label: "Expenses", value: fmt(curr.expenses), color: "text-amber-400"   },
          { label: "Kept",     value: fmt(profit),        color: profit >= 0 ? "text-white" : "text-red-400" },
        ].map(({ label, value, color }) => (
          <div key={label} className="text-center p-2 rounded-xl bg-[rgba(153,197,255,0.04)] border border-[rgba(153,197,255,0.08)]">
            <p className="text-[9px] font-bold tracking-wider uppercase text-[rgba(153,197,255,0.35)] mb-1">{label}</p>
            <p className={`text-sm font-black tabular-nums ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {targetProgress !== null && (
        <div className="mt-4">
          <div className="flex justify-between text-[10px] text-[rgba(153,197,255,0.4)] mb-1.5">
            <span>Annual target progress</span>
            <span>{fmt(ytdIncome)} of {fmt(accounts.annualTarget)}</span>
          </div>
          <div className="h-2 rounded-full bg-[rgba(153,197,255,0.08)] overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#1f48ff] to-[#99c5ff] transition-all duration-700"
              style={{ width: `${Math.min(targetProgress * 100, 100)}%` }}
            />
          </div>
        </div>
      )}

      {daysLeft > 0 && curr.income > 0 && (
        <p className="mt-3 text-[10px] text-[rgba(153,197,255,0.35)]">
          {daysLeft} day{daysLeft !== 1 ? "s" : ""} left in {monthName} · on pace for {fmt(onPace)}
        </p>
      )}
    </GCard>
  );
}

// ─── P&L Waterfall ────────────────────────────────────────────────────────────
function PnLWaterfall({ period, monthlyData, weekRevenue, weekExpenses, dayIncome, dayExpenses, accounts = {} }) {
  const isLtd   = accounts.entityType === 'limited_company';
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

  const d = dataMap[period] ?? dataMap.Month;

  // Ltd: CT is levied on profit (income − expenses), not on gross income
  // Sole trader: simple 20% income tax reserve on gross (NI handled separately)
  const preTaxProfit = Math.max(0, d.income - d.expenses);
  const tax          = isLtd ? calcCorpTax(preTaxProfit) : Math.round(d.income * 0.20);
  const taxLabel     = isLtd ? "Corp. tax" : "Tax reserve";
  const profitLabel  = isLtd ? "Retained" : "Take-home";
  const taxRateStat  = isLtd
    ? (preTaxProfit <= 50000 ? "19% CT" : preTaxProfit >= 250000 ? "25% CT" : "Marginal CT")
    : "20% IT est.";

  const profit  = Math.max(d.income - d.expenses - tax, 0);
  const retPct  = d.income > 0 ? Math.round((profit / d.income) * 100) : 0;
  const maxBar  = d.income;

  const rows = [
    { label: "Gross income",  val: d.income,    bar: 100,                                             color: "bg-[#1f48ff]",   text: "text-[#99c5ff]",   sign: "" },
    { label: "Expenses",      val: d.expenses,  bar: d.income > 0 ? (d.expenses / maxBar) * 100 : 0, color: "bg-rose-500",    text: "text-rose-400",    sign: "−" },
    { label: taxLabel,        val: tax,         bar: d.income > 0 ? (tax / maxBar) * 100 : 0,        color: "bg-amber-400",   text: "text-amber-400",   sign: "−" },
    { label: profitLabel,     val: profit,      bar: d.income > 0 ? (profit / maxBar) * 100 : 0,     color: "bg-emerald-400", text: "text-emerald-400", sign: "", bold: true },
  ];

  // 6-month chart
  const maxM = Math.max(...monthlyData.map(m => m.income), 1);

  return (
    <GCard className="fs-exclude overflow-hidden">
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
                { label: "Tax rate",      val: taxRateStat, good: true },
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
        <span className="text-xs text-[rgba(153,197,255,0.55)]">{fmt(total)} scheduled · {weekData.reduce((s,d)=>s+d.jobs,0)} jobs</span>
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

function ExpenseSorter({ expenses, onAdd, onBulkCategorize, onBulkDelete, bankConnected = false, onRecategorizeBankExpense }) {
  const [catFilter,   setCatFilter]   = useState("all");
  const [sortBy,      setSortBy]      = useState("recent");
  const [selected,    setSelected]    = useState(new Set());
  const [showAdd,     setShowAdd]     = useState(false);
  const [bulkCat,     setBulkCat]     = useState(null);
  const [expandedId,  setExpandedId]  = useState(null); // inline category picker

  const filtered = useMemo(() => {
    let list = catFilter === "all" ? expenses : expenses.filter(e => e.category === catFilter);
    if (sortBy === "amount") list = [...list].sort((a, b) => b.amount - a.amount);
    else if (sortBy === "category") list = [...list].sort((a, b) => a.category.localeCompare(b.category));
    else list = [...list].sort((a, b) => new Date(b.date) - new Date(a.date));
    return list;
  }, [expenses, catFilter, sortBy]);

  const totalFiltered = filtered.reduce((s,e) => s + Number(e.amount), 0);
  const allSelected   = filtered.length > 0 && filtered.every(e => selected.has(e.id));

  const bankCount  = expenses.filter(e => String(e.id).startsWith("bk-")).length;
  const manualCount = expenses.length - bankCount;

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
            {topCat ? (
              <p className="text-[10px] text-[rgba(153,197,255,0.4)] mt-0.5">
                Biggest: {catById(topCat[0]).emoji} {catById(topCat[0]).label} — {fmt(topCat[1])}
                {bankCount > 0 && <span className="ml-1.5 text-[#99c5ff]/50">· {bankCount} from bank</span>}
              </p>
            ) : bankConnected ? (
              <p className="text-[10px] text-[#99c5ff]/50 mt-0.5">🏦 Bank connected — business debits auto-imported</p>
            ) : null}
          </div>
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1f48ff]/20 border border-[#1f48ff]/40 text-xs font-black text-white hover:bg-[#1f48ff]/35 transition-colors">
            + Add expense
          </button>
        </div>

        {/* Category spend pills */}
        {expenses.length > 0 && (
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
        )}

        {/* Sort + bulk actions row */}
        {expenses.length > 0 && (
          <div className="px-4 py-2 border-y border-[rgba(153,197,255,0.06)] flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
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
        )}

        {/* Expense rows */}
        <div className="divide-y divide-[rgba(153,197,255,0.05)] max-h-80 overflow-y-auto">
          {expenses.length === 0 && catFilter === "all" ? (
            /* ── True empty state ── */
            <div className="py-10 px-6 text-center">
              <div className="w-12 h-12 rounded-2xl bg-[#1f48ff]/15 border border-[#1f48ff]/25 flex items-center justify-center text-2xl mx-auto mb-3">🏦</div>
              <p className="text-sm font-black text-white mb-1">No expenses yet</p>
              {!bankConnected ? (
                <>
                  <p className="text-xs text-[rgba(153,197,255,0.55)] leading-relaxed mb-3">
                    Connect your bank above and business spending is imported automatically — sorted, categorised, and ready for your P&L.
                  </p>
                  <p className="text-[10px] text-[rgba(153,197,255,0.25)]">Or tap "+ Add expense" to log one manually.</p>
                </>
              ) : (
                <p className="text-xs text-[rgba(153,197,255,0.55)] leading-relaxed">
                  Business debits from your connected bank will appear here as they come in. You can also add expenses manually.
                </p>
              )}
            </div>
          ) : filtered.length === 0 ? (
            /* ── Filtered to nothing ── */
            <div className="py-6 text-center">
              <p className="text-xs text-[rgba(153,197,255,0.3)]">No expenses in this category</p>
            </div>
          ) : (
            filtered.map(e => {
              const cat        = catById(e.category);
              const isSelected = selected.has(e.id);
              const isBank     = String(e.id).startsWith("bk-");
              const isExpanded = expandedId === e.id;
              return (
                <div key={e.id}>
                  <div className={`flex items-center gap-3 px-4 py-3 transition-colors ${isSelected ? "bg-[#1f48ff]/10" : "hover:bg-[rgba(153,197,255,0.03)]"}`}>
                    {/* Checkbox */}
                    <button onClick={() => toggleSelect(e.id)}
                      className={`w-4 h-4 rounded border flex items-center justify-center text-[8px] transition-all shrink-0 ${
                        isSelected ? "bg-[#1f48ff] border-[#1f48ff] text-white" : "border-[rgba(153,197,255,0.15)] text-[rgba(153,197,255,0.4)]"
                      }`}>
                      {isSelected ? "✓" : ""}
                    </button>
                    {/* Source dot */}
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cat.dot }} />
                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <p className="text-xs font-bold text-white truncate">{e.label}</p>
                        {isBank && (
                          <span className="shrink-0 text-[8px] font-black px-1.5 py-0.5 rounded-full bg-[#1f48ff]/15 border border-[#1f48ff]/25 text-[#99c5ff]">
                            🏦
                          </span>
                        )}
                      </div>
                      {/* Category row — tappable for bank expenses to open recategorize picker */}
                      <button
                        onClick={() => isBank && onRecategorizeBankExpense && setExpandedId(isExpanded ? null : e.id)}
                        className={`text-left text-[10px] text-[rgba(153,197,255,0.4)] mt-0.5 ${isBank && onRecategorizeBankExpense ? "hover:text-[#99c5ff] transition-colors" : "cursor-default"}`}
                      >
                        {new Date(e.date).toLocaleDateString("en-GB", { day:"numeric", month:"short" })} · {cat.emoji} {cat.label}
                        {isBank && onRecategorizeBankExpense && (
                          <span className="ml-1 opacity-40">{isExpanded ? "▲" : "▼"}</span>
                        )}
                      </button>
                    </div>
                    <p className="text-sm font-black text-[rgba(153,197,255,0.8)] tabular-nums shrink-0">{fmt2(e.amount)}</p>
                  </div>

                  {/* ── Inline category picker (bank expenses only) ── */}
                  {isExpanded && isBank && (
                    <div className="px-4 pb-3 pt-2 border-t border-[rgba(153,197,255,0.06)] bg-[rgba(153,197,255,0.02)]">
                      <p className="text-[9px] font-black tracking-wider uppercase text-[rgba(153,197,255,0.3)] mb-2">Change category</p>
                      <div className="grid grid-cols-2 gap-1.5">
                        {EXPENSE_CATS.map(c => (
                          <button key={c.id} onClick={() => {
                            onRecategorizeBankExpense(e.id, c.id);
                            setExpandedId(null);
                          }}
                            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold border transition-all ${
                              e.category === c.id
                                ? "bg-[#1f48ff]/20 border-[#1f48ff]/50 text-[#99c5ff]"
                                : "border-[rgba(153,197,255,0.06)] text-[rgba(153,197,255,0.3)] hover:border-[rgba(153,197,255,0.2)] hover:text-[rgba(153,197,255,0.6)]"
                            }`}>
                            <span>{c.emoji}</span>{c.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
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
  const curr     = monthlyData.find(m => m.isCurrent) ?? { income: 0 };
  const prev     = monthlyData.filter(m => !m.isCurrent).at(-1) ?? { income: 1 };

  // Real YTD income from actual transaction data (not stale settings value)
  const ytdIncome    = monthlyData.reduce((s, m) => s + m.income, 0);
  const monthlyTarget = accounts.annualTarget > 0 ? Math.round(accounts.annualTarget / 12) : 0;
  const monthPct     = monthlyTarget > 0 ? Math.round((curr.income / monthlyTarget) * 100) : 0;
  const ytdPct       = Math.round((ytdIncome / Math.max(accounts.annualTarget, 1)) * 100);
  const remaining    = Math.max(accounts.annualTarget - ytdIncome, 0);

  // Tax year months left (UK: April–March)
  const taxMonth   = (() => { const m = new Date().getMonth(); return m >= 3 ? m - 3 + 1 : m + 9 + 1; })();
  const monthsLeft = Math.max(1, 12 - taxMonth);
  const needed     = Math.round(remaining / monthsLeft);

  // Monthly pacing: how much per day to hit target, vs actual daily average so far
  const now          = new Date();
  const daysInMonth  = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysGone     = now.getDate();
  const daysLeft     = daysInMonth - daysGone;
  const dailyNeeded  = monthlyTarget > 0 ? Math.round((monthlyTarget - curr.income) / Math.max(daysLeft, 1)) : 0;
  const onPace       = daysGone > 0 ? Math.round((curr.income / daysGone) * daysInMonth) : 0;
  const aheadOfPace  = monthlyTarget > 0 && onPace >= monthlyTarget;

  const beatingMonth = curr.income > prev.income;
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

        {/* ── Monthly target — live progress ── */}
        <div className="rounded-xl border border-[rgba(153,197,255,0.1)] bg-[rgba(153,197,255,0.03)] p-4">
          <div className="flex items-end justify-between mb-3">
            <div>
              <p className="text-[10px] font-black tracking-widest uppercase text-[rgba(153,197,255,0.35)] mb-1">
                {now.toLocaleDateString("en-GB", { month: "long" })} target
              </p>
              <div className="flex items-baseline gap-1.5">
                <p className="text-2xl font-black text-white tabular-nums">{fmt(curr.income)}</p>
                <p className="text-sm text-[rgba(153,197,255,0.4)]">of {fmt(monthlyTarget)}</p>
              </div>
            </div>
            <div className="text-right">
              <p className={`text-3xl font-black tabular-nums ${monthPct >= 100 ? "text-emerald-400" : monthPct >= 70 ? "text-[#99c5ff]" : "text-white"}`}>
                {monthPct}%
              </p>
            </div>
          </div>

          {/* Thick progress bar */}
          <div className="relative h-4 bg-[rgba(153,197,255,0.06)] rounded-full overflow-hidden mb-2">
            <div
              className={`h-full rounded-full transition-all duration-700 ${monthPct >= 100 ? "bg-emerald-400" : "bg-gradient-to-r from-[#1f48ff] to-[#99c5ff]"}`}
              style={{ width: `${Math.min(monthPct, 100)}%` }}
            />
            {/* Pace marker */}
            {daysGone > 0 && daysGone < daysInMonth && (
              <div
                className="absolute top-0 w-0.5 h-full bg-white/30"
                style={{ left: `${Math.min((daysGone / daysInMonth) * 100, 99)}%` }}
              />
            )}
          </div>

          {/* Pacing status */}
          <div className="flex justify-between items-center">
            <p className={`text-[10px] font-bold ${aheadOfPace ? "text-emerald-400" : dailyNeeded > 0 ? "text-amber-400" : "text-[rgba(153,197,255,0.4)]"}`}>
              {monthPct >= 100
                ? `✓ Target hit! ${fmt(curr.income - monthlyTarget)} over`
                : aheadOfPace
                  ? `On pace for ${fmt(onPace)} 🚀`
                  : dailyNeeded > 0
                    ? `Need ${fmt(dailyNeeded)}/day to hit target`
                    : "Log income to track progress"}
            </p>
            <p className="text-[10px] text-[rgba(153,197,255,0.3)]">{daysLeft}d left</p>
          </div>
        </div>

        {/* ── Annual target ── */}
        <div>
          <div className="flex justify-between items-end mb-2">
            <div>
              <p className="text-[10px] font-black tracking-widest uppercase text-[rgba(153,197,255,0.35)] mb-0.5">
                Annual target {(() => { const y = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1; return `${y}/${(y+1).toString().slice(2)}`; })()}
              </p>
              <div className="flex items-baseline gap-1.5">
                <p className="text-xl font-black text-white tabular-nums">{fmt(ytdIncome)}</p>
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
            {(() => { const y = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1; const q = Math.floor(now.getMonth() / 3) + 1; return <><span>Apr {y}</span><span>Q{q} now</span><span>Mar {y+1}</span></>; })()}
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

        {/* Achievement badges */}
        <div className="flex flex-wrap gap-2">
          {beatingMonth && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <span className="text-xs">🔥</span>
              <span className="text-[10px] font-black text-emerald-400">Beating last month</span>
            </div>
          )}
          {monthPct >= 100 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <span className="text-xs">🎯</span>
              <span className="text-[10px] font-black text-emerald-400">Monthly target hit!</span>
            </div>
          )}
          {monthPct >= 50 && monthPct < 100 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1f48ff]/10 border border-[#1f48ff]/20">
              <span className="text-xs">⚡</span>
              <span className="text-[10px] font-black text-[#99c5ff]">Halfway there</span>
            </div>
          )}
          {aheadOfPace && monthPct < 100 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1f48ff]/10 border border-[#1f48ff]/20">
              <span className="text-xs">🚀</span>
              <span className="text-[10px] font-black text-[#99c5ff]">Ahead of pace</span>
            </div>
          )}
          {streak > 1 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20">
              <span className="text-xs">📅</span>
              <span className="text-[10px] font-black text-amber-400">{streak}-day streak</span>
            </div>
          )}
          {accounts.taxReserve >= accounts.taxReserveTarget && accounts.taxReserveTarget > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20">
              <span className="text-xs">🏦</span>
              <span className="text-[10px] font-black text-purple-400">Tax fully covered</span>
            </div>
          )}
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
            {curr.income >= prev.income
              ? `✓ Achieved! +${fmt(curr.income - prev.income)}`
              : `${fmt(Math.max(prev.income - curr.income, 0))} to go — you've got this 💪`}
          </p>
        </div>

      </div>
    </GCard>
  );
}

// ─── Tax Estimate ─────────────────────────────────────────────────────────────
// Delegates to shared lib (src/lib/taxCalc.js) so Money + Accounts always agree.
const calcSelfEmployedTax = sharedCalcSelfEmployedTax;

// Months remaining in current UK tax year (ends 5 April)
function taxYearMonthsLeft() {
  const now = new Date();
  const endYear = now.getMonth() >= 3 ? now.getFullYear() + 1 : now.getFullYear();
  const taxEnd  = new Date(endYear, 3, 5);
  return Math.max(1, Math.ceil((taxEnd - now) / (30.44 * 24 * 60 * 60 * 1000)));
}

const ALLOWABLE_CATS = ["fuel", "supplies", "equipment", "insurance", "marketing", "vehicle", "other"];

function TaxEstimate({ monthlyData, expenses, accounts }) {
  const [expanded, setExpanded] = useState(false);

  const ytdIncome = monthlyData.reduce((s, m) => s + m.income, 0);
  if (ytdIncome === 0) return null;

  // Tally allowable expenses by category
  const catTotals = {};
  ALLOWABLE_CATS.forEach(c => { catTotals[c] = 0; });
  expenses.forEach(e => {
    const cat = e.category ?? "other";
    if (ALLOWABLE_CATS.includes(cat)) catTotals[cat] = (catTotals[cat] || 0) + Number(e.amount);
  });
  const totalAllowable = Object.values(catTotals).reduce((s, v) => s + v, 0);
  const taxableProfit  = Math.max(ytdIncome - totalAllowable, 0);
  const { incomeTax, ni, total: totalTax } = calcSelfEmployedTax(taxableProfit);

  const reserved   = accounts.taxReserve ?? 0;
  const shortfall  = Math.max(totalTax - reserved, 0);
  const monthsLeft = taxYearMonthsLeft();
  const monthlySetAside = shortfall > 0 ? Math.ceil(shortfall / monthsLeft) : 0;

  const topCats = Object.entries(catTotals)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);
  const maxCatVal = topCats[0]?.[1] ?? 1;

  return (
    <GCard className="fs-exclude overflow-hidden">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full px-4 py-3 border-b border-[rgba(153,197,255,0.08)] flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-base">🧾</span>
          <div>
            <SectionLabel>Tax estimate · {(() => { const now = new Date(); const y = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1; return `${y}/${(y+1).toString().slice(2)}`; })()}</SectionLabel>
            <p className="text-xs text-white font-bold mt-0.5">
              {shortfall > 0
                ? `Set aside ${fmt(monthlySetAside)}/mo · ${monthsLeft} month${monthsLeft !== 1 ? "s" : ""} left`
                : "Tax pot fully covered ✓"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <p className={`text-xl font-black tabular-nums ${shortfall > 0 ? "text-amber-400" : "text-emerald-400"}`}>{fmt(totalTax)}</p>
          <span className="text-[rgba(153,197,255,0.4)] text-xs">{expanded ? "▲" : "▼"}</span>
        </div>
      </button>

      {/* Collapsed summary strip */}
      {!expanded && (
        <div className="px-4 py-3 grid grid-cols-3 gap-2">
          {[
            { label: "Income YTD",    value: fmt(ytdIncome),      color: "text-emerald-400" },
            { label: "Deductions",    value: fmt(totalAllowable), color: "text-[#99c5ff]"   },
            { label: "Taxable profit",value: fmt(taxableProfit),  color: "text-white"       },
          ].map(({ label, value, color }) => (
            <div key={label} className="text-center p-2 rounded-xl bg-[rgba(153,197,255,0.04)] border border-[rgba(153,197,255,0.08)]">
              <p className="text-[9px] font-bold tracking-wider uppercase text-[rgba(153,197,255,0.35)] mb-1">{label}</p>
              <p className={`text-xs font-black tabular-nums ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Expanded breakdown */}
      {expanded && (
        <div className="p-4 space-y-4">

          {/* Income vs deductions */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/15">
              <p className="text-[9px] font-black tracking-widest uppercase text-emerald-500/60 mb-1">Income YTD</p>
              <p className="text-lg font-black text-emerald-400 tabular-nums">{fmt(ytdIncome)}</p>
            </div>
            <div className="p-3 rounded-xl bg-[#1f48ff]/5 border border-[#1f48ff]/15">
              <p className="text-[9px] font-black tracking-widest uppercase text-[#99c5ff]/60 mb-1">Allowable expenses</p>
              <p className="text-lg font-black text-[#99c5ff] tabular-nums">−{fmt(totalAllowable)}</p>
            </div>
          </div>

          {/* Expense category breakdown */}
          {topCats.length > 0 && (
            <div className="space-y-2">
              <p className="text-[9px] font-black tracking-widest uppercase text-[rgba(153,197,255,0.35)]">Allowable deductions</p>
              {topCats.map(([cat, val]) => {
                const obj = catById(cat);
                return (
                  <div key={cat} className="flex items-center gap-2">
                    <span className="text-sm w-5 shrink-0">{obj.emoji}</span>
                    <p className="text-xs text-[rgba(153,197,255,0.6)] w-20 shrink-0">{obj.label}</p>
                    <div className="flex-1 h-1.5 rounded-full bg-[rgba(153,197,255,0.06)] overflow-hidden">
                      <div className="h-full rounded-full bg-[#1f48ff]/60 transition-all" style={{ width: `${(val / maxCatVal) * 100}%` }} />
                    </div>
                    <p className="text-xs font-bold text-white tabular-nums shrink-0 w-14 text-right">{fmt(val)}</p>
                  </div>
                );
              })}
            </div>
          )}

          {/* Taxable profit → tax */}
          <div className="rounded-xl border border-[rgba(153,197,255,0.1)] bg-[rgba(153,197,255,0.03)] p-3 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-[rgba(153,197,255,0.5)]">Taxable profit</span>
              <span className="font-bold text-white">{fmt(taxableProfit)}</span>
            </div>
            <div className="flex justify-between text-xs border-t border-[rgba(153,197,255,0.06)] pt-2">
              <span className="text-[rgba(153,197,255,0.5)]">Income tax (20%)</span>
              <span className="font-bold text-amber-400">{fmt(incomeTax)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-[rgba(153,197,255,0.5)]">Class 4 NI (6%)</span>
              <span className="font-bold text-amber-400">{fmt(ni)}</span>
            </div>
            <div className="flex justify-between text-sm border-t border-[rgba(153,197,255,0.1)] pt-2">
              <span className="font-black text-white">Total tax bill</span>
              <span className="font-black text-amber-400">{fmt(totalTax)}</span>
            </div>
          </div>

          {/* Tax pot status */}
          <div>
            <div className="flex justify-between text-[10px] text-[rgba(153,197,255,0.4)] mb-1.5">
              <span>Tax pot</span>
              <span>{fmt(reserved)} saved of {fmt(totalTax)} needed</span>
            </div>
            <div className="h-2 rounded-full bg-[rgba(153,197,255,0.08)] overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${reserved >= totalTax ? "bg-emerald-400" : "bg-amber-400"}`}
                style={{ width: `${Math.min((reserved / Math.max(totalTax, 1)) * 100, 100)}%` }}
              />
            </div>
            {shortfall > 0 && (
              <p className="mt-2 text-[10px] text-amber-400">
                Set aside {fmt(monthlySetAside)}/month for the next {monthsLeft} month{monthsLeft !== 1 ? "s" : ""} to cover your bill.
              </p>
            )}
          </div>

          <p className="text-[9px] text-[rgba(153,197,255,0.25)] leading-relaxed">
            Estimate based on 2025/26 UK rates. Personal allowance £12,570, basic rate 20%, Class 4 NI 6%. Based on income and expenses recorded in Cadi. Consult an accountant for your final return.
          </p>
        </div>
      )}
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
                { l: "Suggested tax reserve", v: `−${fmt2(parseFloat(amount)*0.26)}`, c: "text-amber-400"  },
                { l: "Available to spend",    v: fmt2(parseFloat(amount)*0.74),       c: "text-white font-black" },
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
        <p className="text-4xl mb-3">📋</p>
        <p className="text-lg font-black text-white mb-1">Message copied</p>
        <p className="text-sm text-[rgba(153,197,255,0.5)] mb-6">Paste it into WhatsApp, email, or text to send to {invoice?.customer}.</p>
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
            <button onClick={() => { navigator.clipboard?.writeText(msg).catch(() => {}); setSent(true); }} className="flex-1 py-3 rounded-xl bg-[#1f48ff] text-white text-xs font-black hover:bg-[#3a5eff] transition-colors">
              📋 Copy message
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

// ─── Corp tax helper — delegates to shared lib so Money + Accounts agree ─────
const calcCorpTax = sharedCalculateCT;

// Return the next upcoming company year-end date given the year-end month (1-12)
function nextYearEnd(yearEndMonth) {
  const now = new Date();
  const yr  = now.getFullYear();
  const lastDayOfMonth = new Date(yr, yearEndMonth, 0).getDate();
  const candidate = new Date(yr, yearEndMonth - 1, lastDayOfMonth);
  return candidate >= now ? candidate : new Date(yr + 1, yearEndMonth - 1, lastDayOfMonth);
}

function addMonths(date, n) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
}

function daysUntil(date) { return Math.ceil((date - new Date()) / 86400000); }

function fmtDate(d) { return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }

// ─── Ltd Company Money Dashboard ─────────────────────────────────────────────
function LtdMoneyDashboard({ accounts, expenses, monthlyData }) {
  const yearEndMonth    = accounts.accountingYearEndMonth ?? 3;
  const dir1Name        = accounts.director1Name || 'Director 1';
  const dir1Salary      = accounts.directorSalaryAnnual ?? 9100;
  const dir2Name        = accounts.director2Name || null;
  const dir2Salary      = accounts.director2SalaryAnnual ?? 0;
  const dirSalaryAnnual = dir1Salary + dir2Salary; // combined for CT + distributable calc
  const taxReserve      = accounts.taxReserve ?? 0;

  const ytdIncome = monthlyData.reduce((s, m) => s + m.income, 0);
  const totalExp  = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const netProfit = Math.max(0, ytdIncome - totalExp);

  // Company year timing
  const yearEnd       = nextYearEnd(yearEndMonth);
  const yearStart     = addMonths(new Date(yearEnd.getFullYear() - 1, yearEnd.getMonth(), yearEnd.getDate()), 0);
  yearStart.setDate(yearStart.getDate() + 1);
  const monthsElapsed = Math.max(1,
    (new Date().getFullYear() - yearStart.getFullYear()) * 12 +
    (new Date().getMonth() - yearStart.getMonth()) + 1
  );
  const annualisedProfit = Math.max(0, netProfit * (12 / monthsElapsed) - dirSalaryAnnual);
  const ctAnnual     = calcCorpTax(annualisedProfit);
  const ctYtd        = Math.round(ctAnnual * (monthsElapsed / 12));
  const ctMonthly    = Math.round(ctAnnual / 12);
  const ctReservedPct = ctYtd > 0 ? Math.min(100, Math.round((taxReserve / ctYtd) * 100)) : 0;

  // Key dates
  const ctPaymentDate = new Date(yearEnd); ctPaymentDate.setMonth(ctPaymentDate.getMonth() + 9); ctPaymentDate.setDate(ctPaymentDate.getDate() + 1);
  const ct600Date     = new Date(yearEnd.getFullYear() + 1, yearEnd.getMonth(), yearEnd.getDate());
  const chAccDate     = addMonths(yearEnd, 9);
  const saDate        = new Date(yearEnd.getFullYear() + (new Date() >= yearEnd ? 2 : 1), 0, 31);

  const keyDates = [
    { label: "Company year end",        date: yearEnd,         icon: "📅" },
    { label: "CT payment due",          date: ctPaymentDate,   icon: "💰" },
    { label: "CT600 return",            date: ct600Date,       icon: "📋" },
    { label: "Companies House accounts",date: chAccDate,       icon: "🏛️"  },
    { label: "Self-assessment (SA)",    date: saDate,          icon: "📝" },
  ].map(d => ({ ...d, days: daysUntil(d.date), fmtd: fmtDate(d.date) }))
   .sort((a, b) => a.days - b.days);

  // Optimal extraction this month
  const divAllowance  = 500;
  const distributable = Math.max(0, netProfit - dirSalaryAnnual * (monthsElapsed / 12) - ctYtd);
  const safeMonthlyDiv = Math.round(distributable / Math.max(1, monthsElapsed));
  const divTaxOnExtra = Math.max(0, safeMonthlyDiv - divAllowance / 12) * 0.0875;
  const personalTaxEst = Math.round(divTaxOnExtra * monthsElapsed);

  if (ytdIncome === 0) return null;

  return (
    <GCard className="fs-exclude overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[rgba(153,197,255,0.1)] flex items-center gap-3">
        <span className="text-xl">🏢</span>
        <div>
          <SectionLabel>Corporation Tax Dashboard</SectionLabel>
          <p className="text-xs text-white font-bold mt-0.5">
            {ctAnnual > 0 ? `~${fmt(ctAnnual)} CT est. this accounting year` : 'Profit below CT threshold'}
          </p>
        </div>
      </div>

      <div className="p-4 space-y-4">

        {/* Company P&L strip */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Turnover YTD",  val: fmt(ytdIncome), color: "text-emerald-400" },
            { label: "Expenses YTD",  val: `−${fmt(totalExp)}`, color: "text-red-400" },
            { label: "Net profit",    val: fmt(netProfit), color: "text-white"       },
          ].map(({ label, val, color }) => (
            <div key={label} className="text-center p-2 rounded-xl bg-[rgba(153,197,255,0.04)] border border-[rgba(153,197,255,0.08)]">
              <p className="text-[9px] font-black tracking-wider uppercase text-[rgba(153,197,255,0.35)] mb-1">{label}</p>
              <p className={`text-sm font-black tabular-nums ${color}`}>{val}</p>
            </div>
          ))}
        </div>

        {/* CT reserve ring */}
        <div className="rounded-xl bg-[rgba(153,197,255,0.03)] border border-[rgba(153,197,255,0.1)] p-4">
          <div className="flex items-center gap-4">
            {/* Ring */}
            <div className="relative w-16 h-16 shrink-0">
              <svg viewBox="0 0 64 64" className="w-16 h-16 -rotate-90">
                <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(153,197,255,0.08)" strokeWidth="6" />
                <circle cx="32" cy="32" r="26" fill="none"
                  stroke={ctReservedPct >= 100 ? "#10b981" : ctReservedPct >= 50 ? "#f59e0b" : "#ef4444"}
                  strokeWidth="6" strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 26}`}
                  strokeDashoffset={`${2 * Math.PI * 26 * (1 - ctReservedPct / 100)}`}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[11px] font-black text-white">{ctReservedPct}%</span>
              </div>
            </div>
            {/* Text */}
            <div className="flex-1">
              <p className="text-xs font-black text-white mb-1">CT reserve</p>
              <p className="text-[11px] text-[rgba(153,197,255,0.5)]">
                {fmt(taxReserve)} reserved of {fmt(ctYtd)} needed YTD
              </p>
              {ctMonthly > 0 && (
                <p className="text-[11px] text-amber-300 font-semibold mt-1">
                  Set aside ~{fmt(ctMonthly)}/mo to cover your CT bill
                </p>
              )}
            </div>
          </div>
          {/* CT breakdown */}
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            {[
              { label: "CT rate",     val: annualisedProfit <= 50000 ? "19%" : annualisedProfit >= 250000 ? "25%" : "Marginal" },
              { label: "YTD est.",    val: fmt(ctYtd)    },
              { label: "Annual est.", val: fmt(ctAnnual) },
            ].map(({ label, val }) => (
              <div key={label}>
                <p className="text-[9px] font-black tracking-wider uppercase text-[rgba(153,197,255,0.35)]">{label}</p>
                <p className="text-xs font-black text-amber-400 tabular-nums mt-0.5">{val}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Optimal extraction */}
        <div className="rounded-xl bg-[rgba(153,197,255,0.03)] border border-[rgba(153,197,255,0.1)] p-4 space-y-2">
          <p className="text-[9px] font-black tracking-wider uppercase text-[rgba(153,197,255,0.35)] mb-2">💰 Optimal extraction this month</p>
          {/* Director salaries — show individually when two directors */}
          {dir2Name ? (
            <>
              <div className="flex items-start justify-between gap-3 py-1.5 border-b border-[rgba(153,197,255,0.05)]">
                <div>
                  <p className="text-xs text-white font-semibold">{dir1Name} salary</p>
                  <p className="text-[10px] text-[rgba(153,197,255,0.35)] mt-0.5">no NI below £9,100/yr</p>
                </div>
                <p className="text-sm font-black tabular-nums shrink-0 text-emerald-400">£{Math.round(dir1Salary / 12)}/mo</p>
              </div>
              <div className="flex items-start justify-between gap-3 py-1.5 border-b border-[rgba(153,197,255,0.05)]">
                <div>
                  <p className="text-xs text-white font-semibold">{dir2Name} salary</p>
                  <p className="text-[10px] text-[rgba(153,197,255,0.35)] mt-0.5">no NI below £9,100/yr</p>
                </div>
                <p className="text-sm font-black tabular-nums shrink-0 text-emerald-400">£{Math.round(dir2Salary / 12)}/mo</p>
              </div>
            </>
          ) : (
            <div className="flex items-start justify-between gap-3 py-1.5 border-b border-[rgba(153,197,255,0.05)]">
              <div>
                <p className="text-xs text-white font-semibold">Director salary (no NI)</p>
                <p className="text-[10px] text-[rgba(153,197,255,0.35)] mt-0.5">£9,100/yr threshold</p>
              </div>
              <p className="text-sm font-black tabular-nums shrink-0 text-emerald-400">£{Math.round(dir1Salary / 12)}/mo</p>
            </div>
          )}
          {[
            { label: "Safe monthly dividend",  val: fmt(safeMonthlyDiv),   color: "text-[#99c5ff]",  note: `from ${fmt(distributable)} distributable profit` },
            { label: "Personal tax est. (all)", val: `~${fmt(personalTaxEst)}`, color: "text-amber-400", note: "8.75% on dividends above £500 allowance" },
          ].map(({ label, val, color, note }) => (
            <div key={label} className="flex items-start justify-between gap-3 py-1.5 border-b border-[rgba(153,197,255,0.05)] last:border-0">
              <div>
                <p className="text-xs text-white font-semibold">{label}</p>
                <p className="text-[10px] text-[rgba(153,197,255,0.35)] mt-0.5">{note}</p>
              </div>
              <p className={`text-sm font-black tabular-nums shrink-0 ${color}`}>{val}</p>
            </div>
          ))}
          <div className="mt-2 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <p className="text-[11px] text-emerald-300 font-semibold">
              Total salaries + dividend: {fmt(Math.round(dirSalaryAnnual / 12) + safeMonthlyDiv)}/mo — {fmt(Math.max(ctYtd - taxReserve, 0))} still needed for CT.
            </p>
          </div>
        </div>

        {/* Key dates countdown */}
        <div>
          <p className="text-[9px] font-black tracking-wider uppercase text-[rgba(153,197,255,0.35)] mb-2">📅 Key dates</p>
          <div className="space-y-2">
            {keyDates.map(({ label, fmtd, days, icon }) => {
              const color  = days < 30  ? 'text-red-400'    : days < 90  ? 'text-amber-400' : 'text-emerald-400';
              const bgCol  = days < 30  ? 'bg-red-500/10 border-red-500/20'    : days < 90 ? 'bg-amber-500/10 border-amber-500/20' : 'bg-[rgba(153,197,255,0.04)] border-[rgba(153,197,255,0.08)]';
              return (
                <div key={label} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border ${bgCol}`}>
                  <span className="text-base shrink-0">{icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-white">{label}</p>
                    <p className="text-[10px] text-[rgba(153,197,255,0.4)] mt-0.5">{fmtd}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-xs font-black tabular-nums ${color}`}>
                      {days <= 0 ? 'Due now' : days === 1 ? 'Tomorrow' : `${days}d`}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </GCard>
  );
}

// ─── Tax Savings Counter ──────────────────────────────────────────────────────
function TaxSavingsCounter({ expenses, monthlyData, accounts = {} }) {
  const ytdIncome = monthlyData.reduce((s, m) => s + m.income, 0);
  if (ytdIncome === 0) return null;
  const totalExp = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  if (totalExp < 10) return null;

  const isLtd = accounts.entityType === 'limited_company';

  // Ltd: marginal CT rate at current profit level (19% / marginal 26.5% / 25%)
  // Sole trader: IT 20% + Class 4 NI 6% = 26%
  let savingRate;
  if (isLtd) {
    const netProfit = Math.max(0, ytdIncome - totalExp);
    savingRate = netProfit <= 50000 ? 0.19 : netProfit >= 250000 ? 0.25 : 0.265;
  } else {
    savingRate = 0.26;
  }

  const saving = Math.round(totalExp * savingRate);
  if (saving < 1) return null;

  return (
    <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/25 flex items-center justify-center text-lg shrink-0">💰</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-black text-emerald-400">
          {isLtd
            ? `CT deductions worth ~£${saving.toLocaleString()}`
            : `You've saved ~£${saving.toLocaleString()} in tax this year`}
        </p>
        <p className="text-xs text-[rgba(153,197,255,0.55)] mt-0.5">
          {expenses.length} business expense{expenses.length !== 1 ? 's' : ''} tracked · £{Math.round(totalExp).toLocaleString()} in deductions
          {isLtd ? ` · ${Math.round(savingRate * 100)}% CT rate` : ' · 20% IT + 6% NI'}
        </p>
      </div>
    </div>
  );
}

// ─── Real Take-Home ───────────────────────────────────────────────────────────
function RealTakeHome({ monthlyData, expenses }) {
  const ytdIncome = monthlyData.reduce((s, m) => s + m.income, 0);
  if (ytdIncome === 0) return null;
  const totalExp  = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const profit    = Math.max(0, ytdIncome - totalExp);
  // Inline 2025/26 tax calc
  const PA = 12570; const BRT = 50270; const BR = 0.20; const HR = 0.40;
  const NI_LOW = 0.06; const NI_HIGH = 0.02;
  const taxable = Math.max(profit - PA, 0);
  const incomeTax = taxable <= (BRT - PA) ? taxable * BR : (BRT - PA) * BR + (taxable - (BRT - PA)) * HR;
  const niBase = Math.max(profit - PA, 0);
  const ni = niBase <= (BRT - PA) ? niBase * NI_LOW : (BRT - PA) * NI_LOW + (niBase - (BRT - PA)) * NI_HIGH;
  const totalTax  = Math.round(incomeTax + ni);
  const takeHome  = Math.max(0, profit - totalTax);
  const keepPct   = ytdIncome > 0 ? Math.round((takeHome / ytdIncome) * 100) : 0;
  const perHundred = Math.round(takeHome / ytdIncome * 100);
  const months    = monthlyData.filter(m => m.income > 0).length || 1;
  const monthlyTH = Math.round(takeHome / months);

  return (
    <GCard className="p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg">💎</span>
        <SectionLabel>Real take-home</SectionLabel>
      </div>

      {/* Three headline figures */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {[
          { label: "Tax year to date",  value: fmt(takeHome),   color: "text-emerald-400", sub: "after tax & expenses" },
          { label: "For every £100",    value: `£${perHundred}`, color: "text-white",       sub: "you keep"             },
          { label: "Monthly avg.",      value: fmt(monthlyTH),  color: "text-[#99c5ff]",   sub: "take-home"            },
        ].map(({ label, value, color, sub }) => (
          <div key={label} className="text-center p-2.5 rounded-xl bg-[rgba(153,197,255,0.04)] border border-[rgba(153,197,255,0.08)]">
            <p className="text-[9px] font-black tracking-wider uppercase text-[rgba(153,197,255,0.35)] mb-1">{label}</p>
            <p className={`text-base font-black tabular-nums ${color}`}>{value}</p>
            <p className="text-[9px] text-[rgba(153,197,255,0.3)] mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* Income waterfall bars */}
      <div className="space-y-2">
        {[
          { label: "Income",      val: ytdIncome, pct: 100,     color: "bg-emerald-400",  bold: false },
          { label: "− Expenses",  val: totalExp,  pct: Math.min(100, Math.round(totalExp / ytdIncome * 100)),   color: "bg-[#1f48ff]/80", bold: false },
          { label: "− Tax (est.)", val: totalTax, pct: Math.min(100, Math.round(totalTax / ytdIncome * 100)),   color: "bg-amber-400",    bold: false },
          { label: "= You keep",  val: takeHome,  pct: keepPct, color: "bg-emerald-400",  bold: true  },
        ].map(({ label, val, pct, color, bold }) => (
          <div key={label} className="flex items-center gap-3">
            <p className={`text-[10px] w-24 shrink-0 ${bold ? 'font-black text-emerald-400' : 'text-[rgba(153,197,255,0.4)]'}`}>{label}</p>
            <div className="flex-1 h-2 rounded-full bg-[rgba(153,197,255,0.06)] overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${pct}%` }} />
            </div>
            <p className={`text-xs tabular-nums w-16 text-right shrink-0 ${bold ? 'font-black text-emerald-400' : 'text-white font-semibold'}`}>{fmt(val)}</p>
          </div>
        ))}
      </div>
    </GCard>
  );
}

// ─── Mileage helpers ─────────────────────────────────────────────────────────
function taxYearStart() {
  const now = new Date();
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return `${year}-04-06`;
}

function projectedAnnualAllowance(weeklyMiles) {
  const annual = weeklyMiles * 52;
  return Math.round((Math.min(annual, MILEAGE_THRESHOLD) * MILEAGE_RATE_HIGH + Math.max(annual - MILEAGE_THRESHOLD, 0) * MILEAGE_RATE_LOW) * 100) / 100;
}

// ─── Mileage setup card (first-time prompt) ───────────────────────────────────
function MileageSetupCard({ onSetupComplete }) {
  const [ytdMiles,    setYtdMiles]    = useState('');
  const [weeklyMiles, setWeeklyMiles] = useState('');
  const [saving,      setSaving]      = useState(false);
  const [dismissed,   setDismissed]   = useState(() => localStorage.getItem('cadi_mileage_dismissed') === '1');

  if (dismissed) return null;

  const weekly  = parseFloat(weeklyMiles) || 0;
  const annual  = projectedAnnualAllowance(weekly);
  const taxSave = Math.round(annual * 0.26);

  const handleSave = async () => {
    if (!weekly) return;
    setSaving(true);
    try {
      await upsertBusinessSettings({
        mileage_setup_done:   true,
        ytd_miles_at_setup:   parseFloat(ytdMiles) || 0,
        typical_weekly_miles: weekly,
      });
      onSetupComplete({ ytdMiles: parseFloat(ytdMiles) || 0, typicalWeeklyMiles: weekly });
    } catch (e) {
      console.error('Mileage setup error:', e);
    } finally {
      setSaving(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem('cadi_mileage_dismissed', '1');
    setDismissed(true);
  };

  return (
    <div className="rounded-2xl border border-[#1f48ff]/30 bg-gradient-to-r from-[#1f48ff]/10 via-[#1f48ff]/5 to-transparent overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#1f48ff]/20 border border-[#1f48ff]/30 flex items-center justify-center text-xl shrink-0">🚗</div>
            <div>
              <p className="text-sm font-black text-white">Track your mileage</p>
              <p className="text-xs text-[rgba(153,197,255,0.55)] mt-0.5">HMRC lets you claim 45p per mile — Cadi does the maths</p>
            </div>
          </div>
          <button onClick={handleDismiss} className="text-[rgba(153,197,255,0.3)] hover:text-white text-lg leading-none shrink-0 transition-colors">×</button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <p className="text-[10px] font-black tracking-wider uppercase text-[rgba(153,197,255,0.55)] mb-1.5">Miles driven this tax year so far</p>
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[rgba(153,197,255,0.06)] border border-[rgba(153,197,255,0.12)]">
              <input type="number" min="0" value={ytdMiles} onChange={e => setYtdMiles(e.target.value)}
                placeholder="e.g. 1200"
                className="flex-1 bg-transparent text-sm font-bold text-white placeholder-[rgba(153,197,255,0.2)] focus:outline-none w-0 min-w-0" />
              <span className="text-[10px] text-[rgba(153,197,255,0.35)] shrink-0">mi</span>
            </div>
          </div>
          <div>
            <p className="text-[10px] font-black tracking-wider uppercase text-[rgba(153,197,255,0.55)] mb-1.5">Typical miles per week</p>
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[rgba(153,197,255,0.06)] border border-[rgba(153,197,255,0.12)]">
              <input type="number" min="0" value={weeklyMiles} onChange={e => setWeeklyMiles(e.target.value)}
                placeholder="e.g. 80"
                className="flex-1 bg-transparent text-sm font-bold text-white placeholder-[rgba(153,197,255,0.2)] focus:outline-none w-0 min-w-0" />
              <span className="text-[10px] text-[rgba(153,197,255,0.35)] shrink-0">mi/wk</span>
            </div>
          </div>
        </div>

        {/* Live projection */}
        {weekly > 0 && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-3">
            <span className="text-lg shrink-0">💡</span>
            <div>
              <p className="text-xs font-black text-emerald-300">
                That's ~£{annual.toLocaleString()} in HMRC allowance this year
              </p>
              <p className="text-[10px] text-emerald-400/70 mt-0.5">
                Worth ~£{taxSave.toLocaleString()} off your tax bill · Cadi logs it automatically
              </p>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <button onClick={handleSave} disabled={saving || !weekly}
            className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all ${weekly ? 'bg-[#1f48ff] text-white hover:bg-[#3a5eff]' : 'bg-[rgba(153,197,255,0.06)] text-[rgba(153,197,255,0.25)] cursor-not-allowed'}`}>
            {saving ? 'Saving…' : 'Start tracking →'}
          </button>
          <button onClick={handleDismiss}
            className="px-4 py-2.5 rounded-xl border border-[rgba(153,197,255,0.12)] text-[rgba(153,197,255,0.4)] text-xs font-black hover:text-white transition-all">
            Later
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Mileage card (ongoing) + log modal ──────────────────────────────────────
function LogMileageModal({ ytdMilesBefore, onSave, onClose }) {
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (now.getDay() === 0 ? 6 : now.getDay() - 1));
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
  const toISO = d => d.toISOString().slice(0, 10);

  const [miles,  setMiles]  = useState('');
  const [period, setPeriod] = useState('week'); // 'week' | 'month' | 'custom'
  const [start,  setStart]  = useState(toISO(monday));
  const [end,    setEnd]    = useState(toISO(now));
  const [notes,  setNotes]  = useState('');
  const [saving, setSaving] = useState(false);

  const mi = parseFloat(miles) || 0;
  const allowance = calcMileageAllowance(mi, ytdMilesBefore);
  const taxSave   = Math.round(allowance * 0.26);

  const periodStart = period === 'week' ? toISO(monday) : period === 'month'
    ? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01` : start;
  const periodEnd = period === 'week' ? toISO(sunday) : period === 'month' ? toISO(now) : end;

  const handleSave = async () => {
    if (!mi) return;
    setSaving(true);
    try {
      await onSave({ miles: mi, allowance, periodStart, periodEnd, notes });
      onClose();
    } catch (e) {
      console.error('Log mileage error:', e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl border border-[rgba(153,197,255,0.15)] bg-gradient-to-br from-[#010a4f] via-[#05124a] to-[#0d1e78] overflow-hidden shadow-2xl">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#99c5ff]/50 to-transparent" />
        <div className="px-5 py-4 border-b border-[rgba(153,197,255,0.1)] flex items-center justify-between">
          <p className="text-sm font-black text-white">🚗 Log mileage</p>
          <button onClick={onClose} className="text-[rgba(153,197,255,0.4)] hover:text-white text-xl leading-none">×</button>
        </div>
        <div className="p-5 space-y-4">
          {/* Period picker */}
          <div className="flex gap-1 p-1 bg-[rgba(0,0,0,0.2)] rounded-xl w-fit">
            {[['week','This week'],['month','This month'],['custom','Custom']].map(([v, l]) => (
              <button key={v} onClick={() => setPeriod(v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${period === v ? 'bg-[#1f48ff] text-white' : 'text-[rgba(153,197,255,0.55)] hover:text-white'}`}>
                {l}
              </button>
            ))}
          </div>

          {period === 'custom' && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-[10px] font-bold text-[rgba(153,197,255,0.4)] mb-1">From</p>
                <input type="date" value={start} onChange={e => setStart(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[rgba(153,197,255,0.05)] border border-[rgba(153,197,255,0.12)] text-sm text-white focus:outline-none" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-[rgba(153,197,255,0.4)] mb-1">To</p>
                <input type="date" value={end} onChange={e => setEnd(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[rgba(153,197,255,0.05)] border border-[rgba(153,197,255,0.12)] text-sm text-white focus:outline-none" />
              </div>
            </div>
          )}

          {/* Miles input */}
          <div className="flex items-center gap-3 px-4 py-4 rounded-xl bg-[rgba(153,197,255,0.05)] border border-[rgba(153,197,255,0.12)]">
            <span className="text-2xl">🛣️</span>
            <input type="number" min="0" step="1" value={miles} onChange={e => setMiles(e.target.value)}
              placeholder="0" autoFocus
              className="flex-1 bg-transparent text-3xl font-black text-white placeholder-[rgba(153,197,255,0.15)] focus:outline-none w-0 min-w-0 tabular-nums" />
            <span className="text-sm font-bold text-[rgba(153,197,255,0.4)] shrink-0">miles</span>
          </div>

          {/* Optional notes */}
          <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Notes (optional — e.g. client visits, supply run)"
            className="w-full px-4 py-2.5 rounded-xl bg-[rgba(153,197,255,0.05)] border border-[rgba(153,197,255,0.12)] text-sm text-white placeholder-[rgba(153,197,255,0.25)] focus:outline-none" />

          {/* Cadi's calculation */}
          {mi > 0 && (
            <div className="rounded-xl border border-[rgba(153,197,255,0.1)] divide-y divide-[rgba(153,197,255,0.06)] text-sm">
              {[
                { l: 'Miles logged',      v: `${mi} mi`,           c: 'text-white' },
                { l: 'HMRC allowance',    v: `£${allowance.toFixed(2)}`, c: 'text-[#99c5ff]', note: ytdMilesBefore >= MILEAGE_THRESHOLD ? '25p/mi' : ytdMilesBefore + mi > MILEAGE_THRESHOLD ? 'mixed rate' : '45p/mi' },
                { l: 'Tax saving (est.)', v: `~£${taxSave}`,        c: 'text-emerald-400 font-black' },
              ].map(({ l, v, c, note }) => (
                <div key={l} className="flex justify-between items-center px-4 py-2.5">
                  <span className="text-[rgba(153,197,255,0.5)] text-xs">{l}{note && <span className="ml-1 text-[9px] opacity-60">{note}</span>}</span>
                  <span className={`text-xs tabular-nums font-bold ${c}`}>{v}</span>
                </div>
              ))}
              <div className="px-4 py-2.5 bg-emerald-500/5">
                <p className="text-[11px] text-emerald-300 font-semibold">
                  I'll add £{allowance.toFixed(2)} to your Vehicle expenses automatically ✓
                </p>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving || !mi}
              className={`flex-1 py-3 rounded-xl text-xs font-black transition-all ${mi ? 'bg-[#1f48ff] text-white hover:bg-[#3a5eff]' : 'bg-[rgba(153,197,255,0.05)] text-[rgba(153,197,255,0.25)] cursor-not-allowed'}`}>
              {saving ? 'Saving…' : 'Log mileage'}
            </button>
            <button onClick={onClose}
              className="px-5 py-3 rounded-xl border border-[rgba(153,197,255,0.12)] text-[rgba(153,197,255,0.5)] text-xs font-black hover:text-white transition-all">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MileageCard({ mileageLogs, ytdMilesAtSetup, typicalWeeklyMiles, taxRate = 0.26, onLog }) {
  const [showModal, setShowModal] = useState(false);

  const THRESHOLD = 10000;
  const loggedMiles    = mileageLogs.reduce((s, l) => s + Number(l.miles), 0);
  const ytdMiles       = loggedMiles + (ytdMilesAtSetup || 0);
  const ytdAllowance   = mileageLogs.reduce((s, l) => s + Number(l.allowance_pence), 0);
  const ytdTaxSave     = Math.round(ytdAllowance * taxRate);
  const pctOfThreshold = Math.min((ytdMiles / THRESHOLD) * 100, 100);
  const nearThreshold  = ytdMiles >= 8000 && ytdMiles < THRESHOLD;
  const overThreshold  = ytdMiles >= THRESHOLD;

  // Last entry date
  const lastLog     = mileageLogs[0];
  const lastLogDate = lastLog ? new Date(lastLog.period_end).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : null;
  const daysSinceLast = lastLog ? Math.floor((Date.now() - new Date(lastLog.period_end)) / 86400000) : null;
  const dueForLog   = daysSinceLast === null || daysSinceLast >= 7;

  return (
    <>
      {showModal && (
        <LogMileageModal
          ytdMilesBefore={ytdMiles}
          onSave={onLog}
          onClose={() => setShowModal(false)}
        />
      )}

      <GCard className="overflow-hidden">
        <div className="px-4 py-3 border-b border-[rgba(153,197,255,0.08)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">🚗</span>
            <div>
              <SectionLabel>Mileage</SectionLabel>
              {lastLogDate && (
                <p className="text-[10px] text-[rgba(153,197,255,0.4)] mt-0.5">
                  Last logged {lastLogDate}{dueForLog ? ' · ' : ''}{dueForLog && <span className="text-amber-400 font-bold">log due</span>}
                </p>
              )}
            </div>
          </div>
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1f48ff]/20 border border-[#1f48ff]/40 text-xs font-black text-white hover:bg-[#1f48ff]/35 transition-colors">
            + Log miles
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Miles this year', val: ytdMiles.toLocaleString(), unit: 'mi', color: 'text-white' },
              { label: 'HMRC allowance',  val: `£${Math.round(ytdAllowance).toLocaleString()}`, color: 'text-[#99c5ff]' },
              { label: 'Tax saved (est.)', val: `~£${ytdTaxSave.toLocaleString()}`, color: 'text-emerald-400' },
            ].map(({ label, val, color }) => (
              <div key={label} className="text-center p-2.5 rounded-xl bg-[rgba(153,197,255,0.04)] border border-[rgba(153,197,255,0.08)]">
                <p className="text-[9px] font-black tracking-wider uppercase text-[rgba(153,197,255,0.35)] mb-1">{label}</p>
                <p className={`text-sm font-black tabular-nums ${color}`}>{val}</p>
              </div>
            ))}
          </div>

          {/* HMRC 10,000-mile threshold bar */}
          <div>
            <div className="flex justify-between text-[10px] text-[rgba(153,197,255,0.4)] mb-1.5">
              <span>HMRC threshold (45p → 25p/mi at 10,000)</span>
              <span className={overThreshold ? 'text-amber-400 font-bold' : ''}>{ytdMiles.toLocaleString()} / 10,000 mi</span>
            </div>
            <div className="h-2 rounded-full bg-[rgba(153,197,255,0.06)] overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${overThreshold ? 'bg-amber-400' : nearThreshold ? 'bg-amber-400' : 'bg-[#1f48ff]'}`}
                style={{ width: `${pctOfThreshold}%` }}
              />
            </div>
            {nearThreshold && (
              <p className="mt-1.5 text-[10px] text-amber-400 font-semibold">
                ⚠️ {(THRESHOLD - ytdMiles).toLocaleString()} miles until your rate drops to 25p/mi
              </p>
            )}
            {overThreshold && (
              <p className="mt-1.5 text-[10px] text-amber-400">
                Over 10,000 miles — remaining miles claim at 25p/mi
              </p>
            )}
          </div>

          {/* Recent log history */}
          {mileageLogs.length > 0 && (
            <div className="space-y-1.5">
              {mileageLogs.slice(0, 3).map(log => (
                <div key={log.id} className="flex items-center justify-between px-3 py-2 rounded-xl bg-[rgba(153,197,255,0.03)] border border-[rgba(153,197,255,0.06)]">
                  <div>
                    <p className="text-xs font-semibold text-white">{Number(log.miles).toLocaleString()} miles</p>
                    <p className="text-[10px] text-[rgba(153,197,255,0.35)]">
                      {new Date(log.period_start).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      {log.period_start !== log.period_end && ` – ${new Date(log.period_end).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`}
                      {log.notes && ` · ${log.notes}`}
                    </p>
                  </div>
                  <p className="text-xs font-black text-[#99c5ff] tabular-nums">£{Number(log.allowance_pence).toFixed(2)}</p>
                </div>
              ))}
            </div>
          )}

          {mileageLogs.length === 0 && (
            <div className="text-center py-2">
              <p className="text-xs text-[rgba(153,197,255,0.3)]">
                {typicalWeeklyMiles ? `You typically drive ${typicalWeeklyMiles} miles/week — tap "+ Log miles" to start` : 'Log your first journey to start claiming'}
              </p>
            </div>
          )}
        </div>
      </GCard>
    </>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export default function MoneyTab({ accountsData, schedulerData, onNavigate: onNavigateProp }) {
  const routerNavigate = useNavigate();
  const onNavigate = onNavigateProp || ((tab) => routerNavigate(`/${tab}`));
  const { user } = useAuth();
  const isLive = Boolean(user);

  // Fetch business settings (entity type, director salary, year end, etc.)
  const [fetchedSettings, setFetchedSettings] = useState(null);
  useEffect(() => {
    if (!isLive || user?.id === 'demo-user') return;
    getBusinessSettings()
      .then(s => {
        if (!s) return;
        setFetchedSettings({
          entityType:               s.entity_type               ?? undefined,
          director1Name:            s.director_1_name           ?? undefined,
          directorSalaryAnnual:     s.director_salary_annual    ?? undefined,
          director2Name:            s.director_2_name           ?? undefined,
          director2SalaryAnnual:    s.director_2_salary_annual  ?? undefined,
          accountingYearEndMonth:   s.accounting_year_end_month ?? undefined,
          annualTarget:             s.annual_target              ?? undefined,
          vatRegistered:            s.vat_registered             ?? undefined,
          taxRate:                  s.tax_rate                   ?? undefined,
          taxReserve:               s.tax_reserve                ?? undefined,
          taxReserveTarget:         s.tax_reserve_target         ?? undefined,
          mileageSetupDone:         s.mileage_setup_done         ?? false,
          ytdMilesAtSetup:          s.ytd_miles_at_setup         ?? 0,
          typicalWeeklyMiles:       s.typical_weekly_miles       ?? undefined,
        });
      })
      .catch(() => {}); // silent — falls back to defaults
  }, [isLive, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const accounts = { ...DEFAULT_ACCOUNTS, ...(fetchedSettings ?? {}), ...(accountsData ?? {}) };

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
  const [bankTxs,      setBankTxs]     = useState([]);
  const [mileageLogs,  setMileageLogs]  = useState([]);
  const manualRowsRef  = useRef([]);
  const [period,       setPeriod]       = useState("Month");
  const [showPayment,  setShowPayment]  = useState(false);
  const [showReminder, setShowReminder] = useState(false);
  const [reminderInv,  setReminderInv]  = useState(null);

  useEffect(() => {
    if (!isLive) return; // demo mode uses context data — no DB fetch needed
    let mounted = true;
    (async () => {
      let manualMoneyRows = [];

      // Load mileage logs for current tax year (silent fail)
      listMileageLogs({ taxYearStart: taxYearStart() })
        .then(logs => { if (mounted) setMileageLogs(logs); })
        .catch(() => {});

      try {
        const [quoteRows, moneyRows] = await Promise.all([
          listQuotes(250),
          listMoneyEntries({ from: new Date(Date.now() - 730 * 864e5).toISOString().slice(0, 10), pageSize: 500 }),
        ]);
        if (!mounted) return;

        manualMoneyRows = moneyRows; // save for bank merge below
        manualRowsRef.current = moneyRows;

        const mappedInvoices = quoteRows.map(q => {
          const created = new Date(q.created_at || Date.now());
          const due = new Date(created); due.setDate(created.getDate() + 7);
          let status = q.status === "paid" ? "paid" : "pending";
          if (status !== "paid" && (Date.now() - due.getTime()) / 86400000 > 0) status = "overdue";
          return { id: q.id, customer: q.job_label || q.payload?.customer || "Customer", amount: Number(q.price) || 0, sentDate: toISODate(created), dueDate: toISODate(due), status, type: q.type || "residential" };
        });

        const incomeRows  = moneyRows.filter(m => m.kind === "income");
        const expenseRows = moneyRows.filter(m => m.kind === "expense");
        const manualTx  = incomeRows.map(m => ({ id: m.id, date: m.date, customer: m.client || "Payment received", amount: Number(m.amount) || 0, type: "residential", status: "paid" }));
        const manualExp = expenseRows.map(m => ({ id: m.id, date: m.date, label: m.description || m.client || "Expense", amount: Number(m.amount) || 0, category: m.category || "other" }));

        setLiveInvoices(mappedInvoices);
        setTransactions(manualTx.sort((a,b) => new Date(b.date)-new Date(a.date)));
        setMonthlyData(buildLastSixMonths(moneyRows));
        setExpenses(manualExp.sort((a,b) => new Date(b.date)-new Date(a.date)));
      } catch (e) {
        console.error("MoneyTracker load error:", e);
        if (!mounted) return;
        setLiveInvoices([]); setTransactions([]); setMonthlyData(buildLastSixMonths([])); setExpenses([]);
      }

      // Separately load + merge bank transactions — own try/catch so failures
      // here never wipe the manual data loaded above.
      // Always reads manualRowsRef.current so expenses added between sync and apply are preserved.
      const applyBankRows = (allRows) => {
        if (!allRows?.length) return;
        const bizRows    = allRows.filter(b => b.is_business);
        const bankIncome = bizRows.filter(b => Number(b.amount) > 0);
        const bankExpense= bizRows.filter(b => Number(b.amount) < 0);
        const d = b => b.transaction_date || b.date;
        const bankTxIncome = bankIncome.map(b => ({ id: `bk-${b.id}`, date: d(b), customer: b.merchant_name || b.description || "Bank income", amount: Math.abs(Number(b.amount)) || 0, type: "residential", status: "paid" }));
        const bankExp      = bankExpense.map(b => ({ id: `bk-${b.id}`, date: d(b), label: b.merchant_name || b.description || "Expense", amount: Math.abs(Number(b.amount)) || 0, category: b.category || "other" }));
        setTransactions(prev => [...prev.filter(t => !t.id?.startsWith("bk-")), ...bankTxIncome].sort((a,b) => new Date(b.date)-new Date(a.date)));
        setExpenses(prev => [...prev.filter(e => !e.id?.startsWith("bk-")), ...bankExp].sort((a,b) => new Date(b.date)-new Date(a.date)));
        setBankTxs(allRows);
        const bankMoneyRows = [
          ...bankIncome.map(b => ({ kind: "income",  amount: Math.abs(Number(b.amount)), date: d(b) })),
          ...bankExpense.map(b => ({ kind: "expense", amount: Math.abs(Number(b.amount)), date: d(b) })),
        ];
        // Read live manual rows (ref) so expenses added during sync aren't lost
        setMonthlyData(buildLastSixMonths([...(manualRowsRef.current ?? []), ...bankMoneyRows]));
      };

      try {
        // Pull bank rows from the broader of: tax-year start, or 730 days ago.
        // Matches the manual-entry window so YTD totals reconcile with the Accounts tab.
        const sevenThirtyDaysAgo = new Date(Date.now() - 730 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
        const tyStart            = taxYearStart();
        const bankLowerBound     = sevenThirtyDaysAgo < tyStart ? sevenThirtyDaysAgo : tyStart;
        // Resolve own business_id and scope every query to it — defence-in-depth
        const { data: bizRow } = await supabase.from('businesses').select('id').eq('owner_user_id', user.id).maybeSingle();
        const businessId = bizRow?.id;
        const { data: bankRows, error: bankErr } = await supabase
          .from("transactions")
          .select("id,transaction_date,description,merchant_name,amount,category,categorised_by,categorisation_confidence,is_business,matched_invoice_id")
          .eq("business_id", businessId)
          .gte("transaction_date", bankLowerBound)
          .eq("is_hidden", false)
          .order("transaction_date", { ascending: false });

        if (bankErr) { console.error("Bank tx query error:", bankErr); }
        else if (mounted) applyBankRows(bankRows);

        // Background auto-sync: pull fresh data from Yapily, then re-apply
        // Runs silently — no spinner, no toast — so the page feels always up to date
        const { data: { session } } = await supabase.auth.getSession();
        if (session && mounted) {
          supabase.functions.invoke('yapily-api', {
            body: { action: 'sync' },
            headers: { Authorization: `Bearer ${session.access_token}` },
          }).then(async ({ data: syncData }) => {
            if (!mounted || !syncData?.imported) return; // nothing new — skip re-query
            const { data: freshRows } = await supabase
              .from("transactions")
              .select("id,transaction_date,description,merchant_name,amount,category,categorised_by,categorisation_confidence,is_business,matched_invoice_id")
              .eq("business_id", businessId)
              .gte("transaction_date", bankLowerBound)
              .eq("is_hidden", false)
              .order("transaction_date", { ascending: false });
            if (mounted) applyBankRows(freshRows);
          }).catch(() => {}); // silent fail — not connected or token expired
        }
      } catch (e) {
        console.error("Bank merge error:", e);
      }
    })();
    return () => { mounted = false; };
  }, [isLive]);

  const weekRevenue    = weekData.reduce((s,d) => s + (d.done || d.isToday ? d.revenue : 0), 0);
  const monthIncome    = monthlyData.find(m => m.isCurrent)?.income ?? 0;
  const unpaidInvoices = invoices.filter(i => i.status !== "paid");

  const [saveError, setSaveError] = useState(null);
  const [taxSetupDismissed, setTaxSetupDismissed] = useState(() => localStorage.getItem('cadi_tax_setup_dismissed') === '1');
  const showTaxSetupNudge = isLive && !taxSetupDismissed && !accountsData?.annualTarget && user?.id !== 'demo-user';

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
      // Keep manualRowsRef in sync so future bank-sync merges don't drop this entry
      manualRowsRef.current = [...manualRowsRef.current, { kind: 'income', amount, date: today }];
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
      // Keep manualRowsRef in sync so future bank-sync merges don't drop this entry
      manualRowsRef.current = [...manualRowsRef.current, { kind: 'expense', amount: exp.amount, date: exp.date }];
    } catch (err) {
      console.error('Failed to save expense:', err);
      setSaveError('Expense could not be saved. Please try again.');
      setTimeout(() => setSaveError(null), 5000);
    }
  };

  const handleBulkCategorize = async (ids, newCat) => {
    setExpenses(prev => prev.map(e => ids.includes(e.id) ? { ...e, category: newCat } : e));
    const results = await Promise.allSettled(ids.map(id => updateMoneyEntry(id, { category: newCat })));
    const failed = results.filter(r => r.status === 'rejected').length;
    if (failed > 0) setSaveError(`${failed} item${failed !== 1 ? 's' : ''} couldn't be updated. Refresh and try again.`);
  };

  const [pendingDelete, setPendingDelete] = useState(null); // { ids, snapshot, timer }
  const handleBulkDelete = async (ids) => {
    if (!ids?.length) return;
    // Soft confirm for irreversible bulk actions touching 3+ rows of money data
    if (ids.length >= 3 && !window.confirm(`Delete ${ids.length} expenses? You'll have 8 seconds to undo.`)) return;

    // Snapshot the rows we're about to drop so undo can restore them locally
    const snapshot = expenses.filter(e => ids.includes(e.id));
    setExpenses(prev => prev.filter(e => !ids.includes(e.id)));

    // Hold the DB delete for 8s — gives the user an undo window
    const timer = setTimeout(async () => {
      const results = await Promise.allSettled(ids.map(id => deleteMoneyEntry(id)));
      const failed = results.filter(r => r.status === 'rejected').length;
      if (failed > 0) setSaveError(`${failed} item${failed !== 1 ? 's' : ''} couldn't be deleted. Refresh and try again.`);
      setPendingDelete(null);
    }, 8000);

    setPendingDelete({ ids, snapshot, timer });
  };

  const undoBulkDelete = () => {
    if (!pendingDelete) return;
    clearTimeout(pendingDelete.timer);
    setExpenses(prev => [...pendingDelete.snapshot, ...prev]
      .sort((a, b) => new Date(b.date) - new Date(a.date)));
    setPendingDelete(null);
  };

  // Mileage setup completed — update accounts state without page reload
  const handleMileageSetup = ({ ytdMiles, typicalWeeklyMiles }) => {
    setFetchedSettings(prev => ({
      ...(prev ?? {}),
      mileageSetupDone: true,
      ytdMilesAtSetup: ytdMiles,
      typicalWeeklyMiles,
    }));
  };

  // Mileage logged — save to DB + add vehicle expense entry
  const handleLogMileage = async ({ miles, allowance, periodStart, periodEnd, notes }) => {
    const log = await logMileage({ periodStart, periodEnd, miles, allowancePence: allowance, notes });
    setMileageLogs(prev => [log, ...prev]);
    // Auto-create vehicle expense at the HMRC allowance value
    const label = `Mileage ${new Date(periodStart).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}${periodStart !== periodEnd ? ` – ${new Date(periodEnd).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : ''}`;
    await handleAddExpense({ amount: allowance, label, category: 'vehicle', date: periodEnd });
  };

  // Called by OpenBankingBanner when a transaction is marked as Business —
  // immediately drops it into the expense sorter without a reload
  const handleExpenseFromBank = (exp) => {
    setExpenses(prev => {
      if (prev.some(e => e.id === exp.id)) return prev; // already present from initial load
      return [exp, ...prev].sort((a, b) => new Date(b.date) - new Date(a.date));
    });
    setMonthlyData(prev => prev.map(m => {
      const expMonth = exp.date?.slice(0, 7);
      return m.key === expMonth ? { ...m, expenses: m.expenses + Number(exp.amount) } : m;
    }));
  };

  // Called by ExpenseSorter when user changes the category on a bank expense inline
  const handleRecategorizeBankExpense = async (expId, newCat) => {
    setExpenses(prev => prev.map(e => e.id === expId ? { ...e, category: newCat } : e));
    const txId = expId.replace(/^bk-/, '');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await supabase.functions.invoke('yapily-api', {
        body: { action: 'categorise', transactionId: txId, isBusiness: true, category: newCat },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
    } catch (e) {
      console.error('Failed to recategorize bank expense:', e);
    }
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

        {/* Tax setup nudge */}
        {showTaxSetupNudge && (
          <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-amber-500/30 bg-amber-500/10">
            <p className="text-xs text-amber-300 leading-snug">
              <span className="font-black">Set your tax rate</span> — head to Accounts to confirm your tax rate and annual income target so your tax reserve is accurate.
            </p>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => onNavigate('accounts')} className="px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-black hover:bg-amber-500/30 transition-colors">Set up →</button>
              <button onClick={() => { setTaxSetupDismissed(true); localStorage.setItem('cadi_tax_setup_dismissed', '1'); }} className="text-amber-400/50 hover:text-amber-300 transition-colors text-lg leading-none">×</button>
            </div>
          </div>
        )}

        {/* Open banking banner */}
        <OpenBankingBanner
          bankTxs={bankTxs}
          setBankTxs={setBankTxs}
          onExpenseFromBank={handleExpenseFromBank}
          onSyncComplete={(txs) => {
            // Re-apply full merge after a manual sync from the banner
            const d = b => b.transaction_date || b.date;
            const bizRows    = txs.filter(b => b.is_business);
            const bankIncome = bizRows.filter(b => Number(b.amount) > 0);
            const bankExpense= bizRows.filter(b => Number(b.amount) < 0);
            const bankTxIncome = bankIncome.map(b => ({ id: `bk-${b.id}`, date: d(b), customer: b.merchant_name || b.description || "Bank income", amount: Math.abs(Number(b.amount)) || 0, type: "residential", status: "paid" }));
            const bankExp      = bankExpense.map(b => ({ id: `bk-${b.id}`, date: d(b), label: b.merchant_name || b.description || "Expense", amount: Math.abs(Number(b.amount)) || 0, category: b.category || "other" }));
            setTransactions(prev => [...prev.filter(t => !t.id?.startsWith("bk-")), ...bankTxIncome].sort((a,b) => new Date(b.date)-new Date(a.date)));
            setExpenses(prev => [...prev.filter(e => !e.id?.startsWith("bk-")), ...bankExp].sort((a,b) => new Date(b.date)-new Date(a.date)));
            const bankMoneyRows = [
              ...bankIncome.map(b => ({ kind: "income",  amount: Math.abs(Number(b.amount)), date: d(b) })),
              ...bankExpense.map(b => ({ kind: "expense", amount: Math.abs(Number(b.amount)), date: d(b) })),
            ];
            setMonthlyData(buildLastSixMonths([...manualRowsRef.current, ...bankMoneyRows]));
          }}
        />

        {/* Period hero */}
        <PeriodHero
          period={period}
          setPeriod={setPeriod}
          weekRevenue={weekRevenue}
          monthIncome={monthIncome}
          monthlyData={monthlyData}
          accounts={accounts}
        />

        {/* Ask Cadi */}
        <AskCadi tab="money" />

        {/* Monthly report */}
        <MonthlyReport monthlyData={monthlyData} expenses={expenses} accounts={accounts} />

        {/* P&L waterfall */}
        <PnLWaterfall period={period} monthlyData={monthlyData} accounts={accounts}
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

        {/* Tax estimate — sole trader only; Ltd companies get the full CT dashboard */}
        {accounts.entityType !== 'limited_company' && (
          <TaxEstimate monthlyData={monthlyData} expenses={expenses} accounts={accounts} />
        )}

        {/* Ltd company CT dashboard */}
        {accounts.entityType === 'limited_company' && (
          <LtdMoneyDashboard accounts={accounts} expenses={expenses} monthlyData={monthlyData} />
        )}

        {/* Tax savings counter — reward for tracking expenses (both business types) */}
        <TaxSavingsCounter expenses={expenses} monthlyData={monthlyData} accounts={accounts} />

        {/* Real take-home breakdown — sole traders only (Ltd uses CT dashboard above) */}
        {accounts.entityType !== 'limited_company' && (
          <RealTakeHome monthlyData={monthlyData} expenses={expenses} />
        )}

        {/* Mileage — setup prompt (first visit) then ongoing card */}
        {isLive && !accounts.mileageSetupDone && (
          <MileageSetupCard onSetupComplete={handleMileageSetup} />
        )}
        {isLive && accounts.mileageSetupDone && (
          <MileageCard
            mileageLogs={mileageLogs}
            ytdMilesAtSetup={accounts.ytdMilesAtSetup ?? 0}
            typicalWeeklyMiles={accounts.typicalWeeklyMiles}
            taxRate={accounts.entityType === 'limited_company' ? 0.19 : 0.26}
            onLog={handleLogMileage}
          />
        )}

        {/* Expense sorter */}
        <ExpenseSorter
          expenses={expenses}
          onAdd={handleAddExpense}
          onBulkCategorize={handleBulkCategorize}
          onBulkDelete={handleBulkDelete}
          bankConnected={bankTxs.length > 0}
          onRecategorizeBankExpense={handleRecategorizeBankExpense}
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
            {" "}· Bank transactions via open banking
          </p>
        </div>
      </div>

      {/* Modals */}
      {showPayment  && <LogPaymentModal invoices={unpaidInvoices} onConfirm={handlePaymentConfirm} onClose={() => setShowPayment(false)} />}
      {showReminder && <ReminderModal   invoice={reminderInv}    onClose={() => setShowReminder(false)} />}

      {/* Bulk delete undo snackbar — 8-second window before the DB delete fires */}
      {pendingDelete && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-xl bg-slate-900 border border-white/10 shadow-2xl flex items-center gap-4">
          <p className="text-sm text-white">
            Deleted {pendingDelete.ids.length} expense{pendingDelete.ids.length === 1 ? '' : 's'}.
          </p>
          <button
            onClick={undoBulkDelete}
            className="text-xs font-bold text-amber-300 hover:text-amber-200 transition-colors uppercase tracking-wider"
          >
            Undo
          </button>
        </div>
      )}
    </div>
  );
}
