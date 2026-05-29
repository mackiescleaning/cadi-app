import { useState } from 'react';
import {
  AlertTriangle, CheckCircle2, Clock, Users, MapPin, Phone, MessageSquare,
  ChevronRight, Calendar, ClipboardCheck, TrendingUp, TrendingDown,
  Star, Wrench, FileText, UserCheck, AlertCircle, Flag, RefreshCw, Umbrella,
} from 'lucide-react';

/* ─────────────────── DATA ─────────────────── */

const SITES = [
  { id: 's1', name: 'L&D Hospital — Main Tower',  client: 'Luton & Dunstable NHS FT', type: 'Healthcare',    sla: 99, staff: 8, lastVisit: '21 May', nextVisit: 'Today',   issues: 1, auditScore: 94 },
  { id: 's2', name: 'Luton Town Hall',             client: 'Central Beds Council',     type: 'Public Sector', sla: 97, staff: 5, lastVisit: '23 May', nextVisit: 'Tomorrow',issues: 0, auditScore: 97 },
  { id: 's3', name: 'Premier Inn Luton Airport',   client: 'Whitbread PLC',            type: 'Hospitality',   sla: 95, staff: 4, lastVisit: '19 May', nextVisit: '29 May',  issues: 2, auditScore: 88 },
  { id: 's4', name: 'Aldi Dunstable RDC',          client: 'Aldi UK',                  type: 'Industrial',    sla: 98, staff: 6, lastVisit: '22 May', nextVisit: '30 May',  issues: 0, auditScore: 96 },
  { id: 's5', name: 'HSBC Birmingham',             client: 'HSBC UK',                  type: 'Commercial',    sla: 91, staff: 3, lastVisit: '20 May', nextVisit: 'Overdue', issues: 3, auditScore: 82 },
  { id: 's6', name: 'UoB Luton Campus',            client: 'University of Bedfordshire',type: 'Education',    sla: 96, staff: 4, lastVisit: '24 May', nextVisit: '31 May',  issues: 0, auditScore: 95 },
];

const ABSENCES = [
  { name: 'Claire Nduka',  id: 'E-0234', site: 'L&D Hospital',  reason: 'Sick — self-certified', cover: null,            shift: '05:00–13:00' },
  { name: 'Amina Hassan',  id: 'E-0402', site: 'Luton Town Hall',reason: 'Sick — self-certified', cover: 'James Okafor',  shift: '06:00–14:00' },
  { name: 'Priya Sharma',  id: 'E-0178', site: 'Premier Inn',    reason: 'Annual leave (approved)',cover: 'Tara Hobson',   shift: '08:00–14:00' },
];

const VISIT_SCHEDULE = [
  { time: '08:30', site: 'L&D Hospital — Main Tower',  purpose: 'Quality audit — Main Tower wards',     status: 'due',      addr: 'Lewsey Rd, Luton LU4 0DZ',    contact: 'Geoff Hartley (Facilities)' },
  { time: '10:45', site: 'HSBC Birmingham',             purpose: 'Issue follow-up — 3 open complaints',  status: 'overdue',  addr: '3 Broad St, Birmingham B1 2HF',contact: 'Karen Moss (Building Mgr)' },
  { time: '13:00', site: 'Premier Inn Luton Airport',   purpose: 'Routine inspection + staff check-in',  status: 'due',      addr: 'Spittlesea Rd, Luton LU2 9NZ', contact: 'Dan Greer (Hotel Ops)' },
];

const STAFF_FLAGS = [
  { type: 'rtw',        name: 'Claire Nduka',   id: 'E-0234', detail: 'Return-to-work interview required on return — 3rd absence in 90 days', site: 'L&D Hospital',  urgency: 'high'   },
  { type: 'review',     name: 'Marcus Webb',    id: 'E-0311', detail: 'Scheduled 6-month performance review — overdue by 12 days',            site: 'Town Hall',     urgency: 'medium' },
  { type: 'onboarding', name: 'Jordan Price',   id: 'E-0521', detail: 'New starter — site induction sign-off pending (started 26 May)',        site: 'Aldi Dunstable',urgency: 'high'   },
  { type: 'conduct',    name: 'Tom Griffiths',  id: 'E-0089', detail: 'Informal warning issued 14 May — 28-day review period active',          site: 'HSBC Bham',     urgency: 'medium' },
  { type: 'training',   name: 'Leah Okonkwo',   id: 'E-0398', detail: 'Healthcare infection control training expires 1 Jun — not yet renewed',  site: 'L&D Hospital',  urgency: 'high'   },
];

const CLIENT_LOG = [
  {
    site: 'HSBC Birmingham', client: 'Karen Moss', lastContact: '12 May', nextReview: '10 Jun',
    openIssues: [
      { date: '18 May', desc: 'Boardroom glass not cleaned — noticed by HSBC director', status: 'open' },
      { date: '20 May', desc: 'Cleaning operative arrived 25 min late — no SMS notification', status: 'open' },
      { date: '22 May', desc: 'Mop bucket left in corridor — trip hazard flagged', status: 'actioned' },
    ],
    lastAudit: 82, mood: 'at-risk',
  },
  {
    site: 'Premier Inn Luton Airport', client: 'Dan Greer', lastContact: '19 May', nextReview: '2 Jun',
    openIssues: [
      { date: '21 May', desc: 'Room 214 — toilet not cleaned before 09:00 check-in', status: 'open' },
      { date: '23 May', desc: 'Cleaning trolley left unattended in corridor', status: 'actioned' },
    ],
    lastAudit: 88, mood: 'watch',
  },
  {
    site: 'L&D Hospital — Main Tower', client: 'Geoff Hartley', lastContact: '21 May', nextReview: '3 Jun',
    openIssues: [
      { date: '25 May', desc: 'Ward 4B — sluice room not signed off before 06:30', status: 'open' },
    ],
    lastAudit: 94, mood: 'good',
  },
  {
    site: 'Luton Town Hall', client: 'Sue Farrell', lastContact: '24 May', nextReview: '15 Jun',
    openIssues: [],
    lastAudit: 97, mood: 'good',
  },
];

const HOLIDAY_REQUESTS = [
  { name: 'Sarah Mitchell', id: 'E-0112', site: 'Asda Luton',    from: '14 Jul', to: '18 Jul', days: 5, reason: 'Family holiday',  submitted: '24 May', cover: 'Required' },
  { name: 'Sarah Mitchell', id: 'E-0112', site: 'Asda Luton',    from: '23 Dec', to: '31 Dec', days: 7, reason: 'Christmas break', submitted: '27 May', cover: 'Required' },
  { name: 'Marcus Webb',    id: 'E-0311', site: 'Town Hall',      from: '22 Jun', to: '26 Jun', days: 5, reason: 'Annual leave',    submitted: '20 May', cover: 'Required' },
  { name: 'Leah Okonkwo',   id: 'E-0398', site: 'L&D Hospital',  from: '7 Jul',  to: '11 Jul', days: 5, reason: 'Annual leave',    submitted: '25 May', cover: 'Required' },
];

const STAFF_MESSAGES = [
  { name: 'Sarah Mitchell', id: 'E-0112', site: 'Asda Luton',   time: 'Mon 08:34', text: 'Ward 4B all done and signed off.', read: true  },
  { name: 'Jordan Price',   id: 'E-0521', site: 'Aldi RDC',     time: 'Tue 06:45', text: 'Morning — is my induction sign-off happening today?', read: false },
  { name: 'Tom Griffiths',  id: 'E-0089', site: 'HSBC Bham',    time: 'Tue 15:20', text: 'Hi James, can we speak about my warning when you\'re at HSBC?', read: false },
];

const HOURS_DATA = [
  { site: 'L&D Hospital',  contracted: 320, actual: 318, delta: -2  },
  { site: 'Town Hall',     contracted: 190, actual: 192, delta:  2  },
  { site: 'Premier Inn',   contracted: 148, actual: 141, delta: -7  },
  { site: 'Aldi RDC',      contracted: 228, actual: 228, delta:  0  },
  { site: 'HSBC Bham',     contracted: 112, actual: 98,  delta: -14 },
  { site: 'UoB Campus',    contracted: 160, actual: 159, delta: -1  },
];

/* ─────────────────── TABS ─────────────────── */

const TABS = [
  { id: 'briefing', label: 'Morning Briefing', icon: AlertCircle },
  { id: 'round',    label: "Today's Round",    icon: MapPin       },
  { id: 'staff',    label: 'Staff',            icon: Users        },
  { id: 'clients',  label: 'Client Log',       icon: MessageSquare},
];

/* ─────────────────── BRIEFING TAB ─────────────────── */

function BriefingTab({ showToast }) {
  const [covered,  setCovered]  = useState({ 'Claire Nduka': false });
  const [readMsgs, setReadMsgs] = useState(new Set(['Mon 08:34']));

  const totalIssues = SITES.reduce((s, x) => s + x.issues, 0);
  const atRisk = SITES.filter(s => s.sla < 95 || s.auditScore < 90).length;
  const hoursShortfall = HOURS_DATA.reduce((s, h) => s + Math.min(h.delta, 0), 0);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-white font-black text-lg leading-tight mb-1">Morning Briefing</h2>
        <p className="text-white/35 text-xs">Wednesday 27 May 2026 · Your patch — 6 sites · 30 staff</p>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Absences today',    value: ABSENCES.length,     color: '#f87171',  alert: true  },
          { label: 'Sites at risk',     value: atRisk,              color: '#fbbf24',  alert: atRisk > 0 },
          { label: 'Open client issues',value: totalIssues,         color: '#fb923c',  alert: totalIssues > 2 },
          { label: 'Hours shortfall',   value: `${hoursShortfall}h`,color: '#34d399',  alert: hoursShortfall < -10 },
        ].map(({ label, value, color, alert }) => (
          <div key={label} style={{
            borderRadius: '0.75rem', padding: '0.75rem 0.9rem',
            background: alert ? `${color}08` : 'rgba(255,255,255,0.03)',
            border: `1px solid ${alert ? `${color}25` : 'rgba(255,255,255,0.07)'}`,
          }}>
            <div style={{ fontWeight: 900, fontSize: '1.5rem', color, lineHeight: 1 }}>{value}</div>
            <div style={{ fontSize: '0.6rem', fontWeight: 700, color: 'rgba(255,255,255,0.4)', marginTop: 3 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Absence alerts */}
      <div style={{ borderRadius: '0.875rem', overflow: 'hidden', border: '1px solid rgba(248,113,113,0.2)', background: 'rgba(248,113,113,0.04)' }}>
        <div style={{ padding: '0.6rem 1rem', borderBottom: '1px solid rgba(248,113,113,0.15)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertTriangle size={13} style={{ color: '#f87171' }} />
          <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'white' }}>Absences — action required</span>
        </div>
        {ABSENCES.map((ab, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 1rem',
            borderBottom: i < ABSENCES.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
          }}>
            <div style={{
              width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
              background: ab.cover ? 'rgba(52,211,153,0.15)' : 'rgba(248,113,113,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.55rem', fontWeight: 900, color: 'white',
            }}>{ab.name.split(' ').map(n => n[0]).join('')}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'white' }}>{ab.name} <span style={{ color: 'rgba(255,255,255,0.3)', fontWeight: 500 }}>{ab.id}</span></div>
              <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>{ab.site} · {ab.shift} · {ab.reason}</div>
            </div>
            {ab.cover ? (
              <span style={{ fontSize: '0.62rem', fontWeight: 800, color: '#34d399', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.25)', padding: '0.2rem 0.6rem', borderRadius: '999px', flexShrink: 0 }}>
                ✓ Cover: {ab.cover}
              </span>
            ) : covered[ab.name] ? (
              <span style={{ fontSize: '0.62rem', fontWeight: 800, color: '#34d399', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.25)', padding: '0.2rem 0.6rem', borderRadius: '999px', flexShrink: 0 }}>
                ✓ Cover arranged
              </span>
            ) : (
              <button onClick={() => { setCovered(c => ({ ...c, [ab.name]: true })); showToast(`Cover arranged for ${ab.name}`); }}
                style={{ flexShrink: 0, padding: '0.3rem 0.7rem', borderRadius: '0.4rem', cursor: 'pointer', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171', fontSize: '0.62rem', fontWeight: 800 }}>
                Arrange cover
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Hours vs contracted */}
      <div style={{ borderRadius: '0.875rem', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ padding: '0.6rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Clock size={13} style={{ color: '#a78bfa' }} />
          <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'white' }}>Hours vs Contracted — this week</span>
          <span style={{ marginLeft: 'auto', fontSize: '0.58rem', color: 'rgba(255,255,255,0.3)' }}>Under-delivery = contract risk</span>
        </div>
        {HOURS_DATA.map((h, i) => {
          const over = h.delta > 0;
          const ok   = h.delta >= -2;
          const bad  = h.delta <= -10;
          const barPct = Math.min(100, (h.actual / h.contracted) * 100);
          return (
            <div key={h.site} style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 1rem',
              borderBottom: i < HOURS_DATA.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
            }}>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'rgba(255,255,255,0.65)', minWidth: 110 }}>{h.site}</span>
              <div style={{ flex: 1, height: 6, borderRadius: 9999, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 9999, width: `${barPct}%`, background: bad ? '#f87171' : ok ? '#34d399' : '#fbbf24' }} />
              </div>
              <span style={{ fontSize: '0.65rem', fontWeight: 800, minWidth: 60, textAlign: 'right', color: bad ? '#f87171' : ok ? 'rgba(255,255,255,0.6)' : '#fbbf24' }}>
                {h.actual}h / {h.contracted}h
              </span>
              <span style={{ fontSize: '0.62rem', fontWeight: 800, minWidth: 36, textAlign: 'right', color: bad ? '#f87171' : over ? '#34d399' : 'rgba(255,255,255,0.3)' }}>
                {h.delta > 0 ? `+${h.delta}` : h.delta}h
              </span>
            </div>
          );
        })}
      </div>

      {/* Site SLA overview */}
      <div style={{ borderRadius: '0.875rem', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ padding: '0.6rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ClipboardCheck size={13} style={{ color: '#34d399' }} />
          <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'white' }}>My Sites — SLA &amp; Audit Scores</span>
        </div>
        {SITES.map((site, i) => {
          const slaOk = site.sla >= 97;
          const auditOk = site.auditScore >= 92;
          const overdue = site.nextVisit === 'Overdue';
          return (
            <div key={site.id} style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.55rem 1rem',
              borderBottom: i < SITES.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
              background: overdue ? 'rgba(248,113,113,0.03)' : 'transparent',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{site.name}</div>
                <div style={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>{site.client} · {site.staff} staff · Next visit: <span style={{ color: overdue ? '#f87171' : 'rgba(255,255,255,0.5)', fontWeight: 700 }}>{site.nextVisit}</span></div>
              </div>
              <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0, alignItems: 'center' }}>
                <span style={{ fontSize: '0.62rem', fontWeight: 800, padding: '0.2rem 0.5rem', borderRadius: '999px', background: slaOk ? 'rgba(52,211,153,0.1)' : 'rgba(251,191,36,0.1)', color: slaOk ? '#34d399' : '#fbbf24', border: `1px solid ${slaOk ? 'rgba(52,211,153,0.25)' : 'rgba(251,191,36,0.25)'}` }}>
                  {site.sla}% SLA
                </span>
                <span style={{ fontSize: '0.62rem', fontWeight: 800, padding: '0.2rem 0.5rem', borderRadius: '999px', background: auditOk ? 'rgba(79,120,255,0.1)' : 'rgba(248,113,113,0.1)', color: auditOk ? '#818cf8' : '#f87171', border: `1px solid ${auditOk ? 'rgba(79,120,255,0.25)' : 'rgba(248,113,113,0.25)'}` }}>
                  {site.auditScore} audit
                </span>
                {site.issues > 0 && (
                  <span style={{ fontSize: '0.6rem', fontWeight: 800, color: '#fb923c', background: 'rgba(251,146,60,0.1)', border: '1px solid rgba(251,146,60,0.25)', padding: '0.2rem 0.5rem', borderRadius: '999px' }}>
                    {site.issues} issue{site.issues !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Staff messages */}
      <div style={{ borderRadius: '0.875rem', overflow: 'hidden', border: '1px solid rgba(99,102,241,0.2)', background: 'rgba(99,102,241,0.04)' }}>
        <div style={{ padding: '0.6rem 1rem', borderBottom: '1px solid rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <MessageSquare size={13} style={{ color: '#818cf8' }} />
          <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'white' }}>Messages from staff</span>
          {STAFF_MESSAGES.filter(m => !m.read).length > 0 && (
            <span style={{ marginLeft: 'auto', fontSize: '0.62rem', fontWeight: 900, color: '#818cf8', background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', padding: '0.15rem 0.5rem', borderRadius: '999px' }}>
              {STAFF_MESSAGES.filter(m => !readMsgs.has(m.time)).length} unread
            </span>
          )}
        </div>
        {STAFF_MESSAGES.map((msg, i) => {
          const isRead = readMsgs.has(msg.time);
          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '0.62rem 1rem',
              borderBottom: i < STAFF_MESSAGES.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
              background: isRead ? 'transparent' : 'rgba(99,102,241,0.03)',
              cursor: 'pointer',
            }}
              onClick={() => setReadMsgs(r => new Set([...r, msg.time]))}
            >
              <div style={{
                width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                background: isRead ? 'rgba(255,255,255,0.06)' : 'rgba(99,102,241,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.52rem', fontWeight: 900, color: 'white',
              }}>{msg.name.split(' ').map(n => n[0]).join('')}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: 2 }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'white' }}>{msg.name}</span>
                  <span style={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.3)' }}>{msg.id} · {msg.site}</span>
                </div>
                <div style={{ fontSize: '0.62rem', color: isRead ? 'rgba(255,255,255,0.38)' : 'rgba(255,255,255,0.6)', lineHeight: 1.4 }}>{msg.text}</div>
                <div style={{ fontSize: '0.57rem', color: 'rgba(255,255,255,0.25)', marginTop: 2 }}>{msg.time}</div>
              </div>
              {!isRead && (
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#818cf8', flexShrink: 0, marginTop: 4 }} />
              )}
              {isRead && (
                <button onClick={e => { e.stopPropagation(); showToast(`Replying to ${msg.name}`); }}
                  style={{ flexShrink: 0, padding: '0.25rem 0.6rem', borderRadius: '0.35rem', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)', fontSize: '0.58rem', fontWeight: 700 }}>
                  Reply
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─────────────────── TODAY'S ROUND TAB ─────────────────── */

function RoundTab({ showToast }) {
  const [visited, setVisited] = useState({});
  const [auditOpen, setAuditOpen] = useState(null);
  const [scores, setScores] = useState({});

  const AUDIT_ITEMS = ['Floors — swept, mopped, dry', 'Toilets — clean, stocked, odour-free', 'Reception/common areas', 'Waste removal completed', 'Operative in uniform + ID badge', 'COSHH products stored correctly', 'Cleaning schedule signed off'];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-white font-black text-lg leading-tight mb-1">Today's Round</h2>
        <p className="text-white/35 text-xs">Wednesday 27 May 2026 · 3 visits scheduled</p>
      </div>

      {VISIT_SCHEDULE.map((v, i) => {
        const done = visited[v.site];
        const isOverdue = v.status === 'overdue';
        const isOpen = auditOpen === v.site;
        const siteScores = scores[v.site] || {};
        const checkedCount = Object.values(siteScores).filter(Boolean).length;

        return (
          <div key={i} style={{
            borderRadius: '0.875rem', overflow: 'hidden',
            border: `1px solid ${done ? 'rgba(52,211,153,0.3)' : isOverdue ? 'rgba(248,113,113,0.3)' : 'rgba(255,255,255,0.08)'}`,
            background: done ? 'rgba(52,211,153,0.04)' : isOverdue ? 'rgba(248,113,113,0.04)' : 'rgba(255,255,255,0.02)',
          }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.875rem 1rem' }}>
              <div style={{
                width: 44, height: 44, borderRadius: '0.6rem', flexShrink: 0,
                background: done ? 'rgba(52,211,153,0.15)' : isOverdue ? 'rgba(248,113,113,0.12)' : 'rgba(79,120,255,0.12)',
                border: `1px solid ${done ? 'rgba(52,211,153,0.3)' : isOverdue ? 'rgba(248,113,113,0.3)' : 'rgba(79,120,255,0.25)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.7rem', fontWeight: 900, color: done ? '#34d399' : isOverdue ? '#f87171' : '#818cf8',
              }}>
                {done ? '✓' : v.time}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 900, color: 'white' }}>{v.site}</div>
                <div style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{v.purpose}</div>
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: 4 }}>
                  <span style={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', gap: 3 }}>
                    <MapPin size={9} /> {v.addr}
                  </span>
                  <span style={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', gap: 3 }}>
                    <Phone size={9} /> {v.contact}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                {isOverdue && !done && (
                  <span style={{ fontSize: '0.6rem', fontWeight: 800, color: '#f87171', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)', padding: '0.2rem 0.6rem', borderRadius: '999px' }}>Overdue</span>
                )}
                {done ? (
                  <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#34d399', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.25)', padding: '0.3rem 0.8rem', borderRadius: '0.4rem' }}>✓ Visit logged</span>
                ) : (
                  <button onClick={() => setAuditOpen(isOpen ? null : v.site)} style={{
                    padding: '0.35rem 0.85rem', borderRadius: '0.4rem', cursor: 'pointer', border: 'none',
                    background: 'linear-gradient(135deg, #4f78ff, #6366f1)',
                    color: 'white', fontSize: '0.65rem', fontWeight: 800,
                  }}>
                    {isOpen ? 'Close audit' : 'Start audit →'}
                  </button>
                )}
              </div>
            </div>

            {/* Audit checklist */}
            {isOpen && !done && (
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '0.875rem 1rem', background: 'rgba(79,120,255,0.04)' }}>
                <div style={{ fontSize: '0.6rem', fontWeight: 800, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.6rem' }}>
                  Quality Audit Checklist · {checkedCount}/{AUDIT_ITEMS.length} checked
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginBottom: '0.875rem' }}>
                  {AUDIT_ITEMS.map(item => {
                    const checked = siteScores[item];
                    return (
                      <label key={item} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                        <input type="checkbox" checked={!!checked}
                          onChange={e => setScores(s => ({ ...s, [v.site]: { ...siteScores, [item]: e.target.checked } }))}
                          style={{ accentColor: '#4f78ff', width: 14, height: 14, flexShrink: 0 }} />
                        <span style={{ fontSize: '0.65rem', color: checked ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.45)' }}>{item}</span>
                      </label>
                    );
                  })}
                </div>
                <button
                  onClick={() => { setVisited(vis => ({ ...vis, [v.site]: true })); setAuditOpen(null); showToast(`Audit logged for ${v.site}`); }}
                  style={{
                    width: '100%', padding: '0.6rem', borderRadius: '0.5rem', cursor: 'pointer', border: 'none',
                    background: checkedCount > 0 ? 'linear-gradient(135deg, #34d399, #059669)' : 'rgba(255,255,255,0.06)',
                    color: checkedCount > 0 ? 'white' : 'rgba(255,255,255,0.3)',
                    fontSize: '0.68rem', fontWeight: 800,
                  }}>
                  Submit audit &amp; log visit ✓
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────────── STAFF TAB ─────────────────── */

const FLAG_CFG = {
  rtw:        { label: 'RTW Interview',   color: '#f87171', bg: 'rgba(248,113,113,0.1)'  },
  review:     { label: 'Review Due',      color: '#fbbf24', bg: 'rgba(251,191,36,0.08)'  },
  onboarding: { label: 'Onboarding',      color: '#60a5fa', bg: 'rgba(96,165,250,0.1)'   },
  conduct:    { label: 'Active Warning',  color: '#fb923c', bg: 'rgba(251,146,60,0.08)'  },
  training:   { label: 'Training Expiry', color: '#a78bfa', bg: 'rgba(167,139,250,0.1)'  },
};

function StaffTab({ showToast }) {
  const [actioned,  setActioned]  = useState(new Set());
  const [approved,  setApproved]  = useState(new Set());
  const [declined,  setDeclined]  = useState(new Set());

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-white font-black text-lg leading-tight mb-1">Staff</h2>
        <p className="text-white/35 text-xs">Action items across your 30-person patch</p>
      </div>

      {/* Holiday requests */}
      <div style={{ borderRadius: '0.875rem', overflow: 'hidden', border: '1px solid rgba(167,139,250,0.2)', background: 'rgba(167,139,250,0.04)' }}>
        <div style={{ padding: '0.6rem 1rem', borderBottom: '1px solid rgba(167,139,250,0.15)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Umbrella size={13} style={{ color: '#a78bfa' }} />
          <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'white' }}>Holiday Requests — pending approval</span>
          <span style={{ marginLeft: 'auto', fontSize: '0.62rem', fontWeight: 800, color: '#a78bfa', background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.25)', padding: '0.15rem 0.5rem', borderRadius: '999px' }}>
            {HOLIDAY_REQUESTS.length - approved.size - declined.size} pending
          </span>
        </div>
        {HOLIDAY_REQUESTS.map((req, i) => {
          const isApproved = approved.has(i);
          const isDeclined = declined.has(i);
          const isDone     = isApproved || isDeclined;
          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.62rem 1rem',
              borderBottom: i < HOLIDAY_REQUESTS.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
              opacity: isDone ? 0.55 : 1,
            }}>
              <div style={{
                width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                background: isDone ? 'rgba(255,255,255,0.06)' : 'rgba(167,139,250,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.52rem', fontWeight: 900, color: 'white',
              }}>{req.name.split(' ').map(n => n[0]).join('')}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'white' }}>
                  {req.name} <span style={{ color: 'rgba(255,255,255,0.3)', fontWeight: 500 }}>{req.id}</span>
                </div>
                <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>
                  {req.from} – {req.to} · {req.days} days · {req.reason} · {req.site}
                </div>
                <div style={{ fontSize: '0.57rem', color: 'rgba(255,255,255,0.25)', marginTop: 1 }}>Submitted {req.submitted} · Cover: {req.cover}</div>
              </div>
              {isDone ? (
                <span style={{ flexShrink: 0, fontSize: '0.62rem', fontWeight: 800, color: isApproved ? '#34d399' : '#f87171' }}>
                  {isApproved ? '✓ Approved' : '✗ Declined'}
                </span>
              ) : (
                <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0 }}>
                  <button onClick={() => { setApproved(a => new Set([...a, i])); showToast(`Holiday approved for ${req.name}`); }}
                    style={{ padding: '0.28rem 0.65rem', borderRadius: '0.35rem', cursor: 'pointer', border: '1px solid rgba(52,211,153,0.3)', background: 'rgba(52,211,153,0.1)', color: '#34d399', fontSize: '0.6rem', fontWeight: 800 }}>
                    Approve
                  </button>
                  <button onClick={() => { setDeclined(d => new Set([...d, i])); showToast(`Holiday declined for ${req.name}`); }}
                    style={{ padding: '0.28rem 0.65rem', borderRadius: '0.35rem', cursor: 'pointer', border: '1px solid rgba(248,113,113,0.3)', background: 'rgba(248,113,113,0.08)', color: '#f87171', fontSize: '0.6rem', fontWeight: 800 }}>
                    Decline
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.65rem' }}>
        {[
          { label: 'Action items',   value: STAFF_FLAGS.length,                        color: '#fb923c' },
          { label: 'High urgency',   value: STAFF_FLAGS.filter(f => f.urgency === 'high').length, color: '#f87171' },
          { label: 'RTW due',        value: STAFF_FLAGS.filter(f => f.type === 'rtw').length,     color: '#fbbf24' },
          { label: 'Training expiry',value: STAFF_FLAGS.filter(f => f.type === 'training').length,color: '#a78bfa' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ borderRadius: '0.75rem', padding: '0.75rem 0.9rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div style={{ fontWeight: 900, fontSize: '1.5rem', color, lineHeight: 1 }}>{value}</div>
            <div style={{ fontSize: '0.6rem', fontWeight: 700, color: 'rgba(255,255,255,0.4)', marginTop: 3 }}>{label}</div>
          </div>
        ))}
      </div>

      <div style={{ borderRadius: '0.875rem', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ padding: '0.6rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Flag size={13} style={{ color: '#fb923c' }} />
          <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'white' }}>Action Items</span>
        </div>

        {STAFF_FLAGS.map((flag, i) => {
          const cfg = FLAG_CFG[flag.type];
          const done = actioned.has(i);
          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '0.7rem 1rem',
              borderBottom: i < STAFF_FLAGS.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
              opacity: done ? 0.5 : 1,
            }}>
              <div style={{
                marginTop: 2, padding: '0.2rem 0.5rem', borderRadius: '0.35rem', flexShrink: 0,
                background: cfg.bg, border: `1px solid ${cfg.color}30`,
                fontSize: '0.55rem', fontWeight: 800, color: cfg.color,
              }}>{cfg.label}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: 2 }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'white' }}>{flag.name}</span>
                  <span style={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.3)' }}>{flag.id}</span>
                  {flag.urgency === 'high' && (
                    <span style={{ fontSize: '0.52rem', fontWeight: 900, color: '#f87171', background: 'rgba(248,113,113,0.1)', padding: '0.1rem 0.4rem', borderRadius: '999px', border: '1px solid rgba(248,113,113,0.25)' }}>URGENT</span>
                  )}
                </div>
                <div style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.45)', lineHeight: 1.4 }}>{flag.detail}</div>
                <div style={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.25)', marginTop: 2 }}>{flag.site}</div>
              </div>
              {done ? (
                <span style={{ flexShrink: 0, fontSize: '0.62rem', fontWeight: 800, color: '#34d399' }}>✓ Done</span>
              ) : (
                <button onClick={() => { setActioned(a => new Set([...a, i])); showToast(`${flag.name} — ${cfg.label} actioned`); }}
                  style={{ flexShrink: 0, padding: '0.3rem 0.7rem', borderRadius: '0.4rem', cursor: 'pointer', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.5)', fontSize: '0.62rem', fontWeight: 800 }}>
                  Mark done
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─────────────────── CLIENT LOG TAB ─────────────────── */

const MOOD_CFG = {
  'good':    { label: 'Good',    color: '#34d399', bg: 'rgba(52,211,153,0.1)'  },
  'watch':   { label: 'Watch',   color: '#fbbf24', bg: 'rgba(251,191,36,0.08)' },
  'at-risk': { label: 'At Risk', color: '#f87171', bg: 'rgba(248,113,113,0.1)' },
};

function ClientTab({ showToast }) {
  const [expandedSite, setExpandedSite] = useState('HSBC Birmingham');

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-white font-black text-lg leading-tight mb-1">Client Log</h2>
        <p className="text-white/35 text-xs">Open issues, contact history and scheduled reviews per site</p>
      </div>

      {CLIENT_LOG.map(cl => {
        const mood = MOOD_CFG[cl.mood];
        const isOpen = expandedSite === cl.site;
        const openCount = cl.openIssues.filter(x => x.status === 'open').length;

        return (
          <div key={cl.site} style={{
            borderRadius: '0.875rem', overflow: 'hidden',
            border: `1px solid ${isOpen ? `${mood.color}30` : 'rgba(255,255,255,0.08)'}`,
            background: isOpen ? `${mood.color}04` : 'rgba(255,255,255,0.02)',
          }}>
            {/* Row header */}
            <button onClick={() => setExpandedSite(isOpen ? null : cl.site)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.8rem 1rem', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 2 }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 900, color: 'white' }}>{cl.site}</span>
                  <span style={{ fontSize: '0.55rem', fontWeight: 800, color: mood.color, background: mood.bg, border: `1px solid ${mood.color}30`, padding: '0.15rem 0.45rem', borderRadius: '999px' }}>{mood.label}</span>
                </div>
                <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.35)' }}>
                  Contact: {cl.client} · Last contact: {cl.lastContact} · Next review: {cl.nextReview}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0, alignItems: 'center' }}>
                {openCount > 0 && (
                  <span style={{ fontSize: '0.6rem', fontWeight: 800, color: '#fb923c', background: 'rgba(251,146,60,0.1)', border: '1px solid rgba(251,146,60,0.25)', padding: '0.2rem 0.5rem', borderRadius: '999px' }}>
                    {openCount} open
                  </span>
                )}
                <span style={{ fontSize: '0.68rem', fontWeight: 800, color: cl.lastAudit >= 95 ? '#34d399' : cl.lastAudit >= 90 ? '#fbbf24' : '#f87171' }}>
                  {cl.lastAudit} audit
                </span>
              </div>
            </button>

            {/* Expanded */}
            {isOpen && (
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '0.75rem 1rem', background: 'rgba(0,0,0,0.15)' }}>
                {cl.openIssues.length === 0 ? (
                  <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', padding: '0.5rem 0' }}>✓ No open issues — all clear</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginBottom: '0.75rem' }}>
                    <div style={{ fontSize: '0.55rem', fontWeight: 800, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.2rem' }}>Open Issues</div>
                    {cl.openIssues.map((issue, j) => (
                      <div key={j} style={{
                        display: 'flex', alignItems: 'flex-start', gap: '0.5rem', padding: '0.45rem 0.65rem', borderRadius: '0.5rem',
                        background: issue.status === 'open' ? 'rgba(251,146,60,0.06)' : 'rgba(52,211,153,0.05)',
                        border: `1px solid ${issue.status === 'open' ? 'rgba(251,146,60,0.15)' : 'rgba(52,211,153,0.15)'}`,
                      }}>
                        <span style={{ fontSize: '0.55rem', fontWeight: 700, color: 'rgba(255,255,255,0.3)', flexShrink: 0, marginTop: 1 }}>{issue.date}</span>
                        <span style={{ fontSize: '0.63rem', color: 'rgba(255,255,255,0.6)', flex: 1, lineHeight: 1.4 }}>{issue.desc}</span>
                        <span style={{ flexShrink: 0, fontSize: '0.58rem', fontWeight: 800, color: issue.status === 'open' ? '#fb923c' : '#34d399' }}>
                          {issue.status === 'open' ? 'Open' : '✓ Actioned'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <button onClick={() => showToast(`Calling ${cl.client}`)} style={{
                    flex: 1, padding: '0.45rem', borderRadius: '0.4rem', cursor: 'pointer',
                    background: 'rgba(79,120,255,0.1)', border: '1px solid rgba(79,120,255,0.25)', color: '#818cf8',
                    fontSize: '0.62rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem',
                  }}>
                    <Phone size={11} /> Call {cl.client}
                  </button>
                  <button onClick={() => showToast(`Issue logged for ${cl.site}`)} style={{
                    flex: 1, padding: '0.45rem', borderRadius: '0.4rem', cursor: 'pointer',
                    background: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.2)', color: '#fb923c',
                    fontSize: '0.62rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem',
                  }}>
                    <Flag size={11} /> Log issue
                  </button>
                  <button onClick={() => showToast(`Preparing visit report for ${cl.site}`)} style={{
                    flex: 1, padding: '0.45rem', borderRadius: '0.4rem', cursor: 'pointer',
                    background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)', color: '#34d399',
                    fontSize: '0.62rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem',
                  }}>
                    <FileText size={11} /> Visit report
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────────── MAIN EXPORT ─────────────────── */

export default function FmAreaManager({ showToast }) {
  const [activeTab, setActiveTab] = useState('briefing');

  return (
    <div style={{ padding: '1.25rem 1.5rem 3rem' }}>

      {/* Tab bar */}
      <div style={{
        display: 'flex', gap: '0.25rem', marginBottom: '1.5rem',
        background: 'rgba(255,255,255,0.03)', borderRadius: '0.75rem',
        padding: '0.25rem', border: '1px solid rgba(255,255,255,0.07)',
      }}>
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = activeTab === id;
          return (
            <button key={id} onClick={() => setActiveTab(id)} style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
              padding: '0.55rem 0.5rem', borderRadius: '0.55rem', border: 'none', cursor: 'pointer',
              background: active ? 'rgba(255,255,255,0.08)' : 'transparent',
              color: active ? 'white' : 'rgba(255,255,255,0.35)',
              fontSize: '0.7rem', fontWeight: 800, transition: 'all 0.15s',
              boxShadow: active ? '0 1px 4px rgba(0,0,0,0.2)' : 'none',
            }}>
              <Icon size={13} />
              {label}
            </button>
          );
        })}
      </div>

      {activeTab === 'briefing' && <BriefingTab showToast={showToast} />}
      {activeTab === 'round'    && <RoundTab    showToast={showToast} />}
      {activeTab === 'staff'    && <StaffTab    showToast={showToast} />}
      {activeTab === 'clients'  && <ClientTab   showToast={showToast} />}
    </div>
  );
}
