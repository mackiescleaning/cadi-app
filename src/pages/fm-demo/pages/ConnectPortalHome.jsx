import { useState } from 'react';
import { TrendingUp, ChevronRight, Shield } from 'lucide-react';

const ORANGE = '#C2410C';
const NAVY = '#010a4f';

const STATS = [
  { label: 'Earned this month', value: '£595', sub: 'confirmed & paid', color: '#059669' },
  {
    label: 'Pending payment',
    value: '£460',
    sub: '2 invoices with Britannia Group',
    color: '#f59e0b',
  },
  { label: 'Jobs this month', value: '14', sub: '12 complete · 2 upcoming', color: '#4f78ff' },
  { label: 'Connect score', value: '91', sub: 'Elite tier · visible to FMs', color: '#10b981' },
];

const PIPELINE = [
  { status: 'On site now', count: 1, color: '#3b82f6', tab: 'current-work' },
  { status: 'Awaiting evidence', count: 1, color: ORANGE, tab: 'completion' },
  { status: 'Pending FM review', count: 2, color: '#f59e0b', tab: 'invoicing' },
  { status: 'Upcoming this week', count: 3, color: '#6366f1', tab: 'schedule' },
];

const NEW_JOBS = [
  {
    ref: '#BF-4503',
    site: 'L&D Hospital – A&E & Outpatients',
    fm: 'Britannia Group',
    workType: 'Specialist clean',
    window: '05:00–07:00',
    freq: 'Mon–Fri',
    value: 110,
    dbs: 'Enhanced DBS',
    urgent: true,
    matchScore: 94,
  },
  {
    ref: '#BF-4504',
    site: 'L&D Hospital – A&E & Outpatients',
    fm: 'Britannia Group',
    workType: 'Washroom service',
    window: '13:00–14:00',
    freq: 'Mon–Fri',
    value: 45,
    dbs: 'Enhanced DBS',
    urgent: false,
    matchScore: 91,
  },
];

export default function ConnectPortalHome({ onTabChange }) {
  const [dismissed, setDismissed] = useState(false);

  return (
    <div
      style={{
        background: '#f8faff',
        minHeight: '100%',
        padding: '1.25rem',
        fontFamily: "'Satoshi','Inter',sans-serif",
      }}
    >
      {/* Hero */}
      <div
        style={{
          borderRadius: '1.25rem',
          padding: '1.25rem 1.5rem',
          marginBottom: '1rem',
          background: `linear-gradient(135deg, ${NAVY} 0%, #1a0a00 100%)`,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: 200,
            height: 200,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(194,65,12,0.2) 0%, transparent 70%)',
            transform: 'translate(20%, -30%)',
            pointerEvents: 'none',
          }}
        />
        <div style={{ position: 'relative' }}>
          <div
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '0.5rem',
                background: ORANGE,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <TrendingUp size={13} color="white" />
            </div>
            <span
              style={{
                fontSize: '0.65rem',
                fontWeight: 800,
                letterSpacing: '0.18em',
                color: 'rgba(255,255,255,0.4)',
                textTransform: 'uppercase',
              }}
            >
              Connect · Priya N.
            </span>
          </div>
          <div
            style={{
              color: 'white',
              fontWeight: 900,
              fontSize: '1.35rem',
              lineHeight: 1.15,
              marginBottom: '0.3rem',
            }}
          >
            Your FM command centre
          </div>
          <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.78rem' }}>
            Connected to Britannia Group · 2 new jobs just dispatched · £460 pending payment
          </div>
        </div>
      </div>

      {/* New jobs alert */}
      {!dismissed && (
        <div
          style={{
            borderRadius: '1rem',
            padding: '1rem 1.25rem',
            marginBottom: '1rem',
            background: 'linear-gradient(135deg, rgba(194,65,12,0.06), rgba(251,191,36,0.04))',
            border: '1px solid rgba(194,65,12,0.22)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '0.6rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: ORANGE,
                  animation: 'connectPulse 1.4s infinite',
                }}
              />
              <span style={{ fontWeight: 800, fontSize: '0.78rem', color: NAVY }}>
                2 new jobs dispatched by Britannia Group
              </span>
            </div>
            <button
              onClick={() => setDismissed(true)}
              style={{
                fontSize: '0.68rem',
                color: '#94a3b8',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Dismiss
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {NEW_JOBS.map((job) => (
              <div
                key={job.ref}
                style={{
                  background: 'white',
                  borderRadius: '0.75rem',
                  padding: '0.75rem 1rem',
                  border: '1px solid rgba(194,65,12,0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  cursor: 'pointer',
                }}
                onClick={() => onTabChange && onTabChange('marketplace')}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      marginBottom: '0.2rem',
                      flexWrap: 'wrap',
                    }}
                  >
                    <span style={{ fontWeight: 700, fontSize: '0.8rem', color: NAVY }}>
                      {job.site}
                    </span>
                    <span
                      style={{
                        fontSize: '0.65rem',
                        fontWeight: 800,
                        color: ORANGE,
                        background: 'rgba(194,65,12,0.08)',
                        borderRadius: 999,
                        padding: '1px 7px',
                        border: '1px solid rgba(194,65,12,0.2)',
                      }}
                    >
                      NEW
                    </span>
                    {job.urgent && (
                      <span
                        style={{
                          fontSize: '0.65rem',
                          fontWeight: 800,
                          color: '#ef4444',
                          background: 'rgba(239,68,68,0.08)',
                          borderRadius: 999,
                          padding: '1px 7px',
                        }}
                      >
                        Urgent
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                    {job.workType} · {job.window} · {job.freq} ·{' '}
                    <span style={{ color: '#a78bfa', fontWeight: 700 }}>{job.dbs}</span>
                  </div>
                  <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '0.15rem' }}>
                    {job.ref} · {job.fm}
                  </div>
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-end',
                    gap: '0.35rem',
                    flexShrink: 0,
                  }}
                >
                  <div style={{ fontWeight: 900, fontSize: '1rem', color: NAVY }}>
                    £{job.value}
                    <span style={{ fontSize: '0.65rem', fontWeight: 600, color: '#64748b' }}>
                      /visit
                    </span>
                  </div>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      border: `2px solid ${job.matchScore >= 90 ? '#10b981' : '#3b82f6'}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.65rem',
                      fontWeight: 900,
                      color: job.matchScore >= 90 ? '#10b981' : '#3b82f6',
                    }}
                  >
                    {job.matchScore}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={() => onTabChange && onTabChange('marketplace')}
            style={{
              marginTop: '0.65rem',
              width: '100%',
              padding: '0.6rem',
              borderRadius: '0.75rem',
              background: ORANGE,
              color: 'white',
              fontWeight: 800,
              fontSize: '0.78rem',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            View all jobs in Marketplace →
          </button>
        </div>
      )}

      {/* Stats */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '0.65rem',
          marginBottom: '1rem',
        }}
      >
        {STATS.map(({ label, value, sub, color }) => (
          <div
            key={label}
            style={{
              background: 'white',
              borderRadius: '1rem',
              border: '1px solid rgba(153,197,255,0.2)',
              padding: '0.875rem 1rem',
            }}
          >
            <div style={{ fontWeight: 900, fontSize: '1.4rem', color, marginBottom: '0.15rem' }}>
              {value}
            </div>
            <div style={{ fontWeight: 700, fontSize: '0.75rem', color: NAVY }}>{label}</div>
            <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '0.15rem' }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Pipeline snapshot */}
      <div style={{ marginBottom: '1rem' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '0.5rem',
          }}
        >
          <span
            style={{
              fontSize: '0.65rem',
              fontWeight: 800,
              color: NAVY,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
            }}
          >
            Job Pipeline
          </span>
          <button
            onClick={() => onTabChange && onTabChange('current-work')}
            style={{
              fontSize: '0.7rem',
              color: '#4f78ff',
              fontWeight: 700,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 3,
            }}
          >
            Full pipeline <ChevronRight size={11} />
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          {PIPELINE.map(({ status, count, color, tab }) => (
            <button
              key={status}
              onClick={() => onTabChange && onTabChange(tab)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.65rem',
                background: 'white',
                borderRadius: '0.75rem',
                border: '1px solid rgba(153,197,255,0.2)',
                padding: '0.65rem 0.875rem',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <div
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: '50%',
                  background: color,
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: '0.72rem', color: '#475569', flex: 1 }}>{status}</span>
              <span style={{ fontSize: '0.8rem', fontWeight: 900, color }}>{count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Britannia Group connection */}
      <div
        style={{
          background: 'white',
          borderRadius: '1rem',
          border: '1px solid rgba(153,197,255,0.2)',
          padding: '1rem 1.125rem',
          marginBottom: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: '0.875rem',
              background: 'linear-gradient(135deg, #4f78ff, #010a4f)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontWeight: 900,
              fontSize: '0.875rem',
              flexShrink: 0,
            }}
          >
            B
          </div>
          <div style={{ flex: 1 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                marginBottom: '0.15rem',
              }}
            >
              <span style={{ fontWeight: 800, color: NAVY, fontSize: '0.85rem' }}>
                Britannia Group
              </span>
              <span
                style={{
                  fontSize: '0.6rem',
                  fontWeight: 800,
                  color: '#059669',
                  background: 'rgba(16,185,129,0.08)',
                  borderRadius: 999,
                  padding: '1px 7px',
                  border: '1px solid rgba(16,185,129,0.2)',
                }}
              >
                Active
              </span>
            </div>
            <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
              Bedfordshire + Bucks · since Jan 2026
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontWeight: 900, fontSize: '1.1rem', color: NAVY }}>£3,995</div>
            <div style={{ fontSize: '0.62rem', color: '#94a3b8' }}>total earned</div>
          </div>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: '0.5rem',
            marginTop: '0.75rem',
          }}
        >
          {[
            { l: 'Jobs done', v: '47' },
            { l: 'Avg rating', v: '4.8 ★' },
            { l: 'Pending pay', v: '£420' },
          ].map(({ l, v }) => (
            <div
              key={l}
              style={{
                background: '#f8faff',
                borderRadius: '0.625rem',
                padding: '0.5rem',
                textAlign: 'center',
              }}
            >
              <div style={{ fontWeight: 900, fontSize: '0.875rem', color: NAVY }}>{v}</div>
              <div style={{ fontSize: '0.62rem', color: '#94a3b8' }}>{l}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
          <button
            onClick={() => onTabChange && onTabChange('marketplace')}
            style={{
              flex: 1,
              padding: '0.6rem',
              borderRadius: '0.75rem',
              background: ORANGE,
              color: 'white',
              fontWeight: 800,
              fontSize: '0.75rem',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            View matched jobs →
          </button>
          <button
            onClick={() => onTabChange && onTabChange('earnings')}
            style={{
              padding: '0.6rem 0.875rem',
              borderRadius: '0.75rem',
              background: 'none',
              border: '1px solid rgba(153,197,255,0.3)',
              color: '#475569',
              fontWeight: 700,
              fontSize: '0.75rem',
              cursor: 'pointer',
            }}
          >
            Earnings
          </button>
        </div>
      </div>

      {/* Evidence alert */}
      <div
        style={{
          borderRadius: '1rem',
          padding: '0.875rem 1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.875rem',
          background: 'rgba(194,65,12,0.05)',
          border: '1px solid rgba(194,65,12,0.2)',
          cursor: 'pointer',
        }}
        onClick={() => onTabChange && onTabChange('completion')}
      >
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: '0.625rem',
            background: ORANGE,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Shield size={15} color="white" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: '0.8rem', color: NAVY }}>
            Evidence required — Premier Inn Luton Airport
          </div>
          <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.1rem' }}>
            Upload geo-stamped photos for 8 May job · Britannia Group awaiting
          </div>
        </div>
        <ChevronRight size={15} color="#94a3b8" style={{ flexShrink: 0 }} />
      </div>

      <style>{`
        @keyframes connectPulse { 0%,100% { opacity:1; } 50% { opacity:0.25; } }
      `}</style>
    </div>
  );
}
