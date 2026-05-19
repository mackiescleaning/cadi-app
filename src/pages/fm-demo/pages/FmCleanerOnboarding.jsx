import { useState } from 'react';

const STAGES = [
  { id: 'approved',  label: 'Application approved', icon: '✅', auto: false },
  { id: 'dbs',       label: 'DBS check',            icon: '🔍', auto: true  },
  { id: 'app',       label: 'App setup & ID',        icon: '📱', auto: true  },
  { id: 'briefing',  label: 'Site briefing',         icon: '📋', auto: false },
  { id: 'trial',     label: 'Trial clean',           icon: '🧹', auto: false },
  { id: 'live',      label: 'Go live',               icon: '🟢', auto: false },
];

const ONBOARDEES = [
  {
    name: 'Fatima Bello', avatar: 'FB', site: 'L&D Hospital – A&E & Outpatients',
    type: 'Healthcare', startDate: '16 May 2026',
    currentStage: 'briefing',
    stages: {
      approved: { done: true,  date: '16 May', note: 'Application approved by James Harper' },
      dbs:      { done: true,  date: '16 May', note: 'DBS certificate verified — clear' },
      app:      { done: true,  date: '17 May', note: 'App installed, ID uploaded, uniform ordered' },
      briefing: { done: false, date: '20 May', note: 'Site briefing with Stefan Kovac scheduled 20 May 08:30' },
      trial:    { done: false, date: '21 May', note: 'Trial clean — 06:00–08:00 with supervisor present' },
      live:     { done: false, date: '26 May', note: 'Projected go-live pending trial sign-off' },
    },
    daysIn: 2,
    projected: '26 May',
  },
  {
    name: 'Leah Okonkwo', avatar: 'LO', site: 'Luton Central Library',
    type: 'Public Sector', startDate: '12 May 2026',
    currentStage: 'trial',
    stages: {
      approved: { done: true, date: '12 May', note: 'Application approved' },
      dbs:      { done: true, date: '12 May', note: 'DBS cleared same day — Cadi verified' },
      app:      { done: true, date: '13 May', note: 'App setup complete, library access codes issued' },
      briefing: { done: true, date: '15 May', note: 'Briefed by area supervisor — checklist reviewed' },
      trial:    { done: false, date: '20 May', note: 'Trial clean booked Tue 20 May 07:00 — supervisor attending' },
      live:     { done: false, date: '22 May', note: 'Projected go-live' },
    },
    daysIn: 6,
    projected: '22 May',
  },
  {
    name: 'Dev Sharma', avatar: 'DS', site: 'Aldi – Dunstable RDC (cover)',
    type: 'Industrial', startDate: '15 May 2026',
    currentStage: 'app',
    stages: {
      approved: { done: true,  date: '15 May', note: 'Approved for cover role — 3 weeks' },
      dbs:      { done: true,  date: '15 May', note: 'Existing DBS on file — accepted' },
      app:      { done: false, date: '19 May', note: 'App install reminder sent — awaiting completion' },
      briefing: { done: false, date: '21 May', note: 'Warehouse safety briefing to be scheduled' },
      trial:    { done: false, date: '23 May', note: 'Supervised trial before first solo shift' },
      live:     { done: false, date: '26 May', note: 'Cover starts 26 May' },
    },
    daysIn: 3,
    projected: '26 May',
  },
];

function StageBar({ stages, currentStage }) {
  const stageIds = STAGES.map(s => s.id);
  const currentIdx = stageIds.indexOf(currentStage);
  return (
    <div className="flex items-center gap-0 mt-3">
      {STAGES.map((s, i) => {
        const stageData = stages[s.id];
        const done = stageData?.done;
        const isCurrent = s.id === currentStage;
        return (
          <div key={s.id} className="flex items-center flex-1">
            <div className="flex flex-col items-center flex-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm transition-all ${
                done ? 'bg-emerald-500/20 border border-emerald-500/50' :
                isCurrent ? 'bg-blue-500/20 border border-blue-500/50' :
                'bg-white/5 border border-white/10'
              }`}>
                {done ? '✓' : isCurrent ? '→' : <span className="text-white/15 text-[10px]">·</span>}
              </div>
              <div className={`text-[9px] mt-1 font-bold text-center leading-tight ${
                done ? 'text-emerald-400/70' : isCurrent ? 'text-blue-400/80' : 'text-white/20'
              }`} style={{ maxWidth: 52 }}>{s.label}</div>
            </div>
            {i < STAGES.length - 1 && (
              <div className="w-4 h-px shrink-0 -mt-4" style={{ background: done ? 'rgba(52,211,153,0.4)' : 'rgba(255,255,255,0.08)' }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function FmCleanerOnboarding({ showToast }) {
  const [expanded, setExpanded] = useState(null);

  const live       = ONBOARDEES.filter(o => o.currentStage === 'live').length;
  const inProgress = ONBOARDEES.filter(o => o.currentStage !== 'live').length;

  return (
    <div className="p-6 space-y-5 max-w-4xl">

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'In progress', value: inProgress, sub: 'active inductions',  color: '#4f78ff' },
          { label: 'Trial this week', value: 2,       sub: 'Tue & Wed morning',  color: '#fbbf24' },
          { label: 'Avg time to live', value: '9d',   sub: 'vs 4–6 weeks before', color: '#34d399' },
        ].map(({ label, value, sub, color }) => (
          <div key={label} className="rounded-2xl p-4"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="text-2xl font-black" style={{ color }}>{value}</div>
            <div className="text-white/80 text-xs font-bold mt-0.5">{label}</div>
            <div className="text-white/30 text-[10px] mt-0.5">{sub}</div>
          </div>
        ))}
      </div>

      {/* Callout */}
      <div className="rounded-2xl p-4 flex items-center gap-3"
        style={{ background: 'rgba(52,211,153,0.07)', border: '1px solid rgba(52,211,153,0.2)' }}>
        <div className="text-lg">⚡</div>
        <div className="text-xs text-white/50">
          Cadi handles DBS verification, app setup, and checklist briefing automatically — your team only needs to approve and confirm the trial clean.
        </div>
      </div>

      {/* Onboardee cards */}
      <div className="space-y-3">
        {ONBOARDEES.map(o => {
          const isOpen = expanded === o.name;
          const stageIds = STAGES.map(s => s.id);
          const currentIdx = stageIds.indexOf(o.currentStage);
          const pct = Math.round(((currentIdx) / (STAGES.length - 1)) * 100);

          return (
            <div key={o.name} className="rounded-2xl overflow-hidden transition-all"
              style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${isOpen ? 'rgba(79,120,255,0.3)' : 'rgba(255,255,255,0.08)'}` }}>

              <div className="px-5 py-4 cursor-pointer" onClick={() => setExpanded(isOpen ? null : o.name)}>
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-xs font-black shrink-0"
                    style={{ background: 'linear-gradient(135deg, rgba(79,120,255,0.4), rgba(99,102,241,0.3))', border: '1px solid rgba(79,120,255,0.3)' }}>
                    {o.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-black text-sm">{o.name}</span>
                      <span className="text-white/30 text-[10px]">{o.type}</span>
                    </div>
                    <div className="text-white/40 text-xs mt-0.5">{o.site}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-white font-black text-sm">Day {o.daysIn}</div>
                    <div className="text-white/30 text-[10px]">Go live {o.projected}</div>
                  </div>
                  <div className="w-16 text-right">
                    <div className="text-sm font-black" style={{ color: pct >= 80 ? '#34d399' : pct >= 50 ? '#4f78ff' : '#fbbf24' }}>{pct}%</div>
                    <div className="text-white/20 text-[10px]">complete</div>
                  </div>
                  <div className="text-white/20 text-sm">{isOpen ? '↑' : '↓'}</div>
                </div>
                <StageBar stages={o.stages} currentStage={o.currentStage} />
              </div>

              {isOpen && (
                <div className="px-5 pb-5 border-t border-white/5">
                  <div className="mt-4 space-y-2">
                    {STAGES.map(s => {
                      const sd = o.stages[s.id];
                      const done = sd?.done;
                      const isCurrent = s.id === o.currentStage;
                      return (
                        <div key={s.id} className="flex items-start gap-3 py-2 px-3 rounded-xl"
                          style={{ background: isCurrent ? 'rgba(79,120,255,0.08)' : 'transparent', border: isCurrent ? '1px solid rgba(79,120,255,0.2)' : '1px solid transparent' }}>
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 mt-0.5 ${
                            done ? 'bg-emerald-500/15 text-emerald-400' : isCurrent ? 'bg-blue-500/15 text-blue-400' : 'bg-white/5 text-white/15'
                          }`}>
                            {done ? '✓' : isCurrent ? '→' : '·'}
                          </div>
                          <div className="flex-1">
                            <div className={`text-xs font-bold ${done ? 'text-white/60' : isCurrent ? 'text-white' : 'text-white/25'}`}>
                              {s.label}
                              {s.auto && <span className="ml-2 text-[9px] font-black px-1.5 py-0.5 rounded" style={{ background: 'rgba(167,139,250,0.12)', color: '#a78bfa' }}>Auto</span>}
                            </div>
                            <div className={`text-[11px] mt-0.5 ${done ? 'text-white/35' : isCurrent ? 'text-white/55' : 'text-white/20'}`}>{sd?.note}</div>
                            {sd?.date && <div className="text-[10px] text-white/20 mt-0.5">{sd.date}</div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex gap-2 mt-4">
                    <button onClick={() => showToast(`send update to ${o.name}`)}
                      className="px-3 py-2 rounded-lg text-[11px] font-bold text-white/50 hover:text-white transition-all"
                      style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
                      Message operative
                    </button>
                    <button onClick={() => showToast(`mark next stage complete for ${o.name}`)}
                      className="px-3 py-2 rounded-lg text-[11px] font-black transition-all"
                      style={{ background: 'rgba(79,120,255,0.15)', border: '1px solid rgba(79,120,255,0.3)', color: '#7b9fff' }}>
                      Mark stage complete
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
