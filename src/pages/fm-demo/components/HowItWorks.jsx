import { useState } from 'react';
import { ChevronDown, ChevronUp, User, Zap } from 'lucide-react';

export default function HowItWorks({ setupTime, youSetUp, cadiHandles, accent = '#ea580c' }) {
  const [open, setOpen] = useState(true);

  return (
    <div
      style={{
        borderRadius: '0.875rem',
        overflow: 'hidden',
        border: `1px solid ${accent}25`,
        background: `${accent}06`,
        marginBottom: '1.25rem',
        flexShrink: 0,
      }}
    >
      {/* Toggle bar */}
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.6rem 1rem',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          gap: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div
            style={{
              width: 5,
              height: 5,
              borderRadius: '50%',
              background: accent,
              boxShadow: `0 0 6px ${accent}90`,
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontSize: '0.62rem',
              fontWeight: 800,
              color: `${accent}cc`,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
            }}
          >
            How this works
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {setupTime && (
            <span
              style={{
                fontSize: '0.58rem',
                fontWeight: 700,
                color: 'rgba(255,255,255,0.28)',
                padding: '0.15rem 0.55rem',
                borderRadius: '999px',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              Setup: {setupTime}
            </span>
          )}
          {open ? (
            <ChevronUp size={12} style={{ color: 'rgba(255,255,255,0.3)', flexShrink: 0 }} />
          ) : (
            <ChevronDown size={12} style={{ color: 'rgba(255,255,255,0.3)', flexShrink: 0 }} />
          )}
        </div>
      </button>

      {/* Expanded content */}
      {open && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            borderTop: `1px solid ${accent}18`,
            gap: 0,
          }}
        >
          {/* You set up */}
          <div style={{ padding: '0.75rem 1rem', borderRight: `1px solid ${accent}15` }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                marginBottom: '0.55rem',
              }}
            >
              <User size={10} style={{ color: 'rgba(255,255,255,0.35)', flexShrink: 0 }} />
              <span
                style={{
                  fontSize: '0.55rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  color: 'rgba(255,255,255,0.3)',
                }}
              >
                You set up
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.32rem' }}>
              {youSetUp.map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: '0.4rem', alignItems: 'flex-start' }}>
                  <span
                    style={{
                      fontSize: '0.55rem',
                      fontWeight: 900,
                      color: `${accent}99`,
                      flexShrink: 0,
                      marginTop: '0.05rem',
                      lineHeight: 1.5,
                    }}
                  >
                    {i + 1}
                  </span>
                  <span
                    style={{
                      fontSize: '0.63rem',
                      color: 'rgba(255,255,255,0.55)',
                      lineHeight: 1.45,
                    }}
                  >
                    {item}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Cadi handles */}
          <div style={{ padding: '0.75rem 1rem' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                marginBottom: '0.55rem',
              }}
            >
              <Zap size={10} style={{ color: `${accent}cc`, flexShrink: 0 }} />
              <span
                style={{
                  fontSize: '0.55rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  color: `${accent}99`,
                }}
              >
                Cadi handles
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.32rem' }}>
              {cadiHandles.map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: '0.4rem', alignItems: 'flex-start' }}>
                  <span
                    style={{
                      fontSize: '0.58rem',
                      fontWeight: 900,
                      color: '#4ade80',
                      flexShrink: 0,
                      lineHeight: 1.5,
                    }}
                  >
                    ✓
                  </span>
                  <span
                    style={{
                      fontSize: '0.63rem',
                      color: 'rgba(255,255,255,0.55)',
                      lineHeight: 1.45,
                    }}
                  >
                    {item}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
