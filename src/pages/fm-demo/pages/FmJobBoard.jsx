import { useState } from 'react';
import jobs     from '../mock/jobs.json';
import cleaners from '../mock/cleaners.json';
import sites    from '../mock/sites.json';
import clients  from '../mock/clients.json';
import { Search } from 'lucide-react';
import { getScoreTier, getServiceColour, getJobStatusColour } from '../utils/colours';

const SUGGESTED_IDS = ['c1', 'c3', 'c6', 'c15', 'c29'];

export default function FmJobBoard({ showToast }) {
  const [search,   setSearch]   = useState('');
  const [filter,   setFilter]   = useState('all');
  const [selected, setSelected] = useState(null);
  const [assigned, setAssigned] = useState({});

  const openJobs = jobs.filter(j => ['open','assigned','sla-risk'].includes(j.status));

  const filtered = openJobs.filter(j => {
    const site   = sites.find(s => s.id === j.siteId)?.name || '';
    const client = clients.find(c => c.id === j.clientId)?.name || '';
    const matchSearch = !search || [site, client, j.service].some(x => x.toLowerCase().includes(search.toLowerCase()));
    const matchFilter = filter === 'all' || j.status === filter || (filter === 'assigned' && (j.status === 'assigned' || assigned[j.id]));
    return matchSearch && matchFilter;
  });

  const selectedJob     = jobs.find(j => j.id === selected);
  const selectedSite    = sites.find(s => s.id === selectedJob?.siteId);
  const selectedClient  = clients.find(c => c.id === selectedJob?.clientId);
  const suggested       = cleaners.filter(c => SUGGESTED_IDS.includes(c.id));

  function handleAssign(cleanerId) {
    const c = cleaners.find(c => c.id === cleanerId);
    setAssigned(prev => ({ ...prev, [selected]: cleanerId }));
    showToast(`assign ${c?.name} to job at ${selectedSite?.name}`);
  }

  const glass = {
    background: 'rgba(255,255,255,0.06)',
    backdropFilter: 'blur(16px)',
    border: '1px solid rgba(255,255,255,0.1)',
  };

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Left: job list ── */}
      <div className="flex flex-col w-[55%] border-r overflow-hidden" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>

        {/* Filters */}
        <div className="px-6 py-4 space-y-3 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="relative">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              type="text"
              placeholder="Search by site, client or service…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm text-white placeholder-white/30 focus:outline-none transition-colors"
              style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}
            />
          </div>
          <div className="flex items-center gap-2">
            {[['all','All jobs'],['open','Unassigned'],['assigned','Assigned'],['sla-risk','SLA Risk']].map(([v,l]) => (
              <button key={v} onClick={() => setFilter(v)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                style={filter === v
                  ? { background: 'rgba(79,120,255,0.2)', border: '1px solid rgba(79,120,255,0.4)', color: 'white' }
                  : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.45)' }
                }>
                {l}
              </button>
            ))}
            <span className="ml-auto text-white/30 text-xs">{filtered.length} jobs</span>
          </div>
        </div>

        {/* Column headers */}
        <div className="grid px-6 py-2" style={{ gridTemplateColumns: '1fr 110px 80px 100px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          {['Site / Client', 'Window', 'Value', 'Status'].map(h => (
            <div key={h} className="text-[9px] font-black uppercase tracking-widest text-white/25">{h}</div>
          ))}
        </div>

        {/* Job rows */}
        <div className="flex-1 overflow-y-auto">
          {filtered.map(job => {
            const site    = sites.find(s => s.id === job.siteId);
            const client  = clients.find(c => c.id === job.clientId);
            const st      = getJobStatusColour(job.status);
            const sc      = getServiceColour(job.service);
            const isActive = selected === job.id;
            return (
              <button
                key={job.id}
                onClick={() => setSelected(job.id)}
                className="w-full grid px-6 py-3.5 text-left transition-all"
                style={{
                  gridTemplateColumns: '1fr 110px 80px 100px',
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                  background: isActive ? 'rgba(79,120,255,0.1)' : undefined,
                  borderLeft: isActive ? '2px solid #4f78ff' : '2px solid transparent',
                }}
              >
                <div className="min-w-0 pr-3">
                  <div className="text-white font-medium text-sm truncate">{site?.name}</div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
                      style={{ background: sc.bg, border: `1px solid ${sc.border}`, color: sc.text }}>
                      {job.service}
                    </span>
                    <span className="text-white/35 text-xs truncate">{client?.name}</span>
                  </div>
                </div>
                <div className="text-white/60 text-xs self-center">{job.timeWindow}</div>
                <div className="text-white font-bold text-sm self-center">£{job.value}</div>
                <div className="self-center">
                  <span className="text-[10px] font-bold px-2 py-1 rounded-full"
                    style={{ background: st.bg, border: `1px solid ${st.border}`, color: st.color }}>
                    {st.label}
                  </span>
                </div>
              </button>
            );
          })}
          {filtered.length === 0 && (
            <div className="px-6 py-12 text-center text-white/30 text-sm">No jobs match your filter</div>
          )}
        </div>
      </div>

      {/* ── Right: detail + assign panel ── */}
      <div className="flex-1 overflow-y-auto">
        {!selected ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-center px-8">
            <div className="text-4xl opacity-30">📋</div>
            <div className="text-white/40 text-sm font-medium">Select a job to view details and assign a cleaner</div>
          </div>
        ) : (
          <div className="p-6 space-y-5">
            {/* Job details */}
            <div className="rounded-2xl p-5 space-y-4" style={glass}>
              <div>
                <div className="text-white font-black text-base">{selectedSite?.name}</div>
                <div className="text-white/50 text-sm mt-0.5">{selectedClient?.name}</div>
              </div>
              {selectedJob?.service && (() => {
                const sc = getServiceColour(selectedJob.service);
                return (
                  <span className="inline-flex text-xs font-bold px-3 py-1.5 rounded-full"
                    style={{ background: sc.bg, border: `1px solid ${sc.border}`, color: sc.text }}>
                    {selectedJob.service}
                  </span>
                );
              })()}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Time window', value: selectedJob?.timeWindow },
                  { label: 'Date',        value: selectedJob?.date       },
                  { label: 'Value',       value: `£${selectedJob?.value}` },
                  { label: 'SLA window',  value: selectedSite?.slaWindow || '06:00–08:00' },
                  { label: 'Photos req.', value: selectedSite?.photosRequired ? 'Yes' : 'No' },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-xl px-3.5 py-2.5" style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <div className="text-white/35 text-[10px] uppercase tracking-wider font-bold mb-0.5">{label}</div>
                    <div className="text-white text-sm font-medium">{value || '—'}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Assignment status */}
            {(assigned[selected] || selectedJob?.cleanerId) && (
              <div className="rounded-2xl p-4 flex items-center gap-3"
                style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)' }}>
                <div className="w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-xs">✓</div>
                <div>
                  <div className="text-emerald-300 font-bold text-sm">
                    Assigned to {cleaners.find(c => c.id === (assigned[selected] || selectedJob?.cleanerId))?.name}
                  </div>
                  <div className="text-emerald-400/60 text-xs">Cleaner has been notified</div>
                </div>
              </div>
            )}

            {/* Auto-match section */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="text-white/50 text-[10px] font-black uppercase tracking-widest">Auto-matched cleaners</div>
                <span className="text-white/30 text-[10px]">Ranked by score + proximity</span>
              </div>
              <div className="space-y-2">
                {suggested.map((c, i) => (
                  <button key={c.id} onClick={() => handleAssign(c.id)}
                    className="w-full flex items-center gap-4 p-4 rounded-2xl text-left transition-all group"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(79,120,255,0.1)'; e.currentTarget.style.borderColor = 'rgba(79,120,255,0.3)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
                  >
                    {i === 0 && (
                      <div className="absolute -top-0 right-3 text-[9px] font-black text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-full relative">
                        Best match
                      </div>
                    )}
                    <div className="w-9 h-9 rounded-xl bg-[#4f78ff]/20 border border-[#4f78ff]/30 text-white flex items-center justify-center text-sm font-black shrink-0">
                      {c.avatar}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-white font-bold text-sm">{c.name}</div>
                      <div className="text-white/40 text-xs">{c.town} · {c.services.slice(0, 2).join(', ')}</div>
                    </div>
                    <div className="text-right shrink-0 space-y-0.5">
                      <div className="text-base font-black" style={{ color: getScoreTier(c.score).color }}>{c.score}</div>
                      <div className="text-white/30 text-[10px]">{c.slaRate}% SLA</div>
                    </div>
                    <div className="w-24 text-xs font-bold text-[#4f78ff] opacity-0 group-hover:opacity-100 transition-opacity text-right">
                      Assign →
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Marketplace fallback */}
            <button onClick={() => showToast('post job to Cadi marketplace')}
              className="w-full py-3 rounded-xl text-sm font-bold text-white/60 hover:text-white transition-colors"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>
              Can't cover internally? Post to Cadi marketplace →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
