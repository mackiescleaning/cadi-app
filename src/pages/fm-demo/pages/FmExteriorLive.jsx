const LIVE_JOBS = [
  { id: 'lj1', sub: 'Clearview Window Services', site: 'L&D Hospital – Main Tower', service: 'Window cleaning', status: 'on-site', eta: null, floors: '1–4 complete' },
  { id: 'lj2', sub: 'ProWash Midlands', site: 'Aldi Dunstable RDC', service: 'Jet washing', status: 'en-route', eta: '14 min', floors: null },
  { id: 'lj3', sub: 'Capital Gutters Ltd', site: 'Next Luton The Mall', service: 'Gutter clearing', status: 'complete', eta: null, floors: '6 photos uploaded' },
  { id: 'lj4', sub: 'CleanFront UK', site: 'Watford Life Sciences Park', service: 'Window cleaning', status: 'on-site', eta: null, floors: 'Ground floor done' },
  { id: 'lj5', sub: 'SprayTech Services', site: 'Luton Borough Council HQ', service: 'Graffiti removal', status: 'pending', eta: 'Tomorrow 08:00', floors: null },
];

const STATUS_CFG = {
  'on-site':  { label: 'On site',    color: '#34d399', dot: true  },
  'en-route': { label: 'En route',   color: '#38bdf8', dot: true  },
  'complete': { label: 'Complete',   color: '#a78bfa', dot: false },
  'pending':  { label: 'Scheduled',  color: '#fbbf24', dot: false },
};

const SERVICE_ICONS = {
  'Window cleaning':  '🪟',
  'Jet washing':      '💧',
  'Gutter clearing':  '🍂',
  'Graffiti removal': '🖌️',
};

export default function FmExteriorLive({ showToast }) {
  const onSite   = LIVE_JOBS.filter(j => j.status === 'on-site').length;
  const enRoute  = LIVE_JOBS.filter(j => j.status === 'en-route').length;
  const complete = LIVE_JOBS.filter(j => j.status === 'complete').length;

  return (
    <div className="p-6 space-y-5 max-w-4xl">
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'On site now',   value: onSite,   color: '#34d399' },
          { label: 'En route',      value: enRoute,  color: '#38bdf8' },
          { label: 'Completed today', value: complete, color: '#a78bfa' },
          { label: 'Jobs today',    value: LIVE_JOBS.length, color: '#fbbf24' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="text-2xl font-black" style={{ color }}>{value}</div>
            <div className="text-white/70 text-xs font-bold mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        {LIVE_JOBS.map(job => {
          const cfg = STATUS_CFG[job.status];
          return (
            <div key={job.id} className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0" style={{ background: 'rgba(14,165,233,0.1)', border: '1px solid rgba(14,165,233,0.2)' }}>
                  {SERVICE_ICONS[job.service] || '🧹'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-white font-black text-sm">{job.sub}</span>
                    <div className="flex items-center gap-1.5">
                      {cfg.dot && <div className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.color, boxShadow: `0 0 6px ${cfg.color}` }} />}
                      <span className="text-[10px] font-black" style={{ color: cfg.color }}>{cfg.label}</span>
                    </div>
                  </div>
                  <div className="text-white/50 text-xs mt-0.5">{job.site} · {job.service}</div>
                  {(job.floors || job.eta) && (
                    <div className="text-white/30 text-[11px] mt-0.5">{job.floors || `ETA: ${job.eta}`}</div>
                  )}
                </div>
                <div className="flex gap-1.5 shrink-0">
                  {job.status === 'complete' && (
                    <button onClick={() => showToast(`approve evidence for ${job.sub}`)} className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-emerald-400/70 hover:text-emerald-300 transition-all" style={{ border: '1px solid rgba(52,211,153,0.2)' }}>Approve</button>
                  )}
                  <button onClick={() => showToast(`contact ${job.sub}`)} className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-white/40 hover:text-white transition-all" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>Contact</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
