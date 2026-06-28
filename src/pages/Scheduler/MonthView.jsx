import { useState, useMemo } from "react";
import { X } from "lucide-react";
import { TYPE } from "../../lib/jobTheme";
import { useData } from "../../context/DataContext";
import { DAYS_SHORT, fmtMoney, getToday, isoDate } from "./helpers";

function LightCard({ children, className = "" }) {
  return (
    <div
      className={`rounded-2xl border border-white/70 shadow-xl shadow-slate-400/10 backdrop-blur-2xl ${className}`}
      style={{
        background: "linear-gradient(180deg, rgba(255,255,255,0.75) 0%, rgba(255,255,255,0.55) 100%)",
        boxShadow: "0 8px 32px rgba(15, 23, 42, 0.06), inset 0 1px 0 rgba(255,255,255,0.8)",
      }}
    >
      {children}
    </div>
  );
}

// Cadi palette resolver — shared with Week + Day for one consistent look.
function paletteFor({ isDone, isOverdue, isToday }) {
  if (isDone) return {
    cardStyle: { background: 'rgba(240,244,255,0.55)', borderColor: 'rgba(31,72,255,0.08)' },
    addrCls:   'text-[#010a4f]/30 line-through',
    priceCls:  'text-[#010a4f]/30 line-through',
  };
  if (isOverdue) return {
    cardStyle: { background: 'linear-gradient(160deg, rgba(255,228,225,0.85) 0%, rgba(255,240,235,0.7) 100%)', borderColor: 'rgba(217,98,77,0.25)' },
    addrCls:   'text-[#8a2f1f] font-bold',
    priceCls:  'text-[#8a2f1f]',
  };
  if (isToday) return {
    cardStyle: { background: 'linear-gradient(160deg, #ffffff 0%, rgba(240,244,255,0.85) 100%)', borderColor: 'rgba(31,72,255,0.22)' },
    addrCls:   'text-[#010a4f]',
    priceCls:  'text-emerald-600',
  };
  return {
    cardStyle: { background: 'linear-gradient(160deg, rgba(255,255,255,0.92) 0%, rgba(240,244,255,0.6) 100%)', borderColor: 'rgba(31,72,255,0.1)' },
    addrCls:   'text-[#010a4f]',
    priceCls:  'text-emerald-600',
  };
}

// One row in a calendar cell — bold address + price, type-coloured left bar.
function MiniJobCard({ job, custById, isDone, isOverdue, isToday, onClick }) {
  const t       = TYPE[job.type] || TYPE.residential;
  const cust    = job.customerId ? custById.get(job.customerId) : null;
  const address = cust?.addressLine1 || job.addressLine1 || job.postcode || job.customer || '';
  const { cardStyle, addrCls, priceCls } = paletteFor({ isDone, isOverdue, isToday });
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(job); }}
      className="w-full flex items-stretch rounded-md border overflow-hidden text-left hover:shadow-sm hover:shadow-[#1f48ff]/10 transition-shadow"
      style={cardStyle}
      title={`${address} — £${job.price}`}
    >
      <div className="w-[3px] shrink-0" style={{ background: isDone ? 'rgba(31,72,255,0.15)' : t.bar }} />
      <div className="flex-1 min-w-0 flex items-baseline gap-1 px-1.5 py-0.5">
        <p className={`text-[10.5px] font-bold truncate leading-tight ${addrCls}`}>{address || 'Job'}</p>
        <p className={`text-[10px] font-black tabular-nums shrink-0 ml-auto ${priceCls}`}>£{fmtMoney(job.price)}</p>
      </div>
    </button>
  );
}

export default function MonthView({ jobs, onJobClick, viewDate }) {
  const { customers = [] } = useData();
  const [selectedDay, setSelectedDay] = useState(null);

  const custById = useMemo(() => {
    const m = new Map();
    customers.forEach(c => m.set(c.id, c));
    return m;
  }, [customers]);

  const year  = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const todayStr = isoDate(getToday());
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayJS = new Date(year, month, 1).getDay();
  const firstDOW = firstDayJS === 0 ? 6 : firstDayJS - 1;

  // Build the 6×7 grid of cells. Empty leading/trailing pad days have day=null.
  const cells = [];
  for (let i = 0; i < firstDOW; i++) cells.push({ day: null });
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dayJobs = jobs.filter(j => j.date === dateStr);
    cells.push({
      day: d,
      dateStr,
      jobCount: dayJobs.length,
      revenue: dayJobs.reduce((s,j)=>s+(j.price||0),0),
      isToday: dateStr === todayStr,
      isPast:  dateStr < todayStr,
      hasUnassigned: dayJobs.some(j=>j.status==="unassigned"),
      doneCount: dayJobs.filter(j => j.status === 'complete').length,
      jobs: dayJobs,
    });
  }
  while (cells.length % 7 !== 0) cells.push({ day: null });

  const expandedDay = selectedDay !== null ? cells.find(c => c.day === selectedDay) : null;
  const monthLabel  = viewDate.toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-3 items-start">
      {/* Calendar grid */}
      <LightCard className="overflow-hidden">
        {/* Cadi navy header row */}
        <div
          className="grid grid-cols-7 border-b border-[rgba(153,197,255,0.18)]"
          style={{ background: 'linear-gradient(135deg, #010a4f 0%, #05124a 50%, #0d1e78 100%)' }}
        >
          {DAYS_SHORT.map(d => (
            <div key={d} className="py-2 text-center text-[11px] font-bold tracking-[0.12em] uppercase" style={{ color: '#99c5ff' }}>
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {cells.map((cell, i) => {
            const isSelected = cell.day && cell.day === selectedDay;
            const overflow   = cell.day ? Math.max(0, cell.jobCount - 2) : 0;

            return (
              <button
                key={i}
                onClick={() => cell.day && setSelectedDay(cell.day === selectedDay ? null : cell.day)}
                disabled={!cell.day}
                className={`border-r border-b border-[rgba(31,72,255,0.06)] last:border-r-0 p-1.5 min-h-[110px] text-left align-top flex flex-col gap-1 transition-all ${
                  !cell.day      ? "cursor-default bg-[rgba(31,72,255,0.02)]" :
                  isSelected     ? "bg-[rgba(31,72,255,0.08)] ring-1 ring-inset ring-[#1f48ff]/30" :
                  cell.isToday   ? "bg-[rgba(31,72,255,0.05)] hover:bg-[rgba(31,72,255,0.08)]" :
                  "hover:bg-[rgba(31,72,255,0.03)]"
                }`}
              >
                {cell.day && (
                  <>
                    {/* Day number + summary */}
                    <div className="flex items-center justify-between gap-1">
                      <p className={`text-[12px] font-black tabular-nums ${cell.isToday ? "text-[#1f48ff]" : "text-[#010a4f]"}`}>
                        {cell.day}
                      </p>
                      {cell.jobCount > 0 && (
                        <p className="text-[10px] font-bold tabular-nums text-emerald-600">£{fmtMoney(cell.revenue)}</p>
                      )}
                    </div>

                    {/* Up to 2 mini cards — keeps cell scannable */}
                    {cell.jobs.slice(0, 2).map(job => {
                      const isDone    = job.status === 'complete';
                      const isOverdue = !isDone && cell.isPast;
                      return (
                        <MiniJobCard
                          key={job.id}
                          job={job}
                          custById={custById}
                          isDone={isDone}
                          isOverdue={isOverdue}
                          isToday={cell.isToday}
                          onClick={onJobClick}
                        />
                      );
                    })}

                    {/* +N more chip — click cell to expand the side drawer */}
                    {overflow > 0 && (
                      <span className="self-start text-[9.5px] font-bold px-1.5 py-0.5 rounded-md bg-[rgba(31,72,255,0.08)] text-[#1f48ff]">
                        +{overflow} more
                      </span>
                    )}

                    {/* Unassigned warning dot — pinned bottom-right */}
                    {cell.hasUnassigned && (
                      <span className="absolute w-1.5 h-1.5 rounded-full bg-[#d9624d] mt-auto self-end" />
                    )}
                  </>
                )}
              </button>
            );
          })}
        </div>
      </LightCard>

      {/* Right-side drawer — reuses the Week column visual */}
      {expandedDay && (
        <LightCard className="overflow-hidden lg:sticky lg:top-4">
          {/* Drawer header — Cadi gradient, matches Week column */}
          <div
            className="px-4 py-2.5 border-b border-[rgba(153,197,255,0.18)] flex items-center justify-between"
            style={{
              background: expandedDay.isToday
                ? 'linear-gradient(135deg, #1f48ff 0%, #3a6bff 100%)'
                : 'linear-gradient(135deg, #010a4f 0%, #05124a 50%, #0d1e78 100%)',
              color: '#ffffff',
            }}
          >
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: expandedDay.isToday ? '#ffffff' : '#99c5ff' }}>
                {new Date(expandedDay.dateStr + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long' })}
              </p>
              <p className="text-base font-black">
                {expandedDay.day} {monthLabel}
              </p>
            </div>
            <button
              onClick={() => setSelectedDay(null)}
              aria-label="Close day details"
              className="w-7 h-7 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors"
            >
              <X size={14} />
            </button>
          </div>

          {/* Stat strip */}
          <div className="px-4 py-2 bg-white/60 border-b border-[rgba(31,72,255,0.08)] flex items-center gap-3 text-[11px] font-semibold">
            {expandedDay.jobCount === 0 ? (
              <span className="text-[#010a4f]/35 italic">Nothing booked</span>
            ) : (
              <>
                <span className="text-[#010a4f]/75">{expandedDay.jobCount} {expandedDay.jobCount === 1 ? 'job' : 'jobs'}</span>
                <span className="text-emerald-600 tabular-nums">£{fmtMoney(expandedDay.revenue)}</span>
                {expandedDay.doneCount > 0 && (
                  <span className="text-[#010a4f]/45 tabular-nums">{expandedDay.doneCount} done</span>
                )}
              </>
            )}
          </div>

          {/* Full job list — same address-first layout as Week cards */}
          <div className="px-2 py-2 space-y-1.5 max-h-[60vh] overflow-y-auto">
            {expandedDay.jobs.map(job => {
              const t        = TYPE[job.type] || TYPE.residential;
              const cust     = job.customerId ? custById.get(job.customerId) : null;
              const address  = cust?.addressLine1 || job.addressLine1 || job.postcode || '';
              const customer = job.customer || cust?.name || '';
              const isDone   = job.status === 'complete';
              const isOverdue = !isDone && expandedDay.isPast;
              const { cardStyle, addrCls, priceCls } = paletteFor({ isDone, isOverdue, isToday: expandedDay.isToday });
              const bodyCls = isDone ? 'text-[#010a4f]/25 line-through' : isOverdue ? 'text-[#a14533]/85' : 'text-[#010a4f]/55';

              return (
                <button
                  key={job.id}
                  onClick={() => onJobClick(job)}
                  className="w-full flex items-stretch rounded-xl border overflow-hidden text-left transition-all hover:shadow-md hover:shadow-[#1f48ff]/10 hover:-translate-y-[1px]"
                  style={cardStyle}
                >
                  <div className="w-1 shrink-0" style={{ background: isDone ? 'rgba(31,72,255,0.15)' : t.bar }} />
                  <div className="flex-1 min-w-0 px-2.5 py-1.5">
                    <div className="flex items-baseline justify-between gap-1.5">
                      <p className={`text-[12px] font-bold truncate leading-tight ${addrCls}`}>
                        {address || customer || 'Untitled job'}
                      </p>
                      <p className={`text-[11px] font-black tabular-nums shrink-0 ${priceCls}`}>
                        {isDone ? 'DONE' : `£${fmtMoney(job.price)}`}
                      </p>
                    </div>
                    <p className={`text-[10.5px] truncate leading-tight mt-0.5 ${bodyCls}`}>
                      {customer || job.service || job.postcode || ''}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </LightCard>
      )}
    </div>
  );
}
