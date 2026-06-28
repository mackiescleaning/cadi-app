// RoundBatchModal.jsx — schedule a whole round of customers as one batch of jobs.
// The killer Rounds flow promised by the audit. Replaces the single-job stub
// that pre-filled the round name as a fake customer.

import { useState, useMemo, useEffect } from "react";
import { bulkCreateJobs } from "../lib/db/jobsDb";
import { parseFrequency } from "../lib/migration/parsers";
import ModalShell from "./ui/ModalShell";

function todayIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function hourLabel(h) {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

const HOURS = [];
for (let h = 7; h <= 18; h += 0.5) HOURS.push(h);

export default function RoundBatchModal({ round, onClose, onCreated }) {
  const activeCustomers = useMemo(
    () => (round?.customers ?? []).filter(c => c.accountStatus !== 'cancelled'),
    [round]
  );

  const [date,        setDate]        = useState(todayIso());
  const [startHour,   setStartHour]   = useState(9);
  const [durationHrs, setDurationHrs] = useState(0.5);
  const [stagger,     setStagger]     = useState(true);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [submitting,  setSubmitting]  = useState(false);
  const [error,       setError]       = useState(null);

  // Select-all on first mount
  useEffect(() => {
    setSelectedIds(new Set(activeCustomers.map((c, i) => c.customerId ?? `idx-${i}`)));
  }, [activeCustomers]);

  const toggle = (id) => setSelectedIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const allSelected  = selectedIds.size === activeCustomers.length && activeCustomers.length > 0;
  const totalValue   = useMemo(
    () => activeCustomers
      .filter((c, i) => selectedIds.has(c.customerId ?? `idx-${i}`))
      .reduce((s, c) => s + (c.pricePerVisit || 0), 0),
    [activeCustomers, selectedIds]
  );

  const selectedCount = selectedIds.size;

  const handleCreate = async () => {
    setError(null);
    if (selectedCount === 0) { setError('Pick at least one customer.'); return; }
    setSubmitting(true);

    // Stagger times if the user kept the default — first job at startHour,
    // each subsequent at +durationHrs. Otherwise everyone gets the same start.
    const picks = activeCustomers
      .map((c, i) => ({ c, key: c.customerId ?? `idx-${i}` }))
      .filter(({ key }) => selectedIds.has(key));

    const recurrenceLabel = round?.schedule || (parseFrequency(round?.schedule)?.freq === 'one-off' ? 'one-off' : (round?.schedule || 'one-off'));

    const jobs = picks.map(({ c }, i) => ({
      customerId:   c.customerId ?? null,
      customer:     c.name,
      addressLine1: c.addressLine1 ?? null,
      addressLine2: c.addressLine2 ?? null,
      town:         c.town ?? null,
      county:       c.county ?? null,
      postcode:     c.postcode ?? '',
      date,
      startHour:    stagger ? +(startHour + i * durationHrs).toFixed(2) : startHour,
      durationHrs,
      type:         'exterior',                   // rounds are typically window-cleaning style
      service:      round.roundName,
      price:        c.pricePerVisit || 0,
      recurrence:   recurrenceLabel,
      isRecurring:  (parseFrequency(round?.schedule)?.days ?? 0) > 0,
      notes:        c.jobRef ? `Round: ${round.roundName} · Job ref: ${c.jobRef}` : `Round: ${round.roundName}`,
      source:       'rounds-batch',
    }));

    try {
      await bulkCreateJobs(jobs);
      onCreated?.({ count: jobs.length, totalValue, date });
      onClose?.();
    } catch (err) {
      setError(err?.message ?? 'Could not create jobs.');
      setSubmitting(false);
    }
  };

  return (
    <ModalShell
      open={Boolean(round)}
      onClose={onClose}
      title="Schedule round"
      subtitle={round?.roundName}
      maxWidth="max-w-lg"
      footer={
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-slate-600">
            <p className="font-bold text-slate-900 tabular-nums">£{totalValue} total</p>
            <p className="text-[11px] text-slate-500">{selectedCount} job{selectedCount === 1 ? '' : 's'} · {new Date(date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</p>
          </div>
          <button
            onClick={handleCreate}
            disabled={submitting || selectedCount === 0}
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-black shadow-lg shadow-blue-600/25 transition-all"
          >
            {submitting ? 'Creating…' : `Create ${selectedCount} job${selectedCount === 1 ? '' : 's'}`}
          </button>
        </div>
      }
    >
        <div className="p-5 space-y-4">
          {/* Date + time controls */}
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Visit date</span>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
              />
            </label>
            <label className="block">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Start time</span>
              <select
                value={startHour}
                onChange={e => setStartHour(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
              >
                {HOURS.map(h => <option key={h} value={h}>{hourLabel(h)}</option>)}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Each visit (hrs)</span>
              <select
                value={durationHrs}
                onChange={e => setDurationHrs(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
              >
                {[0.25, 0.5, 0.75, 1, 1.5, 2, 3].map(d => <option key={d} value={d}>{d}h</option>)}
              </select>
            </label>
            <label className="flex items-end gap-2 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={stagger}
                onChange={e => setStagger(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300"
              />
              <span className="pb-1.5">Stagger times by visit length</span>
            </label>
          </div>

          {/* Customer list */}
          <div className="border border-slate-100 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedIds(allSelected ? new Set() : new Set(activeCustomers.map((c, i) => c.customerId ?? `idx-${i}`)))}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700"
              >
                {allSelected ? 'Unselect all' : 'Select all'}
              </button>
              <span className="text-xs font-bold text-slate-600 tabular-nums">
                {selectedCount} of {activeCustomers.length}
              </span>
            </div>
            <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
              {activeCustomers.map((c, i) => {
                const key = c.customerId ?? `idx-${i}`;
                const picked = selectedIds.has(key);
                return (
                  <label key={key} className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${picked ? 'bg-blue-50/40' : 'hover:bg-slate-50'}`}>
                    <input
                      type="checkbox"
                      checked={picked}
                      onChange={() => toggle(key)}
                      className="w-4 h-4 rounded border-slate-300"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{c.name}</p>
                      {c.postcode && (
                        <p className="text-[11px] text-slate-500 truncate">{c.postcode}{c.jobRef ? ` · ${c.jobRef}` : ''}</p>
                      )}
                    </div>
                    {c.pricePerVisit != null && (
                      <span className="text-xs font-bold text-slate-700 tabular-nums shrink-0">£{c.pricePerVisit}</span>
                    )}
                  </label>
                );
              })}
              {activeCustomers.length === 0 && (
                <p className="px-3 py-6 text-center text-xs text-slate-400">No active customers in this round.</p>
              )}
            </div>
          </div>

          {error && (
            <p className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>
    </ModalShell>
  );
}
