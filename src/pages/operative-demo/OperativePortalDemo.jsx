import { useState, useEffect } from 'react';
import { Camera, CheckCircle2, MapPin, Clock, FileText, Send, Building2, Zap, ChevronRight, LayoutDashboard, ShoppingBag, Star, ClipboardList, CalendarDays, Users, CreditCard, PoundSterling, GraduationCap, Package, TrendingUp, Calculator, Briefcase, Settings, MessageSquare, Receipt, Inbox, ClipboardCheck } from 'lucide-react';

const ACCENT        = '#ea580c';
const ACCENT_DIM    = 'rgba(234,88,12,0.12)';
const ACCENT_BORDER = 'rgba(234,88,12,0.28)';

const JOB = {
  ref:     'BF-4471',
  client:  'Britannia Group',
  site:    'Premier Inn Luton Airport',
  address: 'Airport Way, Luton, LU2 9LY',
  task:    'Window cleaning — external facade',
  date:    'Sat 23 May 2026',
  time:    '06:00–08:00',
  rate:    '£85.00',
  contact: 'James Harper · Area Manager',
};

const QUOTE_JOB = {
  ref:     'BF-4502',
  client:  'Britannia Group',
  site:    'L&D Hospital – A&E Block Ext',
  address: 'Lewsey Road, Luton, LU4 0DZ',
  task:    'Window cleaning — external facade',
  date:    'Sat 6 Jun 2026',
  time:    'Flexible (6–10am)',
  contact: 'James Harper · Area Manager',
  scope:   '3 external elevations · approx 6 hrs · access platform required',
};

const READING_LINES = [
  { label: 'Contractor',   value: 'D. Harris Window Services',   delay: 350  },
  { label: 'Invoice #',    value: 'INV-047',                   delay: 750  },
  { label: 'Date',         value: '24 May 2026',               delay: 1100 },
  { label: 'Site',         value: 'Premier Inn Luton Airport', delay: 1500 },
  { label: 'Description',  value: 'Window cleaning — exterior',delay: 1900 },
  { label: 'Amount (net)', value: '£85.00',                    delay: 2250 },
];

const KEYFRAMES = `
@keyframes spin        { to { transform: rotate(360deg); } }
@keyframes slide-up    { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
@keyframes check-pulse {
  0%,100% { box-shadow: 0 0 0 0 rgba(52,211,153,0.4); }
  50%      { box-shadow: 0 0 0 8px rgba(52,211,153,0); }
}
`;

// ── Mock paper invoice (fictional data — D. Harris Window Services) ─────────────
function PaperInvoiceMock() {
  return (
    <div style={{
      background: '#f9f8f4', border: '1px solid #d4c9a8', borderRadius: '0.75rem',
      padding: '1rem', fontFamily: 'Georgia, serif', fontSize: '0.68rem', color: '#2c2018',
      boxShadow: '0 4px 20px rgba(0,0,0,0.35)', maxWidth: 290, margin: '0 auto',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
        <div style={{ fontSize: '0.57rem', lineHeight: 1.7, color: '#555' }}>
          <div style={{ fontWeight: 700, color: '#222' }}>D. Harris Window Services</div>
          <div>12 Maple Close, Luton LU3 2BN</div>
          <div>Mobile: 07891 234567</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontWeight: 900, fontSize: '0.82rem' }}>INVOICE</div>
          <div style={{ fontSize: '0.52rem', color: '#888', marginTop: 2 }}>No. 047</div>
          <div style={{ fontSize: '0.48rem', color: '#aaa', marginTop: 2 }}>Insured · Public Liability</div>
        </div>
      </div>
      <div style={{ borderTop: '1px solid #ccc', paddingTop: '0.4rem', marginBottom: '0.4rem', fontSize: '0.57rem' }}>
        <div>To: <em>Britannia Group</em> · 24-5-2026</div>
        <div style={{ marginTop: 2 }}>Site: Premier Inn Luton Airport</div>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.6rem' }}>
        <tbody>
          <tr style={{ borderBottom: '1px solid #ddd' }}>
            <td style={{ padding: '0.2rem 0' }}>Window cleaning — exterior</td>
            <td style={{ textAlign: 'right', fontStyle: 'italic' }}>£ 85-00</td>
          </tr>
          <tr>
            <td style={{ padding: '0.3rem 0', textAlign: 'right', fontWeight: 700 }}>TOTAL</td>
            <td style={{ textAlign: 'right', fontWeight: 700, fontStyle: 'italic' }}>£ 85-00</td>
          </tr>
        </tbody>
      </table>
      <div style={{ borderTop: '1px dashed #ccc', marginTop: '0.5rem', paddingTop: '0.35rem', fontSize: '0.5rem', color: '#aaa', fontStyle: 'italic' }}>
        Payment within 30 days. Thank you for your business.
      </div>
    </div>
  );
}

// ── Britannia PDF preview ─────────────────────────────────────────────────────
function BritanniaPDFPreview({ invNo = '047', desc = 'Window cleaning — exterior' }) {
  return (
    <div style={{
      background: 'white', color: '#111', borderRadius: '0.75rem', overflow: 'hidden',
      boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
      fontFamily: "'Inter','Helvetica Neue',Arial,sans-serif",
      animation: 'slide-up 0.28s ease-out',
    }}>
      <div style={{ background: '#1a1a2e', padding: '0.875rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: '0.88rem', color: 'white', letterSpacing: '0.04em' }}>BRITANNIA GROUP</div>
          <div style={{ fontSize: '0.53rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 1 }}>Contractor Invoice</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.56rem', color: 'rgba(255,255,255,0.32)' }}>Processed via</div>
          <div style={{ fontWeight: 800, fontSize: '0.72rem', color: '#fb923c' }}>Cadi Connect</div>
        </div>
      </div>

      <div style={{ padding: '0.875rem 1rem', fontSize: '0.7rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', gap: '0.5rem' }}>
          <div>
            <div style={{ fontSize: '0.53rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#94a3b8', marginBottom: '0.2rem' }}>From</div>
            <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.75rem' }}>D. Harris Window Services</div>
            <div style={{ color: '#64748b', fontSize: '0.62rem', lineHeight: 1.45 }}>12 Maple Close, Luton LU3 2BN</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.53rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#94a3b8', marginBottom: '0.2rem' }}>Invoice</div>
            <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.75rem' }}>No. {invNo}</div>
            <div style={{ color: '#64748b', fontSize: '0.62rem' }}>23 May 2026</div>
            <div style={{ marginTop: 3, display: 'inline-block', padding: '1px 6px', background: '#f0f4ff', border: '1px solid #c7d2fe', borderRadius: 3, fontSize: '0.6rem', fontWeight: 700, color: '#4338ca' }}>WO: BF-4471</div>
          </div>
        </div>

        <div style={{ background: '#f8faff', border: '1px solid #e2e8f0', borderRadius: '0.4rem', padding: '0.38rem 0.65rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <MapPin size={10} color="#64748b" />
          <span style={{ color: '#64748b', fontWeight: 600, fontSize: '0.62rem' }}>Site:</span>
          <span style={{ color: '#0f172a', fontWeight: 700, fontSize: '0.62rem' }}>Premier Inn Luton Airport</span>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '0.6rem' }}>
          <thead>
            <tr style={{ background: '#f8faff', borderBottom: '2px solid #e2e8f0' }}>
              {['Description', 'Net', 'VAT'].map(h => (
                <th key={h} style={{ padding: '0.28rem 0.5rem', textAlign: h === 'Description' ? 'left' : 'right', fontSize: '0.53rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748b' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ padding: '0.42rem 0.5rem', color: '#1e293b', fontSize: '0.63rem' }}>{desc}</td>
              <td style={{ padding: '0.42rem 0.5rem', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, fontSize: '0.63rem' }}>£85.00</td>
              <td style={{ padding: '0.42rem 0.5rem', textAlign: 'right', color: '#94a3b8', fontSize: '0.63rem' }}>N/A</td>
            </tr>
          </tbody>
        </table>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ minWidth: 155 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.22rem 0', color: '#64748b', fontSize: '0.63rem' }}>
              <span>Subtotal</span><span style={{ fontFamily: 'monospace' }}>£85.00</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.28rem 0', borderTop: '2px solid #1a1a2e', marginTop: '0.12rem', fontWeight: 900, fontSize: '0.8rem', color: '#1a1a2e' }}>
              <span>Total due</span><span style={{ fontFamily: 'monospace', color: ACCENT }}>£85.00</span>
            </div>
          </div>
        </div>

        <div style={{ marginTop: '0.65rem', padding: '0.45rem 0.65rem', background: '#fff4e6', border: '1px solid #fed7aa', borderRadius: '0.4rem', fontSize: '0.58rem', color: '#92400e', lineHeight: 1.5 }}>
          Payment within 30 days of approval · accounts@britanniagroup.co.uk
        </div>
      </div>
    </div>
  );
}

// ── Shared step bar ───────────────────────────────────────────────────────────
function InvStepBar({ labels, current }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      {labels.map((label, i) => {
        const done = i < current, active = i === current, isLast = i === labels.length - 1;
        return (
          <div key={label} style={{ display: 'flex', alignItems: 'center', flex: isLast ? 'none' : 1 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem' }}>
              <div style={{
                width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: done ? 'rgba(52,211,153,0.15)' : active ? ACCENT_DIM : 'rgba(255,255,255,0.06)',
                border: done ? '1px solid rgba(52,211,153,0.4)' : active ? `1px solid ${ACCENT_BORDER}` : '1px solid rgba(255,255,255,0.1)',
                fontSize: '0.58rem', fontWeight: 900,
                color: done ? '#34d399' : active ? '#fb923c' : 'rgba(255,255,255,0.25)',
              }}>
                {done ? '✓' : i + 1}
              </div>
              <span style={{ fontSize: '0.58rem', fontWeight: 700, whiteSpace: 'nowrap', color: active ? '#fb923c' : done ? '#34d399' : 'rgba(255,255,255,0.25)' }}>
                {label}
              </span>
            </div>
            {!isLast && <div style={{ flex: 1, height: 1, background: done ? 'rgba(52,211,153,0.25)' : 'rgba(255,255,255,0.07)', margin: '0 0.3rem', marginBottom: '1.1rem' }} />}
          </div>
        );
      })}
    </div>
  );
}

// ── Shared submitted + payment panel ─────────────────────────────────────────
function SubmittedPanel({ paid, onReset, invNo = '047' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1.25rem 1rem', animation: 'slide-up 0.2s ease-out' }}>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.55rem', padding: '0.875rem 0', textAlign: 'center' }}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'check-pulse 2s ease-in-out infinite' }}>
          <CheckCircle2 size={20} color="#34d399" />
        </div>
        <div style={{ fontWeight: 900, fontSize: '0.95rem', color: '#34d399' }}>Invoice submitted</div>
        <div style={{ fontSize: '0.67rem', color: 'rgba(255,255,255,0.38)', lineHeight: 1.6 }}>
          Sent to <strong style={{ color: 'rgba(255,255,255,0.55)' }}>accounts@britanniagroup.co.uk</strong><br />
          Awaiting approval in Britannia accounts inbox
        </div>
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          <span style={{ fontSize: '0.58rem', padding: '0.18rem 0.6rem', borderRadius: 999, background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)', color: '#34d399', fontWeight: 700 }}>✓ Email sent</span>
          <span style={{ fontSize: '0.58rem', padding: '0.18rem 0.6rem', borderRadius: 999, background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)', color: '#60a5fa', fontWeight: 700 }}>✓ Portal inbox updated</span>
        </div>
      </div>

      <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />

      {paid ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', animation: 'slide-up 0.25s ease-out' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.72rem 0.875rem', borderRadius: '0.75rem', background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.28)' }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#34d399', boxShadow: '0 0 8px rgba(52,211,153,0.7)', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 900, fontSize: '0.72rem', color: '#34d399' }}>Payment approved by Britannia Group</div>
              <div style={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.3)', marginTop: 1 }}>Approved by James Harper · Area Manager · just now</div>
            </div>
          </div>
          <div style={{ borderRadius: '0.75rem', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
            {[
              { label: 'Invoice #',  value: `INV-${invNo}` },
              { label: 'Amount',     value: '£85.00', highlight: true },
              { label: 'Method',     value: 'BACS transfer' },
              { label: 'Pay date',   value: '25 Jun 2026' },
              { label: 'Reference',  value: 'BF-4471-D.HARRIS' },
            ].map(({ label, value, highlight }, i, arr) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.52rem 0.875rem', borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                <span style={{ fontSize: '0.63rem', color: 'rgba(255,255,255,0.32)', fontWeight: 600 }}>{label}</span>
                <span style={{ fontSize: highlight ? '0.88rem' : '0.68rem', fontWeight: highlight ? 900 : 700, color: highlight ? '#34d399' : 'rgba(255,255,255,0.72)' }}>{value}</span>
              </div>
            ))}
          </div>
          <div style={{ padding: '0.55rem 0.75rem', borderRadius: '0.6rem', background: 'rgba(251,146,60,0.07)', border: '1px solid rgba(251,146,60,0.18)', fontSize: '0.62rem', color: 'rgba(255,255,255,0.4)', lineHeight: 1.5 }}>
            Your bank will receive this via BACS. Typical clearing time: 1–2 business days after pay date.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', padding: '0.65rem 0.875rem', borderRadius: '0.65rem', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ width: 11, height: 11, border: '2px solid rgba(255,255,255,0.2)', borderTopColor: '#34d399', borderRadius: '50%', animation: 'spin 1s linear infinite', flexShrink: 0 }} />
          <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', fontWeight: 600 }}>Waiting for FM approval…</span>
        </div>
      )}

      <button
        onClick={onReset}
        style={{ marginTop: '0.25rem', padding: '0.48rem 1.1rem', borderRadius: '0.6rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.3)', fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer' }}>
        Submit another invoice
      </button>
    </div>
  );
}

// ── Method Chooser ────────────────────────────────────────────────────────────
function MethodChooser({ onChoose }) {
  return (
    <div style={{ padding: '1.25rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', animation: 'slide-up 0.2s ease-out' }}>

      <div style={{ marginBottom: '0.1rem' }}>
        <div style={{ fontWeight: 800, fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)', marginBottom: '0.2rem' }}>Submit invoice — BF-4471</div>
        <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.25)', lineHeight: 1.5 }}>Choose how you want to submit your invoice for this job.</div>
      </div>

      {/* Create invoice in-app */}
      <button
        onClick={() => onChoose('create')}
        style={{ width: '100%', borderRadius: '1rem', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)', cursor: 'pointer', textAlign: 'left', padding: 0, overflow: 'hidden', transition: 'all 0.15s' }}
        onMouseEnter={e => { e.currentTarget.style.border = `1px solid ${ACCENT_BORDER}`; e.currentTarget.style.background = ACCENT_DIM; }}
        onMouseLeave={e => { e.currentTarget.style.border = '1px solid rgba(255,255,255,0.1)'; e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
      >
        <div style={{ padding: '0.875rem 1rem', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <div style={{ width: 38, height: 38, borderRadius: '0.6rem', background: ACCENT_DIM, border: `1px solid ${ACCENT_BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <FileText size={17} color={ACCENT} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 900, fontSize: '0.82rem', color: 'white', marginBottom: '0.15rem' }}>Create invoice in-app</div>
            <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.38)', lineHeight: 1.45 }}>Pre-filled from your job card. Reviewed and submitted in under a minute.</div>
          </div>
          <ChevronRight size={14} color="rgba(255,255,255,0.2)" style={{ flexShrink: 0 }} />
        </div>
      </button>

      {/* Upload paper invoice */}
      <button
        onClick={() => onChoose('paper')}
        style={{ width: '100%', borderRadius: '1rem', border: '1px solid rgba(52,211,153,0.22)', background: 'rgba(52,211,153,0.03)', cursor: 'pointer', textAlign: 'left', padding: 0, overflow: 'hidden', transition: 'all 0.15s' }}
        onMouseEnter={e => { e.currentTarget.style.border = '1px solid rgba(52,211,153,0.45)'; e.currentTarget.style.background = 'rgba(52,211,153,0.07)'; }}
        onMouseLeave={e => { e.currentTarget.style.border = '1px solid rgba(52,211,153,0.22)'; e.currentTarget.style.background = 'rgba(52,211,153,0.03)'; }}
      >
        <div style={{ padding: '0.875rem 1rem 0.7rem', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <div style={{ width: 38, height: 38, borderRadius: '0.6rem', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Camera size={17} color="#34d399" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.15rem' }}>
              <span style={{ fontWeight: 900, fontSize: '0.82rem', color: 'white' }}>Upload paper invoice</span>
              <span style={{ fontSize: '0.48rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', padding: '0.12rem 0.45rem', borderRadius: 999, background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.35)', color: '#34d399', flexShrink: 0 }}>Smart scan</span>
            </div>
            <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.38)', lineHeight: 1.45 }}>Already written your invoice? Photo it — Cadi reads it automatically.</div>
          </div>
          <ChevronRight size={14} color="rgba(52,211,153,0.4)" style={{ flexShrink: 0 }} />
        </div>
        <div style={{ padding: '0.42rem 1rem', borderTop: '1px solid rgba(52,211,153,0.12)', background: 'rgba(52,211,153,0.04)', fontSize: '0.58rem', color: '#34d399', fontWeight: 700 }}>
          ✨ Cadi reads your handwriting and generates a Britannia-approved PDF
        </div>
      </button>

      <div style={{ fontSize: '0.57rem', color: 'rgba(255,255,255,0.18)', textAlign: 'center', lineHeight: 1.5 }}>
        Both routes match to job ref BF-4471 automatically
      </div>
    </div>
  );
}

// ── Create Invoice Flow ───────────────────────────────────────────────────────
function CreateInvoiceFlow({ onReset }) {
  const [step, setStep]     = useState('form');
  const [paid, setPaid]     = useState(false);
  const [invNo, setInvNo]   = useState('INV-047');
  const [desc, setDesc]     = useState('Window cleaning — external facade');
  const [amount, setAmount] = useState('85.00');

  useEffect(() => {
    if (step !== 'generating') return;
    const t = setTimeout(() => setStep('preview'), 950);
    return () => clearTimeout(t);
  }, [step]);

  useEffect(() => {
    if (step !== 'submitted') return;
    const t = setTimeout(() => setPaid(true), 2800);
    return () => clearTimeout(t);
  }, [step]);

  const stepIdx = { form: 0, generating: 1, preview: 1, submitted: 2 }[step] ?? 0;

  if (step === 'submitted') return <SubmittedPanel paid={paid} onReset={onReset} invNo={invNo.replace(/\D/g, '') || '047'} />;

  const inputStyle = {
    width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '0.5rem', padding: '0.52rem 0.7rem', color: 'white', fontSize: '0.72rem',
    fontWeight: 600, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
  };
  const labelStyle = { fontSize: '0.55rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.3)', marginBottom: '0.28rem' };

  return (
    <div style={{ padding: '1.25rem 1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <InvStepBar labels={['Form', 'Preview', 'Paid']} current={stepIdx} />

      {step === 'form' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', animation: 'slide-up 0.2s ease-out' }}>

          {/* Auto-filled job details */}
          <div style={{ borderRadius: '0.75rem', border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden' }}>
            <div style={{ padding: '0.42rem 0.75rem', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: '0.52rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.22)' }}>
              Auto-filled from job card BF-4471
            </div>
            <div style={{ padding: '0.6rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.32rem' }}>
              {[
                ['Client',  'Britannia Group'],
                ['Site',    'Premier Inn Luton Airport'],
                ['Date',    '24 May 2026'],
                ['Job ref', 'BF-4471'],
              ].map(([lbl, val]) => (
                <div key={lbl} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.28)', fontWeight: 600 }}>{lbl}</span>
                  <span style={{ fontSize: '0.63rem', fontWeight: 700, color: 'rgba(255,255,255,0.48)' }}>{val}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Editable fields */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            <div>
              <div style={labelStyle}>Invoice number</div>
              <input style={inputStyle} value={invNo} onChange={e => setInvNo(e.target.value)} placeholder="e.g. INV-047" />
            </div>
            <div>
              <div style={labelStyle}>Description of work</div>
              <input style={inputStyle} value={desc} onChange={e => setDesc(e.target.value)} />
            </div>
            <div>
              <div style={labelStyle}>Amount (£)</div>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '0.7rem', top: '50%', transform: 'translateY(-50%)', color: '#fb923c', fontWeight: 900, fontSize: '0.82rem', pointerEvents: 'none' }}>£</span>
                <input style={{ ...inputStyle, paddingLeft: '1.6rem' }} value={amount} onChange={e => setAmount(e.target.value)} type="number" step="0.01" />
              </div>
            </div>
          </div>

          {/* From line */}
          <div style={{ padding: '0.52rem 0.75rem', borderRadius: '0.6rem', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.57rem', color: 'rgba(255,255,255,0.27)', fontWeight: 600 }}>From (your profile)</span>
            <span style={{ fontSize: '0.63rem', fontWeight: 700, color: 'rgba(255,255,255,0.45)' }}>D. Harris Window Services</span>
          </div>

          <button
            onClick={() => setStep('generating')}
            style={{ width: '100%', padding: '0.85rem', borderRadius: '0.75rem', background: `linear-gradient(135deg, ${ACCENT}, #c2410c)`, border: 'none', color: 'white', fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.45rem', boxShadow: '0 4px 16px rgba(234,88,12,0.35)' }}>
            <FileText size={14} /> Preview invoice →
          </button>
        </div>
      )}

      {step === 'generating' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.85rem', padding: '2.5rem 0', animation: 'slide-up 0.2s ease-out' }}>
          <div style={{ width: 13, height: 13, border: `2px solid ${ACCENT_BORDER}`, borderTopColor: ACCENT, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'rgba(255,255,255,0.4)' }}>Generating your Britannia invoice…</div>
        </div>
      )}

      {step === 'preview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', animation: 'slide-up 0.2s ease-out' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#34d399' }}>
            <CheckCircle2 size={14} />
            <span style={{ fontSize: '0.7rem', fontWeight: 800 }}>Invoice ready — review before submitting</span>
          </div>
          <BritanniaPDFPreview invNo={invNo.replace(/\D/g, '') || '047'} desc={desc} />
          <button
            onClick={() => setStep('submitted')}
            style={{ width: '100%', padding: '0.85rem', borderRadius: '0.75rem', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.28)', color: '#34d399', fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.45rem' }}>
            <Send size={14} /> Submit to Britannia accounts →
          </button>
        </div>
      )}
    </div>
  );
}

// ── Paper Invoice Flow ────────────────────────────────────────────────────────
function PaperInvoiceFlow({ onReset }) {
  const [step, setStep]       = useState('upload');
  const [visible, setVisible] = useState([]);
  const [paid, setPaid]       = useState(false);

  useEffect(() => {
    if (step !== 'scanning') return;
    const timers  = READING_LINES.map((l, i) => setTimeout(() => setVisible(v => [...v, i]), l.delay));
    const advance = setTimeout(() => setStep('preview'), 2900);
    return () => { timers.forEach(clearTimeout); clearTimeout(advance); };
  }, [step]);

  useEffect(() => {
    if (step !== 'submitted') return;
    const t = setTimeout(() => setPaid(true), 2800);
    return () => clearTimeout(t);
  }, [step]);

  const stepIdx = { upload: 0, scanning: 1, preview: 2, submitted: 3 }[step] ?? 0;

  if (step === 'submitted') return <SubmittedPanel paid={paid} onReset={onReset} />;

  return (
    <div style={{ padding: '1.25rem 1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <InvStepBar labels={['Upload', 'Scanning', 'Preview', 'Paid']} current={stepIdx} />

      {step === 'upload' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', alignItems: 'center', animation: 'slide-up 0.2s ease-out' }}>
          <div style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.35)', textAlign: 'center', lineHeight: 1.55, maxWidth: 260 }}>
            Photo or scan your handwritten invoice — Cadi reads it and generates a Britannia-approved PDF automatically
          </div>
          <PaperInvoiceMock />
          <button
            onClick={() => { setVisible([]); setStep('scanning'); }}
            style={{ width: '100%', maxWidth: 290, padding: '0.78rem', borderRadius: '0.75rem', background: `linear-gradient(135deg, ${ACCENT}, #c2410c)`, border: 'none', color: 'white', fontWeight: 800, fontSize: '0.82rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.45rem', boxShadow: '0 4px 16px rgba(234,88,12,0.35)' }}>
            <Camera size={14} /> Scan invoice →
          </button>
          <div style={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.18)', textAlign: 'center', lineHeight: 1.5 }}>
            Supports photo, scan or PDF upload
          </div>
        </div>
      )}

      {step === 'scanning' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', animation: 'slide-up 0.2s ease-out' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#fb923c' }}>
            <div style={{ width: 13, height: 13, border: '2px solid #ea580c', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
            <span style={{ fontSize: '0.72rem', fontWeight: 800 }}>Cadi is reading your invoice…</span>
          </div>
          <PaperInvoiceMock />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            {READING_LINES.map((line, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '0.38rem 0.65rem', borderRadius: '0.5rem',
                background: visible.includes(i) ? 'rgba(52,211,153,0.06)' : 'rgba(255,255,255,0.02)',
                border:     visible.includes(i) ? '1px solid rgba(52,211,153,0.2)' : '1px solid rgba(255,255,255,0.04)',
                opacity:    visible.includes(i) ? 1 : 0.3,
                transition: 'opacity 0.25s, background 0.25s, border-color 0.25s',
              }}>
                <span style={{ fontSize: '0.63rem', color: 'rgba(255,255,255,0.38)' }}>{line.label}</span>
                <span style={{ fontSize: '0.67rem', fontWeight: 700, color: visible.includes(i) ? '#34d399' : 'rgba(255,255,255,0.2)' }}>
                  {visible.includes(i) ? line.value : '…'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {step === 'preview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', animation: 'slide-up 0.2s ease-out' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#34d399' }}>
            <CheckCircle2 size={14} />
            <span style={{ fontSize: '0.7rem', fontWeight: 800 }}>All fields extracted — Britannia PDF ready</span>
          </div>
          <BritanniaPDFPreview />
          <button
            onClick={() => setStep('submitted')}
            style={{ width: '100%', padding: '0.85rem', borderRadius: '0.75rem', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.28)', color: '#34d399', fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.45rem' }}>
            <Send size={14} /> Submit to Britannia accounts →
          </button>
        </div>
      )}
    </div>
  );
}

// ── Invoice Tab ───────────────────────────────────────────────────────────────
function InvoiceTab() {
  const [mode, setMode] = useState(null);
  if (!mode) return <MethodChooser onChoose={setMode} />;
  if (mode === 'create') return <CreateInvoiceFlow onReset={() => setMode(null)} />;
  return <PaperInvoiceFlow onReset={() => setMode(null)} />;
}

// ── Evidence Tab ──────────────────────────────────────────────────────────────
function EvidenceTab({ done, onDone }) {
  const [photos,    setPhotos]    = useState([false, false, false]);
  const [submitted, setSubmitted] = useState(false);
  const allUploaded = photos.every(Boolean);

  return (
    <div style={{ padding: '1.25rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
      <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'rgba(255,255,255,0.5)' }}>
        Completion evidence — Premier Inn Luton Airport
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.5rem' }}>
        {photos.map((up, i) => (
          <button
            key={i}
            onClick={() => !up && setPhotos(p => p.map((v, idx) => idx === i ? true : v))}
            style={{ aspectRatio: '1', borderRadius: '0.75rem', border: up ? '1px solid rgba(52,211,153,0.35)' : '1px dashed rgba(255,255,255,0.15)', background: up ? 'rgba(52,211,153,0.07)' : 'rgba(255,255,255,0.03)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', cursor: up ? 'default' : 'pointer', transition: 'all 0.15s' }}>
            {up ? (
              <>
                <CheckCircle2 size={20} color="#34d399" />
                <span style={{ fontSize: '0.55rem', color: '#34d399', fontWeight: 700 }}>Uploaded</span>
              </>
            ) : (
              <>
                <Camera size={18} color="rgba(255,255,255,0.22)" />
                <span style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.28)', fontWeight: 600 }}>Add photo</span>
              </>
            )}
          </button>
        ))}
      </div>

      <div style={{ padding: '0.6rem 0.8rem', borderRadius: '0.6rem', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        <MapPin size={13} color={ACCENT} style={{ flexShrink: 0 }} />
        <div>
          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'rgba(255,255,255,0.65)' }}>Premier Inn Luton Airport</div>
          <div style={{ fontSize: '0.57rem', color: 'rgba(255,255,255,0.25)', marginTop: 1 }}>51.8762° N, 0.3624° W · 08:04 today</div>
        </div>
      </div>

      <div style={{ padding: '0.6rem 0.8rem', borderRadius: '0.6rem', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        <Clock size={13} color="rgba(255,255,255,0.32)" style={{ flexShrink: 0 }} />
        <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.42)' }}>
          Completed at <strong style={{ color: 'rgba(255,255,255,0.62)' }}>08:04</strong> · 2 hrs 4 mins on site
        </div>
      </div>

      {!submitted ? (
        <button
          onClick={() => { if (allUploaded) { setSubmitted(true); setTimeout(onDone, 500); } }}
          style={{ width: '100%', padding: '0.85rem', borderRadius: '0.75rem', background: allUploaded ? `linear-gradient(135deg, ${ACCENT}, #c2410c)` : 'rgba(255,255,255,0.04)', border: allUploaded ? 'none' : '1px solid rgba(255,255,255,0.08)', color: allUploaded ? 'white' : 'rgba(255,255,255,0.25)', fontWeight: 800, fontSize: '0.8rem', cursor: allUploaded ? 'pointer' : 'not-allowed', boxShadow: allUploaded ? '0 4px 16px rgba(234,88,12,0.3)' : 'none', transition: 'all 0.2s' }}>
          {allUploaded ? 'Submit evidence & proceed to invoice →' : `Upload ${photos.filter(Boolean).length}/3 photos to continue`}
        </button>
      ) : (
        <div style={{ padding: '0.75rem', borderRadius: '0.75rem', background: 'rgba(52,211,153,0.07)', border: '1px solid rgba(52,211,153,0.22)', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#34d399' }}>
          <CheckCircle2 size={15} />
          <span style={{ fontSize: '0.72rem', fontWeight: 700 }}>Evidence submitted — opening Invoice tab…</span>
        </div>
      )}
    </div>
  );
}

// ── Job Card Tab ──────────────────────────────────────────────────────────────
function JobCardTab({ done, onDone }) {
  return (
    <div style={{ padding: '1.25rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.22rem 0.65rem', borderRadius: 999, background: ACCENT_DIM, border: `1px solid ${ACCENT_BORDER}`, alignSelf: 'flex-start' }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: ACCENT, boxShadow: '0 0 6px rgba(234,88,12,0.7)' }} />
        <span style={{ fontSize: '0.58rem', fontWeight: 800, color: '#fb923c', textTransform: 'uppercase', letterSpacing: '0.08em' }}>In Progress · Britannia Group</span>
      </div>

      <div>
        <div style={{ fontWeight: 900, fontSize: '1rem', color: 'white', lineHeight: 1.2 }}>{JOB.task}</div>
        <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.42)', marginTop: '0.2rem' }}>{JOB.site}</div>
      </div>

      {[
        { icon: Building2, value: `Ref #${JOB.ref}`,            sub: 'Job reference' },
        { icon: MapPin,    value: JOB.address,                  sub: 'Site address'  },
        { icon: Clock,     value: `${JOB.date} · ${JOB.time}`, sub: 'Date & time'   },
      ].map(({ icon: Icon, value, sub }) => (
        <div key={sub} style={{ display: 'flex', gap: '0.65rem', alignItems: 'flex-start', padding: '0.58rem 0.75rem', borderRadius: '0.6rem', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <Icon size={13} color="rgba(255,255,255,0.3)" style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'rgba(255,255,255,0.68)' }}>{value}</div>
            <div style={{ fontSize: '0.57rem', color: 'rgba(255,255,255,0.25)', marginTop: 1 }}>{sub}</div>
          </div>
        </div>
      ))}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.62rem 0.82rem', borderRadius: '0.6rem', background: 'rgba(234,88,12,0.07)', border: '1px solid rgba(234,88,12,0.18)' }}>
        <span style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.42)' }}>Job rate</span>
        <span style={{ fontWeight: 900, fontSize: '1rem', color: '#fb923c' }}>{JOB.rate}</span>
      </div>

      <div style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.28)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        <Building2 size={11} style={{ flexShrink: 0 }} />
        FM contact: {JOB.contact}
      </div>

      {!done ? (
        <button
          onClick={onDone}
          style={{ width: '100%', padding: '0.85rem', borderRadius: '0.75rem', background: `linear-gradient(135deg, ${ACCENT}, #c2410c)`, border: 'none', color: 'white', fontWeight: 800, fontSize: '0.82rem', cursor: 'pointer', boxShadow: '0 4px 16px rgba(234,88,12,0.3)', marginTop: '0.2rem' }}>
          Mark job complete →
        </button>
      ) : (
        <div style={{ padding: '0.72rem', borderRadius: '0.72rem', background: 'rgba(52,211,153,0.07)', border: '1px solid rgba(52,211,153,0.22)', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#34d399' }}>
          <CheckCircle2 size={15} />
          <span style={{ fontSize: '0.72rem', fontWeight: 700 }}>Job complete — upload your evidence next</span>
        </div>
      )}
    </div>
  );
}

// ── Welcome / Onboarding Tab ──────────────────────────────────────────────────
function WelcomeTab({ onStart, onActivate }) {
  const [smsIn, setSmsIn] = useState(false);
  useEffect(() => { const t = setTimeout(() => setSmsIn(true), 380); return () => clearTimeout(t); }, []);

  return (
    <div style={{ padding: '1.25rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.95rem', animation: 'slide-up 0.2s ease-out' }}>

      {/* SMS bubble */}
      <div style={{
        opacity: smsIn ? 1 : 0, transform: smsIn ? 'translateY(0)' : 'translateY(8px)', transition: 'all 0.4s ease-out',
        borderRadius: '0.875rem', border: '1px solid rgba(52,211,153,0.25)', background: 'rgba(52,211,153,0.04)',
        padding: '0.72rem 0.875rem', display: 'flex', gap: '0.65rem', alignItems: 'flex-start',
      }}>
        <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 900, fontSize: '0.7rem', color: 'white' }}>B</div>
        <div>
          <div style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.28)', marginBottom: '0.18rem' }}>SMS from Britannia Group · just now</div>
          <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.75)', lineHeight: 1.55 }}>
            Hi Dave — Britannia Group has added you to their contractor network on Cadi. Your free account is ready.
          </div>
        </div>
      </div>

      {/* Activate CTA */}
      <button
        onClick={onActivate}
        style={{
          width: '100%', padding: '0.85rem', borderRadius: '0.875rem',
          background: 'linear-gradient(135deg, #34d399, #059669)',
          border: 'none', color: 'white', fontWeight: 900, fontSize: '0.88rem',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.45rem',
          boxShadow: '0 4px 20px rgba(52,211,153,0.35)',
          animation: 'check-pulse 2s ease-in-out infinite',
          opacity: smsIn ? 1 : 0, transform: smsIn ? 'translateY(0)' : 'translateY(8px)', transition: 'opacity 0.4s 0.2s ease-out, transform 0.4s 0.2s ease-out',
        }}
      >
        Tap to activate your account →
      </button>

      {/* Free account card */}
      <div style={{ borderRadius: '1rem', overflow: 'hidden', border: `1px solid ${ACCENT_BORDER}`, background: ACCENT_DIM }}>
        <div style={{ padding: '0.72rem 0.9rem', borderBottom: '1px solid rgba(234,88,12,0.15)', display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
          <div style={{ width: 28, height: 28, borderRadius: '0.5rem', background: 'rgba(234,88,12,0.18)', border: `1px solid ${ACCENT_BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Zap size={13} color={ACCENT} />
          </div>
          <div>
            <div style={{ fontWeight: 900, fontSize: '0.8rem', color: 'white' }}>Cadi Lite — your free account is live</div>
            <div style={{ fontSize: '0.56rem', color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>Set up by Britannia Group · free for you, forever</div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
          {[
            { icon: '📋', label: 'Job cards',       sub: 'Full job details, every time' },
            { icon: '📸', label: 'Photo evidence',  sub: 'Stamp jobs complete in-app'  },
            { icon: '🧾', label: 'Invoice in-app',  sub: 'Pre-filled, submit in seconds'},
            { icon: '💳', label: 'Payment tracking', sub: 'See exactly when you get paid'},
          ].map(({ icon, label, sub }, i) => (
            <div key={label} style={{
              padding: '0.62rem 0.875rem',
              borderRight: i % 2 === 0 ? '1px solid rgba(255,255,255,0.06)' : 'none',
              borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.06)' : 'none',
            }}>
              <div style={{ fontSize: '0.88rem', marginBottom: '0.15rem' }}>{icon}</div>
              <div style={{ fontSize: '0.63rem', fontWeight: 800, color: 'rgba(255,255,255,0.72)' }}>{label}</div>
              <div style={{ fontSize: '0.53rem', color: 'rgba(255,255,255,0.28)', marginTop: 1, lineHeight: 1.38 }}>{sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* How the workflow looks */}
      <div style={{ borderRadius: '0.875rem', border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)', padding: '0.875rem 1rem' }}>
        <div style={{ fontSize: '0.55rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.22)', marginBottom: '0.7rem' }}>How every job works</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {[
            { n: '1', label: 'Job comes in',       detail: 'Britannia sends you a job via Cadi Connect — you accept or decline in-app' },
            { n: '2', label: 'View your job card', detail: 'Site address, time slot, rate, and FM contact — all in one place' },
            { n: '3', label: 'Upload evidence',    detail: 'Photograph the completed work directly in the app to confirm delivery' },
            { n: '4', label: 'Invoice & get paid', detail: 'Invoice pre-fills from your job card — submit in seconds, track payment in-app' },
          ].map(({ n, label, detail }) => (
            <div key={n} style={{ display: 'flex', gap: '0.65rem', alignItems: 'flex-start' }}>
              <div style={{ width: 20, height: 20, borderRadius: '50%', background: ACCENT_DIM, border: `1px solid ${ACCENT_BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '0.58rem', fontWeight: 900, color: '#fb923c', marginTop: 1 }}>{n}</div>
              <div>
                <div style={{ fontSize: '0.67rem', fontWeight: 800, color: 'rgba(255,255,255,0.68)' }}>{label}</div>
                <div style={{ fontSize: '0.56rem', color: 'rgba(255,255,255,0.3)', marginTop: '0.08rem', lineHeight: 1.45 }}>{detail}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Notification nudge + CTA */}
      <div style={{ padding: '0.5rem 0.75rem', borderRadius: '0.6rem', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: ACCENT, boxShadow: '0 0 8px rgba(234,88,12,0.7)', flexShrink: 0, animation: 'check-pulse 2s ease-in-out infinite' }} />
        <span style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.45)', fontWeight: 600 }}>You already have a new job waiting</span>
      </div>

      <button
        onClick={onStart}
        style={{ width: '100%', padding: '0.9rem', borderRadius: '0.875rem', background: `linear-gradient(135deg, ${ACCENT}, #c2410c)`, border: 'none', color: 'white', fontWeight: 900, fontSize: '0.88rem', cursor: 'pointer', boxShadow: '0 4px 20px rgba(234,88,12,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.45rem' }}>
        View your first job offer →
      </button>
    </div>
  );
}

// ── New Job Notification Tab ──────────────────────────────────────────────────
function NewJobTab({ onAccept, onDecline, declined }) {
  return (
    <div style={{ padding: '1.25rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>

      {/* Notification header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', padding: '0.65rem 0.875rem', borderRadius: '0.75rem', background: ACCENT_DIM, border: `1px solid ${ACCENT_BORDER}`, animation: 'slide-up 0.22s ease-out' }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: ACCENT, boxShadow: '0 0 8px rgba(234,88,12,0.7)', flexShrink: 0, animation: 'check-pulse 2s ease-in-out infinite' }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 900, color: '#fb923c' }}>New job offered via Cadi Connect</div>
          <div style={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.38)', marginTop: 1 }}>Sent by James Harper · Area Manager · 2 min ago</div>
        </div>
      </div>

      {/* Job offer card */}
      <div style={{ borderRadius: '1rem', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', animation: 'slide-up 0.28s ease-out' }}>

        {/* Card header */}
        <div style={{ padding: '0.875rem 1rem', background: `linear-gradient(135deg, ${ACCENT}1a, ${ACCENT}0a)`, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
            <div>
              <div style={{ fontWeight: 900, fontSize: '1rem', color: 'white', lineHeight: 1.15 }}>{JOB.task}</div>
              <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.45)', marginTop: '0.25rem' }}>{JOB.site}</div>
            </div>
            <div style={{ fontWeight: 900, fontSize: '1.1rem', color: '#fb923c', flexShrink: 0 }}>{JOB.rate}</div>
          </div>
        </div>

        {/* Details grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          {[
            { label: 'Date', value: JOB.date },
            { label: 'Time', value: JOB.time },
            { label: 'Address', value: JOB.address },
            { label: 'Ref', value: `#${JOB.ref}` },
          ].map(({ label, value }, i) => (
            <div key={label} style={{
              padding: '0.6rem 0.875rem',
              borderRight: i % 2 === 0 ? '1px solid rgba(255,255,255,0.06)' : 'none',
              borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.06)' : 'none',
            }}>
              <div style={{ fontSize: '0.55rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.25)', marginBottom: '0.18rem' }}>{label}</div>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'rgba(255,255,255,0.72)' }}>{value}</div>
            </div>
          ))}
        </div>

        {/* FM contact */}
        <div style={{ padding: '0.55rem 0.875rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Building2 size={11} color="rgba(255,255,255,0.25)" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.3)' }}>{JOB.client} · {JOB.contact}</span>
        </div>
      </div>

      {/* Connect score note */}
      <div style={{ padding: '0.5rem 0.75rem', borderRadius: '0.55rem', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Zap size={11} color="#fb923c" style={{ flexShrink: 0 }} />
        <span style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.38)', lineHeight: 1.4 }}>
          You were selected because your Connect score of <strong style={{ color: '#fb923c' }}>91</strong> is the highest match for this job type and location.
        </span>
      </div>

      {/* Response deadline */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        <Clock size={11} color="#fbbf24" style={{ flexShrink: 0 }} />
        <span style={{ fontSize: '0.62rem', color: '#fbbf24', fontWeight: 700 }}>Respond within 2 hours or job will be offered to the next available sub</span>
      </div>

      {/* Accept / Decline */}
      {!declined ? (
        <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.2rem' }}>
          <button
            onClick={onAccept}
            style={{ flex: 1, padding: '0.9rem', borderRadius: '0.875rem', border: 'none', cursor: 'pointer', background: `linear-gradient(135deg, ${ACCENT}, #c2410c)`, color: 'white', fontWeight: 900, fontSize: '0.88rem', boxShadow: '0 4px 16px rgba(234,88,12,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
            <CheckCircle2 size={16} /> Accept job
          </button>
          <button
            onClick={onDecline}
            style={{ padding: '0.9rem 1.1rem', borderRadius: '0.875rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.35)', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}>
            Decline
          </button>
        </div>
      ) : (
        <div style={{ padding: '1rem', borderRadius: '0.875rem', background: 'rgba(248,113,113,0.07)', border: '1px solid rgba(248,113,113,0.2)', textAlign: 'center', animation: 'slide-up 0.2s ease-out' }}>
          <div style={{ fontWeight: 900, fontSize: '0.82rem', color: '#f87171', marginBottom: '0.25rem' }}>Job declined</div>
          <div style={{ fontSize: '0.63rem', color: 'rgba(255,255,255,0.3)', lineHeight: 1.5 }}>
            Britannia Group has been notified. Job re-dispatched to next available contractor automatically.
          </div>
        </div>
      )}
    </div>
  );
}

// ── Quote Job Tab ─────────────────────────────────────────────────────────────
function QuoteJobTab() {
  const [step, setStep] = useState('view'); // 'view' | 'quote' | 'submitted'
  const [amount, setAmount] = useState('');
  const [notes,  setNotes]  = useState('');
  const [approved, setApproved] = useState(false);

  const inputStyle = {
    width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '0.5rem', padding: '0.52rem 0.7rem', color: 'white', fontSize: '0.72rem',
    fontWeight: 600, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
  };

  useEffect(() => {
    if (step !== 'submitted') return;
    const t = setTimeout(() => setApproved(true), 3200);
    return () => clearTimeout(t);
  }, [step]);

  if (step === 'submitted') {
    return (
      <div style={{ padding: '1.25rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', animation: 'slide-up 0.2s ease-out' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.55rem', padding: '1rem 0', textAlign: 'center' }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'check-pulse 2s ease-in-out infinite' }}>
            <CheckCircle2 size={20} color="#34d399" />
          </div>
          <div style={{ fontWeight: 900, fontSize: '0.95rem', color: '#34d399' }}>Quote submitted</div>
          <div style={{ fontSize: '0.67rem', color: 'rgba(255,255,255,0.38)', lineHeight: 1.6 }}>
            Your quote of <strong style={{ color: '#fb923c' }}>£{amount}</strong> sent to<br />
            <strong style={{ color: 'rgba(255,255,255,0.55)' }}>James Harper · Britannia Group</strong>
          </div>
        </div>

        <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />

        {approved ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', animation: 'slide-up 0.25s ease-out' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.72rem 0.875rem', borderRadius: '0.75rem', background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.28)' }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#34d399', boxShadow: '0 0 8px rgba(52,211,153,0.7)', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 900, fontSize: '0.72rem', color: '#34d399' }}>Quote approved by Britannia Group</div>
                <div style={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.3)', marginTop: 1 }}>James Harper · Area Manager · just now</div>
              </div>
            </div>
            <div style={{ borderRadius: '0.75rem', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
              {[
                { label: 'Job ref',     value: QUOTE_JOB.ref },
                { label: 'Agreed price', value: `£${amount}`, highlight: true },
                { label: 'Site',        value: QUOTE_JOB.site },
                { label: 'Date',        value: QUOTE_JOB.date },
              ].map(({ label, value, highlight }, i, arr) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.52rem 0.875rem', borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                  <span style={{ fontSize: '0.63rem', color: 'rgba(255,255,255,0.32)', fontWeight: 600 }}>{label}</span>
                  <span style={{ fontSize: highlight ? '0.88rem' : '0.68rem', fontWeight: highlight ? 900 : 700, color: highlight ? '#34d399' : 'rgba(255,255,255,0.72)' }}>{value}</span>
                </div>
              ))}
            </div>
            <div style={{ padding: '0.55rem 0.75rem', borderRadius: '0.6rem', background: 'rgba(251,146,60,0.07)', border: '1px solid rgba(251,146,60,0.18)', fontSize: '0.62rem', color: 'rgba(255,255,255,0.4)', lineHeight: 1.5 }}>
              Job is now confirmed. You'll receive a job card with full site details before the date.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', padding: '0.65rem 0.875rem', borderRadius: '0.65rem', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ width: 11, height: 11, border: '2px solid rgba(255,255,255,0.2)', borderTopColor: '#34d399', borderRadius: '50%', animation: 'spin 1s linear infinite', flexShrink: 0 }} />
            <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', fontWeight: 600 }}>Waiting for FM to review your quote…</span>
          </div>
        )}
      </div>
    );
  }

  if (step === 'quote') {
    return (
      <div style={{ padding: '1.25rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.85rem', animation: 'slide-up 0.2s ease-out' }}>
        <button onClick={() => setStep('view')} style={{ alignSelf: 'flex-start', fontSize: '0.65rem', fontWeight: 700, color: 'rgba(255,255,255,0.35)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>← Back to job details</button>

        <div style={{ fontWeight: 800, fontSize: '0.78rem', color: 'rgba(255,255,255,0.6)' }}>Submit your quote — {QUOTE_JOB.ref}</div>

        {/* Auto-filled from job card */}
        <div style={{ borderRadius: '0.75rem', border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden' }}>
          <div style={{ padding: '0.42rem 0.75rem', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: '0.52rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.22)' }}>
            Auto-filled from job card {QUOTE_JOB.ref}
          </div>
          <div style={{ padding: '0.6rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.32rem' }}>
            {[
              ['Client',  'Britannia Group'],
              ['Site',    QUOTE_JOB.site],
              ['Date',    QUOTE_JOB.date],
              ['Scope',   QUOTE_JOB.scope],
            ].map(([lbl, val]) => (
              <div key={lbl} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <span style={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.28)', fontWeight: 600, flexShrink: 0 }}>{lbl}</span>
                <span style={{ fontSize: '0.63rem', fontWeight: 700, color: 'rgba(255,255,255,0.48)', textAlign: 'right' }}>{val}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Quote amount */}
        <div>
          <div style={{ fontSize: '0.55rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.3)', marginBottom: '0.28rem' }}>Your total price (£)</div>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: '0.7rem', top: '50%', transform: 'translateY(-50%)', color: '#fb923c', fontWeight: 900, fontSize: '0.88rem', pointerEvents: 'none' }}>£</span>
            <input style={{ ...inputStyle, paddingLeft: '1.6rem' }} value={amount} onChange={e => setAmount(e.target.value)} type="number" step="0.01" placeholder="e.g. 420.00" />
          </div>
        </div>

        {/* Notes */}
        <div>
          <div style={{ fontSize: '0.55rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.3)', marginBottom: '0.28rem' }}>Notes for Britannia (optional)</div>
          <textarea
            rows={3}
            style={{ ...inputStyle, resize: 'none', lineHeight: 1.5 }}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="e.g. MEWP access included · VAT-exempt · available 07:00 start"
          />
        </div>

        <button
          onClick={() => { if (amount) setStep('submitted'); }}
          disabled={!amount}
          style={{ width: '100%', padding: '0.85rem', borderRadius: '0.75rem', background: amount ? `linear-gradient(135deg, ${ACCENT}, #c2410c)` : 'rgba(255,255,255,0.04)', border: amount ? 'none' : '1px solid rgba(255,255,255,0.08)', color: amount ? 'white' : 'rgba(255,255,255,0.25)', fontWeight: 800, fontSize: '0.8rem', cursor: amount ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.45rem', boxShadow: amount ? '0 4px 16px rgba(234,88,12,0.35)' : 'none', transition: 'all 0.2s' }}>
          <Send size={14} /> Submit quote to Britannia →
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '1.25rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', animation: 'slide-up 0.2s ease-out' }}>

      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.22rem 0.65rem', borderRadius: 999, background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.28)', alignSelf: 'flex-start' }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#a78bfa', boxShadow: '0 0 6px rgba(167,139,250,0.7)', animation: 'check-pulse 2s ease-in-out infinite' }} />
        <span style={{ fontSize: '0.58rem', fontWeight: 800, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Quote Requested · Britannia Group</span>
      </div>

      <div>
        <div style={{ fontWeight: 900, fontSize: '1rem', color: 'white', lineHeight: 1.2 }}>{QUOTE_JOB.task}</div>
        <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.42)', marginTop: '0.2rem' }}>{QUOTE_JOB.site}</div>
      </div>

      {[
        { icon: Building2, value: `Ref #${QUOTE_JOB.ref}`,              sub: 'Job reference' },
        { icon: MapPin,    value: QUOTE_JOB.address,                     sub: 'Site address'  },
        { icon: Clock,     value: `${QUOTE_JOB.date} · ${QUOTE_JOB.time}`, sub: 'Date & time' },
        { icon: FileText,  value: QUOTE_JOB.scope,                       sub: 'Scope of work' },
      ].map(({ icon: Icon, value, sub }) => (
        <div key={sub} style={{ display: 'flex', gap: '0.65rem', alignItems: 'flex-start', padding: '0.58rem 0.75rem', borderRadius: '0.6rem', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <Icon size={13} color="rgba(255,255,255,0.3)" style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'rgba(255,255,255,0.68)' }}>{value}</div>
            <div style={{ fontSize: '0.57rem', color: 'rgba(255,255,255,0.25)', marginTop: 1 }}>{sub}</div>
          </div>
        </div>
      ))}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.62rem 0.82rem', borderRadius: '0.6rem', background: 'rgba(167,139,250,0.07)', border: '1px solid rgba(167,139,250,0.18)' }}>
        <span style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.42)' }}>Job rate</span>
        <span style={{ fontWeight: 900, fontSize: '0.88rem', color: '#a78bfa' }}>Your price — submit quote</span>
      </div>

      <div style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.28)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        <Building2 size={11} style={{ flexShrink: 0 }} />
        FM contact: {QUOTE_JOB.contact}
      </div>

      <button
        onClick={() => setStep('quote')}
        style={{ width: '100%', padding: '0.85rem', borderRadius: '0.75rem', background: `linear-gradient(135deg, ${ACCENT}, #c2410c)`, border: 'none', color: 'white', fontWeight: 800, fontSize: '0.82rem', cursor: 'pointer', boxShadow: '0 4px 16px rgba(234,88,12,0.3)', marginTop: '0.2rem' }}>
        Submit your quote →
      </button>
    </div>
  );
}

// ── Cadi Lite Dashboard ───────────────────────────────────────────────────────
function CadiLiteDashboard() {
  const [activeTab,   setActiveTab]   = useState('dashboard');
  const [activeItemId, setActiveItemId] = useState('dashboard');
  const [expanded,    setExpanded]    = useState({ frontdesk: false, run: false, grow: false, connect: true, account: false });

  function toggleSection(id) { setExpanded(prev => ({ ...prev, [id]: !prev[id] })); }

  function navItem(itemId, viewKey, sectionId) {
    setActiveItemId(itemId);
    setActiveTab(viewKey);
    if (sectionId && !expanded[sectionId]) setExpanded(prev => ({ ...prev, [sectionId]: true }));
  }

  const SIDEBAR_SECTIONS = [
    {
      id: 'frontdesk', tagline: 'FRONT DESK', subLabel: 'Your AI staff', accent: '#4f78ff',
      items: [
        { id: 'fd-inbox',  label: 'Inbox',          icon: Inbox        },
        { id: 'fd-sales',  label: 'Sales Manager',  icon: MessageSquare },
        { id: 'fd-review', label: 'Review Agent',   icon: Star         },
      ], viewKey: 'frontdesk',
    },
    {
      id: 'run', tagline: 'RUN', subLabel: 'Run your business', accent: '#4f78ff',
      items: [
        { id: 'schedule',   label: 'Schedule',     icon: CalendarDays  },
        { id: 'customers',  label: 'Customers',    icon: Users         },
        { id: 'services',   label: 'Services',     icon: ClipboardCheck },
        { id: 'payments',   label: 'Payments',     icon: CreditCard    },
        { id: 'money',      label: 'Money',        icon: PoundSterling },
        { id: 'accounting', label: 'Accounting',   icon: Receipt       },
        { id: 'staff',      label: 'Staff',        icon: GraduationCap },
        { id: 'inventory',  label: 'Inventory',    icon: Package       },
        { id: 'routes',     label: 'Routes',       icon: MapPin        },
      ], viewKey: 'run',
    },
    {
      id: 'grow', tagline: 'GROW', subLabel: 'Grow your margins', accent: '#059669',
      items: [
        { id: 'cadi-ai',  label: 'Cadi AI',        icon: TrendingUp  },
        { id: 'pricing',  label: 'Pricing Calc',   icon: Calculator  },
        { id: 'biz-lab',  label: 'Business Lab',   icon: Briefcase   },
        { id: 'annual',   label: 'Annual Review',  icon: ClipboardList },
      ], viewKey: 'grow',
    },
    {
      id: 'connect', tagline: 'CONNECT', subLabel: 'Connect to more work', accent: '#C2410C', badge: 'BETA',
      items: [
        { id: 'marketplace', label: 'Marketplace', icon: ShoppingBag,  viewKey: 'marketplace' },
        { id: 'jobs',        label: 'My Jobs',     icon: ClipboardList, viewKey: 'jobs'       },
        { id: 'invoicing',   label: 'Invoicing',   icon: FileText,     viewKey: 'invoicing'   },
        { id: 'earnings',    label: 'Earnings',    icon: Zap,          viewKey: 'earnings'    },
        { id: 'profile',     label: 'My Profile',  icon: Star,         viewKey: 'profile'     },
      ],
    },
    {
      id: 'account', tagline: 'ACCOUNT', subLabel: 'Account & settings', accent: '#6b7280',
      items: [
        { id: 'settings', label: 'Settings', icon: Settings },
      ], viewKey: 'account',
    },
  ];

  const ITEM_LABELS = { dashboard: 'Dashboard' };
  SIDEBAR_SECTIONS.forEach(s => s.items.forEach(item => { ITEM_LABELS[item.id] = item.label; }));

  // ── Dashboard ────────────────────────────────────────────────────────────
  function DashView() {
    const score = 91;
    const r = 34, circ = 2 * Math.PI * r, filled = (score / 100) * circ;
    const DIMS = [
      { label: 'Job completion', val: 95 },
      { label: 'Invoice speed',  val: 92 },
      { label: 'Response time',  val: 89 },
      { label: 'Evidence quality', val: 90 },
      { label: 'Client ratings', val: 88 },
    ];
    const LB = [
      { name: 'ProWindow SE',           rank: 1, s: 96 },
      { name: 'Gleam Exterior Ltd',     rank: 2, s: 94 },
      { name: 'D. Harris Window Svcs',  rank: 3, s: 91, me: true },
      { name: 'BrightShine Ltd',        rank: 4, s: 87 },
      { name: 'ClearView Pro',          rank: 5, s: 82 },
    ];
    const ACTIVITY = [
      { icon: '✅', text: 'INV-047 submitted to Britannia Group',        time: '08:12' },
      { icon: '📋', text: 'Job BF-4471 accepted — Premier Inn Luton',    time: '07:50' },
      { icon: '💳', text: 'Payment received · Summit Facilities · £120', time: 'Yesterday' },
      { icon: '⭐', text: 'New 5-star review from Britannia Group',       time: 'Mon' },
    ];
    return (
      <div style={{ padding: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {/* Greeting */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: '0.8rem', color: '#010a4f' }}>Good morning, Dave 👋</div>
            <div style={{ fontSize: '0.53rem', color: '#64748b', marginTop: 1 }}>Wed 27 May 2026 · Week 22</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.18rem 0.5rem', borderRadius: 999, background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.25)' }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#34d399', animation: 'check-pulse 2s ease-in-out infinite' }} />
            <span style={{ fontSize: '0.5rem', fontWeight: 800, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Live</span>
          </div>
        </div>

        {/* Score card */}
        <div style={{ borderRadius: '0.875rem', background: 'linear-gradient(135deg, #010a4f 0%, #0d1e78 100%)', padding: '0.875rem', display: 'flex', gap: '0.875rem', boxShadow: '0 4px 20px rgba(1,10,79,0.3)' }}>
          <div style={{ position: 'relative', width: 80, height: 80, flexShrink: 0 }}>
            <svg width={80} height={80} style={{ transform: 'rotate(-90deg)' }}>
              <circle cx={40} cy={40} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={7} />
              <circle cx={40} cy={40} r={r} fill="none" stroke="#4f78ff" strokeWidth={7}
                strokeDasharray={`${filled} ${circ}`} strokeLinecap="round" />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ fontWeight: 900, fontSize: '1.3rem', color: 'white', lineHeight: 1 }}>{score}</div>
              <div style={{ fontSize: '0.4rem', color: 'rgba(255,255,255,0.4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', textAlign: 'center', lineHeight: 1.3 }}>connect<br/>score</div>
            </div>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.32rem', justifyContent: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.1rem' }}>
              <span style={{ fontSize: '0.55rem', fontWeight: 900, color: 'rgba(255,255,255,0.7)' }}>Score breakdown</span>
              <span style={{ fontSize: '0.48rem', fontWeight: 900, color: '#4f78ff', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Elite ★</span>
            </div>
            {DIMS.map(({ label, val }) => (
              <div key={label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.08rem' }}>
                  <span style={{ fontSize: '0.48rem', color: 'rgba(255,255,255,0.45)', fontWeight: 600 }}>{label}</span>
                  <span style={{ fontSize: '0.48rem', color: 'rgba(255,255,255,0.65)', fontWeight: 800 }}>{val}%</span>
                </div>
                <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.08)' }}>
                  <div style={{ width: `${val}%`, height: '100%', borderRadius: 2, background: 'linear-gradient(90deg, #4f78ff, #34d399)' }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* KPI strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '0.4rem' }}>
          {[
            { label: 'This month', value: '£340',  sub: '4 jobs',     color: '#059669' },
            { label: 'YTD',        value: '£2,840', sub: '34 jobs',    color: '#1f48ff' },
            { label: 'Pending',    value: '£85',    sub: 'INV-047',    color: ACCENT    },
            { label: 'Rating',     value: '4.9★',   sub: '38 reviews', color: '#f59e0b' },
          ].map(({ label, value, sub, color }) => (
            <div key={label} style={{ padding: '0.52rem 0.45rem', borderRadius: '0.65rem', background: 'white', border: '1px solid #e2e8f0', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ fontWeight: 900, fontSize: '0.75rem', color, lineHeight: 1 }}>{value}</div>
              <div style={{ fontSize: '0.46rem', color: '#64748b', marginTop: '0.18rem', fontWeight: 600 }}>{label}</div>
              <div style={{ fontSize: '0.44rem', color: '#94a3b8', marginTop: '0.1rem' }}>{sub}</div>
            </div>
          ))}
        </div>

        {/* Leaderboard */}
        <div style={{ borderRadius: '0.875rem', overflow: 'hidden', border: '1px solid #e2e8f0', background: 'white' }}>
          <div style={{ padding: '0.5rem 0.75rem', background: '#f8faff', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.52rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#010a4f' }}>Exterior leaderboard</span>
            <span style={{ fontSize: '0.48rem', color: '#94a3b8' }}>SE/Mids region</span>
          </div>
          {LB.map(({ name, rank, s, me }) => (
            <div key={rank} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.42rem 0.75rem', borderBottom: rank < 5 ? '1px solid #f1f5f9' : 'none', background: me ? '#f0f4ff' : 'transparent' }}>
              <span style={{ fontSize: '0.55rem', fontWeight: 900, color: rank === 1 ? '#f59e0b' : rank === 2 ? '#94a3b8' : rank === 3 ? '#b45309' : '#cbd5e1', width: 12 }}>{rank}</span>
              <span style={{ flex: 1, fontSize: '0.6rem', fontWeight: me ? 900 : 600, color: me ? '#010a4f' : '#475569' }}>{name}{me ? ' ← you' : ''}</span>
              <div style={{ display: 'flex', gap: '0.28rem', alignItems: 'center' }}>
                <div style={{ width: 38, height: 4, borderRadius: 2, background: '#f1f5f9', overflow: 'hidden' }}>
                  <div style={{ width: `${s}%`, height: '100%', borderRadius: 2, background: me ? '#1f48ff' : '#c7d2fe' }} />
                </div>
                <span style={{ fontSize: '0.58rem', fontWeight: 800, color: me ? '#1f48ff' : '#64748b', width: 20 }}>{s}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Activity feed */}
        <div style={{ borderRadius: '0.875rem', overflow: 'hidden', border: '1px solid #e2e8f0', background: 'white' }}>
          <div style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: '0.52rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#010a4f' }}>Recent activity</span>
          </div>
          {ACTIVITY.map(({ icon, text, time }, i) => (
            <div key={i} style={{ display: 'flex', gap: '0.45rem', padding: '0.4rem 0.75rem', borderBottom: i < 3 ? '1px solid #f1f5f9' : 'none', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '0.7rem', flexShrink: 0 }}>{icon}</span>
              <span style={{ flex: 1, fontSize: '0.56rem', color: '#334155', fontWeight: 600, lineHeight: 1.4 }}>{text}</span>
              <span style={{ fontSize: '0.5rem', color: '#94a3b8', flexShrink: 0 }}>{time}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Marketplace ──────────────────────────────────────────────────────────
  function MarketplaceView() {
    const OFFERS = [
      { ref: 'CF-1882', site: 'Holiday Inn Oxford',       client: 'Summit Facilities',  date: 'Thu 29 May', time: '07:00–09:00', rate: '£110', match: 96 },
      { ref: 'AP-3341', site: 'Tesco Extra Manchester',   client: 'Apex Property Mgmt', date: 'Fri 30 May', time: '06:30–08:30', rate: '£95',  match: 88 },
      { ref: 'BG-2201', site: 'Britannia Hotel Coventry', client: 'Britannia Group',    date: 'Sun 31 May', time: '07:00–10:00', rate: '£135', match: 93 },
    ];
    return (
      <div style={{ padding: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: '0.8rem', color: '#010a4f' }}>Cadi Connect Marketplace</div>
          <div style={{ fontSize: '0.55rem', color: '#64748b', marginTop: 2 }}>Jobs matched to your trade, location and Connect score</div>
        </div>
        {OFFERS.map(({ ref, site, client, date, time, rate, match }) => (
          <div key={ref} style={{ borderRadius: '0.875rem', border: '1px solid #e2e8f0', background: 'white', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
            <div style={{ padding: '0.6rem 0.75rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: '0.68rem', color: '#0f172a' }}>Window cleaning — exterior</div>
                <div style={{ fontSize: '0.55rem', color: '#64748b', marginTop: 2 }}>{site}</div>
                <div style={{ fontSize: '0.5rem', color: '#94a3b8', marginTop: 1 }}>{client} · {ref}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontWeight: 900, fontSize: '0.88rem', color: ACCENT }}>{rate}</div>
                <div style={{ fontSize: '0.5rem', fontWeight: 800, color: '#059669', marginTop: 2 }}>{match}% match</div>
              </div>
            </div>
            <div style={{ padding: '0.42rem 0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.55rem', color: '#64748b' }}>{date} · {time}</span>
              <div style={{ display: 'flex', gap: '0.3rem' }}>
                <button style={{ fontSize: '0.56rem', fontWeight: 800, padding: '0.22rem 0.6rem', borderRadius: '0.4rem', background: ACCENT, color: 'white', border: 'none', cursor: 'pointer' }}>Accept</button>
                <button style={{ fontSize: '0.56rem', padding: '0.22rem 0.45rem', borderRadius: '0.4rem', background: '#f1f5f9', color: '#64748b', border: 'none', cursor: 'pointer' }}>Decline</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ── My Jobs ──────────────────────────────────────────────────────────────
  function JobsView() {
    const JOBS = [
      { ref: 'BF-4471', site: 'Premier Inn Luton Airport', client: 'Britannia Group',    date: 'Today · Sat 23 May', time: '06:00–08:00', rate: '£85',  status: 'active'   },
      { ref: 'CF-1882', site: 'Holiday Inn Oxford',        client: 'Summit Facilities',  date: 'Thu 29 May',         time: '07:00–09:00', rate: '£110', status: 'upcoming' },
      { ref: 'AP-3341', site: 'Tesco Extra Manchester',    client: 'Apex Property Mgmt', date: 'Fri 30 May',         time: '06:30–08:30', rate: '£95',  status: 'upcoming' },
    ];
    return (
      <div style={{ padding: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
        <div style={{ fontWeight: 900, fontSize: '0.8rem', color: '#010a4f' }}>My Jobs</div>
        {JOBS.map(({ ref, site, client, date, time, rate, status }) => (
          <div key={ref} style={{ borderRadius: '0.875rem', border: `1px solid ${status === 'active' ? '#fed7aa' : '#e2e8f0'}`, background: status === 'active' ? '#fff7ed' : 'white', padding: '0.65rem 0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.3rem' }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: '0.68rem', color: '#0f172a' }}>Window cleaning — exterior</div>
                <div style={{ fontSize: '0.55rem', color: '#64748b', marginTop: 2 }}>{site}</div>
              </div>
              <span style={{ fontWeight: 900, fontSize: '0.82rem', color: ACCENT, flexShrink: 0 }}>{rate}</span>
            </div>
            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: '0.5rem', padding: '0.1rem 0.42rem', borderRadius: 999, background: status === 'active' ? '#fff7ed' : '#f1f5f9', border: `1px solid ${status === 'active' ? '#fed7aa' : '#e2e8f0'}`, color: status === 'active' ? ACCENT : '#64748b', fontWeight: 700 }}>{status === 'active' ? '● In Progress' : '○ Upcoming'}</span>
              <span style={{ fontSize: '0.5rem', color: '#94a3b8' }}>{client} · {ref} · {date} · {time}</span>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ── Invoicing ────────────────────────────────────────────────────────────
  function InvoicingView() {
    const INVS = [
      { no: 'INV-047', client: 'Britannia Group',    amount: '£85.00',  status: 'pending', date: '24 May', ref: 'BF-4471' },
      { no: 'INV-046', client: 'Summit Facilities',  amount: '£120.00', status: 'paid',    date: '18 May', ref: 'CF-1801' },
      { no: 'INV-045', client: 'Apex Property Mgmt', amount: '£200.00', status: 'paid',    date: '11 May', ref: 'AP-3298' },
      { no: 'INV-044', client: 'Britannia Group',    amount: '£85.00',  status: 'paid',    date: '3 May',  ref: 'BF-4391' },
    ];
    return (
      <div style={{ padding: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 900, fontSize: '0.8rem', color: '#010a4f' }}>Invoicing</div>
          <button style={{ fontSize: '0.56rem', fontWeight: 800, padding: '0.25rem 0.65rem', borderRadius: '0.45rem', background: ACCENT, color: 'white', border: 'none', cursor: 'pointer' }}>+ New invoice</button>
        </div>
        <div style={{ borderRadius: '0.875rem', overflow: 'hidden', border: '1px solid #e2e8f0', background: 'white' }}>
          {INVS.map(({ no, client, amount, status, date, ref }, i) => (
            <div key={no} style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', padding: '0.55rem 0.75rem', borderBottom: i < 3 ? '1px solid #f1f5f9' : 'none' }}>
              <div style={{ width: 26, height: 26, borderRadius: '0.45rem', background: status === 'paid' ? 'rgba(52,211,153,0.1)' : 'rgba(234,88,12,0.1)', border: `1px solid ${status === 'paid' ? 'rgba(52,211,153,0.25)' : 'rgba(234,88,12,0.25)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '0.65rem' }}>
                {status === 'paid' ? '✓' : '⏳'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.6rem', fontWeight: 700, color: '#0f172a' }}>{no} · {client}</div>
                <div style={{ fontSize: '0.5rem', color: '#94a3b8', marginTop: 1 }}>Job {ref} · {date}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 900, fontSize: '0.68rem', color: status === 'paid' ? '#059669' : ACCENT }}>{amount}</div>
                <div style={{ fontSize: '0.48rem', fontWeight: 700, color: status === 'paid' ? '#059669' : '#f59e0b', textTransform: 'uppercase', marginTop: 1 }}>{status}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Earnings ─────────────────────────────────────────────────────────────
  function EarningsView() {
    const MONTHS = [
      { m: 'Jan', v: 240 }, { m: 'Feb', v: 195 }, { m: 'Mar', v: 310 },
      { m: 'Apr', v: 280 }, { m: 'May', v: 340 }, { m: 'Jun', v: 0   },
    ];
    const max = 400;
    return (
      <div style={{ padding: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
        <div style={{ fontWeight: 900, fontSize: '0.8rem', color: '#010a4f' }}>Earnings</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
          {[
            { label: 'This month',  value: '£340',   sub: '4 jobs',        color: '#059669' },
            { label: 'Year to date',value: '£2,840', sub: '34 jobs',       color: '#1f48ff' },
            { label: 'Avg per job', value: '£83.50', sub: 'all time',      color: '#64748b' },
            { label: 'Top client',  value: 'Summit', sub: '£840 · 8 jobs', color: ACCENT    },
          ].map(({ label, value, sub, color }) => (
            <div key={label} style={{ padding: '0.6rem 0.65rem', borderRadius: '0.65rem', background: 'white', border: '1px solid #e2e8f0' }}>
              <div style={{ fontWeight: 900, fontSize: '0.88rem', color, lineHeight: 1 }}>{value}</div>
              <div style={{ fontSize: '0.5rem', color: '#64748b', marginTop: '0.18rem', fontWeight: 600 }}>{label}</div>
              <div style={{ fontSize: '0.47rem', color: '#94a3b8', marginTop: '0.1rem' }}>{sub}</div>
            </div>
          ))}
        </div>
        <div style={{ borderRadius: '0.875rem', border: '1px solid #e2e8f0', background: 'white', padding: '0.75rem' }}>
          <div style={{ fontSize: '0.5rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748b', marginBottom: '0.6rem' }}>Monthly earnings 2026</div>
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'flex-end', height: 64 }}>
            {MONTHS.map(({ m, v }) => (
              <div key={m} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.22rem' }}>
                <div style={{ width: '100%', borderRadius: '0.22rem 0.22rem 0 0', background: v > 0 ? (m === 'May' ? ACCENT : '#c7d2fe') : 'transparent', height: `${(v / max) * 52}px` }} />
                <span style={{ fontSize: '0.46rem', color: '#94a3b8', fontWeight: 600 }}>{m}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ borderRadius: '0.875rem', border: '1px solid #e2e8f0', background: 'white', padding: '0.75rem' }}>
          <div style={{ fontSize: '0.5rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748b', marginBottom: '0.5rem' }}>Income by FM client (YTD)</div>
          {[
            { name: 'Summit Facilities',  amount: '£840', pct: 30 },
            { name: 'Apex Property Mgmt', amount: '£720', pct: 25 },
            { name: 'Britannia Group',    amount: '£595', pct: 21 },
            { name: 'Others',             amount: '£685', pct: 24 },
          ].map(({ name, amount, pct }) => (
            <div key={name} style={{ marginBottom: '0.38rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.12rem' }}>
                <span style={{ fontSize: '0.56rem', color: '#475569', fontWeight: 600 }}>{name}</span>
                <span style={{ fontSize: '0.56rem', color: '#0f172a', fontWeight: 800 }}>{amount}</span>
              </div>
              <div style={{ height: 4, borderRadius: 2, background: '#f1f5f9' }}>
                <div style={{ width: `${pct}%`, height: '100%', borderRadius: 2, background: '#c7d2fe' }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── My Profile ───────────────────────────────────────────────────────────
  function ProfileView() {
    return (
      <div style={{ padding: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
        <div style={{ fontWeight: 900, fontSize: '0.8rem', color: '#010a4f' }}>My Connect Profile</div>
        <div style={{ borderRadius: '0.875rem', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
          <div style={{ background: 'linear-gradient(135deg, #010a4f, #0d1e78)', padding: '0.875rem', display: 'flex', gap: '0.65rem', alignItems: 'center' }}>
            <div style={{ width: 40, height: 40, borderRadius: '0.65rem', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '1rem', color: 'white', flexShrink: 0 }}>D</div>
            <div>
              <div style={{ fontWeight: 900, fontSize: '0.78rem', color: 'white' }}>D. Harris Window Services</div>
              <div style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>Window Cleaning · Exterior · Luton & Surrounding</div>
              <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.3rem' }}>
                <span style={{ fontSize: '0.48rem', fontWeight: 900, padding: '0.1rem 0.42rem', borderRadius: 999, background: 'rgba(79,120,255,0.25)', color: '#99c5ff' }}>Elite ★</span>
                <span style={{ fontSize: '0.48rem', fontWeight: 800, padding: '0.1rem 0.42rem', borderRadius: 999, background: 'rgba(52,211,153,0.15)', color: '#34d399' }}>Score 91</span>
              </div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', background: 'white' }}>
            {[
              { label: 'FM companies',  value: '12' },
              { label: 'Jobs this year', value: '34' },
              { label: 'Coverage',      value: 'Luton +30mi' },
              { label: 'Avg response',  value: '< 8 min' },
            ].map(({ label, value }, i) => (
              <div key={label} style={{ padding: '0.55rem 0.75rem', borderRight: i % 2 === 0 ? '1px solid #f1f5f9' : 'none', borderBottom: i < 2 ? '1px solid #f1f5f9' : 'none' }}>
                <div style={{ fontWeight: 800, fontSize: '0.72rem', color: '#0f172a' }}>{value}</div>
                <div style={{ fontSize: '0.5rem', color: '#94a3b8', marginTop: 1 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ borderRadius: '0.875rem', border: '1px solid #e2e8f0', background: 'white', padding: '0.75rem' }}>
          <div style={{ fontSize: '0.5rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748b', marginBottom: '0.5rem' }}>Recent reviews</div>
          {[
            { client: 'Britannia Group',   stars: 5, text: 'Excellent work as always. Arrived early, thorough finish.', date: 'Mon 25 May' },
            { client: 'Summit Facilities', stars: 5, text: 'Always reliable. Would highly recommend to other FMs.',      date: 'Wed 20 May' },
          ].map(({ client, stars, text, date }) => (
            <div key={client} style={{ marginBottom: '0.55rem', paddingBottom: '0.55rem', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.18rem' }}>
                <span style={{ fontSize: '0.58rem', fontWeight: 800, color: '#0f172a' }}>{client}</span>
                <span style={{ fontSize: '0.62rem', color: '#f59e0b' }}>{'★'.repeat(stars)}</span>
              </div>
              <div style={{ fontSize: '0.55rem', color: '#475569', lineHeight: 1.45 }}>{text}</div>
              <div style={{ fontSize: '0.48rem', color: '#94a3b8', marginTop: '0.18rem' }}>{date}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Front Desk ───────────────────────────────────────────────────────────
  function FrontDeskView() {
    const AGENTS = [
      { name: 'Sales Manager',       role: 'Handles inbound enquiries, quotes & bookings',   color: '#3b5bdb', icon: '📩', actions: 3,    pro: false },
      { name: 'Review Agent',        role: 'Sends review requests after every completed job', color: '#059669', icon: '⭐', actions: 1,    pro: false },
      { name: 'Operations Manager',  role: 'Reminders, schedules, check-ins, payment match', color: '#C2410C', icon: '⚙️', actions: 0,    pro: true  },
    ];
    return (
      <div style={{ padding: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: '0.8rem', color: '#010a4f' }}>Front Desk</div>
          <div style={{ fontSize: '0.55rem', color: '#64748b', marginTop: 2 }}>Your AI staff — working for you 24/7</div>
        </div>
        {AGENTS.map(({ name, role, color, icon, actions, pro }) => (
          <div key={name} style={{ borderRadius: '0.875rem', border: `1px solid ${pro ? '#e2e8f0' : color + '33'}`, background: pro ? '#fafafa' : 'white', padding: '0.65rem 0.75rem', opacity: pro ? 0.7 : 1 }}>
            <div style={{ display: 'flex', gap: '0.55rem', alignItems: 'flex-start' }}>
              <div style={{ width: 30, height: 30, borderRadius: '0.55rem', background: color + '18', border: `1px solid ${color}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', flexShrink: 0 }}>{icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                  <span style={{ fontWeight: 800, fontSize: '0.65rem', color: '#0f172a' }}>{name}</span>
                  {pro
                    ? <span style={{ fontSize: '0.45rem', fontWeight: 900, padding: '0.1rem 0.4rem', borderRadius: 999, background: 'rgba(79,120,255,0.1)', color: '#4f78ff' }}>PRO</span>
                    : actions > 0 && <span style={{ fontSize: '0.45rem', fontWeight: 900, padding: '0.1rem 0.4rem', borderRadius: 999, background: '#fef3c7', color: '#92400e' }}>{actions} pending</span>
                  }
                </div>
                <div style={{ fontSize: '0.54rem', color: '#64748b', lineHeight: 1.45 }}>{role}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ── Run ──────────────────────────────────────────────────────────────────
  function RunView() {
    const SCHEDULE = [
      { time: '07:00', job: 'Window Clean — Britannia Luton',   done: true,  rate: '£85'  },
      { time: '10:00', job: 'Gutter Clear — Summit Hotel Oxford', done: false, rate: '£110' },
      { time: '13:00', job: 'Fascia Wash — Apex Manchester',    done: false, rate: '£95'  },
    ];
    const FEATURES = [
      { label: 'Schedule',   sub: 'Book & manage every job', icon: '📅' },
      { label: 'Customers',  sub: 'Client database & history', icon: '👥' },
      { label: 'Payments',   sub: 'Invoices & GoCardless',    icon: '💳' },
      { label: 'Money',      sub: 'P&L and tax reserve',      icon: '💷' },
      { label: 'Accounting', sub: 'MTD & year-end figures',   icon: '📊' },
      { label: 'Staff',      sub: 'Team management',          icon: '👷' },
    ];
    return (
      <div style={{ padding: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: '0.8rem', color: '#010a4f' }}>Run your business</div>
          <div style={{ fontSize: '0.55rem', color: '#64748b', marginTop: 2 }}>Schedule, customers, payments, staff and more</div>
        </div>
        <div style={{ borderRadius: '0.875rem', overflow: 'hidden', border: '1px solid #e2e8f0', background: 'white' }}>
          <div style={{ padding: '0.45rem 0.75rem', background: '#f8faff', borderBottom: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: '0.52rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#010a4f' }}>Today's Schedule</span>
          </div>
          {SCHEDULE.map(({ time, job, done, rate }, i) => (
            <div key={i} style={{ display: 'flex', gap: '0.5rem', padding: '0.42rem 0.75rem', borderBottom: i < 2 ? '1px solid #f1f5f9' : 'none', alignItems: 'center' }}>
              <span style={{ fontSize: '0.52rem', color: '#94a3b8', fontWeight: 600, flexShrink: 0, width: 30 }}>{time}</span>
              <span style={{ flex: 1, fontSize: '0.57rem', color: done ? '#94a3b8' : '#334155', fontWeight: 600, textDecoration: done ? 'line-through' : 'none' }}>{job}</span>
              <span style={{ fontSize: '0.6rem', fontWeight: 800, color: done ? '#059669' : '#1f48ff', flexShrink: 0 }}>{rate}</span>
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
          {FEATURES.map(({ label, sub, icon }) => (
            <div key={label} style={{ padding: '0.52rem 0.55rem', borderRadius: '0.65rem', background: 'white', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.75rem', marginBottom: '0.18rem' }}>{icon}</div>
              <div style={{ fontWeight: 800, fontSize: '0.6rem', color: '#0f172a' }}>{label}</div>
              <div style={{ fontSize: '0.47rem', color: '#94a3b8', marginTop: '0.08rem' }}>{sub}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Grow ─────────────────────────────────────────────────────────────────
  function GrowView() {
    const FEATURES = [
      { label: 'Cadi AI',          sub: 'AI growth strategies',    icon: '🤖' },
      { label: 'Pricing Calc',     sub: 'UK market rate data',     icon: '🧮' },
      { label: 'Business Lab',     sub: 'Tools & experiments',     icon: '🔬' },
      { label: 'Annual Review',    sub: '90-day sprint goals',     icon: '📈' },
    ];
    return (
      <div style={{ padding: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: '0.8rem', color: '#010a4f' }}>Grow your margins</div>
          <div style={{ fontSize: '0.55rem', color: '#64748b', marginTop: 2 }}>AI-powered tools to grow your cleaning business</div>
        </div>
        <div style={{ borderRadius: '0.875rem', background: 'linear-gradient(135deg, #010a4f 0%, #0d1e78 100%)', padding: '0.875rem', boxShadow: '0 4px 20px rgba(1,10,79,0.3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.35rem' }}>
            <span style={{ fontSize: '0.9rem' }}>🤖</span>
            <span style={{ fontWeight: 900, fontSize: '0.72rem', color: 'white' }}>Cadi AI</span>
          </div>
          <div style={{ fontSize: '0.56rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.55, marginBottom: '0.55rem' }}>Growth strategies, pricing analysis and AI insights tailored to your trade and location</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.28rem' }}>
            {['Pricing audit', 'Growth plan', 'Market rates', 'Win more work'].map(tag => (
              <span key={tag} style={{ fontSize: '0.46rem', fontWeight: 800, padding: '0.1rem 0.4rem', borderRadius: 999, background: 'rgba(79,120,255,0.2)', color: '#99c5ff' }}>{tag}</span>
            ))}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
          {FEATURES.map(({ label, sub, icon }) => (
            <div key={label} style={{ padding: '0.52rem 0.55rem', borderRadius: '0.65rem', background: 'white', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.75rem', marginBottom: '0.18rem' }}>{icon}</div>
              <div style={{ fontWeight: 800, fontSize: '0.6rem', color: '#0f172a' }}>{label}</div>
              <div style={{ fontSize: '0.47rem', color: '#94a3b8', marginTop: '0.08rem' }}>{sub}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Account ───────────────────────────────────────────────────────────────
  function AccountView() {
    return (
      <div style={{ padding: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
        <div style={{ fontWeight: 900, fontSize: '0.8rem', color: '#010a4f' }}>Account Settings</div>
        <div style={{ borderRadius: '0.875rem', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
          <div style={{ background: 'linear-gradient(135deg, #010a4f, #0d1e78)', padding: '0.75rem', display: 'flex', gap: '0.55rem', alignItems: 'center' }}>
            <div style={{ width: 32, height: 32, borderRadius: '0.55rem', background: '#1f48ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '0.8rem', color: 'white', flexShrink: 0 }}>D</div>
            <div>
              <div style={{ fontWeight: 900, fontSize: '0.68rem', color: 'white' }}>Dave Harris</div>
              <div style={{ fontSize: '0.5rem', color: 'rgba(255,255,255,0.5)', marginTop: 1 }}>D. Harris Window Services</div>
            </div>
          </div>
          {[
            { label: 'Email',    value: 'dave@harriswc.co.uk'   },
            { label: 'Phone',    value: '+44 7700 900123'        },
            { label: 'Plan',     value: 'Cadi Lite · Free'       },
            { label: 'Location', value: 'Luton, Bedfordshire'    },
          ].map(({ label, value }, i) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.45rem 0.75rem', borderBottom: i < 3 ? '1px solid #f1f5f9' : 'none', background: 'white' }}>
              <span style={{ fontSize: '0.55rem', color: '#94a3b8', fontWeight: 600 }}>{label}</span>
              <span style={{ fontSize: '0.58rem', color: '#0f172a', fontWeight: 700 }}>{value}</span>
            </div>
          ))}
        </div>
        <div style={{ borderRadius: '0.875rem', background: 'linear-gradient(135deg, #010a4f, #0d1e78)', padding: '0.875rem', textAlign: 'center', boxShadow: '0 4px 20px rgba(1,10,79,0.3)' }}>
          <div style={{ fontWeight: 900, fontSize: '0.75rem', color: 'white', marginBottom: '0.22rem' }}>Upgrade to Cadi Pro</div>
          <div style={{ fontSize: '0.54rem', color: 'rgba(255,255,255,0.5)', marginBottom: '0.6rem', lineHeight: 1.55 }}>Unlock Run + Grow + Front Desk — the full Business OS for cleaners</div>
          <button style={{ padding: '0.32rem 0.9rem', borderRadius: '0.55rem', background: '#1f48ff', color: 'white', border: 'none', fontSize: '0.62rem', fontWeight: 900, cursor: 'pointer' }}>£29/mo — Upgrade now</button>
        </div>
      </div>
    );
  }

  const VIEW = { dashboard: DashView, marketplace: MarketplaceView, jobs: JobsView, invoicing: InvoicingView, earnings: EarningsView, profile: ProfileView, frontdesk: FrontDeskView, run: RunView, grow: GrowView, account: AccountView };
  const ActiveView = VIEW[activeTab] || DashView;

  return (
    <div style={{ display: 'flex', borderRadius: '2rem', overflow: 'hidden', boxShadow: '0 40px 120px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.06)', minHeight: 660, animation: 'slide-up 0.35s ease-out' }}>

      {/* ── Sidebar ─────────────────────────────────────── */}
      <div style={{ width: 160, background: '#010a4f', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>

        {/* Brand */}
        <div style={{ padding: '0.875rem 0.875rem 0.6rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ fontWeight: 900, fontSize: '1.1rem', color: 'white', letterSpacing: '-0.03em', lineHeight: 1 }}>cadi</div>
          <div style={{ fontSize: '0.44rem', color: 'rgba(153,197,255,0.55)', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Business OS · Lite</div>
        </div>

        <nav style={{ flex: 1, padding: '0.55rem 0.45rem', overflowY: 'auto' }}>
          {/* Dashboard */}
          <button
            onClick={() => { setActiveTab('dashboard'); setActiveItemId('dashboard'); }}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.42rem', padding: '0.48rem 0.55rem', borderRadius: '0.6rem', background: activeTab === 'dashboard' ? '#1f48ff' : 'transparent', border: 'none', cursor: 'pointer', marginBottom: '0.3rem' }}>
            <LayoutDashboard size={12} color={activeTab === 'dashboard' ? 'white' : 'rgba(153,197,255,0.65)'} />
            <span style={{ fontSize: '0.62rem', fontWeight: activeTab === 'dashboard' ? 800 : 500, color: activeTab === 'dashboard' ? 'white' : 'rgba(153,197,255,0.65)' }}>Dashboard</span>
          </button>

          <div style={{ height: 1, background: 'rgba(255,255,255,0.1)', margin: '0.1rem 0 0.3rem' }} />

          {SIDEBAR_SECTIONS.map(({ id: secId, tagline, subLabel, accent, badge, items, viewKey: sectionViewKey }) => (
            <div key={secId} style={{ marginBottom: '0.18rem' }}>
              <button
                onClick={() => toggleSection(secId)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.3rem 0.45rem', borderRadius: '0.5rem', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                <span style={{ width: 3, height: 14, borderRadius: 2, background: accent, flexShrink: 0 }} />
                <span style={{ flex: 1, textAlign: 'left' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <span style={{ fontSize: '0.42rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: accent }}>{tagline}</span>
                    {badge && <span style={{ fontSize: '0.37rem', fontWeight: 900, padding: '0.05rem 0.28rem', borderRadius: 999, background: `${accent}33`, color: accent }}>{badge}</span>}
                  </span>
                  <span style={{ display: 'block', fontSize: '0.43rem', color: 'rgba(153,197,255,0.38)', lineHeight: 1.2 }}>{subLabel}</span>
                </span>
                <ChevronRight size={8} color="rgba(153,197,255,0.3)" style={{ transform: expanded[secId] ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s', flexShrink: 0 }} />
              </button>

              {expanded[secId] && (
                <div style={{ paddingLeft: '0.35rem', marginTop: '0.1rem' }}>
                  {items.map(({ id: itemId, label, icon: Icon, viewKey: itemViewKey }) => {
                    const resolvedView = itemViewKey || sectionViewKey;
                    const isActive = activeItemId === itemId;
                    const isConnect = secId === 'connect';
                    return (
                      <button
                        key={itemId}
                        onClick={() => navItem(itemId, resolvedView, secId)}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.38rem', padding: '0.36rem 0.48rem', borderRadius: '0.5rem', background: isActive ? (isConnect ? 'rgba(194,65,12,0.18)' : 'rgba(255,255,255,0.07)') : 'transparent', border: isActive ? `1px solid ${isConnect ? 'rgba(194,65,12,0.28)' : 'rgba(255,255,255,0.12)'}` : '1px solid transparent', cursor: 'pointer', marginBottom: '0.08rem' }}>
                        <Icon size={11} color={isActive ? (isConnect ? '#fb923c' : 'rgba(153,197,255,0.9)') : 'rgba(153,197,255,0.42)'} />
                        <span style={{ fontSize: '0.57rem', fontWeight: isActive ? 800 : 500, color: isActive ? (isConnect ? '#fb923c' : 'rgba(153,197,255,0.9)') : 'rgba(153,197,255,0.42)' }}>{label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </nav>

        {/* User footer */}
        <div style={{ padding: '0.55rem 0.6rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.38rem', padding: '0.42rem 0.45rem', borderRadius: '0.55rem', background: 'rgba(255,255,255,0.05)' }}>
            <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#1f48ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.55rem', fontWeight: 900, color: 'white', flexShrink: 0 }}>D</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.53rem', fontWeight: 800, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Dave Harris</div>
              <div style={{ fontSize: '0.44rem', color: 'rgba(153,197,255,0.45)' }}>Cadi Lite · Free</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Content area ─────────────────────────────────── */}
      <div style={{ flex: 1, background: '#f0f4ff', overflowY: 'auto', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {/* Topbar */}
        <div style={{ position: 'sticky', top: 0, zIndex: 10, background: 'rgba(240,244,255,0.96)', backdropFilter: 'blur(8px)', borderBottom: '1px solid rgba(153,197,255,0.28)', padding: '0.55rem 0.875rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <span style={{ fontWeight: 900, fontSize: '0.68rem', color: '#010a4f' }}>{ITEM_LABELS[activeItemId] || 'Dashboard'}</span>
          <span style={{ fontSize: '0.5rem', fontWeight: 800, padding: '0.14rem 0.5rem', borderRadius: 999, background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.28)', color: '#059669' }}>Free forever</span>
        </div>
        <ActiveView />
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function OperativePortalDemo() {
  const [showWelcome,  setShowWelcome]  = useState(true);
  const [activated,    setActivated]    = useState(false);
  const [activating,   setActivating]   = useState(false);
  const [tab,          setTab]          = useState('notify');
  const [journeyMode,  setJourneyMode]  = useState('rate-set'); // 'rate-set' | 'quote-request'
  const [accepted,     setAccepted]     = useState(false);
  const [declined,     setDeclined]     = useState(false);
  const [jobDone,      setJobDone]      = useState(false);
  const [evidenceDone, setEvidenceDone] = useState(false);

  function handleAccept() { setAccepted(true); setTimeout(() => setTab('job'), 350); }
  function handleDecline() { setDeclined(true); }

  function handleActivate() {
    setActivating(true);
    setTimeout(() => { setActivating(false); setActivated(true); setShowWelcome(false); }, 800);
  }

  function switchJourney(newMode) {
    setJourneyMode(newMode);
    setTab(newMode === 'quote-request' ? 'quote-job' : 'notify');
    setAccepted(false);
    setDeclined(false);
    setJobDone(false);
    setEvidenceDone(false);
  }

  const JOURNEY = journeyMode === 'quote-request'
    ? [{ id: 'quote-job', label: 'Quote Job', done: false }]
    : [
        { id: 'notify',   label: 'New Job',  done: accepted     },
        { id: 'job',      label: 'Job Card', done: jobDone      },
        { id: 'evidence', label: 'Evidence', done: evidenceDone },
        { id: 'invoice',  label: 'Invoice',  done: false        },
      ];

  const phoneCard = (
    <div style={{ width: '100%', borderRadius: '2rem', overflow: 'hidden', boxShadow: '0 40px 120px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.06)', background: '#0f0c09' }}>

      {/* Banner */}
      <div style={{ background: 'rgba(234,88,12,0.1)', borderBottom: '1px solid rgba(234,88,12,0.18)', padding: '0.45rem 1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Zap size={9} color="#fb923c" />
          <span style={{ fontSize: '0.57rem', fontWeight: 800, color: '#fb923c', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
            Cadi Connect · Britannia Group jobs
          </span>
        </div>
        {!showWelcome && !activating && (
          <div style={{ display: 'flex', gap: '0.3rem' }}>
            {[
              { id: 'rate-set',      label: 'Rate set' },
              { id: 'quote-request', label: 'Quote job' },
            ].map(opt => (
              <button
                key={opt.id}
                onClick={() => switchJourney(opt.id)}
                style={{ padding: '0.15rem 0.55rem', borderRadius: 999, fontSize: '0.48rem', fontWeight: 900, border: '1px solid', cursor: 'pointer', transition: 'all 0.15s',
                  background: journeyMode === opt.id ? ACCENT_DIM : 'transparent',
                  borderColor: journeyMode === opt.id ? ACCENT_BORDER : 'rgba(255,255,255,0.12)',
                  color: journeyMode === opt.id ? '#fb923c' : 'rgba(255,255,255,0.35)',
                }}>
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Header */}
      <div style={{ padding: '0.875rem 1.1rem 0.6rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: '0.88rem', color: 'white', lineHeight: 1 }}>Dave Harris</div>
            <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.32)', marginTop: 2 }}>Contractor · Connect score 91</div>
          </div>
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <div style={{ fontSize: '0.57rem', fontWeight: 800, padding: '0.18rem 0.55rem', borderRadius: 999, background: 'rgba(194,65,12,0.15)', border: '1px solid rgba(194,65,12,0.3)', color: '#fb923c', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Demo</div>
          </div>
        </div>
      </div>

      {/* Journey bar */}
      {!showWelcome && !activating && (
        <div style={{ display: 'flex', alignItems: 'center', padding: '0.55rem 1.1rem', borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.01)' }}>
          {JOURNEY.map((s, i) => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', flex: i < JOURNEY.length - 1 ? 1 : 'none' }}>
              <button
                onClick={() => (s.done || tab === s.id || (s.id === 'job' && accepted) || (s.id === 'evidence' && jobDone) || (s.id === 'invoice' && evidenceDone)) && setTab(s.id)}
                style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.18rem 0.35rem', borderRadius: '0.4rem', background: tab === s.id ? ACCENT_DIM : 'transparent', border: 'none', cursor: 'pointer' }}>
                <div style={{ width: 16, height: 16, borderRadius: '50%', flexShrink: 0, background: s.done ? 'rgba(52,211,153,0.15)' : tab === s.id ? ACCENT_DIM : 'rgba(255,255,255,0.06)', border: s.done ? '1px solid rgba(52,211,153,0.4)' : tab === s.id ? `1px solid ${ACCENT_BORDER}` : '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.5rem', fontWeight: 900, color: s.done ? '#34d399' : tab === s.id ? '#fb923c' : 'rgba(255,255,255,0.25)' }}>
                  {s.done ? '✓' : i + 1}
                </div>
                <span style={{ fontSize: '0.6rem', fontWeight: 700, color: tab === s.id ? '#fb923c' : s.done ? '#34d399' : 'rgba(255,255,255,0.28)', whiteSpace: 'nowrap' }}>{s.label}</span>
              </button>
              {i < JOURNEY.length - 1 && <div style={{ flex: 1, height: 1, background: s.done ? 'rgba(52,211,153,0.2)' : 'rgba(255,255,255,0.06)', margin: '0 0.2rem' }} />}
            </div>
          ))}
        </div>
      )}

      {/* Content */}
      <div style={{ minHeight: 520 }}>
        {activating && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.85rem', padding: '3rem 2rem', minHeight: 400, animation: 'slide-up 0.2s ease-out' }}>
            <div style={{ width: 14, height: 14, border: `2px solid ${ACCENT_BORDER}`, borderTopColor: ACCENT, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>Setting up your Cadi Lite account…</div>
            <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.28)' }}>This only takes a second</div>
          </div>
        )}
        {!activating && showWelcome && (
          <WelcomeTab onStart={() => setShowWelcome(false)} onActivate={handleActivate} />
        )}
        {!activating && !showWelcome && tab === 'notify' && (
          <NewJobTab onAccept={handleAccept} onDecline={handleDecline} declined={declined} />
        )}
        {!activating && !showWelcome && tab === 'job' && (
          <JobCardTab done={jobDone} onDone={() => { setJobDone(true); setTimeout(() => setTab('evidence'), 400); }} />
        )}
        {!activating && !showWelcome && tab === 'evidence' && (
          <EvidenceTab done={evidenceDone} onDone={() => { setEvidenceDone(true); setTimeout(() => setTab('invoice'), 400); }} />
        )}
        {!activating && !showWelcome && tab === 'invoice' && <InvoiceTab />}
        {!activating && !showWelcome && tab === 'quote-job' && <QuoteJobTab />}
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#070506', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', padding: activated ? '2rem 1.5rem 5rem' : '2.5rem 1rem 5rem', fontFamily: "'Satoshi','Inter',sans-serif" }}>
      <style>{KEYFRAMES}</style>

      {/* Page-level back button */}
      <a
        href="/demo"
        style={{ position: 'fixed', top: '1rem', left: '1rem', zIndex: 50, fontSize: '0.65rem', fontWeight: 700, color: 'rgba(255,255,255,0.5)', textDecoration: 'none', padding: '0.38rem 0.75rem', borderRadius: '0.55rem', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)', transition: 'color 0.15s' }}
        onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.9)'}
        onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.5)'}
      >← Demo home</a>

      {/* Context banner */}
      <div style={{ width: '100%', maxWidth: 480, marginBottom: '1.5rem', borderRadius: '0.875rem', overflow: 'hidden', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)' }}>
        <div style={{ padding: '0.875rem 1.1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', marginBottom: '0.3rem' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 900, color: '#a5b4fc', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Contractor Portal · Exterior Works</span>
          </div>
          <p style={{ margin: 0, fontSize: '0.72rem', color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>
            This is what <strong style={{ color: 'rgba(255,255,255,0.7)' }}>Dave Harris Window Services</strong> sees on their phone when Britannia sends them an exterior job. Employed staff use the <a href="/staff-demo" style={{ color: '#a5b4fc', textDecoration: 'none', fontWeight: 700 }}>Staff App instead →</a>
          </p>
        </div>
      </div>

      {activated ? (
        <div style={{ width: '100%', maxWidth: 920, display: 'flex', gap: '1.5rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {/* Left: Cadi Lite account */}
          <div style={{ flex: '1 1 380px', minWidth: 0 }}>
            <div style={{ fontSize: '0.58rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.28)', marginBottom: '0.6rem', paddingLeft: '0.25rem' }}>
              ← What Dave gets for free
            </div>
            <CadiLiteDashboard />
          </div>
          {/* Right: Britannia job workflow */}
          <div style={{ flex: '0 0 380px' }}>
            <div style={{ fontSize: '0.58rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.28)', marginBottom: '0.6rem', paddingLeft: '0.25rem' }}>
              Britannia job flow →
            </div>
            {phoneCard}
          </div>
        </div>
      ) : (
        <div style={{ width: '100%', maxWidth: 400 }}>
          {phoneCard}
        </div>
      )}
    </div>
  );
}
