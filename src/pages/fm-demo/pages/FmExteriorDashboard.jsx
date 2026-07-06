const ACTIVITY = [
  {
    time: '09:22',
    text: 'Window clean complete — Next Luton · 8 photos uploaded',
    type: 'complete',
  },
  {
    time: '09:05',
    text: 'Quote received — ProWash Midlands · Tesco Welwyn jet wash · £280',
    type: 'quote',
  },
  {
    time: '08:47',
    text: 'Job approved — Capital Gutters Ltd · L&D Hospital gutter clear',
    type: 'approved',
  },
  {
    time: '08:30',
    text: 'Contractor en route — Clearview Window Services · L&D Hospital · ETA 14 min',
    type: 'enroute',
  },
  {
    time: '08:10',
    text: 'Job card sent — SprayTech Services · Luton Council HQ graffiti',
    type: 'sent',
  },
  {
    time: '07:55',
    text: 'Declined — CleanFront UK · Watford Wed slot · backup auto-notified',
    type: 'declined',
  },
];

const META = {
  complete: {
    color: '#34d399',
    bg: 'rgba(52,211,153,0.1)',
    border: 'rgba(52,211,153,0.2)',
    dot: '✓',
  },
  quote: { color: '#38bdf8', bg: 'rgba(56,189,248,0.1)', border: 'rgba(56,189,248,0.2)', dot: '£' },
  approved: {
    color: '#a78bfa',
    bg: 'rgba(167,139,250,0.1)',
    border: 'rgba(167,139,250,0.2)',
    dot: '✓',
  },
  enroute: {
    color: '#fbbf24',
    bg: 'rgba(251,191,36,0.1)',
    border: 'rgba(251,191,36,0.2)',
    dot: '→',
  },
  sent: { color: '#60a5fa', bg: 'rgba(96,165,250,0.1)', border: 'rgba(96,165,250,0.2)', dot: '↗' },
  declined: {
    color: '#f87171',
    bg: 'rgba(248,113,113,0.1)',
    border: 'rgba(248,113,113,0.2)',
    dot: '✗',
  },
};

const SERVICE_BREAKDOWN = [
  { label: 'Window cleaning', pct: 45, color: '#38bdf8', value: '£4,680/mo' },
  { label: 'Jet washing', pct: 28, color: '#a78bfa', value: '£2,912/mo' },
  { label: 'Gutter clearing', pct: 18, color: '#34d399', value: '£1,872/mo' },
  { label: 'Graffiti removal', pct: 9, color: '#f87171', value: '£936/mo' },
];

const IMPACT = [
  {
    before: 'Contractors contacted by phone and email for every job',
    after: 'Job cards broadcast to matched contractors in one click',
    icon: '📲',
  },
  {
    before: 'Quotes tracked in email threads — easily lost',
    after: 'Every quote, rate and response in one place',
    icon: '💷',
  },
  {
    before: 'Interior and exterior managed as separate businesses',
    after: 'Both sides of Britannia, one system, one client record',
    icon: '🔗',
  },
];

export default function FmExteriorDashboard({ showToast: _showToast, onNavigate }) {
  return (
    <div className="p-6 space-y-5">
      {/* Impact strip */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ border: '1px solid rgba(14,165,233,0.2)', background: 'rgba(1,8,40,0.6)' }}
      >
        <div
          className="px-5 py-2.5 flex items-center gap-3"
          style={{
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            background: 'rgba(14,165,233,0.06)',
          }}
        >
          <span className="text-[9px] font-black uppercase tracking-widest text-white/30">
            What Cadi replaces
          </span>
          <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
          <span
            className="text-[9px] font-black uppercase tracking-widest"
            style={{ color: '#38bdf8' }}
          >
            With Cadi
          </span>
        </div>
        <div
          className="grid grid-cols-3 divide-x"
          style={{ borderColor: 'rgba(255,255,255,0.06)' }}
        >
          {IMPACT.map(({ before, after, icon }) => (
            <div key={icon} className="px-4 py-3 flex items-start gap-3">
              <span className="text-xl flex-shrink-0 mt-0.5">{icon}</span>
              <div>
                <div className="text-[10px] text-white/30 line-through decoration-white/20 mb-1 leading-snug">
                  {before}
                </div>
                <div className="text-[10px] font-bold leading-snug" style={{ color: '#38bdf8' }}>
                  {after}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Active contracts', value: '8', color: '#38bdf8', sub: 'across 13 sites' },
          { label: 'Jobs this week', value: '24', color: '#34d399', sub: '7 completed today' },
          { label: 'Pending approvals', value: '3', color: '#fbbf24', sub: 'from contractor pool' },
          {
            label: 'Revenue this month',
            value: '£18.4k',
            color: '#a78bfa',
            sub: 'exterior contracts',
          },
        ].map(({ label, value, color, sub }) => (
          <div
            key={label}
            className="rounded-2xl p-4"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <div className="text-2xl font-black" style={{ color }}>
              {value}
            </div>
            <div className="text-white/70 text-xs font-bold mt-0.5">{label}</div>
            <div className="text-white/30 text-[10px] mt-0.5">{sub}</div>
          </div>
        ))}
      </div>

      {/* Pending approvals alert */}
      <div
        className="flex items-center gap-4 rounded-xl px-5 py-3.5"
        style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)' }}
      >
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center text-sm shrink-0"
          style={{ background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.3)' }}
        >
          ⏳
        </div>
        <span className="text-sm font-bold text-amber-300 flex-1">
          3 job cards awaiting sub approval — 2 due this week
        </span>
        <button
          onClick={() => onNavigate && onNavigate('ext-approvals')}
          className="text-xs font-black px-3 py-1.5 rounded-lg shrink-0"
          style={{
            background: 'rgba(251,191,36,0.15)',
            border: '1px solid rgba(251,191,36,0.3)',
            color: '#fcd34d',
          }}
        >
          View approvals →
        </button>
      </div>

      <div className="grid grid-cols-[1fr_300px] gap-5">
        {/* Activity feed */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(1,8,40,0.5)' }}
        >
          <div
            className="px-5 py-3 flex items-center justify-between"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
          >
            <span className="text-white font-black text-sm">Live activity</span>
            <div className="flex items-center gap-1.5">
              <div
                className="w-1.5 h-1.5 rounded-full bg-emerald-400"
                style={{ boxShadow: '0 0 6px #34d399' }}
              />
              <span className="text-white/30 text-[10px] font-bold">LIVE</span>
            </div>
          </div>
          <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
            {ACTIVITY.map(({ time, text, type }) => {
              const m = META[type];
              return (
                <div key={time + text} className="px-5 py-3 flex items-start gap-3">
                  <div
                    className="w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-black shrink-0 mt-0.5"
                    style={{ background: m.bg, border: `1px solid ${m.border}`, color: m.color }}
                  >
                    {m.dot}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-white/70 text-[11px] leading-snug">{text}</div>
                  </div>
                  <span className="text-white/25 text-[10px] shrink-0 mt-0.5">{time}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Service breakdown */}
        <div className="space-y-4">
          <div
            className="rounded-2xl p-5"
            style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(1,8,40,0.5)' }}
          >
            <div className="text-white font-black text-sm mb-4">Revenue by service type</div>
            <div className="space-y-3">
              {SERVICE_BREAKDOWN.map(({ label, pct, color, value }) => (
                <div key={label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-white/60 text-xs">{label}</span>
                    <span className="text-xs font-bold" style={{ color }}>
                      {value}
                    </span>
                  </div>
                  <div
                    className="h-1.5 rounded-full"
                    style={{ background: 'rgba(255,255,255,0.06)' }}
                  >
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${pct}%`,
                        background: color,
                        boxShadow: `0 0 8px ${color}60`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick actions */}
          <div
            className="rounded-2xl p-4 space-y-2"
            style={{
              border: '1px solid rgba(14,165,233,0.2)',
              background: 'rgba(14,165,233,0.05)',
            }}
          >
            <div className="text-white/40 text-[9px] font-black uppercase tracking-widest mb-3">
              Quick actions
            </div>
            {[
              { label: '🚀 Create new job card', nav: 'ext-quotes', color: '#38bdf8' },
              { label: '👷 Browse contractor pool', nav: 'ext-subs', color: '#34d399' },
              { label: '📋 Review pending quotes', nav: 'ext-quotes', color: '#a78bfa' },
            ].map(({ label, nav, color }) => (
              <button
                key={nav}
                onClick={() => onNavigate && onNavigate(nav)}
                className="w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition-all"
                style={{ background: `${color}10`, border: `1px solid ${color}25`, color }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
