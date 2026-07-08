// Step 3 — Review what Cadi pulled out.
// Three buckets per the migration spec: Ready / Nearly / Decision.
// Every field inline-editable. Cards in the Decision bucket nudge the user
// to type a frequency; Nearly cards nudge for a date. Once both are filled
// the card moves to Ready automatically.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Check,
  X,
  Pencil,
  AlertCircle,
  Calendar,
  RotateCw,
  MapPin,
  ArrowLeft,
  Trash2,
  Crown,
} from 'lucide-react';
import {
  listParsedForSession,
  updateParsedCustomer,
  deleteParsedCustomer,
  bulkApplyServiceToMissing,
  bulkApplyDivisionToMissing,
  commitParsedToCustomers,
  countActiveCustomers,
  updateStep,
  customerReadiness,
  rollAnchorForward,
} from '../../lib/db/onboardingDb';
import { parseFrequency } from '../../lib/migration/parsers';
import { lookupPostcode, searchAddresses } from '../../lib/postcode';
import { usePlan, FREE_CUSTOMER_LIMIT } from '../../hooks/usePlan';

const CATEGORIES = [
  { key: 'residential', label: 'Residential', accent: '#1f48ff' },
  { key: 'exterior', label: 'Exterior', accent: '#10b981' },
  { key: 'commercial', label: 'Commercial', accent: '#f59e0b' },
];

// Quick-pick service chips by division. Hand-picked so most cleaning
// businesses see their typical service in one tap, with a "Custom" fallback
// to the free-text input for everything else.
// These labels also seed generate-service-menu later — same casing, same
// language the owner thinks in. Don't be cute.
const SERVICE_SUGGESTIONS = {
  residential: [
    'Regular clean',
    'Deep clean',
    'End of tenancy',
    'Airbnb turnover',
    'Oven clean',
    'Carpet clean',
  ],
  exterior: [
    'Windows',
    'Gutters',
    'Conservatory',
    'Fascia & soffit',
    'Driveway',
    'Patio',
    'Softwash',
    'Roof',
  ],
  commercial: [
    // Interior commercial
    'Office clean',
    'Retail clean',
    'Pub / restaurant',
    'Periodic deep',
    'Contract clean',
    'School',
    // Commercial-exterior — windows / gutters / etc done for businesses,
    // typically larger jobs at higher prices than the residential equivalents.
    'Commercial windows',
    'Commercial gutters',
    'Commercial fascia & soffit',
    'Commercial driveway / car park',
    'Commercial pressure wash',
    'Commercial softwash',
  ],
};

const BUCKETS = [
  {
    key: 'ready',
    label: 'Ready to schedule',
    blurb: "Frequency and date both clear — I'll book these straight away.",
    badgeStyle: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    barColor: '#10b981',
  },
  {
    key: 'nearly',
    label: 'Nearly there',
    blurb: 'Got the frequency, need a date to start from.',
    badgeStyle: 'bg-amber-50 text-amber-700 border-amber-200',
    barColor: '#f59e0b',
  },
  {
    key: 'decision',
    label: 'Needs a decision',
    blurb: 'One-offs and ad-hoc. Add a frequency to schedule them, or keep on file.',
    badgeStyle: 'bg-[#f0f4ff] text-[#1f48ff] border-[#1f48ff]/15',
    barColor: '#1f48ff',
  },
];

// A stable key per distinct customer — MUST match customerKey() in
// commitParsedToCustomers so the customers the UI lets you pick are the same
// ones the commit actually brings in.
function customerKeyOf(r) {
  if (r.customer_ref && String(r.customer_ref).trim()) return `ref:${r.customer_ref.trim()}`;
  return `np:${String(r.name ?? '')
    .trim()
    .toLowerCase()}::${String(r.postcode ?? '')
    .replace(/\s/g, '')
    .toUpperCase()}`;
}

export default function StepReview({ session, onAdvance }) {
  const navigate = useNavigate();
  const { isPro } = usePlan();
  const [rows, setRows] = useState(null); // null = loading
  const [existingCount, setExistingCount] = useState(0); // active customers already on the account
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState(null);
  const [edits, setEdits] = useState({}); // pending edits by row id
  // Refs to each rendered ParsedRow so the "X still need details" banner
  // can scroll the first unready card into view + open its edit drawer.
  const rowRefs = useRef(new Map());
  const [focusedRowId, setFocusedRowId] = useState(null);
  const [forceExpandId, setForceExpandId] = useState(null);
  // Lite "choose your 30" — the customer keys the user has picked to bring in
  // now. Only used when over the cap. Seeded once with the first `headroom`.
  const [selectedKeys, setSelectedKeys] = useState(() => new Set());
  const selectionSeeded = useRef(false);

  const load = async () => {
    try {
      const [fresh, cnt] = await Promise.all([
        listParsedForSession(session.id),
        countActiveCustomers().catch(() => 0),
      ]);
      setRows(fresh);
      setExistingCount(cnt);
    } catch (e) {
      setError(e?.message ?? "Couldn't load your customers.");
    }
  };

  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Seed the picker once: preselect the first `headroom` customers so a Lite
  // user who just wants "the first 30" can commit without touching anything,
  // but can swap any of them out.
  useEffect(() => {
    if (rows == null || selectionSeeded.current) return;
    const keys = [];
    const seen = new Set();
    rows
      .filter((r) => r.keep)
      .forEach((r) => {
        const k = customerKeyOf(r);
        if (!seen.has(k)) {
          seen.add(k);
          keys.push(k);
        }
      });
    const hr = Math.max(0, FREE_CUSTOMER_LIMIT - existingCount);
    if (!isPro && keys.length > hr && hr > 0) {
      setSelectedKeys(new Set(keys.slice(0, hr)));
      selectionSeeded.current = true;
    }
  }, [rows, existingCount, isPro]);

  const grouped = useMemo(() => {
    const out = { ready: [], nearly: [], decision: [] };
    (rows ?? []).forEach((r) => (out[r.bucket] ?? out.decision).push(r));
    return out;
  }, [rows]);

  const kept = (rows ?? []).filter((r) => r.keep);
  const keptCount = kept.length;

  // Distinct customers across the kept jobs (so the user sees "168 jobs for
  // 53 customers", not just "168 jobs"), in commit order.
  const keptKeysInOrder = [];
  const keptKeySet = new Set();
  kept.forEach((r) => {
    const k = customerKeyOf(r);
    if (!keptKeySet.has(k)) {
      keptKeySet.add(k);
      keptKeysInOrder.push(k);
    }
  });
  const distinctCustomers = keptKeysInOrder.length;

  // Lite headroom — how many more customers this account may add before the
  // 30-cap. Pro/Max = unlimited.
  const headroom = Math.max(0, FREE_CUSTOMER_LIMIT - existingCount);
  const overCap = !isPro && distinctCustomers > headroom;

  // Over the cap, the user hand-picks which customers to bring in.
  // effectiveSelected = current picks that are still in the kept set (a pick
  // whose card was dropped/deleted drops out of the selection automatically).
  const effectiveSelected = new Set([...selectedKeys].filter((k) => keptKeySet.has(k)));
  const atSelectionCap = effectiveSelected.size >= headroom;

  const importKeys = overCap ? effectiveSelected : keptKeySet;
  const willImportCount = overCap ? effectiveSelected.size : distinctCustomers;

  const toggleSelect = (key) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
        return next;
      }
      // Cap against the still-kept picks so we never exceed the Lite headroom.
      const effCount = [...next].filter((k) => keptKeySet.has(k)).length;
      if (effCount >= headroom) return prev;
      next.add(key);
      return next;
    });
  };

  // Readiness is judged only on the rows we'll actually commit — a Lite user
  // shouldn't have to perfect 148 cards just to bring in their chosen 30.
  const importRows = kept.filter((r) => importKeys.has(customerKeyOf(r)));
  const readyKept = importRows.filter((r) => customerReadiness(r).ready);
  const notReadyKept = importRows.filter((r) => !customerReadiness(r).ready);
  const allReady = importRows.length > 0 && notReadyKept.length === 0;

  // Click handler for the banner + disabled CTA. Finds the first kept-but-
  // not-ready card, scrolls it into view, opens its Edit Details drawer,
  // and gives it a brief glow so the user spots where they landed.
  const jumpToFirstUnready = (cycleId = null) => {
    if (!notReadyKept.length) return;
    let target;
    if (cycleId) {
      // "Next" — find the next unready row after the one we just focused
      const idx = notReadyKept.findIndex((r) => r.id === cycleId);
      target = notReadyKept[(idx + 1) % notReadyKept.length];
    } else {
      target = notReadyKept[0];
    }
    if (!target) return;
    const el = rowRefs.current.get(target.id);
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    setFocusedRowId(target.id);
    setForceExpandId(target.id);
    // Clear the glow after ~1.6s so it doesn't stick around.
    window.setTimeout(() => setFocusedRowId((curr) => (curr === target.id ? null : curr)), 1600);
  };

  const commit = async () => {
    setError(null);
    setCommitting(true);
    try {
      const includeIds = overCap
        ? kept.filter((row) => effectiveSelected.has(customerKeyOf(row))).map((row) => row.id)
        : null;
      const r = await commitParsedToCustomers(session.id, overCap ? { includeIds } : {});
      await updateStep(session.id, 'menu_review');
      onAdvance({ ...session, step: 'menu_review' });
      // For now Step 4 isn't built — drop them on Customers so they see results.
      navigate('/customers', { state: { onboardingDone: r } });
    } catch (e) {
      setError(e?.message ?? "Couldn't bring them in. Try again?");
      setCommitting(false);
    }
  };

  if (rows === null) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-[#1f48ff] border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-full flex flex-col items-center px-3 sm:px-4 py-6 sm:py-10">
      <div className="w-full max-w-2xl">
        {/* Top nav — back to the upload step so the user can swap a stale
            CSV, drop in a fresh export, or add a second file. */}
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={async () => {
              try {
                await updateStep(session.id, 'upload');
                onAdvance({ ...session, step: 'upload' });
              } catch (e) {
                setError(e?.message ?? "Couldn't go back.");
              }
            }}
            className="flex items-center gap-1.5 text-xs font-bold text-[#1f48ff] hover:text-[#010a4f] transition-colors px-2 py-1.5 rounded-lg hover:bg-[#f0f4ff]"
          >
            <ArrowLeft size={14} /> Back to upload
          </button>
          <span className="text-[10px] font-semibold tracking-wider uppercase text-[#010a4f]/45">
            Step 3 of 5
          </span>
        </div>
        <div className="text-center mb-6 sm:mb-8">
          <p className="hidden">Step 3 of 5</p>
          <h1 className="text-2xl sm:text-3xl font-black text-[#010a4f] mb-2 leading-tight">
            Here's what I found.
          </h1>
          <p className="text-sm text-[#010a4f]/60 max-w-md mx-auto mb-3">
            Read the cards. Fix anything I got wrong, add a frequency or a date where I left one
            blank, then bring them in.
          </p>
          {keptCount > 0 && (
            <p className="text-[11px] text-[#010a4f]/60">
              <span className="font-bold text-[#010a4f]">{keptCount}</span> job
              {keptCount === 1 ? '' : 's'} across
              <span className="font-bold text-[#010a4f]"> {distinctCustomers}</span> customer
              {distinctCustomers === 1 ? '' : 's'}
            </p>
          )}
        </div>

        {/* Lite cap heads-up — shown up front, before the user organises cards,
            so there's no surprise at commit time. Two ways forward: upgrade for
            all of them, or bring in the first {headroom} now and add the rest
            after upgrading (nothing is deleted). */}
        {overCap && (
          <div className="mb-6 rounded-2xl border border-[#1f48ff]/20 bg-[#f0f4ff] p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#1f48ff]/10 flex items-center justify-center shrink-0 text-lg">
                🏢
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-[#010a4f]">
                  You've got {distinctCustomers} customers — that's a real business.
                </p>
                <p className="text-xs text-[#010a4f]/60 mt-1 leading-relaxed">
                  Cadi Lite brings in up to {FREE_CUSTOMER_LIMIT} customers.{' '}
                  {headroom > 0 ? (
                    <>
                      Upgrade to Pro for all {distinctCustomers}, or choose the {headroom} you want
                      now — tap the circle on each card. The rest stay saved so you can add them
                      anytime after you upgrade. Nothing's lost.
                    </>
                  ) : (
                    <>
                      You're already at the limit. Upgrade to Pro to bring these {distinctCustomers}{' '}
                      in — they stay saved until you do.
                    </>
                  )}
                </p>
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  <button
                    type="button"
                    onClick={() => navigate('/upgrade')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#1f48ff] hover:bg-[#3a5eff] text-white text-xs font-black transition-colors shadow-lg shadow-[#1f48ff]/20"
                  >
                    <Crown size={14} /> Upgrade to Pro — £39/mo
                  </button>
                  {headroom > 0 && (
                    <span className="text-[11px] font-semibold text-[#010a4f]/50">
                      or choose your {headroom} below ↓
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        <BulkDivisionBar
          rows={rows}
          divisionsPicked={session?.divisions ?? []}
          onApply={async (div) => {
            try {
              const n = await bulkApplyDivisionToMissing(session.id, div);
              if (n > 0) await load();
            } catch (e) {
              setError(e?.message ?? "Couldn't apply that division.");
            }
          }}
        />

        <BulkServiceBar
          rows={rows}
          divisions={session?.divisions ?? []}
          onApply={async (label) => {
            try {
              const n = await bulkApplyServiceToMissing(session.id, label);
              if (n > 0) await load();
            } catch (e) {
              setError(e?.message ?? "Couldn't apply that service.");
            }
          }}
        />

        {BUCKETS.map((b) => {
          const items = grouped[b.key];
          if (!items.length) return null;
          return (
            <section key={b.key} className="mb-8">
              <div className="flex items-center gap-3 mb-3 px-1">
                <h2 className="text-sm font-black text-[#010a4f]">{b.label}</h2>
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${b.badgeStyle}`}
                >
                  {items.length}
                </span>
                <p className="text-[11px] text-[#010a4f]/60 hidden sm:block">{b.blurb}</p>
              </div>
              <div className="space-y-2.5">
                {items.map((row) => (
                  <ParsedRow
                    key={row.id}
                    row={row}
                    bucket={b}
                    selectable={overCap}
                    selected={effectiveSelected.has(customerKeyOf(row))}
                    selectDisabled={!effectiveSelected.has(customerKeyOf(row)) && atSelectionCap}
                    onToggleSelect={() => toggleSelect(customerKeyOf(row))}
                    refSetter={(el) => {
                      if (el) rowRefs.current.set(row.id, el);
                      else rowRefs.current.delete(row.id);
                    }}
                    isFocused={focusedRowId === row.id}
                    forceExpand={forceExpandId === row.id}
                    onForceExpandConsumed={() =>
                      setForceExpandId((curr) => (curr === row.id ? null : curr))
                    }
                    edits={edits[row.id] ?? {}}
                    setEdits={(patch) =>
                      setEdits((prev) => ({
                        ...prev,
                        [row.id]: { ...(prev[row.id] ?? {}), ...patch },
                      }))
                    }
                    onSave={async (patch) => {
                      const next = await updateParsedCustomer(row.id, patch);
                      setRows((prev) => prev.map((r) => (r.id === row.id ? next : r)));
                      setEdits((prev) => {
                        const { [row.id]: _, ...rest } = prev;
                        return rest;
                      });
                    }}
                    onDelete={async () => {
                      // Hard delete — confirm so a mis-tap doesn't nuke a row.
                      const label = row.name || row.address || 'this customer';
                      if (!window.confirm(`Delete ${label}? They won't be brought into Cadi.`))
                        return;
                      try {
                        await deleteParsedCustomer(row.id);
                        setRows((prev) => prev.filter((r) => r.id !== row.id));
                        setEdits((prev) => {
                          const { [row.id]: _, ...rest } = prev;
                          return rest;
                        });
                      } catch (e) {
                        setError(e?.message ?? "Couldn't delete that one.");
                      }
                    }}
                  />
                ))}
              </div>
            </section>
          );
        })}

        {error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
            {error}
          </p>
        )}

        <div className="h-28" />
      </div>

      {/* Sticky commit bar — only enables when every kept row has the
          minimum details (name, contact, service, frequency, next-due). */}
      <div className="sticky bottom-0 left-0 right-0 z-20 bg-white/90 backdrop-blur-md border-t border-[#1f48ff]/15">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-3">
          {overCap && headroom > 0 && (
            <div className="mb-2 flex items-center justify-between gap-2 px-1">
              <span className="text-[11px] font-black text-[#1f48ff]">
                {willImportCount} of {headroom} picked
              </span>
              <span className="text-[10px] font-semibold text-[#010a4f]/45 text-right">
                Tap a card's circle to choose who comes in now
              </span>
            </div>
          )}
          {keptCount > 0 && !allReady && willImportCount > 0 && (
            <button
              type="button"
              onClick={() => jumpToFirstUnready(focusedRowId)}
              className="w-full text-left mb-2 px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-200 hover:border-amber-300 text-[11px] text-amber-700 flex items-center gap-2 transition-all active:scale-[0.99]"
              title={`Jump to ${focusedRowId ? 'the next' : 'the first'} customer that needs details`}
            >
              <AlertCircle size={11} className="text-amber-600 shrink-0" />
              <span className="flex-1">
                <span className="font-bold">{notReadyKept.length}</span> of{' '}
                <span className="font-bold">{willImportCount}</span> still need details before they
                can land.
              </span>
              <span className="text-[10px] font-bold text-amber-700 shrink-0">
                {focusedRowId ? 'Next →' : 'Take me to one →'}
              </span>
            </button>
          )}
          <button
            onClick={
              overCap && headroom === 0
                ? () => navigate('/upgrade')
                : overCap && willImportCount === 0
                  ? undefined
                  : !allReady
                    ? () => jumpToFirstUnready(focusedRowId)
                    : commit
            }
            disabled={
              committing || keptCount === 0 || (overCap && headroom > 0 && willImportCount === 0)
            }
            className={`w-full py-3.5 rounded-xl text-white text-sm font-black shadow-lg transition-all ${
              keptCount === 0 || committing || (overCap && headroom > 0 && willImportCount === 0)
                ? 'bg-[#f0f4ff] border border-[#1f48ff]/15 text-[#010a4f]/45 cursor-not-allowed shadow-none'
                : overCap && headroom === 0
                  ? 'bg-[#1f48ff] hover:bg-[#3a5eff] shadow-[#1f48ff]/30'
                  : !allReady
                    ? 'bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 hover:border-amber-300'
                    : 'bg-[#1f48ff] hover:bg-[#3a5eff] shadow-[#1f48ff]/30'
            }`}
          >
            {committing
              ? 'Bringing them in…'
              : keptCount === 0
                ? 'Nothing kept — toggle a few in'
                : overCap && headroom === 0
                  ? 'Upgrade to bring these in →'
                  : overCap && willImportCount === 0
                    ? 'Pick who to bring in ↑'
                    : !allReady
                      ? `${readyKept.length} ready · ${notReadyKept.length} need details — fix them →`
                      : overCap
                        ? `Bring in ${willImportCount} of ${distinctCustomers} customers →`
                        : `Bring in ${readyKept.length} job${readyKept.length === 1 ? '' : 's'} for ${distinctCustomers} customer${distinctCustomers === 1 ? '' : 's'} →`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Per-row card with inline edit ─────────────────────────────────────────────

function ParsedRow({
  row,
  bucket,
  edits,
  setEdits,
  onSave,
  onDelete,
  refSetter,
  isFocused,
  forceExpand,
  onForceExpandConsumed,
  selectable = false,
  selected = false,
  selectDisabled = false,
  onToggleSelect,
}) {
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);

  // When the "X still need details" banner targets this row, auto-open
  // its Edit Details so the user can fix it immediately.
  useEffect(() => {
    if (forceExpand) {
      setExpanded(true);
      onForceExpandConsumed?.();
    }
  }, [forceExpand, onForceExpandConsumed]);

  // Current "draft" value for any field — edits override row values.
  const v = (field) => (edits[field] !== undefined ? edits[field] : row[field]);

  const dirty = Object.keys(edits).length > 0;
  const keepValue = v('keep');
  // Whether this card is being brought in now: driven by the pick control when
  // over the Lite cap, otherwise by the keep toggle.
  const included = selectable ? selected : keepValue;

  const saveAll = async () => {
    if (!dirty) {
      setExpanded(false);
      return;
    }
    setSaving(true);
    try {
      // If frequency_raw changed, recompute rrule client-side.
      const patch = { ...edits };
      if ('frequency_raw' in patch) {
        const f = parseFrequency(patch.frequency_raw);
        patch.frequency_rrule = f ? freqToRrule(f) : null;
      }
      await onSave(patch);
    } finally {
      setSaving(false);
      setExpanded(false);
    }
  };

  // Quick-save just one field (used for the frequency prompt + date prompt)
  const quickSave = async (patch) => {
    setSaving(true);
    try {
      const merged = { ...patch };
      if ('frequency_raw' in merged) {
        const f = parseFrequency(merged.frequency_raw);
        merged.frequency_rrule = f ? freqToRrule(f) : null;
      }
      await onSave(merged);
    } finally {
      setSaving(false);
    }
  };

  const category = CATEGORIES.find((c) => c.key === v('category'));
  const accent = category?.accent ?? '#1f48ff';

  // Live readiness against the current draft values so the user sees the
  // warning fade away as they fill the missing pieces.
  const draft = useMemo(() => ({ ...row, ...edits }), [row, edits]);
  const readiness = customerReadiness(draft);

  return (
    <div
      ref={refSetter}
      className={`relative rounded-2xl border bg-white transition-all overflow-hidden ${
        isFocused
          ? 'border-amber-400 shadow-xl shadow-amber-200 ring-2 ring-amber-300'
          : !included
            ? 'border-[#1f48ff]/15 opacity-50'
            : selectable && selected
              ? 'border-[#1f48ff]/40 ring-1 ring-[#1f48ff]/20'
              : 'border-[#1f48ff]/15'
      }`}
    >
      <div className="absolute left-0 top-0 bottom-0 w-1" style={{ background: bucket.barColor }} />

      {/* Header row — name + price + keep toggle. Always visible. */}
      <div className="pl-4 pr-3 pt-3 pb-2">
        <div className="flex items-start gap-2">
          <input
            type="text"
            value={v('name') || ''}
            onChange={(e) => setEdits({ name: e.target.value })}
            onBlur={() => {
              if (edits.name !== undefined) quickSave({ name: edits.name });
            }}
            placeholder="No name yet — type one"
            className="flex-1 min-w-0 bg-transparent border-0 border-b border-transparent hover:border-[#1f48ff]/15 focus:border-[#1f48ff] focus:outline-none text-sm font-black text-[#010a4f] py-0.5 placeholder-[#010a4f]/35"
          />
          <input
            type="number"
            inputMode="decimal"
            value={v('price') ?? ''}
            onChange={(e) =>
              setEdits({ price: e.target.value === '' ? null : Number(e.target.value) })
            }
            onBlur={() => {
              if (edits.price !== undefined) quickSave({ price: edits.price });
            }}
            placeholder="£?"
            className="w-16 text-right bg-transparent border-0 border-b border-transparent hover:border-[#1f48ff]/15 focus:border-[#1f48ff] focus:outline-none text-sm font-black text-emerald-600 py-0.5 tabular-nums placeholder-[#010a4f]/35"
          />
          {selectable ? (
            /* Over the Lite cap: pick which customers to bring in now. A round
               control = "chosen"; the keep toggle is retired here since the
               pick is the inclusion decision. Disabled once 30 are chosen. */
            <button
              onClick={onToggleSelect}
              disabled={selectDisabled}
              aria-label={selected ? 'Remove from this import' : 'Bring in now'}
              title={
                selected
                  ? 'Chosen — will be brought in now'
                  : selectDisabled
                    ? "You've chosen 30 — remove one to add another"
                    : 'Choose this customer to bring in now'
              }
              className={`w-7 h-7 rounded-full border flex items-center justify-center transition-all shrink-0 ${
                selected
                  ? 'bg-[#1f48ff] border-[#1f48ff] text-white'
                  : selectDisabled
                    ? 'bg-[#f0f4ff] border-[#1f48ff]/10 text-[#010a4f]/20 cursor-not-allowed'
                    : 'bg-white border-[#1f48ff]/30 text-transparent hover:border-[#1f48ff] hover:text-[#1f48ff]/40'
              }`}
            >
              <Check size={14} strokeWidth={2.5} />
            </button>
          ) : (
            <button
              onClick={() => quickSave({ keep: !keepValue })}
              aria-label={keepValue ? 'Drop' : 'Keep'}
              title={
                keepValue
                  ? 'Drop from this commit (kept in review)'
                  : 'Keep — bring this one into Cadi'
              }
              className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-all shrink-0 ${
                keepValue
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
                  : 'bg-[#f0f4ff] border-[#1f48ff]/15 text-[#010a4f]/45'
              }`}
            >
              {keepValue ? <Check size={14} strokeWidth={2.5} /> : <X size={14} />}
            </button>
          )}
          {/* Hard delete — removes the parsed_customers row entirely so it
              vanishes from the review. Use when the owner is sure they
              don't want this person in Cadi at all (vs the keep toggle
              which just excludes from this commit). */}
          <button
            onClick={onDelete}
            aria-label="Delete"
            title="Delete — remove from review entirely"
            className="w-7 h-7 rounded-lg border flex items-center justify-center transition-all shrink-0 bg-[#f0f4ff] border-[#1f48ff]/15 text-[#010a4f]/45 hover:bg-red-50 hover:border-red-200 hover:text-red-600"
          >
            <Trash2 size={13} />
          </button>
        </div>

        {/* Service + category — always visible */}
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <input
            type="text"
            value={v('service_label') || ''}
            onChange={(e) => setEdits({ service_label: e.target.value })}
            onBlur={() => {
              if (edits.service_label !== undefined)
                quickSave({ service_label: edits.service_label });
            }}
            placeholder="Service?"
            className="flex-1 min-w-[120px] bg-transparent border-0 border-b border-transparent hover:border-[#1f48ff]/15 focus:border-[#1f48ff] focus:outline-none text-xs text-[#1f48ff] py-0.5 placeholder-[#010a4f]/35"
          />
          <select
            value={v('category') || ''}
            onChange={(e) => quickSave({ category: e.target.value || null })}
            className="text-[10px] font-bold bg-[#f0f4ff] border rounded-md px-1.5 py-0.5 text-[#010a4f] focus:outline-none focus:border-[#1f48ff]"
            style={{ borderColor: `${accent}40` }}
          >
            <option value="">No division</option>
            {CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        {/* Service quick-pick chips — multi-select. Tap to add, tap again
            to remove. Multiple lit chips = customer uses multiple services
            (e.g. Weekly clean + Oven). Pre-stitches the customer ↔ service
            link so generate-service-menu has accurate counts. */}
        <ServiceChips
          category={v('category')}
          currentService={v('service_label')}
          currentServices={v('service_labels')}
          accent={accent}
          onChange={(labels) =>
            quickSave({
              service_labels: labels,
              // Keep service_label in sync with the first selection so legacy
              // single-value code paths still show something sensible.
              service_label: labels[0] ?? null,
            })
          }
        />
      </div>

      {/* Missing-fields warning — only when this card is kept and incomplete */}
      {keepValue && !readiness.ready && (
        <div className="mx-3 mb-2 mt-1 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 flex items-center gap-2">
          <AlertCircle size={11} className="text-amber-600 shrink-0" />
          <p className="text-[10px] text-amber-700 leading-snug">
            <span className="font-bold">Needs:</span> {readiness.missing.join(', ')}
            {!expanded && (
              <button
                type="button"
                onClick={() => setExpanded(true)}
                className="ml-1.5 font-bold text-amber-700 hover:text-amber-900 underline-offset-2 hover:underline"
              >
                Fix
              </button>
            )}
          </p>
        </div>
      )}

      {/* Decision bucket → prominent "Add frequency" prompt */}
      {bucket.key === 'decision' && keepValue && (
        <FrequencyPrompt
          value={v('frequency_raw') || ''}
          onChange={(val) => setEdits({ frequency_raw: val })}
          onCommit={() => {
            if (edits.frequency_raw !== undefined)
              quickSave({ frequency_raw: edits.frequency_raw });
          }}
          saving={saving}
        />
      )}

      {/* Nearly bucket → prominent "Next due" date prompt */}
      {bucket.key === 'nearly' && keepValue && (
        <DatePrompt
          value={v('anchor_date') || ''}
          onChange={(val) => setEdits({ anchor_date: val, anchor_type: 'next_due' })}
          onCommit={() => {
            if (edits.anchor_date !== undefined) {
              quickSave({ anchor_date: edits.anchor_date, anchor_type: 'next_due' });
            }
          }}
          saving={saving}
        />
      )}

      {/* Ready bucket → quick summary of the rrule + the next scheduled date.
          If the import "Due" was in the past, that visit has been-and-gone;
          we project forward by the customer's frequency to land on the real
          next clean date. No "(rolled from)" note — the math just IS the
          customer's next clean. */}
      {bucket.key === 'ready' &&
        keepValue &&
        (() => {
          const next = rollAnchorForward(v('anchor_date'), v('frequency_rrule'));
          return (
            <div className="px-4 pb-2 -mt-1 flex items-center gap-2 text-[11px] text-emerald-600 font-semibold flex-wrap">
              <RotateCw size={11} />
              <span>{rruleHumanise(v('frequency_rrule'))}</span>
              {next && (
                <>
                  <span className="text-[#010a4f]/30">·</span>
                  <Calendar size={11} />
                  <span>{ukDate(next)}</span>
                </>
              )}
            </div>
          );
        })()}

      {/* Show more / Edit details toggle */}
      <button
        onClick={() => setExpanded((o) => !o)}
        className="w-full text-left px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-[#010a4f]/45 hover:text-[#1f48ff] border-t border-[#1f48ff]/15 flex items-center gap-1.5 transition-colors"
      >
        <Pencil size={10} /> {expanded ? 'Hide details' : 'Edit details'}
      </button>

      {expanded && (
        <div className="px-4 pb-3 pt-2 space-y-2 border-t border-[#1f48ff]/15 bg-[#f0f4ff]">
          {/* Postcode-first address block. postcodes.io lookup populates town
              + county and offers a one-tap "Use" to fill the address field. */}
          <PostcodeLookupBlock
            postcode={v('postcode') ?? ''}
            address={v('address') ?? ''}
            onChange={(patch) => setEdits(patch)}
          />
          <EditField
            label="Phone"
            value={v('phone') ?? ''}
            onChange={(val) => setEdits({ phone: val })}
          />
          <EditField
            label="Email"
            value={v('email') ?? ''}
            onChange={(val) => setEdits({ email: val })}
            type="email"
          />
          <EditField
            label="Frequency"
            value={v('frequency_raw') ?? ''}
            onChange={(val) => setEdits({ frequency_raw: val })}
            placeholder="weekly / fortnightly / 4-weekly / one-off"
          />
          {/* Next due / Last clean — anchor_date stores either, distinguished
              by anchor_type. CleanerPlanner exports often give a "last done"
              instead of "next due"; surface both so the owner can correct
              whichever way it came in. */}
          <EditField
            label="Next due"
            // Show the ROLLED value (what Cadi will actually schedule) so this
            // field agrees with the summary chip above. Only show when the
            // anchor is a forward-looking date (not a last-clean record).
            value={
              v('anchor_type') === 'last_done'
                ? ''
                : (rollAnchorForward(v('anchor_date'), v('frequency_rrule')) ??
                  v('anchor_date') ??
                  '')
            }
            onChange={(val) => setEdits({ anchor_date: val, anchor_type: 'next_due' })}
            type="date"
          />
          <EditField
            label="Last clean"
            value={v('anchor_type') === 'last_done' ? (v('anchor_date') ?? '') : ''}
            onChange={(val) => setEdits({ anchor_date: val, anchor_type: 'last_done' })}
            type="date"
          />
          <EditField
            label="Day pref"
            value={v('day_preference') ?? ''}
            onChange={(val) => setEdits({ day_preference: val })}
            placeholder="Tuesdays / mornings / after 3pm"
          />
          <EditField
            label="Cust ref"
            value={v('customer_ref') ?? ''}
            onChange={(val) => setEdits({ customer_ref: val })}
            placeholder="from your old software"
          />
          <EditField
            label="Balance (£)"
            value={v('outstanding_balance') ?? ''}
            onChange={(val) => setEdits({ outstanding_balance: val === '' ? null : Number(val) })}
            type="number"
            placeholder="0.00"
          />
          <EditField
            label="Notes"
            value={v('notes') ?? ''}
            onChange={(val) => setEdits({ notes: val })}
            multiline
          />
          <div className="flex gap-2 pt-1">
            <button
              onClick={saveAll}
              disabled={!dirty || saving}
              className="flex-1 px-3 py-2 rounded-lg bg-[#1f48ff] hover:bg-[#3a5eff] disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-black"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            <button
              onClick={() => setExpanded(false)}
              className="px-3 py-2 rounded-lg bg-[#f0f4ff] border border-[#1f48ff]/15 text-[#010a4f]/75 text-xs font-bold"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Service quick-pick chips (multi-select) ─────────────────────────────────
// Tap a chip to add the service. Tap again to remove. Multiple chips can be
// lit at once for customers who use several services (e.g. windows + gutters,
// or weekly + 6-monthly deep). Falls back to legacy single-value when
// service_labels[] hasn't been populated yet.
function ServiceChips({ category, currentService, currentServices, accent, onChange }) {
  const suggestions = SERVICE_SUGGESTIONS[category];
  if (!category || !suggestions) return null;

  // Resolve effective selection — array preferred, single-value fallback.
  const selected =
    Array.isArray(currentServices) && currentServices.length
      ? currentServices
      : currentService
        ? [currentService]
        : [];

  // Case-insensitive equality so we light the right chip even when Cadi's
  // capitalisation differs from our suggestion (e.g. "windows" vs "Windows").
  const eq = (a, b) => String(a ?? '').toLowerCase() === String(b ?? '').toLowerCase();
  const isOn = (label) => selected.some((s) => eq(s, label));
  const customExtras = selected.filter((s) => !suggestions.some((sug) => eq(sug, s)));

  const toggle = (label) => {
    const present = selected.find((s) => eq(s, label));
    const next = present ? selected.filter((s) => !eq(s, label)) : [...selected, label];
    onChange(next);
  };

  return (
    <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
      <span className="text-[9px] font-bold uppercase tracking-wider text-[#010a4f]/45 mr-0.5">
        Services:
      </span>
      {suggestions.map((label) => {
        const active = isOn(label);
        return (
          <button
            key={label}
            type="button"
            onClick={() => toggle(label)}
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border transition-all ${
              active
                ? 'text-white shadow-sm'
                : 'text-[#010a4f]/75 border-[#1f48ff]/15 bg-[#f0f4ff] hover:border-[#1f48ff]/40 hover:text-[#010a4f]'
            }`}
            style={
              active
                ? {
                    background: `${accent}25`,
                    borderColor: `${accent}80`,
                    boxShadow: `inset 0 0 0 1px ${accent}40`,
                  }
                : undefined
            }
            aria-pressed={active}
          >
            {active && (
              <span aria-hidden="true" className="mr-0.5">
                ✓
              </span>
            )}
            {label}
          </button>
        );
      })}
      {/* Custom labels (anything not in the suggestion set) — show as
          coloured chips with an X so users can remove them too. */}
      {customExtras.map((label) => (
        <button
          key={`custom-${label}`}
          type="button"
          onClick={() => toggle(label)}
          className="px-2 py-0.5 rounded-full text-[10px] font-bold border text-white inline-flex items-center gap-1"
          style={{ background: `${accent}25`, borderColor: `${accent}80` }}
          title="Tap to remove"
        >
          {label}
          <span className="opacity-60">✕</span>
        </button>
      ))}
    </div>
  );
}

// ── Inline edit field ───────────────────────────────────────────────────────
function EditField({ label, value, onChange, type = 'text', placeholder, multiline }) {
  return (
    <label className="block">
      <span className="block text-[10px] font-bold uppercase tracking-wider text-[#010a4f]/60 mb-0.5">
        {label}
      </span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={2}
          className="w-full rounded-lg border border-[#1f48ff]/15 bg-white px-2.5 py-1.5 text-xs text-[#010a4f] placeholder-[#010a4f]/35 focus:outline-none focus:border-[#1f48ff] resize-y"
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-lg border border-[#1f48ff]/15 bg-white px-2.5 py-1.5 text-xs text-[#010a4f] placeholder-[#010a4f]/35 focus:outline-none focus:border-[#1f48ff]"
        />
      )}
    </label>
  );
}

// ── Decision-bucket nudge: prompt the user to type a frequency ──────────────
function FrequencyPrompt({ value, onChange, onCommit }) {
  const f = parseFrequency(value);
  const valid = Boolean(f);
  return (
    <div className="mx-3 mb-3 mt-1 rounded-xl border border-[#1f48ff]/15 bg-[#f0f4ff] px-3 py-2.5">
      <p className="text-[10px] font-bold uppercase tracking-wider text-[#1f48ff] mb-1.5 flex items-center gap-1.5">
        <RotateCw size={10} /> How often do you clean them?
      </p>
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onCommit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onCommit();
            }
          }}
          placeholder="weekly / fortnightly / 4-weekly / one-off"
          className="flex-1 rounded-lg border border-[#1f48ff]/15 bg-white px-2.5 py-1.5 text-xs text-[#010a4f] placeholder-[#010a4f]/35 focus:outline-none focus:border-[#1f48ff]"
        />
      </div>
      {value && (
        <p className={`text-[10px] mt-1 ${valid ? 'text-emerald-600' : 'text-amber-700'}`}>
          {valid
            ? `Read as ${rruleHumanise(freqToRrule(f))}`
            : "Couldn't read that. Try 'weekly', 'fortnightly', '4-weekly'…"}
        </p>
      )}
    </div>
  );
}

// ── Nearly-bucket nudge: prompt for next-due date ───────────────────────────
function DatePrompt({ value, onChange, onCommit }) {
  return (
    <div className="mx-3 mb-3 mt-1 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
      <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700 mb-1.5 flex items-center gap-1.5">
        <Calendar size={10} /> When's their next clean?
      </p>
      <div className="flex gap-2">
        <input
          type="date"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onCommit}
          className="flex-1 rounded-lg border border-amber-200 bg-white px-2.5 py-1.5 text-xs text-[#010a4f] focus:outline-none focus:border-amber-400"
        />
      </div>
    </div>
  );
}

// ── Postcode ↔ address lookups ──────────────────────────────────────────────
// Two-way: type postcode → fill town/county (postcodes.io). Or type a street
// name like "Gaveston Drive" → list of UK matches with postcode (Nominatim
// via the uk-address-search edge fn). The owner can use whichever they know.
function PostcodeLookupBlock({ postcode, address, onChange }) {
  const [pcStatus, setPcStatus] = useState('idle');
  const [pcResult, setPcResult] = useState(null);

  const [streetQuery, setStreetQuery] = useState('');
  const [streetStatus, setStreetStatus] = useState('idle'); // 'idle' | 'searching' | 'results' | 'none'
  const [streetResults, setStreetResults] = useState([]);

  const doPostcodeLookup = async (raw) => {
    if (!raw || raw.length < 5) return;
    setPcStatus('loading');
    setPcResult(null);
    const r = await lookupPostcode(raw);
    if (!r) {
      setPcStatus('error');
      return;
    }
    setPcStatus('ok');
    setPcResult(r);
    onChange({ postcode: r.postcode });
  };

  const applyPostcodeResult = () => {
    if (!pcResult) return;
    const bits = [pcResult.town, pcResult.county].filter(Boolean).join(', ');
    let newAddress = (address || '').trim();
    if (!newAddress) newAddress = bits;
    else if (!newAddress.toLowerCase().includes((pcResult.town || '').toLowerCase())) {
      newAddress = `${newAddress}, ${bits}`;
    }
    onChange({ address: newAddress });
  };

  // Street search — debounce so we don't fire on every keystroke.
  useEffect(() => {
    if (streetQuery.trim().length < 3) {
      setStreetResults([]);
      setStreetStatus('idle');
      return;
    }
    const t = setTimeout(async () => {
      setStreetStatus('searching');
      const results = await searchAddresses(streetQuery);
      setStreetResults(results);
      setStreetStatus(results.length ? 'results' : 'none');
    }, 400);
    return () => clearTimeout(t);
  }, [streetQuery]);

  const pickStreetResult = (r) => {
    const bits = [r.town, r.county].filter(Boolean).join(', ');
    let newAddress = (address || '').trim();
    // If the user typed a number+street into address already, append town;
    // otherwise use the result's label.
    if (!newAddress || newAddress.length < 4) {
      newAddress = r.label || bits;
    } else if (bits && !newAddress.toLowerCase().includes(bits.toLowerCase())) {
      newAddress = `${newAddress}, ${bits}`;
    }
    onChange({ postcode: r.postcode, address: newAddress });
    setStreetQuery('');
    setStreetResults([]);
    setStreetStatus('idle');
  };

  return (
    <div className="space-y-2">
      {/* Postcode row — primary path */}
      <label className="block">
        <span className="block text-[10px] font-bold uppercase tracking-wider text-[#010a4f]/60 mb-0.5 flex items-center gap-1">
          <MapPin size={9} /> Postcode
        </span>
        <div className="flex gap-2">
          <input
            type="text"
            value={postcode}
            onChange={(e) => {
              onChange({ postcode: e.target.value.toUpperCase() });
              setPcStatus('idle');
              setPcResult(null);
            }}
            onBlur={() => doPostcodeLookup(postcode)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                doPostcodeLookup(postcode);
              }
            }}
            placeholder="SW19 1AA"
            className="flex-1 rounded-lg border border-[#1f48ff]/15 bg-white px-2.5 py-1.5 text-xs text-[#010a4f] placeholder-[#010a4f]/35 focus:outline-none focus:border-[#1f48ff] uppercase"
          />
          <button
            type="button"
            onClick={() => doPostcodeLookup(postcode)}
            disabled={!postcode || pcStatus === 'loading'}
            className="px-2.5 py-1.5 rounded-lg border border-[#1f48ff]/15 bg-[#1f48ff]/8 text-[10px] font-bold text-[#1f48ff] hover:border-[#1f48ff] disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {pcStatus === 'loading' ? 'Looking…' : 'Look up'}
          </button>
        </div>
        {pcStatus === 'ok' && pcResult && (
          <div className="flex items-center justify-between gap-2 mt-1.5 px-2 py-1.5 rounded-md bg-emerald-50 border border-emerald-200">
            <p className="text-[10px] text-emerald-600 truncate">
              ✓ {[pcResult.town, pcResult.county].filter(Boolean).join(', ')}
            </p>
            <button
              type="button"
              onClick={applyPostcodeResult}
              className="text-[10px] font-bold text-emerald-600 hover:text-emerald-800 px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 whitespace-nowrap"
            >
              Use
            </button>
          </div>
        )}
        {pcStatus === 'error' && (
          <p className="text-[10px] text-red-600 mt-1">Postcode not found — typo?</p>
        )}
      </label>

      {/* Don't know the postcode? Find it from the street name. */}
      <details className="group">
        <summary className="cursor-pointer text-[10px] font-bold text-[#1f48ff] hover:text-[#010a4f] inline-flex items-center gap-1">
          <span className="opacity-60 group-open:rotate-90 transition-transform inline-block">
            ▸
          </span>
          Don't know the postcode? Find by street
        </summary>
        <div className="mt-1.5 space-y-1.5 pl-3 border-l border-[#1f48ff]/15">
          <input
            type="text"
            value={streetQuery}
            onChange={(e) => setStreetQuery(e.target.value)}
            placeholder='e.g. "Gaveston Drive Stirling"'
            className="w-full rounded-lg border border-[#1f48ff]/15 bg-white px-2.5 py-1.5 text-xs text-[#010a4f] placeholder-[#010a4f]/35 focus:outline-none focus:border-[#1f48ff]"
          />
          {streetStatus === 'searching' && (
            <p className="text-[10px] text-[#010a4f]/60 italic">Searching UK addresses…</p>
          )}
          {streetStatus === 'results' && streetResults.length > 0 && (
            <ul className="space-y-1">
              {streetResults.map((r, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => pickStreetResult(r)}
                    className="w-full text-left flex items-center justify-between gap-2 px-2 py-1.5 rounded-md bg-[#f0f4ff] border border-[#1f48ff]/15 hover:bg-[#f0f4ff] hover:border-[#1f48ff] transition-colors"
                  >
                    <span className="text-[11px] text-[#010a4f] truncate flex-1">{r.label}</span>
                    <span className="text-[10px] font-bold text-emerald-600 shrink-0 tabular-nums">
                      {r.postcode}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {streetStatus === 'none' && (
            <p className="text-[10px] text-amber-700">Nothing matched — try adding the town.</p>
          )}
        </div>
      </details>

      <EditField
        label="Address"
        value={address}
        onChange={(val) => onChange({ address: val })}
        placeholder="Street, town, county"
      />
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function freqToRrule(f) {
  // f is the shape parseFrequency returns: { freq, interval, days }
  if (!f) return null;
  if (f.freq === 'one-off') return null;
  const freq = f.freq.toUpperCase();
  const intervalPart = (f.interval || 1) > 1 ? `;INTERVAL=${f.interval}` : '';
  return `FREQ=${freq}${intervalPart}`;
}

function rruleHumanise(rrule) {
  if (!rrule) return '—';
  const interval = (rrule.match(/INTERVAL=(\d+)/) || [])[1];
  const i = interval ? parseInt(interval, 10) : 1;
  if (/FREQ=WEEKLY/.test(rrule)) {
    if (i === 1) return 'Weekly';
    if (i === 2) return 'Fortnightly';
    if (i === 4) return '4-weekly';
    return `Every ${i} weeks`;
  }
  if (/FREQ=MONTHLY/.test(rrule)) {
    return i === 1 ? 'Monthly' : `Every ${i} months`;
  }
  if (/FREQ=DAILY/.test(rrule)) return i === 1 ? 'Daily' : `Every ${i} days`;
  return rrule;
}

function ukDate(d) {
  if (!d) return '';
  const date = new Date(d + 'T00:00:00');
  if (isNaN(date.getTime())) return d;
  const now = new Date();
  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString(
    'en-GB',
    sameYear
      ? { day: 'numeric', month: 'short' }
      : { day: 'numeric', month: 'short', year: 'numeric' }
  );
}

// ── Bulk-apply service bar ──────────────────────────────────────────────────
// Most cleaners run a single primary service — a window cleaner with 160
// customers shouldn't have to tap 160 chips. This bar shows when there are
// cards without a service, suggests chips based on the divisions the user
// chose in Step 1, and applies the chosen service to every blank card.

const SUGGESTIONS_BY_DIVISION = {
  exterior: ['Windows', 'Gutters', 'Conservatory', 'Fascia & soffit', 'Driveway', 'Softwash'],
  residential: ['Regular clean', 'Deep clean', 'End of tenancy', 'Oven clean', 'Carpet clean'],
  commercial: [
    'Office clean',
    'Retail clean',
    'Contract clean',
    'Periodic deep',
    'Commercial windows',
    'Commercial gutters',
    'Commercial pressure wash',
  ],
};

// ── Bulk-apply division bar ────────────────────────────────────────────────
// The parser auto-detects division from service / business keywords for
// most rows; this pill mops up whatever was ambiguous. Pre-selects the
// owner's most-used division (taken from session.divisions, picked in
// Step 1) so the common case is one tap.

const DIVISION_PICKER = [
  {
    key: 'residential',
    label: 'Residential',
    accent: '#1f48ff',
    hint: 'Homes, holiday lets, end-of-tenancy.',
  },
  { key: 'exterior', label: 'Exterior', accent: '#10b981', hint: 'Windows, gutters, soft-wash.' },
  { key: 'commercial', label: 'Commercial', accent: '#f59e0b', hint: 'Offices, pubs, contracts.' },
];

function BulkDivisionBar({ rows, divisionsPicked, onApply }) {
  const [applying, setApplying] = useState(false);

  const missingCount = useMemo(
    () => (rows ?? []).filter((r) => !String(r.category ?? '').trim()).length,
    [rows]
  );

  if (!rows || missingCount === 0) return null;

  // Only surface the divisions the owner picked in Step 1 (avoids
  // confusing them with categories they don't even offer). If they picked
  // none, fall back to all three.
  const offered = divisionsPicked?.length
    ? DIVISION_PICKER.filter((d) => divisionsPicked.includes(d.key))
    : DIVISION_PICKER;

  const apply = async (key) => {
    if (applying) return;
    setApplying(true);
    try {
      await onApply(key);
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-start gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
          <Pencil size={14} className="text-amber-700" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-[#010a4f] leading-snug">
            {missingCount} customer{missingCount === 1 ? '' : 's'} unsorted by division.
          </p>
          <p className="text-[11px] text-amber-700 leading-snug mt-0.5">
            Tap to apply to every uncategorised card at once. Fine-tune per customer after.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 pl-9">
        {offered.map((d) => (
          <button
            key={d.key}
            onClick={() => apply(d.key)}
            disabled={applying}
            title={d.hint}
            className="text-[11px] font-bold px-3 py-1.5 rounded-full border transition-all disabled:opacity-50"
            style={{
              borderColor: `${d.accent}55`,
              background: `${d.accent}15`,
              color: d.accent,
            }}
          >
            All as {d.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function BulkServiceBar({ rows, divisions, onApply }) {
  const [custom, setCustom] = useState('');
  const [applying, setApplying] = useState(false);

  const missingCount = useMemo(
    () =>
      (rows ?? []).filter(
        (r) =>
          !String(r.service_label ?? '').trim() &&
          !(Array.isArray(r.service_labels) && r.service_labels.length)
      ).length,
    [rows]
  );

  if (!rows || missingCount === 0) return null;

  // Pull suggestion chips from whatever divisions the user picked in Step 1.
  // Falls back to "Windows" as the safest single suggestion if nothing was set.
  const chips = (divisions?.length ? divisions : ['exterior'])
    .flatMap((d) => SUGGESTIONS_BY_DIVISION[d] ?? [])
    .filter((v, i, a) => v && a.indexOf(v) === i)
    .slice(0, 8);

  const apply = async (label) => {
    if (applying) return;
    setApplying(true);
    try {
      await onApply(label);
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="mb-6 rounded-2xl border border-[#1f48ff]/15 bg-[#1f48ff]/8 p-4">
      <div className="flex items-start gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg bg-[#1f48ff]/15 flex items-center justify-center shrink-0">
          <Pencil size={14} className="text-[#1f48ff]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-[#010a4f] leading-snug">
            {missingCount} customer{missingCount === 1 ? '' : 's'} still need
            {missingCount === 1 ? 's' : ''} a service.
          </p>
          <p className="text-[11px] text-[#010a4f]/60 leading-snug mt-0.5">
            Tap one to set it on every blank card at once. You can fine-tune per customer after.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-2">
        {chips.map((label) => (
          <button
            key={label}
            onClick={() => apply(label)}
            disabled={applying}
            className="text-[11px] font-bold px-3 py-1.5 rounded-full bg-white border border-[#1f48ff]/15 text-[#1f48ff] hover:bg-[#1f48ff]/8 hover:border-[#1f48ff] hover:text-[#010a4f] transition-all disabled:opacity-50"
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <input
          type="text"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && custom.trim()) {
              apply(custom.trim());
              setCustom('');
            }
          }}
          placeholder="Or type a custom service…"
          className="flex-1 text-[12px] bg-white border border-[#1f48ff]/15 rounded-lg px-3 py-1.5 text-[#010a4f] placeholder-[#010a4f]/35 focus:outline-none focus:border-[#1f48ff]"
        />
        <button
          onClick={() => {
            if (custom.trim()) {
              apply(custom.trim());
              setCustom('');
            }
          }}
          disabled={applying || !custom.trim()}
          className="text-[11px] font-bold px-3 py-1.5 rounded-lg bg-[#1f48ff] hover:bg-[#3a5eff] text-white disabled:bg-[#f0f4ff] disabled:text-[#010a4f]/45 transition-all"
        >
          Apply
        </button>
      </div>
    </div>
  );
}
