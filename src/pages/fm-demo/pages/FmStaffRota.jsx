import { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Smartphone,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Calendar,
  Umbrella,
  Upload,
  Link2,
  ChevronDown,
  Clock,
  Users,
  FileSpreadsheet,
} from 'lucide-react';
import HowItWorks from '../components/HowItWorks';

/* ─────────────────── shared data ─────────────────── */

const DAYS = ['Mon 26', 'Tue 27', 'Wed 28', 'Thu 29', 'Fri 30', 'Sat 31', 'Sun 1'];

const SITES = {
  'L&D Hospital': {
    color: '#3b82f6',
    bg: 'rgba(59,130,246,0.15)',
    short: 'L&D Hosp',
    time: '05:00',
  },
  'Luton Town Hall': {
    color: '#8b5cf6',
    bg: 'rgba(139,92,246,0.15)',
    short: 'Town Hall',
    time: '06:00',
  },
  'Premier Inn': {
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.15)',
    short: 'Premier Inn',
    time: '08:00',
  },
  'Aldi Dunstable': { color: '#10b981', bg: 'rgba(16,185,129,0.15)', short: 'Aldi', time: '04:00' },
  'HSBC Bham': { color: '#ea580c', bg: 'rgba(234,88,12,0.15)', short: 'HSBC', time: '07:00' },
};

const STAFF = [
  { name: 'Tara Hobson', id: 'E-0445', contracted: 37.5, app: true },
  { name: 'Sarah Patel', id: 'E-0112', contracted: 30, app: true },
  { name: 'Claire Nduka', id: 'E-0234', contracted: 37.5, app: true },
  { name: 'Marcus Webb', id: 'E-0311', contracted: 40, app: true },
  { name: 'Priya Sharma', id: 'E-0178', contracted: 20, app: true },
  { name: 'Amina Hassan', id: 'E-0402', contracted: 30, app: false },
  { name: 'Tom Griffiths', id: 'E-0089', contracted: 37.5, app: true },
  { name: 'James Okafor', id: 'E-0501', contracted: 37.5, app: true },
];

// null = day off, 'AL' = annual leave
const ROTA = [
  ['L&D Hospital', 'L&D Hospital', 'L&D Hospital', 'L&D Hospital', 'L&D Hospital', null, null],
  [
    'Luton Town Hall',
    'Luton Town Hall',
    'Luton Town Hall',
    null,
    'Luton Town Hall',
    'Luton Town Hall',
    null,
  ],
  ['Premier Inn', 'Premier Inn', null, 'Premier Inn', 'Premier Inn', 'Premier Inn', null],
  [
    'Aldi Dunstable',
    'Aldi Dunstable',
    'Aldi Dunstable',
    'Aldi Dunstable',
    'Aldi Dunstable',
    null,
    null,
  ],
  [null, 'L&D Hospital', null, 'L&D Hospital', null, 'L&D Hospital', null],
  ['Luton Town Hall', null, 'Luton Town Hall', 'Luton Town Hall', null, null, null],
  ['AL', 'AL', 'AL', 'AL', 'AL', null, null],
  ['Aldi Dunstable', 'Aldi Dunstable', null, 'Aldi Dunstable', 'Aldi Dunstable', null, null],
];

/* ─────────────────── holiday data ─────────────────── */

const LEAVE_REQUESTS = [
  {
    name: 'Sarah Patel',
    id: 'E-0112',
    avatar: 'SP',
    dates: '8–12 Jun 2026',
    days: 5,
    type: 'Annual Leave',
    status: 'pending',
    cover: 'unassigned',
  },
  {
    name: 'Marcus Webb',
    id: 'E-0311',
    avatar: 'MW',
    dates: '22–23 Jun 2026',
    days: 2,
    type: 'Annual Leave',
    status: 'pending',
    cover: 'unassigned',
  },
  {
    name: 'Claire Nduka',
    id: 'E-0234',
    avatar: 'CN',
    dates: '15 Jun 2026',
    days: 1,
    type: 'Emergency Leave',
    status: 'pending',
    cover: 'unassigned',
  },
  {
    name: 'Priya Sharma',
    id: 'E-0178',
    avatar: 'PS',
    dates: '1–5 Sep 2026',
    days: 5,
    type: 'Annual Leave',
    status: 'approved',
    cover: 'Tara Hobson',
  },
  {
    name: 'Tom Griffiths',
    id: 'E-0089',
    avatar: 'TG',
    dates: '26–30 May 2026',
    days: 5,
    type: 'Annual Leave',
    status: 'approved',
    cover: 'James Okafor (partial)',
  },
  {
    name: 'James Okafor',
    id: 'E-0501',
    avatar: 'JO',
    dates: '14–16 Jul 2026',
    days: 3,
    type: 'Annual Leave',
    status: 'approved',
    cover: 'Marcus Webb',
  },
];

const ENTITLEMENTS = [
  { name: 'Tara Hobson', hours: 37.5, total: 28, used: 5, pending: 0, remaining: 23 },
  { name: 'Sarah Patel', hours: 30, total: 28, used: 3, pending: 5, remaining: 20 },
  { name: 'Claire Nduka', hours: 37.5, total: 28, used: 8, pending: 1, remaining: 19 },
  { name: 'Marcus Webb', hours: 40, total: 28, used: 6, pending: 2, remaining: 20 },
  { name: 'Priya Sharma', hours: 20, total: 28, used: 2, pending: 5, remaining: 21 },
  { name: 'Amina Hassan', hours: 30, total: 28, used: 4, pending: 0, remaining: 24 },
  { name: 'Tom Griffiths', hours: 37.5, total: 28, used: 10, pending: 0, remaining: 18 },
  { name: 'James Okafor', hours: 37.5, total: 28, used: 4, pending: 3, remaining: 21 },
];

const BANK_HOLIDAYS = [
  { date: '25 Aug 2026', name: 'Summer Bank Holiday', affected: 6 },
  { date: '25 Dec 2026', name: 'Christmas Day', affected: 4 },
  { date: '26 Dec 2026', name: 'Boxing Day', affected: 3 },
  { date: '1 Jan 2027', name: "New Year's Day", affected: 5 },
];

/* ─────────────────── import integrations ─────────────────── */

const INTEGRATIONS = [
  {
    name: 'Rotacloud',
    desc: 'Pull your existing rotas, staff profiles and leave history directly.',
    logo: '🔄',
    color: '#3b82f6',
    status: 'connect',
    fields: ['Rotas', 'Staff profiles', 'Leave history', 'Sites'],
  },
  {
    name: 'Deputy',
    desc: 'Import shifts, timesheets and employee data from Deputy.',
    logo: '📋',
    color: '#6366f1',
    status: 'connect',
    fields: ['Shifts', 'Timesheets', 'Employees', 'Award rules'],
  },
  {
    name: 'When I Work',
    desc: 'Sync your existing shift schedule and staff roster.',
    logo: '🗓',
    color: '#0ea5e9',
    status: 'connect',
    fields: ['Shifts', 'Staff', 'Time-off requests'],
  },
  {
    name: 'Fourth (HotSchedules)',
    desc: 'Enterprise rota and workforce data, fully imported.',
    logo: '🏢',
    color: '#8b5cf6',
    status: 'connect',
    fields: ['Rotas', 'Labour forecasts', 'HR records'],
  },
  {
    name: 'Excel / CSV',
    desc: 'Upload any spreadsheet — Cadi maps the columns and builds your rota.',
    logo: '📊',
    color: '#22c55e',
    status: 'upload',
    fields: ['Staff names', 'Sites/shifts', 'Hours', 'Pay rates'],
  },
  {
    name: 'Google Sheets',
    desc: 'Paste a share link — Cadi reads it live and converts it to a managed rota.',
    logo: '🔗',
    color: '#f59e0b',
    status: 'link',
    fields: ['Any structured sheet', 'Auto-refreshes on changes'],
  },
];

/* ─────────────────── sub-components ─────────────────── */

function RotaCell({ value }) {
  if (!value) return <div style={{ height: 38 }} />;
  if (value === 'AL')
    return (
      <div
        style={{
          height: 38,
          borderRadius: '0.4rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(107,114,128,0.12)',
          border: '1px dashed rgba(107,114,128,0.3)',
        }}
      >
        <span
          style={{
            fontSize: '0.55rem',
            fontWeight: 800,
            color: 'rgba(255,255,255,0.3)',
            letterSpacing: '0.06em',
          }}
        >
          LEAVE
        </span>
      </div>
    );
  const site = SITES[value];
  if (!site) return null;
  return (
    <div
      style={{
        height: 38,
        borderRadius: '0.4rem',
        padding: '0 0.4rem',
        background: site.bg,
        border: `1px solid ${site.color}30`,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 1,
      }}
    >
      <span style={{ fontSize: '0.52rem', fontWeight: 800, color: site.color, lineHeight: 1.2 }}>
        {site.short}
      </span>
      <span style={{ fontSize: '0.48rem', color: 'rgba(255,255,255,0.35)', fontWeight: 600 }}>
        {site.time}
      </span>
    </div>
  );
}

/* ── Rota Tab ── */
function RotaTab({ showToast }) {
  const [published, setPublished] = useState(false);
  const [, setWeekOffset] = useState(0);

  const confirmedCount = ROTA.flat()
    .filter(Boolean)
    .filter((v) => v !== 'AL').length;
  const staffOnApp = STAFF.filter((s) => s.app).length;
  const staffNoApp = STAFF.filter((s) => !s.app);

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
        }}
      >
        <div>
          <h2
            style={{
              color: 'white',
              fontWeight: 900,
              fontSize: '1.05rem',
              margin: '0 0 0.2rem',
              letterSpacing: '-0.01em',
            }}
          >
            Staff Rota
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.7rem', margin: 0 }}>
            Week of 25 May – 31 May 2026 · Contract Cleaning · All Regions
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {published ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.45rem 1rem',
                borderRadius: '0.5rem',
                background: 'rgba(22,163,74,0.12)',
                border: '1px solid rgba(22,163,74,0.3)',
              }}
            >
              <CheckCircle2 size={14} style={{ color: '#4ade80', flexShrink: 0 }} />
              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#4ade80' }}>
                Rota published
              </span>
            </div>
          ) : (
            <button
              onClick={() => setPublished(true)}
              style={{
                padding: '0.45rem 1rem',
                borderRadius: '0.5rem',
                border: 'none',
                background: 'linear-gradient(135deg, #ea580c, #c2410c)',
                color: 'white',
                fontSize: '0.72rem',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Publish Rota →
            </button>
          )}
        </div>
      </div>

      {/* Published confirmation */}
      {published && (
        <div
          style={{
            borderRadius: '0.875rem',
            overflow: 'hidden',
            border: '1px solid rgba(22,163,74,0.3)',
            background: 'rgba(22,163,74,0.06)',
          }}
        >
          <div
            style={{
              padding: '0.75rem 1rem',
              borderBottom: '1px solid rgba(22,163,74,0.15)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
            }}
          >
            <CheckCircle2 size={16} style={{ color: '#4ade80', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 900, fontSize: '0.78rem', color: '#4ade80' }}>
                Rota published · 25 May – 31 May 2026
              </div>
              <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>
                {staffOnApp} push notifications sent · {staffNoApp.length} SMS fallback
              </div>
            </div>
            <a
              href="/staff-demo"
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
                padding: '0.32rem 0.75rem',
                borderRadius: '0.4rem',
                textDecoration: 'none',
                background: 'rgba(22,163,74,0.15)',
                border: '1px solid rgba(22,163,74,0.3)',
                color: '#4ade80',
                fontSize: '0.62rem',
                fontWeight: 800,
                flexShrink: 0,
              }}
            >
              <ExternalLink size={10} />
              See staff view →
            </a>
          </div>
          <div
            style={{
              padding: '0.65rem 1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.35rem',
            }}
          >
            {STAFF.map((s) => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    flexShrink: 0,
                    background: 'linear-gradient(135deg, rgba(234,88,12,0.4), rgba(194,65,12,0.3))',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.5rem',
                    fontWeight: 900,
                    color: 'white',
                  }}
                >
                  {s.name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')}
                </div>
                <span
                  style={{
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    color: 'rgba(255,255,255,0.65)',
                    flex: 1,
                  }}
                >
                  {s.name}
                </span>
                {s.app ? (
                  <span
                    style={{
                      fontSize: '0.58rem',
                      fontWeight: 700,
                      color: '#4ade80',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.2rem',
                    }}
                  >
                    <Smartphone size={9} /> Push notification sent
                  </span>
                ) : (
                  <span style={{ fontSize: '0.58rem', fontWeight: 700, color: '#fb923c' }}>
                    SMS fallback sent
                  </span>
                )}
              </div>
            ))}
          </div>
          {staffNoApp.length > 0 && (
            <div
              style={{
                margin: '0 1rem 0.75rem',
                borderRadius: '0.6rem',
                padding: '0.6rem 0.75rem',
                background: 'rgba(251,146,60,0.08)',
                border: '1px solid rgba(251,146,60,0.2)',
              }}
            >
              <div
                style={{
                  fontSize: '0.55rem',
                  fontWeight: 800,
                  color: 'rgba(251,146,60,0.7)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  marginBottom: '0.3rem',
                }}
              >
                SMS sent to {staffNoApp[0].name}
              </div>
              <div
                style={{
                  fontSize: '0.65rem',
                  color: 'rgba(255,255,255,0.5)',
                  lineHeight: 1.5,
                  fontStyle: 'italic',
                }}
              >
                "Hi {staffNoApp[0].name.split(' ')[0]}, your rota for 26 May–1 Jun is ready. View it
                by downloading the Cadi app: cadi.page.link/rota — Britannia Group"
              </div>
            </div>
          )}
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.65rem' }}>
        {[
          { label: 'Shifts this week', value: confirmedCount, color: '#ea580c' },
          { label: 'Staff scheduled', value: STAFF.length, color: '#16a34a' },
          { label: 'On Cadi app', value: `${staffOnApp}/${STAFF.length}`, color: '#3b82f6' },
          { label: 'Cover gaps', value: 1, color: '#f59e0b', alert: true },
        ].map(({ label, value, color, alert }) => (
          <div
            key={label}
            style={{
              borderRadius: '0.75rem',
              padding: '0.75rem 0.9rem',
              background: alert ? 'rgba(245,158,11,0.08)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${alert ? 'rgba(245,158,11,0.25)' : 'rgba(255,255,255,0.07)'}`,
            }}
          >
            <div style={{ fontWeight: 900, fontSize: '1.3rem', color: 'white', lineHeight: 1 }}>
              {value}
            </div>
            <div
              style={{
                fontSize: '0.6rem',
                fontWeight: 700,
                color: 'rgba(255,255,255,0.4)',
                marginTop: 3,
                display: 'flex',
                alignItems: 'center',
                gap: 3,
              }}
            >
              {alert && <AlertCircle size={9} style={{ color }} />}
              {label}
            </div>
          </div>
        ))}
      </div>

      {/* Cover gap alert */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          padding: '0.6rem 0.875rem',
          borderRadius: '0.6rem',
          background: 'rgba(245,158,11,0.08)',
          border: '1px solid rgba(245,158,11,0.25)',
        }}
      >
        <AlertCircle size={14} style={{ color: '#f59e0b', flexShrink: 0 }} />
        <span
          style={{ fontSize: '0.68rem', fontWeight: 700, color: 'rgba(255,255,255,0.7)', flex: 1 }}
        >
          Tom Griffiths is on annual leave all week ·{' '}
          <span style={{ color: '#f59e0b' }}>HSBC Birmingham has no cover Tue–Fri</span>
        </span>
        <button
          onClick={() => showToast('assign cover for HSBC Birmingham')}
          style={{
            flexShrink: 0,
            padding: '0.3rem 0.7rem',
            borderRadius: '0.35rem',
            background: 'rgba(245,158,11,0.2)',
            border: '1px solid rgba(245,158,11,0.35)',
            color: '#fbbf24',
            fontSize: '0.62rem',
            fontWeight: 800,
            cursor: 'pointer',
          }}
        >
          Assign Cover
        </button>
      </div>

      {/* Rota grid */}
      <div
        style={{
          borderRadius: '0.875rem',
          overflow: 'hidden',
          border: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(255,255,255,0.02)',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '160px repeat(7, 1fr)',
            padding: '0.6rem 0.75rem',
            gap: '0.35rem',
            borderBottom: '1px solid rgba(255,255,255,0.07)',
            background: 'rgba(255,255,255,0.03)',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <button
              onClick={() => setWeekOffset((w) => w - 1)}
              style={{
                background: 'none',
                border: 'none',
                color: 'rgba(255,255,255,0.3)',
                cursor: 'pointer',
                padding: '0.1rem',
              }}
            >
              <ChevronLeft size={14} />
            </button>
            <span
              style={{
                fontSize: '0.58rem',
                fontWeight: 800,
                color: 'rgba(255,255,255,0.3)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
            >
              Staff
            </span>
            <button
              onClick={() => setWeekOffset((w) => w + 1)}
              style={{
                background: 'none',
                border: 'none',
                color: 'rgba(255,255,255,0.3)',
                cursor: 'pointer',
                padding: '0.1rem',
              }}
            >
              <ChevronRight size={14} />
            </button>
          </div>
          {DAYS.map((d) => (
            <div
              key={d}
              style={{
                fontSize: '0.58rem',
                fontWeight: 800,
                color: 'rgba(255,255,255,0.4)',
                textAlign: 'center',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              {d}
            </div>
          ))}
        </div>
        {STAFF.map((staff, si) => (
          <div
            key={staff.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '160px repeat(7, 1fr)',
              padding: '0.35rem 0.75rem',
              gap: '0.35rem',
              alignItems: 'center',
              borderBottom: si < STAFF.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                paddingRight: '0.5rem',
              }}
            >
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: '50%',
                  flexShrink: 0,
                  background: 'linear-gradient(135deg, rgba(234,88,12,0.5), rgba(194,65,12,0.4))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.55rem',
                  fontWeight: 900,
                  color: 'white',
                }}
              >
                {staff.name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')}
              </div>
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: '0.65rem',
                    fontWeight: 800,
                    color: 'white',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {staff.name}
                </div>
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: 1 }}
                >
                  <Smartphone
                    size={8}
                    style={{
                      color: staff.app ? '#16a34a' : 'rgba(255,255,255,0.2)',
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ fontSize: '0.5rem', color: 'rgba(255,255,255,0.3)' }}>
                    {staff.contracted}h/wk
                  </span>
                </div>
              </div>
            </div>
            {ROTA[si].map((val, di) => (
              <RotaCell key={di} value={val} />
            ))}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
        {Object.entries(SITES).map(([name, { color }]) => (
          <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
            <span style={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.35)', fontWeight: 600 }}>
              {name}
            </span>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: 2,
              background: 'rgba(107,114,128,0.4)',
              border: '1px dashed rgba(107,114,128,0.5)',
            }}
          />
          <span style={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.35)', fontWeight: 600 }}>
            Annual Leave
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── Holiday & Leave Tab ── */
function HolidayTab({ showToast }) {
  const [requests, setRequests] = useState(LEAVE_REQUESTS);

  function approve(idx) {
    setRequests((r) => r.map((req, i) => (i === idx ? { ...req, status: 'approved' } : req)));
    showToast(`Leave approved for ${requests[idx].name}`);
  }
  function decline(idx) {
    setRequests((r) => r.map((req, i) => (i === idx ? { ...req, status: 'declined' } : req)));
    showToast(`Leave declined for ${requests[idx].name}`);
  }

  const pending = requests.filter((r) => r.status === 'pending').length;
  const approved = requests.filter((r) => r.status === 'approved').length;
  const totalUsed = ENTITLEMENTS.reduce((s, e) => s + e.used, 0);
  const totalPending = ENTITLEMENTS.reduce((s, e) => s + e.pending, 0);

  return (
    <div className="space-y-5">
      <div>
        <h2
          style={{
            color: 'white',
            fontWeight: 900,
            fontSize: '1.05rem',
            margin: '0 0 0.2rem',
            letterSpacing: '-0.01em',
          }}
        >
          Holiday &amp; Leave
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.7rem', margin: 0 }}>
          Annual leave requests, balances and bank holiday planning — all in one place.
        </p>
      </div>

      {/* Summary stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.65rem' }}>
        {[
          { label: 'Pending requests', value: pending, color: '#f59e0b', alert: pending > 0 },
          { label: 'Approved this year', value: approved, color: '#4ade80' },
          { label: 'Days used (team)', value: totalUsed, color: '#3b82f6' },
          { label: 'Days pending', value: totalPending, color: '#a78bfa' },
        ].map(({ label, value, color, alert }) => (
          <div
            key={label}
            style={{
              borderRadius: '0.75rem',
              padding: '0.75rem 0.9rem',
              background: alert ? 'rgba(245,158,11,0.08)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${alert ? 'rgba(245,158,11,0.25)' : 'rgba(255,255,255,0.07)'}`,
            }}
          >
            <div style={{ fontWeight: 900, fontSize: '1.3rem', color, lineHeight: 1 }}>{value}</div>
            <div
              style={{
                fontSize: '0.6rem',
                fontWeight: 700,
                color: 'rgba(255,255,255,0.4)',
                marginTop: 3,
              }}
            >
              {label}
            </div>
          </div>
        ))}
      </div>

      {/* Pending leave requests */}
      <div
        style={{
          borderRadius: '0.875rem',
          overflow: 'hidden',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <div
          style={{
            padding: '0.6rem 1rem',
            borderBottom: '1px solid rgba(255,255,255,0.07)',
            background: 'rgba(255,255,255,0.03)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <Umbrella size={13} style={{ color: '#a78bfa' }} />
          <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'white' }}>
            Leave Requests
          </span>
          {pending > 0 && (
            <span
              style={{
                marginLeft: 'auto',
                fontSize: '0.58rem',
                fontWeight: 800,
                color: '#f59e0b',
                background: 'rgba(245,158,11,0.12)',
                border: '1px solid rgba(245,158,11,0.25)',
                padding: '0.15rem 0.5rem',
                borderRadius: '999px',
              }}
            >
              {pending} pending
            </span>
          )}
        </div>

        {requests.map((req, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.65rem 1rem',
              borderBottom: i < requests.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
              background: req.status === 'pending' ? 'rgba(245,158,11,0.03)' : 'transparent',
            }}
          >
            {/* Avatar */}
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: '50%',
                flexShrink: 0,
                background:
                  req.status === 'approved'
                    ? 'rgba(74,222,128,0.15)'
                    : req.status === 'declined'
                      ? 'rgba(239,68,68,0.15)'
                      : 'rgba(245,158,11,0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.55rem',
                fontWeight: 900,
                color: 'white',
              }}
            >
              {req.avatar}
            </div>

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'white' }}>
                  {req.name}
                </span>
                <span style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.3)' }}>
                  {req.id}
                </span>
              </div>
              <div
                style={{
                  display: 'flex',
                  align: 'center',
                  gap: '0.5rem',
                  marginTop: 2,
                  flexWrap: 'wrap',
                }}
              >
                <span
                  style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}
                >
                  {req.dates} · {req.days} day{req.days !== 1 ? 's' : ''}
                </span>
                <span
                  style={{
                    fontSize: '0.55rem',
                    fontWeight: 700,
                    padding: '0.1rem 0.4rem',
                    borderRadius: '4px',
                    background:
                      req.type === 'Emergency Leave'
                        ? 'rgba(239,68,68,0.12)'
                        : 'rgba(167,139,250,0.12)',
                    color: req.type === 'Emergency Leave' ? '#f87171' : '#a78bfa',
                  }}
                >
                  {req.type}
                </span>
                {req.status === 'approved' && req.cover && (
                  <span style={{ fontSize: '0.58rem', color: '#4ade80', fontWeight: 600 }}>
                    Cover: {req.cover}
                  </span>
                )}
              </div>
            </div>

            {/* Status / actions */}
            {req.status === 'pending' ? (
              <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0 }}>
                <button
                  onClick={() => decline(i)}
                  style={{
                    padding: '0.3rem 0.65rem',
                    borderRadius: '0.4rem',
                    cursor: 'pointer',
                    background: 'rgba(239,68,68,0.1)',
                    border: '1px solid rgba(239,68,68,0.25)',
                    color: '#f87171',
                    fontSize: '0.62rem',
                    fontWeight: 800,
                  }}
                >
                  Decline
                </button>
                <button
                  onClick={() => approve(i)}
                  style={{
                    padding: '0.3rem 0.65rem',
                    borderRadius: '0.4rem',
                    cursor: 'pointer',
                    background: 'rgba(74,222,128,0.12)',
                    border: '1px solid rgba(74,222,128,0.3)',
                    color: '#4ade80',
                    fontSize: '0.62rem',
                    fontWeight: 800,
                  }}
                >
                  Approve
                </button>
              </div>
            ) : (
              <span
                style={{
                  flexShrink: 0,
                  fontSize: '0.62rem',
                  fontWeight: 800,
                  padding: '0.25rem 0.65rem',
                  borderRadius: '0.4rem',
                  background:
                    req.status === 'approved' ? 'rgba(74,222,128,0.1)' : 'rgba(239,68,68,0.1)',
                  border: `1px solid ${req.status === 'approved' ? 'rgba(74,222,128,0.25)' : 'rgba(239,68,68,0.25)'}`,
                  color: req.status === 'approved' ? '#4ade80' : '#f87171',
                }}
              >
                {req.status === 'approved' ? '✓ Approved' : '✕ Declined'}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Leave balances */}
      <div
        style={{
          borderRadius: '0.875rem',
          overflow: 'hidden',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <div
          style={{
            padding: '0.6rem 1rem',
            borderBottom: '1px solid rgba(255,255,255,0.07)',
            background: 'rgba(255,255,255,0.03)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <Users size={13} style={{ color: '#3b82f6' }} />
          <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'white' }}>
            Leave Balances · 2026
          </span>
          <span style={{ marginLeft: 'auto', fontSize: '0.58rem', color: 'rgba(255,255,255,0.3)' }}>
            28 days entitlement (FTE)
          </span>
        </div>

        {/* Column headers */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 60px 60px 60px 120px',
            padding: '0.4rem 1rem',
            gap: '0.5rem',
            background: 'rgba(255,255,255,0.02)',
            borderBottom: '1px solid rgba(255,255,255,0.05)',
          }}
        >
          {['Staff member', 'Total', 'Used', 'Pending', 'Remaining'].map((h) => (
            <span
              key={h}
              style={{
                fontSize: '0.55rem',
                fontWeight: 800,
                color: 'rgba(255,255,255,0.25)',
                textTransform: 'uppercase',
                letterSpacing: '0.07em',
                textAlign: h === 'Staff member' ? 'left' : 'center',
              }}
            >
              {h}
            </span>
          ))}
        </div>

        {ENTITLEMENTS.map((e, i) => {
          const pct = (e.used / e.total) * 100;
          const pendingPct = (e.pending / e.total) * 100;
          return (
            <div
              key={e.name}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 60px 60px 60px 120px',
                padding: '0.5rem 1rem',
                gap: '0.5rem',
                alignItems: 'center',
                borderBottom:
                  i < ENTITLEMENTS.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
              }}
            >
              <div
                style={{ fontSize: '0.65rem', fontWeight: 700, color: 'rgba(255,255,255,0.75)' }}
              >
                {e.name}
              </div>
              <div
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 800,
                  color: 'rgba(255,255,255,0.5)',
                  textAlign: 'center',
                }}
              >
                {e.total}
              </div>
              <div
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 800,
                  color: '#ea580c',
                  textAlign: 'center',
                }}
              >
                {e.used}
              </div>
              <div
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 800,
                  color: e.pending > 0 ? '#f59e0b' : 'rgba(255,255,255,0.2)',
                  textAlign: 'center',
                }}
              >
                {e.pending}
              </div>
              <div>
                {/* Progress bar */}
                <div
                  style={{
                    height: 5,
                    borderRadius: 9999,
                    background: 'rgba(255,255,255,0.08)',
                    overflow: 'hidden',
                    marginBottom: 3,
                  }}
                >
                  <div style={{ display: 'flex', height: '100%' }}>
                    <div
                      style={{
                        width: `${pct}%`,
                        background: '#ea580c',
                        borderRadius: '9999px 0 0 9999px',
                        flexShrink: 0,
                      }}
                    />
                    <div
                      style={{
                        width: `${pendingPct}%`,
                        background: 'rgba(245,158,11,0.6)',
                        flexShrink: 0,
                      }}
                    />
                  </div>
                </div>
                <div
                  style={{
                    fontSize: '0.52rem',
                    color: '#4ade80',
                    fontWeight: 700,
                    textAlign: 'right',
                  }}
                >
                  {e.remaining} left
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bank holidays */}
      <div
        style={{
          borderRadius: '0.875rem',
          overflow: 'hidden',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <div
          style={{
            padding: '0.6rem 1rem',
            borderBottom: '1px solid rgba(255,255,255,0.07)',
            background: 'rgba(255,255,255,0.03)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <Calendar size={13} style={{ color: '#34d399' }} />
          <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'white' }}>
            Upcoming Bank Holidays
          </span>
          <span style={{ marginLeft: 'auto', fontSize: '0.58rem', color: 'rgba(255,255,255,0.3)' }}>
            England & Wales
          </span>
        </div>
        <div style={{ padding: '0.5rem 0' }}>
          {BANK_HOLIDAYS.map((bh, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.5rem 1rem',
                borderBottom:
                  i < BANK_HOLIDAYS.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
              }}
            >
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: '0.45rem',
                  flexShrink: 0,
                  background: 'rgba(52,211,153,0.1)',
                  border: '1px solid rgba(52,211,153,0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.5rem',
                  fontWeight: 900,
                  color: '#34d399',
                  textAlign: 'center',
                  lineHeight: 1.2,
                }}
              >
                {bh.date.split(' ')[0]}
                <br />
                {bh.date.split(' ')[1]}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'white' }}>
                  {bh.name}
                </div>
                <div style={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>
                  {bh.date}
                </div>
              </div>
              <div
                style={{
                  fontSize: '0.58rem',
                  fontWeight: 700,
                  color: '#f59e0b',
                  background: 'rgba(245,158,11,0.1)',
                  border: '1px solid rgba(245,158,11,0.2)',
                  padding: '0.2rem 0.55rem',
                  borderRadius: '999px',
                  flexShrink: 0,
                }}
              >
                {bh.affected} staff affected
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Import Tab ── */
function ImportTab({ showToast }) {
  const [connected, setConnected] = useState({});
  const [expanded, setExpanded] = useState(null);

  function handleAction(integ) {
    if (integ.status === 'upload') {
      showToast('Spreadsheet uploaded — Cadi is mapping your columns');
    } else if (integ.status === 'link') {
      showToast('Google Sheets connected — rota imported successfully');
      setConnected((c) => ({ ...c, [integ.name]: true }));
    } else {
      showToast(`${integ.name} connected — importing your rota data`);
      setConnected((c) => ({ ...c, [integ.name]: true }));
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2
          style={{
            color: 'white',
            fontWeight: 900,
            fontSize: '1.05rem',
            margin: '0 0 0.2rem',
            letterSpacing: '-0.01em',
          }}
        >
          Import from existing software
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.7rem', margin: 0 }}>
          Already using rota or HR software? Connect it in minutes — Cadi pulls your staff, sites,
          shifts and leave history across automatically.
        </p>
      </div>

      {/* How it works strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '0.65rem',
          padding: '0.875rem 1rem',
          borderRadius: '0.875rem',
          background: 'rgba(79,120,255,0.06)',
          border: '1px solid rgba(79,120,255,0.15)',
        }}
      >
        {[
          {
            step: '1',
            icon: '🔗',
            title: 'Connect or upload',
            desc: 'OAuth connection or file upload — takes under 2 minutes.',
          },
          {
            step: '2',
            icon: '🗂',
            title: 'We map your data',
            desc: 'Cadi matches staff names, sites and shift patterns automatically.',
          },
          {
            step: '3',
            icon: '✅',
            title: 'Review & activate',
            desc: 'Confirm the import and your rota goes live. Staff keep their same schedule.',
          },
        ].map(({ step, icon, title, desc }) => (
          <div key={step} style={{ display: 'flex', gap: '0.6rem' }}>
            <div
              style={{
                width: 26,
                height: 26,
                borderRadius: '50%',
                flexShrink: 0,
                background: 'rgba(79,120,255,0.2)',
                border: '1px solid rgba(79,120,255,0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.6rem',
                fontWeight: 900,
                color: '#818cf8',
              }}
            >
              {step}
            </div>
            <div>
              <div style={{ fontSize: '0.65rem', fontWeight: 800, color: 'white' }}>
                {icon} {title}
              </div>
              <div
                style={{
                  fontSize: '0.58rem',
                  color: 'rgba(255,255,255,0.35)',
                  marginTop: 2,
                  lineHeight: 1.4,
                }}
              >
                {desc}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Integration cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {INTEGRATIONS.map((integ) => {
          const isConnected = !!connected[integ.name];
          const isOpen = expanded === integ.name;
          return (
            <div
              key={integ.name}
              style={{
                borderRadius: '0.875rem',
                overflow: 'hidden',
                border: isConnected
                  ? '1px solid rgba(74,222,128,0.3)'
                  : '1px solid rgba(255,255,255,0.08)',
                background: isConnected ? 'rgba(74,222,128,0.04)' : 'rgba(255,255,255,0.02)',
                transition: 'all 0.2s',
              }}
            >
              {/* Card header — always visible */}
              <button
                onClick={() => setExpanded(isOpen ? null : integ.name)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.75rem 1rem',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                {/* Logo */}
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: '0.6rem',
                    flexShrink: 0,
                    background: `${integ.color}18`,
                    border: `1px solid ${integ.color}35`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.1rem',
                  }}
                >
                  {integ.logo}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 900, color: 'white' }}>
                    {integ.name}
                  </div>
                  <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>
                    {integ.desc}
                  </div>
                </div>

                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}
                >
                  {isConnected ? (
                    <span
                      style={{
                        fontSize: '0.62rem',
                        fontWeight: 800,
                        color: '#4ade80',
                        background: 'rgba(74,222,128,0.12)',
                        border: '1px solid rgba(74,222,128,0.3)',
                        padding: '0.25rem 0.65rem',
                        borderRadius: '999px',
                      }}
                    >
                      ✓ Connected
                    </span>
                  ) : (
                    <span
                      style={{
                        fontSize: '0.62rem',
                        fontWeight: 800,
                        color: integ.color,
                        background: `${integ.color}12`,
                        border: `1px solid ${integ.color}30`,
                        padding: '0.25rem 0.65rem',
                        borderRadius: '999px',
                      }}
                    >
                      {integ.status === 'upload'
                        ? 'Upload'
                        : integ.status === 'link'
                          ? 'Paste link'
                          : 'Connect'}
                    </span>
                  )}
                  <ChevronDown
                    size={14}
                    style={{
                      color: 'rgba(255,255,255,0.25)',
                      transform: isOpen ? 'rotate(180deg)' : 'none',
                      transition: 'transform 0.2s',
                    }}
                  />
                </div>
              </button>

              {/* Expanded panel */}
              {isOpen && (
                <div
                  style={{
                    padding: '0 1rem 0.875rem',
                    borderTop: '1px solid rgba(255,255,255,0.06)',
                    paddingTop: '0.75rem',
                  }}
                >
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    {/* What gets imported */}
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontSize: '0.55rem',
                          fontWeight: 800,
                          color: 'rgba(255,255,255,0.25)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.08em',
                          marginBottom: '0.4rem',
                        }}
                      >
                        What we import
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        {integ.fields.map((f) => (
                          <div
                            key={f}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                          >
                            <CheckCircle2 size={10} style={{ color: integ.color, flexShrink: 0 }} />
                            <span style={{ fontSize: '0.63rem', color: 'rgba(255,255,255,0.55)' }}>
                              {f}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Action area */}
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.4rem',
                        justifyContent: 'center',
                        minWidth: 140,
                      }}
                    >
                      {integ.status === 'upload' ? (
                        <button
                          onClick={() => handleAction(integ)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.4rem',
                            padding: '0.55rem 1rem',
                            borderRadius: '0.5rem',
                            border: 'none',
                            cursor: 'pointer',
                            background: `linear-gradient(135deg, ${integ.color}, ${integ.color}cc)`,
                            color: 'white',
                            fontSize: '0.68rem',
                            fontWeight: 800,
                          }}
                        >
                          <FileSpreadsheet size={13} />
                          Upload file
                        </button>
                      ) : integ.status === 'link' ? (
                        <button
                          onClick={() => handleAction(integ)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.4rem',
                            padding: '0.55rem 1rem',
                            borderRadius: '0.5rem',
                            border: 'none',
                            cursor: 'pointer',
                            background: `linear-gradient(135deg, ${integ.color}, ${integ.color}cc)`,
                            color: 'white',
                            fontSize: '0.68rem',
                            fontWeight: 800,
                          }}
                        >
                          <Link2 size={13} />
                          Paste sheet link
                        </button>
                      ) : (
                        <button
                          onClick={() => handleAction(integ)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.4rem',
                            padding: '0.55rem 1rem',
                            borderRadius: '0.5rem',
                            background: isConnected
                              ? 'rgba(74,222,128,0.15)'
                              : `linear-gradient(135deg, ${integ.color}, ${integ.color}cc)`,
                            color: isConnected ? '#4ade80' : 'white',
                            fontSize: '0.68rem',
                            fontWeight: 800,
                            border: isConnected ? '1px solid rgba(74,222,128,0.3)' : 'none',
                            cursor: isConnected ? 'default' : 'pointer',
                          }}
                        >
                          {isConnected ? (
                            <>
                              <CheckCircle2 size={13} /> Connected
                            </>
                          ) : (
                            <>
                              <ExternalLink size={13} /> Connect via OAuth
                            </>
                          )}
                        </button>
                      )}
                      <div
                        style={{
                          fontSize: '0.55rem',
                          color: 'rgba(255,255,255,0.25)',
                          textAlign: 'center',
                          lineHeight: 1.4,
                        }}
                      >
                        {integ.status === 'upload'
                          ? 'Supports .csv · .xlsx · .ods'
                          : integ.status === 'link'
                            ? 'Any public or shared Google Sheet'
                            : 'Secure OAuth — we never store your password'}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Manual entry callout */}
      <div
        style={{
          borderRadius: '0.875rem',
          padding: '0.875rem 1rem',
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.07)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
        }}
      >
        <Clock size={18} style={{ color: 'rgba(255,255,255,0.2)', flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'rgba(255,255,255,0.5)' }}>
            Starting from scratch? We'll template it for you.
          </div>
          <div
            style={{
              fontSize: '0.6rem',
              color: 'rgba(255,255,255,0.3)',
              marginTop: 2,
              lineHeight: 1.4,
            }}
          >
            No existing rota software — no problem. Share your paper rota or WhatsApp schedule and
            Cadi builds your first digital rota in under an hour.
          </div>
        </div>
        <button
          onClick={() => showToast('Rota setup call booked with Cadi team')}
          style={{
            flexShrink: 0,
            padding: '0.45rem 0.875rem',
            borderRadius: '0.5rem',
            cursor: 'pointer',
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: 'rgba(255,255,255,0.5)',
            fontSize: '0.62rem',
            fontWeight: 800,
          }}
        >
          Book setup call
        </button>
      </div>
    </div>
  );
}

/* ─────────────────── main export ─────────────────── */

const TABS = [
  { id: 'rota', label: 'Rota', icon: Calendar },
  { id: 'holiday', label: 'Holiday & Leave', icon: Umbrella },
  { id: 'import', label: 'Import', icon: Upload },
];

export default function FmStaffRota({ showToast }) {
  const [activeTab, setActiveTab] = useState('rota');

  return (
    <div style={{ padding: '1.25rem 1.5rem 3rem' }}>
      <HowItWorks
        setupTime="1 hr for template"
        youSetUp={[
          'Your existing weekly rota pattern (or import from your current software)',
          'Public holiday and site closure preferences',
          'Annual leave entitlements per staff member',
        ]}
        cadiHandles={[
          'Builds weekly rotas from your template automatically',
          'Publishes to all staff apps in one click',
          'Sends SMS to any staff not yet on the app',
          'Flags cover gaps before shifts start — no last-minute calls',
          'Tracks leave balances and sends approval notifications',
        ]}
      />

      {/* Tab bar */}
      <div
        style={{
          display: 'flex',
          gap: '0.25rem',
          marginBottom: '1.25rem',
          background: 'rgba(255,255,255,0.03)',
          borderRadius: '0.75rem',
          padding: '0.25rem',
          border: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
                padding: '0.55rem 0.75rem',
                borderRadius: '0.55rem',
                border: 'none',
                cursor: 'pointer',
                background: active ? 'rgba(255,255,255,0.08)' : 'transparent',
                color: active ? 'white' : 'rgba(255,255,255,0.35)',
                fontSize: '0.7rem',
                fontWeight: 800,
                transition: 'all 0.15s',
                boxShadow: active ? '0 1px 4px rgba(0,0,0,0.2)' : 'none',
              }}
            >
              <Icon size={13} />
              {label}
            </button>
          );
        })}
      </div>

      {/* Active tab content */}
      {activeTab === 'rota' && <RotaTab showToast={showToast} />}
      {activeTab === 'holiday' && <HolidayTab showToast={showToast} />}
      {activeTab === 'import' && <ImportTab showToast={showToast} />}
    </div>
  );
}
