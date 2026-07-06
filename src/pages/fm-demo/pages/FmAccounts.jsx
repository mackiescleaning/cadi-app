import { useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronUp, Mail, MapPin } from 'lucide-react';

const card = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
};

const INVOICES = [
  {
    id: 'INV-0043',
    from: 'W. Draper & Sons',
    site: 'Magnet, Gaogate Place, Stafford',
    client: 'Britannia Group',
    amountNet: 20.0,
    amountVat: 0,
    amountTotal: 20.0,
    vatRegistered: false,
    received: 'Just now',
    po: 'BF-2026-0145',
    invoiceRef: '056',
    submittedVia: 'Cadi Connect',
    stages: [
      { label: 'Received', done: true },
      { label: 'Under Review', done: false, active: true },
      { label: 'Approved', done: false },
      { label: 'Exported', done: false },
      { label: 'Paid', done: false },
    ],
    currentStageLabel: 'Under Review',
    lines: [
      {
        desc: 'Window cleaning — Magnet, Gaogate Place',
        date: '28 Apr',
        ref: 'BF-2026-0145',
        net: 20.0,
      },
    ],
  },
  {
    id: 'INV-0042',
    from: 'ProWash Midlands',
    client: 'Britannia Group',
    amountNet: 168.0,
    amountVat: 33.6,
    amountTotal: 201.6,
    received: '19 May',
    po: 'PO-2026-0088',
    stages: [
      { label: 'Received', done: true },
      { label: 'Under Review', done: false, active: true },
      { label: 'Approved', done: false },
      { label: 'Exported', done: false },
      { label: 'Paid', done: false },
    ],
    currentStageLabel: 'Under Review',
    lines: [
      {
        desc: 'Jet washing – NHS Luton Outpatients (exterior)',
        date: '14 May',
        ref: 'BF-2026-0188',
        net: 88,
      },
      {
        desc: 'Pressure washing – Aldi Dunstable RDC yard',
        date: '16 May',
        ref: 'BF-2026-0191',
        net: 80,
      },
    ],
  },
  {
    id: 'INV-0041',
    from: 'CleanFront UK',
    client: 'Britannia Group',
    amountNet: 399.0,
    amountVat: 79.8,
    amountTotal: 478.8,
    received: '10 May',
    po: 'PO-2026-0082',
    stages: [
      { label: 'Received', done: true },
      { label: 'Under Review', done: true },
      { label: 'Approved', done: true },
      { label: 'Exported', done: true, note: 'Exported to Xero · 11 May 09:42' },
      { label: 'Paid', done: false },
    ],
    currentStageLabel: 'Exported to Xero',
    exportRef: 'Xero · 11 May 09:42',
    lines: [
      {
        desc: 'Window cleaning – Next Luton The Mall (all elevations)',
        date: '08 May',
        ref: 'BF-2026-0179',
        net: 210,
      },
      {
        desc: 'Window cleaning – Watford Life Sciences Park',
        date: '09 May',
        ref: 'BF-2026-0181',
        net: 189,
      },
    ],
  },
  {
    id: 'INV-0040',
    from: 'Capital Gutters Ltd',
    client: 'Britannia Group',
    amountNet: 350.0,
    amountVat: 70.0,
    amountTotal: 420.0,
    received: '5 May',
    po: 'PO-2026-0078',
    stages: [
      { label: 'Received', done: true },
      { label: 'Under Review', done: true },
      { label: 'Approved', done: true },
      { label: 'Exported', done: true },
      { label: 'Paid', done: true },
    ],
    currentStageLabel: 'Paid',
    paymentRef: 'BF-PAY-0512',
    paidDate: '7 May',
    lines: [
      {
        desc: 'Gutter clearing – L&D Hospital Main Tower',
        date: '04 May',
        ref: 'BF-2026-0164',
        net: 180,
      },
      {
        desc: 'Gutter clearing – Next Watford Atria',
        date: '05 May',
        ref: 'BF-2026-0166',
        net: 170,
      },
    ],
  },
];

function StagePipeline({ stages }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        marginTop: '0.75rem',
        overflow: 'hidden',
      }}
    >
      {stages.map((stage, i) => {
        const isLast = i === stages.length - 1;
        const dotColor = stage.done
          ? '#4ade80'
          : stage.active
            ? '#fbbf24'
            : 'rgba(226,232,240,0.18)';
        const labelColor = stage.done
          ? '#4ade80'
          : stage.active
            ? '#fbbf24'
            : 'rgba(226,232,240,0.3)';
        const lineColor = stage.done ? 'rgba(74,222,128,0.35)' : 'rgba(255,255,255,0.07)';

        return (
          <div
            key={stage.label}
            style={{ display: 'flex', alignItems: 'flex-start', flex: isLast ? 'none' : 1 }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.25rem',
              }}
            >
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: dotColor,
                  flexShrink: 0,
                  marginTop: 1,
                  animation: stage.active ? 'fmpulse 1.4s infinite' : 'none',
                }}
              />
              <span
                style={{
                  fontSize: '0.62rem',
                  fontWeight: 600,
                  color: labelColor,
                  whiteSpace: 'nowrap',
                  textAlign: 'center',
                  maxWidth: 52,
                  lineHeight: 1.25,
                }}
              >
                {stage.label}
                {stage.done ? ' ✓' : ''}
              </span>
            </div>
            {!isLast && (
              <div style={{ height: 1.5, flex: 1, background: lineColor, margin: '4px 3px 0' }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function InvoiceRow({ inv }) {
  const [open, setOpen] = useState(inv.id === 'INV-0043' || inv.id === 'INV-0042');
  const [action, setAction] = useState(null);
  const [emailed, setEmailed] = useState(false);

  const allPaid = inv.stages.every((s) => s.done);
  const isUnderReview = inv.currentStageLabel === 'Under Review';
  const isExported = inv.currentStageLabel === 'Exported to Xero';

  const stageColor = allPaid
    ? '#4ade80'
    : isUnderReview
      ? '#fbbf24'
      : isExported
        ? '#60a5fa'
        : 'rgba(226,232,240,0.5)';

  return (
    <div style={{ ...card, borderRadius: '1rem', overflow: 'hidden' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%',
          textAlign: 'left',
          background: 'transparent',
          border: 'none',
          padding: '1rem 1.25rem',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '1rem',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              flexWrap: 'wrap',
              marginBottom: '0.3rem',
            }}
          >
            <span style={{ color: 'white', fontWeight: 800, fontSize: '0.9rem' }}>{inv.id}</span>
            <span
              style={{
                fontSize: '0.7rem',
                fontWeight: 700,
                color: stageColor,
                background: `${stageColor}18`,
                borderRadius: '999px',
                padding: '2px 9px',
              }}
            >
              {inv.currentStageLabel}
              {isUnderReview && (
                <span
                  style={{
                    display: 'inline-block',
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: '#fbbf24',
                    marginLeft: 5,
                    animation: 'fmpulse 1.4s infinite',
                    verticalAlign: 'middle',
                  }}
                />
              )}
            </span>
          </div>
          <div
            style={{
              color: 'rgba(226,232,240,0.5)',
              fontSize: '0.78rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              flexWrap: 'wrap',
            }}
          >
            <span>
              From {inv.from} · Received {inv.received}
            </span>
            {inv.submittedVia && (
              <span
                style={{
                  fontSize: '0.62rem',
                  fontWeight: 700,
                  padding: '1px 7px',
                  borderRadius: '999px',
                  background: 'rgba(251,146,60,0.12)',
                  border: '1px solid rgba(251,146,60,0.25)',
                  color: '#fb923c',
                }}
              >
                via {inv.submittedVia}
              </span>
            )}
          </div>
          {inv.site && (
            <div
              style={{
                color: 'rgba(226,232,240,0.35)',
                fontSize: '0.72rem',
                marginTop: '0.15rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
              }}
            >
              <MapPin size={10} /> {inv.site}
            </div>
          )}
          <StagePipeline stages={inv.stages} />
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
          <span
            style={{ color: 'white', fontWeight: 900, fontFamily: 'monospace', fontSize: '1rem' }}
          >
            £{inv.amountTotal}
          </span>
          <span style={{ color: 'rgba(226,232,240,0.35)', fontSize: '0.7rem' }}>inc VAT</span>
          {open ? (
            <ChevronUp size={14} color="rgba(226,232,240,0.3)" />
          ) : (
            <ChevronDown size={14} color="rgba(226,232,240,0.3)" />
          )}
        </div>
      </button>

      {open && (
        <div
          style={{ padding: '0 1.25rem 1.25rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}
        >
          {/* Line items */}
          <div style={{ marginTop: '1rem', marginBottom: '0.75rem' }}>
            <div
              style={{
                fontSize: '0.68rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.07em',
                color: 'rgba(226,232,240,0.35)',
                marginBottom: '0.5rem',
              }}
            >
              Line items
            </div>
            {inv.lines.map((line, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  padding: '0.5rem 0',
                  borderBottom:
                    i < inv.lines.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                  fontSize: '0.8rem',
                  gap: '1rem',
                }}
              >
                <div>
                  <div style={{ color: 'rgba(226,232,240,0.8)', marginBottom: '0.1rem' }}>
                    {line.desc}
                  </div>
                  <div style={{ color: 'rgba(226,232,240,0.35)', fontSize: '0.7rem' }}>
                    {line.date} · {line.ref}
                  </div>
                </div>
                <span
                  style={{
                    fontWeight: 700,
                    fontFamily: 'monospace',
                    color: 'white',
                    flexShrink: 0,
                  }}
                >
                  £{line.net.toFixed(2)}
                </span>
              </div>
            ))}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                gap: '0.25rem',
                marginTop: '0.6rem',
                paddingTop: '0.5rem',
                borderTop: '1px solid rgba(255,255,255,0.07)',
                fontSize: '0.78rem',
              }}
            >
              <div style={{ display: 'flex', gap: '1.5rem', color: 'rgba(226,232,240,0.45)' }}>
                <span>Net</span>
                <span style={{ fontFamily: 'monospace' }}>£{inv.amountNet.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', gap: '1.5rem', color: 'rgba(226,232,240,0.45)' }}>
                <span>VAT (20%)</span>
                <span style={{ fontFamily: 'monospace' }}>£{inv.amountVat.toFixed(2)}</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  gap: '1.5rem',
                  color: 'white',
                  fontWeight: 900,
                  fontSize: '0.9rem',
                }}
              >
                <span>Total</span>
                <span style={{ fontFamily: 'monospace', color: '#fb923c' }}>
                  £{inv.amountTotal.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Payment ref for paid */}
          {allPaid && (
            <div
              style={{
                ...card,
                borderRadius: '0.75rem',
                padding: '0.65rem 0.9rem',
                fontSize: '0.78rem',
                marginBottom: '0.75rem',
              }}
            >
              <div style={{ color: '#4ade80', fontWeight: 700, marginBottom: '0.2rem' }}>
                Payment confirmed ✓
              </div>
              <div style={{ color: 'rgba(226,232,240,0.5)' }}>
                Ref: {inv.paymentRef} · Paid {inv.paidDate}
              </div>
            </div>
          )}

          {/* Export ref for exported */}
          {isExported && (
            <div
              style={{
                ...card,
                borderRadius: '0.75rem',
                padding: '0.65rem 0.9rem',
                fontSize: '0.78rem',
                marginBottom: '0.75rem',
              }}
            >
              <div style={{ color: '#60a5fa', fontWeight: 700, marginBottom: '0.2rem' }}>
                Exported to Xero ✓
              </div>
              <div style={{ color: 'rgba(226,232,240,0.45)' }}>{inv.exportRef}</div>
            </div>
          )}

          {/* Actions for under review */}
          {isUnderReview && !action && (
            <div>
              <div
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.07em',
                  color: 'rgba(226,232,240,0.35)',
                  marginBottom: '0.6rem',
                }}
              >
                Actions
              </div>
              <div
                style={{
                  display: 'flex',
                  gap: '0.6rem',
                  flexWrap: 'wrap',
                  marginBottom: '0.85rem',
                }}
              >
                <button
                  onClick={() => setAction('approved')}
                  style={{
                    padding: '0.5rem 1.1rem',
                    borderRadius: '0.65rem',
                    background: 'rgba(74,222,128,0.1)',
                    border: '1px solid rgba(74,222,128,0.25)',
                    color: '#4ade80',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                  }}
                >
                  Approve ✓
                </button>
                <button
                  onClick={() => setAction('queried')}
                  style={{
                    padding: '0.5rem 1.1rem',
                    borderRadius: '0.65rem',
                    background: 'rgba(251,191,36,0.08)',
                    border: '1px solid rgba(251,191,36,0.2)',
                    color: '#fbbf24',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                  }}
                >
                  Query
                </button>
                <button
                  onClick={() => setAction('rejected')}
                  style={{
                    padding: '0.5rem 1.1rem',
                    borderRadius: '0.65rem',
                    background: 'rgba(248,113,113,0.08)',
                    border: '1px solid rgba(248,113,113,0.2)',
                    color: '#f87171',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                  }}
                >
                  Reject
                </button>
              </div>

              {/* Export buttons — disabled until approved */}
              <div
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.07em',
                  color: 'rgba(226,232,240,0.25)',
                  marginBottom: '0.5rem',
                }}
              >
                Export to — approve first
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', opacity: 0.35 }}>
                {['Xero', 'Sage', 'QuickBooks'].map((exp) => (
                  <span
                    key={exp}
                    style={{
                      padding: '0.35rem 0.85rem',
                      borderRadius: '999px',
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: 'rgba(226,232,240,0.5)',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                    }}
                  >
                    {exp}
                  </span>
                ))}
              </div>
            </div>
          )}

          {action && (
            <div
              style={{
                padding: '0.75rem 1rem',
                borderRadius: '0.75rem',
                background:
                  action === 'approved'
                    ? 'rgba(74,222,128,0.08)'
                    : action === 'queried'
                      ? 'rgba(251,191,36,0.08)'
                      : 'rgba(248,113,113,0.08)',
                border: `1px solid ${action === 'approved' ? 'rgba(74,222,128,0.2)' : action === 'queried' ? 'rgba(251,191,36,0.2)' : 'rgba(248,113,113,0.2)'}`,
                color:
                  action === 'approved' ? '#4ade80' : action === 'queried' ? '#fbbf24' : '#f87171',
                fontWeight: 700,
                fontSize: '0.85rem',
              }}
            >
              {action === 'approved' && 'Invoice approved ✓ — ready to export and email'}
              {action === 'queried' && `Query raised — ${inv.from} notified`}
              {action === 'rejected' && `Invoice rejected — ${inv.from} notified`}
            </div>
          )}

          {/* Email to accounts + export buttons — enabled after approve */}
          {action === 'approved' && (
            <div
              style={{
                marginTop: '0.75rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.65rem',
              }}
            >
              {/* Email accounts button */}
              <div>
                <div
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.07em',
                    color: 'rgba(226,232,240,0.35)',
                    marginBottom: '0.5rem',
                  }}
                >
                  Send to accounts
                </div>
                {!emailed ? (
                  <button
                    onClick={() => setEmailed(true)}
                    style={{
                      padding: '0.55rem 1.15rem',
                      borderRadius: '0.65rem',
                      background: 'rgba(251,146,60,0.1)',
                      border: '1px solid rgba(251,146,60,0.3)',
                      color: '#fb923c',
                      fontWeight: 700,
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                    }}
                  >
                    <Mail size={13} /> Email to accounts@britanniagroup.co.uk
                  </button>
                ) : (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      color: '#4ade80',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                    }}
                  >
                    <CheckCircle2 size={14} /> Sent to accounts@britanniagroup.co.uk
                  </div>
                )}
              </div>
              <div>
                <div
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.07em',
                    color: 'rgba(226,232,240,0.35)',
                    marginBottom: '0.5rem',
                  }}
                >
                  Export to
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {['Xero', 'Sage', 'QuickBooks'].map((exp) => (
                    <button
                      key={exp}
                      style={{
                        padding: '0.4rem 1rem',
                        borderRadius: '999px',
                        background: 'rgba(96,165,250,0.1)',
                        border: '1px solid rgba(96,165,250,0.25)',
                        color: '#60a5fa',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {exp}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const IMPACT = [
  {
    before: 'Invoices arrive by email, manually matched to jobs',
    after: 'Every invoice auto-linked to verified job records',
    icon: '🔗',
  },
  {
    before: 'Disputes delay payment — no evidence to hand',
    after: 'Geo-verified evidence attached — disputes resolved instantly',
    icon: '🔒',
  },
  {
    before: 'Xero export is a manual copy-paste job',
    after: 'One-click Xero export — approved invoices leave in seconds',
    icon: '⚡',
  },
];

export default function FmAccounts() {
  return (
    <div className="flex flex-col gap-5 p-6 pb-10" style={{ color: '#e2e8f0' }}>
      <style>{`
        @keyframes fmpulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.2; }
        }
      `}</style>

      {/* Impact strip */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ border: '1px solid rgba(79,120,255,0.18)', background: 'rgba(1,8,40,0.6)' }}
      >
        <div
          className="px-5 py-2.5 flex items-center gap-3"
          style={{
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            background: 'rgba(79,120,255,0.06)',
          }}
        >
          <span className="text-[9px] font-black uppercase tracking-widest text-white/30">
            What Cadi replaces
          </span>
          <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
          <span
            className="text-[9px] font-black uppercase tracking-widest"
            style={{ color: '#4f78ff' }}
          >
            With Cadi
          </span>
        </div>
        <div
          className="grid grid-cols-3 divide-x"
          style={{ borderColor: 'rgba(255,255,255,0.06)' }}
        >
          {IMPACT.map(({ before, after, icon }) => (
            <div key={icon} className="px-4 py-3 flex items-start gap-3">
              <span className="text-xl flex-shrink-0 mt-0.5">{icon}</span>
              <div>
                <div className="text-[10px] text-white/30 line-through decoration-white/20 mb-1 leading-snug">
                  {before}
                </div>
                <div className="text-[10px] font-bold leading-snug" style={{ color: '#60a5fa' }}>
                  {after}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h1
          style={{
            color: 'white',
            fontWeight: 900,
            fontSize: '1.5rem',
            margin: 0,
            marginBottom: '0.2rem',
          }}
        >
          Accounts
        </h1>
        <p style={{ color: 'rgba(226,232,240,0.4)', fontSize: '0.875rem', margin: 0 }}>
          Invoice inbox, approvals and accounting exports
        </p>
      </div>

      {/* Summary chips */}
      <div
        style={{
          ...card,
          borderRadius: '1rem',
          padding: '0.85rem 1.25rem',
          display: 'flex',
          gap: '1rem',
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#fbbf24',
              display: 'inline-block',
              animation: 'fmpulse 1.4s infinite',
            }}
          />
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#fbbf24' }}>
            Awaiting review
          </span>
          <span style={{ fontWeight: 900, color: 'white', fontFamily: 'monospace' }}>2</span>
        </div>
        <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.09)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#60a5fa',
              display: 'inline-block',
            }}
          />
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#60a5fa' }}>Processing</span>
          <span style={{ fontWeight: 900, color: 'white', fontFamily: 'monospace' }}>1</span>
        </div>
        <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.09)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#4ade80',
              display: 'inline-block',
            }}
          />
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#4ade80' }}>
            Paid this month
          </span>
          <span style={{ fontWeight: 900, color: 'white', fontFamily: 'monospace' }}>£420</span>
        </div>
      </div>

      {/* Invoice inbox */}
      <div
        style={{
          fontSize: '0.72rem',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.07em',
          color: 'rgba(226,232,240,0.35)',
          marginBottom: '-0.5rem',
          paddingLeft: '0.25rem',
        }}
      >
        Invoice inbox
      </div>

      {INVOICES.map((inv) => (
        <InvoiceRow key={inv.id} inv={inv} />
      ))}

      {/* Export section */}
      <div style={{ ...card, borderRadius: '1rem', padding: '1rem 1.25rem' }}>
        <div
          style={{
            fontSize: '0.72rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.07em',
            color: 'rgba(226,232,240,0.35)',
            marginBottom: '0.75rem',
          }}
        >
          Export options
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.65rem' }}>
          {['Xero', 'Sage', 'QuickBooks', 'CSV'].map((e) => (
            <span
              key={e}
              style={{
                padding: '0.35rem 0.9rem',
                borderRadius: '999px',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'rgba(226,232,240,0.6)',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {e}
            </span>
          ))}
        </div>
        <div style={{ fontSize: '0.72rem', color: 'rgba(226,232,240,0.3)' }}>
          Approved invoices auto-sync when connected.
        </div>
      </div>
    </div>
  );
}
