import { CheckCircle2, Circle, Clock, MapPin, Users, Target, Zap, FileCheck, UserCheck, Truck, Phone, Mail, ChevronRight, AlertTriangle, Shield, Building2, CalendarCheck, HardHat } from 'lucide-react';

const MOB_PHASES = [
  {
    id: 'award',
    label: 'Contract Award',
    date: '12 May 2026',
    desc: 'Contract signed, mobilisation clock started. Britannia assigned dedicated mobilisation manager.',
    done: true,
    Icon: FileCheck,
  },
  {
    id: 'survey',
    label: 'Site Surveys',
    date: 'Tier 1 complete · Tier 2 starts 28 May',
    desc: 'Physical walk-through of each site. Access requirements, equipment, consumable volumes and hazard assessment.',
    done: false,
    partial: true,
    Icon: MapPin,
  },
  {
    id: 'scope',
    label: 'Scope Confirmed',
    date: '18 May 2026',
    desc: 'Full cleaning specification signed off by both parties. Task schedules, frequencies and standards documented.',
    done: true,
    Icon: FileCheck,
  },
  {
    id: 'people',
    label: 'People & TUPE',
    date: 'Day 12 of 28',
    desc: '18 staff transferring under TUPE. Individual consultations underway. DBS checks and payroll setup in progress.',
    done: false,
    active: true,
    Icon: UserCheck,
  },
  {
    id: 'kpis',
    label: 'KPIs Agreed',
    date: '12 May 2026',
    desc: 'Performance targets locked in contract: 87% audit pass rate, 24h re-clean, 95% cover, 4h reactive SLA.',
    done: true,
    Icon: Target,
  },
  {
    id: 'golive',
    label: 'Go Live',
    date: '01 Jul 2026',
    desc: 'All 6 sites operational. First KPI audit at 30 days. Monthly reporting cycle begins.',
    done: false,
    Icon: Zap,
  },
];

const SITES = [
  {
    id: 'lu',
    name: 'Asda – Luton Supercentre',
    address: 'Gipsy Lane, Luton LU1 3HR',
    tier: 1,
    status: 'live',
    liveDate: '22 May 2026',
    supervisor: 'Maria Santos',
    contract: 'Contract + Exterior',
    sqm: '4,200 m²',
  },
  {
    id: 'bm',
    name: 'Asda – Birmingham Minworth',
    address: 'Minworth Industrial Park, B76 1AH',
    tier: 1,
    status: 'live',
    liveDate: '22 May 2026',
    supervisor: 'David Osei',
    contract: 'Contract + Exterior',
    sqm: '5,100 m²',
  },
  {
    id: 'mk',
    name: 'Asda – Milton Keynes Central',
    address: 'Grafton Gate E, Milton Keynes MK9 1DA',
    tier: 2,
    status: 'survey',
    surveyDate: '28 May 2026',
    liveDate: '15 Jun 2026',
    contract: 'Contract Cleaning',
    sqm: '3,600 m²',
  },
  {
    id: 'wf',
    name: 'Asda – Watford Dome',
    address: 'Colonial Way, Watford WD24 4WU',
    tier: 2,
    status: 'survey',
    surveyDate: '28 May 2026',
    liveDate: '15 Jun 2026',
    contract: 'Contract Cleaning',
    sqm: '3,200 m²',
  },
  {
    id: 'cv',
    name: 'Asda – Coventry Arena',
    address: 'Arena Park Shopping Centre, CV6 6GE',
    tier: 2,
    status: 'pending',
    surveyDate: '04 Jun 2026',
    liveDate: '01 Jul 2026',
    contract: 'Contract + Exterior',
    sqm: '2,900 m²',
  },
  {
    id: 'st',
    name: 'Asda – Stevenage Retail Park',
    address: 'Roaring Meg Retail Park, SG1 1XN',
    tier: 3,
    status: 'pending',
    surveyDate: '04 Jun 2026',
    liveDate: '01 Jul 2026',
    contract: 'Contract Cleaning',
    sqm: '2,100 m²',
  },
];

const TUPE_ITEMS = [
  { label: 'Employee liability information requested from outgoing contractor', done: true,  date: '13 May 2026' },
  { label: 'Individual staff consultation meetings scheduled', done: true,  date: '14 May 2026' },
  { label: 'Right-to-work documentation verified for all 18 staff', done: false },
  { label: 'DBS checks initiated (18 staff)', done: false },
  { label: 'Payroll records transferred to Britannia systems', done: false },
  { label: 'Uniform and site access passes ordered', done: false },
];

const CONTACTS = [
  {
    name: 'James Whitfield',
    role: 'Mobilisation Manager',
    note: 'Your primary contact through go-live',
    phone: '07700 900 241',
    email: 'j.whitfield@britanniagroup.co.uk',
    avatar: 'JW',
    color: '#4f78ff',
  },
  {
    name: 'Claire Nwosu',
    role: 'TUPE & HR Lead',
    note: 'Managing all staff transfers',
    phone: '07700 900 188',
    email: 'c.nwosu@britanniagroup.co.uk',
    avatar: 'CN',
    color: '#10b981',
  },
  {
    name: 'Ravi Patel',
    role: 'Operations Director – Midlands',
    note: 'Tier 1 site accountability',
    phone: '07700 900 312',
    email: 'r.patel@britanniagroup.co.uk',
    avatar: 'RP',
    color: '#f59e0b',
  },
];

const TIER_COLOR = { 1: '#ef4444', 2: '#f59e0b', 3: '#10b981' };
const TIER_BG   = { 1: '#fef2f2', 2: '#fffbeb', 3: '#f0fdf4' };

const STATUS_CHIP = {
  live:    { label: 'Live',        bg: '#f0fdf4', color: '#16a34a', dot: '#10b981' },
  survey:  { label: 'Survey booked', bg: '#fffbeb', color: '#b45309', dot: '#f59e0b' },
  pending: { label: 'Pending',    bg: '#f8fafc', color: '#64748b', dot: '#94a3b8' },
};

export default function ClientMobilisation() {
  const doneCount    = TUPE_ITEMS.filter(i => i.done).length;
  const tupeProgress = Math.round((doneCount / TUPE_ITEMS.length) * 100);
  const liveSites    = SITES.filter(s => s.status === 'live').length;

  return (
    <div className="p-5 md:p-7 space-y-6 max-w-4xl mx-auto">

      {/* Hero — phase timeline */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(135deg,#010a4f 0%,#0d1b6e 100%)' }}>
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">Mobilisation Plan</div>
              <h2 className="text-xl font-black text-white leading-tight">Asda Stores Ltd</h2>
              <div className="text-sm text-white/60 mt-0.5">6 sites · Contract + Exterior · Day 12 of mobilisation</div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <div className="text-[10px] font-black text-amber-400/80 uppercase tracking-widest">Target go-live</div>
              <div className="text-lg font-black text-white">01 Jul 2026</div>
              <div className="text-[10px] text-white/40">38 days remaining</div>
            </div>
          </div>

          {/* Phase stepper */}
          <div className="mt-6 relative">
            {/* Connector line */}
            <div className="absolute top-4 left-4 right-4 h-px bg-white/10" />
            <div className="flex justify-between relative z-10">
              {MOB_PHASES.map((ph, i) => {
                const Icon = ph.Icon;
                return (
                  <div key={ph.id} className="flex flex-col items-center gap-1.5 flex-1">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${
                      ph.done
                        ? 'bg-[#4f78ff] border-[#4f78ff]'
                        : ph.active
                        ? 'bg-amber-400 border-amber-400'
                        : ph.partial
                        ? 'bg-amber-400/30 border-amber-400'
                        : 'bg-white/5 border-white/15'
                    }`}>
                      {ph.done
                        ? <CheckCircle2 size={14} className="text-white" />
                        : ph.active
                        ? <span className="text-[9px] font-black text-white">12</span>
                        : <Icon size={13} className={ph.partial ? 'text-amber-400' : 'text-white/30'} />
                      }
                    </div>
                    <div className={`text-[9px] font-bold text-center leading-tight hidden sm:block ${
                      ph.done ? 'text-[#4f78ff]' : ph.active ? 'text-amber-400' : 'text-white/30'
                    }`}>
                      {ph.label}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Active phase callout */}
          <div className="mt-5 bg-amber-400/10 border border-amber-400/20 rounded-xl px-4 py-3 flex gap-3 items-start">
            <Clock size={15} className="text-amber-400 mt-0.5 shrink-0" />
            <div>
              <div className="text-xs font-bold text-amber-300">Currently in: People &amp; TUPE — Day 12 of 28</div>
              <div className="text-[11px] text-white/50 mt-0.5">18 staff transferring. Individual consultations underway. Britannia HR are managing the full process — you'll receive a completion report by 09 Jun 2026.</div>
            </div>
          </div>
        </div>

        {/* Phase detail rows */}
        <div className="border-t border-white/10">
          {MOB_PHASES.map((ph, i) => {
            const Icon = ph.Icon;
            return (
              <div key={ph.id} className={`px-6 py-3.5 flex items-center gap-4 border-b border-white/5 last:border-0 ${ph.active ? 'bg-amber-400/5' : ''}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                  ph.done ? 'bg-[#4f78ff]/20' : ph.active ? 'bg-amber-400/20' : 'bg-white/5'
                }`}>
                  <Icon size={12} className={ph.done ? 'text-[#4f78ff]' : ph.active ? 'text-amber-400' : 'text-white/25'} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-xs font-bold ${ph.done ? 'text-white/70' : ph.active ? 'text-amber-300' : 'text-white/30'}`}>
                    {ph.label}
                  </div>
                  <div className="text-[11px] text-white/35 truncate">{ph.desc}</div>
                </div>
                <div className={`text-[10px] font-bold shrink-0 ${
                  ph.done ? 'text-[#4f78ff]' : ph.active ? 'text-amber-400' : 'text-white/20'
                }`}>
                  {ph.done ? '✓ ' : ''}{ph.date}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Site rollout schedule */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-black text-[#010a4f]">Site Rollout Schedule</h3>
          <div className="flex items-center gap-3 text-[10px] font-bold text-gray-400">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" />T1 — named supervisor</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />T2 — area cover</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />T3 — remote</span>
          </div>
        </div>

        <div className="space-y-2">
          {SITES.map(site => {
            const chip   = STATUS_CHIP[site.status];
            const tColor = TIER_COLOR[site.tier];
            const tBg    = TIER_BG[site.tier];
            return (
              <div key={site.id} className="bg-white rounded-2xl border border-gray-100 px-4 py-3.5 flex items-center gap-4">
                <div className="px-2 py-1 rounded-lg text-[10px] font-black shrink-0" style={{ background: tBg, color: tColor }}>
                  T{site.tier}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-[#010a4f] truncate">{site.name}</div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-[10px] text-gray-400">{site.address}</span>
                    <span className="text-[10px] text-gray-300">·</span>
                    <span className="text-[10px] text-gray-400">{site.sqm}</span>
                    <span className="text-[10px] text-gray-300">·</span>
                    <span className="text-[10px] text-gray-400">{site.contract}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold" style={{ background: chip.bg, color: chip.color }}>
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: chip.dot }} />
                    {chip.label}
                  </div>
                  {site.status === 'live' && (
                    <div className="text-[10px] text-gray-400">Since {site.liveDate}</div>
                  )}
                  {site.status !== 'live' && (
                    <div className="text-[10px] text-gray-400">Go live: {site.liveDate}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Live status callout */}
        <div className="mt-3 bg-[#f0fdf4] border border-emerald-200 rounded-xl px-4 py-3 flex gap-2 items-start">
          <CheckCircle2 size={14} className="text-emerald-600 mt-0.5 shrink-0" />
          <div className="text-[11px] text-emerald-800">
            <strong>2 Tier 1 sites are live now</strong> — Luton and Birmingham have been operational since 22 May. Named supervisors are in place and first daily schedules completed without issue.
          </div>
        </div>
      </div>

      {/* TUPE Tracker */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <UserCheck size={16} className="text-[#4f78ff]" />
              <h3 className="text-sm font-black text-[#010a4f]">TUPE Tracker</h3>
            </div>
            <div className="text-[11px] text-gray-400 mt-0.5">18 staff transferring · Window closes 09 Jun 2026 (Day 28)</div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-black text-[#010a4f]">{doneCount}/{TUPE_ITEMS.length}</div>
            <div className="text-[10px] text-gray-400">steps complete</div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold text-gray-500">Day 12 of 28</span>
            <span className="text-[10px] font-bold text-[#4f78ff]">{tupeProgress}% complete</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${tupeProgress}%`, background: 'linear-gradient(90deg,#4f78ff,#818cf8)' }}
            />
          </div>
        </div>

        {/* Checklist */}
        <div className="space-y-2">
          {TUPE_ITEMS.map((item, i) => (
            <div key={i} className={`flex items-start gap-3 px-3 py-2.5 rounded-xl ${item.done ? 'bg-[#f0fdf4]' : 'bg-gray-50'}`}>
              {item.done
                ? <CheckCircle2 size={15} className="text-emerald-500 mt-0.5 shrink-0" />
                : <Circle size={15} className="text-gray-300 mt-0.5 shrink-0" />
              }
              <div className="flex-1 min-w-0">
                <div className={`text-xs font-medium ${item.done ? 'text-emerald-800' : 'text-gray-600'}`}>{item.label}</div>
                {item.done && item.date && (
                  <div className="text-[10px] text-emerald-600 mt-0.5">Completed {item.date}</div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 flex gap-2">
          <AlertTriangle size={13} className="text-amber-600 mt-0.5 shrink-0" />
          <div className="text-[11px] text-amber-800">
            <strong>Action required:</strong> Britannia HR will contact you by 30 May to collect right-to-work documents. No action needed before then.
          </div>
        </div>
      </div>

      {/* Key contacts */}
      <div>
        <h3 className="text-sm font-black text-[#010a4f] mb-3">Your Britannia Team</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {CONTACTS.map(c => (
            <div key={c.name} className="bg-white rounded-2xl border border-gray-100 p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-black text-white shrink-0" style={{ background: c.color }}>
                  {c.avatar}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-black text-[#010a4f] truncate">{c.name}</div>
                  <div className="text-[10px] text-gray-400 truncate">{c.role}</div>
                </div>
              </div>
              <div className="text-[10px] text-gray-500 mb-3 leading-relaxed">{c.note}</div>
              <div className="space-y-1.5">
                <a href={`tel:${c.phone}`} className="flex items-center gap-2 text-[11px] text-gray-600 hover:text-[#4f78ff] transition-colors">
                  <Phone size={11} className="text-gray-400 shrink-0" />
                  <span>{c.phone}</span>
                </a>
                <a href={`mailto:${c.email}`} className="flex items-center gap-2 text-[11px] text-gray-600 hover:text-[#4f78ff] transition-colors truncate">
                  <Mail size={11} className="text-gray-400 shrink-0" />
                  <span className="truncate">{c.email}</span>
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* What happens next */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <h3 className="text-sm font-black text-[#010a4f] mb-4">What happens next</h3>
        <div className="space-y-3">
          {[
            { date: '28 May', label: 'Tier 2 site surveys', detail: 'Milton Keynes & Watford — Ravi Patel will confirm access requirements with you.', icon: MapPin, color: '#4f78ff' },
            { date: '30 May', label: 'TUPE document request', detail: 'Britannia HR will contact you to collect right-to-work docs for transferring staff.', icon: UserCheck, color: '#f59e0b' },
            { date: '09 Jun', label: 'TUPE window closes', detail: 'All 18 staff formally transferred to Britannia payroll. Completion report sent to you.', icon: CheckCircle2, color: '#10b981' },
            { date: '15 Jun', label: 'Tier 2 sites go live', detail: 'Milton Keynes and Watford begin daily cleaning schedules. Live tracking enabled.', icon: Zap, color: '#4f78ff' },
            { date: '01 Jul', label: 'Full rollout complete', detail: 'All 6 sites operational. First KPI audit report published within 30 days.', icon: Shield, color: '#10b981' },
          ].map((item, i) => {
            const Icon = item.icon;
            return (
              <div key={i} className="flex gap-4 items-start">
                <div className="flex flex-col items-center shrink-0">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: item.color + '15' }}>
                    <Icon size={14} style={{ color: item.color }} />
                  </div>
                  {i < 4 && <div className="w-px flex-1 mt-1.5 mb-0" style={{ background: '#e2e8f0', minHeight: 20 }} />}
                </div>
                <div className="pb-3 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="text-[10px] font-black" style={{ color: item.color }}>{item.date}</div>
                    <div className="text-xs font-bold text-[#010a4f]">{item.label}</div>
                  </div>
                  <div className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">{item.detail}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
