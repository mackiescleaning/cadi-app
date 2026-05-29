import { useState } from 'react';

const WINS = [
  {
    id: 1, type: 'star', stars: 5,
    client: 'Next Retail UK Ltd', site: 'Next – Luton The Mall',
    contact: 'Helen Marsh', date: '15 May 2026',
    operative: 'Maria Kowalski', avatar: 'MK',
    quote: 'Maria is consistently exceptional — the store is always spotless before opening, she works quietly and efficiently, and the photo evidence gives us complete confidence. We would not want anyone else.',
    shared: true,
  },
  {
    id: 2, type: 'star', stars: 5,
    client: 'Central Bedfordshire Council', site: 'Central Beds Council HQ',
    contact: 'Mark Davies', date: '14 May 2026',
    operative: 'Yemi Adesanya', avatar: 'YA',
    quote: 'Yemi has been faultless since day one. The Council chamber is always pristine for early morning meetings. Brilliant operative — please pass on our thanks.',
    shared: false,
  },
  {
    id: 3, type: 'milestone', stars: null,
    client: 'University of Bedfordshire', site: 'UoB Luton Campus',
    contact: 'Facilities Manager', date: '12 May 2026',
    operative: 'Priya Singh', avatar: 'PS',
    quote: '100 consecutive on-time completions. Zero missed SLAs. Zero client complaints. UoB have renewed for a further 12 months citing Priya specifically by name.',
    shared: true,
  },
  {
    id: 4, type: 'star', stars: 5,
    client: 'Luton & Dunstable NHS FT', site: 'L&D Hospital – Main Tower',
    contact: 'Brian Cole', date: '10 May 2026',
    operative: 'Tara Hobson', avatar: 'TH',
    quote: 'Infection control standards are critical for us and Tara never misses a beat. The ward teams have commented on the improvement in cleanliness since she took over. Excellent work.',
    shared: true,
  },
  {
    id: 5, type: 'sla', stars: null,
    client: 'Aldi UK Ltd', site: 'Aldi – Dunstable RDC',
    contact: 'Ops Team', date: '9 May 2026',
    operative: 'Marcus Webb', avatar: 'MW',
    quote: '6-month SLA streak — 100% on-time at Aldi Dunstable RDC. Distribution centre open every morning without exception. Aldi ops team flagged to Britannia Group account manager.',
    shared: false,
  },
  {
    id: 6, type: 'star', stars: 5,
    client: 'Waterstones Ltd', site: 'Waterstones – Luton',
    contact: 'Regional Ops', date: '7 May 2026',
    operative: 'Sarah Patel', avatar: 'SP',
    quote: 'Sarah always leaves the store looking beautiful — customers have commented on how clean it feels first thing. She is cheerful, professional and never needs chasing. Couldn\'t be happier.',
    shared: false,
  },
];

const FEEDBACK = [
  {
    id: 'f1', stars: 3,
    client: 'Whitbread Hotels Ltd', site: 'Premier Inn Luton Airport',
    contact: 'Ops Team', date: '13 May 2026',
    operative: 'Diane Fletcher', avatar: 'DF',
    comment: 'Lobby area was well cleaned but the breakfast room needed more attention around the table bases. Not a major issue — just flag for next visit.',
    status: 'actioned', response: 'Noted and briefed to operative. Checklist updated to include table bases specifically.',
  },
  {
    id: 'f2', stars: 4,
    client: 'Luton Borough Council', site: 'Luton Central Library',
    contact: 'Janet Simms', date: '8 May 2026',
    operative: 'Comfort Owusu', avatar: 'CO',
    comment: 'Generally very good but the accessible toilets were missed on Tuesday morning. Spotted by our duty manager before opening — appreciate the quick response when we called.',
    status: 'resolved', response: 'Issue logged as ISS-0039. Resolved in 38 minutes. Operative briefed.',
  },
];

const WIN_TYPE = {
  star:      { label: '5-star review',  bg: 'rgba(251,191,36,0.08)',  border: 'rgba(251,191,36,0.25)',  color: '#fbbf24', icon: '⭐' },
  milestone: { label: 'Milestone',      bg: 'rgba(52,211,153,0.08)',  border: 'rgba(52,211,153,0.25)',  color: '#34d399', icon: '🏆' },
  sla:       { label: 'SLA streak',     bg: 'rgba(79,120,255,0.08)',  border: 'rgba(79,120,255,0.25)',  color: '#4f78ff', icon: '🔥' },
};

function Avatar({ initials }) {
  return (
    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-black shrink-0"
      style={{ background: 'linear-gradient(135deg, rgba(79,120,255,0.5), rgba(99,102,241,0.35))', border: '1px solid rgba(79,120,255,0.3)' }}>
      {initials}
    </div>
  );
}

const IMPACT = [
  { before: 'Client praise stays in email, never reaches your team', after: 'Wins shared instantly — motivates and retains your best people', icon: '🏆' },
  { before: 'Negative feedback unresolved, client churns quietly',   after: 'Every complaint logged, actioned, and closed with evidence',   icon: '🔁' },
  { before: 'No proof of quality when renewing contracts',           after: 'Track record in one place — share with any client on demand',  icon: '📊' },
];

export default function FmReviews({ showToast }) {
  const [tab, setTab] = useState('wins');

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

      {/* Header */}
      <div className="rounded-2xl p-5 flex items-start gap-4"
        style={{ background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.2)' }}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
          style={{ background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.3)' }}>🏆</div>
        <div className="flex-1">
          <div className="text-white font-black text-sm">Reviews & recognition</div>
          <div className="text-white/45 text-xs mt-0.5">Client wins, operative milestones, and feedback — all in one place. Share great reviews directly with your team.</div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-black text-amber-400">{WINS.length}</div>
          <div className="text-white/30 text-[10px]">wins this month</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 rounded-xl w-fit"
        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
        {[
          { id: 'wins',     label: '🏆  Wins',     count: WINS.length },
          { id: 'feedback', label: '💬  Feedback',  count: FEEDBACK.length },
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

      {/* Wins */}
      {tab === 'wins' && (
        <div className="space-y-3">
          {WINS.map(w => {
            const cfg = WIN_TYPE[w.type];
            return (
              <div key={w.id} className="rounded-2xl p-5"
                style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
                <div className="flex items-start gap-4">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0"
                    style={{ background: `${cfg.color}20`, border: `1px solid ${cfg.color}40` }}>
                    {cfg.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[9px] font-black px-2 py-0.5 rounded-full"
                        style={{ color: cfg.color, background: `${cfg.color}15`, border: `1px solid ${cfg.color}35` }}>
                        {cfg.label}
                      </span>
                      <span className="text-white/40 text-[10px]">{w.client}</span>
                      <span className="text-white/20 text-[10px]">·</span>
                      <span className="text-white/40 text-[10px]">{w.date}</span>
                      {w.shared && (
                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full ml-auto"
                          style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399', border: '1px solid rgba(52,211,153,0.25)' }}>
                          ✓ Shared with operative
                        </span>
                      )}
                    </div>
                    <div className="mt-2 text-white/70 text-xs leading-relaxed italic">"{w.quote}"</div>
                    <div className="mt-3 flex items-center gap-3">
                      <Avatar initials={w.avatar} />
                      <div>
                        <div className="text-white/80 text-xs font-bold">{w.operative}</div>
                        <div className="text-white/35 text-[10px]">{w.site}</div>
                      </div>
                      <div className="ml-auto flex gap-2">
                        {!w.shared && (
                          <button onClick={() => showToast(`share win with ${w.operative}`)}
                            className="px-3 py-1.5 rounded-lg text-[11px] font-black transition-all"
                            style={{ background: `${cfg.color}20`, border: `1px solid ${cfg.color}40`, color: cfg.color }}>
                            Share with operative
                          </button>
                        )}
                        <button onClick={() => showToast(`add ${w.operative}'s win to monthly report`)}
                          className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-white/40 hover:text-white transition-all"
                          style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
                          Add to report
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

      {/* Feedback */}
      {tab === 'feedback' && (
        <div className="space-y-4">
          <div className="rounded-2xl p-4 flex items-center gap-3"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="text-lg">💬</div>
            <div className="text-xs text-white/40">Client feedback is logged here automatically when a review contains suggestions or scores below 5 stars. All items below have been reviewed by the team.</div>
          </div>
          {FEEDBACK.map(f => (
            <div key={f.id} className="rounded-2xl p-5"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="flex items-start gap-4">
                <Avatar initials={f.avatar} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-amber-400 text-xs font-black">{'★'.repeat(f.stars)}{'☆'.repeat(5 - f.stars)}</span>
                    <span className="text-white/40 text-[10px]">{f.client} · {f.date}</span>
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ml-auto ${
                      f.status === 'resolved' ? 'text-emerald-400 bg-emerald-400/10 border border-emerald-400/25' : 'text-blue-400 bg-blue-400/10 border border-blue-400/25'
                    }`}>
                      {f.status === 'resolved' ? '✓ Resolved' : 'Actioned'}
                    </span>
                  </div>
                  <div className="mt-2 text-white/60 text-xs leading-relaxed">"{f.comment}"</div>
                  <div className="mt-2 text-white/30 text-[10px]">{f.operative} · {f.site}</div>
                  <div className="mt-3 p-3 rounded-xl text-[11px] text-white/50 italic"
                    style={{ background: 'rgba(79,120,255,0.06)', border: '1px solid rgba(79,120,255,0.15)' }}>
                    Response: {f.response}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
