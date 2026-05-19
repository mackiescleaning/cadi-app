import { useState } from 'react';
import {
  Upload, CheckCircle2, Calendar, ChevronDown,
} from 'lucide-react';

const ORANGE = '#C2410C';
const NAVY   = '#010a4f';

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
    <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">
      {children}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      {children}
    </div>
  );
}

const inputCls = "w-full rounded-xl border border-[#e0e8ff] text-sm px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-colors";
const inputStyle = { color: NAVY, fontFamily: 'inherit' };

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
      <div className="max-w-2xl space-y-4 pb-10">
        <div>
          <h1 className="text-xl font-black" style={{ color: NAVY }}>Invoicing</h1>
          <p className="text-sm text-gray-400 mt-0.5">Build and send FM-approved invoices</p>
        </div>
        <div className="bg-white rounded-2xl border border-[#e8eeff] shadow-sm px-5 py-10 text-center">
          <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={28} className="text-emerald-500" />
          </div>
          <div className="font-black text-xl mb-1" style={{ color: NAVY }}>Invoice sent!</div>
          <div className="text-sm text-gray-400 mb-1">
            Reference <span className="font-bold" style={{ color: ORANGE }}>#INV-0042</span>
          </div>
          <div className="text-xs text-gray-300 mb-0.5">Britannia FM notified</div>
          <div className="text-xs text-gray-300">Tracking live in Earnings</div>
          <button
            onClick={() => setSent(false)}
            className="mt-6 px-5 py-2.5 rounded-xl text-sm font-bold border border-[#e0e8ff] hover:bg-[#f8faff] transition-colors"
            style={{ color: NAVY }}
          >
            Create another invoice
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-4 pb-10">

      {/* Header */}
      <div>
        <h1 className="text-xl font-black" style={{ color: NAVY }}>Invoicing</h1>
        <p className="text-sm text-gray-400 mt-0.5">Build and send FM-approved invoices</p>
      </div>

      {/* Job selector */}
      <div className="bg-white rounded-2xl border border-[#e8eeff] shadow-sm px-5 py-4">
        <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">
          Select jobs to invoice
        </div>
        <div className="flex flex-col gap-2">
          {READY_JOBS.map(job => (
            <label
              key={job.id}
              className="flex items-center gap-3 cursor-pointer rounded-xl px-3.5 py-3 border transition-all"
              style={{
                background: selected[job.id] ? 'rgba(194,65,12,0.04)' : '#f8faff',
                borderColor: selected[job.id] ? 'rgba(194,65,12,0.25)' : '#e8eeff',
              }}
            >
              <input
                type="checkbox"
                checked={!!selected[job.id]}
                onChange={() => toggleJob(job.id)}
                className="w-4 h-4 cursor-pointer flex-shrink-0"
                style={{ accentColor: ORANGE }}
              />
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm truncate" style={{ color: NAVY }}>{job.site}</div>
                <div className="text-xs text-gray-400 mt-0.5">{job.service} · {job.date} · {job.ref}</div>
              </div>
              <span className="font-black text-sm font-mono flex-shrink-0" style={{ color: selected[job.id] ? ORANGE : '#94a3b8' }}>
                £{job.net}
              </span>
            </label>
          ))}
        </div>
        {selectedJobs.length > 0 && (
          <div className="mt-3 pt-3 border-t border-[#f0f4ff] flex justify-between items-center">
            <span className="text-xs text-gray-400">{selectedJobs.length} job{selectedJobs.length > 1 ? 's' : ''} selected</span>
            <span className="font-black text-sm font-mono" style={{ color: NAVY }}>Subtotal £{subtotal}</span>
          </div>
        )}
      </div>

      {/* Invoice details */}
      <div className="bg-white rounded-2xl border border-[#e8eeff] shadow-sm px-5 py-4">
        <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-4">
          Invoice details
        </div>
        <div className="grid grid-cols-2 gap-x-5 gap-y-4">

          <Field label="From — name">
            <input className={inputCls} style={inputStyle} value={fromName} onChange={e => setFromName(e.target.value)} />
          </Field>

          <Field label="From — UTR">
            <input className={inputCls} style={inputStyle} value={fromUtr} onChange={e => setFromUtr(e.target.value)} />
          </Field>

          <div className="col-span-2">
            <Field label="To">
              <input className={inputCls} style={inputStyle} value={toName} onChange={e => setToName(e.target.value)} />
            </Field>
          </div>

          <Field label="Invoice date">
            <input type="date" className={inputCls} style={inputStyle} value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} />
          </Field>

          <Field label="Payment terms">
            <div className="relative">
              <select
                className={inputCls + " cursor-pointer appearance-none pr-8"}
                style={inputStyle}
                value={terms}
                onChange={e => setTerms(e.target.value)}
              >
                {TERMS_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-300" />
            </div>
          </Field>

          <Field label="Due date">
            <div className="flex items-center gap-2 rounded-xl border border-[#e0e8ff] px-3 py-2.5 bg-[#f8faff] text-sm"
              style={{ color: NAVY }}>
              <Calendar size={13} className="text-gray-300" />
              <span>{dueDateFromTerms(terms)}</span>
              <span className="ml-auto text-[10px] text-gray-300">auto</span>
            </div>
          </Field>

          <Field label="PO Number">
            <input className={inputCls} style={{ ...inputStyle, fontWeight: 700, color: ORANGE }} value={poNumber} onChange={e => setPoNumber(e.target.value)} />
          </Field>

          <div className="col-span-2">
            <Field label="Notes / work summary">
              <textarea
                rows={3}
                className={inputCls + " resize-none"}
                style={{ ...inputStyle, lineHeight: 1.6 }}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Optional notes or work summary for this invoice..."
              />
            </Field>
          </div>
        </div>
      </div>

      {/* Paper invoice upload */}
      <div className="bg-white rounded-2xl border border-[#e8eeff] shadow-sm px-5 py-4">
        <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">
          Upload paper invoice
        </div>
        <label className="block border-2 border-dashed rounded-xl p-6 text-center cursor-pointer hover:border-orange-300 hover:bg-orange-50/30 transition-colors"
          style={{ borderColor: 'rgba(194,65,12,0.2)' }}>
          <Upload size={24} className="mx-auto mb-2 text-gray-300" />
          <div className="text-sm font-semibold text-gray-500 mb-1">Got a paper invoice? Upload it</div>
          <div className="text-xs text-gray-400 leading-relaxed">
            Cadi converts it to a Britannia-approved PDF automatically.
          </div>
          <div className="text-[10px] text-gray-300 mt-1.5">JPG · PNG · PDF</div>
          <input type="file" className="hidden" accept=".jpg,.jpeg,.png,.pdf" />
        </label>
        <div className="text-center text-xs text-gray-300 mt-2.5">or build from scratch above ↑</div>
      </div>

      {/* Invoice preview — intentionally dark (printed document) */}
      {selectedJobs.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
          {/* Dark header */}
          <div style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)', padding: '1.5rem' }}>
            <div className="flex justify-between items-start">
              <div>
                <div className="font-black text-base tracking-widest mb-0.5" style={{ color: ORANGE }}>CADI</div>
                <div className="font-black text-lg text-white">INVOICE</div>
                <div className="text-xs mt-0.5" style={{ color: 'rgba(226,232,240,0.45)' }}>#INV-0042</div>
              </div>
              <div className="text-right text-sm">
                <div className="text-xs mb-1" style={{ color: 'rgba(226,232,240,0.45)' }}>From</div>
                <div className="font-bold text-white">{fromName}</div>
                <div className="text-xs" style={{ color: 'rgba(226,232,240,0.45)' }}>UTR: {fromUtr}</div>
                <div className="text-xs mt-2 mb-1" style={{ color: 'rgba(226,232,240,0.45)' }}>To</div>
                <div className="font-bold text-white">{toName}</div>
                <div className="text-xs mt-1.5" style={{ color: 'rgba(226,232,240,0.4)' }}>PO: {poNumber}</div>
              </div>
            </div>
          </div>

          {/* Line items */}
          <div style={{ background: 'rgba(15,23,42,0.95)', padding: '1rem 1.5rem' }}>
            <div className="grid grid-cols-[1fr_auto] gap-x-6 pb-2 mb-1 border-b text-[10px] font-black uppercase tracking-widest"
              style={{ borderColor: 'rgba(255,255,255,0.07)', color: 'rgba(226,232,240,0.4)' }}>
              <span>Description</span>
              <span>Amount</span>
            </div>
            {selectedJobs.map(job => (
              <div key={job.id} className="grid grid-cols-[1fr_auto] gap-x-6 py-2.5 border-b text-sm"
                style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                <div>
                  <div className="font-semibold text-white">{job.service}</div>
                  <div className="text-xs mt-0.5" style={{ color: 'rgba(226,232,240,0.4)' }}>{job.site} · {job.date} · {job.ref}</div>
                </div>
                <div className="font-bold font-mono text-white text-right">£{job.net.toFixed(2)}</div>
              </div>
            ))}
            <div className="mt-3 flex flex-col items-end gap-1.5 text-sm">
              <div className="flex gap-8" style={{ color: 'rgba(226,232,240,0.5)' }}>
                <span>Subtotal</span>
                <span className="font-mono">£{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex gap-8" style={{ color: 'rgba(226,232,240,0.5)' }}>
                <span>VAT (20%)</span>
                <span className="font-mono">£{vat.toFixed(2)}</span>
              </div>
              <div className="flex gap-8 font-black text-base pt-2 mt-1 border-t w-full justify-end"
                style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
                <span className="text-white">Total</span>
                <span className="font-mono" style={{ color: '#fb923c' }}>£{total.toFixed(2)}</span>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t text-xs" style={{ borderColor: 'rgba(255,255,255,0.06)', color: 'rgba(226,232,240,0.35)' }}>
              Payment terms: {terms} · Due: {dueDateFromTerms(terms)}
            </div>
          </div>
        </div>
      )}

      {/* Send button */}
      <button
        onClick={() => selectedJobs.length > 0 && setSent(true)}
        disabled={selectedJobs.length === 0}
        className="w-full py-3.5 rounded-xl font-black text-sm transition-all"
        style={{
          background: selectedJobs.length > 0 ? ORANGE : '#f1f5f9',
          color: selectedJobs.length > 0 ? 'white' : '#94a3b8',
          border: 'none',
          cursor: selectedJobs.length > 0 ? 'pointer' : 'not-allowed',
        }}
      >
        Send to Britannia FM →
      </button>
    </div>
  );
}
