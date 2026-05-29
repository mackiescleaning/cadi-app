import { useState } from 'react';
import {
  PlusCircle, Smartphone, MapPin, CheckSquare, ThumbsUp,
  PoundSterling, Star, TrendingUp, ArrowDown, Zap,
} from 'lucide-react';

const STEPS = [
  {
    id: 'create',
    side: 'fm',
    icon: PlusCircle,
    label: 'FM creates a job',
    sub: 'Britannia ops team opens Job Board, creates a contract for Next – Luton The Mall — site details, frequency, spec.',
    detail: 'Job ref BF-2026-0081 · Next – Luton The Mall · Daily M–Sat 06:00–08:00 · £92/visit',
    color: '#4f78ff',
  },
  {
    id: 'pipeline',
    side: 'cleaner',
    icon: Smartphone,
    label: 'Appears in cleaner\'s pipeline',
    sub: 'The job instantly lands in the cleaner\'s Cadi Connect app — no phone call, no WhatsApp group.',
    detail: 'Sarah Mitchell sees it in Job Pipeline · 2 min after creation · Match score 94',
    color: '#a78bfa',
  },
  {
    id: 'geo',
    side: 'cleaner',
    icon: MapPin,
    label: 'Geo-verified completion',
    sub: 'Cleaner checks in on site, completes the job, uploads before/after photos — each timestamped and GPS-locked.',
    detail: '52.13618, -0.46008 · ±4m · 7 photos · SHA-256 tamper-evident · 07:58 check-out',
    color: '#34d399',
  },
  {
    id: 'qa',
    side: 'fm',
    icon: CheckSquare,
    label: 'Evidence lands in QA Queue',
    sub: 'Photos and geo-stamp automatically appear in the FM portal QA Queue — no chasing, no email attachments.',
    detail: 'BF-2026-0081 · 7 photos · geo-verified · awaiting FM sign-off',
    color: '#fbbf24',
  },
  {
    id: 'approve',
    side: 'fm',
    icon: ThumbsUp,
    label: 'FM approves the visit',
    sub: 'One click in QA Queue confirms the visit. Evidence is locked to the client compliance record.',
    detail: 'Approved by James Harper · 09:14 · evidence archived to Next – Luton The Mall record',
    color: '#4f78ff',
  },
  {
    id: 'earnings',
    side: 'cleaner',
    icon: PoundSterling,
    label: 'Earnings updated automatically',
    sub: 'The cleaner\'s Earnings tab updates — £92 moves from "pending review" to "awaiting payment".',
    detail: 'Britannia Group · £92 · ref BF-PAY-0089 · Net 14 · 22 May 2026',
    color: '#34d399',
  },
  {
    id: 'rating',
    side: 'fm',
    icon: Star,
    label: 'FM rates the visit',
    sub: 'Quick quality rating from the FM feeds directly into the cleaner\'s Cadi Score — transparent, trackable.',
    detail: '5 stars · "On time, excellent photos, no issues raised" · Britannia Group',
    color: '#fbbf24',
  },
  {
    id: 'score',
    side: 'cleaner',
    icon: TrendingUp,
    label: 'Cadi Score improves → more matches',
    sub: 'Higher score = higher position in the FM job-match algorithm. Better cleaners get better jobs, automatically.',
    detail: 'Sarah Mitchell · Score 94 → 96 · "Elite" tier · 3 new job matches unlocked',
    color: '#4f78ff',
  },
];

const LIVE_EVENTS = [
  { time: '06:01', event: 'Sarah checked in at Next – Luton The Mall', type: 'geo',    icon: MapPin      },
  { time: '06:04', event: 'Before photo 1 of 3 uploaded',          type: 'photo',  icon: Zap         },
  { time: '07:58', event: 'After photos submitted — 4 of 4',       type: 'photo',  icon: Zap         },
  { time: '07:59', event: 'Geo check-out locked · ±4m accuracy',   type: 'geo',    icon: MapPin      },
  { time: '08:01', event: 'Job BF-2026-0081 entered QA Queue',      type: 'qa',     icon: CheckSquare },
  { time: '09:14', event: 'Approved by James Harper',               type: 'approve',icon: ThumbsUp    },
  { time: '09:14', event: 'Earnings updated — £92 pending payment', type: 'pay',    icon: PoundSterling },
  { time: '09:15', event: 'Cadi Score updated: 94 → 96',           type: 'score',  icon: TrendingUp  },
];

const EVENT_COLORS = {
  geo:    { color: '#34d399', bg: 'rgba(52,211,153,0.1)',  border: 'rgba(52,211,153,0.25)'  },
  photo:  { color: '#a78bfa', bg: 'rgba(167,139,250,0.1)', border: 'rgba(167,139,250,0.25)' },
  qa:     { color: '#fbbf24', bg: 'rgba(251,191,36,0.1)',  border: 'rgba(251,191,36,0.25)'  },
  approve:{ color: '#4f78ff', bg: 'rgba(79,120,255,0.1)',  border: 'rgba(79,120,255,0.25)'  },
  pay:    { color: '#34d399', bg: 'rgba(52,211,153,0.1)',  border: 'rgba(52,211,153,0.25)'  },
  score:  { color: '#4f78ff', bg: 'rgba(79,120,255,0.1)',  border: 'rgba(79,120,255,0.25)'  },
};

function StepCard({ step, index, active, onClick }) {
  const Icon = step.icon;
  const isFm = step.side === 'fm';
  return (
    <div className={`flex gap-4 ${isFm ? 'flex-row' : 'flex-row-reverse'}`}>
      {/* Connector line + dot */}
      <div className="flex flex-col items-center shrink-0" style={{ width: 40 }}>
        {index > 0 && <div className="w-px flex-1 min-h-6" style={{ background: 'rgba(255,255,255,0.08)' }} />}
        <button
          onClick={onClick}
          className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 transition-all"
          style={{
            background: active ? `rgba(${step.color === '#4f78ff' ? '79,120,255' : step.color === '#a78bfa' ? '167,139,250' : step.color === '#34d399' ? '52,211,153' : '251,191,36'},0.25)` : 'rgba(255,255,255,0.07)',
            border: `1px solid ${active ? step.color : 'rgba(255,255,255,0.12)'}`,
            boxShadow: active ? `0 0 16px ${step.color}33` : 'none',
          }}>
          <Icon size={16} style={{ color: active ? step.color : 'rgba(255,255,255,0.3)' }} />
        </button>
        <div className="w-px flex-1 min-h-6" style={{ background: 'rgba(255,255,255,0.08)' }} />
      </div>

      {/* Card */}
      <button
        onClick={onClick}
        className="flex-1 mb-3 p-4 rounded-2xl text-left transition-all"
        style={{
          background: active ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.03)',
          border: active ? `1px solid ${step.color}55` : '1px solid rgba(255,255,255,0.07)',
        }}>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest"
            style={{ background: isFm ? 'rgba(79,120,255,0.15)' : 'rgba(167,139,250,0.15)', color: isFm ? '#4f78ff' : '#a78bfa' }}>
            {isFm ? 'FM Portal' : 'Cleaner App'}
          </span>
        </div>
        <div className="text-white font-bold text-sm">{step.label}</div>
        <div className="text-white/45 text-xs mt-1 leading-relaxed">{step.sub}</div>
        {active && (
          <div className="mt-3 px-3 py-2 rounded-xl text-[10px] font-mono text-white/50 leading-relaxed"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
            {step.detail}
          </div>
        )}
      </button>

      {/* Spacer for opposite side */}
      <div style={{ width: 40 }} className="shrink-0" />
    </div>
  );
}

export default function FmHowItConnects() {
  const [activeStep, setActiveStep] = useState(null);

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Left: flow diagram ── */}
      <div className="flex-1 overflow-y-auto px-8 py-6" style={{ borderRight: '1px solid rgba(255,255,255,0.07)' }}>

        {/* Legend */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-[#4f78ff]" />
            <span className="text-white/40 text-xs font-bold">FM Portal (Britannia ops)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-[#a78bfa]" />
            <span className="text-white/40 text-xs font-bold">Cleaner App (Cadi Connect)</span>
          </div>
          <div className="ml-auto text-white/25 text-xs">Click any step for detail</div>
        </div>

        {/* Steps */}
        <div className="space-y-0">
          {STEPS.map((step, i) => (
            <StepCard
              key={step.id}
              step={step}
              index={i}
              active={activeStep === step.id}
              onClick={() => setActiveStep(activeStep === step.id ? null : step.id)}
            />
          ))}
        </div>

        {/* Loop arrow */}
        <div className="flex items-center gap-3 px-4 py-3 rounded-2xl mt-2"
          style={{ background: 'rgba(79,120,255,0.08)', border: '1px solid rgba(79,120,255,0.2)' }}>
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(79,120,255,0.15)' }}>
            <TrendingUp size={14} style={{ color: '#4f78ff' }} />
          </div>
          <div>
            <div className="text-white/70 text-xs font-bold">Flywheel effect</div>
            <div className="text-white/35 text-[10px] mt-0.5">Higher Cadi Score → more job matches → more completions → higher score. The platform rewards reliable cleaners automatically.</div>
          </div>
        </div>
      </div>

      {/* ── Right: live event log ── */}
      <div className="w-80 flex-shrink-0 overflow-y-auto px-5 py-6">
        <div className="text-white/35 text-[10px] font-black uppercase tracking-widest mb-4">Live event log</div>
        <div className="mb-3 px-3 py-2 rounded-xl text-xs text-white/40" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
          Next – Luton The Mall · BF-2026-0081 · Today
        </div>

        <div className="space-y-2">
          {LIVE_EVENTS.map((ev, i) => {
            const Icon = ev.icon;
            const style = EVENT_COLORS[ev.type];
            return (
              <div key={i} className="flex items-start gap-3 p-3 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: style.bg, border: `1px solid ${style.border}` }}>
                  <Icon size={12} style={{ color: style.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-white/65 text-xs leading-snug">{ev.event}</div>
                  <div className="text-white/25 text-[10px] mt-0.5">{ev.time}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Data stats */}
        <div className="mt-5 space-y-2">
          <div className="text-white/35 text-[10px] font-black uppercase tracking-widest mb-3">This visit — data generated</div>
          {[
            { label: 'GPS coordinates', value: '4 points' },
            { label: 'Photos uploaded', value: '7' },
            { label: 'Hash records', value: '8' },
            { label: 'Audit trail entries', value: '12' },
            { label: 'Time on site', value: '1h 57m' },
            { label: 'FM actions required', value: '1 click' },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between px-3 py-2 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <span className="text-white/40 text-[11px]">{label}</span>
              <span className="text-white font-bold text-[11px]">{value}</span>
            </div>
          ))}
        </div>

        {/* Vs before */}
        <div className="mt-5 rounded-2xl p-4" style={{ background: 'rgba(194,65,12,0.08)', border: '1px solid rgba(194,65,12,0.2)' }}>
          <div className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: '#C2410C' }}>Before Cadi</div>
          <div className="space-y-1.5 text-[11px] text-white/45 leading-relaxed">
            <div>→ Paper sheets faxed / emailed</div>
            <div>→ Manual 4-weekly KPI audits</div>
            <div>→ FM chases cleaner by phone</div>
            <div>→ No geo-proof for client disputes</div>
            <div>→ Pay calculated from spreadsheet</div>
          </div>
        </div>
      </div>
    </div>
  );
}
