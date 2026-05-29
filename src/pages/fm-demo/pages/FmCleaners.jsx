import { useState } from 'react';
import cleaners from '../mock/cleaners.json';
import { Search, X, Mail, Link2, Check, ChevronRight, Smartphone, Users, Briefcase, Shield } from 'lucide-react';
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

function InviteModal({ cleaner, onClose }) {
  const [mode, setMode]       = useState('employed');
  const [sent, setSent]       = useState(false);
  const [copied, setCopied]   = useState(false);
  const inviteLink = `app.cadi.cleaning/join/britannia/${cleaner.id}`;

  function handleCopy() {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleSend() {
    setSent(true);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: 'rgba(2,12,62,0.85)', backdropFilter: 'blur(12px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl"
        style={{ background: 'rgba(8,21,64,0.98)', border: '1px solid rgba(79,120,255,0.25)' }}>

        {/* Header */}
        <div className="px-6 py-5 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div>
            <div className="text-white font-black text-base">Invite to Cadi network</div>
            <div className="text-white/40 text-xs mt-0.5">{cleaner.name} · {cleaner.town}</div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center text-white/30 hover:text-white hover:bg-white/10 transition-colors">
            <X size={15} />
          </button>
        </div>

        {!sent ? (
          <div className="p-6 space-y-5">
            {/* Mode toggle */}
            <div>
              <div className="text-white/35 text-[10px] font-black uppercase tracking-widest mb-2">Cleaner type</div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'employed', icon: Briefcase, label: 'Employed staff', sub: 'FM-sponsored · free seat' },
                  { id: 'sub',      icon: Users,     label: 'Contractor',      sub: 'Free Connect tier' },
                ].map(({ id, icon: Icon, label, sub }) => (
                  <button key={id} onClick={() => setMode(id)}
                    className="p-3.5 rounded-2xl text-left transition-all"
                    style={mode === id
                      ? { background: 'rgba(79,120,255,0.18)', border: '1px solid rgba(79,120,255,0.45)' }
                      : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <Icon size={14} style={{ color: mode === id ? '#4f78ff' : 'rgba(255,255,255,0.4)' }} className="mb-2" />
                    <div className="text-white font-bold text-xs">{label}</div>
                    <div className="text-white/40 text-[10px] mt-0.5">{sub}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* What they get */}
            <div className="rounded-2xl p-4 space-y-2.5" style={{ background: 'rgba(79,120,255,0.07)', border: '1px solid rgba(79,120,255,0.18)' }}>
              <div className="text-white/40 text-[10px] font-black uppercase tracking-widest">What {cleaner.name.split(' ')[0]} gets</div>
              {(mode === 'employed' ? [
                { icon: Smartphone, text: 'Instant access to all Britannia Group jobs' },
                { icon: Shield,     text: 'Geo-verified completions — no paper sheets' },
                { icon: Mail,       text: 'Pay tracked automatically through Cadi' },
              ] : [
                { icon: Smartphone, text: 'Free Cadi Connect account — no monthly cost' },
                { icon: Shield,     text: 'Geo-verified completions build their Cadi Score' },
                { icon: Mail,       text: 'Access to Britannia jobs + wider FM marketplace' },
              ]).map(({ icon: Icon, text }, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(79,120,255,0.2)' }}>
                    <Icon size={12} style={{ color: '#4f78ff' }} />
                  </div>
                  <div className="text-white/75 text-xs">{text}</div>
                </div>
              ))}
            </div>

            {/* Preview of what cleaner sees */}
            <div>
              <div className="text-white/35 text-[10px] font-black uppercase tracking-widest mb-2">Preview — cleaner's join screen</div>
              <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
                <div className="px-4 py-3 flex items-center gap-2" style={{ background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                  <div className="flex gap-1">
                    {['#ff5f57','#febc2e','#28c840'].map(c => <div key={c} className="w-2 h-2 rounded-full" style={{ background: c }} />)}
                  </div>
                  <div className="flex-1 mx-2 rounded text-center text-[9px] text-white/30 py-0.5" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    app.cadi.cleaning/join/britannia/…
                  </div>
                </div>
                <div className="px-5 py-5 text-center" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <div className="w-10 h-10 rounded-xl bg-[#4f78ff] flex items-center justify-center text-white font-black text-base mx-auto mb-3 shadow-lg shadow-[#4f78ff]/30">B</div>
                  <div className="text-white font-black text-sm">Britannia Group invited you</div>
                  <div className="text-white/45 text-xs mt-1">Join Cadi to access your jobs, submit completions, and get paid — free{mode === 'employed' ? ', sponsored by Britannia' : ''}.</div>
                  <div className="mt-4 flex flex-col gap-2">
                    <div className="py-2 rounded-xl text-xs font-black text-white" style={{ background: '#4f78ff' }}>Create free account →</div>
                    <div className="py-2 rounded-xl text-xs font-bold text-white/50" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>I already have an account</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Invite link */}
            <div>
              <div className="text-white/35 text-[10px] font-black uppercase tracking-widest mb-2">Invite link</div>
              <div className="flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
                <Link2 size={12} className="text-white/35 shrink-0" />
                <span className="flex-1 text-white/55 text-xs font-mono truncate">{inviteLink}</span>
                <button onClick={handleCopy}
                  className="text-[10px] font-black px-2.5 py-1 rounded-lg transition-all"
                  style={{ background: copied ? 'rgba(52,211,153,0.15)' : 'rgba(79,120,255,0.2)', color: copied ? '#34d399' : '#4f78ff', border: `1px solid ${copied ? 'rgba(52,211,153,0.3)' : 'rgba(79,120,255,0.3)'}` }}>
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            {/* Send actions */}
            <div className="flex gap-2 pt-1">
              <button onClick={handleSend}
                className="flex-1 py-3 rounded-xl text-sm font-black text-white flex items-center justify-center gap-2 transition-all hover:brightness-110"
                style={{ background: 'rgba(79,120,255,0.3)', border: '1px solid rgba(79,120,255,0.5)' }}>
                <Mail size={14} />
                Send invite by email
              </button>
              <button onClick={onClose}
                className="px-4 py-3 rounded-xl text-sm font-bold text-white/45 hover:text-white/70 transition-colors"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center" style={{ background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.3)' }}>
              <Check size={24} style={{ color: '#34d399' }} />
            </div>
            <div>
              <div className="text-white font-black text-base">Invite sent</div>
              <div className="text-white/45 text-sm mt-1">{cleaner.name} will receive an email with their personal join link. You'll see them appear in your network once they activate their account.</div>
            </div>
            <div className="rounded-2xl p-4 text-left" style={{ background: 'rgba(79,120,255,0.07)', border: '1px solid rgba(79,120,255,0.18)' }}>
              <div className="text-white/35 text-[10px] font-black uppercase tracking-widest mb-2">Next steps</div>
              {['Invitation email delivered', 'Cleaner creates free Cadi account', 'Auto-linked to Britannia job pool', 'Geo-verified completions start building their score'].map((step, i) => (
                <div key={i} className="flex items-center gap-2.5 py-1.5">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black shrink-0" style={{ background: 'rgba(79,120,255,0.2)', color: '#4f78ff' }}>{i + 1}</div>
                  <div className="text-white/65 text-xs">{step}</div>
                  {i < 1 && <Check size={11} style={{ color: '#34d399' }} className="ml-auto shrink-0" />}
                  {i === 1 && <ChevronRight size={11} className="ml-auto text-white/25 shrink-0" />}
                </div>
              ))}
            </div>
            <button onClick={onClose}
              className="w-full py-3 rounded-xl text-sm font-black text-white transition-all hover:brightness-110"
              style={{ background: 'rgba(79,120,255,0.25)', border: '1px solid rgba(79,120,255,0.4)' }}>
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function FmCleaners({ showToast }) {
  const [filter,   setFilter]   = useState('all');
  const [search,   setSearch]   = useState('');
  const [selected, setSelected] = useState(null);
  const [inviting, setInviting] = useState(null);

  const filtered = cleaners
    .filter(c => filter === 'all' || c.availability === filter)
    .filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.town.toLowerCase().includes(search.toLowerCase()));

  const sel = cleaners.find(c => c.id === selected);
  const glass = { background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.1)' };

  return (
    <div className="flex h-full overflow-hidden">
      {inviting && <InviteModal cleaner={inviting} onClose={() => setInviting(null)} />}

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
              <button onClick={() => setInviting(sel)}
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
