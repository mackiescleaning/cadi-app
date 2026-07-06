import { useState } from 'react';
import {
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronUp,
  Zap,
  FileText,
  Star,
  Shield,
  Bell,
  ArrowRight,
  Building2,
  ClipboardCheck,
  Rocket,
  TrendingUp,
} from 'lucide-react';

const OLD_STEPS = [
  {
    week: 'Week 1',
    label: 'Site survey booked & conducted',
    pain: 'Manual visit, paper notes, photos emailed',
  },
  {
    week: 'Week 1–2',
    label: 'Spec agreed via email chain',
    pain: 'Back-and-forth, version confusion, no audit trail',
  },
  {
    week: 'Week 2–3',
    label: 'Contract drafted & signed',
    pain: 'Legal review, posted copies, delayed DocuSign',
  },
  {
    week: 'Week 3–4',
    label: 'Cleaner recruitment & shortlisting',
    pain: 'Job ads, phone interviews, no quality benchmark',
  },
  {
    week: 'Week 4–5',
    label: 'DBS checks, references & induction',
    pain: 'Manual chasing, paper forms, 2–4 week DBS wait',
  },
  {
    week: 'Week 5–6',
    label: 'Trial period & client sign-off',
    pain: 'FM chases client, no evidence, disputes common',
  },
];

const STAGES = [
  {
    id: 'contract',
    icon: FileText,
    label: 'Create contract',
    duration: '10 min',
    color: '#4f78ff',
    description:
      'Enter site details, SLA window, service spec and visit frequency directly in the FM portal. Contract ref auto-generated.',
    auto: false,
  },
  {
    id: 'match',
    icon: Star,
    label: 'Cleaner matched',
    duration: 'Instant',
    color: '#a78bfa',
    description:
      'Cadi scores every cleaner in the network against proximity, Cadi Score, DBS status, and availability. Top 3 shown immediately.',
    auto: true,
  },
  {
    id: 'accept',
    icon: Bell,
    label: 'Cleaner accepts',
    duration: 'Day 1–3',
    color: '#fbbf24',
    description:
      'Push notification sent to top match via Cadi Connect. Cleaner confirms availability and reviews site spec. No phone calls or WhatsApp groups — they respond in their own time.',
    auto: false,
  },
  {
    id: 'client',
    icon: Shield,
    label: 'Client portal live',
    duration: 'Day 2–3',
    color: '#34d399',
    description:
      'Once the cleaner confirms, an auto-generated shareable compliance link is sent to the client contact. They can review the spec, SLA and cleaner profile before day one.',
    auto: true,
  },
  {
    id: 'trial',
    icon: ClipboardCheck,
    label: 'Trial clean & QA',
    duration: 'Day 5–10',
    color: '#60a5fa',
    description:
      'First clean scheduled around cleaner availability — typically within a week of acceptance. Full geo-verified evidence collected. QA Queue review triggered automatically.',
    auto: true,
  },
  {
    id: 'live',
    icon: Rocket,
    label: 'Go live',
    duration: 'Week 1–2',
    color: '#34d399',
    description:
      'Client approves trial evidence via their portal in one click. Contract activated, recurring schedule confirmed, invoicing begins — zero manual admin.',
    auto: false,
  },
];

const ACTIVE_ONBOARDINGS = [
  {
    id: 'ob1',
    client: 'Waterstones Booksellers Ltd',
    site: 'Waterstones – Watford',
    address: 'Charter Place, Watford WD17 2RT',
    service: 'Retail floor clean',
    window: '06:00–09:00',
    value: 100,
    freq: 'Mon–Sat',
    contact: 'Sophie Allen',
    startedDate: '16 May 2026',
    currentStage: 3,
    cleaner: { name: 'Emma Walsh', score: 94, avatar: 'EW', distance: '1.2 mi' },
    stages: [
      { id: 'contract', status: 'done', time: '09:15, 16 May' },
      { id: 'match', status: 'done', time: '09:15, 16 May' },
      { id: 'accept', status: 'done', time: '11:42, 16 May' },
      { id: 'client', status: 'in-progress', time: null },
      { id: 'trial', status: 'pending', time: null },
      { id: 'live', status: 'pending', time: null },
    ],
    elapsed: 'Day 3',
  },
  {
    id: 'ob2',
    client: 'Central Bedfordshire Council',
    site: 'Central Bedfordshire – Watling House',
    address: 'High Street South, Dunstable LU6 3JF',
    service: 'Offices morning clean',
    window: '06:00–08:00',
    value: 65,
    freq: 'Mon–Fri',
    contact: 'David Shaw',
    startedDate: '5 May 2026',
    currentStage: 5,
    cleaner: { name: 'Marcus Webb', score: 89, avatar: 'MW', distance: '2.1 mi' },
    stages: [
      { id: 'contract', status: 'done', time: '14:05, 5 May' },
      { id: 'match', status: 'done', time: '14:05, 5 May' },
      { id: 'accept', status: 'done', time: '09:14, 6 May' },
      { id: 'client', status: 'done', time: '09:14, 6 May' },
      { id: 'trial', status: 'done', time: '07:52, 12 May' },
      { id: 'live', status: 'done', time: '09:30, 13 May' },
    ],
    elapsed: 'Done — 8 days',
  },
];

function StageTrack({ stages }) {
  const stageData = STAGES;
  return (
    <div className="flex items-start gap-0 mt-4">
      {stageData.map((s, i) => {
        const sv = stages[i];
        const done = sv.status === 'done';
        const active = sv.status === 'in-progress';
        const pending = sv.status === 'pending';
        const Icon = s.icon;
        const last = i === stageData.length - 1;
        return (
          <div key={s.id} className="flex items-center flex-1">
            <div className="flex flex-col items-center" style={{ minWidth: 0 }}>
              {/* Circle */}
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all"
                style={
                  done
                    ? {
                        background: `${s.color}22`,
                        border: `2px solid ${s.color}`,
                        boxShadow: `0 0 10px ${s.color}40`,
                      }
                    : active
                      ? {
                          background: `${s.color}18`,
                          border: `2px solid ${s.color}80`,
                          animation: 'alert-pulse 2s ease-in-out infinite',
                        }
                      : {
                          background: 'rgba(255,255,255,0.05)',
                          border: '2px solid rgba(255,255,255,0.12)',
                        }
                }
              >
                {done ? (
                  <CheckCircle2 size={14} style={{ color: s.color }} />
                ) : (
                  <Icon size={12} style={{ color: active ? s.color : 'rgba(255,255,255,0.25)' }} />
                )}
              </div>
              {/* Label */}
              <div
                className="text-[9px] font-bold text-center mt-1.5 leading-tight"
                style={{
                  color: done
                    ? 'rgba(255,255,255,0.7)'
                    : active
                      ? 'white'
                      : 'rgba(255,255,255,0.25)',
                  maxWidth: 64,
                }}
              >
                {s.label}
              </div>
              {/* Time */}
              <div
                className="text-[8px] font-mono mt-0.5 text-center"
                style={{ color: done ? s.color : 'rgba(255,255,255,0.2)', maxWidth: 64 }}
              >
                {sv.time ? sv.time.split(',')[0] : pending ? '—' : '…'}
              </div>
            </div>
            {/* Connector */}
            {!last && (
              <div
                className="flex-1 h-px mx-1 mt-[-22px]"
                style={{
                  background: done
                    ? `linear-gradient(90deg, ${s.color}60, ${STAGES[i + 1].color}30)`
                    : 'rgba(255,255,255,0.08)',
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function OnboardingCard({ ob, expanded, onToggle, showToast }) {
  const done = ob.stages.every((s) => s.status === 'done');
  const currentStageDef = STAGES[ob.currentStage] || STAGES[STAGES.length - 1];

  return (
    <div
      className="rounded-2xl overflow-hidden transition-all"
      style={{
        background: expanded ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.04)',
        border: done ? '1px solid rgba(52,211,153,0.3)' : `1px solid ${currentStageDef.color}30`,
      }}
    >
      <button
        className="w-full px-6 py-4 flex items-center gap-4 text-left group"
        onClick={onToggle}
      >
        {/* Status dot */}
        <div
          className="w-2 h-2 rounded-full shrink-0"
          style={{
            background: done ? '#34d399' : currentStageDef.color,
            boxShadow: `0 0 6px ${done ? '#34d399' : currentStageDef.color}`,
          }}
        />

        {/* Site + client */}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-white truncate">{ob.site}</div>
          <div className="text-[11px] text-white/40 mt-0.5">
            {ob.client} · {ob.contact}
          </div>
        </div>

        {/* Stage label */}
        <div className="shrink-0 hidden md:block">
          <div className="text-[10px] text-white/30">Current stage</div>
          <div
            className="text-xs font-bold mt-0.5"
            style={{ color: done ? '#34d399' : currentStageDef.color }}
          >
            {done ? 'Live' : currentStageDef.label}
          </div>
        </div>

        {/* Elapsed */}
        <div className="shrink-0 w-24 text-right">
          <span
            className="text-[10px] font-black px-2.5 py-1 rounded-full"
            style={
              done
                ? {
                    background: 'rgba(52,211,153,0.12)',
                    border: '1px solid rgba(52,211,153,0.3)',
                    color: '#34d399',
                  }
                : {
                    background: 'rgba(251,191,36,0.12)',
                    border: '1px solid rgba(251,191,36,0.3)',
                    color: '#fbbf24',
                  }
            }
          >
            {ob.elapsed}
          </span>
        </div>

        <div className="text-white/30 group-hover:text-white/60 transition-colors">
          {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </div>
      </button>

      {expanded && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          {/* Stage tracker */}
          <div className="px-6 pt-5 pb-2">
            <div className="text-[10px] font-black uppercase tracking-widest text-white/25 mb-1">
              Onboarding progress
            </div>
            <StageTrack stages={ob.stages} currentStage={ob.currentStage} />
          </div>

          <div
            className="grid grid-cols-[1fr_260px] gap-0"
            style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}
          >
            {/* Left: site + service details */}
            <div className="px-6 py-5" style={{ borderRight: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="text-[10px] font-black uppercase tracking-widest text-white/25 mb-3">
                Site details
              </div>
              <div className="grid grid-cols-2 gap-3 mb-5">
                {[
                  { label: 'Address', value: ob.address },
                  { label: 'Service', value: ob.service },
                  { label: 'SLA window', value: ob.window },
                  { label: 'Frequency', value: ob.freq },
                  { label: 'Visit value', value: `£${ob.value}` },
                  { label: 'Started', value: ob.startedDate },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <div className="text-[10px] text-white/30">{label}</div>
                    <div className="text-xs font-bold text-white/80 mt-0.5">{value}</div>
                  </div>
                ))}
              </div>

              {/* Matched cleaner */}
              <div className="text-[10px] font-black uppercase tracking-widest text-white/25 mb-2">
                Matched cleaner
              </div>
              <div
                className="flex items-center gap-3 p-3 rounded-xl"
                style={{
                  background: 'rgba(167,139,250,0.08)',
                  border: '1px solid rgba(167,139,250,0.2)',
                }}
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-black shrink-0"
                  style={{
                    background: 'rgba(79,120,255,0.2)',
                    border: '1px solid rgba(79,120,255,0.3)',
                  }}
                >
                  {ob.cleaner.avatar}
                </div>
                <div className="flex-1">
                  <div className="text-white text-xs font-bold">{ob.cleaner.name}</div>
                  <div className="text-white/40 text-[10px] mt-0.5">
                    Cadi Score{' '}
                    <span className="text-emerald-400 font-bold">{ob.cleaner.score}</span> ·{' '}
                    {ob.cleaner.distance} from site
                  </div>
                </div>
                <div
                  className="text-[10px] font-black px-2 py-1 rounded-lg"
                  style={{
                    background: 'rgba(52,211,153,0.1)',
                    border: '1px solid rgba(52,211,153,0.2)',
                    color: '#34d399',
                  }}
                >
                  DBS ✓
                </div>
              </div>
            </div>

            {/* Right: actions */}
            <div className="px-5 py-5 space-y-3">
              <div className="text-[10px] font-black uppercase tracking-widest text-white/25 mb-2">
                Actions
              </div>

              {!done && (
                <button
                  onClick={() => window.open('/client-demo', '_blank')}
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition-all"
                  style={{
                    background: 'rgba(52,211,153,0.12)',
                    border: '1px solid rgba(52,211,153,0.3)',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(52,211,153,0.22)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(52,211,153,0.12)')}
                >
                  <Shield size={12} className="text-emerald-400" />
                  <span className="text-emerald-300">Open client portal →</span>
                </button>
              )}

              <button
                onClick={() => showToast('view the cleaner match shortlist')}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition-all"
                style={{
                  background: 'rgba(167,139,250,0.1)',
                  border: '1px solid rgba(167,139,250,0.25)',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(167,139,250,0.2)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(167,139,250,0.1)')}
              >
                <Star size={12} className="text-purple-400" />
                <span className="text-purple-300">View cleaner shortlist</span>
              </button>

              <button
                onClick={() => showToast('view the contract for this site')}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold text-white/40 transition-all"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
              >
                <FileText size={12} />
                <span>View contract</span>
              </button>

              {done && (
                <button
                  onClick={() => showToast('view the live compliance report for this site')}
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition-all"
                  style={{
                    background: 'rgba(79,120,255,0.15)',
                    border: '1px solid rgba(79,120,255,0.35)',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(79,120,255,0.25)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(79,120,255,0.15)')}
                >
                  <ArrowRight size={12} className="text-blue-400" />
                  <span className="text-blue-300">View compliance report</span>
                </button>
              )}

              {/* Time saved callout */}
              <div
                className="rounded-xl px-3 py-3 mt-2"
                style={{
                  background: 'rgba(79,120,255,0.07)',
                  border: '1px solid rgba(79,120,255,0.18)',
                }}
              >
                <div className="text-[10px] font-black text-blue-300 mb-1">
                  Time saved vs old process
                </div>
                <div className="text-xl font-black text-white">
                  {done ? '3–5 weeks' : '2–4 weeks'}
                </div>
                <div className="text-[10px] text-white/35 mt-0.5">
                  vs 4–6 week manual onboarding
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const IMPACT = [
  {
    before: '5–6 weeks from contract to first clean — manual every step',
    after: 'First clean in 1–2 weeks — automated from contract to go-live',
    icon: '🚀',
  },
  {
    before: 'New client onboarding tracked via email chains and calls',
    after: 'Every stage tracked live — FM, cleaner and client all in sync',
    icon: '📋',
  },
  {
    before: 'Trial clean with no evidence — client disputes common',
    after: 'Geo-verified trial evidence, client approves in one click',
    icon: '✅',
  },
];

export default function FmOnboarding({ showToast }) {
  const [expanded, setExpanded] = useState('ob1');
  const [activeStage, setActiveStage] = useState(null);

  return (
    <div className="p-8 space-y-6">
      {/* Impact strip */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ border: '1px solid rgba(79,120,255,0.18)', background: 'rgba(1,8,40,0.6)' }}
      >
        <div
          className="px-5 py-2.5 flex items-center gap-3"
          style={{
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            background: 'rgba(79,120,255,0.06)',
          }}
        >
          <span className="text-[9px] font-black uppercase tracking-widest text-white/30">
            What Cadi replaces
          </span>
          <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
          <span
            className="text-[9px] font-black uppercase tracking-widest"
            style={{ color: '#4f78ff' }}
          >
            With Cadi
          </span>
        </div>
        <div
          className="grid grid-cols-3 divide-x"
          style={{ borderColor: 'rgba(255,255,255,0.06)' }}
        >
          {IMPACT.map(({ before, after, icon }) => (
            <div key={icon} className="px-4 py-3 flex items-start gap-3">
              <span className="text-xl flex-shrink-0 mt-0.5">{icon}</span>
              <div>
                <div className="text-[10px] text-white/30 line-through decoration-white/20 mb-1 leading-snug">
                  {before}
                </div>
                <div className="text-[10px] font-bold leading-snug" style={{ color: '#60a5fa' }}>
                  {after}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="text-white font-black text-xl">New Job Onboarding</div>
          <div className="text-white/40 text-sm mt-0.5">
            From contract to first clean — tracked, automated, done in days
          </div>
        </div>
        <button
          onClick={() => showToast('open the new site onboarding wizard')}
          className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-black text-white transition-all"
          style={{
            background: 'linear-gradient(135deg, #4f78ff, #2d4fd4)',
            boxShadow: '0 4px 20px rgba(79,120,255,0.35)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.filter = 'brightness(1.1)')}
          onMouseLeave={(e) => (e.currentTarget.style.filter = '')}
        >
          <Rocket size={14} />
          Onboard new site
        </button>
      </div>

      {/* Hero comparison */}
      <div className="grid grid-cols-2 gap-4">
        {/* Before */}
        <div
          className="rounded-2xl p-6 relative overflow-hidden"
          style={{ background: 'rgba(194,65,12,0.07)', border: '1px solid rgba(194,65,12,0.2)' }}
        >
          <div
            className="absolute top-4 right-5 text-[64px] font-black leading-none select-none"
            style={{ color: 'rgba(194,65,12,0.08)' }}
          >
            OLD
          </div>
          <div
            className="text-[10px] font-black uppercase tracking-widest mb-2"
            style={{ color: '#C2410C' }}
          >
            Before Cadi
          </div>
          <div className="text-5xl font-black text-white mb-1">
            4–6 <span className="text-3xl">weeks</span>
          </div>
          <div className="text-white/40 text-sm mb-5">manual, fragmented, paper-heavy</div>
          <div className="space-y-3">
            {OLD_STEPS.map((step, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="text-[10px] font-black text-white/25 w-14 shrink-0 pt-0.5">
                  {step.week}
                </div>
                <div className="flex-1">
                  <div className="text-xs font-bold text-white/60">{step.label}</div>
                  <div className="text-[10px] text-white/30 mt-0.5">{step.pain}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* After */}
        <div
          className="rounded-2xl p-6 relative overflow-hidden"
          style={{ background: 'rgba(52,211,153,0.05)', border: '1px solid rgba(52,211,153,0.25)' }}
        >
          <div
            className="absolute top-4 right-5 text-[64px] font-black leading-none select-none"
            style={{ color: 'rgba(52,211,153,0.07)' }}
          >
            CADI
          </div>
          <div className="text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-2">
            With Cadi
          </div>
          <div className="text-5xl font-black text-white mb-1">
            1–2 <span className="text-3xl">weeks</span>
          </div>
          <div className="text-white/40 text-sm mb-5">automated, trackable, evidence-backed</div>
          <div className="space-y-3">
            {STAGES.map((stage, i) => {
              const Icon = stage.icon;
              const days = [
                'Day 1 · 10 min',
                'Day 1 · instant',
                'Day 1–3',
                'Day 2–3 · instant',
                'Day 5–10',
                'Day 7–14',
              ];
              return (
                <button
                  key={stage.id}
                  onClick={() => setActiveStage(activeStage === stage.id ? null : stage.id)}
                  className="w-full flex items-start gap-3 text-left"
                >
                  <div
                    className="text-[10px] font-black w-20 shrink-0 pt-0.5"
                    style={{ color: stage.color }}
                  >
                    {days[i]}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5">
                      <Icon size={11} style={{ color: stage.color }} />
                      <span className="text-xs font-bold text-white/80">{stage.label}</span>
                      {stage.auto && (
                        <span
                          className="text-[8px] font-black px-1.5 py-0.5 rounded-full"
                          style={{
                            background: 'rgba(167,139,250,0.15)',
                            color: '#a78bfa',
                            border: '1px solid rgba(167,139,250,0.25)',
                          }}
                        >
                          AUTO
                        </span>
                      )}
                    </div>
                    {activeStage === stage.id && (
                      <div className="text-[10px] text-white/50 mt-1.5 leading-relaxed">
                        {stage.description}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
          <div className="mt-4 text-[10px] text-white/30 italic">↑ Click any step to expand</div>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-4 gap-4">
        {[
          {
            label: 'Time to first clean',
            value: '~1 week',
            sub: 'vs 4–6 weeks',
            color: '#34d399',
            icon: Clock,
          },
          {
            label: 'Steps automated',
            value: '3 of 6',
            sub: 'zero manual input',
            color: '#a78bfa',
            icon: Zap,
          },
          {
            label: 'Onboardings this month',
            value: '2',
            sub: 'both under 2 weeks',
            color: '#4f78ff',
            icon: Building2,
          },
          {
            label: 'Admin hours saved',
            value: '~18 hrs',
            sub: 'per new site',
            color: '#fbbf24',
            icon: TrendingUp,
          },
        ].map(({ label, value, sub, color, icon: Icon }) => (
          <div
            key={label}
            className="rounded-2xl p-5 relative overflow-hidden"
            style={{
              background: 'rgba(255,255,255,0.05)',
              backdropFilter: 'blur(20px)',
              border: `1px solid ${color}22`,
            }}
          >
            <div className="absolute top-3 right-4 opacity-10">
              <Icon size={30} style={{ color }} />
            </div>
            <div className="text-2xl font-black mb-0.5" style={{ color }}>
              {value}
            </div>
            <div className="text-white/60 text-xs font-bold">{label}</div>
            <div className="text-white/30 text-[10px] mt-0.5">{sub}</div>
          </div>
        ))}
      </div>

      {/* Active onboardings */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="text-white/50 text-xs font-black uppercase tracking-widest">
            Active onboardings
          </div>
          <div className="text-white/25 text-xs">{ACTIVE_ONBOARDINGS.length} in progress</div>
        </div>
        <div className="space-y-3">
          {ACTIVE_ONBOARDINGS.map((ob) => (
            <OnboardingCard
              key={ob.id}
              ob={ob}
              expanded={expanded === ob.id}
              onToggle={() => setExpanded(expanded === ob.id ? null : ob.id)}
              showToast={showToast}
            />
          ))}
        </div>
      </div>

      {/* How it works - 6 step mini guide */}
      <div>
        <div className="text-white/50 text-xs font-black uppercase tracking-widest mb-4">
          How Cadi compresses 6 weeks into 3 days
        </div>
        <div className="grid grid-cols-3 gap-3">
          {STAGES.map((stage, i) => {
            const Icon = stage.icon;
            return (
              <div
                key={stage.id}
                className="rounded-2xl p-5"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: `1px solid ${stage.color}18`,
                }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: `${stage.color}18`, border: `1px solid ${stage.color}30` }}
                  >
                    <Icon size={16} style={{ color: stage.color }} />
                  </div>
                  <div>
                    <div
                      className="text-[10px] font-black uppercase tracking-wider"
                      style={{ color: stage.color }}
                    >
                      Step {i + 1} · {stage.duration}
                    </div>
                    {stage.auto && (
                      <span
                        className="text-[8px] font-black px-1.5 py-0.5 rounded-full"
                        style={{
                          background: 'rgba(167,139,250,0.12)',
                          color: '#a78bfa',
                          border: '1px solid rgba(167,139,250,0.2)',
                        }}
                      >
                        AUTO
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-white font-bold text-sm mb-1.5">{stage.label}</div>
                <div className="text-white/40 text-[11px] leading-relaxed">{stage.description}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
