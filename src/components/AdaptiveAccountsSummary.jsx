// src/components/AdaptiveAccountsSummary.jsx
// Cadi — Adaptive Accounts summary (P3, Layer 2 of the accounts foundation).
//
// One derived, entity-aware view of where the business stands this tax year, built
// straight off the chart of accounts + business_tax_profile — no filing, no new data:
//
//   turnover        = income lane            (useYtdIncome: invoices + bank + manual)
//   allowable costs = expense lane where chart.is_allowable  (useYtdExpenses by category)
//   profit          = turnover − allowable costs
//   set aside       = income tax + Class 4 NIC (sole trader) | corporation tax (Ltd)
//   personal        = personal lane → "Drawings" (ST) | "Director's loan" (Ltd)
//   VAT             = flagged when registered; box breakdown deferred to the VAT engine
//
// Everything is indicative — the accountant files the return. Same chart/structure
// source as the Money tab digest ([[MoneyConfidenceDigest]]) and the Dashboard hero,
// so the three surfaces always speak the same language.

import { useEffect, useMemo, useState } from 'react';
import { useInvoices, invTotal } from '../context/InvoiceContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { resolveBusinessId } from '../lib/db/accountsDb';
import { useAccountsChart } from '../hooks/useAccountsChart';
import { useYtdIncome } from '../hooks/useYtdIncome';
import { useYtdExpenses } from '../hooks/useYtdExpenses';
import { calcSelfEmployedTax, calculateCT } from '../lib/taxCalc';
import { currentTaxYear, taxYearLabel } from '../lib/taxYear';

const fmt = (n) => `£${Math.abs(Math.round(Number(n) || 0)).toLocaleString()}`;

// Personal-lane spend for the tax year — money taken out for the owner. These are the
// is_business = false debits (drawings / director's-loan draws); they never hit the P&L.
function usePersonalLaneTotal(taxYear, enabled = true) {
  const [state, setState] = useState({ total: 0, loading: true });
  useEffect(() => {
    if (!enabled) {
      setState({ total: 0, loading: false });
      return;
    }
    let mounted = true;
    (async () => {
      try {
        const businessId = await resolveBusinessId();
        if (!mounted) return;
        if (!businessId) {
          setState({ total: 0, loading: false });
          return;
        }
        const { data } = await supabase
          .from('transactions')
          .select('amount')
          .eq('business_id', businessId)
          .gte('transaction_date', `${taxYear}-04-06`)
          .lte('transaction_date', `${taxYear + 1}-04-05`)
          .eq('is_business', false)
          .lt('amount', 0);
        if (!mounted) return;
        const total = (data ?? []).reduce((s, r) => s + Math.abs(Number(r.amount) || 0), 0);
        setState({ total, loading: false });
      } catch (e) {
        console.error('usePersonalLaneTotal error:', e);
        if (mounted) setState({ total: 0, loading: false });
      }
    })();
    return () => {
      mounted = false;
    };
  }, [taxYear, enabled]);
  return state;
}

export default function AdaptiveAccountsSummary({ onNavigate }) {
  const { user } = useAuth();
  const isDemo = user?.id === 'demo-user';
  const { invoices } = useInvoices();
  const taxYear = currentTaxYear();

  const {
    chartByKey,
    isLtd,
    personalLabel,
    taxProfile,
    loading: chartLoading,
  } = useAccountsChart();

  const paidInvoiceRows = useMemo(
    () =>
      invoices
        .filter((i) => i.status === 'paid' && i.paidAt)
        .map((i) => ({ id: i.id, paidAt: i.paidAt, _total: invTotal(i) })),
    [invoices]
  );

  const incomeData = useYtdIncome(taxYear, paidInvoiceRows);
  const expData = useYtdExpenses(taxYear);
  const personalData = usePersonalLaneTotal(taxYear, !isDemo);

  // Allowable vs disallowable costs — split the expense lane by chart.is_allowable.
  // Unknown categories default to the expense lane and count as allowable (matches the
  // import engine's laneOf fallback); anything the accountant flags is_allowable = false
  // is surfaced separately so profit stays a true taxable figure.
  const { allowable, disallowed } = useMemo(() => {
    let allow = 0;
    let disallow = 0;
    for (const [cat, amt] of Object.entries(expData.byCategory ?? {})) {
      const row = chartByKey[cat];
      const lane = row?.lane ?? 'expense';
      if (lane !== 'expense') continue; // personal/transfer never count as a business cost
      if (row && row.is_allowable === false) disallow += amt;
      else allow += amt;
    }
    return { allowable: allow, disallowed: disallow };
  }, [expData.byCategory, chartByKey]);

  const loading =
    !isDemo && (chartLoading || incomeData.loading || expData.loading || personalData.loading);

  // Demo figures keep the card coherent alongside the rest of the (demo-seeded) tab.
  const turnover = isDemo ? 41820 : incomeData.ytdTotal;
  const allowableCosts = isDemo ? 557 : allowable;
  const disallowedCosts = isDemo ? 0 : disallowed;
  const personal = isDemo ? 9600 : personalData.total;

  const profit = Math.max(0, turnover - allowableCosts);
  const seTax = calcSelfEmployedTax(profit);
  const ctDue = calculateCT(profit);
  const taxToSetAside = isLtd ? ctDue : seTax.total;
  const vatRegistered = !!taxProfile?.vat_registered;

  if (loading) {
    return (
      <div className="rounded-2xl border border-[rgba(153,197,255,0.12)] bg-[rgba(5,18,74,0.5)] p-5">
        <div className="h-4 w-40 rounded bg-[rgba(153,197,255,0.12)] animate-pulse" />
        <div className="mt-3 h-8 w-32 rounded bg-[rgba(153,197,255,0.1)] animate-pulse" />
      </div>
    );
  }

  const taxSub = isLtd
    ? profit > 0
      ? 'Corporation tax · 19–25%'
      : 'No profit yet'
    : seTax.total > 0
      ? `Income tax ${fmt(seTax.incomeTax)} + Class 4 NIC ${fmt(seTax.ni)}`
      : 'Under the personal allowance — no tax due yet';

  const Row = ({ label, sub, value, tone = 'default', strong = false, sign = '' }) => (
    <div className="flex items-start justify-between gap-3 py-2">
      <div className="min-w-0">
        <p
          className={`${strong ? 'text-sm font-black text-white' : 'text-xs font-bold text-[rgba(153,197,255,0.85)]'}`}
        >
          {label}
        </p>
        {sub && (
          <p className="text-[10px] text-[rgba(153,197,255,0.45)] mt-0.5 leading-snug">{sub}</p>
        )}
      </div>
      <p
        className={`shrink-0 tabular-nums font-black ${strong ? 'text-lg' : 'text-sm'} ${
          {
            default: 'text-white',
            good: 'text-emerald-300',
            cost: 'text-amber-300',
            tax: 'text-rose-300',
            personal: 'text-orange-300',
          }[tone]
        }`}
      >
        {sign}
        {value}
      </p>
    </div>
  );

  return (
    <div className="rounded-2xl border border-[rgba(153,197,255,0.14)] bg-[rgba(5,18,74,0.55)] overflow-hidden">
      <div className="px-5 pt-4 pb-3 border-b border-[rgba(153,197,255,0.08)] flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-[rgba(153,197,255,0.5)]">
            Where you stand · {taxYearLabel()}
          </p>
          <p className="text-sm font-black text-white mt-0.5">
            {isLtd ? "Your company's position" : 'Your position'}
          </p>
        </div>
        <span
          className={`shrink-0 text-[10px] font-black px-2.5 py-1 rounded-full border ${
            isLtd
              ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300'
              : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
          }`}
        >
          {isLtd ? 'Limited company' : 'Sole trader'}
        </span>
      </div>

      <div className="px-5 py-2 divide-y divide-[rgba(153,197,255,0.06)]">
        <Row
          label="Turnover"
          sub="Money in — invoices, bank & cash"
          value={fmt(turnover)}
          tone="good"
        />
        <Row
          label="Allowable costs"
          sub={
            disallowedCosts > 0
              ? `Tax-deductible spend · ${fmt(disallowedCosts)} more isn't deductible`
              : 'Tax-deductible business spend'
          }
          value={fmt(allowableCosts)}
          tone="cost"
          sign="−"
        />
        <Row label="Profit so far" value={fmt(profit)} tone="default" strong />
        <Row label="Set aside for tax" sub={taxSub} value={fmt(taxToSetAside)} tone="tax" />
        <Row
          label={`${personalLabel} taken`}
          sub={
            isLtd
              ? "Money drawn personally — owed back as a director's loan, not a cost"
              : "Money you've drawn for yourself — not a business cost"
          }
          value={fmt(personal)}
          tone="personal"
        />
        {vatRegistered && (
          <Row
            label="VAT"
            sub="Registered — reconciled on your VAT return, not counted here"
            value="Tracked"
            tone="default"
          />
        )}
      </div>

      <div className="px-5 py-3 border-t border-[rgba(153,197,255,0.08)] flex items-center justify-between gap-3">
        <p className="text-[10px] text-[rgba(153,197,255,0.4)] leading-snug">
          Indicative figures from your categorised money — your accountant files the return.
        </p>
        {onNavigate && (
          <button
            onClick={() => onNavigate('money')}
            className="shrink-0 text-[10px] font-black text-[#99c5ff] hover:text-white transition-colors"
          >
            Review money →
          </button>
        )}
      </div>
    </div>
  );
}
