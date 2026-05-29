const CONTRACTS = [
  { id: 'ec1', client: 'L&D Hospital NHS FT', services: ['Window cleaning', 'Gutter clearing'], sites: 3, value: '£2,800/mo', status: 'active', next: '28 May' },
  { id: 'ec2', client: 'Next Retail UK Ltd', services: ['Window cleaning', 'Jet washing'], sites: 2, value: '£1,400/mo', status: 'active', next: '1 Jun' },
  { id: 'ec3', client: 'Aldi Distribution – Dunstable', services: ['Jet washing', 'Graffiti removal'], sites: 1, value: '£960/mo', status: 'active', next: '15 Jun' },
  { id: 'ec4', client: 'Luton Borough Council', services: ['Window cleaning', 'Jet washing', 'Gutter clearing'], sites: 6, value: '£4,200/mo', status: 'renewing', next: '30 Jun' },
  { id: 'ec5', client: 'Watford Life Sciences Park', services: ['Window cleaning'], sites: 1, value: '£780/mo', status: 'active', next: '10 Jun' },
];

const SERVICE_COLOURS = {
  'Window cleaning':    { color: '#38bdf8', bg: 'rgba(56,189,248,0.1)',  border: 'rgba(56,189,248,0.25)'  },
  'Gutter clearing':    { color: '#34d399', bg: 'rgba(52,211,153,0.1)',  border: 'rgba(52,211,153,0.25)'  },
  'Jet washing':        { color: '#a78bfa', bg: 'rgba(167,139,250,0.1)', border: 'rgba(167,139,250,0.25)' },
  'Graffiti removal':   { color: '#f87171', bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.25)' },
};

const STATUS_CFG = {
  active:    { label: 'Active',    color: '#34d399', bg: 'rgba(52,211,153,0.1)',  border: 'rgba(52,211,153,0.25)'  },
  renewing:  { label: 'Renewing', color: '#fbbf24', bg: 'rgba(251,191,36,0.1)',  border: 'rgba(251,191,36,0.25)'  },
};

const IMPACT = [
  { before: 'Contracts tracked in spreadsheets — renewals missed', after: 'Every exterior contract live, renewal alerts automatic', icon: '📋' },
  { before: 'Service types mixed up across sites', after: 'Windows, gutters, jet wash — separated per site per visit', icon: '🪟' },
  { before: 'Interior and exterior billed separately, reconciled manually', after: 'Combined client view — one relationship, full revenue visible', icon: '💷' },
];

export default function FmExteriorContracts({ showToast }) {
  const total = CONTRACTS.reduce((s, c) => s + parseFloat(c.value.replace(/[^0-9.]/g, '')), 0);

  return (
    <div className="p-6 space-y-5 max-w-4xl">
      {/* Impact strip */}
      <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(14,165,233,0.18)', background: 'rgba(1,8,40,0.6)' }}>
        <div className="px-5 py-2.5 flex items-center gap-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(14,165,233,0.06)' }}>
          <span className="text-[9px] font-black uppercase tracking-widest text-white/30">What Cadi replaces</span>
          <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
          <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: '#38bdf8' }}>With Cadi</span>
        </div>
        <div className="grid grid-cols-3 divide-x" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          {IMPACT.map(({ before, after, icon }) => (
            <div key={icon} className="px-4 py-3 flex items-start gap-3">
              <span className="text-xl flex-shrink-0 mt-0.5">{icon}</span>
              <div>
                <div className="text-[10px] text-white/30 line-through decoration-white/20 mb-1 leading-snug">{before}</div>
                <div className="text-[10px] font-bold leading-snug" style={{ color: '#38bdf8' }}>{after}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Active contracts', value: CONTRACTS.filter(c => c.status === 'active').length, color: '#34d399' },
          { label: 'Sites covered', value: CONTRACTS.reduce((s, c) => s + c.sites, 0), color: '#38bdf8' },
          { label: 'Revenue/mo', value: `£${(total / 1000).toFixed(1)}k`, color: '#a78bfa' },
          { label: 'Up for renewal', value: CONTRACTS.filter(c => c.status === 'renewing').length, color: '#fbbf24' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="text-2xl font-black" style={{ color }}>{value}</div>
            <div className="text-white/70 text-xs font-bold mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button onClick={() => showToast('open new exterior contract wizard')}
          className="px-4 py-2.5 rounded-xl text-xs font-black"
          style={{ background: 'linear-gradient(135deg, rgba(14,165,233,0.3), rgba(2,132,199,0.2))', border: '1px solid rgba(14,165,233,0.4)', color: 'white' }}>
          + New exterior contract
        </button>
      </div>

      <div className="space-y-3">
        {CONTRACTS.map(c => {
          const cfg = STATUS_CFG[c.status];
          return (
            <div key={c.id} className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 flex-wrap mb-2">
                    <span className="text-white font-black text-sm">{c.client}</span>
                    <span className="text-[9px] font-black px-2 py-0.5 rounded-full" style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}>{cfg.label}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {c.services.map(s => {
                      const sc = SERVICE_COLOURS[s] || { color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', border: 'rgba(148,163,184,0.25)' };
                      return <span key={s} className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ color: sc.color, background: sc.bg, border: `1px solid ${sc.border}` }}>{s}</span>;
                    })}
                  </div>
                  <div className="flex gap-4 text-xs text-white/40">
                    <span>{c.sites} site{c.sites !== 1 ? 's' : ''}</span>
                    <span className="text-white/20">·</span>
                    <span className="font-bold text-white/60">{c.value}</span>
                    <span className="text-white/20">·</span>
                    <span>Next visit: <span className="text-sky-400/80">{c.next}</span></span>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <button onClick={() => showToast(`open exterior contract for ${c.client}`)} className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-white/50 hover:text-white transition-all" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>View</button>
                  <button onClick={() => showToast(`schedule next visit for ${c.client}`)} className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-sky-400/60 hover:text-sky-300 transition-all" style={{ border: '1px solid rgba(14,165,233,0.2)' }}>Schedule</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
