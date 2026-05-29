import { Shield, ChevronRight, Target, Users, Rocket, CheckCircle2, Circle, MapPin, Clock } from 'lucide-react';

const NAVY = '#010a4f';

// Day 12 of mobilisation — today is 24 May 2026, contract awarded 12 May 2026
const MOB_PHASES = [
  { id: 'award',  label: 'Contract Award',  date: '12 May',     done: true  },
  { id: 'survey', label: 'Site Surveys',    date: 'T1 done · T2 starts 28 May', done: false, partial: true },
  { id: 'scope',  label: 'Scope Confirmed', date: '18 May',     done: true  },
  { id: 'people', label: 'People & TUPE',   date: 'Day 12/28',  done: false, active: true },
  { id: 'kpis',   label: 'KPIs Agreed',     date: '12 May',     done: true  },
  { id: 'golive', label: 'Go Live',         date: '01 Jul 2026',done: false  },
];

const SITES = [
  { id: 'lu', name: 'Asda – Luton Supercentre',     address: 'Gipsy Lane, Luton LU1 3HR',           tier: 1, status: 'live',   lastClean: 'Today 06:15', nextClean: 'Tomorrow 06:00', sla: 100, jobs: 4, streak: [true, true, null, null, null] },
  { id: 'bm', name: 'Asda – Birmingham Minworth',   address: 'Minworth Industrial Park, B76 1AH',   tier: 1, status: 'live',   lastClean: 'Today 05:50', nextClean: 'Tomorrow 06:00', sla: 100, jobs: 3, streak: [true, true, null, null, null] },
  { id: 'mk', name: 'Asda – Milton Keynes Central', address: 'Grafton Gate E, MK9 1DA',             tier: 2, status: 'survey', surveyDate: '28 May',  liveDate: '15 Jun 2026' },
  { id: 'wf', name: 'Asda – Watford Dome',          address: 'Colonial Way, Watford WD24 4WU',      tier: 2, status: 'survey', surveyDate: '28 May',  liveDate: '17 Jun 2026' },
  { id: 'cv', name: 'Asda – Coventry Arena',        address: 'Arena Park, Coventry CV6 6GE',        tier: 2, status: 'survey', surveyDate: '30 May',  liveDate: '19 Jun 2026' },
  { id: 'st', name: 'Asda – Stevenage Retail Park', address: 'Roaring Meg Retail Park, SG1 1XN',   tier: 3, status: 'pending', surveyDate: '3 Jun',   liveDate: '01 Jul 2026' },
];

const TIER_STYLE = {
  1: { label: 'Tier 1', color: '#ef4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.25)' },
  2: { label: 'Tier 2', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.25)' },
  3: { label: 'Tier 3', color: '#10b981', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.25)' },
};

const STATUS_STYLE = {
  live:    { label: 'Live',         dot: '#10b981', bg: 'rgba(16,185,129,0.09)',  border: 'rgba(16,185,129,0.25)',  text: '#059669' },
  survey:  { label: 'Survey booked',dot: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.25)',  text: '#d97706' },
  pending: { label: 'Scope set',    dot: '#94a3b8', bg: 'rgba(148,163,184,0.08)',border: 'rgba(148,163,184,0.2)',  text: '#64748b' },
};

const TUPE_ITEMS = [
  { label: 'Employee liability info requested from outgoing contractor', done: true },
  { label: 'Individual staff consultation meetings scheduled', done: true },
  { label: 'Right-to-work documentation verified', done: false },
  { label: 'DBS checks initiated', done: false },
  { label: 'Payroll records transferred', done: false },
  { label: 'Uniform and access passes ordered', done: false },
];

export default function ClientOverview({ showToast, onNavigate }) {
  const liveSites = SITES.filter(s => s.status === 'live').length;
  const tupeComplete = TUPE_ITEMS.filter(i => i.done).length;

  return (
    <div className="p-6 space-y-5 max-w-3xl">

      {/* ── Mobilisation Status Hero ── */}
      <div className="rounded-2xl overflow-hidden shadow-lg"
        style={{ background: 'linear-gradient(135deg, #010a4f 0%, #0d1f6e 100%)' }}>
        <div className="px-6 pt-5 pb-4">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-[10px] font-black text-amber-300 tracking-[0.18em] uppercase">Mobilisation in progress</span>
              </div>
              <h2 className="text-white font-black text-xl leading-tight">Day 12 · Contract + Exterior</h2>
              <p className="text-blue-200 text-sm mt-1">{liveSites} of {SITES.length} sites live · Full estate go-live: 01 Jul 2026</p>
            </div>
            <button onClick={() => onNavigate('mobilisation')}
              className="shrink-0 px-4 py-2 rounded-xl text-xs font-black text-white border border-white/20 hover:bg-white/10 transition-colors flex items-center gap-1.5">
              View full plan <ChevronRight size={12} />
            </button>
          </div>

          {/* Phase dots */}
          <div className="flex items-center gap-0">
            {MOB_PHASES.map((phase, i) => {
              const last = i === MOB_PHASES.length - 1;
              return (
                <div key={phase.id} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div style={{
                      width: 22, height: 22, borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: phase.done ? '#34d399' : phase.active ? 'rgba(251,191,36,0.25)' : 'rgba(255,255,255,0.08)',
                      border: phase.done ? '1px solid #34d399' : phase.active ? '2px solid #fbbf24' : '1px solid rgba(255,255,255,0.15)',
                      fontSize: 9, fontWeight: 900, color: 'white', flexShrink: 0,
                    }}>
                      {phase.done ? '✓' : phase.active ? '●' : i + 1}
                    </div>
                    <div style={{ fontSize: 8, color: phase.done ? '#34d399' : phase.active ? '#fbbf24' : 'rgba(255,255,255,0.3)', fontWeight: 700, whiteSpace: 'nowrap', textAlign: 'center', lineHeight: 1.2 }}>
                      {phase.label}
                    </div>
                    <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.25)', whiteSpace: 'nowrap', textAlign: 'center' }}>
                      {phase.date}
                    </div>
                  </div>
                  {!last && <div style={{ flex: 1, height: 1, background: phase.done ? 'rgba(52,211,153,0.4)' : 'rgba(255,255,255,0.1)', margin: '0 4px', marginBottom: 28 }} />}
                </div>
              );
            })}
          </div>
        </div>

        <div className="px-6 py-3 border-t border-white/8 flex items-center justify-between">
          <span className="text-[10px] text-white/35">TUPE window: Day 12 of 28 · {tupeComplete}/6 actions complete</span>
          <span className="text-[10px] text-blue-300/70">Britannia Group · {SITES.length} sites</span>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Sites live',      value: `${liveSites}/6`,  sub: '2 Tier 1 · active',        color: '#10b981', Icon: MapPin   },
          { label: 'Job cards active',value: '8/28',            sub: 'live sites only so far',   color: '#4f78ff', Icon: Target   },
          { label: 'TUPE progress',   value: `${tupeComplete}/6`,sub: `Day 12 of 28-day window`, color: '#f59e0b', Icon: Users    },
          { label: 'KPIs agreed',     value: '87%',             sub: 'audit pass target',        color: '#6366f1', Icon: Shield   },
        ].map(({ label, value, sub, color, Icon }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-1">
              <div className="text-2xl font-black mt-0.5" style={{ color }}>{value}</div>
              <Icon size={14} style={{ color, opacity: 0.4, marginTop: 4 }} />
            </div>
            <div className="text-xs font-bold text-[#010a4f]">{label}</div>
            <div className="text-[10px] text-gray-400 mt-0.5">{sub}</div>
          </div>
        ))}
      </div>

      {/* ── My Sites ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">Your 6 sites</div>
          <button onClick={() => onNavigate('mobilisation')} className="text-xs text-[#4f78ff] font-bold flex items-center gap-1 hover:underline">
            View rollout plan <ChevronRight size={12} />
          </button>
        </div>
        <div className="space-y-2.5">
          {SITES.map(site => {
            const st = STATUS_STYLE[site.status];
            const tier = TIER_STYLE[site.tier];
            return (
              <div key={site.id} className="bg-white rounded-2xl border shadow-sm p-4 transition-all hover:shadow-md"
                style={{ borderColor: site.status === 'live' ? 'rgba(16,185,129,0.2)' : 'rgba(229,231,235,1)' }}>
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="font-bold text-sm" style={{ color: NAVY }}>{site.name}</span>
                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded" style={{ background: tier.bg, border: `1px solid ${tier.border}`, color: tier.color }}>{tier.label}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1"
                        style={{ background: st.bg, border: `1px solid ${st.border}`, color: st.text }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: st.dot, display: 'inline-block', flexShrink: 0 }} />
                        {st.label}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400">{site.address}</div>

                    {site.status === 'live' && (
                      <div className="flex items-center gap-4 mt-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-gray-400">This week</span>
                          <div className="flex gap-1">
                            {['M','T','W','T','F'].map((d, i) => {
                              const s = site.streak[i];
                              return (
                                <div key={i} className="flex flex-col items-center gap-0.5">
                                  <div className={`w-5 h-5 rounded-md flex items-center justify-center text-[8px] font-bold ${
                                    s === true ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'
                                  }`}>{s === true ? '✓' : d}</div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-gray-400">
                          <Clock size={9} /> Next: {site.nextClean}
                        </div>
                      </div>
                    )}

                    {(site.status === 'survey' || site.status === 'pending') && (
                      <div className="flex items-center gap-4 mt-2">
                        <span className="text-[10px] text-gray-500">
                          {site.status === 'survey' ? `Site survey: ${site.surveyDate}` : `Survey: ${site.surveyDate}`}
                        </span>
                        <span className="text-[10px] font-bold text-[#4f78ff]">Expected live: {site.liveDate}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    {site.status === 'live' && (
                      <>
                        <div className="text-right">
                          <div className="text-sm font-bold" style={{ color: NAVY }}>{site.jobs}</div>
                          <div className="text-[10px] text-gray-400">job cards</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold" style={{ color: '#10b981' }}>{site.sla}%</div>
                          <div className="text-[10px] text-gray-400">SLA</div>
                        </div>
                      </>
                    )}
                    {site.status !== 'live' && (
                      <div className="text-right">
                        <div className="text-[10px] font-bold" style={{ color: '#f59e0b' }}>Mobilising</div>
                        <div className="text-[10px] text-gray-400">{site.liveDate}</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── KPI Scorecard ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-50 flex items-center justify-between">
          <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">Agreed KPI framework</div>
          <span className="text-[9px] font-black px-2.5 py-1 rounded-full" style={{ color: '#34d399', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.25)' }}>
            ✓ Locked in contract
          </span>
        </div>
        <div className="grid grid-cols-4 divide-x divide-gray-100">
          {[
            { label: 'Audit pass score',    value: '87%',    sub: 'minimum threshold',  color: '#4f78ff' },
            { label: 'Re-clean response',   value: '24 hrs', sub: 'from complaint',     color: '#10b981' },
            { label: 'Staff cover rate',    value: '95%',    sub: 'minimum acceptable', color: '#6366f1' },
            { label: 'Reactive SLA',        value: '4 hrs',  sub: 'emergency call-outs',color: '#f59e0b' },
          ].map(({ label, value, sub, color }) => (
            <div key={label} className="px-4 py-4 text-center">
              <div className="text-xl font-black" style={{ color }}>{value}</div>
              <div className="text-[11px] font-bold text-[#010a4f] mt-1">{label}</div>
              <div className="text-[9px] text-gray-400 mt-0.5">{sub}</div>
            </div>
          ))}
        </div>
        <div className="px-5 py-2.5 border-t border-gray-50 text-[10px] text-gray-400">
          Tracking begins from go-live for each site. Live sites (Tier 1) are already being measured.
        </div>
      </div>

      {/* ── TUPE Tracker ── */}
      <div className="bg-white rounded-2xl border border-amber-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-amber-50 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">TUPE — staff transfer</div>
            <div className="text-xs font-bold text-[#010a4f] mt-0.5">18 staff transferring · Day 12 of 28-day window</div>
          </div>
          <span className="text-[9px] font-black px-2.5 py-1 rounded-full" style={{ color: '#d97706', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)' }}>
            In progress
          </span>
        </div>
        {/* Progress bar */}
        <div className="px-5 pt-3 pb-2">
          <div className="flex justify-between text-[9px] text-gray-400 mb-1">
            <span>Day 1 — 12 May</span>
            <span className="font-bold text-amber-600">Day 12 today</span>
            <span>Day 28 — 09 Jun</span>
          </div>
          <div className="h-2 rounded-full bg-gray-100">
            <div className="h-full rounded-full" style={{ width: '43%', background: 'linear-gradient(90deg, #f59e0b, #fbbf24)' }} />
          </div>
        </div>
        <div className="px-5 pb-4 space-y-1.5">
          {TUPE_ITEMS.map(({ label, done }) => (
            <div key={label} className="flex items-center gap-2.5 py-1">
              {done
                ? <CheckCircle2 size={13} style={{ color: '#10b981', flexShrink: 0 }} />
                : <Circle size={13} style={{ color: '#d1d5db', flexShrink: 0 }} />}
              <span className="text-[11px]" style={{ color: done ? '#374151' : '#9ca3af' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Quick Actions ── */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'View mobilisation plan', icon: <Rocket size={18} />, color: '#4f78ff', action: () => onNavigate('mobilisation') },
          { label: 'Report an issue',        icon: '⚠️',                 color: null,       action: () => onNavigate('issue') },
          { label: 'Message Britannia',      icon: '💬',                 color: null,       action: () => showToast('open message thread with Britannia ops team') },
          { label: 'Download compliance',    icon: '📄',                 color: null,       action: () => showToast('download compliance pack') },
        ].map(({ label, icon, color, action }) => (
          <button key={label} onClick={action}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center hover:border-[#4f78ff]/30 hover:shadow-md transition-all">
            <div className="flex justify-center mb-2">
              {typeof icon === 'string'
                ? <span className="text-2xl">{icon}</span>
                : <div style={{ color: color || '#4f78ff' }}>{icon}</div>}
            </div>
            <div className="text-xs font-bold" style={{ color: NAVY }}>{label}</div>
          </button>
        ))}
      </div>

    </div>
  );
}
