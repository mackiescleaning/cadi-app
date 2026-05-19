const TENDERS = [
  {
    id: 't1', client: 'Amazon Fulfilment Centre – Tilbury',
    type: 'Industrial', sites: 1, value: '£8,400/mo',
    deadline: null, status: 'awarded',
    notes: 'Awarded 4 May 2026. Contract start 1 June. Operative matching in progress.',
    contact: 'Facilities Ops, Amazon UK',
  },
  {
    id: 't2', client: 'NHS Property Services – Luton Cluster',
    type: 'Healthcare', sites: 4, value: '£22,000/mo est.',
    deadline: '30 May 2026', status: 'submitted',
    notes: 'Tender submitted 14 May. Includes L&D satellite clinics, GP hubs. Decision expected by 30 May.',
    contact: 'NHS PS Procurement, London',
  },
  {
    id: 't3', client: 'Luton Airport – Terminal 1 Public Areas',
    type: 'Transport', sites: 1, value: '£14,500/mo est.',
    deadline: '6 Jun 2026', status: 'preparing',
    notes: 'ITT received 16 May. Site visit arranged 22 May. Cadi evidence pack and SLA data being compiled.',
    contact: 'London Luton Airport Operations Ltd',
  },
  {
    id: 't4', client: 'Tesco Distribution – Welwyn Garden City',
    type: 'Industrial', sites: 1, value: '£5,200/mo est.',
    deadline: '14 Jun 2026', status: 'preparing',
    notes: 'Early stage. Pre-qualification questionnaire in progress. Cadi compliance docs ready to export.',
    contact: 'Tesco Property & FM',
  },
  {
    id: 't5', client: 'Hertfordshire County Council – Schools Framework',
    type: 'Education', sites: 12, value: '£38,000/mo est.',
    deadline: null, status: 'lost',
    notes: 'Awarded to ISS Facility Services 2 May. Price was competitive — lost on experience weighting. Lessons documented.',
    contact: 'HCC Procurement',
  },
];

const STATUS_CONFIG = {
  awarded:   { label: 'Awarded ✓',    color: '#34d399', bg: 'rgba(52,211,153,0.1)',  border: 'rgba(52,211,153,0.25)'  },
  submitted: { label: 'Submitted',    color: '#4f78ff', bg: 'rgba(79,120,255,0.1)',  border: 'rgba(79,120,255,0.25)'  },
  preparing: { label: 'In prep',      color: '#fbbf24', bg: 'rgba(251,191,36,0.1)',  border: 'rgba(251,191,36,0.25)'  },
  lost:      { label: 'Not awarded',  color: '#94a3b8', bg: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.2)' },
};

const TYPE_COLORS = {
  'Industrial':  '#fbbf24',
  'Healthcare':  '#34d399',
  'Transport':   '#60a5fa',
  'Education':   '#f472b6',
  'Retail':      '#4f78ff',
};

export default function FmTenderPacks({ showToast }) {
  const awarded   = TENDERS.filter(t => t.status === 'awarded').length;
  const submitted = TENDERS.filter(t => t.status === 'submitted').length;
  const preparing = TENDERS.filter(t => t.status === 'preparing').length;
  const pipeline  = TENDERS.filter(t => t.status !== 'lost').reduce((s, t) => s + parseFloat(t.value.replace(/[^0-9.]/g, '')), 0);

  return (
    <div className="p-6 space-y-5 max-w-4xl">

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Awarded this month', value: awarded,        color: '#34d399' },
          { label: 'Submitted',          value: submitted,      color: '#4f78ff' },
          { label: 'In preparation',     value: preparing,      color: '#fbbf24' },
          { label: 'Pipeline value',     value: `£${(pipeline/1000).toFixed(0)}k+/mo`, color: '#a78bfa' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-2xl p-4"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="text-2xl font-black" style={{ color }}>{value}</div>
            <div className="text-white/70 text-xs font-bold mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-3">
        <button onClick={() => showToast('create new tender pack')}
          className="px-4 py-2.5 rounded-xl text-xs font-black transition-all"
          style={{ background: 'linear-gradient(135deg, rgba(79,120,255,0.3), rgba(99,102,241,0.2))', border: '1px solid rgba(79,120,255,0.4)', color: 'white' }}>
          + New tender pack
        </button>
        <button onClick={() => showToast('export Cadi evidence pack for active tenders')}
          className="px-4 py-2.5 rounded-xl text-xs font-bold text-white/50 hover:text-white transition-all"
          style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
          Export evidence pack
        </button>
        <div className="ml-auto text-xs text-white/25">Cadi auto-compiles SLA data, photo evidence and compliance docs for each tender</div>
      </div>

      {/* Tender list */}
      <div className="space-y-3">
        {TENDERS.map(t => {
          const cfg = STATUS_CONFIG[t.status];
          const typeColor = TYPE_COLORS[t.type] || '#94a3b8';
          return (
            <div key={t.id} className="rounded-2xl p-5"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', opacity: t.status === 'lost' ? 0.55 : 1 }}>
              <div className="flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-white font-black text-sm">{t.client}</span>
                    <span className="text-[9px] font-black px-2 py-0.5 rounded-full"
                      style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}>
                      {cfg.label}
                    </span>
                    <span className="text-[9px] px-2 py-0.5 rounded-full"
                      style={{ color: typeColor, background: `${typeColor}15`, border: `1px solid ${typeColor}30` }}>
                      {t.type}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-1.5 text-xs text-white/40">
                    <span>{t.sites} site{t.sites !== 1 ? 's' : ''}</span>
                    <span className="text-white/20">·</span>
                    <span className="font-bold text-white/60">{t.value}</span>
                    {t.deadline && (
                      <>
                        <span className="text-white/20">·</span>
                        <span>Deadline: <span className="text-amber-400/80">{t.deadline}</span></span>
                      </>
                    )}
                  </div>
                  <div className="mt-2 text-[11px] text-white/40">{t.notes}</div>
                  <div className="mt-1 text-[10px] text-white/25">{t.contact}</div>
                </div>
                {t.status !== 'lost' && (
                  <div className="flex flex-col gap-1.5 shrink-0">
                    <button onClick={() => showToast(`open ${t.client} tender pack`)}
                      className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-white/50 hover:text-white transition-all"
                      style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
                      Open pack
                    </button>
                    <button onClick={() => showToast(`export Cadi evidence for ${t.client}`)}
                      className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-white/35 hover:text-white/70 transition-all"
                      style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
                      Export evidence
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
