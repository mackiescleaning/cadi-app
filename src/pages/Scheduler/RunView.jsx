// src/pages/Scheduler/RunView.jsx
// The Run / worksheet view — a day's stops grouped by round, worked top to
// bottom. Dense rows carry the customer's balance inline (the money thread),
// Done/Missed tick-off, and a tap-through to the shared JobDrawer. This is the
// surface staff live in: it mirrors the CleanerPlanner worksheet.

import { useMemo } from 'react';
import { Check, X, MapPin, ChevronRight } from 'lucide-react';
import { fmtMoney, fmtTime } from './helpers';

const money = (n) => `£${fmtMoney(Number(n) || 0)}`;

function fmtDay(d) {
  if (!d) return null;
  return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export default function RunView({ jobs, customers, onJobClick, updateJob, onAddJob, onError }) {
  const custById = useMemo(() => {
    const m = new Map();
    (customers || []).forEach((c) => m.set(c.id, c));
    return m;
  }, [customers]);

  // Group jobs by round (from the linked customer). Unrouted sorts last.
  const groups = useMemo(() => {
    const byRound = new Map();
    for (const job of jobs) {
      const cust = job.customerId ? custById.get(job.customerId) : null;
      const round = cust?.roundName || 'Unrouted';
      if (!byRound.has(round)) byRound.set(round, []);
      byRound.get(round).push({ job, cust });
    }
    const entries = [...byRound.entries()].map(([round, rows]) => {
      rows.sort(
        (a, b) =>
          a.job.startHour - b.job.startHour ||
          (a.job.customer || '').localeCompare(b.job.customer || '')
      );
      const total = rows.reduce((s, r) => s + (Number(r.job.price) || 0), 0);
      // Owed across the round — dedupe by customer so a customer with two
      // stops on the round doesn't get their balance counted twice.
      const seen = new Set();
      let owed = 0;
      for (const r of rows) {
        const id = r.cust?.id;
        if (id && !seen.has(id)) {
          seen.add(id);
          owed += Number(r.cust.outstandingBalance) || 0;
        }
      }
      const doneCount = rows.filter((r) => r.job.status === 'complete').length;
      return { round, rows, total, owed, doneCount };
    });
    entries.sort((a, b) => {
      if (a.round === 'Unrouted') return 1;
      if (b.round === 'Unrouted') return -1;
      return a.round.localeCompare(b.round);
    });
    return entries;
  }, [jobs, custById]);

  const setStatus = async (job, status) => {
    try {
      // Tapping the active state again clears it back to scheduled.
      const next = job.status === status ? 'scheduled' : status;
      await updateJob(job.id, { status: next });
    } catch {
      onError?.('Could not update the job. Try again.');
    }
  };

  if (!jobs.length) {
    return (
      <div
        className="rounded-2xl border border-dashed p-10 text-center"
        style={{ borderColor: 'rgba(153,197,255,0.25)' }}
      >
        <p className="text-white font-bold text-lg">No stops on this day</p>
        <p className="text-sm mt-1" style={{ color: 'rgba(153,197,255,0.7)' }}>
          Nothing scheduled for the round. Pick another day or add a job.
        </p>
        {onAddJob && (
          <button
            onClick={onAddJob}
            className="mt-4 px-4 py-2 rounded-xl text-sm font-bold text-white"
            style={{ background: 'linear-gradient(135deg,#1f48ff,#3a6bff)' }}
          >
            + Add a job
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {groups.map(({ round, rows, total, owed, doneCount }) => (
        <div key={round}>
          {/* Round header */}
          <div className="flex items-center justify-between gap-3 px-1 mb-2">
            <div className="flex items-center gap-2 min-w-0">
              <MapPin size={15} style={{ color: '#99c5ff' }} />
              <h3 className="text-sm font-black text-white truncate">{round}</h3>
              <span
                className="text-[11px] font-semibold"
                style={{ color: 'rgba(153,197,255,0.7)' }}
              >
                {rows.length} stop{rows.length === 1 ? '' : 's'} · {money(total)}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {owed > 0 && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-500/15 text-red-300 border border-red-500/25">
                  {money(owed)} owed
                </span>
              )}
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                {doneCount}/{rows.length} done
              </span>
            </div>
          </div>

          {/* Rows */}
          <div className="space-y-1.5">
            {rows.map(({ job, cust }) => {
              const done = job.status === 'complete';
              const missed = job.status === 'no_show';
              const balance = Number(cust?.outstandingBalance) || 0;
              const addr =
                [job.addressLine1, job.postcode].filter(Boolean).join(', ') || job.postcode || '';
              const schedule =
                cust?.schedule ||
                (job.recurrence && job.recurrence !== 'one-off' ? job.recurrence : null);
              const last = fmtDay(cust?.lastJobDate);
              const meta = [job.service, schedule, last && `last ${last}`]
                .filter(Boolean)
                .join(' · ');
              return (
                <div
                  key={job.id}
                  onClick={() => onJobClick(job)}
                  className={`group flex items-center gap-3 rounded-xl border px-3 py-2.5 cursor-pointer transition-all hover:shadow-md ${
                    done
                      ? 'border-emerald-200 bg-emerald-50'
                      : missed
                        ? 'border-red-200 bg-red-50'
                        : 'border-slate-200 bg-white'
                  }`}
                >
                  {/* Tick controls — stop propagation so a tap here doesn't open the drawer */}
                  <div
                    className="flex items-center gap-1.5 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => setStatus(job, 'complete')}
                      title="Done"
                      aria-label="Mark done"
                      className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-colors ${
                        done
                          ? 'bg-emerald-600 border-emerald-600 text-white'
                          : 'bg-white border-slate-200 text-slate-300 hover:border-emerald-400 hover:text-emerald-500'
                      }`}
                    >
                      <Check size={16} />
                    </button>
                    <button
                      onClick={() => setStatus(job, 'no_show')}
                      title="Missed"
                      aria-label="Mark missed"
                      className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-colors ${
                        missed
                          ? 'bg-red-600 border-red-600 text-white'
                          : 'bg-white border-slate-200 text-slate-300 hover:border-red-400 hover:text-red-500'
                      }`}
                    >
                      <X size={16} />
                    </button>
                  </div>

                  {/* Customer + service */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p
                        className={`text-sm font-bold truncate ${
                          done ? 'text-emerald-800' : missed ? 'text-red-800' : 'text-slate-900'
                        }`}
                      >
                        {job.customer || cust?.name || 'Customer'}
                      </p>
                      {job.startHour != null && (
                        <span className="text-[11px] font-semibold text-slate-400 shrink-0">
                          {fmtTime(job.startHour)}
                        </span>
                      )}
                    </div>
                    {meta && <p className="text-[11.5px] text-slate-500 truncate">{meta}</p>}
                    {addr && <p className="text-[11px] text-slate-400 truncate">{addr}</p>}
                  </div>

                  {/* Balance + price */}
                  <div className="text-right shrink-0">
                    <p className="text-sm font-black text-emerald-600 tabular-nums">
                      {money(job.price)}
                    </p>
                    {balance > 0 ? (
                      <p className="text-[11px] font-bold text-red-600">owes {money(balance)}</p>
                    ) : (
                      cust && <p className="text-[11px] text-slate-400">up to date</p>
                    )}
                  </div>
                  <ChevronRight
                    size={16}
                    className="text-slate-300 shrink-0 group-hover:text-slate-500"
                  />
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
