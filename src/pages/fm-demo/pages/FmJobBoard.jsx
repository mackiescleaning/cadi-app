import { useState } from 'react';
import jobs     from '../mock/jobs.json';
import cleaners from '../mock/cleaners.json';
import sites    from '../mock/sites.json';
import clients  from '../mock/clients.json';
import { Search, Zap, MapPin, Star } from 'lucide-react';
import { getScoreTier, getServiceColour, getJobStatusColour } from '../utils/colours';

const SUGGESTED_IDS = ['c1', 'c3', 'c6', 'c15', 'c29'];
const MATCH_SCORES  = { c1: 97, c3: 94, c6: 91, c15: 88, c29: 84 };
const DISTANCES     = { c1: '1.2 mi', c3: '2.4 mi', c6: '3.1 mi', c15: '4.8 mi', c29: '6.2 mi' };

function MatchRing({ score }) {
  const r = 16, circ = 2 * Math.PI * r;
  const fill = (score / 100) * circ;
  const color = score >= 95 ? '#34d399' : score >= 88 ? '#4f78ff' : '#fbbf24';
  return (
    <div className="relative w-12 h-12 shrink-0">
      <svg width="48" height="48" viewBox="0 0 48 48" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="24" cy="24" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
        <circle cx="24" cy="24" r={r} fill="none" stroke={color} strokeWidth="3"
          strokeDasharray={`${fill} ${circ}`} strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 4px ${color}88)` }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[11px] font-black" style={{ color }}>{score}</span>
      </div>
    </div>
  );
}

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

  const selectedJob    = jobs.find(j => j.id === selected);
  const selectedSite   = sites.find(s => s.id === selectedJob?.siteId);
  const selectedClient = clients.find(c => c.id === selectedJob?.clientId);
  const suggested      = cleaners.filter(c => SUGGESTED_IDS.includes(c.id));

  function handleAssign(cleanerId) {
    const c = cleaners.find(c => c.id === cleanerId);
    setAssigned(prev => ({ ...prev, [selected]: cleanerId }));
    showToast(`assign ${c?.name} to job at ${selectedSite?.name}`);
  }

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Left: job list ── */}
      <div className="flex flex-col w-[52%] overflow-hidden" style={{ borderRight: '1px solid rgba(255,255,255,0.07)' }}>

        {/* Filters */}
        <div className="px-6 py-4 space-y-3 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="relative">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              type="text" placeholder="Search by site, client or service…"
              value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm text-white placeholder-white/30 focus:outline-none transition-all"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
              onFocus={e => { e.target.style.background = 'rgba(255,255,255,0.09)'; e.target.style.borderColor = 'rgba(79,120,255,0.4)'; }}
              onBlur={e => { e.target.style.background = 'rgba(255,255,255,0.06)'; e.target.style.borderColor = 'rgba(255,255,255,0.1)'; }}
            />
          </div>
          <div className="flex items-center gap-2">
            {[['all','All jobs'],['open','Unassigned'],['assigned','Assigned'],['sla-risk','SLA Risk']].map(([v,l]) => (
              <button key={v} onClick={() => setFilter(v)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                style={filter === v
                  ? { background: 'rgba(79,120,255,0.2)', border: '1px solid rgba(79,120,255,0.45)', color: 'white', boxShadow: '0 0 12px rgba(79,120,255,0.15)' }
                  : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.4)' }
                }>
                {l}
              </button>
            ))}
            <span className="ml-auto text-white/25 text-xs font-bold">{filtered.length} jobs</span>
          </div>
        </div>

        {/* Column headers */}
        <div className="grid px-6 py-2.5" style={{ gridTemplateColumns: '1fr 110px 80px 105px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          {['Site / Client', 'Window', 'Value', 'Status'].map(h => (
            <div key={h} className="text-[9px] font-black uppercase tracking-widest text-white/20">{h}</div>
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
              <button key={job.id} onClick={() => setSelected(job.id)}
                className="w-full grid px-6 py-3.5 text-left transition-all relative"
                style={{
                  gridTemplateColumns: '1fr 110px 80px 105px',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  background: isActive ? 'rgba(79,120,255,0.08)' : undefined,
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = ''; }}
              >
                {/* Active left beam */}
                {isActive && (
                  <div style={{
                    position: 'absolute', left: 0, top: '15%', bottom: '15%', width: 2, borderRadius: 2,
                    background: 'linear-gradient(180deg, transparent, #4f78ff, transparent)',
                    boxShadow: '0 0 6px rgba(79,120,255,0.6)',
                  }} />
                )}
                <div className="min-w-0 pr-3">
                  <div className="text-white font-medium text-sm truncate" style={{ opacity: isActive ? 1 : 0.8 }}>{site?.name}</div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
                      style={{ background: sc.bg, border: `1px solid ${sc.border}`, color: sc.text }}>
                      {job.service}
                    </span>
                    <span className="text-white/30 text-xs truncate">{client?.name}</span>
                  </div>
                </div>
                <div className="text-white/50 text-xs self-center font-medium">{job.timeWindow}</div>
                <div className="text-white font-bold text-sm self-center">
                  <span className="text-white/30 text-xs">£</span>{job.value}
                </div>
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
            <div className="px-6 py-12 text-center text-white/25 text-sm">No jobs match your filter</div>
          )}
        </div>
      </div>

      {/* ── Right: detail + assign panel ── */}
      <div className="flex-1 overflow-y-auto">
        {!selected ? (
          <div className="h-full flex flex-col items-center justify-center gap-4 text-center px-8">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(79,120,255,0.08)', border: '1px solid rgba(79,120,255,0.15)' }}>
              <Zap size={22} style={{ color: 'rgba(79,120,255,0.4)' }} />
            </div>
            <div>
              <div className="text-white/35 text-sm font-bold">Select a job</div>
              <div className="text-white/20 text-xs mt-1">Cadi auto-matches the best available cleaners</div>
            </div>
          </div>
        ) : (
          <div className="p-6 space-y-5">

            {/* Job card */}
            <div className="rounded-2xl p-5 space-y-4" style={{
              background: 'rgba(255,255,255,0.04)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.09)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
            }}>
              <div>
                <div className="text-white font-black text-base">{selectedSite?.name}</div>
                <div className="text-white/45 text-sm mt-0.5">{selectedClient?.name}</div>
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
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Time window', value: selectedJob?.timeWindow },
                  { label: 'Date',        value: selectedJob?.date       },
                  { label: 'Value',       value: `£${selectedJob?.value}` },
                  { label: 'SLA window',  value: selectedSite?.slaWindow || '06:00–08:00' },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-xl px-3.5 py-2.5" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <div className="text-white/30 text-[10px] uppercase tracking-wider font-bold mb-0.5">{label}</div>
                    <div className="text-white text-sm font-bold">{value || '—'}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Assignment confirmed */}
            {(assigned[selected] || selectedJob?.cleanerId) && (
              <div className="rounded-2xl p-4 flex items-center gap-3"
                style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.25)', boxShadow: '0 0 20px rgba(52,211,153,0.05)' }}>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.3)' }}>
                  <span style={{ color: '#34d399', fontSize: 14 }}>✓</span>
                </div>
                <div>
                  <div className="text-emerald-300 font-bold text-sm">
                    Assigned to {cleaners.find(c => c.id === (assigned[selected] || selectedJob?.cleanerId))?.name}
                  </div>
                  <div className="text-emerald-400/50 text-xs mt-0.5">Cleaner notified · job confirmed</div>
                </div>
              </div>
            )}

            {/* Auto-match section */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Zap size={13} style={{ color: '#4f78ff' }} />
                  <span className="text-white/50 text-[10px] font-black uppercase tracking-widest">Cadi auto-match</span>
                </div>
                <span className="text-white/25 text-[10px]">Score · proximity · availability</span>
              </div>
              <div className="space-y-2">
                {suggested.map((c, i) => {
                  const tier  = getScoreTier(c.score);
                  const match = MATCH_SCORES[c.id] || 80;
                  const dist  = DISTANCES[c.id] || '–';
                  const isBest = i === 0;
                  return (
                    <button key={c.id} onClick={() => handleAssign(c.id)}
                      className="w-full flex items-center gap-4 p-4 rounded-2xl text-left transition-all group relative"
                      style={{
                        background: isBest ? 'rgba(79,120,255,0.08)' : 'rgba(255,255,255,0.04)',
                        border: isBest ? '1px solid rgba(79,120,255,0.3)' : '1px solid rgba(255,255,255,0.08)',
                        boxShadow: isBest ? 'inset 0 1px 0 rgba(255,255,255,0.07)' : 'none',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(79,120,255,0.12)'; e.currentTarget.style.borderColor = 'rgba(79,120,255,0.4)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = isBest ? 'rgba(79,120,255,0.08)' : 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = isBest ? 'rgba(79,120,255,0.3)' : 'rgba(255,255,255,0.08)'; }}
                    >
                      {isBest && (
                        <div className="absolute top-2.5 right-3 text-[8px] font-black px-2 py-0.5 rounded-full"
                          style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.25)', color: '#fbbf24' }}>
                          Best match
                        </div>
                      )}
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black shrink-0"
                        style={{ background: 'rgba(79,120,255,0.2)', border: '1px solid rgba(79,120,255,0.3)', color: 'white' }}>
                        {c.avatar}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-white font-bold text-sm">{c.name}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <div className="flex items-center gap-1">
                            <MapPin size={9} style={{ color: 'rgba(255,255,255,0.35)' }} />
                            <span className="text-white/35 text-xs">{dist}</span>
                          </div>
                          <span className="text-white/20 text-xs">·</span>
                          <span className="text-xs font-bold" style={{ color: tier.color }}>{tier.label}</span>
                        </div>
                      </div>
                      <MatchRing score={match} />
                      <div className="text-[11px] font-black text-[#4f78ff] opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        Assign →
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Marketplace fallback */}
            <button onClick={() => showToast('post job to Cadi marketplace')}
              className="w-full py-3 rounded-xl text-xs font-bold transition-all"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.35)' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = 'rgba(255,255,255,0.6)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.color = 'rgba(255,255,255,0.35)'; }}>
              Can't cover internally? Post to Cadi marketplace →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
