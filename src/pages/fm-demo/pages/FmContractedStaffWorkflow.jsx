import { useState } from 'react';
import {
  Building2, CalendarDays, UserCheck, MapPin, Camera,
  Clock, ClipboardCheck, DollarSign, ChevronRight, ArrowRight,
} from 'lucide-react';

const STEPS = [
  {
    id: 1,
    icon: Building2,
    color: '#4f78ff',
    label: 'Client Contract & Schedule',
    actor: 'Britannia Group',
    summary: 'Client contract converted into a standing schedule — sites, frequencies and shifts defined.',
    detail: [
      'Client sites and work areas mapped',
      'Shift windows set per site (e.g. 06:00–08:00)',
      'Recurring schedule generated from contract',
      'Cleaning spec attached per area',
    ],
    nav: 'create',
    navLabel: 'Open Contract Builder →',
    example: {
      client: 'Next Retail UK Ltd',
      sites: 3,
      shiftsPerWeek: 15,
      value: '£5,400/mo',
    },
  },
  {
    id: 2,
    icon: CalendarDays,
    color: '#a78bfa',
    label: 'Assign to Staff Rota',
    actor: 'Britannia Group',
    summary: 'Shifts assigned to contracted staff. Manager builds the rota and confirms coverage.',
    detail: [
      'Shifts drag-dropped onto staff rota',
      'Contracted hours checked against contract',
      'Coverage gaps flagged automatically',
      'Staff notified via the app',
    ],
    nav: 'workforce',
    navLabel: 'Open FM Workforce →',
    example: {
      assignedTo: 'Marcus T.',
      shifts: 5,
      hoursPerWeek: 10,
      rostaConfirmed: 'Yes',
    },
  },
  {
    id: 3,
    icon: UserCheck,
    color: '#60a5fa',
    label: 'Staff Views Schedule',
    actor: 'Contracted Staff',
    summary: 'Staff member sees their upcoming shifts in the app. All site details and specs visible.',
    detail: [
      'Weekly schedule visible in staff app',
      'Site address, access notes and parking info',
      'Cleaning spec and checklist pre-loaded',
      'Contact for on-site supervisor shown',
    ],
    portalLabel: 'View Staff Portal →',
    example: {
      staff: 'Marcus T.',
      upcomingShifts: 5,
      nextShift: 'Tomorrow 06:00',
      site: 'Next – Luton The Mall',
    },
  },
  {
    id: 4,
    icon: MapPin,
    color: '#34d399',
    label: 'Clock In — Geo Verified',
    actor: 'Contracted Staff',
    summary: 'Staff clocks in on arrival. GPS confirms they are on-site within the SLA window.',
    detail: [
      'GPS clock-in records exact arrival time',
      'Geo-fence check confirms staff on correct site',
      'Late arrival triggers ops manager alert',
      'Clock-in data feeds into timesheet automatically',
    ],
    portalLabel: 'View Staff Portal →',
    example: {
      staff: 'Marcus T.',
      site: 'Next – Luton The Mall',
      clockIn: '05:57',
      slaWindow: '06:00–08:00',
      status: 'On time ✓',
    },
  },
  {
    id: 5,
    icon: Camera,
    color: '#fbbf24',
    label: 'Complete Work + Evidence',
    actor: 'Contracted Staff',
    summary: 'Staff works through the cleaning spec, ticks off checklist and uploads evidence photos.',
    detail: [
      'Checklist completed area by area',
      'Before & after photos uploaded',
      'Any damage, access or supply issues logged',
      'Issue photos sent directly to ops manager',
    ],
    portalLabel: 'View Completion Screen →',
    example: {
      site: 'Next – Luton The Mall',
      checklistItems: 12,
      completed: 12,
      photosTaken: 6,
      issuesFlagged: 0,
    },
  },
  {
    id: 6,
    icon: Clock,
    color: '#fb923c',
    label: 'Clock Out + Timesheet',
    actor: 'Contracted Staff',
    summary: 'Staff clocks out. Hours auto-logged to timesheet. Overtime or anomalies flagged.',
    detail: [
      'Clock-out recorded with GPS',
      'Hours calculated: clock-in to clock-out',
      'Overtime (beyond contracted hours) flagged',
      'Timesheet submitted to manager for review',
    ],
    portalLabel: 'View Staff Portal →',
    example: {
      clockOut: '07:52',
      hoursWorked: '1h 55m',
      contractedHours: '2h 00m',
      timesheetStatus: 'Submitted',
    },
  },
  {
    id: 7,
    icon: ClipboardCheck,
    color: '#4ade80',
    label: 'Manager Approves Hours',
    actor: 'Britannia Group',
    summary: 'Manager reviews timesheet alongside evidence. Approves, queries or adjusts hours.',
    detail: [
      'Timesheet line items shown against shift plan',
      'Evidence photos viewable alongside hours',
      'Approve → passes to payroll queue',
      'Query → message sent to staff member',
    ],
    nav: 'workforce',
    navLabel: 'Open FM Workforce →',
    example: {
      staff: 'Marcus T.',
      weekEnding: '24 May 2026',
      hoursApproved: '10h 00m',
      approvedBy: 'James Harper',
      status: 'Approved ✓',
    },
  },
  {
    id: 8,
    icon: DollarSign,
    color: '#38bdf8',
    label: 'Payroll Export',
    actor: 'Britannia Group',
    summary: 'Approved hours exported to payroll. Pay calculated from contracted rate + any overtime.',
    detail: [
      'Approved timesheets bundled for payroll period',
      'Export to Sage Payroll, Xero Payroll or CSV',
      'Contracted rate × hours = gross pay calculated',
      'Staff notified: pay date confirmed',
    ],
    nav: 'accounts',
    navLabel: 'Open Accounts →',
    example: {
      payPeriod: 'May 2026',
      staff: 'Marcus T.',
      hoursExported: '43h 30m',
      grossPay: '£652.50',
      exportTo: 'Sage Payroll',
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
        <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
          style={{ background: `${step.color}20`, border: `1px solid ${step.color}35` }}>
          <Icon size={15} style={{ color: step.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full"
              style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.35)' }}>
              STEP {step.id}
            </span>
            <span className="text-[10px] font-bold"
              style={{ color: step.actor === 'Britannia Group' ? '#4f78ff' : '#fbbf24' }}>
              {step.actor}
            </span>
          </div>
          <div className="text-sm font-black text-white leading-tight">{step.label}</div>
          {active && (
            <div className="text-[11px] text-white/45 mt-1 leading-relaxed">{step.summary}</div>
          )}
        </div>
        <ChevronRight size={14} style={{ color: active ? step.color : 'rgba(255,255,255,0.15)', transform: active ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s', marginTop: 4 }} />
      </div>
    </button>
  );
}

function DetailPanel({ step, onNavigate }) {
  const Icon = step.icon;

  return (
    <div className="rounded-2xl p-6 h-full"
      style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${step.color}30` }}>

      <div className="flex items-center gap-4 mb-5">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
          style={{ background: `${step.color}20`, border: `1px solid ${step.color}40` }}>
          <Icon size={22} style={{ color: step.color }} />
        </div>
        <div>
          <div className="text-[10px] font-black uppercase tracking-widest mb-0.5"
            style={{ color: step.actor === 'Britannia Group' ? '#4f78ff' : '#fbbf24' }}>
            Step {step.id} · {step.actor}
          </div>
          <div className="text-white font-black text-lg leading-tight">{step.label}</div>
        </div>
      </div>

      <p className="text-sm text-white/50 leading-relaxed mb-5">{step.summary}</p>

      <div className="mb-5">
        <div className="text-[10px] font-black uppercase tracking-widest text-white/25 mb-3">What happens</div>
        <div className="space-y-2">
          {step.detail.map((d, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: step.color }} />
              <span className="text-sm text-white/60">{d}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl p-4 mb-5"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="text-[10px] font-black uppercase tracking-widest text-white/25 mb-3">Example data</div>
        <div className="space-y-1.5">
          {Object.entries(step.example).map(([k, v]) => {
            const label = k.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').toLowerCase();
            return (
              <div key={k} className="flex items-center justify-between">
                <span className="text-[11px] text-white/30 capitalize">{label}</span>
                <span className="text-[11px] font-bold text-white/70">{String(v)}</span>
              </div>
            );
          })}
        </div>
      </div>

      {step.nav && (
        <button
          onClick={() => onNavigate(step.nav)}
          className="w-full py-2.5 rounded-xl text-sm font-black transition-all"
          style={{ background: `${step.color}20`, border: `1px solid ${step.color}40`, color: step.color }}>
          {step.navLabel}
        </button>
      )}
      {step.portalLabel && (
        <button
          onClick={() => window.open('/staff', '_blank')}
          className="w-full py-2.5 rounded-xl text-sm font-black transition-all mt-2"
          style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)', color: '#fbbf24' }}>
          {step.portalLabel}
        </button>
      )}
    </div>
  );
}

export default function FmContractedStaffWorkflow({ onNavigate }) {
  const [activeStep, setActiveStep] = useState(1);
  const active = STEPS.find(s => s.id === activeStep);

  return (
    <div className="p-6 max-w-6xl space-y-5">

      {/* Impact strip */}
      <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(79,120,255,0.18)', background: 'rgba(1,8,40,0.6)' }}>
        <div className="px-5 py-2.5 flex items-center gap-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(79,120,255,0.06)' }}>
          <span className="text-[9px] font-black uppercase tracking-widest text-white/30">What Cadi replaces</span>
          <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
          <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: '#4f78ff' }}>With Cadi</span>
        </div>
        <div className="grid grid-cols-3 divide-x" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          {[
            { before: 'Rota managed in spreadsheets, shared by WhatsApp', after: 'Contracted staff schedules managed and delivered inside Cadi', icon: '📅' },
            { before: 'Absence discovered when cleaner does not show — client complains', after: 'Absence triggers instant cover request — gap filled before SLA breach', icon: '⏱' },
            { before: 'Hours and payroll tracked separately with no job audit trail', after: 'Hours auto-logged against job cards — payroll-ready at month end', icon: '💷' },
          ].map(({ before, after, icon }) => (
            <div key={icon} className="px-4 py-3 flex items-start gap-3">
              <span className="text-xl flex-shrink-0 mt-0.5">{icon}</span>
              <div><div className="text-[10px] text-white/30 line-through decoration-white/20 mb-1 leading-snug">{before}</div>
              <div className="text-[10px] font-bold leading-snug" style={{ color: '#60a5fa' }}>{after}</div></div>
            </div>
          ))}
        </div>
      </div>

      {/* Header */}
      <div className="rounded-2xl p-5 mb-6"
        style={{ background: 'linear-gradient(135deg, rgba(251,191,36,0.08), rgba(79,120,255,0.06))', border: '1px solid rgba(251,191,36,0.2)' }}>
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
            style={{ background: 'rgba(251,191,36,0.2)', border: '1px solid rgba(251,191,36,0.35)' }}>
            👷
          </div>
          <div>
            <div className="text-white font-black text-base">Contracted Staff Workflow</div>
            <div className="text-white/45 text-xs mt-0.5">
              End-to-end flow for employed / PAYE staff · contract → rota → clock-in → timesheet → payroll
            </div>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div className="text-center">
              <div className="text-lg font-black text-white">8</div>
              <div className="text-[10px] text-white/30">steps</div>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div className="text-center">
              <div className="text-lg font-black" style={{ color: '#fbbf24' }}>No invoice</div>
              <div className="text-[10px] text-white/30">timesheets only</div>
            </div>
          </div>
        </div>

        {/* Key differences vs subcontractor */}
        <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-white/5">
          {[
            { label: 'Assignment', sub: 'Direct — no accept/deny', color: '#34d399' },
            { label: 'Payment', sub: 'Payroll — not invoice', color: '#fbbf24' },
            { label: 'Time tracking', sub: 'Clock-in/out + timesheet', color: '#60a5fa' },
          ].map(({ label, sub, color }) => (
            <div key={label} className="rounded-xl px-3 py-2.5"
              style={{ background: `${color}0f`, border: `1px solid ${color}25` }}>
              <div className="text-xs font-black mb-0.5" style={{ color }}>{label}</div>
              <div className="text-[10px] text-white/40">{sub}</div>
            </div>
          ))}
        </div>

        {/* Actor legend */}
        <div className="flex items-center gap-4 mt-4 pt-4 border-t border-white/5">
          <span className="text-[10px] text-white/25 uppercase tracking-widest font-black">Actor key</span>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-[#4f78ff]" />
            <span className="text-[11px] text-white/50 font-bold">Britannia Group — Ops Portal</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-[#fbbf24]" />
            <span className="text-[11px] text-white/50 font-bold">Contracted Staff — Staff App</span>
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
                style={{ minWidth: 72 }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center transition-all"
                  style={{
                    background: isActive ? s.color : 'rgba(255,255,255,0.06)',
                    border: `1px solid ${isActive ? s.color : 'rgba(255,255,255,0.1)'}`,
                    boxShadow: isActive ? `0 0 16px ${s.color}50` : 'none',
                  }}>
                  <Icon size={16} style={{ color: isActive ? 'white' : s.color }} />
                </div>
                <span className="text-[9px] font-black text-center leading-tight"
                  style={{ color: isActive ? s.color : 'rgba(255,255,255,0.25)', maxWidth: 60 }}>
                  {s.label}
                </span>
              </button>
              {i < STEPS.length - 1 && (
                <ArrowRight size={12} style={{ color: 'rgba(255,255,255,0.12)', margin: '0 -2px', flexShrink: 0 }} />
              )}
            </div>
          );
        })}
      </div>

      {/* Main layout */}
      <div className="grid grid-cols-5 gap-4">
        <div className="col-span-2 space-y-2">
          {STEPS.map(step => (
            <StepCard
              key={step.id}
              step={step}
              active={activeStep === step.id}
              onClick={() => setActiveStep(step.id)}
            />
          ))}
        </div>
        <div className="col-span-3">
          <DetailPanel step={active} onNavigate={onNavigate} />
        </div>
      </div>
    </div>
  );
}
