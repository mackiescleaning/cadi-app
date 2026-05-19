import { useState } from 'react';

const ROSTER = [
  { id: 'c6',  name: 'Robert Kamara',   avatar: 'RK', town: 'Milton Keynes', site: 'Next – Centre:MK',              type: 'Retail',      hours: 25, score: 96, connectScore: 94, connectStatus: 'elite',    status: 'active', since: 'Jan 2024', openTo: false },
  { id: 'c3',  name: 'Maria Kowalski',  avatar: 'MK', town: 'Hemel Hempstead', site: 'Next – Luton The Mall',       type: 'Retail',      hours: 20, score: 91, connectScore: 88, connectStatus: 'verified',  status: 'active', since: 'Mar 2024', openTo: true  },
  { id: 'c29', name: 'Tara Hobson',     avatar: 'TH', town: 'Hatfield',       site: 'L&D Hospital – Main Tower',    type: 'Healthcare',  hours: 30, score: 91, connectScore: 89, connectStatus: 'verified',  status: 'active', since: 'Feb 2024', openTo: false },
  { id: 'c11', name: 'Priya Singh',     avatar: 'PS', town: 'Luton',          site: 'UoB Luton Campus',             type: 'Education',   hours: 22, score: 93, connectScore: 91, connectStatus: 'verified',  status: 'active', since: 'Nov 2023', openTo: true  },
  { id: 'c24', name: 'Yemi Adesanya',   avatar: 'YA', town: 'Milton Keynes',  site: 'Central Beds Council HQ',      type: 'Public Sec.', hours: 28, score: 95, connectScore: 96, connectStatus: 'elite',    status: 'active', since: 'Aug 2023', openTo: false },
  { id: 'c1',  name: 'Sarah Patel',     avatar: 'SP', town: 'Bedford',        site: 'Waterstones – Luton',          type: 'Retail',      hours: 18, score: 94, connectScore: 87, connectStatus: 'verified',  status: 'active', since: 'Apr 2024', openTo: true  },
  { id: 'c10', name: 'Marcus Webb',     avatar: 'MW', town: 'Oxford',         site: 'Aldi – Dunstable RDC',         type: 'Industrial',  hours: 35, score: 82, connectScore: 0,  connectStatus: 'building',  status: 'active', since: 'Jan 2025', openTo: false },
  { id: 'c15', name: 'Diane Fletcher',  avatar: 'DF', town: 'Letchworth',     site: 'Premier Inn Luton Airport',    type: 'Hospitality', hours: 24, score: 90, connectScore: 0,  connectStatus: 'eligible',  status: 'active', since: 'Jun 2024', openTo: true  },
  { id: 'c25', name: 'Sandra Campbell', avatar: 'SC', town: 'Watford',        site: 'Next – Watford Atria',         type: 'Retail',      hours: 20, score: 85, connectScore: 0,  connectStatus: 'eligible',  status: 'active', since: 'Sep 2024', openTo: false },
  { id: 'c21', name: 'Stefan Kovac',    avatar: 'SK', town: 'Northampton',    site: 'L&D Hospital – A&E',           type: 'Healthcare',  hours: 30, score: 88, connectScore: 0,  connectStatus: 'building',  status: 'active', since: 'Nov 2024', openTo: true  },
  { id: 'c27', name: 'Comfort Owusu',   avatar: 'CO', town: 'Dunstable',      site: 'Luton Central Library',        type: 'Public Sec.', hours: 15, score: 82, connectScore: 0,  connectStatus: 'building',  status: 'leave',  since: 'Feb 2025', openTo: false },
  { id: 'c28', name: 'Bart Czajka',     avatar: 'BC', town: 'Wolverton',      site: 'Next – Centre:MK',             type: 'Retail',      hours: 20, score: 86, connectScore: 0,  connectStatus: 'building',  status: 'active', since: 'Mar 2025', openTo: true  },
];

const OPPORTUNITIES = [
  {
    cleaner: 'Maria Kowalski', avatar: 'MK', currentHours: 20, availableHours: 10,
    currentSite: 'Next – Luton The Mall', opportunity: 'Next – Watford Atria (cover rotation)',
    type: 'Extra shifts', reason: 'Watford has 3 uncovered Friday mornings in June',
    connectStatus: 'verified', score: 91,
  },
  {
    cleaner: 'Priya Singh', avatar: 'PS', currentHours: 22, availableHours: 8,
    currentSite: 'UoB Luton Campus', opportunity: 'Promote to Area Supervisor — East Luton',
    type: 'Promotion', reason: '389 completions, 99% SLA, 0 escalations. Natural supervisor candidate.',
    connectStatus: 'verified', score: 93,
  },
  {
    cleaner: 'Diane Fletcher', avatar: 'DF', currentHours: 24, availableHours: 11,
    currentSite: 'Premier Inn Luton Airport', opportunity: 'Invite to Cadi Connect',
    type: 'Connect upgrade', reason: 'Connect-eligible. Not yet opted in. Would unlock marketplace shifts.',
    connectStatus: 'eligible', score: 90,
  },
  {
    cleaner: 'Bart Czajka', avatar: 'BC', currentHours: 20, availableHours: 15,
    currentSite: 'Next – Centre:MK', opportunity: 'Waterstones – Milton Keynes (new contract)',
    type: 'Extra shifts', reason: 'New contract won 12 May. Needs operative from 2 Jun.',
    connectStatus: 'building', score: 86,
  },
  {
    cleaner: 'Stefan Kovac', avatar: 'SK', currentHours: 30, availableHours: 5,
    currentSite: 'L&D Hospital – A&E', opportunity: 'Mentor new healthcare operative (Fatima Bello)',
    type: 'Mentorship', reason: 'Healthcare specialism. Pairing him with pipeline recruit for trial period.',
    connectStatus: 'building', score: 88,
  },
];

const CONNECT_CONFIG = {
  elite:    { label: 'Connect Elite',    color: '#a78bfa', glow: 'rgba(167,139,250,0.4)' },
  verified: { label: 'Connect Verified', color: '#34d399', glow: 'rgba(52,211,153,0.4)'  },
  eligible: { label: 'Connect Eligible', color: '#fbbf24', glow: 'rgba(251,191,36,0.4)'  },
  building: { label: 'Building score',   color: '#94a3b8', glow: 'transparent'            },
};

const OPP_TYPE_CONFIG = {
  'Extra shifts':    { color: '#4f78ff', bg: 'rgba(79,120,255,0.12)'   },
  'Promotion':       { color: '#a78bfa', bg: 'rgba(167,139,250,0.12)'  },
  'Connect upgrade': { color: '#34d399', bg: 'rgba(52,211,153,0.12)'   },
  'Mentorship':      { color: '#fbbf24', bg: 'rgba(251,191,36,0.12)'   },
};

function ScoreBar({ score, max = 100, color = '#4f78ff' }) {
  const pct = Math.round((score / max) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color, boxShadow: `0 0 6px ${color}60` }} />
      </div>
      <span className="text-[11px] font-black" style={{ color }}>{score}</span>
    </div>
  );
}

function Avatar({ initials, size = 9 }) {
  return (
    <div className={`w-${size} h-${size} rounded-xl flex items-center justify-center text-white text-xs font-black shrink-0`}
      style={{ background: 'linear-gradient(135deg, rgba(79,120,255,0.5), rgba(99,102,241,0.35))', border: '1px solid rgba(79,120,255,0.3)' }}>
      {initials}
    </div>
  );
}

function ConnectBadge({ status }) {
  const cfg = CONNECT_CONFIG[status];
  return (
    <span className="text-[9px] font-black px-2 py-0.5 rounded-full shrink-0"
      style={{ color: cfg.color, background: `${cfg.color}18`, border: `1px solid ${cfg.color}40` }}>
      {cfg.label}
    </span>
  );
}

export default function FmWorkforce({ showToast }) {
  const [tab, setTab] = useState('roster');
  const [expanded, setExpanded] = useState(null);

  const activeCount  = ROSTER.filter(c => c.status === 'active').length;
  const eliteCount   = ROSTER.filter(c => c.connectStatus === 'elite').length;
  const verifiedCount = ROSTER.filter(c => c.connectStatus === 'verified').length;
  const avgScore     = Math.round(ROSTER.reduce((s, c) => s + c.score, 0) / ROSTER.length);

  return (
    <div className="p-6 space-y-5 max-w-5xl">

      {/* Header stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Active operatives', value: activeCount,              sub: `${ROSTER.length} total on books`, color: '#4f78ff' },
          { label: 'Avg Cadi Score',    value: avgScore,               sub: 'across all operatives',           color: '#a78bfa' },
          { label: 'Connect Elite',     value: eliteCount,             sub: `+ ${verifiedCount} Verified`,     color: '#34d399' },
          { label: 'Open to more work', value: ROSTER.filter(c => c.openTo).length, sub: 'available for extra shifts', color: '#fbbf24' },
        ].map(({ label, value, sub, color }) => (
          <div key={label} className="rounded-2xl p-4"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="text-2xl font-black" style={{ color }}>{value}</div>
            <div className="text-white/80 text-xs font-bold mt-0.5">{label}</div>
            <div className="text-white/30 text-[10px] mt-0.5">{sub}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 rounded-xl w-fit"
        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
        {[
          { id: 'roster',        label: 'Roster',        count: ROSTER.length },
          { id: 'opportunities', label: 'Opportunities', count: OPPORTUNITIES.length },
        ].map(({ id, label, count }) => (
          <button key={id} onClick={() => setTab(id)}
            className="px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2"
            style={tab === id ? {
              background: 'linear-gradient(135deg, rgba(79,120,255,0.3), rgba(99,102,241,0.2))',
              border: '1px solid rgba(79,120,255,0.4)', color: 'white',
            } : { color: 'rgba(255,255,255,0.35)', border: '1px solid transparent' }}>
            {label}
            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-black"
              style={{ background: tab === id ? 'rgba(79,120,255,0.3)' : 'rgba(255,255,255,0.08)', color: tab === id ? 'white' : 'rgba(255,255,255,0.3)' }}>
              {count}
            </span>
          </button>
        ))}
      </div>

      {/* ── ROSTER ── */}
      {tab === 'roster' && (
        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
          {/* Column headers */}
          <div className="grid px-4 py-2.5 text-[9px] font-black uppercase tracking-widest"
            style={{ gridTemplateColumns: '2fr 2fr 1fr 1.5fr 1fr 1fr', background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.25)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <span>Operative</span><span>Assigned site</span><span>Hrs/wk</span><span>Cadi Score</span><span>Connect</span><span>Status</span>
          </div>

          {ROSTER.map((c, i) => (
            <div key={c.id}>
              <div
                className="grid px-4 py-3.5 cursor-pointer transition-all"
                style={{
                  gridTemplateColumns: '2fr 2fr 1fr 1.5fr 1fr 1fr',
                  borderBottom: i < ROSTER.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                  background: expanded === c.id ? 'rgba(79,120,255,0.06)' : 'transparent',
                }}
                onMouseEnter={e => { if (expanded !== c.id) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                onMouseLeave={e => { if (expanded !== c.id) e.currentTarget.style.background = 'transparent'; }}
                onClick={() => setExpanded(expanded === c.id ? null : c.id)}
              >
                {/* Name */}
                <div className="flex items-center gap-2.5">
                  <Avatar initials={c.avatar} size={8} />
                  <div>
                    <div className="text-white text-sm font-bold leading-tight">{c.name}</div>
                    <div className="text-white/30 text-[10px]">{c.town} · since {c.since}</div>
                  </div>
                </div>
                {/* Site */}
                <div className="flex items-center">
                  <div>
                    <div className="text-white/80 text-xs">{c.site}</div>
                    <div className="text-white/30 text-[10px]">{c.type}</div>
                  </div>
                </div>
                {/* Hours */}
                <div className="flex items-center">
                  <span className="text-white/60 text-sm font-bold">{c.hours}h</span>
                </div>
                {/* Cadi Score */}
                <div className="flex items-center pr-4">
                  <div className="w-full">
                    <ScoreBar score={c.score} color={c.score >= 90 ? '#34d399' : c.score >= 80 ? '#4f78ff' : '#fbbf24'} />
                  </div>
                </div>
                {/* Connect */}
                <div className="flex items-center">
                  <ConnectBadge status={c.connectStatus} />
                </div>
                {/* Status */}
                <div className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${c.status === 'active' ? 'bg-emerald-400' : 'bg-amber-400'}`}
                    style={{ boxShadow: c.status === 'active' ? '0 0 4px #34d399' : '0 0 4px #fbbf24' }} />
                  <span className="text-[11px] capitalize" style={{ color: c.status === 'active' ? 'rgba(52,211,153,0.9)' : 'rgba(251,191,36,0.9)' }}>
                    {c.status === 'leave' ? 'On leave' : 'Active'}
                  </span>
                </div>
              </div>

              {/* Expanded row */}
              {expanded === c.id && (
                <div className="px-6 pb-5 pt-2 grid grid-cols-3 gap-4"
                  style={{ background: 'rgba(79,120,255,0.04)', borderBottom: i < ROSTER.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                  <div className="rounded-xl p-4 space-y-2" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <div className="text-[10px] font-black uppercase tracking-widest text-white/25 mb-3">Performance</div>
                    {[
                      { label: 'Cadi Score', value: `${c.score}/100`, color: '#4f78ff' },
                      { label: 'SLA hit rate', value: '—', color: '#34d399' },
                      { label: 'Open to more work', value: c.openTo ? 'Yes' : 'No', color: c.openTo ? '#34d399' : '#94a3b8' },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="flex justify-between text-xs">
                        <span className="text-white/40">{label}</span>
                        <span className="font-bold" style={{ color }}>{value}</span>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-xl p-4 space-y-2" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <div className="text-[10px] font-black uppercase tracking-widest text-white/25 mb-3">Connect Status</div>
                    <ConnectBadge status={c.connectStatus} />
                    {c.connectScore > 0 && (
                      <div className="mt-2">
                        <div className="text-white/40 text-[10px] mb-1">Connect Score</div>
                        <ScoreBar score={c.connectScore} color={CONNECT_CONFIG[c.connectStatus].color} />
                      </div>
                    )}
                    {c.connectStatus === 'eligible' && (
                      <div className="text-[10px] text-amber-400/80 mt-1">Not yet opted in — can be invited</div>
                    )}
                    {c.connectStatus === 'building' && (
                      <div className="text-[10px] text-white/30 mt-1">Needs more completed jobs to qualify</div>
                    )}
                  </div>
                  <div className="rounded-xl p-4 space-y-2" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <div className="text-[10px] font-black uppercase tracking-widest text-white/25 mb-3">Actions</div>
                    <div className="space-y-1.5">
                      {[
                        { label: 'Message operative', action: `message ${c.name}` },
                        { label: 'Reassign site',      action: `reassign ${c.name} to a new site` },
                        c.connectStatus === 'eligible' && { label: 'Invite to Connect', action: `send Connect invite to ${c.name}` },
                        c.openTo && { label: 'Offer extra shift', action: `offer an extra shift to ${c.name}` },
                      ].filter(Boolean).map(({ label, action }) => (
                        <button key={label} onClick={() => showToast(action)}
                          className="w-full text-left px-3 py-2 rounded-lg text-[11px] font-bold transition-all text-white/60 hover:text-white"
                          style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── OPPORTUNITIES ── */}
      {tab === 'opportunities' && (
        <div className="space-y-4">
          {/* Callout */}
          <div className="rounded-2xl p-5 flex items-start gap-4"
            style={{ background: 'rgba(52,211,153,0.07)', border: '1px solid rgba(52,211,153,0.2)' }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0"
              style={{ background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.3)' }}>🌱</div>
            <div>
              <div className="text-white font-black text-sm">Grow from within</div>
              <div className="text-white/50 text-xs mt-0.5">
                Cadi identifies operatives who are available for more hours, ready for promotion, eligible for Connect, or ideal for mentoring new hires — before you go to external recruitment.
              </div>
            </div>
          </div>

          {OPPORTUNITIES.map((o, i) => {
            const typeConfig = OPP_TYPE_CONFIG[o.type] || { color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' };
            return (
              <div key={i} className="rounded-2xl p-5"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="flex items-start gap-4">
                  <Avatar initials={o.avatar} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-white font-black text-sm">{o.cleaner}</span>
                      <span className="text-[9px] font-black px-2 py-0.5 rounded-full"
                        style={{ color: typeConfig.color, background: typeConfig.bg, border: `1px solid ${typeConfig.color}40` }}>
                        {o.type}
                      </span>
                      <ConnectBadge status={o.connectStatus} />
                    </div>
                    <div className="mt-1.5 text-xs text-white/40">
                      Currently: <span className="text-white/60">{o.currentSite}</span>
                      <span className="mx-2 text-white/20">·</span>
                      {o.currentHours}h/wk contracted
                      <span className="mx-2 text-white/20">·</span>
                      <span className="text-emerald-400/80">{o.availableHours}h available</span>
                    </div>
                    <div className="mt-3 p-3 rounded-xl"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                      <div className="text-xs font-bold text-white/70 mb-1">{o.opportunity}</div>
                      <div className="text-[11px] text-white/40">{o.reason}</div>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <div className="w-32">
                        <ScoreBar score={o.score} color={o.score >= 90 ? '#34d399' : '#4f78ff'} />
                      </div>
                      <span className="text-white/25 text-[10px]">Cadi Score</span>
                      <div className="ml-auto flex gap-2">
                        {o.type === 'Connect upgrade' && (
                          <button onClick={() => showToast(`send Connect invite to ${o.cleaner}`)}
                            className="px-3 py-1.5 rounded-lg text-[11px] font-black transition-all"
                            style={{ background: 'linear-gradient(135deg, rgba(52,211,153,0.2), rgba(52,211,153,0.12))', border: '1px solid rgba(52,211,153,0.35)', color: '#34d399' }}>
                            Send Connect invite
                          </button>
                        )}
                        {o.type === 'Promotion' && (
                          <button onClick={() => showToast(`start promotion review for ${o.cleaner}`)}
                            className="px-3 py-1.5 rounded-lg text-[11px] font-black transition-all"
                            style={{ background: 'linear-gradient(135deg, rgba(167,139,250,0.2), rgba(167,139,250,0.12))', border: '1px solid rgba(167,139,250,0.35)', color: '#a78bfa' }}>
                            Start review
                          </button>
                        )}
                        {(o.type === 'Extra shifts' || o.type === 'Mentorship') && (
                          <button onClick={() => showToast(`offer opportunity to ${o.cleaner}`)}
                            className="px-3 py-1.5 rounded-lg text-[11px] font-black transition-all"
                            style={{ background: 'linear-gradient(135deg, rgba(79,120,255,0.2), rgba(79,120,255,0.12))', border: '1px solid rgba(79,120,255,0.35)', color: '#4f78ff' }}>
                            Offer to operative
                          </button>
                        )}
                        <button onClick={() => showToast(`dismiss opportunity for ${o.cleaner}`)}
                          className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-white/30 hover:text-white/60 transition-all"
                          style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
                          Dismiss
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
