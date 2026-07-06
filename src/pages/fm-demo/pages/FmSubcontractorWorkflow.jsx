import { useState } from 'react';
import {
  Building2,
  FileText,
  Send,
  CheckSquare,
  MapPin,
  Receipt,
  ThumbsUp,
  Download,
  ChevronRight,
  ArrowRight,
} from 'lucide-react';

const STEPS = [
  {
    id: 1,
    icon: Building2,
    color: '#4f78ff',
    label: 'Client Onboarding',
    actor: 'Britannia Group',
    summary: 'New client contract signed. Sites, schedules and scope recorded.',
    detail: [
      'Client details + contacts captured',
      'Sites mapped with access instructions',
      'Contract value & terms agreed',
      'Client portal access issued',
    ],
    nav: 'client-onboarding',
    navLabel: 'Open Client Onboarding →',
    example: {
      client: 'Luton Borough Council',
      sites: 2,
      value: '£6,800/mo',
      start: '1 Jun 2026',
    },
  },
  {
    id: 2,
    icon: FileText,
    color: '#a78bfa',
    label: 'Split to Job Cards',
    actor: 'Britannia Group',
    summary: 'Contract broken into individual job cards — one per site/area/visit type.',
    detail: [
      'Each work area becomes a discrete job card',
      'Frequency, SLA window & spec attached',
      'Photo requirements defined per card',
      'DBS & compliance requirements set',
    ],
    nav: 'create',
    navLabel: 'Open Contract Builder →',
    example: {
      cards: 4,
      jobs: [
        { ref: '#BF-4500', site: 'Luton Central Library', window: '18:00–20:00', freq: 'Mon–Fri' },
        { ref: '#BF-4501', site: 'Luton Town Hall', window: '07:00–09:00', freq: 'Mon–Fri' },
      ],
    },
  },
  {
    id: 3,
    icon: Send,
    color: '#60a5fa',
    label: 'Dispatch to Connect',
    actor: 'Britannia Group',
    summary: 'Job cards pushed to the Cadi Connect network. Matched cleaners notified instantly.',
    detail: [
      'Jobs matched to cleaners by score, location & specialism',
      'Push notification sent to eligible operatives',
      'Expiry window set (e.g. 48 hrs to respond)',
      'Fallback dispatch if first choice declines',
    ],
    nav: 'cadi-connect',
    navLabel: 'Open Cadi Connect →',
    example: {
      matched: 6,
      notified: 6,
      topMatch: 'Priya N.',
      matchScore: 94,
    },
  },
  {
    id: 4,
    icon: CheckSquare,
    color: '#34d399',
    label: 'Cleaner Accepts / Declines',
    actor: 'Contractor',
    summary: 'Cleaner reviews job details, rate and schedule — accepts or declines.',
    detail: [
      'Full job spec, site access notes & SLA visible',
      'Rate per visit shown upfront',
      'Cleaner accepts → added to their schedule',
      'Decline triggers re-dispatch to next match',
    ],
    portal: 'connect',
    portalLabel: 'View Cleaner Portal →',
    example: {
      cleaner: 'Priya N.',
      decision: 'Accepted',
      jobs: ['#BF-4500 Luton Library', '#BF-4501 Town Hall'],
      confirmedAt: 'Today 09:14',
    },
  },
  {
    id: 5,
    icon: MapPin,
    color: '#fbbf24',
    label: 'Complete Work + Geo Evidence',
    actor: 'Contractor',
    summary: 'Cleaner clocks on-site, completes work and uploads geo-stamped photos.',
    detail: [
      'GPS clock-in confirms on-site presence',
      'Before & after photos uploaded via app',
      'Checklist completed per job card spec',
      'Any issues flagged in real-time',
    ],
    portal: 'connect',
    portalLabel: 'View Completion Screen →',
    example: {
      site: 'Luton Central Library',
      clockIn: '17:58',
      clockOut: '20:02',
      photos: 4,
      status: 'Complete',
    },
  },
  {
    id: 6,
    icon: Receipt,
    color: '#fb923c',
    label: 'Submit Invoice',
    actor: 'Contractor',
    summary: 'Cleaner submits invoice for completed work. Auto-generated from accepted jobs.',
    detail: [
      'Invoice pre-populated from completed job cards',
      'Cleaner reviews line items + total',
      'Geo-stamp & evidence attached automatically',
      'Submitted to Britannia Group inbox',
    ],
    portal: 'connect',
    portalLabel: 'View Invoice Screen →',
    example: {
      inv: 'INV-0043',
      lines: 2,
      net: '£294.17',
      vat: '£58.83',
      total: '£353.00',
      submittedAt: '20 May 09:30',
    },
  },
  {
    id: 7,
    icon: ThumbsUp,
    color: '#4ade80',
    label: 'FM Review & Approval',
    actor: 'Britannia Group',
    summary:
      'Invoice lands in the FM accounts inbox. Geo evidence reviewed. Approved, queried or rejected.',
    detail: [
      'Evidence photos reviewed alongside invoice',
      'Approve → moves to export queue',
      'Query → message sent to cleaner with reason',
      'Reject → cleaner notified + dispute flow opens',
    ],
    nav: 'accounts',
    navLabel: 'Open Accounts Inbox →',
    example: {
      inv: 'INV-0043',
      reviewer: 'James Harper',
      decision: 'Approved',
      at: '20 May 11:05',
      exportReady: true,
    },
  },
  {
    id: 8,
    icon: Download,
    color: '#38bdf8',
    label: 'Export to Accounts',
    actor: 'Britannia Group',
    summary: 'Approved invoice exported to Xero, Sage or QuickBooks. Cleaner payment triggered.',
    detail: [
      'One-click export to Xero / Sage / QuickBooks',
      'Invoice ref, PO and line items mapped automatically',
      'Payment instruction created in accounting system',
      'Cleaner notified: "Payment in progress"',
    ],
    nav: 'accounts',
    navLabel: 'Open Export Queue →',
    example: {
      exported: 'Xero',
      ref: 'XERO-8841',
      paymentDue: '3 Jun 2026',
      amount: '£353.00',
    },
  },
];

function StepCard({ step, active, onClick }) {
  const Icon = step.icon;
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-2xl p-4 transition-all"
      style={{
        background: active
          ? `linear-gradient(135deg, ${step.color}18, ${step.color}08)`
          : 'rgba(255,255,255,0.03)',
        border: `1px solid ${active ? step.color + '50' : 'rgba(255,255,255,0.07)'}`,
        boxShadow: active ? `0 0 20px ${step.color}15` : 'none',
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
          style={{ background: `${step.color}20`, border: `1px solid ${step.color}35` }}
        >
          <Icon size={15} style={{ color: step.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span
              className="text-[10px] font-black px-1.5 py-0.5 rounded-full"
              style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.35)' }}
            >
              STEP {step.id}
            </span>
            <span
              className="text-[10px] font-bold"
              style={{ color: step.actor === 'Britannia Group' ? '#4f78ff' : '#fbbf24' }}
            >
              {step.actor}
            </span>
          </div>
          <div className="text-sm font-black text-white leading-tight">{step.label}</div>
          {active && (
            <div className="text-[11px] text-white/45 mt-1 leading-relaxed">{step.summary}</div>
          )}
        </div>
        <ChevronRight
          size={14}
          style={{
            color: active ? step.color : 'rgba(255,255,255,0.15)',
            transform: active ? 'rotate(90deg)' : 'none',
            transition: 'transform 0.2s',
            marginTop: 4,
          }}
        />
      </div>
    </button>
  );
}

function DetailPanel({ step, onNavigate }) {
  const Icon = step.icon;

  return (
    <div
      className="rounded-2xl p-6 h-full"
      style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${step.color}30` }}
    >
      {/* Header */}
      <div className="flex items-center gap-4 mb-5">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
          style={{ background: `${step.color}20`, border: `1px solid ${step.color}40` }}
        >
          <Icon size={22} style={{ color: step.color }} />
        </div>
        <div>
          <div
            className="text-[10px] font-black uppercase tracking-widest mb-0.5"
            style={{ color: step.actor === 'Britannia Group' ? '#4f78ff' : '#fbbf24' }}
          >
            Step {step.id} · {step.actor}
          </div>
          <div className="text-white font-black text-lg leading-tight">{step.label}</div>
        </div>
      </div>

      <p className="text-sm text-white/50 leading-relaxed mb-5">{step.summary}</p>

      {/* What happens */}
      <div className="mb-5">
        <div className="text-[10px] font-black uppercase tracking-widest text-white/25 mb-3">
          What happens
        </div>
        <div className="space-y-2">
          {step.detail.map((d, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <div
                className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                style={{ background: step.color }}
              />
              <span className="text-sm text-white/60">{d}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Example data */}
      <div
        className="rounded-xl p-4 mb-5"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        <div className="text-[10px] font-black uppercase tracking-widest text-white/25 mb-3">
          Example data
        </div>
        <div className="space-y-1.5">
          {Object.entries(step.example).map(([k, v]) => {
            if (Array.isArray(v))
              return (
                <div key={k}>
                  {v.map((item, i) =>
                    typeof item === 'object' ? (
                      <div
                        key={i}
                        className="flex items-center gap-2 py-1 border-b border-white/5 last:border-0"
                      >
                        <span className="text-[10px] font-black text-white/35 w-16 shrink-0">
                          {item.ref}
                        </span>
                        <span className="text-xs text-white/60 flex-1 truncate">{item.site}</span>
                        <span className="text-[10px] text-white/30">{item.window}</span>
                      </div>
                    ) : (
                      <div key={i} className="flex items-center gap-2">
                        <div
                          className="w-1 h-1 rounded-full shrink-0"
                          style={{ background: step.color }}
                        />
                        <span className="text-xs text-white/55">{item}</span>
                      </div>
                    )
                  )}
                </div>
              );
            const label = k
              .replace(/([A-Z])/g, ' $1')
              .replace(/_/g, ' ')
              .toLowerCase();
            return (
              <div key={k} className="flex items-center justify-between">
                <span className="text-[11px] text-white/30 capitalize">{label}</span>
                <span className="text-[11px] font-bold text-white/70">{String(v)}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Nav buttons */}
      {step.nav && (
        <button
          onClick={() => onNavigate(step.nav)}
          className="w-full py-2.5 rounded-xl text-sm font-black transition-all"
          style={{
            background: `${step.color}20`,
            border: `1px solid ${step.color}40`,
            color: step.color,
          }}
        >
          {step.navLabel}
        </button>
      )}
      {step.portal && (
        <button
          onClick={() => window.open('/connect', '_blank')}
          className="w-full py-2.5 rounded-xl text-sm font-black transition-all mt-2"
          style={{
            background: 'rgba(251,191,36,0.1)',
            border: '1px solid rgba(251,191,36,0.3)',
            color: '#fbbf24',
          }}
        >
          {step.portalLabel}
        </button>
      )}
    </div>
  );
}

export default function FmContractorWorkflow({ onNavigate }) {
  const [activeStep, setActiveStep] = useState(1);
  const active = STEPS.find((s) => s.id === activeStep);

  return (
    <div className="p-6 max-w-6xl space-y-5">
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
          {[
            {
              before: 'Contractor jobs coordinated over WhatsApp and email',
              after: 'Full digital workflow — brief, evidence, invoice all in one place',
              icon: '📲',
            },
            {
              before: 'Evidence and invoice arrive separately, matched manually',
              after: 'Invoice only unlocks once geo-verified evidence is submitted',
              icon: '🔒',
            },
            {
              before: 'IR35 and compliance managed informally — risk buried',
              after: 'Route flagged, compliance docs collected before a shift starts',
              icon: '⚖️',
            },
          ].map(({ before, after, icon }) => (
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
      <div
        className="rounded-2xl p-5 mb-6"
        style={{
          background: 'linear-gradient(135deg, rgba(79,120,255,0.1), rgba(52,211,153,0.06))',
          border: '1px solid rgba(79,120,255,0.2)',
        }}
      >
        <div className="flex items-center gap-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
            style={{
              background: 'rgba(79,120,255,0.2)',
              border: '1px solid rgba(79,120,255,0.35)',
            }}
          >
            🔗
          </div>
          <div>
            <div className="text-white font-black text-base">
              Contractor Workflow — Cadi Connect
            </div>
            <div className="text-white/45 text-xs mt-0.5">
              End-to-end flow from client onboarding through to invoice export · subcontracted
              cleaners via Cadi Connect
            </div>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div className="text-center">
              <div className="text-lg font-black text-white">8</div>
              <div className="text-[10px] text-white/30">steps</div>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div className="text-center">
              <div className="text-lg font-black" style={{ color: '#4f78ff' }}>
                3
              </div>
              <div className="text-[10px] text-white/30">portals</div>
            </div>
          </div>
        </div>

        {/* Actor legend */}
        <div className="flex items-center gap-4 mt-4 pt-4 border-t border-white/5">
          <span className="text-[10px] text-white/25 uppercase tracking-widest font-black">
            Actor key
          </span>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-[#4f78ff]" />
            <span className="text-[11px] text-white/50 font-bold">
              Britannia Group — Ops Portal
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-[#fbbf24]" />
            <span className="text-[11px] text-white/50 font-bold">Contractor — Cadi Connect</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-[#a78bfa]" />
            <span className="text-[11px] text-white/50 font-bold">Client — Client Portal</span>
          </div>
        </div>
      </div>

      {/* Pipeline bar */}
      <div className="flex items-center gap-0 mb-6 overflow-x-auto pb-1">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const isActive = s.id === activeStep;
          return (
            <div key={s.id} className="flex items-center shrink-0">
              <button
                onClick={() => setActiveStep(s.id)}
                className="flex flex-col items-center gap-1.5 px-2 group"
                style={{ minWidth: 72 }}
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center transition-all"
                  style={{
                    background: isActive ? s.color : 'rgba(255,255,255,0.06)',
                    border: `1px solid ${isActive ? s.color : 'rgba(255,255,255,0.1)'}`,
                    boxShadow: isActive ? `0 0 16px ${s.color}50` : 'none',
                  }}
                >
                  <Icon size={16} style={{ color: isActive ? 'white' : s.color }} />
                </div>
                <span
                  className="text-[9px] font-black text-center leading-tight"
                  style={{ color: isActive ? s.color : 'rgba(255,255,255,0.25)', maxWidth: 60 }}
                >
                  {s.label}
                </span>
              </button>
              {i < STEPS.length - 1 && (
                <ArrowRight
                  size={12}
                  style={{ color: 'rgba(255,255,255,0.12)', margin: '0 -2px', flexShrink: 0 }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Main layout: step list + detail */}
      <div className="grid grid-cols-5 gap-4">
        {/* Step list */}
        <div className="col-span-2 space-y-2">
          {STEPS.map((step) => (
            <StepCard
              key={step.id}
              step={step}
              active={activeStep === step.id}
              onClick={() => setActiveStep(step.id)}
              onNavigate={onNavigate}
            />
          ))}
        </div>

        {/* Detail panel */}
        <div className="col-span-3">
          <DetailPanel step={active} onNavigate={onNavigate} />
        </div>
      </div>
    </div>
  );
}
