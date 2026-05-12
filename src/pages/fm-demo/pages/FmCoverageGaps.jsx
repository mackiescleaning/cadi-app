import cleaners from '../mock/cleaners.json';

const COVERAGE_AREAS = [
  { area: 'St Albans',      county: 'Hertfordshire', jobsWon: 48, cleaners: 8,  demand: 60, status: 'good'     },
  { area: 'Luton',          county: 'Bedfordshire',  jobsWon: 62, cleaners: 5,  demand: 80, status: 'critical' },
  { area: 'Milton Keynes',  county: 'Buckinghamshire',jobsWon: 31, cleaners: 6,  demand: 45, status: 'ok'       },
  { area: 'Watford',        county: 'Hertfordshire', jobsWon: 44, cleaners: 4,  demand: 55, status: 'critical' },
  { area: 'Bedford',        county: 'Bedfordshire',  jobsWon: 22, cleaners: 3,  demand: 35, status: 'low'      },
  { area: 'Aylesbury',      county: 'Buckinghamshire',jobsWon: 18, cleaners: 4,  demand: 28, status: 'ok'       },
  { area: 'Hemel Hempstead',county: 'Hertfordshire', jobsWon: 27, cleaners: 3,  demand: 40, status: 'low'      },
  { area: 'Stevenage',      county: 'Hertfordshire', jobsWon: 14, cleaners: 2,  demand: 22, status: 'low'      },
];

const STATUS_CONFIG = {
  good:     { color: '#34d399', bg: 'rgba(16,185,129,0.1)',  border: 'rgba(16,185,129,0.25)',  label: 'Well covered' },
  ok:       { color: '#60a5fa', bg: 'rgba(59,130,246,0.1)',  border: 'rgba(59,130,246,0.25)',  label: 'Adequate'     },
  low:      { color: '#fbbf24', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.25)',  label: 'Under-staffed' },
  critical: { color: '#f87171', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.25)',   label: 'Critical gap' },
};

const SUGGESTED_INVITE = cleaners.filter(c => c.availability === 'invite').slice(0, 4);

export default function FmCoverageGaps({ showToast }) {
  const criticalCount  = COVERAGE_AREAS.filter(a => a.status === 'critical').length;
  const lowCount       = COVERAGE_AREAS.filter(a => a.status === 'low').length;
  const totalGap       = COVERAGE_AREAS.reduce((sum, a) => sum + Math.max(0, a.demand - a.cleaners * 6), 0);

  const glass = { background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.1)' };

  return (
    <div className="p-8 space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="text-white font-black text-xl">Coverage gaps</div>
          <div className="text-white/40 text-sm mt-0.5">Where demand exceeds your current network capacity</div>
        </div>
        <button onClick={() => showToast('send bulk invitations to suggested cleaners in all gap areas')}
          className="px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-colors"
          style={{ background: 'rgba(79,120,255,0.2)', border: '1px solid rgba(79,120,255,0.4)' }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(79,120,255,0.32)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(79,120,255,0.2)'}
        >
          Invite cleaners to all gaps
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-2xl p-5"
          style={{ background: 'linear-gradient(135deg, rgba(239,68,68,0.12) 0%, rgba(239,68,68,0.06) 100%)', border: '1px solid rgba(239,68,68,0.25)' }}>
          <div className="text-3xl font-black text-red-400 mb-1">{criticalCount}</div>
          <div className="text-white font-bold text-sm">Critical gaps</div>
          <div className="text-white/40 text-xs mt-0.5">Areas significantly understaffed</div>
        </div>
        <div className="rounded-2xl p-5"
          style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.12) 0%, rgba(245,158,11,0.06) 100%)', border: '1px solid rgba(245,158,11,0.25)' }}>
          <div className="text-3xl font-black text-amber-400 mb-1">{lowCount}</div>
          <div className="text-white font-bold text-sm">Under-staffed areas</div>
          <div className="text-white/40 text-xs mt-0.5">More cleaners needed</div>
        </div>
        <div className="rounded-2xl p-5"
          style={{ background: 'linear-gradient(135deg, rgba(79,120,255,0.12) 0%, rgba(79,120,255,0.06) 100%)', border: '1px solid rgba(79,120,255,0.25)' }}>
          <div className="text-3xl font-black text-[#60a5fa] mb-1">~{totalGap}</div>
          <div className="text-white font-bold text-sm">Job hours at risk</div>
          <div className="text-white/40 text-xs mt-0.5">Potential revenue gap per month</div>
        </div>
      </div>

      {/* Coverage area grid */}
      <div className="rounded-2xl overflow-hidden" style={glass}>
        <div className="px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="text-white font-bold text-sm">Coverage by area</div>
        </div>
        {/* Column headers */}
        <div className="grid px-6 py-2.5" style={{ gridTemplateColumns: '1fr 100px 120px 120px 120px 110px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          {['Area', 'Status', 'Cleaners', 'Capacity vs demand', 'Jobs won', 'Action'].map(h => (
            <div key={h} className="text-[9px] font-black uppercase tracking-widest text-white/25">{h}</div>
          ))}
        </div>
        <div>
          {COVERAGE_AREAS.map(({ area, county, jobsWon, cleaners: c, demand, status }) => {
            const cfg = STATUS_CONFIG[status];
            const capacity = c * 6;
            const fillPct  = Math.min(100, Math.round((capacity / demand) * 100));
            return (
              <div key={area} className="grid px-6 py-4 transition-colors"
                style={{ gridTemplateColumns: '1fr 100px 120px 120px 120px 110px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                onMouseLeave={e => e.currentTarget.style.background = ''}
              >
                <div>
                  <div className="text-white font-bold text-sm">{area}</div>
                  <div className="text-white/35 text-xs">{county}</div>
                </div>
                <div className="self-center">
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full"
                    style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color }}>
                    {cfg.label}
                  </span>
                </div>
                <div className="self-center">
                  <div className="text-white font-bold text-sm">{c}</div>
                  <div className="text-white/35 text-xs">in network</div>
                </div>
                {/* Fill bar */}
                <div className="self-center pr-4">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 rounded-full overflow-hidden h-1.5" style={{ background: 'rgba(255,255,255,0.1)' }}>
                      <div className="h-full rounded-full transition-all"
                        style={{ width: `${fillPct}%`, backgroundColor: cfg.color }} />
                    </div>
                    <span className="text-xs font-bold shrink-0" style={{ color: cfg.color }}>{fillPct}%</span>
                  </div>
                </div>
                <div className="text-white font-bold text-sm self-center">{jobsWon}</div>
                <div className="self-center">
                  {status !== 'good' ? (
                    <button onClick={() => showToast(`find and invite cleaners in ${area}`)}
                      className="text-xs font-bold transition-colors"
                      style={{ color: '#4f78ff' }}
                      onMouseEnter={e => e.currentTarget.style.color = '#60a5fa'}
                      onMouseLeave={e => e.currentTarget.style.color = '#4f78ff'}
                    >
                      Invite cleaners →
                    </button>
                  ) : (
                    <span className="text-xs text-white/25">Covered ✓</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Suggested cleaners to invite */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-white font-bold text-sm">Suggested cleaners to invite</div>
            <div className="text-white/35 text-xs mt-0.5">Cadi cleaners in your gap areas not yet in your network</div>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-4">
          {SUGGESTED_INVITE.map(c => (
            <div key={c.id} className="rounded-2xl p-5"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', backdropFilter: 'blur(12px)' }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-[#4f78ff]/20 border border-[#4f78ff]/25 text-white flex items-center justify-center text-sm font-black shrink-0">
                  {c.avatar}
                </div>
                <div className="min-w-0">
                  <div className="text-white font-bold text-sm truncate">{c.name}</div>
                  <div className="text-white/40 text-xs">{c.town}</div>
                </div>
              </div>
              <div className="space-y-1.5 mb-4">
                <div className="flex justify-between text-xs">
                  <span className="text-white/35">Cadi score</span>
                  <span className="font-bold" style={{ color: c.score >= 80 ? '#34d399' : c.score >= 70 ? '#60a5fa' : '#9ca3af' }}>{c.score}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-white/35">Completions</span>
                  <span className="text-white font-medium">{c.completions}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-white/35">SLA rate</span>
                  <span className="text-white font-medium">{c.slaRate}%</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-1 mb-4">
                {c.services.slice(0, 2).map(s => (
                  <span key={s} className="text-[10px] px-2 py-0.5 rounded-full text-[#4f78ff]"
                    style={{ background: 'rgba(79,120,255,0.12)', border: '1px solid rgba(79,120,255,0.2)' }}>
                    {s}
                  </span>
                ))}
              </div>
              <button onClick={() => showToast(`send network invitation to ${c.name}`)}
                className="w-full py-2 rounded-xl text-xs font-bold text-white transition-colors"
                style={{ background: 'rgba(79,120,255,0.2)', border: '1px solid rgba(79,120,255,0.35)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(79,120,255,0.32)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(79,120,255,0.2)'}
              >
                Invite to network
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
