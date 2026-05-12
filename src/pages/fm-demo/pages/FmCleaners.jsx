import { useState } from 'react';
import cleaners from '../mock/cleaners.json';
import { Search } from 'lucide-react';
import { getScoreTier, getServiceColour } from '../utils/colours';

const FILTERS = [
  { value: 'all',       label: 'All cleaners' },
  { value: 'available', label: 'Available'     },
  { value: 'busy',      label: 'On a job'      },
  { value: 'invite',    label: 'Invite to network' },
];

const AVAIL_STYLE = {
  available: { dot: '#34d399', label: 'Available',         bg: 'rgba(16,185,129,0.1)',  border: 'rgba(16,185,129,0.25)',  text: '#34d399' },
  busy:      { dot: '#fbbf24', label: 'On a job',          bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.25)',  text: '#fbbf24' },
  invite:    { dot: '#9ca3af', label: 'Not in network',    bg: 'rgba(156,163,175,0.1)', border: 'rgba(156,163,175,0.25)', text: '#9ca3af' },
};

const NOTES = {
  c1:  'Preferred for all school contracts. Always on time.',
  c3:  'Excellent communicator. Client has requested by name twice.',
  c6:  'Reliable for hospital sites — aware of infection control protocol.',
  c15: 'New to network — strong references, pending first job.',
};

export default function FmCleaners({ showToast }) {
  const [filter,   setFilter]   = useState('all');
  const [search,   setSearch]   = useState('');
  const [selected, setSelected] = useState(null);

  const filtered = cleaners
    .filter(c => filter === 'all' || c.availability === filter)
    .filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.town.toLowerCase().includes(search.toLowerCase()));

  const sel = cleaners.find(c => c.id === selected);
  const glass = { background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.1)' };

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Left: list ── */}
      <div className="flex flex-col overflow-hidden" style={{ width: selected ? '55%' : '100%', borderRight: '1px solid rgba(255,255,255,0.07)', transition: 'width 0.2s' }}>

        {/* Search + filter bar */}
        <div className="px-6 py-4 space-y-3 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="relative">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              type="text"
              placeholder="Search by name or town…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm text-white placeholder-white/30 focus:outline-none"
              style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}
            />
          </div>
          <div className="flex items-center gap-2">
            {FILTERS.map(({ value, label }) => (
              <button key={value} onClick={() => setFilter(value)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                style={filter === value
                  ? { background: 'rgba(79,120,255,0.2)', border: '1px solid rgba(79,120,255,0.4)', color: 'white' }
                  : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.45)' }
                }>
                {label}
              </button>
            ))}
            <span className="ml-auto text-white/30 text-xs">{filtered.length} cleaners</span>
          </div>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid gap-3" style={{ gridTemplateColumns: selected ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)' }}>
            {filtered.map(c => {
              const av  = AVAIL_STYLE[c.availability] || AVAIL_STYLE.invite;
              const isActive = selected === c.id;
              return (
                <button key={c.id} onClick={() => setSelected(c.id === selected ? null : c.id)}
                  className="p-4 rounded-2xl text-left transition-all"
                  style={{
                    background: isActive ? 'rgba(79,120,255,0.12)' : 'rgba(255,255,255,0.05)',
                    border: isActive ? '1px solid rgba(79,120,255,0.4)' : '1px solid rgba(255,255,255,0.09)',
                    backdropFilter: 'blur(12px)',
                  }}
                  onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = 'rgba(255,255,255,0.09)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)'; } }}
                  onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)'; } }}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-[#4f78ff]/20 border border-[#4f78ff]/25 text-white flex items-center justify-center text-sm font-black shrink-0">
                      {c.avatar}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-white font-bold text-sm truncate">{c.name}</div>
                      <div className="text-white/40 text-xs truncate">{c.town}</div>
                    </div>
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: av.dot }} />
                  </div>
                  <div className="flex items-end justify-between mb-3">
                    <div>
                      <div className="text-2xl font-black" style={{ color: getScoreTier(c.score).color }}>{c.score}</div>
                      <div className="text-[10px] font-bold" style={{ color: getScoreTier(c.score).color }}>{getScoreTier(c.score).label}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-white font-bold text-sm">{c.completions}</div>
                      <div className="text-white/30 text-[10px]">completions</div>
                    </div>
                    <div className="text-right">
                      <div className="text-white font-bold text-sm">{c.slaRate}%</div>
                      <div className="text-white/30 text-[10px]">SLA rate</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {c.services.slice(0, 2).map(s => {
                      const sc = getServiceColour(s);
                      return (
                        <span key={s} className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                          style={{ background: sc.bg, border: `1px solid ${sc.border}`, color: sc.text }}>
                          {s}
                        </span>
                      );
                    })}
                    {c.services.length > 2 && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full text-white/35"
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                        +{c.services.length - 2}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Right: detail panel ── */}
      {sel && (
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Header */}
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#4f78ff]/20 border border-[#4f78ff]/25 text-white flex items-center justify-center text-xl font-black shrink-0">
              {sel.avatar}
            </div>
            <div className="flex-1">
              <div className="text-white font-black text-lg">{sel.name}</div>
              <div className="text-white/50 text-sm">{sel.town} · {sel.postcode}</div>
              {(() => {
                const av = AVAIL_STYLE[sel.availability] || AVAIL_STYLE.invite;
                return (
                  <span className="inline-flex items-center gap-1.5 mt-1.5 text-xs font-bold px-2.5 py-1 rounded-full"
                    style={{ background: av.bg, border: `1px solid ${av.border}`, color: av.text }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: av.dot }} />
                    {av.label}
                  </span>
                );
              })()}
            </div>
          </div>

          {/* Score card */}
          <div className="rounded-2xl p-5" style={glass}>
            <div className="flex items-center gap-5">
              <div className="text-center">
                <div className="text-4xl font-black" style={{ color: getScoreTier(sel.score).color }}>{sel.score}</div>
                <div className="text-white/40 text-xs mt-1">Cadi score</div>
                <div className="text-[10px] font-black mt-1 px-2.5 py-0.5 rounded-full"
                  style={{ background: getScoreTier(sel.score).bg, border: `1px solid ${getScoreTier(sel.score).border}`, color: getScoreTier(sel.score).color }}>
                  {getScoreTier(sel.score).label}
                </div>
              </div>
              <div className="flex-1 grid grid-cols-2 gap-3">
                {[
                  { label: 'Completions',  value: sel.completions },
                  { label: 'SLA rate',     value: `${sel.slaRate}%` },
                  { label: 'Reviews',      value: sel.reviews },
                  { label: 'Avg rating',   value: `${sel.avgRating}★` },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-xl px-3 py-2.5" style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <div className="text-white/30 text-[10px] uppercase tracking-wider font-bold mb-0.5">{label}</div>
                    <div className="text-white font-bold text-sm">{value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Services */}
          <div className="rounded-2xl p-5" style={glass}>
            <div className="text-white/35 text-[10px] font-black uppercase tracking-widest mb-3">Services</div>
            <div className="flex flex-wrap gap-2">
              {sel.services.map(s => {
                const sc = getServiceColour(s);
                return (
                  <span key={s} className="text-xs font-bold px-3 py-1.5 rounded-full"
                    style={{ background: sc.bg, border: `1px solid ${sc.border}`, color: sc.text }}>
                    {s}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Internal notes */}
          <div className="rounded-2xl p-5" style={glass}>
            <div className="text-white/35 text-[10px] font-black uppercase tracking-widest mb-3">Internal notes (private)</div>
            <textarea
              defaultValue={NOTES[sel.id] || ''}
              placeholder="Add a private note about this cleaner…"
              rows={3}
              className="w-full text-sm text-white/80 placeholder-white/25 bg-transparent resize-none focus:outline-none leading-relaxed"
            />
            <button onClick={() => showToast(`save note for ${sel.name}`)}
              className="text-xs text-white/40 hover:text-white/70 transition-colors mt-1">
              Save note →
            </button>
          </div>

          {/* Actions */}
          <div className="space-y-2">
            {sel.availability === 'invite' ? (
              <button onClick={() => showToast(`send network invitation to ${sel.name}`)}
                className="w-full py-3 rounded-xl text-sm font-black text-white transition-colors"
                style={{ background: 'rgba(79,120,255,0.25)', border: '1px solid rgba(79,120,255,0.45)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(79,120,255,0.35)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(79,120,255,0.25)'}
              >
                Invite to network
              </button>
            ) : (
              <>
                <button onClick={() => showToast(`assign a job to ${sel.name}`)}
                  className="w-full py-3 rounded-xl text-sm font-black text-white transition-colors"
                  style={{ background: 'rgba(79,120,255,0.25)', border: '1px solid rgba(79,120,255,0.45)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(79,120,255,0.35)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(79,120,255,0.25)'}
                >
                  Assign a job
                </button>
                <button onClick={() => showToast(`message ${sel.name}`)}
                  className="w-full py-3 rounded-xl text-sm font-bold text-white/60 hover:text-white/90 transition-colors"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  Send message
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
