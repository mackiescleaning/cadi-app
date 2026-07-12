// src/components/MoneyConfidenceDigest.jsx
// Cadi — Money-confidence redesign (P2 of the accounts foundation).
//
// The visible layer on top of the P1 chart of accounts: it reads the per-business
// chart via useAccountsChart and re-frames bank/statement transactions as the four
// tax-meaningful lanes (money in · business costs · personal · transfers), shows a
// trust bar (who sorted each one — you / the bank / Cadi), and runs a lightweight
// spot-check so the user confirms a few of Cadi's guesses and earns confidence in
// the numbers.
//
// Personal spend is framed per entity type — "Drawings" for a sole trader, a
// "Director's loan" for a limited company — straight from business_tax_profile.
//
// Props:
//   bankTxs      — the `transactions` rows already loaded by OpenBankingBanner
//   onCategorise — (txId, isBusiness, category) => Promise; the banner's handler,
//                  which persists via yapily-api and propagates the merchant rule.

import { useMemo, useState } from 'react';
import { useAccountsChart } from '../hooks/useAccountsChart';

const fmt = (n) => `£${Math.abs(Math.round(Number(n) || 0)).toLocaleString()}`;

// A transaction still needs review (not yet in a lane) — mirror OpenBankingBanner's rule.
const isReview = (t) =>
  t.is_business === null || (t.category === 'uncategorised' && t.categorised_by !== 'user');

// Trust tier per categorised_by — drives the segmented confidence bar.
const TRUST = {
  user: {
    label: 'You confirmed',
    bar: 'bg-emerald-400',
    dot: 'bg-emerald-400',
    text: 'text-emerald-300',
  },
  bank: { label: "Bank's label", bar: 'bg-sky-400', dot: 'bg-sky-400', text: 'text-sky-300' },
  cadi_ai: {
    label: 'Cadi sorted',
    bar: 'bg-violet-400',
    dot: 'bg-violet-400',
    text: 'text-violet-300',
  },
};
const trustKey = (by) => (by === 'user' ? 'user' : by === 'bank' ? 'bank' : 'cadi_ai');

export default function MoneyConfidenceDigest({ bankTxs = [], onCategorise }) {
  const { chartByKey, byLane, laneMeta, personalLabel, laneOf, labelOf, metaOf, loading } =
    useAccountsChart();

  const [busyId, setBusyId] = useState(null);
  const [skipped, setSkipped] = useState([]); // spot-check ids the user waved through
  const [editingId, setEditingId] = useState(null);

  // Sort every laned transaction into its lane. Transfers are already dropped upstream
  // (the Money tab query filters is_hidden = false), so that lane is usually empty —
  // we surface it only when it has rows.
  const laned = useMemo(() => {
    const acc = { income: [], expense: [], personal: [], transfer: [] };
    for (const t of bankTxs) {
      if (isReview(t)) continue;
      const lane = laneOf(t.category);
      (acc[lane] ?? acc.expense).push(t);
    }
    return acc;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- laneOf is stable per chart load
  }, [bankTxs, chartByKey]);

  const allLaned = useMemo(
    () => [...laned.income, ...laned.expense, ...laned.personal, ...laned.transfer],
    [laned]
  );

  const trust = useMemo(() => {
    const by = { user: 0, bank: 0, cadi_ai: 0 };
    for (const t of allLaned) by[trustKey(t.categorised_by)] += 1;
    return { ...by, total: allLaned.length };
  }, [allLaned]);

  // Spot-check queue: Cadi's own guesses that the user hasn't confirmed yet. Business
  // lanes first (they hit the P&L and tax), capped so it stays a quick nudge.
  const spotQueue = useMemo(
    () =>
      [...laned.expense, ...laned.income, ...laned.personal]
        .filter((t) => t.categorised_by === 'cadi_ai' && !skipped.includes(t.id))
        .slice(0, 4),
    [laned, skipped]
  );

  // Category options for the "change" picker, grouped by lane (transfer excluded —
  // the categorise action only sets business/personal, not the hidden transfer flag).
  const pickerGroups = useMemo(
    () =>
      [
        { lane: 'income', label: laneMeta.income.label, cats: byLane.income },
        { lane: 'expense', label: laneMeta.expense.label, cats: byLane.expense },
        { lane: 'personal', label: laneMeta.personal.label, cats: byLane.personal },
      ].filter((g) => g.cats.length),
    [byLane, laneMeta]
  );

  if (loading || bankTxs.length === 0 || trust.total === 0) return null;

  const laneTotal = (rows) => rows.reduce((s, t) => s + Math.abs(Number(t.amount) || 0), 0);
  const pct = (n) => (trust.total ? Math.round((n / trust.total) * 100) : 0);
  const confirmedPct = pct(trust.user);

  // The four tiles. Transfer only appears when it actually has rows.
  const tiles = [
    { lane: 'income', rows: laned.income },
    { lane: 'expense', rows: laned.expense },
    { lane: 'personal', rows: laned.personal, label: personalLabel },
    ...(laned.transfer.length ? [{ lane: 'transfer', rows: laned.transfer }] : []),
  ];

  const applyChange = async (t, key) => {
    if (!key || !onCategorise) return;
    const lane = laneOf(key);
    const isBusiness = lane === 'income' || lane === 'expense';
    setBusyId(t.id);
    try {
      await onCategorise(t.id, isBusiness, key);
      setEditingId(null);
    } finally {
      setBusyId(null);
    }
  };

  const confirm = async (t) => {
    if (!onCategorise) return;
    setBusyId(t.id);
    try {
      // Re-affirm the current category — the handler stamps categorised_by = 'user',
      // which drops it out of the spot-check queue.
      await onCategorise(t.id, t.is_business, t.category);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mt-3 rounded-2xl border border-[rgba(153,197,255,0.12)] bg-[rgba(5,18,74,0.5)] overflow-hidden">
      {/* Trust header */}
      <div className="px-4 pt-3.5 pb-3 border-b border-[rgba(153,197,255,0.08)]">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-xs font-black text-white">Your money, sorted</p>
          <p className="text-[10px] text-[rgba(153,197,255,0.55)]">
            {confirmedPct >= 90
              ? 'You’ve checked nearly everything'
              : `You’ve confirmed ${confirmedPct}%`}
          </p>
        </div>

        {/* Segmented trust bar */}
        <div className="mt-2 flex h-1.5 rounded-full overflow-hidden bg-[rgba(153,197,255,0.08)]">
          {['user', 'bank', 'cadi_ai'].map((k) =>
            trust[k] > 0 ? (
              <div key={k} className={TRUST[k].bar} style={{ width: `${pct(trust[k])}%` }} />
            ) : null
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {['user', 'bank', 'cadi_ai'].map((k) =>
            trust[k] > 0 ? (
              <span key={k} className="flex items-center gap-1.5 text-[10px]">
                <span className={`w-1.5 h-1.5 rounded-full ${TRUST[k].dot}`} />
                <span className={TRUST[k].text}>{TRUST[k].label}</span>
                <span className="text-[rgba(153,197,255,0.4)]">{trust[k]}</span>
              </span>
            ) : null
          )}
        </div>
      </div>

      {/* Four lanes */}
      <div className="p-3 grid grid-cols-2 gap-2">
        {tiles.map(({ lane, rows, label }) => {
          const meta = laneMeta[lane];
          return (
            <div key={lane} className={`rounded-xl border ${meta.ring} ${meta.fill} px-3 py-2.5`}>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: meta.dot }} />
                <p className={`text-[11px] font-bold ${meta.text}`}>{label ?? meta.label}</p>
              </div>
              <p className="mt-1 text-lg font-black text-white leading-none">
                {meta.sign}
                {fmt(laneTotal(rows))}
              </p>
              <p className="mt-0.5 text-[10px] text-[rgba(153,197,255,0.4)]">
                {rows.length} {rows.length === 1 ? 'item' : 'items'}
              </p>
            </div>
          );
        })}
      </div>

      {laned.personal.length > 0 && (
        <p className="px-4 -mt-1 pb-1 text-[10px] text-[rgba(153,197,255,0.4)]">
          {personalLabel === "Director's loan"
            ? 'Personal spend on the business account is money owed back to the company (director’s loan) — not a business cost.'
            : 'Money you took for yourself (drawings) — not a business cost, so it’s kept out of your profit and tax.'}
        </p>
      )}

      {/* Spot-check */}
      {spotQueue.length > 0 && (
        <div className="border-t border-[rgba(153,197,255,0.08)] px-3 py-3">
          <div className="flex items-center gap-1.5 px-1 mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
            <p className="text-[11px] font-black text-violet-200">
              Quick check — did Cadi get these right?
            </p>
          </div>
          <div className="space-y-1.5">
            {spotQueue.map((t) => {
              const meta = metaOf(t.category);
              const busy = busyId === t.id;
              const editing = editingId === t.id;
              return (
                <div
                  key={t.id}
                  className="rounded-xl bg-[rgba(153,197,255,0.05)] border border-[rgba(153,197,255,0.08)] px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-white truncate">
                        {t.merchant_name || t.description || 'Transaction'}
                      </p>
                      <p className="text-[10px] text-[rgba(153,197,255,0.5)]">
                        {fmt(t.amount)} · Cadi called it{' '}
                        <span className="text-[#99c5ff] font-semibold">
                          {meta?.emoji ? `${meta.emoji} ` : ''}
                          {labelOf(t.category)}
                        </span>
                      </p>
                    </div>
                    {!editing && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => confirm(t)}
                          disabled={busy}
                          className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/25 text-emerald-300 text-[10px] font-black hover:bg-emerald-500/25 transition-colors disabled:opacity-50"
                        >
                          {busy ? '…' : '✓ Right'}
                        </button>
                        <button
                          onClick={() => setEditingId(t.id)}
                          disabled={busy}
                          className="px-2.5 py-1 rounded-lg bg-[rgba(153,197,255,0.08)] border border-[rgba(153,197,255,0.15)] text-[rgba(153,197,255,0.7)] text-[10px] font-black hover:text-white transition-colors disabled:opacity-50"
                        >
                          Change
                        </button>
                        <button
                          onClick={() => setSkipped((s) => [...s, t.id])}
                          disabled={busy}
                          className="text-[rgba(153,197,255,0.35)] hover:text-[rgba(153,197,255,0.7)] transition-colors text-[10px] font-semibold"
                        >
                          Skip
                        </button>
                      </div>
                    )}
                  </div>

                  {editing && (
                    <div className="mt-2 flex items-center gap-2">
                      <select
                        autoFocus
                        defaultValue={t.category}
                        disabled={busy}
                        onChange={(e) => applyChange(t, e.target.value)}
                        className="flex-1 min-w-0 rounded-lg bg-[#05124a] border border-[rgba(153,197,255,0.2)] text-white text-xs px-2 py-1.5 focus:outline-none focus:border-[#4f78ff]"
                      >
                        {pickerGroups.map((g) => (
                          <optgroup key={g.lane} label={g.label}>
                            {g.cats.map((c) => (
                              <option key={c.key} value={c.key}>
                                {c.emoji ? `${c.emoji} ` : ''}
                                {c.label}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                      <button
                        onClick={() => setEditingId(null)}
                        disabled={busy}
                        className="text-[rgba(153,197,255,0.4)] hover:text-white transition-colors text-lg leading-none px-1"
                      >
                        ×
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
