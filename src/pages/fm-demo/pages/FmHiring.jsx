import { useState } from 'react';

const PIPELINE = [
  {
    id: 'p1', name: 'Leah Okonkwo', avatar: 'LO', town: 'Luton', postcode: 'LU2 8AA',
    services: ['Retail Clean', 'Office Clean'], connectScore: 81, completions: 94, slaRate: 97,
    matchedTo: 'Luton Central Library', stage: 'trial', appliedDays: 6,
    notes: 'Strong retail background. Trial clean scheduled Wed 20 May 07:00.',
  },
  {
    id: 'p2', name: 'Dev Sharma', avatar: 'DS', town: 'Dunstable', postcode: 'LU6 1AA',
    services: ['Industrial', 'Warehouse Clean'], connectScore: 78, completions: 67, slaRate: 95,
    matchedTo: 'Aldi – Dunstable RDC (cover)', stage: 'matched', appliedDays: 3,
    notes: 'Matched by Cadi — industrial experience, 4.7★ average, lives 1.2 mi from site.',
  },
  {
    id: 'p3', name: 'Fatima Bello', avatar: 'FB', town: 'Luton', postcode: 'LU3 2AA',
    services: ['Healthcare Clean', 'Deep Clean'], connectScore: 86, completions: 122, slaRate: 98,
    matchedTo: 'L&D Hospital – A&E & Outpatients', stage: 'review', appliedDays: 1,
    notes: 'DBS verified. Healthcare experience confirmed. Awaiting FM sign-off.',
  },
  {
    id: 'p4', name: 'Tom Gillespie', avatar: 'TG', town: 'Harpenden', postcode: 'AL5 2AA',
    services: ['Office Clean', 'Retail Clean'], connectScore: 74, completions: 43, slaRate: 93,
    matchedTo: 'Waterstones – Luton (second operative)', stage: 'invited', appliedDays: 8,
    notes: 'Invite sent, not yet accepted. Score building — 7 jobs from Connect threshold.',
  },
];

const OPEN_ROLES = [
  { site: 'Luton Central Library',        type: 'Public Sector', urgency: 'high',   needed: 'Permanent · Mon–Fri 06:00–08:00', matched: 1 },
  { site: 'Aldi – Dunstable RDC (cover)', type: 'Industrial',   urgency: 'medium', needed: 'Cover · 3 weeks from 26 May',      matched: 1 },
  { site: 'Waterstones – Milton Keynes',  type: 'Retail',       urgency: 'low',    needed: 'Permanent · Mon–Sat 07:00–09:00',  matched: 0 },
];

const STAGE_LABELS = {
  invited: { label: 'Invited',       color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
  matched: { label: 'AI Matched',    color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
  review:  { label: 'Under review',  color: '#fbbf24', bg: 'rgba(251,191,36,0.12)'  },
  trial:   { label: 'Trial booked',  color: '#34d399', bg: 'rgba(52,211,153,0.12)'  },
  hired:   { label: 'Hired',         color: '#4f78ff', bg: 'rgba(79,120,255,0.12)'  },
};

const URGENCY = {
  high:   { color: '#f87171', label: 'Urgent' },
  medium: { color: '#fbbf24', label: 'Soon'   },
  low:    { color: '#94a3b8', label: 'Planned' },
};

const IMPACT = [
  { before: 'Job ads, phone interviews, no quality benchmark', after: 'Sourced via Connect — scored, vetted, ready to deploy', icon: '🎯' },
  { before: "New hire's reliability unknown until they're on site", after: 'Cadi Score visible before you offer a single shift', icon: '⭐' },
  { before: 'Average days to hire: 30+', after: '11 days average — faster pipeline, less downtime', icon: '⏱' },
];

export default function FmHiring({ showToast }) {
  const [tab, setTab] = useState('pipeline');

  return (
    <div className="p-6 space-y-5 max-w-4xl">

      {/* Impact strip */}
      <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(79,120,255,0.18)', background: 'rgba(1,8,40,0.6)' }}>
        <div className="px-5 py-2.5 flex items-center gap-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(79,120,255,0.06)' }}>
          <span className="text-[9px] font-black uppercase tracking-widest text-white/30">What Cadi replaces</span>
          <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
          <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: '#4f78ff' }}>With Cadi</span>
        </div>
        <div className="grid grid-cols-3 divide-x" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          {IMPACT.map(({ before, after, icon }) => (
            <div key={icon} className="px-4 py-3 flex items-start gap-3">
              <span className="text-xl flex-shrink-0 mt-0.5">{icon}</span>
              <div><div className="text-[10px] text-white/30 line-through decoration-white/20 mb-1 leading-snug">{before}</div>
              <div className="text-[10px] font-bold leading-snug" style={{ color: '#60a5fa' }}>{after}</div></div>
            </div>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Open roles',        value: OPEN_ROLES.length,   color: '#fbbf24' },
          { label: 'In pipeline',       value: PIPELINE.length,     color: '#4f78ff' },
          { label: 'Trial this week',   value: 1,                   color: '#34d399' },
          { label: 'Avg days to hire',  value: '11',                color: '#a78bfa' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-2xl p-4"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="text-2xl font-black" style={{ color }}>{value}</div>
            <div className="text-white/70 text-xs font-bold mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 rounded-xl w-fit"
        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
        {[
          { id: 'pipeline',   label: 'Pipeline',    count: PIPELINE.length },
          { id: 'open-roles', label: 'Open roles',  count: OPEN_ROLES.length },
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
        <button onClick={() => showToast('post a new role to Cadi Connect')}
          className="ml-2 px-4 py-2 rounded-lg text-xs font-black transition-all"
          style={{ background: 'linear-gradient(135deg, rgba(79,120,255,0.3), rgba(99,102,241,0.2))', border: '1px solid rgba(79,120,255,0.4)', color: 'white' }}>
          + Post role
        </button>
      </div>

      {tab === 'pipeline' && (
        <div className="space-y-4">
          {/* Funnel */}
          <div className="rounded-2xl p-4 flex items-center gap-2"
            style={{ background: 'rgba(167,139,250,0.07)', border: '1px solid rgba(167,139,250,0.18)' }}>
            <div className="text-xs font-black text-white/25 uppercase tracking-widest mr-2">Funnel</div>
            {Object.entries(STAGE_LABELS).map(([key, { label, color }], i, arr) => {
              const count = PIPELINE.filter(p => p.stage === key).length;
              return (
                <div key={key} className="flex items-center">
                  <div className="text-center px-3">
                    <div className="text-xl font-black" style={{ color }}>{count}</div>
                    <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>{label}</div>
                  </div>
                  {i < arr.length - 1 && <div className="text-white/15 text-xl">›</div>}
                </div>
              );
            })}
            <button onClick={() => showToast('run AI match for all open roles')}
              className="ml-auto px-4 py-2 rounded-xl text-xs font-black"
              style={{ background: 'linear-gradient(135deg, #a78bfa, #818cf8)', color: 'white', boxShadow: '0 4px 16px rgba(167,139,250,0.3)' }}>
              ⚡ Run AI match
            </button>
          </div>

          {PIPELINE.map(p => {
            const stage = STAGE_LABELS[p.stage];
            return (
              <div key={p.id} className="rounded-2xl p-5"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-xs font-black shrink-0"
                    style={{ background: 'linear-gradient(135deg, rgba(79,120,255,0.4), rgba(99,102,241,0.3))', border: '1px solid rgba(79,120,255,0.3)' }}>
                    {p.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-white font-black text-sm">{p.name}</span>
                      <span className="text-white/40 text-xs">{p.town} · {p.postcode}</span>
                      <span className="text-[9px] font-black px-2 py-0.5 rounded-full"
                        style={{ color: stage.color, background: stage.bg, border: `1px solid ${stage.color}40` }}>
                        {stage.label}
                      </span>
                      <span className="text-white/20 text-[10px] ml-auto">{p.appliedDays}d in pipeline</span>
                    </div>
                    <div className="mt-1.5 text-xs text-white/40">
                      Matched to: <span className="text-white/70 font-medium">{p.matchedTo}</span>
                      <span className="mx-2 text-white/20">·</span>
                      {p.completions} jobs
                      <span className="mx-2 text-white/20">·</span>
                      {p.slaRate}% SLA
                    </div>
                    <div className="flex gap-1 mt-2">
                      {p.services.map(s => (
                        <span key={s} className="text-[9px] px-2 py-0.5 rounded-full text-white/45"
                          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>{s}</span>
                      ))}
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <span className="text-[10px] text-white/30 w-24">Connect Score</span>
                      <div className="flex-1 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
                        <div className="h-full rounded-full" style={{ width: `${p.connectScore}%`, background: '#a78bfa', boxShadow: '0 0 6px rgba(167,139,250,0.5)' }} />
                      </div>
                      <span className="text-[11px] font-black text-purple-400">{p.connectScore}</span>
                    </div>
                    <div className="mt-3 p-3 rounded-xl text-xs text-white/45 italic"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      {p.notes}
                    </div>
                    <div className="flex gap-2 mt-3">
                      {p.stage === 'invited'  && <button onClick={() => showToast(`chase ${p.name}'s invite`)} className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-white/50 hover:text-white transition-all" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>Chase invite</button>}
                      {p.stage === 'matched'  && <button onClick={() => showToast(`send offer to ${p.name}`)} className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-white/50 hover:text-white transition-all" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>Send offer</button>}
                      {p.stage === 'review'   && <button onClick={() => showToast(`approve ${p.name}`)} className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-white/50 hover:text-white transition-all" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>Approve</button>}
                      {p.stage === 'trial'    && <button onClick={() => showToast(`confirm trial for ${p.name}`)} className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-white/50 hover:text-white transition-all" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>Confirm trial</button>}
                      <button onClick={() => showToast(`view full profile for ${p.name}`)} className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-white/50 hover:text-white transition-all" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>Full profile</button>
                      <button onClick={() => showToast(`reject ${p.name}`)} className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-red-400/40 hover:text-red-400 transition-all" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>Not suitable</button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'open-roles' && (
        <div className="space-y-3">
          {OPEN_ROLES.map((r, i) => {
            const urg = URGENCY[r.urgency];
            return (
              <div key={i} className="rounded-2xl p-5 flex items-center gap-4"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white font-black text-sm">{r.site}</span>
                    <span className="text-[9px] font-black px-2 py-0.5 rounded-full"
                      style={{ color: urg.color, background: `${urg.color}15`, border: `1px solid ${urg.color}35` }}>
                      {urg.label}
                    </span>
                  </div>
                  <div className="text-white/40 text-xs mt-1">{r.type} · {r.needed}</div>
                  {r.matched > 0 && (
                    <div className="text-[11px] text-purple-400 mt-1.5">⚡ {r.matched} AI-matched candidate{r.matched > 1 ? 's' : ''} in pipeline</div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => showToast(`run AI match for ${r.site}`)}
                    className="px-3 py-2 rounded-lg text-[11px] font-black transition-all"
                    style={{ background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.3)', color: '#a78bfa' }}>
                    AI match
                  </button>
                  <button onClick={() => showToast(`post ${r.site} role to Connect network`)}
                    className="px-3 py-2 rounded-lg text-[11px] font-bold text-white/50 hover:text-white transition-all"
                    style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
                    Post to Connect
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
