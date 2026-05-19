import { useState } from 'react';
import {
  Upload, FileText, CheckCircle2, Calendar, User, Building2,
  CreditCard, Hash, ChevronDown, Camera
} from 'lucide-react';

const card = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
};

const inputStyle = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.1)',
  color: 'white',
  borderRadius: '0.75rem',
  padding: '0.5rem 0.75rem',
  width: '100%',
  fontSize: '0.875rem',
  outline: 'none',
  boxSizing: 'border-box',
};

const selectStyle = {
  ...inputStyle,
  cursor: 'pointer',
  appearance: 'none',
  WebkitAppearance: 'none',
};

const READY_JOBS = [
  { id: 'j1', site: 'Premier Inn Luton Airport', client: 'Britannia FM', service: 'Morning clean', date: '08 May', ref: '#BF-4468', po: 'PO-2026-0088', net: 78 },
  { id: 'j2', site: 'Central Beds Council HQ', client: 'Britannia FM', service: 'Office deep clean', date: '12 May', ref: '#BF-4472', po: 'PO-2026-0090', net: 95 },
];

const TERMS_OPTIONS = ['Net 7', 'Net 14', 'Net 30', 'Due on receipt'];

function dueDateFromTerms(terms) {
  const today = new Date('2026-05-19');
  const days = terms === 'Net 7' ? 7 : terms === 'Net 14' ? 14 : terms === 'Net 30' ? 30 : 0;
  const due = new Date(today.getTime() + days * 86400000);
  return due.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function FieldLabel({ children }) {
  return (
    <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'rgba(226,232,240,0.4)', marginBottom: '0.35rem' }}>
      {children}
    </div>
  );
}

export default function EarnInvoice() {
  const [selected, setSelected] = useState({ j1: true, j2: false });
  const [fromName, setFromName] = useState('Sarah K.');
  const [fromUtr, setFromUtr] = useState('12345 67890');
  const [toName, setToName] = useState('Britannia FM Ltd');
  const [invoiceDate, setInvoiceDate] = useState('2026-05-19');
  const [terms, setTerms] = useState('Net 14');
  const [poNumber, setPoNumber] = useState('PO-2026-0088');
  const [notes, setNotes] = useState('');
  const [sent, setSent] = useState(false);

  const selectedJobs = READY_JOBS.filter(j => selected[j.id]);
  const subtotal = selectedJobs.reduce((s, j) => s + j.net, 0);
  const vat = Math.round(subtotal * 0.2 * 100) / 100;
  const total = subtotal + vat;

  const toggleJob = id => setSelected(s => ({ ...s, [id]: !s[id] }));

  if (sent) {
    return (
      <div className="flex flex-col gap-5 p-6 pb-10" style={{ color: '#e2e8f0' }}>
        <div>
          <h1 style={{ color: 'white', fontWeight: 900, fontSize: '1.5rem', margin: 0, marginBottom: '0.2rem' }}>Invoicing</h1>
          <p style={{ color: 'rgba(226,232,240,0.4)', fontSize: '0.875rem', margin: 0 }}>Build and send FM-approved invoices</p>
        </div>
        <div style={{ ...card, borderRadius: '1.25rem', padding: '2.5rem', textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem' }}>
            <CheckCircle2 size={28} color="#4ade80" />
          </div>
          <div style={{ color: 'white', fontWeight: 900, fontSize: '1.25rem', marginBottom: '0.5rem' }}>Invoice sent!</div>
          <div style={{ color: 'rgba(226,232,240,0.55)', fontSize: '0.9rem', marginBottom: '0.35rem' }}>Reference <strong style={{ color: '#fb923c' }}>#INV-0042</strong></div>
          <div style={{ color: 'rgba(226,232,240,0.4)', fontSize: '0.82rem', marginBottom: '0.25rem' }}>Britannia FM notified</div>
          <div style={{ color: 'rgba(226,232,240,0.4)', fontSize: '0.82rem' }}>Tracking live in Earnings</div>
          <button
            onClick={() => setSent(false)}
            style={{ marginTop: '1.5rem', padding: '0.6rem 1.5rem', borderRadius: '0.75rem', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', color: '#e2e8f0', cursor: 'pointer', fontSize: '0.85rem' }}
          >
            Create another invoice
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 p-6 pb-10" style={{ color: '#e2e8f0' }}>
      <div>
        <h1 style={{ color: 'white', fontWeight: 900, fontSize: '1.5rem', margin: 0, marginBottom: '0.2rem' }}>Invoicing</h1>
        <p style={{ color: 'rgba(226,232,240,0.4)', fontSize: '0.875rem', margin: 0 }}>Build and send FM-approved invoices</p>
      </div>

      {/* Job selector */}
      <div style={{ ...card, borderRadius: '1rem', padding: '1.1rem 1.25rem' }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'rgba(226,232,240,0.4)', marginBottom: '0.75rem' }}>
          Select jobs to invoice
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {READY_JOBS.map(job => (
            <label
              key={job.id}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.85rem', cursor: 'pointer',
                padding: '0.75rem 1rem', borderRadius: '0.75rem',
                background: selected[job.id] ? 'rgba(194,65,12,0.1)' : 'rgba(255,255,255,0.03)',
                border: selected[job.id] ? '1px solid rgba(194,65,12,0.3)' : '1px solid rgba(255,255,255,0.07)',
                transition: 'all 0.15s',
              }}
            >
              <input
                type="checkbox"
                checked={!!selected[job.id]}
                onChange={() => toggleJob(job.id)}
                style={{ accentColor: '#C2410C', width: 16, height: 16, cursor: 'pointer', flexShrink: 0 }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: 'white', fontWeight: 700, fontSize: '0.875rem' }}>{job.site}</div>
                <div style={{ color: 'rgba(226,232,240,0.45)', fontSize: '0.75rem' }}>{job.service} · {job.date} · {job.ref}</div>
              </div>
              <span style={{ fontWeight: 900, color: selected[job.id] ? '#fb923c' : 'rgba(226,232,240,0.5)', fontFamily: 'monospace', fontSize: '0.95rem', flexShrink: 0 }}>
                £{job.net}
              </span>
            </label>
          ))}
        </div>
        {selectedJobs.length > 0 && (
          <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: 'rgba(226,232,240,0.45)' }}>{selectedJobs.length} job{selectedJobs.length > 1 ? 's' : ''} selected</span>
            <span style={{ fontWeight: 900, color: 'white', fontFamily: 'monospace' }}>Subtotal £{subtotal}</span>
          </div>
        )}
      </div>

      {/* Invoice details */}
      <div style={{ ...card, borderRadius: '1rem', padding: '1.25rem' }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'rgba(226,232,240,0.4)', marginBottom: '1rem' }}>
          Invoice details
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <FieldLabel>From — name</FieldLabel>
            <input style={inputStyle} value={fromName} onChange={e => setFromName(e.target.value)} />
          </div>
          <div>
            <FieldLabel>From — UTR</FieldLabel>
            <input style={inputStyle} value={fromUtr} onChange={e => setFromUtr(e.target.value)} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <FieldLabel>To</FieldLabel>
            <input style={inputStyle} value={toName} onChange={e => setToName(e.target.value)} />
          </div>
          <div>
            <FieldLabel>Invoice date</FieldLabel>
            <input type="date" style={inputStyle} value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} />
          </div>
          <div>
            <FieldLabel>Payment terms</FieldLabel>
            <div style={{ position: 'relative' }}>
              <select style={selectStyle} value={terms} onChange={e => setTerms(e.target.value)}>
                {TERMS_OPTIONS.map(t => <option key={t} value={t} style={{ background: '#1e293b' }}>{t}</option>)}
              </select>
              <ChevronDown size={14} color="rgba(226,232,240,0.4)" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            </div>
          </div>
          <div>
            <FieldLabel>Due date</FieldLabel>
            <div style={{ ...inputStyle, color: 'rgba(226,232,240,0.6)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Calendar size={13} color="rgba(226,232,240,0.4)" />
              {dueDateFromTerms(terms)}
              <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: 'rgba(226,232,240,0.3)' }}>auto</span>
            </div>
          </div>
          <div>
            <FieldLabel>PO Number</FieldLabel>
            <input style={inputStyle} value={poNumber} onChange={e => setPoNumber(e.target.value)} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <FieldLabel>Notes / work summary</FieldLabel>
            <textarea
              rows={3}
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Optional notes or work summary for this invoice..."
            />
          </div>
        </div>
      </div>

      {/* Paper invoice upload */}
      <div style={{ ...card, borderRadius: '1rem', padding: '1.25rem' }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'rgba(226,232,240,0.4)', marginBottom: '0.85rem' }}>
          Upload paper invoice
        </div>
        <div style={{
          border: '1.5px dashed rgba(255,255,255,0.14)',
          borderRadius: '0.9rem',
          padding: '1.75rem',
          textAlign: 'center',
          background: 'rgba(255,255,255,0.02)',
          cursor: 'pointer',
          marginBottom: '0.75rem',
        }}>
          <Upload size={28} color="rgba(226,232,240,0.3)" style={{ margin: '0 auto 0.65rem', display: 'block' }} />
          <div style={{ color: 'rgba(226,232,240,0.6)', fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.3rem' }}>
            Got a paper invoice? Upload it
          </div>
          <div style={{ color: 'rgba(226,232,240,0.4)', fontSize: '0.78rem', lineHeight: 1.5 }}>
            Cadi will convert it to a Britannia-approved PDF automatically.
          </div>
          <div style={{ fontSize: '0.7rem', color: 'rgba(226,232,240,0.28)', marginTop: '0.5rem' }}>Supported: JPG, PNG, PDF</div>
        </div>
        <div style={{ textAlign: 'center', fontSize: '0.75rem', color: 'rgba(226,232,240,0.3)' }}>or build from scratch above ↑</div>
      </div>

      {/* Invoice preview */}
      {selectedJobs.length > 0 && (
        <div style={{ borderRadius: '1rem', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
          {/* Dark navy header */}
          <div style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)', padding: '1.5rem 1.5rem 1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ color: '#C2410C', fontWeight: 900, fontSize: '1rem', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>CADI</div>
                <div style={{ color: 'white', fontWeight: 800, fontSize: '1.1rem' }}>INVOICE</div>
                <div style={{ color: 'rgba(226,232,240,0.45)', fontSize: '0.75rem', marginTop: '0.15rem' }}>#INV-0042</div>
              </div>
              <div style={{ textAlign: 'right', fontSize: '0.8rem' }}>
                <div style={{ color: 'rgba(226,232,240,0.5)', marginBottom: '0.15rem' }}>From</div>
                <div style={{ color: 'white', fontWeight: 700 }}>{fromName}</div>
                <div style={{ color: 'rgba(226,232,240,0.45)', fontSize: '0.72rem' }}>UTR: {fromUtr}</div>
                <div style={{ color: 'rgba(226,232,240,0.4)', marginTop: '0.5rem', marginBottom: '0.15rem' }}>To</div>
                <div style={{ color: 'white', fontWeight: 700 }}>{toName}</div>
                <div style={{ color: 'rgba(226,232,240,0.4)', fontSize: '0.72rem', marginTop: '0.4rem' }}>PO: {poNumber}</div>
              </div>
            </div>
          </div>

          {/* Line items */}
          <div style={{ background: 'rgba(15,23,42,0.9)', padding: '1rem 1.5rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.5rem 1.5rem', fontSize: '0.8rem', marginBottom: '0.5rem', paddingBottom: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.07)', color: 'rgba(226,232,240,0.4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '0.68rem' }}>
              <span>Description</span>
              <span>Amount</span>
            </div>
            {selectedJobs.map(job => (
              <div key={job.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.35rem 1.5rem', fontSize: '0.82rem', padding: '0.5rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div>
                  <div style={{ color: 'white', fontWeight: 600 }}>{job.service}</div>
                  <div style={{ color: 'rgba(226,232,240,0.4)', fontSize: '0.72rem' }}>{job.site} · {job.date} · {job.ref}</div>
                </div>
                <div style={{ color: 'white', fontWeight: 700, fontFamily: 'monospace', textAlign: 'right' }}>£{job.net.toFixed(2)}</div>
              </div>
            ))}
            <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.3rem', fontSize: '0.82rem' }}>
              <div style={{ display: 'flex', gap: '2rem', color: 'rgba(226,232,240,0.5)' }}>
                <span>Subtotal</span>
                <span style={{ fontFamily: 'monospace' }}>£{subtotal.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', gap: '2rem', color: 'rgba(226,232,240,0.5)' }}>
                <span>VAT (20%)</span>
                <span style={{ fontFamily: 'monospace' }}>£{vat.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', gap: '2rem', color: 'white', fontWeight: 900, fontSize: '1rem', paddingTop: '0.4rem', borderTop: '1px solid rgba(255,255,255,0.12)', marginTop: '0.2rem' }}>
                <span>Total</span>
                <span style={{ fontFamily: 'monospace', color: '#fb923c' }}>£{total.toFixed(2)}</span>
              </div>
            </div>
            <div style={{ marginTop: '0.85rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: '0.72rem', color: 'rgba(226,232,240,0.35)' }}>
              Payment terms: {terms} · Due: {dueDateFromTerms(terms)}
            </div>
          </div>
        </div>
      )}

      {/* Send button */}
      <button
        onClick={() => selectedJobs.length > 0 && setSent(true)}
        disabled={selectedJobs.length === 0}
        style={{
          width: '100%',
          padding: '0.9rem',
          borderRadius: '0.9rem',
          background: selectedJobs.length > 0 ? '#C2410C' : 'rgba(255,255,255,0.07)',
          border: 'none',
          color: selectedJobs.length > 0 ? 'white' : 'rgba(226,232,240,0.3)',
          fontWeight: 800,
          fontSize: '1rem',
          cursor: selectedJobs.length > 0 ? 'pointer' : 'not-allowed',
          transition: 'all 0.15s',
        }}
      >
        Send to Britannia FM →
      </button>
    </div>
  );
}
