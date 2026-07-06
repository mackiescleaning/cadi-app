import { useState, useEffect } from 'react';
import {
  Camera,
  CheckCircle2,
  Send,
  ChevronRight,
  Building2,
  User,
  Hash,
  MapPin,
  Calendar,
  Printer,
} from 'lucide-react';

const card = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
};

const STEPS = ['Upload invoice', 'Reading…', 'Confirm details', 'Preview & send'];

const EXTRACTED = {
  contractor: 'W. Draper & Sons',
  address: '82 Sidney Avenue, Stafford, ST17 4EN',
  phone: '07824 632050',
  email: 'john.draper900@ntlworld.com',
  invoiceNo: '056',
  date: '28/04/2026',
  site: 'Magnet, Gaogate Place, Stafford',
  description: 'Cleaning Windows',
  amountNet: '20.00',
  vatRegistered: false,
  workOrderRef: '',
};

const READING_LINES = [
  { label: 'Contractor name', value: 'W. Draper & Sons', delay: 300 },
  { label: 'Address', value: '82 Sidney Avenue, Stafford', delay: 700 },
  { label: 'Invoice number', value: '056', delay: 1100 },
  { label: 'Date', value: '28/04/2026', delay: 1400 },
  { label: 'Site / location', value: 'Magnet, Gaogate Place, Stafford', delay: 1750 },
  { label: 'Description', value: 'Cleaning Windows', delay: 2100 },
  { label: 'Amount', value: '£20.00', delay: 2400 },
];

function HandwrittenInvoiceMock() {
  return (
    <div
      style={{
        background: '#f9f8f4',
        border: '1px solid #d4c9a8',
        borderRadius: '0.75rem',
        padding: '1.25rem',
        fontFamily: 'Georgia, serif',
        fontSize: '0.75rem',
        color: '#2c2018',
        boxShadow: '0 2px 16px rgba(0,0,0,0.25)',
        maxWidth: 300,
        margin: '0 auto',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '0.75rem',
        }}
      >
        <div style={{ fontSize: '0.62rem', lineHeight: 1.6, color: '#555' }}>
          <div style={{ fontWeight: 700, color: '#222' }}>W. Draper & Sons.</div>
          <div>82 Sidney Avenue,</div>
          <div>Stafford. ST17 4EN</div>
          <div style={{ marginTop: 4 }}>Mobile: John 07824 632050</div>
          <div>E-mail: john.draper900@ntlworld.com</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontWeight: 900, fontSize: '1rem', letterSpacing: '0.02em' }}>
            W. DRAPER &amp; SONS.
          </div>
          <div style={{ fontSize: '0.6rem', fontWeight: 600, marginTop: 2 }}>WINDOW CLEANERS</div>
          <div style={{ fontSize: '0.55rem', color: '#888', marginTop: 2 }}>EST 1946</div>
          <div style={{ fontSize: '0.55rem', color: '#888' }}>
            Insured by Sun Alliance & London Insurance Group
          </div>
        </div>
      </div>
      <div style={{ borderTop: '1px solid #ccc', paddingTop: '0.5rem', marginBottom: '0.5rem' }}>
        <div style={{ display: 'flex', gap: '1rem', fontSize: '0.62rem', marginBottom: '0.25rem' }}>
          <span>
            <em>M</em> Magnet, Gaogate Place, Stafford
          </span>
        </div>
        <div style={{ fontSize: '0.62rem', marginBottom: '0.25rem' }}>
          DR. TO: <em>28-4-2026</em>
        </div>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.62rem' }}>
        <tbody>
          <tr style={{ borderBottom: '1px solid #ddd' }}>
            <td style={{ padding: '0.3rem 0' }}>TO INVOICE 056</td>
            <td style={{ textAlign: 'right', padding: '0.3rem 0' }}></td>
          </tr>
          <tr style={{ borderBottom: '1px solid #ddd' }}>
            <td style={{ padding: '0.3rem 0' }}>CLEANING WINDOWS</td>
            <td style={{ textAlign: 'right', padding: '0.3rem 0', fontStyle: 'italic' }}>
              £ 20-00
            </td>
          </tr>
          <tr>
            <td style={{ padding: '0.5rem 0', textAlign: 'right', fontWeight: 700 }}>TOTAL</td>
            <td
              style={{
                textAlign: 'right',
                padding: '0.5rem 0',
                fontWeight: 700,
                fontStyle: 'italic',
              }}
            >
              £ 20-00
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function ReadingStep({ onDone }) {
  const [visible, setVisible] = useState([]);

  useEffect(() => {
    const timers = READING_LINES.map((line, i) =>
      setTimeout(() => setVisible((v) => [...v, i]), line.delay)
    );
    const done = setTimeout(onDone, 2800);
    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(done);
    };
  }, [onDone]);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '1.25rem',
        alignItems: 'flex-start',
      }}
    >
      <div>
        <div
          style={{
            fontSize: '0.7rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.07em',
            color: 'rgba(226,232,240,0.35)',
            marginBottom: '0.75rem',
          }}
        >
          Invoice photo
        </div>
        <HandwrittenInvoiceMock />
      </div>
      <div>
        <div
          style={{
            fontSize: '0.7rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.07em',
            color: 'rgba(226,232,240,0.35)',
            marginBottom: '0.75rem',
          }}
        >
          Cadi is reading…
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {READING_LINES.map((line, i) => (
            <div
              key={i}
              style={{
                ...card,
                borderRadius: '0.65rem',
                padding: '0.5rem 0.85rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                opacity: visible.includes(i) ? 1 : 0.15,
                transition: 'opacity 0.3s ease',
              }}
            >
              <span style={{ fontSize: '0.72rem', color: 'rgba(226,232,240,0.45)' }}>
                {line.label}
              </span>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: visible.includes(i) ? '#4ade80' : 'rgba(226,232,240,0.3)',
                }}
              >
                {visible.includes(i) ? line.value : '…'}
              </span>
            </div>
          ))}
        </div>
        {visible.length === READING_LINES.length && (
          <div
            style={{
              marginTop: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: '#4ade80',
              fontSize: '0.8rem',
              fontWeight: 700,
            }}
          >
            <CheckCircle2 size={14} /> All fields extracted
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, icon: Icon, value, onChange, placeholder, readOnly, note }) {
  return (
    <div>
      <label
        style={{
          fontSize: '0.68rem',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.07em',
          color: 'rgba(226,232,240,0.35)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.35rem',
          marginBottom: '0.35rem',
        }}
      >
        {Icon && <Icon size={10} />} {label}
      </label>
      <input
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        readOnly={readOnly || !onChange}
        placeholder={placeholder}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          background: readOnly ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.06)',
          border: `1px solid ${readOnly ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.15)'}`,
          borderRadius: '0.6rem',
          padding: '0.55rem 0.85rem',
          color: readOnly ? 'rgba(226,232,240,0.5)' : '#e2e8f0',
          fontSize: '0.85rem',
          fontFamily: 'inherit',
          outline: 'none',
        }}
      />
      {note && (
        <div style={{ fontSize: '0.65rem', color: 'rgba(226,232,240,0.3)', marginTop: '0.25rem' }}>
          {note}
        </div>
      )}
    </div>
  );
}

function ConfirmStep({ fields, setFields, onNext }) {
  const net = parseFloat(fields.amountNet) || 0;
  const vat = fields.vatRegistered ? +(net * 0.2).toFixed(2) : 0;
  const total = +(net + vat).toFixed(2);
  const canSubmit = fields.workOrderRef.trim().length > 0;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '1.25rem',
        alignItems: 'flex-start',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div
          style={{
            fontSize: '0.7rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.07em',
            color: 'rgba(226,232,240,0.35)',
          }}
        >
          Contractor details
        </div>
        <Field label="Contractor" icon={User} value={fields.contractor} readOnly />
        <Field label="Address" icon={MapPin} value={fields.address} readOnly />
        <Field label="Invoice number" icon={Hash} value={fields.invoiceNo} readOnly />
        <Field label="Date" icon={Calendar} value={fields.date} readOnly />
        <div
          style={{
            borderTop: '1px solid rgba(255,255,255,0.06)',
            paddingTop: '0.75rem',
            fontSize: '0.7rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.07em',
            color: 'rgba(226,232,240,0.35)',
          }}
        >
          Job details
        </div>
        <Field
          label="Site / Location"
          icon={Building2}
          value={fields.site}
          onChange={(v) => setFields((f) => ({ ...f, site: v }))}
        />
        <Field
          label="Description"
          value={fields.description}
          onChange={(v) => setFields((f) => ({ ...f, description: v }))}
        />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div
          style={{
            fontSize: '0.7rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.07em',
            color: 'rgba(226,232,240,0.35)',
          }}
        >
          Britannia reference
        </div>
        <Field
          label="Britannia Work Order Ref"
          icon={Hash}
          value={fields.workOrderRef}
          onChange={(v) => setFields((f) => ({ ...f, workOrderRef: v }))}
          placeholder="e.g. BF-2026-0145"
          note={!fields.workOrderRef ? '⚠ Required — ask your Britannia contact if unsure' : null}
        />
        <div
          style={{
            borderTop: '1px solid rgba(255,255,255,0.06)',
            paddingTop: '0.75rem',
            fontSize: '0.7rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.07em',
            color: 'rgba(226,232,240,0.35)',
          }}
        >
          Amount
        </div>
        <Field
          label="Amount (net, £)"
          icon={null}
          value={fields.amountNet}
          onChange={(v) => setFields((f) => ({ ...f, amountNet: v }))}
        />
        <div style={{ ...card, borderRadius: '0.75rem', padding: '0.75rem 1rem' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '0.5rem',
            }}
          >
            <span style={{ fontSize: '0.78rem', color: 'rgba(226,232,240,0.6)' }}>
              VAT registered?
            </span>
            <button
              onClick={() => setFields((f) => ({ ...f, vatRegistered: !f.vatRegistered }))}
              style={{
                padding: '0.25rem 0.75rem',
                borderRadius: '999px',
                fontWeight: 700,
                fontSize: '0.72rem',
                cursor: 'pointer',
                background: fields.vatRegistered
                  ? 'rgba(74,222,128,0.12)'
                  : 'rgba(255,255,255,0.06)',
                border: fields.vatRegistered
                  ? '1px solid rgba(74,222,128,0.3)'
                  : '1px solid rgba(255,255,255,0.1)',
                color: fields.vatRegistered ? '#4ade80' : 'rgba(226,232,240,0.4)',
              }}
            >
              {fields.vatRegistered ? 'Yes' : 'No'}
            </button>
          </div>
          <div
            style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.8rem' }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                color: 'rgba(226,232,240,0.5)',
              }}
            >
              <span>Net</span>
              <span style={{ fontFamily: 'monospace' }}>£{net.toFixed(2)}</span>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                color: 'rgba(226,232,240,0.5)',
              }}
            >
              <span>VAT (20%)</span>
              <span style={{ fontFamily: 'monospace' }}>£{vat.toFixed(2)}</span>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                color: 'white',
                fontWeight: 900,
                fontSize: '0.95rem',
                borderTop: '1px solid rgba(255,255,255,0.08)',
                paddingTop: '0.35rem',
                marginTop: '0.15rem',
              }}
            >
              <span>Total</span>
              <span style={{ fontFamily: 'monospace', color: '#fb923c' }}>£{total.toFixed(2)}</span>
            </div>
          </div>
        </div>
        <button
          onClick={onNext}
          disabled={!canSubmit}
          style={{
            marginTop: '0.5rem',
            padding: '0.75rem 1.25rem',
            borderRadius: '0.75rem',
            background: canSubmit ? 'rgba(79,120,255,0.15)' : 'rgba(255,255,255,0.04)',
            border: canSubmit
              ? '1px solid rgba(79,120,255,0.35)'
              : '1px solid rgba(255,255,255,0.08)',
            color: canSubmit ? '#93c5fd' : 'rgba(226,232,240,0.25)',
            fontWeight: 800,
            fontSize: '0.85rem',
            cursor: canSubmit ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
          }}
        >
          Preview Britannia invoice <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

function BritanniaInvoicePreview({ fields }) {
  const net = parseFloat(fields.amountNet) || 0;
  const vat = fields.vatRegistered ? +(net * 0.2).toFixed(2) : 0;
  const total = +(net + vat).toFixed(2);

  return (
    <div
      style={{
        background: 'white',
        color: '#111',
        borderRadius: '0.75rem',
        overflow: 'hidden',
        boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
        fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
        maxWidth: 560,
        margin: '0 auto',
        fontSize: '0.8rem',
      }}
    >
      {/* Header */}
      <div
        style={{
          background: '#1a1a2e',
          padding: '1.25rem 1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <div
            style={{ fontWeight: 900, fontSize: '1.1rem', color: 'white', letterSpacing: '0.04em' }}
          >
            BRITANNIA GROUP
          </div>
          <div
            style={{
              fontSize: '0.62rem',
              color: 'rgba(255,255,255,0.45)',
              marginTop: 2,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            Contractor Invoice
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.4)' }}>Processed via</div>
          <div style={{ fontWeight: 800, fontSize: '0.82rem', color: '#fb923c' }}>Cadi Connect</div>
        </div>
      </div>

      <div style={{ padding: '1.25rem 1.5rem' }}>
        {/* Two-col info */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '1rem',
            marginBottom: '1.25rem',
          }}
        >
          <div>
            <div
              style={{
                fontSize: '0.6rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: '#94a3b8',
                marginBottom: '0.35rem',
              }}
            >
              From (Contractor)
            </div>
            <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.85rem' }}>
              {fields.contractor}
            </div>
            <div style={{ color: '#64748b', marginTop: 2, lineHeight: 1.5, fontSize: '0.75rem' }}>
              {fields.address}
            </div>
            <div style={{ color: '#64748b', fontSize: '0.75rem' }}>{fields.phone}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div
              style={{
                fontSize: '0.6rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: '#94a3b8',
                marginBottom: '0.35rem',
              }}
            >
              Invoice details
            </div>
            <div style={{ fontWeight: 700, color: '#0f172a' }}>Invoice #{fields.invoiceNo}</div>
            <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: 2 }}>
              Date: {fields.date}
            </div>
            {fields.workOrderRef && (
              <div
                style={{
                  marginTop: 4,
                  display: 'inline-block',
                  padding: '2px 8px',
                  background: '#f0f4ff',
                  border: '1px solid #c7d2fe',
                  borderRadius: 4,
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  color: '#4338ca',
                }}
              >
                WO: {fields.workOrderRef}
              </div>
            )}
          </div>
        </div>

        {/* Site */}
        <div
          style={{
            background: '#f8faff',
            border: '1px solid #e2e8f0',
            borderRadius: '0.5rem',
            padding: '0.6rem 0.85rem',
            marginBottom: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.78rem',
          }}
        >
          <MapPin size={12} color="#64748b" />
          <span style={{ color: '#64748b', fontWeight: 600 }}>Site:</span>
          <span style={{ color: '#0f172a', fontWeight: 700 }}>{fields.site}</span>
        </div>

        {/* Line items */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1rem' }}>
          <thead>
            <tr style={{ background: '#f8faff', borderBottom: '2px solid #e2e8f0' }}>
              <th
                style={{
                  padding: '0.5rem 0.75rem',
                  textAlign: 'left',
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: '#64748b',
                }}
              >
                Description
              </th>
              <th
                style={{
                  padding: '0.5rem 0.75rem',
                  textAlign: 'right',
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: '#64748b',
                }}
              >
                Net
              </th>
              <th
                style={{
                  padding: '0.5rem 0.75rem',
                  textAlign: 'right',
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: '#64748b',
                }}
              >
                VAT
              </th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '0.65rem 0.75rem', color: '#1e293b' }}>
                {fields.description} — {fields.site}
              </td>
              <td
                style={{
                  padding: '0.65rem 0.75rem',
                  textAlign: 'right',
                  fontFamily: 'monospace',
                  fontWeight: 600,
                }}
              >
                £{net.toFixed(2)}
              </td>
              <td
                style={{
                  padding: '0.65rem 0.75rem',
                  textAlign: 'right',
                  fontFamily: 'monospace',
                  color: '#94a3b8',
                }}
              >
                {fields.vatRegistered ? `£${vat.toFixed(2)}` : 'N/A'}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Totals */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ minWidth: 200 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '0.3rem 0',
                color: '#64748b',
                fontSize: '0.78rem',
              }}
            >
              <span>Subtotal</span>
              <span style={{ fontFamily: 'monospace' }}>£{net.toFixed(2)}</span>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '0.3rem 0',
                color: '#64748b',
                fontSize: '0.78rem',
              }}
            >
              <span>VAT (20%)</span>
              <span style={{ fontFamily: 'monospace' }}>
                {fields.vatRegistered ? `£${vat.toFixed(2)}` : '£0.00 (not registered)'}
              </span>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '0.5rem 0',
                borderTop: '2px solid #1a1a2e',
                marginTop: '0.25rem',
                fontWeight: 900,
                fontSize: '1rem',
                color: '#1a1a2e',
              }}
            >
              <span>Total due</span>
              <span style={{ fontFamily: 'monospace' }}>£{total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Footer note */}
        <div
          style={{
            marginTop: '1.25rem',
            padding: '0.65rem 0.85rem',
            background: '#fff4e6',
            border: '1px solid #fed7aa',
            borderRadius: '0.5rem',
            fontSize: '0.68rem',
            color: '#92400e',
            lineHeight: 1.5,
          }}
        >
          <strong>Britannia Group accounts reference:</strong> Payment will be processed within 30
          days of approval. Queries: accounts@britanniagroup.co.uk
        </div>
      </div>
    </div>
  );
}

function PreviewStep({ fields, onSubmit, submitted }) {
  const [, setEmailed] = useState(false);

  function handleSubmit() {
    onSubmit();
    setTimeout(() => setEmailed(true), 400);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div
        style={{
          fontSize: '0.7rem',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.07em',
          color: 'rgba(226,232,240,0.35)',
        }}
      >
        Britannia-approved invoice preview
      </div>

      <BritanniaInvoicePreview fields={fields} />

      {!submitted ? (
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
          <button
            onClick={handleSubmit}
            style={{
              padding: '0.85rem 2rem',
              borderRadius: '0.75rem',
              background: 'rgba(74,222,128,0.12)',
              border: '1px solid rgba(74,222,128,0.3)',
              color: '#4ade80',
              fontWeight: 800,
              fontSize: '0.9rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <Send size={15} /> Submit to Britannia accounts
          </button>
          <button
            style={{
              padding: '0.85rem 1.25rem',
              borderRadius: '0.75rem',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(226,232,240,0.4)',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <Printer size={14} /> Save PDF
          </button>
        </div>
      ) : (
        <div
          style={{
            ...card,
            borderRadius: '1rem',
            padding: '1.25rem 1.5rem',
            border: '1px solid rgba(74,222,128,0.25)',
            background: 'rgba(74,222,128,0.06)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.6rem',
            textAlign: 'center',
          }}
        >
          <CheckCircle2 size={32} color="#4ade80" />
          <div style={{ fontWeight: 900, fontSize: '1.05rem', color: '#4ade80' }}>
            Invoice submitted
          </div>
          <div style={{ fontSize: '0.82rem', color: 'rgba(226,232,240,0.5)', lineHeight: 1.5 }}>
            Sent to{' '}
            <strong style={{ color: 'rgba(226,232,240,0.7)' }}>
              accounts@britanniagroup.co.uk
            </strong>
            <br />
            and added to the Britannia Group portal for review.
          </div>
          <div
            style={{
              display: 'flex',
              gap: '0.5rem',
              flexWrap: 'wrap',
              justifyContent: 'center',
              marginTop: '0.25rem',
            }}
          >
            <span
              style={{
                fontSize: '0.68rem',
                padding: '0.25rem 0.75rem',
                borderRadius: '999px',
                background: 'rgba(74,222,128,0.1)',
                border: '1px solid rgba(74,222,128,0.2)',
                color: '#4ade80',
                fontWeight: 700,
              }}
            >
              ✓ Email sent
            </span>
            <span
              style={{
                fontSize: '0.68rem',
                padding: '0.25rem 0.75rem',
                borderRadius: '999px',
                background: 'rgba(96,165,250,0.1)',
                border: '1px solid rgba(96,165,250,0.2)',
                color: '#60a5fa',
                fontWeight: 700,
              }}
            >
              ✓ Portal inbox updated
            </span>
          </div>
          <div
            style={{ fontSize: '0.68rem', color: 'rgba(226,232,240,0.3)', marginTop: '0.25rem' }}
          >
            Invoice #{fields.invoiceNo} · W. Draper &amp; Sons · £
            {(parseFloat(fields.amountNet) || 0).toFixed(2)}
          </div>
        </div>
      )}
    </div>
  );
}

export default function FmInvoiceSubmit() {
  const [step, setStep] = useState(0);
  const [photoLoaded, setPhotoLoaded] = useState(false);
  const [fields, setFields] = useState(EXTRACTED);
  const [submitted, setSubmitted] = useState(false);

  return (
    <div className="flex flex-col gap-5 p-6 pb-10" style={{ color: '#e2e8f0' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
      `}</style>

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
          Submit invoice to Britannia
        </h1>
        <p style={{ color: 'rgba(226,232,240,0.4)', fontSize: '0.875rem', margin: 0 }}>
          Upload your handwritten invoice — Cadi reads it and sends a Britannia-approved PDF
          straight to accounts
        </p>
      </div>

      {/* Step indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
        {STEPS.map((label, i) => {
          const done = i < step;
          const active = i === step;
          const isLast = i === STEPS.length - 1;
          return (
            <div
              key={label}
              style={{ display: 'flex', alignItems: 'center', flex: isLast ? 'none' : 1 }}
            >
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.25rem',
                  minWidth: 60,
                }}
              >
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: done
                      ? '#4ade80'
                      : active
                        ? 'rgba(79,120,255,0.3)'
                        : 'rgba(255,255,255,0.06)',
                    border: done
                      ? '1px solid #4ade80'
                      : active
                        ? '1px solid rgba(79,120,255,0.6)'
                        : '1px solid rgba(255,255,255,0.1)',
                    fontSize: '0.65rem',
                    fontWeight: 900,
                    color: done ? '#052e16' : active ? '#93c5fd' : 'rgba(226,232,240,0.25)',
                  }}
                >
                  {done ? '✓' : i + 1}
                </div>
                <span
                  style={{
                    fontSize: '0.62rem',
                    fontWeight: 700,
                    color: active ? 'white' : done ? '#4ade80' : 'rgba(226,232,240,0.25)',
                    textAlign: 'center',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {label}
                </span>
              </div>
              {!isLast && (
                <div
                  style={{
                    flex: 1,
                    height: 1.5,
                    background: done ? 'rgba(74,222,128,0.3)' : 'rgba(255,255,255,0.07)',
                    margin: '0 0.35rem',
                    marginBottom: '1rem',
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Step content */}
      <div style={{ ...card, borderRadius: '1.25rem', padding: '1.5rem' }}>
        {/* Step 0: Upload */}
        {step === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div
              style={{
                fontSize: '0.7rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.07em',
                color: 'rgba(226,232,240,0.35)',
              }}
            >
              Your invoice photo
            </div>
            {!photoLoaded ? (
              <div
                style={{
                  border: '2px dashed rgba(255,255,255,0.12)',
                  borderRadius: '1rem',
                  padding: '3rem 2rem',
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: 'rgba(255,255,255,0.02)',
                }}
              >
                <Camera
                  size={32}
                  color="rgba(226,232,240,0.2)"
                  style={{ margin: '0 auto 0.75rem' }}
                />
                <div
                  style={{
                    color: 'rgba(226,232,240,0.4)',
                    fontSize: '0.85rem',
                    marginBottom: '1rem',
                  }}
                >
                  Take a photo or upload your handwritten invoice
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                  <button
                    onClick={() => setPhotoLoaded(true)}
                    style={{
                      padding: '0.6rem 1.25rem',
                      borderRadius: '0.65rem',
                      background: 'rgba(79,120,255,0.12)',
                      border: '1px solid rgba(79,120,255,0.3)',
                      color: '#93c5fd',
                      fontWeight: 700,
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                    }}
                  >
                    Use example invoice
                  </button>
                  <button
                    style={{
                      padding: '0.6rem 1.25rem',
                      borderRadius: '0.65rem',
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: 'rgba(226,232,240,0.5)',
                      fontWeight: 700,
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                    }}
                  >
                    Browse files
                  </button>
                </div>
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                  alignItems: 'center',
                }}
              >
                <HandwrittenInvoiceMock />
                <div
                  style={{
                    display: 'flex',
                    gap: '0.5rem',
                    alignItems: 'center',
                    color: '#4ade80',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                  }}
                >
                  <CheckCircle2 size={14} /> Invoice photo loaded
                </div>
                <button
                  onClick={() => setStep(1)}
                  style={{
                    padding: '0.75rem 2rem',
                    borderRadius: '0.75rem',
                    background: 'rgba(79,120,255,0.15)',
                    border: '1px solid rgba(79,120,255,0.35)',
                    color: '#93c5fd',
                    fontWeight: 800,
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  Read invoice <ChevronRight size={15} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Step 1: Reading */}
        {step === 1 && <ReadingStep onDone={() => setStep(2)} />}

        {/* Step 2: Confirm */}
        {step === 2 && (
          <ConfirmStep fields={fields} setFields={setFields} onNext={() => setStep(3)} />
        )}

        {/* Step 3: Preview & send */}
        {step === 3 && (
          <PreviewStep fields={fields} onSubmit={() => setSubmitted(true)} submitted={submitted} />
        )}
      </div>

      {/* How it works strip */}
      <div style={{ ...card, borderRadius: '1rem', padding: '1rem 1.25rem' }}>
        <div
          style={{
            fontSize: '0.68rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.07em',
            color: 'rgba(226,232,240,0.25)',
            marginBottom: '0.75rem',
          }}
        >
          How it works
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
          {[
            { n: '1', label: 'Photo', desc: 'Upload your handwritten invoice' },
            { n: '2', label: 'AI reads', desc: 'Cadi extracts all the details automatically' },
            { n: '3', label: 'Confirm', desc: 'Check and add the Britannia work order ref' },
            { n: '4', label: 'Sent', desc: 'Britannia-approved PDF goes straight to accounts' },
          ].map(({ n, label, desc }) => (
            <div key={n} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  background: 'rgba(79,120,255,0.15)',
                  border: '1px solid rgba(79,120,255,0.3)',
                  color: '#93c5fd',
                  fontSize: '0.6rem',
                  fontWeight: 900,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginTop: 1,
                }}
              >
                {n}
              </div>
              <div>
                <div
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    color: 'rgba(226,232,240,0.7)',
                    marginBottom: '0.1rem',
                  }}
                >
                  {label}
                </div>
                <div
                  style={{ fontSize: '0.65rem', color: 'rgba(226,232,240,0.3)', lineHeight: 1.4 }}
                >
                  {desc}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
