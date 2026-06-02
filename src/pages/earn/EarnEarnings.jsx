import { useState } from 'react';
import { CheckCircle2, Clock, TrendingUp, FileText, ChevronDown, ChevronUp } from 'lucide-react';

const card = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
};

const INVOICES_TRACKER = [
  {
    id: 'INV-0042',
    client: 'Britannia Group',
    amount: 173,
    sent: '19 May',
    stages: [
      { label: 'Sent', done: true },
      { label: 'Received', done: true },
      { label: 'Processing', done: false, active: true },
      { label: 'Payment', done: false },
    ],
  },
  {
    id: 'INV-0041',
    client: 'Metro Clean',
    amount: 120,
    sent: '10 May',
    stages: [
      { label: 'Sent', done: true },
      { label: 'Received', done: true },
      { label: 'Processing', done: true },
      { label: 'Paid', done: true },
    ],
  },
];

const PERIOD_DATA = {
  'This month': {
    gross: 1340,
    net: 1072,
    jobs: 12,
    vat: 268,
    breakdown: [
      { client: 'Britannia Group', amount: 780 },
      { client: 'Metro Clean', amount: 360 },
      { client: 'Central Beds Council', amount: 200 },
    ],
    ledger: [
      { date: '19 May', ref: '#INV-0042', client: 'Britannia Group', amount: 173, status: 'Processing' },
      { date: '10 May', ref: '#INV-0041', client: 'Metro Clean', amount: 120, status: 'Paid' },
      { date: '06 May', ref: '#INV-0040', client: 'Britannia Group', amount: 156, status: 'Paid' },
      { date: '02 May', ref: '#INV-0039', client: 'Central Beds Council', amount: 200, status: 'Paid' },
    ],
  },
  'Last month': {
    gross: 2180,
    net: 1744,
    jobs: 19,
    vat: 436,
    breakdown: [
      { client: 'Britannia Group', amount: 1200 },
      { client: 'Metro Clean', amount: 580 },
      { client: 'Central Beds Council', amount: 400 },
    ],
    ledger: [
      { date: '30 Apr', ref: '#INV-0038', client: 'Britannia Group', amount: 312, status: 'Paid' },
      { date: '22 Apr', ref: '#INV-0037', client: 'Metro Clean', amount: 240, status: 'Paid' },
      { date: '15 Apr', ref: '#INV-0036', client: 'Britannia Group', amount: 288, status: 'Paid' },
      { date: '05 Apr', ref: '#INV-0035', client: 'Central Beds Council', amount: 400, status: 'Paid' },
    ],
  },
  'Last 3 months': {
    gross: 5820,
    net: 4656,
    jobs: 51,
    vat: 1164,
    breakdown: [
      { client: 'Britannia Group', amount: 3200 },
      { client: 'Metro Clean', amount: 1420 },
      { client: 'Central Beds Council', amount: 1200 },
    ],
    ledger: [],
  },
};

function StagePipeline({ stages }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginTop: '0.65rem' }}>
      {stages.map((stage, i) => {
        const isLast = i === stages.length - 1;
        const dotColor = stage.done ? '#4ade80' : stage.active ? '#fbbf24' : 'rgba(226,232,240,0.2)';
        const labelColor = stage.done ? '#4ade80' : stage.active ? '#fbbf24' : 'rgba(226,232,240,0.35)';
        const lineColor = stage.done ? 'rgba(74,222,128,0.4)' : 'rgba(255,255,255,0.08)';

        return (
          <div key={stage.label} style={{ display: 'flex', alignItems: 'center', flex: isLast ? 'none' : 1 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: dotColor,
                  animation: stage.active ? 'cadipulse 1.4s infinite' : 'none',
                  flexShrink: 0,
                }} />
              </div>
              <span style={{ fontSize: '0.66rem', fontWeight: 600, color: labelColor, whiteSpace: 'nowrap' }}>
                {stage.label}{stage.done ? ' ✓' : ''}
              </span>
            </div>
            {!isLast && (
              <div style={{ height: 1.5, flex: 1, background: lineColor, margin: '0 4px', marginBottom: '1rem' }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function InvoiceTrackerCard({ inv }) {
  const allPaid = inv.stages.every(s => s.done);
  return (
    <div style={{ ...card, borderRadius: '0.9rem', padding: '0.9rem 1.1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ color: 'white', fontWeight: 800, fontSize: '0.875rem' }}>{inv.id}</div>
          <div style={{ color: 'rgba(226,232,240,0.45)', fontSize: '0.75rem' }}>{inv.client} · Sent {inv.sent}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontWeight: 900, color: allPaid ? '#4ade80' : 'white', fontFamily: 'monospace', fontSize: '0.95rem' }}>
            £{inv.amount}
          </span>
          {allPaid && <CheckCircle2 size={14} color="#4ade80" />}
        </div>
      </div>
      <StagePipeline stages={inv.stages} />
    </div>
  );
}

function StatusChip({ status }) {
  const map = {
    Paid: { color: '#4ade80', bg: 'rgba(74,222,128,0.1)' },
    Processing: { color: '#fbbf24', bg: 'rgba(251,191,36,0.1)' },
    Sent: { color: '#60a5fa', bg: 'rgba(96,165,250,0.1)' },
  };
  const style = map[status] || { color: 'rgba(226,232,240,0.4)', bg: 'transparent' };
  return (
    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: style.color, background: style.bg, borderRadius: '999px', padding: '2px 8px' }}>
      {status}
    </span>
  );
}

export default function EarnEarnings() {
  const [period, setPeriod] = useState('This month');
  const data = PERIOD_DATA[period];

  return (
    <div className="flex flex-col gap-5 p-6 pb-10" style={{ color: '#e2e8f0' }}>
      <style>{`
        @keyframes cadipulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.25; }
        }
      `}</style>

      <div>
        <h1 style={{ color: 'white', fontWeight: 900, fontSize: '1.5rem', margin: 0, marginBottom: '0.2rem' }}>Earnings</h1>
        <p style={{ color: 'rgba(226,232,240,0.4)', fontSize: '0.875rem', margin: 0 }}>Income tracking and invoice status</p>
      </div>

      {/* Invoice tracker */}
      <div style={{ ...card, borderRadius: '1rem', padding: '1.1rem 1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem' }}>
          <FileText size={14} color="rgba(226,232,240,0.4)" />
          <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'rgba(226,232,240,0.4)' }}>
            Invoice tracker
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
          {INVOICES_TRACKER.map(inv => (
            <InvoiceTrackerCard key={inv.id} inv={inv} />
          ))}
        </div>
      </div>

      {/* Period selector */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {Object.keys(PERIOD_DATA).map(p => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            style={{
              padding: '0.4rem 1rem',
              borderRadius: '999px',
              border: period === p ? '1px solid rgba(194,65,12,0.5)' : '1px solid rgba(255,255,255,0.08)',
              background: period === p ? 'rgba(194,65,12,0.12)' : 'rgba(255,255,255,0.04)',
              color: period === p ? '#fb923c' : 'rgba(226,232,240,0.5)',
              fontWeight: 700,
              fontSize: '0.8rem',
              cursor: 'pointer',
            }}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
        {[
          { label: 'Gross income', value: `£${data.gross.toLocaleString()}`, sub: `${data.jobs} jobs`, color: '#fb923c' },
          { label: 'Net income', value: `£${data.net.toLocaleString()}`, sub: 'After VAT', color: '#4ade80' },
          { label: 'VAT collected', value: `£${data.vat.toLocaleString()}`, sub: '20% standard', color: '#60a5fa' },
        ].map(item => (
          <div key={item.label} style={{ ...card, borderRadius: '0.9rem', padding: '0.9rem 1rem' }}>
            <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'rgba(226,232,240,0.4)', marginBottom: '0.5rem' }}>{item.label}</div>
            <div style={{ fontWeight: 900, fontSize: '1.25rem', fontFamily: 'monospace', color: item.color }}>{item.value}</div>
            <div style={{ fontSize: '0.72rem', color: 'rgba(226,232,240,0.35)', marginTop: '0.2rem' }}>{item.sub}</div>
          </div>
        ))}
      </div>

      {/* By client breakdown */}
      <div style={{ ...card, borderRadius: '1rem', padding: '1.1rem 1.25rem' }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'rgba(226,232,240,0.4)', marginBottom: '0.85rem' }}>
          By client
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {data.breakdown.map(b => {
            const pct = Math.round((b.amount / data.gross) * 100);
            return (
              <div key={b.client}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem', fontSize: '0.82rem' }}>
                  <span style={{ color: 'rgba(226,232,240,0.7)' }}>{b.client}</span>
                  <span style={{ color: 'white', fontWeight: 700, fontFamily: 'monospace' }}>£{b.amount} <span style={{ color: 'rgba(226,232,240,0.35)', fontWeight: 400, fontSize: '0.72rem' }}>{pct}%</span></span>
                </div>
                <div style={{ height: 5, borderRadius: '999px', background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, borderRadius: '999px', background: 'linear-gradient(90deg, #C2410C, #fb923c)' }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Ledger */}
      {data.ledger.length > 0 && (
        <div style={{ ...card, borderRadius: '1rem', padding: '1.1rem 1.25rem' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'rgba(226,232,240,0.4)', marginBottom: '0.85rem' }}>
            Transaction ledger
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {data.ledger.map((tx, i) => (
              <div
                key={tx.ref}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'auto 1fr auto auto',
                  gap: '0.75rem',
                  alignItems: 'center',
                  padding: '0.65rem 0',
                  borderBottom: i < data.ledger.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                  fontSize: '0.8rem',
                }}
              >
                <span style={{ color: 'rgba(226,232,240,0.35)', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>{tx.date}</span>
                <div>
                  <div style={{ color: 'rgba(226,232,240,0.8)' }}>{tx.client}</div>
                  <div style={{ color: 'rgba(226,232,240,0.35)', fontSize: '0.7rem' }}>{tx.ref}</div>
                </div>
                <StatusChip status={tx.status} />
                <span style={{ fontWeight: 800, fontFamily: 'monospace', color: 'white', textAlign: 'right' }}>£{tx.amount}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
