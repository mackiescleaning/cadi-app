import { useState } from 'react';
import {
  Users,
  ShieldCheck,
  FileText,
  AlertTriangle,
  GraduationCap,
  Clock,
  ChevronRight,
  Download,
  Search,
  Filter,
  Plus,
} from 'lucide-react';
import HowItWorks from '../components/HowItWorks';

const STATS = [
  {
    label: 'Total Employees',
    value: '1,487',
    sub: '13 onboarding this week',
    icon: Users,
    color: '#ea580c',
    bg: 'rgba(234,88,12,0.1)',
    border: 'rgba(234,88,12,0.25)',
    traffic: null,
  },
  {
    label: 'DBS Compliant',
    value: '98.4%',
    sub: '7 expiring within 7 days · 24 in 30 days',
    icon: ShieldCheck,
    color: '#16a34a',
    bg: 'rgba(22,163,74,0.12)',
    border: 'rgba(22,163,74,0.3)',
    traffic: 'green',
  },
  {
    label: 'Right to Work',
    value: '99.1%',
    sub: '13 docs due for renewal',
    icon: FileText,
    color: '#2563eb',
    bg: 'rgba(37,99,235,0.12)',
    border: 'rgba(37,99,235,0.3)',
    traffic: 'green',
  },
  {
    label: 'Training Up To Date',
    value: '91.2%',
    sub: '131 outstanding — action needed',
    icon: GraduationCap,
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.1)',
    border: 'rgba(245,158,11,0.28)',
    traffic: 'amber',
  },
];

const ALERTS = [
  {
    type: 'urgent',
    icon: AlertTriangle,
    color: '#ef4444',
    label: '7 DBS checks expire in 7 days',
    action: 'Review',
  },
  {
    type: 'warn',
    icon: Clock,
    color: '#f59e0b',
    label: '18 holiday requests awaiting approval',
    action: 'Approve',
  },
  {
    type: 'warn',
    icon: FileText,
    color: '#f59e0b',
    label: '4 employment contracts unsigned',
    action: 'Chase',
  },
  {
    type: 'info',
    icon: GraduationCap,
    color: '#3b82f6',
    label: 'Manual handling refresher due · 43 staff',
    action: 'Schedule',
  },
];

const EMPLOYEES = [
  {
    id: 'E-0112',
    name: 'Sarah Mitchell',
    role: 'Contract Cleaner',
    site: 'HSBC, Birmingham',
    dbs: 'valid',
    rtw: 'valid',
    training: 'ok',
    hours: '37.5/wk',
  },
  {
    id: 'E-0089',
    name: 'James Okafor',
    role: 'Senior Cleaner',
    site: 'DPD, Milton Keynes',
    dbs: 'expiring',
    rtw: 'valid',
    training: 'ok',
    hours: '37.5/wk',
  },
  {
    id: 'E-0234',
    name: 'Priya Sharma',
    role: 'Contract Cleaner',
    site: 'Magnet, Stafford',
    dbs: 'valid',
    rtw: 'due',
    training: 'overdue',
    hours: '20/wk',
  },
  {
    id: 'E-0311',
    name: 'Mark Brennan',
    role: 'Team Leader',
    site: 'NHS Trust, Coventry',
    dbs: 'valid',
    rtw: 'valid',
    training: 'ok',
    hours: '40/wk',
  },
  {
    id: 'E-0178',
    name: 'Amina Hassan',
    role: 'Contract Cleaner',
    site: 'B&Q, Wolverhampton',
    dbs: 'valid',
    rtw: 'valid',
    training: 'ok',
    hours: '30/wk',
  },
  {
    id: 'E-0402',
    name: 'Tom Griffiths',
    role: 'Contract Cleaner',
    site: 'Onboarding',
    dbs: 'pending',
    rtw: 'pending',
    training: 'pending',
    hours: '—',
  },
];

const STATUS = {
  valid: { label: '✓', color: '#16a34a', bg: 'rgba(22,163,74,0.1)' },
  expiring: { label: '!', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  due: { label: '!', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  overdue: { label: '✗', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
  pending: { label: '…', color: '#6366f1', bg: 'rgba(99,102,241,0.1)' },
  ok: { label: '✓', color: '#16a34a', bg: 'rgba(22,163,74,0.1)' },
};

const COMPLIANCE_BARS = [
  { label: 'DBS Checks', pct: 98, color: '#16a34a' },
  { label: 'Right to Work', pct: 99, color: '#2563eb' },
  { label: 'Training Completion', pct: 91, color: '#9333ea' },
  { label: 'Contract Signed', pct: 97, color: '#ea580c' },
];

export default function FmStaffHR({ showToast }) {
  const [search, setSearch] = useState('');
  const filtered = EMPLOYEES.filter(
    (e) =>
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.site.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ padding: '1.5rem 1.75rem 3rem', maxWidth: 960 }}>
      <HowItWorks
        setupTime="~1 hr"
        youSetUp={[
          'DBS certificate numbers and issue dates',
          'Right-to-work document types and expiry dates',
          'Training completion records (can bulk import)',
        ]}
        cadiHandles={[
          'Tracks every expiry and sends 30-day advance alerts',
          'Flags non-compliant staff before shifts are published',
          'Generates compliance packs for client or audit requests',
          'Auto-links to payroll — stops pay if RTW lapses',
        ]}
      />

      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
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
                fontSize: '1.1rem',
                margin: '0 0 0.2rem',
                letterSpacing: '-0.01em',
              }}
            >
              Staff &amp; HR
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.72rem', margin: 0 }}>
              1,487 employed staff · PAYE · all regions
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => showToast('open bulk import')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.5rem 0.9rem',
                borderRadius: '0.5rem',
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'rgba(255,255,255,0.05)',
                color: 'rgba(255,255,255,0.55)',
                fontSize: '0.72rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <Download size={13} /> Export
            </button>
            <button
              onClick={() => showToast('open add employee flow')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.5rem 0.9rem',
                borderRadius: '0.5rem',
                border: 'none',
                background: 'linear-gradient(135deg, #ea580c, #c2410c)',
                color: 'white',
                fontSize: '0.72rem',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              <Plus size={13} /> Add Employee
            </button>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '0.875rem',
          marginBottom: '1.5rem',
        }}
      >
        {STATS.map(({ label, value, sub, icon: Icon, color, bg, border, traffic }) => (
          <div
            key={label}
            style={{
              borderRadius: '1rem',
              padding: '1.25rem 1.25rem 1rem',
              background: bg,
              border: `1px solid ${border}`,
              boxShadow: `0 0 32px ${color}10`,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Corner glow */}
            <div
              style={{
                position: 'absolute',
                top: -20,
                right: -20,
                width: 80,
                height: 80,
                borderRadius: '50%',
                background: `radial-gradient(circle, ${color}22 0%, transparent 70%)`,
                pointerEvents: 'none',
              }}
            />
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                marginBottom: '0.65rem',
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '0.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: `${color}20`,
                  border: `1px solid ${color}30`,
                }}
              >
                <Icon size={16} style={{ color }} />
              </div>
              {traffic && (
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    marginTop: 4,
                    background:
                      traffic === 'green' ? '#4ade80' : traffic === 'amber' ? '#fbbf24' : '#f87171',
                    boxShadow: `0 0 8px ${traffic === 'green' ? '#4ade8099' : traffic === 'amber' ? '#fbbf2499' : '#f8717199'}`,
                  }}
                />
              )}
            </div>
            <div
              style={{
                fontWeight: 900,
                fontSize: '2rem',
                lineHeight: 1,
                marginBottom: '0.35rem',
                background: `linear-gradient(135deg, white 30%, ${color} 110%)`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              {value}
            </div>
            <div
              style={{
                fontSize: '0.68rem',
                fontWeight: 800,
                color: 'rgba(255,255,255,0.65)',
                marginBottom: '0.2rem',
              }}
            >
              {label}
            </div>
            <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.35)', lineHeight: 1.4 }}>
              {sub}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '0.875rem',
          marginBottom: '1.25rem',
        }}
      >
        {/* Compliance bars */}
        <div
          style={{
            borderRadius: '0.875rem',
            padding: '1rem 1.1rem',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <div
            style={{
              fontSize: '0.65rem',
              fontWeight: 800,
              color: 'rgba(255,255,255,0.5)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              marginBottom: '0.875rem',
            }}
          >
            Compliance Overview
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
            {COMPLIANCE_BARS.map(({ label, pct, color }) => (
              <div key={label}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: '0.3rem',
                  }}
                >
                  <span
                    style={{ fontSize: '0.65rem', fontWeight: 700, color: 'rgba(255,255,255,0.6)' }}
                  >
                    {label}
                  </span>
                  <span style={{ fontSize: '0.65rem', fontWeight: 900, color }}>{pct}%</span>
                </div>
                <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.07)' }}>
                  <div
                    style={{
                      height: '100%',
                      borderRadius: 3,
                      width: `${pct}%`,
                      background: color,
                      transition: 'width 0.6s ease',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Alerts */}
        <div
          style={{
            borderRadius: '0.875rem',
            padding: '1rem 1.1rem',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <div
            style={{
              fontSize: '0.65rem',
              fontWeight: 800,
              color: 'rgba(255,255,255,0.5)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              marginBottom: '0.875rem',
            }}
          >
            Action Required
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {ALERTS.map(({ icon: Icon, color, label, action }) => (
              <div
                key={label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  padding: '0.5rem 0.65rem',
                  borderRadius: '0.5rem',
                  background: `${color}10`,
                  border: `1px solid ${color}22`,
                }}
              >
                <Icon size={13} style={{ color, flexShrink: 0 }} />
                <span
                  style={{
                    flex: 1,
                    fontSize: '0.62rem',
                    fontWeight: 600,
                    color: 'rgba(255,255,255,0.65)',
                    lineHeight: 1.3,
                  }}
                >
                  {label}
                </span>
                <button
                  onClick={() => showToast(`${action.toLowerCase()} action`)}
                  style={{
                    flexShrink: 0,
                    padding: '0.2rem 0.5rem',
                    borderRadius: '0.3rem',
                    background: `${color}20`,
                    border: `1px solid ${color}30`,
                    color,
                    fontSize: '0.58rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  {action}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Employee table */}
      <div
        style={{
          borderRadius: '0.875rem',
          overflow: 'hidden',
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        {/* Table toolbar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '0.875rem 1.1rem',
            borderBottom: '1px solid rgba(255,255,255,0.07)',
          }}
        >
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '0.5rem',
              padding: '0.4rem 0.7rem',
            }}
          >
            <Search size={12} style={{ color: 'rgba(255,255,255,0.3)', flexShrink: 0 }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or site…"
              style={{
                flex: 1,
                background: 'none',
                border: 'none',
                outline: 'none',
                color: 'white',
                fontSize: '0.7rem',
              }}
            />
          </div>
          <button
            onClick={() => showToast('open filters')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.4rem 0.75rem',
              borderRadius: '0.5rem',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.45)',
              fontSize: '0.68rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <Filter size={11} /> Filter
          </button>
        </div>

        {/* Column headers */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr 0.8fr 1.2fr',
            padding: '0.5rem 1.1rem',
            gap: '0.5rem',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          {['Employee', 'Site', 'DBS', 'Right to Work', 'Training', 'Hours', ''].map((h) => (
            <div
              key={h}
              style={{
                fontSize: '0.58rem',
                fontWeight: 800,
                color: 'rgba(255,255,255,0.25)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
            >
              {h}
            </div>
          ))}
        </div>

        {/* Rows */}
        {filtered.map((emp, i) => (
          <div
            key={emp.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr 0.8fr 1.2fr',
              padding: '0.65rem 1.1rem',
              gap: '0.5rem',
              alignItems: 'center',
              borderBottom: i < filtered.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
              cursor: 'pointer',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.025)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
          >
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'white' }}>{emp.name}</div>
              <div style={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.3)' }}>
                {emp.id} · {emp.role}
              </div>
            </div>
            <div
              style={{
                fontSize: '0.65rem',
                color: 'rgba(255,255,255,0.5)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {emp.site}
            </div>
            {[emp.dbs, emp.rtw, emp.training].map((s, si) => {
              const st = STATUS[s] || STATUS.valid;
              return (
                <div
                  key={si}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: st.bg,
                    color: st.color,
                    fontSize: '0.65rem',
                    fontWeight: 900,
                  }}
                >
                  {st.label}
                </div>
              );
            })}
            <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', fontWeight: 700 }}>
              {emp.hours}
            </div>
            <button
              onClick={() => showToast('open employee profile')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                background: 'none',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '0.35rem',
                padding: '0.25rem 0.5rem',
                color: 'rgba(255,255,255,0.4)',
                fontSize: '0.6rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              View <ChevronRight size={10} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
