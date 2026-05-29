import { Zap } from 'lucide-react';

const CONTRACT_PATH = [
  { n: 1, label: 'Win Contract',  page: 'clients',       mode: 'contract' },
  { n: 2, label: 'Job Cards',     page: 'job-cards',     mode: 'contract' },
  { n: 3, label: 'Import Staff',  page: 'staff-import',  mode: 'contract' },
  { n: 4, label: 'Staff & HR',    page: 'hr-staff',      mode: 'contract' },
  { n: 5, label: 'Area Manager',  page: 'dispatch-board', mode: 'contract' },
  { n: 6, label: 'Staff Rota',    page: 'staff-rota',    mode: 'contract' },
  { n: 7, label: 'Track Hours',   page: 'live',          mode: 'contract' },
  { n: 8, label: 'Payroll',       page: 'payroll',       mode: 'contract' },
];

const EXTERIOR_PATH = [
  { n: 1, label: 'Contractors',  page: 'sub-pool',       mode: 'exterior' },
  { n: 2, label: 'Win Contract', page: 'ext-clients',    mode: 'exterior' },
  { n: 3, label: 'Job Cards',    page: 'ext-quotes',     mode: 'exterior' },
  { n: 4, label: 'Schedule',     page: 'ext-scheduling', mode: 'exterior' },
  { n: 5, label: 'Work Done',    page: 'ext-live',       mode: 'exterior' },
  { n: 6, label: 'Invoice',      page: 'ext-accounts',   mode: 'exterior' },
];

const PAIN_POINTS = [
  { before: 'Rota sent on WhatsApp', after: 'Staff see their schedule in the app. Published in 30 seconds.' },
  { before: 'Client calls to ask if cleaner showed up', after: 'They log in. Live check-in and photo evidence, same minute.' },
  { before: 'Manual timesheets, chasing hours', after: 'Check-in auto-captures hours. BACS export in one click.' },
  { before: 'Chasing contractors for invoices', after: 'They submit in the app. Lands in your accounts inbox.' },
  { before: 'DBS spreadsheet — 1,487 staff', after: 'Every certificate, every expiry, flagged 30 days out.' },
  { before: 'Monthly PDF report emailed to client', after: 'Client portal. Always live. No report to write.' },
];

const EXTERIOR_PAIN_POINTS = [
  { before: 'Ringing contractors to find who\'s available', after: 'Job card sent to your pool instantly. First to accept gets it.' },
  { before: 'Quotes over WhatsApp — impossible to track', after: 'Contractor quotes in the app. You approve or negotiate in one place.' },
  { before: 'Contractor awarded the job then goes quiet', after: 'They schedule in the app. Date confirmed automatically.' },
  { before: 'No proof of work without chasing', after: 'Geo-stamped photos uploaded on completion. Nothing to chase.' },
  { before: 'Invoices by email — manual to process', after: 'They submit in the app. Lands in your accounts inbox.' },
  { before: 'No idea which contractors are reliable', after: 'Every job rated. Quality scores build automatically over time.' },
];

function WorkflowCard({ pathNum, title, desc, steps, accent, grad, onStep, onStart }) {
  return (
    <div style={{
      borderRadius: '1rem', border: `1px solid ${accent}22`,
      background: 'rgba(255,255,255,0.03)', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0.75rem 1rem',
        background: `linear-gradient(135deg, ${accent}10, ${accent}05)`,
        borderBottom: `1px solid ${accent}15`,
        gap: '0.6rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', minWidth: 0, flex: 1 }}>
          <div style={{
            width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
            background: grad, display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: '0.65rem', fontWeight: 900, color: 'white',
          }}>{pathNum}</div>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontWeight: 900, fontSize: '0.82rem', color: 'white', lineHeight: 1.2,
            }}>{title}</div>
            <div style={{
              fontSize: '0.6rem', color: 'rgba(255,255,255,0.38)', marginTop: 2, lineHeight: 1.3,
            }}>{desc}</div>
          </div>
        </div>
        <button onClick={onStart} style={{
          padding: '0.38rem 0.85rem', borderRadius: '0.45rem', flexShrink: 0,
          background: grad, border: 'none', color: 'white',
          fontWeight: 800, fontSize: '0.68rem', cursor: 'pointer',
        }}>
          Start →
        </button>
      </div>

      {/* Steps — flat siblings: [button] [line] [button] [line] ... [button] */}
      <div style={{ display: 'flex', alignItems: 'flex-end', padding: '0.7rem 0.4rem' }}>
        {steps.map((step, i) => (
          <div key={step.n} style={{ display: 'contents' }}>
            <button
              onClick={() => onStep(step.page, step.mode)}
              style={{
                flex: 1, minWidth: 0,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.22rem',
                padding: '0.3rem 0.25rem', borderRadius: '0.4rem',
                background: 'none', border: 'none', cursor: 'pointer',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = `${accent}12`}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
            >
              <div style={{
                width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                background: grad,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.6rem', fontWeight: 900, color: 'white',
                boxShadow: `0 2px 6px ${accent}35`,
              }}>{step.n}</div>
              <span style={{
                fontSize: '0.5rem', fontWeight: 700, color: 'rgba(255,255,255,0.72)',
                textAlign: 'center', lineHeight: 1.2,
              }}>{step.label}</span>
            </button>
            {i < steps.length - 1 && (
              <div style={{
                flexShrink: 0, width: 3, height: 1,
                background: `${accent}28`, marginBottom: '0.7rem',
              }} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function FmHome({ onNavigateWithMode, mode }) {
  const points = mode === 'exterior' ? EXTERIOR_PAIN_POINTS : PAIN_POINTS;
  return (
    <div style={{ padding: '1.5rem 1.25rem 3rem' }}>

      {/* Headline */}
      <div style={{ marginBottom: '1.25rem' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
          padding: '0.2rem 0.65rem', borderRadius: '999px', marginBottom: '0.75rem',
          background: 'rgba(234,88,12,0.1)', border: '1px solid rgba(234,88,12,0.22)',
          fontSize: '0.6rem', fontWeight: 800, color: '#fb923c',
          textTransform: 'uppercase', letterSpacing: '0.1em',
        }}>
          <Zap size={9} /> Britannia Group · Ops Portal
        </div>
        <h1 style={{
          color: 'white', fontWeight: 900, fontSize: '1.45rem', lineHeight: 1.2,
          margin: '0 0 0.4rem', letterSpacing: '-0.02em',
        }}>
          We simplify your workflows and<br />
          <span style={{ color: '#fb923c' }}>connect your clients to your cleaners</span>
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: '0.78rem', margin: 0, lineHeight: 1.5 }}>
          Two clear paths. Every step visible. Click any step to jump straight in.
        </p>
      </div>

      {/* Start here nudge */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.6rem',
        marginBottom: '0.85rem', padding: '0.6rem 0.9rem', borderRadius: '0.75rem',
        background: 'rgba(234,88,12,0.07)', border: '1px solid rgba(234,88,12,0.22)',
      }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#ea580c', boxShadow: '0 0 8px rgba(234,88,12,0.7)', flexShrink: 0, animation: 'pulse 2s ease-in-out infinite' }} />
        <span style={{ fontSize: '0.67rem', fontWeight: 800, color: '#fb923c' }}>Start here</span>
        <span style={{ fontSize: '0.63rem', color: 'rgba(255,255,255,0.38)' }}>— hit <strong style={{ color: 'rgba(255,255,255,0.55)', fontWeight: 700 }}>Start →</strong> on either path, or tap any step to jump straight in</span>
      </div>

      {/* Path cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <WorkflowCard
          pathNum="1"
          title="Contract Cleaning"
          desc="Ongoing contracts — win to payroll"
          steps={CONTRACT_PATH}
          accent="#ea580c"
          grad="linear-gradient(135deg, #ea580c, #c2410c)"
          onStep={onNavigateWithMode}
          onStart={() => onNavigateWithMode('clients', 'contract')}
        />
        <WorkflowCard
          pathNum="2"
          title="Exterior Services"
          desc="One-off & recurring exterior jobs"
          steps={EXTERIOR_PATH}
          accent="#16a34a"
          grad="linear-gradient(135deg, #16a34a, #15803d)"
          onStep={onNavigateWithMode}
          onStart={() => onNavigateWithMode('ext-clients', 'exterior')}
        />
      </div>

      {/* Three-way connection */}
      <div style={{
        marginBottom: '0.75rem', borderRadius: '0.875rem', padding: '0.875rem 1.1rem',
        background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{ fontSize: '0.58rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(255,255,255,0.2)', marginBottom: '0.8rem' }}>
          One job card · three views · always in sync
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {/* FM node */}
          <div style={{ flex: 1.1, borderRadius: '0.6rem', padding: '0.55rem 0.65rem', background: 'rgba(234,88,12,0.1)', border: '1px solid rgba(234,88,12,0.22)' }}>
            <div style={{ fontSize: '0.62rem', fontWeight: 900, color: '#fb923c', marginBottom: '0.15rem' }}>Britannia Group</div>
            <div style={{ fontSize: '0.54rem', color: 'rgba(255,255,255,0.32)', lineHeight: 1.3 }}>Creates & dispatches</div>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.12)', flexShrink: 0, userSelect: 'none' }}>⇄</div>
          {/* Client + Staff stacked */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            <div style={{ borderRadius: '0.55rem', padding: '0.38rem 0.6rem', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
              <div style={{ fontSize: '0.58rem', fontWeight: 900, color: '#34d399' }}>Asda Client Portal</div>
              <div style={{ fontSize: '0.51rem', color: 'rgba(255,255,255,0.28)' }}>Live status · evidence · SLA</div>
            </div>
            <div style={{ borderRadius: '0.55rem', padding: '0.38rem 0.6rem', background: 'rgba(79,120,255,0.08)', border: '1px solid rgba(79,120,255,0.2)' }}>
              <div style={{ fontSize: '0.58rem', fontWeight: 900, color: '#818cf8' }}>Contractor App</div>
              <div style={{ fontSize: '0.51rem', color: 'rgba(255,255,255,0.28)' }}>Check-in · tasks · evidence</div>
            </div>
          </div>
        </div>
      </div>

      {/* What this replaces */}
      <div style={{
        borderRadius: '0.875rem', padding: '0.875rem 1.1rem',
        background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{ fontSize: '0.58rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(255,255,255,0.2)', marginBottom: '0.75rem' }}>
          What this replaces
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {points.map(({ before, after }) => (
            <div key={before} style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '0.5rem', alignItems: 'start' }}>
              <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '0.58rem', fontWeight: 800, color: 'rgba(239,68,68,0.6)', flexShrink: 0, lineHeight: 1.5 }}>✗</span>
                <span style={{ fontSize: '0.63rem', color: 'rgba(255,255,255,0.25)', textDecoration: 'line-through', lineHeight: 1.4 }}>{before}</span>
              </div>
              <span style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.12)', lineHeight: 1.5, flexShrink: 0 }}>→</span>
              <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '0.58rem', fontWeight: 800, color: 'rgba(52,211,153,0.75)', flexShrink: 0, lineHeight: 1.5 }}>✓</span>
                <span style={{ fontSize: '0.63rem', color: 'rgba(255,255,255,0.62)', fontWeight: 600, lineHeight: 1.4 }}>{after}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
