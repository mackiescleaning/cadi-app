import { MONTHS, getCurrentQuarter, getMonday, isoDate, getToday, fmtMoney } from "./helpers";

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

// Capacity assumption: 8h/day × 5 working days = 40h/week available capacity.
// Cleaning crews typically run 5-day routes; if this needs to be configurable
// later we'd source it from settings rather than hard-coding.
const WEEK_CAPACITY_HRS = 40;

// Map % booked → palette band:
//   < 50% under-booked (brand blue), 50-85% on-track (emerald),
//   85-100% busy (amber), > 100% over-capacity (dusty coral).
function loadPalette(pct) {
  if (pct > 100) return { label: 'Over',    fill: 'linear-gradient(90deg, #d9624d 0%, #c64a35 100%)', ink: '#8a2f1f', tag: 'bg-[#fbe9e5] text-[#8a2f1f]' };
  if (pct > 85)  return { label: 'Busy',    fill: 'linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%)', ink: '#92400e', tag: 'bg-amber-100 text-amber-800' };
  if (pct >= 50) return { label: 'On track',fill: 'linear-gradient(90deg, #10b981 0%, #34d399 100%)', ink: '#065f46', tag: 'bg-emerald-100 text-emerald-800' };
  return            { label: 'Quiet',   fill: 'linear-gradient(90deg, #1f48ff 0%, #3a6bff 100%)', ink: '#1f48ff', tag: 'bg-[rgba(31,72,255,0.1)] text-[#1f48ff]' };
}

function shortDate(d) {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export default function QuarterView({ jobs }) {
  const q = getCurrentQuarter();
  const quarterStart = new Date(q.year, q.startMonth, 1);
  const qMonday = getMonday(quarterStart);
  const todayStr = isoDate(getToday());

  const quarterWeeks = Array.from({ length: 13 }, (_, i) => {
    const weekStart = new Date(qMonday);
    weekStart.setDate(weekStart.getDate() + i * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const weekStartStr = isoDate(weekStart);
    const weekEndStr   = isoDate(weekEnd);
    const weekJobs = (jobs || []).filter(j => j.date && j.date >= weekStartStr && j.date <= weekEndStr);
    const bookedHrs = weekJobs.reduce((s, j) => s + (j.durationHrs ?? 0), 0);
    const loadPct   = Math.round((bookedHrs / WEEK_CAPACITY_HRS) * 100);
    return {
      week: i + 1,
      weekStart,
      weekEnd,
      weekStartStr,
      weekEndStr,
      revenue:   weekJobs.reduce((s, j) => s + (j.price || 0), 0),
      jobs:      weekJobs.length,
      complete:  weekJobs.filter(j => j.status === 'complete').length,
      bookedHrs,
      loadPct,
      isCurrent: todayStr >= weekStartStr && todayStr <= weekEndStr,
      isPast:    todayStr > weekEndStr,
    };
  });

  const total     = quarterWeeks.reduce((s,w) => s + w.revenue, 0);
  const avgRev    = Math.round(total / 13);
  const totalJobs = quarterWeeks.reduce((s,w) => s + w.jobs, 0);
  const bestWeek  = quarterWeeks.reduce((best, w) => w.revenue > best.revenue ? w : best, quarterWeeks[0]);
  const overWeeks = quarterWeeks.filter(w => w.loadPct > 100).length;
  const quietWeeks = quarterWeeks.filter(w => w.loadPct < 50 && !w.isPast).length;

  return (
    <div className="space-y-4">
      {/* Headline stats — Cadi palette */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: `Q${q.quarter} revenue`, value: `£${total.toLocaleString()}`, accent: "text-emerald-600" },
          { label: "Total jobs",            value: totalJobs.toLocaleString(),    accent: "text-[#010a4f]" },
          { label: "Weekly avg",            value: `£${avgRev.toLocaleString()}`, accent: "text-[#010a4f]" },
          { label: "Best week",             value: `W${bestWeek.week} · £${fmtMoney(bestWeek.revenue)}`, accent: "text-[#1f48ff]" },
        ].map(({ label, value, accent }) => (
          <LightCard key={label} className="px-4 py-3">
            <p className="text-[10px] font-bold tracking-widest uppercase text-[#010a4f]/45 mb-1">{label}</p>
            <p className={`text-lg font-black tabular-nums ${accent}`}>{value}</p>
          </LightCard>
        ))}
      </div>

      {/* Capacity callouts — sits between stats and the week grid */}
      {(overWeeks > 0 || quietWeeks > 0) && (
        <LightCard className="px-4 py-3">
          <div className="flex flex-wrap items-center gap-2 text-[12px]">
            <span className="text-[10px] font-bold tracking-widest uppercase text-[#010a4f]/45">Heads up</span>
            {overWeeks > 0 && (
              <span className="px-2 py-1 rounded-md bg-[#fbe9e5] text-[#8a2f1f] font-semibold">
                {overWeeks} week{overWeeks === 1 ? '' : 's'} over capacity
              </span>
            )}
            {quietWeeks > 0 && (
              <span className="px-2 py-1 rounded-md bg-[rgba(31,72,255,0.1)] text-[#1f48ff] font-semibold">
                {quietWeeks} quiet week{quietWeeks === 1 ? '' : 's'} ahead
              </span>
            )}
          </div>
        </LightCard>
      )}

      {/* Week-strip grid — 13 weeks in a 3-column responsive layout.
          Each tile shows revenue, jobs, completion, and a load bar.
          Current week is bordered + flagged; past weeks fade slightly. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {quarterWeeks.map(w => {
          const load = loadPalette(w.loadPct);
          const monthLabel = MONTHS[w.weekStart.getMonth()];
          const completePct = Math.round((w.complete / Math.max(w.jobs, 1)) * 100);

          return (
            <LightCard
              key={w.week}
              className={`overflow-hidden transition-all ${
                w.isCurrent ? 'ring-2 ring-[#1f48ff]/40 shadow-[#1f48ff]/15' : w.isPast ? 'opacity-75' : ''
              }`}
            >
              {/* Tile header — Cadi gradient, brand-blue for current */}
              <div
                className="px-3 py-2 flex items-center justify-between"
                style={{
                  background: w.isCurrent
                    ? 'linear-gradient(135deg, #1f48ff 0%, #3a6bff 100%)'
                    : 'linear-gradient(135deg, #010a4f 0%, #05124a 50%, #0d1e78 100%)',
                  color: '#ffffff',
                }}
              >
                <div>
                  <p className="text-[10px] font-bold tracking-[0.15em] uppercase" style={{ color: w.isCurrent ? '#ffffff' : '#99c5ff' }}>
                    Week {w.week} · {monthLabel}
                  </p>
                  <p className="text-[11px] font-semibold opacity-80">
                    {shortDate(w.weekStart)} – {shortDate(w.weekEnd)}
                  </p>
                </div>
                {w.isCurrent && (
                  <span className="text-[9px] font-black uppercase tracking-wider bg-white/20 px-1.5 py-0.5 rounded">Now</span>
                )}
              </div>

              {/* Body — revenue hero, then jobs + load */}
              <div className="px-3 py-2.5 space-y-2">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-xl font-black tabular-nums text-emerald-600">
                    £{w.revenue.toLocaleString()}
                  </p>
                  <span className={`text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${load.tag}`}>
                    {load.label}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[#010a4f]/65 tabular-nums">
                    {w.jobs} {w.jobs === 1 ? 'job' : 'jobs'}
                  </span>
                  {w.jobs > 0 && (
                    <span className="text-[#010a4f]/45 tabular-nums">
                      {w.complete}/{w.jobs} done · {completePct}%
                    </span>
                  )}
                </div>

                {/* Capacity bar — booked hours vs 40h working week.
                    Bar caps at 100% width but the % label can exceed 100. */}
                <div>
                  <div className="h-1.5 rounded-full bg-[rgba(31,72,255,0.08)] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(w.loadPct, 100)}%`,
                        background: load.fill,
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-1 text-[10px] text-[#010a4f]/45">
                    <span className="tabular-nums">{w.bookedHrs.toFixed(1)}h booked</span>
                    <span className="tabular-nums">{w.loadPct}% of {WEEK_CAPACITY_HRS}h</span>
                  </div>
                </div>
              </div>
            </LightCard>
          );
        })}
      </div>
    </div>
  );
}
