import { useState, useEffect } from 'react';
import { useCountUp } from '../../hooks/useCountUp';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = n => `£${Math.round(Math.abs(+n)).toLocaleString()}`;

function timeGreeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

// ─── Alert strip ──────────────────────────────────────────────────────────────
function AlertStrip({ actions, onNavigate }) {
  const urgent = actions.filter(a => a.pts > 0);
  if (!urgent.length) return null;
  return (
    <div className="space-y-2">
      {urgent.slice(0, 2).map((a, i) => (
        <button
          key={i}
          onClick={() => a.tab && onNavigate(a.tab)}
          className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-left active:scale-[0.98] transition-all border"
          style={{
            background: a.level === 'red'
              ? 'linear-gradient(135deg, rgba(127,29,29,0.5) 0%, rgba(6,16,60,0.9) 100%)'
              : 'linear-gradient(135deg, rgba(120,53,15,0.4) 0%, rgba(6,16,60,0.9) 100%)',
            borderColor: a.level === 'red' ? 'rgba(239,68,68,0.35)' : 'rgba(251,191,36,0.3)',
          }}
        >
          <div className={`w-2 h-2 rounded-full shrink-0 ${a.level === 'red' ? 'bg-red-400 shadow-[0_0_6px_2px_rgba(239,68,68,0.6)]' : 'bg-amber-400 shadow-[0_0_6px_2px_rgba(251,191,36,0.6)]'}`} />
          <p className="flex-1 text-xs font-bold text-white truncate">{a.title}</p>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
              a.level === 'red'
                ? 'bg-red-500/20 text-red-300 border-red-500/30'
                : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
            }`}>+{a.pts}pts</span>
            <span className="text-[10px] text-[rgba(153,197,255,0.5)]">Fix →</span>
          </div>
        </button>
      ))}
    </div>
  );
}

// ─── Today's jobs ─────────────────────────────────────────────────────────────
const TYPE_BAR = {
  residential: { bar: '#34d399', glow: 'rgba(52,211,153,0.5)'  },
  commercial:  { bar: '#4f78ff', glow: 'rgba(79,120,255,0.5)'  },
  exterior:    { bar: '#f97316', glow: 'rgba(249,115,22,0.5)'  },
};
const STATUS_CFG = {
  complete:      { label: 'Done',        bg: 'bg-emerald-500/20', text: 'text-emerald-300', border: 'border-emerald-500/30' },
  'in-progress': { label: 'In progress', bg: 'bg-[#4f78ff]/20',   text: 'text-[#99c5ff]',  border: 'border-[#4f78ff]/30'  },
  scheduled:     { label: 'Scheduled',   bg: 'bg-white/5',        text: 'text-white/40',   border: 'border-white/10'      },
  unassigned:    { label: 'Unassigned',  bg: 'bg-red-500/20',     text: 'text-red-300',    border: 'border-red-500/30'    },
};

function MobileTodaysJobs({ jobs, onNavigate }) {
  const done = jobs.filter(j => j.status === 'complete').length;
  return (
    <div
      className="rounded-2xl border border-[rgba(79,120,255,0.2)] overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #040810 0%, #06103c 50%, #080d28 100%)' }}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-[rgba(79,120,255,0.12)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-4 rounded-full bg-[#4f78ff] shadow-[0_0_8px_2px_rgba(79,120,255,0.5)]" />
          <p className="text-xs font-black uppercase tracking-[0.15em] text-[#99c5ff]">Today's jobs</p>
        </div>
        <div className="flex items-center gap-3">
          {jobs.length > 0 && (
            <span className="text-xs font-bold text-[rgba(153,197,255,0.5)]">{done}/{jobs.length} done</span>
          )}
          <button
            onClick={() => onNavigate('scheduler')}
            className="text-xs font-bold text-[#4f78ff] active:text-[#99c5ff] transition-colors"
          >
            Schedule →
          </button>
        </div>
      </div>

      {/* Empty state */}
      {jobs.length === 0 && (
        <div className="px-4 py-8 text-center space-y-3">
          <p className="text-sm text-[rgba(153,197,255,0.4)]">No jobs scheduled today.</p>
          <button
            onClick={() => onNavigate('scheduler')}
            className="px-5 py-2.5 rounded-xl bg-[#4f78ff] text-white text-sm font-bold active:scale-[0.97] transition-all"
          >
            + Add a job
          </button>
        </div>
      )}

      {/* Job rows */}
      <div className="divide-y divide-[rgba(79,120,255,0.08)]">
        {jobs.map(j => {
          const type   = TYPE_BAR[j.type] ?? TYPE_BAR.residential;
          const status = STATUS_CFG[j.status] ?? STATUS_CFG.scheduled;
          const isDone = j.status === 'complete';
          return (
            <button
              key={j.id}
              onClick={() => onNavigate('scheduler')}
              className={`w-full flex items-center gap-3.5 px-4 py-4 text-left active:bg-white/[0.03] transition-colors ${isDone ? 'opacity-50' : ''}`}
            >
              {/* Type bar */}
              <div
                className="w-1 self-stretch rounded-full shrink-0 min-h-[36px]"
                style={{ background: type.bar, boxShadow: `0 0 6px 1px ${type.glow}` }}
              />
              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-bold text-white truncate leading-tight ${isDone ? 'line-through opacity-60' : ''}`}>
                  {j.customer}
                </p>
                <p className="text-xs text-[rgba(153,197,255,0.45)] mt-0.5 truncate">
                  {j.time}{j.service ? ` · ${j.service}` : ''}
                </p>
              </div>
              {/* Price + status */}
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <p className={`text-sm font-black tabular-nums ${isDone ? 'text-emerald-400' : 'text-white'}`}>
                  {fmt(j.price)}
                </p>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${status.bg} ${status.text} ${status.border}`}>
                  {status.label}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Week mini chart ──────────────────────────────────────────────────────────
function MobileWeekMini({ weekJobs }) {
  const maxRev  = Math.max(...weekJobs.map(d => d.revenue), 1);
  const earned  = weekJobs.filter(d => d.done || d.isToday).reduce((s, d) => s + d.revenue, 0);
  const total   = weekJobs.reduce((s, d) => s + d.revenue, 0);
  const pct     = total > 0 ? Math.min((earned / total) * 100, 100) : 0;
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 100); return () => clearTimeout(t); }, []);

  return (
    <div
      className="rounded-2xl border border-[rgba(79,120,255,0.15)] overflow-hidden px-4 py-3"
      style={{ background: 'linear-gradient(135deg, #040810 0%, #06103c 50%, #080d28 100%)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-3.5 rounded-full bg-emerald-400 shadow-[0_0_6px_1px_rgba(52,211,153,0.5)]" />
          <p className="text-xs font-black uppercase tracking-[0.15em] text-[#99c5ff]">This week</p>
        </div>
        <span className="text-xs font-bold text-emerald-400">{fmt(earned)} earned</span>
      </div>

      {/* Bars */}
      <div className="grid grid-cols-7 gap-1 mb-2.5">
        {weekJobs.map((d, index) => {
          const barH = d.revenue > 0 ? Math.max((d.revenue / maxRev) * 44, 4) : 0;
          return (
            <div key={d.day} className="flex flex-col items-center gap-1">
              <p className={`text-[9px] font-black uppercase leading-none ${
                d.isToday ? 'text-[#99c5ff]' : d.done ? 'text-emerald-400' : 'text-[rgba(153,197,255,0.25)]'
              }`}>{d.day}</p>
              <div className="w-full h-11 flex items-end justify-center">
                {d.revenue > 0 ? (
                  <div
                    className="w-full rounded-t-sm"
                    style={{
                      height: mounted ? `${barH}px` : 0,
                      transition: `height 0.55s cubic-bezier(0.34,1.56,0.64,1) ${index * 0.07}s`,
                      background: d.isToday
                        ? 'linear-gradient(180deg, #99c5ff 0%, #4f78ff 100%)'
                        : d.done
                        ? 'linear-gradient(180deg, #6ee7b7 0%, #059669 100%)'
                        : 'rgba(79,120,255,0.2)',
                      boxShadow: d.isToday ? '0 0 8px 2px rgba(99,179,255,0.35)' : d.done ? '0 0 6px 1px rgba(52,211,153,0.25)' : 'none',
                    }}
                  />
                ) : (
                  <div className="w-full h-0.5 rounded-full bg-white/5" />
                )}
              </div>
              <p className={`text-[9px] font-bold tabular-nums leading-none ${
                d.isToday ? 'text-white' : d.done ? 'text-emerald-400' : d.revenue > 0 ? 'text-[rgba(153,197,255,0.4)]' : 'text-[rgba(153,197,255,0.15)]'
              }`}>
                {d.revenue > 0 ? `£${d.revenue}` : '—'}
              </p>
            </div>
          );
        })}
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-white/5 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #34d399, #059669)', boxShadow: '0 0 6px 2px rgba(52,211,153,0.35)' }}
        />
      </div>
      <div className="flex justify-between mt-1.5">
        <span className="text-[9px] text-[rgba(153,197,255,0.3)] font-bold">Week progress</span>
        <span className="text-[9px] text-[rgba(153,197,255,0.4)] font-bold tabular-nums">{fmt(earned)} of {fmt(total)}</span>
      </div>
    </div>
  );
}

// ─── Score card (expandable) ──────────────────────────────────────────────────
const SCORE_DIMS_GLOW = {
  Revenue:    { bar: 'linear-gradient(90deg, #38bdf8, #1f48ff)' },
  Operations: { bar: 'linear-gradient(90deg, #34d399, #059669)' },
  Invoicing:  { bar: 'linear-gradient(90deg, #fbbf24, #d97706)' },
  Compliance: { bar: 'linear-gradient(90deg, #a78bfa, #7c3aed)' },
  Growth:     { bar: 'linear-gradient(90deg, #f87171, #dc2626)' },
};

function MobileScoreCard({ score }) {
  const [expanded, setExpanded] = useState(false);
  const { total, tier, tierNext, tierColor, dims } = score;
  const display   = useCountUp(total, 1800);
  const [landed, setLanded] = useState(false);
  const [barsMounted, setBarsMounted] = useState(false);

  useEffect(() => {
    if (!total) return;
    const t1 = setTimeout(() => setLanded(true), 1850);
    const t2 = setTimeout(() => setLanded(false), 2800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [total]);

  useEffect(() => { const t = setTimeout(() => setBarsMounted(true), 300); return () => clearTimeout(t); }, []);

  const ptsToNext = tierNext ? tierNext - total : 0;
  const r = 30, circ = 2 * Math.PI * r;
  const strokeColor = display >= 90 ? '#a78bfa' : display >= 75 ? '#34d399' : display >= 60 ? '#38bdf8' : display >= 40 ? '#fbbf24' : '#f87171';

  return (
    <div
      className="rounded-2xl border border-[rgba(79,120,255,0.15)] overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #040810 0%, #06103c 50%, #080d28 100%)' }}
    >
      {/* Main row */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-4 px-4 py-4 text-left active:bg-white/[0.02] transition-colors"
      >
        {/* Mini ring */}
        <div className="relative shrink-0" style={{ width: 76, height: 76 }}>
          {landed && (
            <div
              className="absolute inset-0 rounded-full pointer-events-none"
              style={{ border: `2px solid ${strokeColor}`, animation: 'scoreLand 0.9s ease-out forwards' }}
            />
          )}
          <svg width={76} height={76} viewBox="0 0 76 76" className="-rotate-90">
            <circle cx={38} cy={38} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
            <circle
              cx={38} cy={38} r={r} fill="none"
              stroke={strokeColor} strokeWidth="8" strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={circ * (1 - display / 100)}
              style={{
                transition: 'stroke-dashoffset 0.04s linear, stroke 0.25s ease',
                filter: `drop-shadow(0 0 ${landed ? '10px' : '5px'} ${strokeColor})`,
              }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-black tabular-nums text-white leading-none">{display}</span>
            <span className="text-[9px] text-white/40 font-bold mt-0.5">/ 100</span>
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[#99c5ff] mb-0.5">Cadi Score</p>
          <p className={`text-2xl font-black leading-tight ${tierColor}`}>{tier}</p>
          {tierNext ? (
            <p className="text-xs text-white/40 mt-1">
              <span className="font-bold text-white/70">{ptsToNext} pts</span> to next tier
            </p>
          ) : (
            <p className="text-xs text-violet-300 font-bold mt-1">Peak performance</p>
          )}
        </div>

        {/* Expand chevron */}
        <div className={`text-[#4f78ff] shrink-0 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}>
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </button>

      {/* Expandable dimension bars */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-[rgba(79,120,255,0.1)] pt-3 space-y-3">
          {dims.map(({ label, score: s, max }, i) => {
            const pct = (s / max) * 100;
            const glow = SCORE_DIMS_GLOW[label];
            return (
              <div key={label} className="flex items-center gap-3"
                style={{ animation: `fadeSlideIn 0.35s ease-out ${i * 0.08}s both` }}
              >
                <span className="text-xs text-white/40 w-24 shrink-0">{label}</span>
                <div className="flex-1 h-1.5 bg-white/8 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: barsMounted ? `${pct}%` : 0,
                      transition: `width 0.6s cubic-bezier(0.34,1.2,0.64,1) ${i * 0.1}s`,
                      background: glow?.bar,
                    }}
                  />
                </div>
                <div className="flex items-center gap-0.5 w-10 shrink-0 justify-end">
                  <span className="text-xs font-mono font-bold text-white/60">{s}</span>
                  <span className="text-[10px] text-white/20">/{max}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Badges row (horizontal scroll) ──────────────────────────────────────────
function MobileBadgesRow({ badges, onShare }) {
  const earned = badges.filter(b => b.earned);
  if (!earned.length) return null;

  return (
    <div
      className="rounded-2xl border border-[rgba(79,120,255,0.15)] overflow-hidden px-4 py-3"
      style={{ background: 'linear-gradient(135deg, #040810 0%, #06103c 50%, #080d28 100%)' }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-3.5 rounded-full bg-violet-400 shadow-[0_0_6px_1px_rgba(167,139,250,0.5)]" />
          <p className="text-xs font-black uppercase tracking-[0.15em] text-[#99c5ff]">Badges</p>
        </div>
        <button
          onClick={onShare}
          className="text-xs font-bold text-[#4f78ff] active:text-[#99c5ff] transition-colors"
        >
          Share →
        </button>
      </div>
      <div className="flex gap-2.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
        {earned.map(b => (
          <div
            key={b.id}
            className={`flex-shrink-0 flex flex-col items-center gap-1.5 px-3 py-3 rounded-2xl border ${b.border} bg-white/5`}
            style={{ minWidth: 68 }}
          >
            <span className="text-2xl">{b.emoji}</span>
            <p className="text-[9px] font-bold text-white/70 text-center leading-tight">{b.name}</p>
          </div>
        ))}
        {badges.filter(b => !b.earned).slice(0, 2).map(b => (
          <div
            key={b.id}
            className="flex-shrink-0 flex flex-col items-center gap-1.5 px-3 py-3 rounded-2xl border border-white/8 bg-white/[0.03]"
            style={{ minWidth: 68 }}
          >
            <span className="text-2xl opacity-20">🔒</span>
            <p className="text-[9px] font-bold text-white/20 text-center leading-tight">{b.name}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Activity feed ────────────────────────────────────────────────────────────
function MobileActivityFeed({ feed }) {
  if (!feed.length) return null;
  const iconCfg = bg => {
    if (bg.includes('emerald')) return { ring: 'border-emerald-500/40', iconBg: 'bg-emerald-500/20', glow: 'rgba(52,211,153,0.4)'  };
    if (bg.includes('red'))     return { ring: 'border-red-500/40',     iconBg: 'bg-red-500/20',     glow: 'rgba(239,68,68,0.4)'   };
    if (bg.includes('blue'))    return { ring: 'border-[#4f78ff]/40',   iconBg: 'bg-[#4f78ff]/20',   glow: 'rgba(79,120,255,0.4)'  };
    if (bg.includes('amber'))   return { ring: 'border-amber-500/40',   iconBg: 'bg-amber-500/20',   glow: 'rgba(251,191,36,0.4)'  };
    return { ring: 'border-white/20', iconBg: 'bg-white/10', glow: 'rgba(255,255,255,0.15)' };
  };

  return (
    <div
      className="rounded-2xl border border-[rgba(79,120,255,0.15)] overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #040810 0%, #06103c 50%, #080d28 100%)' }}
    >
      <div className="px-4 py-3 border-b border-[rgba(79,120,255,0.12)]">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-3.5 rounded-full bg-violet-400" />
          <p className="text-xs font-black uppercase tracking-[0.15em] text-[#99c5ff]">Recent activity</p>
        </div>
      </div>
      <div className="divide-y divide-[rgba(79,120,255,0.08)]">
        {feed.slice(0, 5).map(item => {
          const cfg = iconCfg(item.bg || '');
          return (
            <div key={item.id} className="flex items-center gap-3 px-4 py-3.5">
              <div
                className={`w-8 h-8 rounded-xl border ${cfg.ring} ${cfg.iconBg} flex items-center justify-center text-sm shrink-0`}
                style={{ boxShadow: `0 0 8px 1px ${cfg.glow}` }}
              >
                {item.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white truncate leading-tight">{item.title}</p>
                <p className="text-[10px] text-[rgba(153,197,255,0.45)] mt-0.5 truncate">{item.sub}</p>
              </div>
              <span className="text-[10px] font-bold text-[rgba(153,197,255,0.3)] shrink-0 tabular-nums">{item.time}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Outstanding invoices pill ────────────────────────────────────────────────
function OutstandingPill({ invoices, onNavigate }) {
  const unpaid = invoices.filter(i => i.status !== 'paid');
  const overdue = unpaid.filter(i => i.status === 'overdue');
  const total = unpaid.reduce((s, i) => s + (Number(i.amount) || 0), 0);
  if (!total) return null;

  return (
    <button
      onClick={() => onNavigate('invoices')}
      className="w-full flex items-center justify-between px-4 py-3 rounded-2xl border active:scale-[0.98] transition-all"
      style={{
        background: overdue.length
          ? 'linear-gradient(135deg, rgba(127,29,29,0.4) 0%, rgba(6,16,60,0.9) 100%)'
          : 'linear-gradient(135deg, rgba(120,53,15,0.3) 0%, rgba(6,16,60,0.9) 100%)',
        borderColor: overdue.length ? 'rgba(239,68,68,0.3)' : 'rgba(251,191,36,0.25)',
      }}
    >
      <div className="flex items-center gap-2.5">
        <span className="text-base">{overdue.length ? '🔴' : '🟡'}</span>
        <div>
          <p className="text-xs font-bold text-white leading-tight">
            {overdue.length > 0 ? `${overdue.length} overdue invoice${overdue.length > 1 ? 's' : ''}` : `${unpaid.length} unpaid invoice${unpaid.length > 1 ? 's' : ''}`}
          </p>
          <p className="text-[10px] text-[rgba(153,197,255,0.45)]">{fmt(total)} outstanding</p>
        </div>
      </div>
      <span className={`text-xs font-black px-2.5 py-1 rounded-lg ${
        overdue.length ? 'bg-red-500/20 text-red-300' : 'bg-amber-500/20 text-amber-300'
      }`}>
        Chase →
      </span>
    </button>
  );
}

// ─── Main mobile dashboard ────────────────────────────────────────────────────
export default function MobileDashboard({
  score,
  weekJobs,
  jobsToday,
  feed,
  actions,
  badges,
  invoices,
  onNavigate,
  onLogPayment,
  onShare,
  displayName,
  isLive,
  dataLoading,
}) {
  const todayRevenue = (weekJobs || []).find(d => d.isToday)?.revenue ?? 0;
  const weekRevenue  = (weekJobs || []).filter(d => d.done || d.isToday).reduce((s, d) => s + d.revenue, 0);
  const doneCount    = (jobsToday || []).filter(j => j.status === 'complete').length;
  const outstanding  = (invoices  || []).filter(i => i.status !== 'paid').reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const todayLabel   = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  const todayRevAnim    = useCountUp(todayRevenue, 1600);
  const weekRevAnim     = useCountUp(weekRevenue,  1700);
  const outstandingAnim = useCountUp(outstanding,  1400);

  return (
    <div className="flex flex-col min-h-full bg-gray-50/50">

      {/* ── Sticky header ── */}
      <div className="sticky top-0 z-20 bg-brand-navy text-white px-4 py-3 shadow-lg border-b border-white/10">
        <div className="flex items-center justify-between gap-3">
          {/* Greeting */}
          <div className="min-w-0">
            <p className="text-[10px] font-bold tracking-widest uppercase text-brand-skyblue/70 leading-none mb-0.5">
              {timeGreeting()}{displayName ? `, ${displayName}` : ''}
            </p>
            <p className="text-sm font-bold text-white leading-tight truncate">{todayLabel}</p>
          </div>
          {/* Today's revenue hero */}
          <div className="text-right shrink-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-brand-skyblue/60 leading-none mb-0.5">Today</p>
            <p className="text-2xl font-black tabular-nums text-white leading-tight">{fmt(todayRevAnim)}</p>
          </div>
        </div>
      </div>

      {/* ── KPI strip ── */}
      <div className="grid grid-cols-3 gap-px bg-white/20 border-b border-gray-200">
        <div className="bg-white/80 backdrop-blur px-2 py-2.5 text-center">
          <p className="text-[9px] font-bold tracking-widest uppercase text-gray-400 leading-none mb-1">Jobs today</p>
          <p className="text-base font-black tabular-nums text-brand-navy leading-none">
            {doneCount}/{(jobsToday || []).length}
          </p>
        </div>
        <div className="bg-white/80 backdrop-blur px-2 py-2.5 text-center">
          <p className="text-[9px] font-bold tracking-widest uppercase text-gray-400 leading-none mb-1">This week</p>
          <p className="text-base font-black tabular-nums text-brand-navy leading-none">{fmt(weekRevAnim)}</p>
        </div>
        <div className="bg-white/80 backdrop-blur px-2 py-2.5 text-center">
          <p className="text-[9px] font-bold tracking-widest uppercase text-gray-400 leading-none mb-1">Outstanding</p>
          <p className={`text-base font-black tabular-nums leading-none ${outstanding > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
            {fmt(outstandingAnim)}
          </p>
        </div>
      </div>

      {/* ── Scrollable body ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-3 pb-28">

          {/* Loading */}
          {isLive && dataLoading && (
            <div className="flex items-center justify-center py-8">
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white border border-gray-200 shadow-sm">
                <div className="w-4 h-4 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
                <span className="text-sm font-semibold text-gray-600">Loading your data…</span>
              </div>
            </div>
          )}

          {/* Priority alerts */}
          <AlertStrip actions={actions || []} onNavigate={onNavigate} />

          {/* Quick actions */}
          <div className="flex gap-2.5">
            <button
              onClick={onLogPayment}
              className="flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl text-white text-sm font-bold shadow-lg active:scale-[0.97] transition-all"
              style={{
                background: 'linear-gradient(135deg, #040810 0%, #06103c 100%)',
                border: '1px solid rgba(79,120,255,0.3)',
              }}
            >
              <span className="text-base">💷</span>
              <span>Log payment</span>
            </button>
            <button
              onClick={() => onNavigate('scheduler')}
              className="flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl bg-blue-600 text-white text-sm font-bold shadow-lg shadow-blue-900/30 active:scale-[0.97] transition-all"
            >
              <span className="text-base leading-none">+</span>
              <span>New job</span>
            </button>
          </div>

          {/* Today's jobs — main content */}
          <MobileTodaysJobs jobs={jobsToday || []} onNavigate={onNavigate} />

          {/* Outstanding invoices pill — only if there's anything */}
          <OutstandingPill invoices={invoices || []} onNavigate={onNavigate} />

          {/* Week mini chart */}
          <MobileWeekMini weekJobs={weekJobs || []} />

          {/* Score card (expandable) */}
          <MobileScoreCard score={score} />

          {/* Badges row */}
          <MobileBadgesRow badges={badges || []} onShare={onShare} />

          {/* Activity feed */}
          <MobileActivityFeed feed={feed || []} />

        </div>
      </div>
    </div>
  );
}
