// src/components/MoneyConfidenceDigest.jsx
// Cadi — Money-confidence redesign (P2 of the accounts foundation).
//
// The visible layer on top of the P1 chart of accounts: it reads the per-business
// chart via useAccountsChart and re-frames bank/statement transactions as the four
// tax-meaningful lanes (money in · business costs · personal · transfers), shows a
// trust bar (who sorted each one — you / the bank / Cadi), and lets the user open any
// lane to review + correct what's inside. That control is what turns "auto-sorted"
// into money confidence.
//
// Personal spend is framed per entity type — "Drawings" for a sole trader, a
// "Director's loan" for a limited company — straight from business_tax_profile.
//
// Props:
//   bankTxs      — the `transactions` rows already loaded by OpenBankingBanner
//   onCategorise — (txId, isBusiness, category) => Promise; the banner's handler,
//                  which persists via yapily-api and propagates the merchant rule.

import { useEffect, useMemo, useState } from 'react';
import { useAccountsChart } from '../hooks/useAccountsChart';

const fmt = (n) => `£${Math.abs(Math.round(Number(n) || 0)).toLocaleString()}`;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const shortDate = (d) => {
  if (!d) return '';
  const [y, m, dd] = String(d).slice(0, 10).split('-'); // eslint-disable-line no-unused-vars
  return m ? `${Number(dd)} ${MONTHS[Number(m) - 1]}` : '';
};

// A transaction still needs review (not yet in a lane) — mirror OpenBankingBanner's rule.
const isReview = (t) =>
  t.is_business === null || (t.category === 'uncategorised' && t.categorised_by !== 'user');

// Trust tier per categorised_by — drives the segmented confidence bar + per-row badge.
const TRUST = {
  user: {
    label: 'You confirmed',
    short: 'You',
    bar: 'bg-emerald-400',
    dot: 'bg-emerald-400',
    text: 'text-emerald-300',
  },
  bank: {
    label: "Bank's label",
    short: 'Bank',
    bar: 'bg-sky-400',
    dot: 'bg-sky-400',
    text: 'text-sky-300',
  },
  cadi_ai: {
    label: 'Cadi sorted',
    short: 'Cadi',
    bar: 'bg-violet-400',
    dot: 'bg-violet-400',
    text: 'text-violet-300',
  },
};
const trustKey = (by) => (by === 'user' ? 'user' : by === 'bank' ? 'bank' : 'cadi_ai');

const LANE_PAGE = 40; // rows rendered per "page" inside a lane before "show more"

export default function MoneyConfidenceDigest({ bankTxs = [], onCategorise }) {
  const { chartByKey, byLane, laneMeta, personalLabel, laneOf, labelOf, metaOf, loading } =
    useAccountsChart();

  const [busyId, setBusyId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [openLane, setOpenLane] = useState(null); // which lane's review is expanded
  const [query, setQuery] = useState('');
  const [cap, setCap] = useState(LANE_PAGE);

  // Reset the review view whenever the open lane changes.
  useEffect(() => {
    setQuery('');
    setCap(LANE_PAGE);
    setEditingId(null);
  }, [openLane]);

  // Sort every laned transaction into its lane. Transfers are already dropped upstream
  // (the Money tab query filters is_hidden = false), so that lane is usually empty.
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
    // Re-affirm the current category — the handler stamps categorised_by = 'user',
    // which moves it into the "You confirmed" segment of the trust bar.
    setBusyId(t.id);
    try {
      await onCategorise(t.id, t.is_business, t.category);
    } finally {
      setBusyId(null);
    }
  };

  // ── A single reviewable transaction row (used inside the lane drilldown) ──────────
  const TxRow = ({ t }) => {
    const meta = metaOf(t.category);
    const src = TRUST[trustKey(t.categorised_by)];
    const busy = busyId === t.id;
    const editing = editingId === t.id;
    return (
      <div className="px-3 py-2 rounded-xl bg-[rgba(153,197,255,0.04)] border border-[rgba(153,197,255,0.07)]">
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-white truncate">
              {t.merchant_name || t.description || 'Transaction'}
            </p>
            <p className="text-[10px] text-[rgba(153,197,255,0.45)] flex items-center gap-1.5">
              <span>{shortDate(t.transaction_date || t.date)}</span>
              <span className={`inline-flex items-center gap-1 ${src.text}`}>
                <span className={`w-1 h-1 rounded-full ${src.dot}`} />
                {src.short}
              </span>
            </p>
          </div>
          <p
            className={`shrink-0 text-sm font-black tabular-nums ${
              Number(t.amount) > 0 ? 'text-emerald-300' : 'text-white'
            }`}
          >
            {Number(t.amount) > 0 ? '+' : '−'}
            {fmt(t.amount)}
          </p>
        </div>

        <div className="mt-1.5 flex items-center justify-between gap-2">
          {!editing ? (
            <>
              <span className="min-w-0 truncate text-[10px] font-semibold text-[#99c5ff]">
                {meta?.emoji ? `${meta.emoji} ` : ''}
                {labelOf(t.category)}
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                {t.categorised_by !== 'user' && (
                  <button
                    onClick={() => confirm(t)}
                    disabled={busy}
                    className="px-2 py-0.5 rounded-lg bg-emerald-500/15 border border-emerald-500/25 text-emerald-300 text-[10px] font-black hover:bg-emerald-500/25 transition-colors disabled:opacity-50"
                  >
                    {busy ? '…' : '✓ Right'}
                  </button>
                )}
                <button
                  onClick={() => setEditingId(t.id)}
                  disabled={busy}
                  className="px-2 py-0.5 rounded-lg bg-[rgba(153,197,255,0.08)] border border-[rgba(153,197,255,0.15)] text-[rgba(153,197,255,0.7)] text-[10px] font-black hover:text-white transition-colors disabled:opacity-50"
                >
                  {t.categorised_by === 'user' ? 'Change' : 'Move'}
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2 w-full">
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
      </div>
    );
  };

  // ── The expanded review for the open lane ────────────────────────────────────────
  const renderLaneReview = () => {
    const meta = laneMeta[openLane];
    const label = openLane === 'personal' ? personalLabel : meta.label;
    const rows = laned[openLane] ?? [];
    const q = query.trim().toLowerCase();
    const filtered = (
      q
        ? rows.filter((t) => (t.merchant_name || t.description || '').toLowerCase().includes(q))
        : rows
    )
      .slice()
      .sort((a, b) => Math.abs(Number(b.amount) || 0) - Math.abs(Number(a.amount) || 0));
    const shown = filtered.slice(0, cap);

    return (
      <div className="border-t border-[rgba(153,197,255,0.08)]">
        <div className="px-4 pt-3 pb-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: meta.dot }} />
            <p className={`text-xs font-black ${meta.text}`}>{label}</p>
            <span className="text-[10px] text-[rgba(153,197,255,0.4)]">
              {rows.length} · {meta.sign}
              {fmt(laneTotal(rows))}
            </span>
          </div>
          <button
            onClick={() => setOpenLane(null)}
            className="shrink-0 text-[10px] font-bold text-[rgba(153,197,255,0.5)] hover:text-white transition-colors"
          >
            Close ×
          </button>
        </div>

        {rows.length > 8 && (
          <div className="px-4 pb-2">
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setCap(LANE_PAGE);
              }}
              placeholder="Search this lane…"
              className="w-full rounded-lg bg-[rgba(153,197,255,0.06)] border border-[rgba(153,197,255,0.12)] text-white text-xs px-3 py-1.5 placeholder:text-[rgba(153,197,255,0.35)] focus:outline-none focus:border-[#4f78ff]"
            />
          </div>
        )}

        <div className="px-3 pb-3 space-y-1.5 max-h-[26rem] overflow-y-auto">
          {shown.length === 0 ? (
            <p className="px-1 py-4 text-center text-[11px] text-[rgba(153,197,255,0.4)]">
              Nothing matches “{query}”.
            </p>
          ) : (
            shown.map((t) => <TxRow key={t.id} t={t} />)
          )}
          {filtered.length > shown.length && (
            <button
              onClick={() => setCap((c) => c + LANE_PAGE)}
              className="w-full py-2 rounded-lg bg-[rgba(153,197,255,0.06)] border border-[rgba(153,197,255,0.1)] text-[11px] font-bold text-[#99c5ff] hover:bg-[rgba(153,197,255,0.1)] transition-colors"
            >
              Show more · {shown.length} of {filtered.length}
            </button>
          )}
        </div>
      </div>
    );
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

      {/* Four lanes — each opens a review */}
      <div className="p-3 grid grid-cols-2 gap-2">
        {tiles.map(({ lane, rows, label }) => {
          const meta = laneMeta[lane];
          const active = openLane === lane;
          return (
            <button
              key={lane}
              type="button"
              onClick={() => setOpenLane(active ? null : lane)}
              className={`text-left rounded-xl border ${meta.ring} ${meta.fill} px-3 py-2.5 transition-all hover:brightness-125 ${
                active ? 'ring-2 ring-[#4f78ff]/60' : ''
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: meta.dot }} />
                <p className={`text-[11px] font-bold ${meta.text}`}>{label ?? meta.label}</p>
              </div>
              <p className="mt-1 text-lg font-black text-white leading-none">
                {meta.sign}
                {fmt(laneTotal(rows))}
              </p>
              <p className="mt-0.5 text-[10px] text-[rgba(153,197,255,0.4)] flex items-center justify-between">
                <span>
                  {rows.length} {rows.length === 1 ? 'item' : 'items'}
                </span>
                <span
                  className={`font-bold ${active ? 'text-[#99c5ff]' : 'text-[rgba(153,197,255,0.5)]'}`}
                >
                  {active ? 'Close ▾' : 'Review ▸'}
                </span>
              </p>
            </button>
          );
        })}
      </div>

      {laned.personal.length > 0 && !openLane && (
        <p className="px-4 -mt-1 pb-1 text-[10px] text-[rgba(153,197,255,0.4)]">
          {personalLabel === "Director's loan"
            ? 'Personal spend on the business account is money owed back to the company (director’s loan) — not a business cost.'
            : 'Money you took for yourself (drawings) — not a business cost, so it’s kept out of your profit and tax.'}
        </p>
      )}

      {/* Expanded lane review */}
      {openLane && renderLaneReview()}
    </div>
  );
}
