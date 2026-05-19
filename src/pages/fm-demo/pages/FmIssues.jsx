import { useState } from 'react';
import {
  AlertTriangle, CheckCircle2, Clock, XCircle, ChevronDown, ChevronUp,
  Shield, MapPin, Camera, User, Bell, Send, Zap, Filter, Search,
  ArrowRight, ExternalLink, RotateCcw,
} from 'lucide-react';

const PRIORITY = {
  critical: { label: 'Critical', color: '#f87171', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.35)', dot: '#f87171' },
  high:     { label: 'High',     color: '#fbbf24', bg: 'rgba(251,191,36,0.12)',  border: 'rgba(251,191,36,0.35)',  dot: '#fbbf24' },
  medium:   { label: 'Medium',   color: '#60a5fa', bg: 'rgba(96,165,250,0.12)',  border: 'rgba(96,165,250,0.35)',  dot: '#60a5fa' },
  low:      { label: 'Low',      color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', border: 'rgba(148,163,184,0.25)', dot: '#94a3b8' },
};

const STATUS = {
  'open':        { label: 'Open',           color: '#f87171', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.3)' },
  'in-progress': { label: 'In Progress',    color: '#60a5fa', bg: 'rgba(96,165,250,0.12)',  border: 'rgba(96,165,250,0.3)'  },
  'pending-client': { label: 'Pending Client', color: '#fbbf24', bg: 'rgba(251,191,36,0.12)', border: 'rgba(251,191,36,0.3)' },
  'resolved':    { label: 'Resolved',       color: '#34d399', bg: 'rgba(52,211,153,0.12)',  border: 'rgba(52,211,153,0.3)'  },
};

const TRAIL_META = {
  system:  { color: '#a78bfa', bg: 'rgba(167,139,250,0.15)', icon: Zap    },
  assign:  { color: '#60a5fa', bg: 'rgba(96,165,250,0.15)',  icon: User   },
  notify:  { color: '#fbbf24', bg: 'rgba(251,191,36,0.15)',  icon: Bell   },
  client:  { color: '#c084fc', bg: 'rgba(192,132,252,0.15)', icon: Send   },
  review:  { color: '#60a5fa', bg: 'rgba(96,165,250,0.15)',  icon: Shield },
  resolve: { color: '#34d399', bg: 'rgba(52,211,153,0.15)',  icon: CheckCircle2 },
};

const ISSUES = [
  {
    id: 'ISS-0041', priority: 'critical', type: 'SLA Breach',
    site: 'Luton Central Library', client: 'Luton Borough Council',
    raised: '07:10', raisedDate: '9 May 2026', raisedBy: 'Auto — Cadi System',
    assignedTo: 'James Harper', status: 'open', resolutionTime: null,
    description: 'Cleaner not on site 15 minutes before SLA window closes. Contract requires arrival by 06:45, no check-in recorded. Client SLA at risk.',
    jobRef: 'BF-2026-0188', evidenceCount: 0,
    trail: [
      { time: '07:10', event: 'Auto-raised by Cadi — SLA risk detected', type: 'system' },
      { time: '07:12', event: 'Assigned to James Harper', type: 'assign' },
    ],
  },
  {
    id: 'ISS-0040', priority: 'high', type: 'Quality Dispute',
    site: 'L&D Hospital – A&E & Outpatients', client: 'Luton & Dunstable University Hospital NHS FT',
    raised: '08:05', raisedDate: '9 May 2026', raisedBy: 'Raj Patel (Client)',
    assignedTo: 'James Harper', status: 'in-progress', resolutionTime: null,
    description: 'Client reports main corridor not completed during 05:30–07:30 window. Cleaner arrived 52 minutes late. Evidence shows only 3 of 8 sections signed off.',
    jobRef: 'BF-2026-0182', evidenceCount: 3,
    trail: [
      { time: '06:22', event: 'Cleaner checked in — 52 min late to window', type: 'system' },
      { time: '07:31', event: 'Job marked complete by cleaner', type: 'system' },
      { time: '08:05', event: 'Dispute raised by Raj Patel via client portal', type: 'client' },
      { time: '08:10', event: 'Assigned to James Harper for review', type: 'assign' },
      { time: '08:31', event: 'Evidence under review — 3 photos being examined', type: 'review' },
    ],
  },
  {
    id: 'ISS-0039', priority: 'medium', type: 'Access Problem',
    site: 'Central Bedfordshire Council HQ', client: 'Central Bedfordshire Council',
    raised: '05:48', raisedDate: '9 May 2026', raisedBy: 'Marcus Webb (Cleaner)',
    assignedTo: 'James Harper', status: 'resolved', resolutionTime: '38 min',
    description: 'Cleaner reported key fob not working on side entrance. Used main entrance causing 7-minute delay. Site manager contacted — fob will be replaced by facilities team.',
    jobRef: 'BF-2026-0179', evidenceCount: 2,
    trail: [
      { time: '05:48', event: 'Access issue reported by cleaner via Cadi Connect', type: 'system' },
      { time: '05:52', event: 'David Shaw (Facilities) notified automatically', type: 'notify' },
      { time: '06:03', event: 'Client confirmed main entrance as approved alternative', type: 'client' },
      { time: '06:26', event: 'Clean completed · SLA met · issue closed', type: 'resolve' },
    ],
  },
  {
    id: 'ISS-0038', priority: 'low', type: 'Schedule Change',
    site: 'Premier Inn Luton Airport', client: 'Whitbread Hotels Ltd',
    raised: '14:20', raisedDate: '8 May 2026', raisedBy: 'Anna Davies (Client)',
    assignedTo: 'Sarah Okonkwo', status: 'resolved', resolutionTime: '22 min',
    description: 'Client requests one-off earlier start of 07:30 on 15 May due to large conference check-ins. Rescheduled and cleaner notified through Cadi Connect.',
    jobRef: 'BF-2026-0174', evidenceCount: 0,
    trail: [
      { time: '14:20', event: 'Request received from Anna Davies', type: 'client' },
      { time: '14:28', event: 'Schedule adjusted in Cadi — cleaner notified automatically', type: 'system' },
      { time: '14:42', event: 'Emma Walsh confirmed acceptance via Cadi Connect', type: 'resolve' },
    ],
  },
  {
    id: 'ISS-0037', priority: 'high', type: 'Missed Visit',
    site: 'Next – Centre:MK', client: 'Next Retail UK Ltd',
    raised: '06:30', raisedDate: '7 May 2026', raisedBy: 'Auto — Cadi System',
    assignedTo: 'James Harper', status: 'resolved', resolutionTime: '1h 22m',
    description: 'Assigned cleaner did not arrive for 06:00 window. No check-in by 06:30. Emergency cover arranged from cleaner network — replacement on site by 07:15, clean completed.',
    jobRef: 'BF-2026-0169', evidenceCount: 6,
    trail: [
      { time: '06:30', event: 'Auto-alert — no check-in recorded at start of window', type: 'system' },
      { time: '06:31', event: 'Cadi matched nearest available cleaner (Emma Walsh, score 94)', type: 'system' },
      { time: '06:35', event: 'Emma Walsh accepted job via Cadi Connect', type: 'resolve' },
      { time: '07:15', event: 'Emma checked in on site · 6 geo-verified photos uploaded', type: 'resolve' },
      { time: '07:52', event: 'Clean completed · SLA achieved · evidence approved', type: 'resolve' },
    ],
  },
  {
    id: 'ISS-0036', priority: 'medium', type: 'Equipment Fault',
    site: 'Aldi – Dunstable Distribution RDC', client: 'Aldi UK Ltd',
    raised: '05:12', raisedDate: '6 May 2026', raisedBy: 'Tom Adeyemi (Cleaner)',
    assignedTo: 'Sarah Okonkwo', status: 'resolved', resolutionTime: '2h 15m',
    description: 'Floor scrubber unit at RDC reported fault — error code E4. Manual clean of all areas completed. Equipment issue logged with site maintenance team.',
    jobRef: 'BF-2026-0162', evidenceCount: 4,
    trail: [
      { time: '05:12', event: 'Equipment fault reported via Cadi Connect', type: 'system' },
      { time: '05:18', event: 'Assigned to Sarah Okonkwo for coordination', type: 'assign' },
      { time: '05:25', event: 'Mark Higgins (Aldi Property) notified of equipment issue', type: 'notify' },
      { time: '05:30', event: 'Manual clean approved — cleaner proceeded', type: 'client' },
      { time: '07:27', event: 'Full clean completed · maintenance ticket raised with Aldi', type: 'resolve' },
    ],
  },
];

const STATS = [
  { label: 'Open issues',        value: '2',    sub: '1 critical',      color: '#f87171', icon: XCircle      },
  { label: 'Avg resolution',     value: '47m',  sub: 'this month',      color: '#60a5fa', icon: Clock        },
  { label: 'Resolved this month',value: '14',   sub: '100% closed',     color: '#34d399', icon: CheckCircle2 },
  { label: 'Auto-raised by Cadi',value: '9',    sub: 'of 16 total',     color: '#a78bfa', icon: Zap          },
];

function EvidenceThumb({ idx }) {
  const hues = [220, 160, 200, 140, 180, 260];
  const h = hues[idx % hues.length];
  return (
    <div className="w-14 h-14 rounded-xl relative overflow-hidden shrink-0 flex items-center justify-center"
      style={{
        background: `linear-gradient(135deg, hsl(${h},60%,18%) 0%, hsl(${h+20},55%,12%) 100%)`,
        border: `1px solid hsl(${h},50%,28%)`,
      }}>
      <Camera size={14} style={{ color: `hsl(${h},70%,60%)`, opacity: 0.7 }} />
      <div className="absolute bottom-0.5 right-0.5 text-[8px] font-black"
        style={{ color: `hsl(${h},70%,60%)` }}>{idx + 1}</div>
    </div>
  );
}

function TrailDot({ type }) {
  const m = TRAIL_META[type] || TRAIL_META.system;
  const Icon = m.icon;
  return (
    <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
      style={{ background: m.bg, border: `1px solid ${m.color}30` }}>
      <Icon size={10} style={{ color: m.color }} />
    </div>
  );
}

function IssueRow({ issue, expanded, onToggle, showToast }) {
  const p  = PRIORITY[issue.priority];
  const st = STATUS[issue.status];

  return (
    <div
      className="rounded-2xl overflow-hidden transition-all"
      style={{
        background: expanded ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.04)',
        border: expanded ? `1px solid ${p.color}35` : '1px solid rgba(255,255,255,0.08)',
        boxShadow: expanded ? `0 0 30px ${p.color}0a` : 'none',
      }}>

      {/* Row header */}
      <button
        className="w-full px-5 py-4 flex items-center gap-4 text-left group"
        onClick={onToggle}>

        {/* Priority dot */}
        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: p.dot, boxShadow: `0 0 6px ${p.dot}` }} />

        {/* ID + type */}
        <div className="shrink-0 w-28">
          <div className="text-[10px] font-black text-white/30 font-mono">{issue.id}</div>
          <div className="text-xs font-bold text-white/80 mt-0.5">{issue.type}</div>
        </div>

        {/* Site + client */}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-white truncate">{issue.site}</div>
          <div className="text-[11px] text-white/40 mt-0.5 truncate">{issue.client}</div>
        </div>

        {/* Raised by */}
        <div className="w-40 shrink-0 hidden xl:block">
          <div className="text-[10px] text-white/30">Raised by</div>
          <div className="text-xs text-white/60 mt-0.5 truncate">{issue.raisedBy}</div>
        </div>

        {/* Time */}
        <div className="w-20 text-right shrink-0 hidden lg:block">
          <div className="text-xs font-mono text-white/50">{issue.raised}</div>
          <div className="text-[10px] text-white/25 mt-0.5">{issue.raisedDate}</div>
        </div>

        {/* Priority badge */}
        <div className="shrink-0">
          <span className="text-[10px] font-black px-2.5 py-1 rounded-full"
            style={{ background: p.bg, border: `1px solid ${p.border}`, color: p.color }}>
            {p.label}
          </span>
        </div>

        {/* Status badge */}
        <div className="shrink-0 w-28 text-right">
          <span className="text-[10px] font-black px-2.5 py-1 rounded-full"
            style={{ background: st.bg, border: `1px solid ${st.border}`, color: st.color }}>
            {st.label}
          </span>
        </div>

        {/* Resolution time */}
        <div className="w-16 text-right shrink-0 hidden xl:block">
          {issue.resolutionTime
            ? <span className="text-xs font-bold text-emerald-400">{issue.resolutionTime}</span>
            : <span className="text-xs text-white/20">—</span>}
        </div>

        {/* Chevron */}
        <div className="shrink-0 text-white/30 group-hover:text-white/60 transition-colors">
          {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </div>
      </button>

      {/* Expanded body */}
      {expanded && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>

          <div className="grid grid-cols-[1fr_280px] gap-0">

            {/* Left: description + trail */}
            <div className="px-6 py-5" style={{ borderRight: '1px solid rgba(255,255,255,0.07)' }}>

              {/* Description */}
              <div className="mb-5">
                <div className="text-[10px] font-black uppercase tracking-widest text-white/25 mb-2">Issue description</div>
                <p className="text-sm text-white/70 leading-relaxed">{issue.description}</p>
              </div>

              {/* Job ref + evidence */}
              <div className="flex items-center gap-4 mb-5 flex-wrap">
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs"
                  style={{ background: 'rgba(79,120,255,0.1)', border: '1px solid rgba(79,120,255,0.2)' }}>
                  <span className="text-white/40">Job ref</span>
                  <span className="font-mono font-bold text-white/80">{issue.jobRef}</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <MapPin size={11} className="text-emerald-400" />
                  <span className="text-white/40">Geo-verified site</span>
                </div>
                {issue.evidenceCount > 0 && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs"
                    style={{ background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.2)' }}>
                    <Camera size={11} className="text-purple-400" />
                    <span className="font-bold text-purple-300">{issue.evidenceCount} evidence photos</span>
                  </div>
                )}
              </div>

              {/* Evidence thumbs */}
              {issue.evidenceCount > 0 && (
                <div className="mb-5">
                  <div className="text-[10px] font-black uppercase tracking-widest text-white/25 mb-2">Linked evidence</div>
                  <div className="flex gap-2 flex-wrap">
                    {Array.from({ length: issue.evidenceCount }).map((_, i) => (
                      <EvidenceThumb key={i} idx={i} />
                    ))}
                    <div className="w-14 h-14 rounded-xl flex items-center justify-center text-[10px] font-bold text-white/30"
                      style={{ border: '1px dashed rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)' }}>
                      View all
                    </div>
                  </div>
                </div>
              )}

              {/* Resolution trail */}
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-white/25 mb-3">Resolution trail</div>
                <div className="space-y-2.5">
                  {issue.trail.map((entry, i) => {
                    const m = TRAIL_META[entry.type] || TRAIL_META.system;
                    return (
                      <div key={i} className="flex items-start gap-3">
                        <TrailDot type={entry.type} />
                        <div className="flex-1 pt-0.5">
                          <span className="text-xs text-white/65 leading-snug">{entry.event}</span>
                          <span className="ml-2 text-[10px] font-mono text-white/25">{entry.time}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right: actions + meta */}
            <div className="px-5 py-5 space-y-4">

              {/* Assignment */}
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-white/25 mb-2">Assigned to</div>
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-black shrink-0"
                    style={{ background: 'rgba(79,120,255,0.2)', border: '1px solid rgba(79,120,255,0.3)' }}>
                    {issue.assignedTo.split(' ').map(w => w[0]).join('')}
                  </div>
                  <div>
                    <div className="text-white text-xs font-bold">{issue.assignedTo}</div>
                    <div className="text-white/35 text-[10px]">Operations Manager</div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-white/25 mb-2">Actions</div>
                <div className="space-y-2">
                  {issue.status !== 'resolved' && (
                    <>
                      <button onClick={() => showToast('notify client and send update')}
                        className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold text-white/70 transition-all"
                        style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.25)' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(251,191,36,0.2)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(251,191,36,0.1)'}>
                        <Bell size={12} className="text-amber-400" />
                        <span className="text-amber-300">Notify client</span>
                      </button>
                      <button onClick={() => showToast('reassign this issue to another team member')}
                        className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition-all"
                        style={{ background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.25)' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(96,165,250,0.2)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(96,165,250,0.1)'}>
                        <User size={12} className="text-blue-400" />
                        <span className="text-blue-300">Reassign</span>
                      </button>
                      <button onClick={() => showToast('mark this issue as resolved')}
                        className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition-all"
                        style={{ background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.35)' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(52,211,153,0.25)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(52,211,153,0.15)'}>
                        <CheckCircle2 size={12} className="text-emerald-400" />
                        <span className="text-emerald-300">Mark resolved</span>
                      </button>
                    </>
                  )}
                  {issue.status === 'resolved' && (
                    <>
                      <button onClick={() => window.open('/client-demo', '_blank')}
                        className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition-all"
                        style={{ background: 'rgba(79,120,255,0.15)', border: '1px solid rgba(79,120,255,0.35)' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(79,120,255,0.25)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(79,120,255,0.15)'}>
                        <ExternalLink size={12} className="text-blue-400" />
                        <span className="text-blue-300">Open client portal →</span>
                      </button>
                      <button onClick={() => showToast('reopen this issue')}
                        className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold text-white/40 transition-all"
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.07)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}>
                        <RotateCcw size={12} />
                        <span>Reopen</span>
                      </button>
                    </>
                  )}
                  <button onClick={() => showToast('view linked job in Job Board')}
                    className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold text-white/40 transition-all"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.07)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}>
                    <ArrowRight size={12} />
                    <span>View linked job</span>
                  </button>
                </div>
              </div>

              {/* Auto-raise callout */}
              {issue.raisedBy.includes('Auto') && (
                <div className="rounded-xl px-3 py-3"
                  style={{ background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)' }}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Zap size={10} className="text-purple-400" />
                    <span className="text-[10px] font-black text-purple-300 uppercase tracking-wider">Auto-raised by Cadi</span>
                  </div>
                  <div className="text-[10px] text-white/40 leading-relaxed">
                    No manual logging needed — Cadi detected and raised this automatically.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function FmIssues({ showToast }) {
  const [expanded,    setExpanded]    = useState('ISS-0041');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search,      setSearch]      = useState('');

  const filtered = ISSUES.filter(iss => {
    if (statusFilter !== 'all' && iss.status !== statusFilter) return false;
    if (search && !iss.site.toLowerCase().includes(search.toLowerCase()) &&
        !iss.type.toLowerCase().includes(search.toLowerCase()) &&
        !iss.client.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const STATUS_TABS = [
    { id: 'all',        label: 'All',         count: ISSUES.length },
    { id: 'open',       label: 'Open',        count: ISSUES.filter(i => i.status === 'open').length },
    { id: 'in-progress',label: 'In Progress', count: ISSUES.filter(i => i.status === 'in-progress').length },
    { id: 'resolved',   label: 'Resolved',    count: ISSUES.filter(i => i.status === 'resolved').length },
  ];

  return (
    <div className="p-8 space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="text-white font-black text-xl">Issues & Helpdesk</div>
          <div className="text-white/40 text-sm mt-0.5">All site issues in one place — auto-raised, tracked, resolved</div>
        </div>
        <button
          onClick={() => showToast('open the raise-issue form')}
          className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-black text-white transition-all"
          style={{ background: 'linear-gradient(135deg, #f87171, #ef4444)', boxShadow: '0 4px 20px rgba(239,68,68,0.3)' }}
          onMouseEnter={e => e.currentTarget.style.filter = 'brightness(1.1)'}
          onMouseLeave={e => e.currentTarget.style.filter = ''}>
          <AlertTriangle size={14} />
          Raise issue
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {STATS.map(({ label, value, sub, color, icon: Icon }) => (
          <div key={label} className="rounded-2xl p-5 relative overflow-hidden"
            style={{
              background: 'rgba(255,255,255,0.05)',
              backdropFilter: 'blur(20px)',
              border: `1px solid ${color}22`,
            }}>
            <div className="absolute top-3 right-4 opacity-10">
              <Icon size={32} style={{ color }} />
            </div>
            <div className="text-2xl font-black mb-0.5" style={{ color }}>{value}</div>
            <div className="text-white/60 text-xs font-bold">{label}</div>
            <div className="text-white/30 text-[10px] mt-0.5">{sub}</div>
          </div>
        ))}
      </div>

      {/* Cadi auto-raise callout */}
      <div className="flex items-center gap-4 px-5 py-4 rounded-2xl"
        style={{ background: 'rgba(167,139,250,0.07)', border: '1px solid rgba(167,139,250,0.2)' }}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.3)' }}>
          <Zap size={16} className="text-purple-400" />
        </div>
        <div className="flex-1">
          <div className="text-white/80 text-sm font-bold">9 of 16 issues this month were raised automatically by Cadi</div>
          <div className="text-white/40 text-xs mt-0.5">SLA breaches, missed arrivals, and quality flags are detected in real-time — no manual logging required. Your team is notified instantly.</div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-2xl font-black text-purple-400">56%</div>
          <div className="text-white/30 text-[10px]">auto-detected</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Status tabs */}
        <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
          {STATUS_TABS.map(tab => {
            const active = statusFilter === tab.id;
            return (
              <button key={tab.id} onClick={() => setStatusFilter(tab.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                style={active
                  ? { background: 'rgba(255,255,255,0.12)', color: 'white' }
                  : { color: 'rgba(255,255,255,0.4)' }}>
                {tab.label}
                <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full"
                  style={{ background: active ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)', color: active ? 'white' : 'rgba(255,255,255,0.4)' }}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 flex-1 max-w-xs px-3 py-2 rounded-xl"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <Search size={13} className="text-white/30 shrink-0" />
          <input
            className="bg-transparent text-xs text-white placeholder-white/25 outline-none flex-1"
            placeholder="Search site, client, or issue type…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="ml-auto text-white/25 text-xs">{filtered.length} issue{filtered.length !== 1 ? 's' : ''}</div>
      </div>

      {/* Table header */}
      <div className="px-5 grid text-[9px] font-black uppercase tracking-widest text-white/20"
        style={{ gridTemplateColumns: '12px 112px 1fr 160px 80px 100px 104px 64px 24px' }}>
        <span />
        <span>Ref / type</span>
        <span>Site & client</span>
        <span className="hidden xl:block">Raised by</span>
        <span className="hidden lg:block">Time</span>
        <span>Priority</span>
        <span className="text-right">Status</span>
        <span className="text-right hidden xl:block">Resolved in</span>
        <span />
      </div>

      {/* Issue list */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-white/20 text-sm">No issues match this filter</div>
        ) : filtered.map(issue => (
          <IssueRow
            key={issue.id}
            issue={issue}
            expanded={expanded === issue.id}
            onToggle={() => setExpanded(expanded === issue.id ? null : issue.id)}
            showToast={showToast}
          />
        ))}
      </div>

      {/* Before Cadi comparison */}
      <div className="rounded-2xl p-5 grid grid-cols-2 gap-6"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <div>
          <div className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ color: '#C2410C' }}>Before Cadi — bespoke system</div>
          <div className="space-y-2 text-xs text-white/40 leading-relaxed">
            {['Issues logged manually by ops staff', 'No link to job evidence or geo-data', 'Client chased separately by phone/email', 'Spreadsheet or legacy database — no audit trail', 'Missed visits only caught on client complaint', 'Resolution time tracked manually if at all'].map(t => (
              <div key={t} className="flex items-start gap-2">
                <XCircle size={11} className="text-red-400/60 mt-0.5 shrink-0" />
                <span>{t}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-3">With Cadi</div>
          <div className="space-y-2 text-xs text-white/40 leading-relaxed">
            {['SLA breaches & missed arrivals auto-raised instantly', 'Every issue links to job ref, geo-photos, audit trail', 'Client notified in one click — shareable resolution report', 'Full resolution trail logged automatically', 'Missed visits detected before client even knows', 'Avg resolution time tracked and reported monthly'].map(t => (
              <div key={t} className="flex items-start gap-2">
                <CheckCircle2 size={11} className="text-emerald-400/80 mt-0.5 shrink-0" />
                <span>{t}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
