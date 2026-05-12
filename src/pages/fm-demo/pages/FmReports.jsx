import clients from '../mock/clients.json';

const MONTHLY_DATA = [
  { month: 'Nov', jobs: 189, sla: 96, value: 23200 },
  { month: 'Dec', jobs: 201, sla: 97, value: 24800 },
  { month: 'Jan', jobs: 218, sla: 98, value: 26900 },
  { month: 'Feb', jobs: 209, sla: 96, value: 25700 },
  { month: 'Mar', jobs: 234, sla: 98, value: 28900 },
  { month: 'Apr', jobs: 241, sla: 99, value: 29700 },
  { month: 'May', jobs: 98,  sla: 98, value: 12100, partial: true },
];
const MAX_JOBS = 260;

const CLIENT_DATA = [
  { clientId: 'cl2', jobs: 61, value: 9800,  sla: 100 },
  { clientId: 'cl5', jobs: 48, value: 5900,  sla: 99  },
  { clientId: 'cl1', jobs: 42, value: 5200,  sla: 100 },
  { clientId: 'cl3', jobs: 31, value: 4200,  sla: 97  },
  { clientId: 'cl6', jobs: 28, value: 3600,  sla: 98  },
  { clientId: 'cl4', jobs: 18, value: 1900,  sla: 100 },
  { clientId: 'cl7', jobs: 8,  value: 1760,  sla: 100 },
  { clientId: 'cl8', jobs: 5,  value: 950,   sla: 99  },
];
const MAX_CLIENT_JOBS = 70;

function GlassCard({ children, className = '', style = {} }) {
  return (
    <div className={`rounded-2xl ${className}`}
      style={{ background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.1)', ...style }}>
      {children}
    </div>
  );
}

export default function FmReports({ showToast }) {
  return (
    <div className="p-8 space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="text-white font-black text-xl">Monthly reports</div>
          <div className="text-white/40 text-sm mt-0.5">April 2026 · Britannia FM Network</div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => showToast('generate client report PDF for all clients')}
            className="px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-colors"
            style={{ background: 'rgba(79,120,255,0.2)', border: '1px solid rgba(79,120,255,0.4)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(79,120,255,0.32)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(79,120,255,0.2)'}
          >
            Generate all client reports
          </button>
          <button onClick={() => showToast('export April 2026 data to CSV')}
            className="px-4 py-2.5 rounded-xl text-sm font-medium text-white/60 hover:text-white/90 transition-colors"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
            Export CSV
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Jobs completed', value: '241',     sub: 'April 2026',       color: '#4f78ff', icon: '📋' },
          { label: 'SLA hit rate',   value: '99%',     sub: '2 minor breaches', color: '#34d399', icon: '✅' },
          { label: 'Total invoiced', value: '£29,700', sub: 'excl. VAT',        color: '#a78bfa', icon: '💷' },
          { label: 'Active network', value: '27',      sub: 'cleaners · 15 sites', color: '#fbbf24', icon: '👥' },
        ].map(({ label, value, sub, color, icon }) => (
          <div key={label} className="rounded-2xl p-5"
            style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.04) 100%)',
              backdropFilter: 'blur(16px)',
              border: `1px solid ${color}25`,
              boxShadow: `0 0 30px ${color}10`,
            }}>
            <div className="flex items-start justify-between mb-3">
              <div className="text-3xl font-black" style={{ color }}>{value}</div>
              <span className="text-lg opacity-60">{icon}</span>
            </div>
            <div className="text-white font-bold text-sm">{label}</div>
            <div className="text-white/40 text-xs mt-0.5">{sub}</div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-[1fr_280px] gap-5">

        {/* Bar chart — jobs per month */}
        <GlassCard>
          <div className="px-6 pt-5 pb-4 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <div>
              <div className="text-white font-bold text-sm">Job volume</div>
              <div className="text-white/35 text-xs mt-0.5">Nov 2025 – May 2026</div>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-[#4f78ff]" /><span className="text-white/40">Completed</span></div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-[#4f78ff]/35" /><span className="text-white/40">Partial</span></div>
            </div>
          </div>
          <div className="px-6 pb-5 pt-4">
            <div className="flex items-end gap-4 h-36">
              {MONTHLY_DATA.map(({ month, jobs, partial }) => (
                <div key={month} className="flex-1 flex flex-col items-center gap-2">
                  <div className="text-white/50 text-[10px] font-bold">{jobs}</div>
                  <div className="w-full rounded-t-lg transition-all relative group"
                    style={{
                      height: `${(jobs / MAX_JOBS) * 100}%`,
                      background: partial
                        ? 'linear-gradient(to top, rgba(79,120,255,0.2), rgba(79,120,255,0.35))'
                        : 'linear-gradient(to top, #3b5fd6, #4f78ff)',
                      boxShadow: partial ? 'none' : '0 0 12px rgba(79,120,255,0.3)',
                    }}
                  >
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                      <div className="text-[9px] text-white bg-[#010a4f]/90 px-2 py-1 rounded">{jobs} jobs</div>
                    </div>
                  </div>
                  <div className="text-white/35 text-[10px]">{month}</div>
                </div>
              ))}
            </div>
          </div>
        </GlassCard>

        {/* SLA trend */}
        <GlassCard>
          <div className="px-5 pt-5 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="text-white font-bold text-sm">SLA trend</div>
            <div className="text-white/35 text-xs mt-0.5">Monthly hit rate</div>
          </div>
          <div className="p-5 space-y-3">
            {MONTHLY_DATA.map(({ month, sla }) => (
              <div key={month} className="flex items-center gap-3">
                <div className="text-white/40 text-xs w-8 shrink-0">{month}</div>
                <div className="flex-1 rounded-full overflow-hidden h-2" style={{ background: 'rgba(255,255,255,0.08)' }}>
                  <div className="h-full rounded-full transition-all"
                    style={{
                      width: `${sla}%`,
                      background: sla >= 99 ? '#34d399' : sla >= 97 ? '#60a5fa' : '#fbbf24',
                    }}
                  />
                </div>
                <div className="text-white font-bold text-xs w-10 text-right shrink-0"
                  style={{ color: sla >= 99 ? '#34d399' : sla >= 97 ? '#60a5fa' : '#fbbf24' }}>
                  {sla}%
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      {/* Client breakdown */}
      <GlassCard>
        <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="text-white font-bold text-sm">Client breakdown — April 2026</div>
          <span className="text-white/35 text-xs">8 active clients</span>
        </div>
        {/* Header row */}
        <div className="grid px-6 py-2.5" style={{ gridTemplateColumns: '1fr 80px 120px 100px 110px 120px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          {['Client', 'Jobs', 'Job volume', 'Value', 'SLA', 'Action'].map(h => (
            <div key={h} className="text-[9px] font-black uppercase tracking-widest text-white/25">{h}</div>
          ))}
        </div>
        <div>
          {CLIENT_DATA.map(({ clientId, jobs, value, sla }) => {
            const client = clients.find(c => c.id === clientId);
            return (
              <div key={clientId} className="grid px-6 py-3.5 transition-colors"
                style={{ gridTemplateColumns: '1fr 80px 120px 100px 110px 120px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                onMouseLeave={e => e.currentTarget.style.background = ''}
              >
                <div>
                  <div className="text-white font-medium text-sm truncate">{client?.name}</div>
                  <div className="text-white/35 text-xs">{client?.sector}</div>
                </div>
                <div className="text-white font-bold text-sm self-center">{jobs}</div>
                {/* Mini bar */}
                <div className="self-center pr-4">
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                    <div className="h-full rounded-full bg-[#4f78ff]" style={{ width: `${(jobs / MAX_CLIENT_JOBS) * 100}%` }} />
                  </div>
                </div>
                <div className="text-white font-bold text-sm self-center">£{value.toLocaleString()}</div>
                <div className="self-center">
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                    style={sla === 100
                      ? { background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', color: '#34d399' }
                      : sla >= 98
                      ? { background: 'rgba(79,120,255,0.12)', border: '1px solid rgba(79,120,255,0.3)', color: '#60a5fa' }
                      : { background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', color: '#fbbf24' }
                    }>
                    {sla}% SLA
                  </span>
                </div>
                <div className="self-center">
                  <button
                    onClick={() => showToast(`generate ${client?.name} client report PDF`)}
                    className="text-xs font-bold text-[#4f78ff]/70 hover:text-[#4f78ff] transition-colors"
                  >
                    Generate report →
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </GlassCard>

      {/* Download CTA */}
      <div className="rounded-2xl p-6 flex items-center justify-between"
        style={{ background: 'linear-gradient(135deg, rgba(79,120,255,0.12) 0%, rgba(79,120,255,0.06) 100%)', border: '1px solid rgba(79,120,255,0.2)' }}>
        <div>
          <div className="text-white font-black text-base">April 2026 full report pack</div>
          <div className="text-white/45 text-sm mt-0.5">Includes per-client PDFs, SLA evidence summary, network performance, and invoice totals.</div>
        </div>
        <button onClick={() => showToast('download April 2026 full report pack')}
          className="px-6 py-3 rounded-xl text-sm font-black text-white shrink-0 ml-6 transition-colors"
          style={{ background: 'rgba(79,120,255,0.3)', border: '1px solid rgba(79,120,255,0.5)' }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(79,120,255,0.45)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(79,120,255,0.3)'}
        >
          Download pack (demo)
        </button>
      </div>
    </div>
  );
}
