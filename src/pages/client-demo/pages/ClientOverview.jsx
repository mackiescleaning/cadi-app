const SITES = [
  {
    id: 'rp', name: 'Riverside Primary',    address: 'Kempston, Bedford',
    status: 'good',    service: 'Daily morning clean',   jobs: 22, sla: 100,
    nextClean: 'Today 06:00–08:00',  lastNote: null,
  },
  {
    id: 'an', name: 'Academy Nursery',       address: 'Bedford Town',
    status: 'good',    service: 'Daily morning clean',   jobs: 22, sla: 100,
    nextClean: 'Today 06:30–08:30',  lastNote: null,
  },
  {
    id: 'rs', name: 'Riverside Secondary',  address: 'Kempston, Bedford',
    status: 'warning', service: 'Daily + periodic deep', jobs: 26, sla: 95,
    nextClean: 'Today 06:00–08:30',  lastNote: '30 Apr — late arrival · logged and resolved',
  },
  {
    id: 'sf', name: 'Sixth Form Centre',    address: 'Bedford Town',
    status: 'good',    service: 'Daily morning clean',   jobs: 20, sla: 100,
    nextClean: 'Today 07:00–09:00',  lastNote: null,
  },
  {
    id: 'ah', name: 'Trust Admin Hub',      address: 'Bedford',
    status: 'good',    service: 'Twice-weekly clean',    jobs: 9,  sla: 100,
    nextClean: 'Mon 12 May 08:00',   lastNote: null,
  },
];

const STATUS = {
  good:    { dot: '#10b981', bg: 'rgba(16,185,129,0.08)',  border: 'rgba(16,185,129,0.2)',  text: '#059669', label: 'All good'    },
  warning: { dot: '#f59e0b', bg: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.2)',  text: '#d97706', label: 'Note on file' },
  breach:  { dot: '#ef4444', bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.2)',   text: '#dc2626', label: 'SLA breach'   },
};

const MONTHLY = [
  { label: 'Jobs completed',   value: 99,    sub: 'across all 5 sites',  icon: '✅' },
  { label: 'SLA hit rate',     value: '97%', sub: '2 exceptions, resolved', icon: '📈' },
  { label: 'Photos uploaded',  value: 412,   sub: 'this month',          icon: '📸' },
  { label: 'Open issues',      value: 0,     sub: 'all resolved',        icon: '🟢' },
];

export default function ClientOverview({ showToast, onNavigate }) {
  const goodCount    = SITES.filter(s => s.status === 'good').length;
  const warningCount = SITES.filter(s => s.status === 'warning').length;
  const breachCount  = SITES.filter(s => s.status === 'breach').length;

  return (
    <div className="p-6 space-y-6">

      {/* Portfolio header */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="text-xs text-gray-400 mb-1">Portfolio overview</div>
        <h1 className="text-xl font-black text-[#010a4f]">Riverside Academy Trust</h1>
        <p className="text-sm text-gray-400 mt-1">Managed by Britannia FM · 5 sites under contract</p>
        <div className="flex items-center gap-4 mt-4">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-xs text-gray-600">{goodCount} all good</span>
          </div>
          {warningCount > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-amber-400" />
              <span className="text-xs text-gray-600">{warningCount} note on file</span>
            </div>
          )}
          {breachCount > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-red-400" />
              <span className="text-xs text-gray-600">{breachCount} SLA breach</span>
            </div>
          )}
        </div>
      </div>

      {/* Month stats */}
      <div className="grid grid-cols-4 gap-3">
        {MONTHLY.map(({ label, value, sub, icon }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="text-2xl mb-2">{icon}</div>
            <div className="text-2xl font-black text-[#010a4f]">{value}</div>
            <div className="text-xs font-bold text-[#010a4f] mt-0.5">{label}</div>
            <div className="text-[10px] text-gray-400 mt-0.5">{sub}</div>
          </div>
        ))}
      </div>

      {/* Site cards */}
      <div>
        <div className="text-xs font-black uppercase tracking-widest text-gray-400 mb-3">Your sites</div>
        <div className="space-y-3">
          {SITES.map(site => {
            const st = STATUS[site.status];
            return (
              <div key={site.id}
                className="bg-white rounded-2xl border shadow-sm p-5 flex items-start gap-4 transition-all hover:shadow-md"
                style={{ borderColor: site.status !== 'good' ? st.border : undefined }}>

                {/* Status dot */}
                <div className="w-2.5 h-2.5 rounded-full shrink-0 mt-1.5" style={{ backgroundColor: st.dot }} />

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm text-[#010a4f]">{site.name}</span>
                    {site.status !== 'good' && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: st.bg, border: `1px solid ${st.border}`, color: st.text }}>
                        {st.label}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">{site.address} · {site.service}</div>
                  {site.lastNote && (
                    <div className="text-xs text-amber-600 font-medium mt-1">{site.lastNote}</div>
                  )}
                </div>

                {/* Stats */}
                <div className="flex items-center gap-6 shrink-0">
                  <div className="text-right">
                    <div className="text-sm font-bold text-[#010a4f]">{site.jobs}</div>
                    <div className="text-[10px] text-gray-400">jobs this month</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold" style={{ color: site.sla === 100 ? '#10b981' : '#f59e0b' }}>
                      {site.sla}%
                    </div>
                    <div className="text-[10px] text-gray-400">SLA rate</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-medium text-gray-500">{site.nextClean}</div>
                    <div className="text-[10px] text-gray-400">next clean</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Report an issue',     icon: '⚠️',  action: () => onNavigate('issue')   },
          { label: 'Request extra work',  icon: '📋',  action: () => showToast('submit additional work request for Riverside Academy Trust') },
          { label: 'Download pack',       icon: '📄',  action: () => showToast('download portfolio compliance pack') },
        ].map(({ label, icon, action }) => (
          <button key={label} onClick={action}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center hover:border-[#4f78ff]/30 hover:shadow-md transition-all">
            <div className="text-2xl mb-2">{icon}</div>
            <div className="text-xs font-bold text-[#010a4f]">{label}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
