import { useState, useEffect } from 'react';
import { Shield, Upload, CheckCircle2, ChevronRight, FileText, Camera } from 'lucide-react';

const ORANGE = '#C2410C';

// Jobs that have been completed but not yet invoiced
const UNINVOICED_JOBS = [
  { id: 'j1', date: '09 May 2026', site: 'Next – Luton The Mall',    fm: 'Britannia FM', service: 'Retail morning clean', value: 85 },
  { id: 'j2', date: '08 May 2026', site: 'Premier Inn Luton Airport', fm: 'Britannia FM', service: 'Morning clean',        value: 78 },
  { id: 'j3', date: '07 May 2026', site: 'Next – Luton The Mall',    fm: 'Britannia FM', service: 'Retail morning clean', value: 85 },
  { id: 'j4', date: '06 May 2026', site: 'Next – Luton The Mall',    fm: 'Britannia FM', service: 'Retail morning clean', value: 85 },
  { id: 'j5', date: '05 May 2026', site: 'Aylesbury College',        fm: 'Metro Clean',  service: 'Evening clean',        value: 120 },
];

const PROCESS_STEPS = [
  'Scanning invoice image…',
  'Extracting job details…',
  'Matching to Britannia FM records…',
  'Formatting to approved template…',
  'Applying compliance metadata…',
];

function InvoicePreview({ jobs, ref: invoiceRef, date }) {
  const subtotal = jobs.reduce((s, j) => s + j.value, 0);
  const vat = Math.round(subtotal * 0.2 * 100) / 100;
  const total = subtotal + vat;
  return (
    <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100 text-[#010a4f]">
      {/* Header */}
      <div className="px-8 py-6" style={{ background: 'linear-gradient(135deg, #010a4f 0%, #0d1f6e 100%)' }}>
        <div className="flex items-start justify-between">
          <div>
            <div className="text-white font-black text-xl tracking-tight">TAX INVOICE</div>
            <div className="text-white/50 text-xs mt-0.5 font-mono">{invoiceRef || '#INV-0000'}</div>
          </div>
          <div className="text-right">
            <div className="text-white/40 text-[9px] font-black uppercase tracking-wider mb-0.5">Powered by</div>
            <div className="text-white font-black text-sm">Cadi Connect</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 mt-5">
          <div>
            <div className="text-white/40 text-[9px] uppercase tracking-wider font-bold mb-1">From</div>
            <div className="text-white font-bold text-sm">Sarah K.</div>
            <div className="text-white/50 text-xs">Sole trader · cleaning operative</div>
            <div className="text-white/50 text-xs mt-0.5">UTR: 12345 67890</div>
          </div>
          <div>
            <div className="text-white/40 text-[9px] uppercase tracking-wider font-bold mb-1">To</div>
            <div className="text-white font-bold text-sm">Britannia FM Ltd</div>
            <div className="text-white/50 text-xs">Accounts Payable</div>
            <div className="text-white/50 text-xs">VAT: GB 123 4567 89</div>
          </div>
        </div>
      </div>

      {/* Meta row */}
      <div className="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-100">
        {[
          { label: 'Invoice date',  value: date || '09 May 2026' },
          { label: 'Payment terms', value: '30 days'              },
          { label: 'Due date',      value: '09 Jun 2026'          },
        ].map(({ label, value }) => (
          <div key={label} className="px-5 py-3 text-center">
            <div className="text-[9px] font-black text-gray-400 uppercase tracking-wider mb-0.5">{label}</div>
            <div className="text-sm font-bold text-[#010a4f]">{value}</div>
          </div>
        ))}
      </div>

      {/* Line items */}
      <div className="px-6 py-4">
        <table className="w-full text-xs">
          <thead>
            <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
              {['Date', 'Site', 'Service', 'Amount'].map(h => (
                <th key={h} className="text-left text-gray-400 font-black uppercase tracking-wider text-[9px] pb-2 pr-4">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {jobs.map((job, i) => (
              <tr key={job.id} style={{ borderBottom: '1px solid #f9fafb' }}>
                <td className="py-2.5 pr-4 font-mono text-gray-600 whitespace-nowrap">{job.date}</td>
                <td className="py-2.5 pr-4 font-medium text-[#010a4f] max-w-[140px] truncate">{job.site}</td>
                <td className="py-2.5 pr-4 text-gray-500">{job.service}</td>
                <td className="py-2.5 font-bold text-[#010a4f] text-right">£{job.value.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="px-6 pb-4">
        <div className="ml-auto w-48 space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Subtotal</span>
            <span className="font-medium text-[#010a4f]">£{subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">VAT @ 20%</span>
            <span className="font-medium text-[#010a4f]">£{vat.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm font-black pt-1.5" style={{ borderTop: '2px solid #010a4f' }}>
            <span className="text-[#010a4f]">Total due</span>
            <span className="text-[#010a4f]">£{total.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Bank details */}
      <div className="mx-6 mb-4 px-4 py-3 rounded-xl bg-gray-50 border border-gray-100">
        <div className="text-[9px] font-black text-gray-400 uppercase tracking-wider mb-1.5">Payment details</div>
        <div className="grid grid-cols-3 gap-4 text-xs">
          <div><span className="text-gray-400">Account name</span><div className="font-medium text-[#010a4f] mt-0.5">S. Kowalski</div></div>
          <div><span className="text-gray-400">Sort code</span><div className="font-mono font-medium text-[#010a4f] mt-0.5">20-00-00</div></div>
          <div><span className="text-gray-400">Account no.</span><div className="font-mono font-medium text-[#010a4f] mt-0.5">12345678</div></div>
        </div>
      </div>

      {/* Cadi verified footer */}
      <div className="mx-6 mb-5 px-4 py-2.5 rounded-xl flex items-center gap-2"
        style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)' }}>
        <Shield size={12} className="text-emerald-600 shrink-0" />
        <span className="text-[10px] text-emerald-700 font-bold">Cadi Connect verified · job records, GPS data & evidence matched · tamper-evident audit trail</span>
      </div>
    </div>
  );
}

export default function EarnInvoice() {
  const [stage, setStage]           = useState('method');   // method | select | upload | processing | preview | done
  const [method, setMethod]         = useState(null);
  const [selectedJobs, setSelected] = useState([]);
  const [processStep, setProcessStep] = useState(0);
  const [uploadDone, setUploadDone]   = useState(false);
  const [invoiceRef]                  = useState(`#INV-${Math.floor(1000 + Math.random() * 9000)}`);

  // Simulate processing animation
  useEffect(() => {
    if (stage !== 'processing') return;
    let step = 0;
    const iv = setInterval(() => {
      step += 1;
      setProcessStep(step);
      if (step >= PROCESS_STEPS.length) {
        clearInterval(iv);
        setTimeout(() => setStage('preview'), 600);
      }
    }, 700);
    return () => clearInterval(iv);
  }, [stage]);

  function toggleJob(id) {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  const chosenJobs   = UNINVOICED_JOBS.filter(j => selectedJobs.includes(j.id));
  const runningTotal = chosenJobs.reduce((s, j) => s + j.value, 0);

  // ── Method selection ──────────────────────────────────────────────────────
  if (stage === 'method') return (
    <div className="max-w-xl space-y-5 pb-8">
      <div>
        <h1 className="text-xl font-black text-[#010a4f]">Submit Invoice</h1>
        <p className="text-sm text-gray-500 mt-0.5">Cadi formats your invoice to the FM's approved template and sends it directly to their accounts team.</p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {[
          {
            id: 'jobs',
            icon: <FileText size={28} className="text-[#4f78ff]" />,
            title: 'From my completed jobs',
            desc: 'Select jobs from your pipeline — Cadi builds the invoice automatically. Fastest option.',
            recommended: true,
          },
          {
            id: 'upload',
            icon: <Camera size={28} style={{ color: ORANGE }} />,
            title: 'Upload paper invoice',
            desc: 'Take a photo or scan of your existing paper invoice. Cadi reformats it to the approved standard.',
            recommended: false,
          },
        ].map(opt => (
          <button key={opt.id} onClick={() => { setMethod(opt.id); setStage(opt.id === 'jobs' ? 'select' : 'upload'); }}
            className="bg-white rounded-2xl border border-[#99c5ff]/20 shadow-sm p-5 text-left hover:shadow-md hover:border-[#4f78ff]/30 transition-all group">
            <div className="mb-3">{opt.icon}</div>
            {opt.recommended && (
              <div className="text-[9px] font-black px-2 py-0.5 rounded-full mb-2 inline-block"
                style={{ background: 'rgba(16,185,129,0.1)', color: '#059669', border: '1px solid rgba(16,185,129,0.25)' }}>
                Recommended
              </div>
            )}
            <div className="font-bold text-sm text-[#010a4f]">{opt.title}</div>
            <div className="text-xs text-gray-400 mt-1 leading-relaxed">{opt.desc}</div>
          </button>
        ))}
      </div>
      <div className="bg-white rounded-2xl border border-[#99c5ff]/20 shadow-sm p-4 flex items-start gap-3">
        <Shield size={16} className="text-emerald-600 shrink-0 mt-0.5" />
        <div className="text-xs text-gray-500 leading-relaxed">
          <span className="font-bold text-[#010a4f]">How it works:</span> Cadi verifies your invoice against your recorded job data, formats it to Britannia FM's approved PDF template, and drops it directly into their accounts queue. No emails, no paper, no reformatting.
        </div>
      </div>
    </div>
  );

  // ── Job selection ─────────────────────────────────────────────────────────
  if (stage === 'select') return (
    <div className="max-w-xl space-y-5 pb-8">
      <div>
        <button onClick={() => setStage('method')} className="text-xs text-[#4f78ff] font-bold mb-3 hover:underline">← Back</button>
        <h1 className="text-xl font-black text-[#010a4f]">Select jobs to invoice</h1>
        <p className="text-sm text-gray-500 mt-0.5">{UNINVOICED_JOBS.length} completed jobs not yet invoiced.</p>
      </div>
      <div className="space-y-2">
        {UNINVOICED_JOBS.map(job => {
          const sel = selectedJobs.includes(job.id);
          return (
            <button key={job.id} onClick={() => toggleJob(job.id)}
              className="w-full bg-white rounded-2xl border text-left p-4 flex items-center gap-3 transition-all hover:shadow-sm"
              style={{ borderColor: sel ? 'rgba(79,120,255,0.4)' : 'rgba(153,197,255,0.2)', background: sel ? 'rgba(79,120,255,0.03)' : 'white' }}>
              <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 text-xs font-black transition-all ${
                sel ? 'bg-[#4f78ff] text-white' : 'border border-gray-200 text-transparent'
              }`}>✓</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-[#010a4f] truncate">{job.site}</div>
                <div className="text-xs text-gray-400">{job.fm} · {job.service} · {job.date}</div>
              </div>
              <div className="text-sm font-black text-[#010a4f] shrink-0">£{job.value}</div>
            </button>
          );
        })}
      </div>
      {selectedJobs.length > 0 && (
        <div className="bg-white rounded-2xl border border-[#99c5ff]/20 shadow-sm p-4 flex items-center justify-between">
          <div>
            <div className="text-sm font-bold text-[#010a4f]">{selectedJobs.length} job{selectedJobs.length !== 1 ? 's' : ''} selected</div>
            <div className="text-xs text-gray-400">Subtotal £{runningTotal} + VAT = £{(runningTotal * 1.2).toFixed(2)}</div>
          </div>
          <button onClick={() => setStage('processing')}
            className="px-5 py-2.5 rounded-xl text-sm font-black text-white transition-all hover:brightness-110"
            style={{ background: ORANGE }}>
            Build invoice →
          </button>
        </div>
      )}
    </div>
  );

  // ── Upload ────────────────────────────────────────────────────────────────
  if (stage === 'upload') return (
    <div className="max-w-xl space-y-5 pb-8">
      <div>
        <button onClick={() => setStage('method')} className="text-xs text-[#4f78ff] font-bold mb-3 hover:underline">← Back</button>
        <h1 className="text-xl font-black text-[#010a4f]">Upload your invoice</h1>
        <p className="text-sm text-gray-500 mt-0.5">Photo, scan, or PDF — any format works. Cadi reads and reformats it.</p>
      </div>
      {!uploadDone ? (
        <button
          onClick={() => setUploadDone(true)}
          className="w-full bg-white rounded-2xl border-2 border-dashed p-12 flex flex-col items-center gap-4 hover:border-[#4f78ff]/40 hover:bg-[#f8faff] transition-all"
          style={{ borderColor: 'rgba(153,197,255,0.4)' }}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(194,65,12,0.08)', border: '1px solid rgba(194,65,12,0.2)' }}>
            <Upload size={24} style={{ color: ORANGE }} />
          </div>
          <div className="text-center">
            <div className="font-bold text-[#010a4f]">Tap to upload or drag here</div>
            <div className="text-xs text-gray-400 mt-1">JPG, PNG, PDF · max 20MB</div>
          </div>
          <div className="text-xs font-bold text-gray-400 border border-gray-200 px-4 py-2 rounded-xl hover:border-gray-300 transition-colors">
            Choose file
          </div>
        </button>
      ) : (
        <div className="bg-white rounded-2xl border border-[#99c5ff]/20 shadow-sm p-5 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
              <CheckCircle2 size={20} className="text-emerald-600" />
            </div>
            <div className="flex-1">
              <div className="font-bold text-sm text-[#010a4f]">invoice_may_2026.jpg</div>
              <div className="text-xs text-gray-400">Uploaded · 847 KB</div>
            </div>
          </div>
          <button onClick={() => setStage('processing')}
            className="w-full py-3 rounded-xl text-sm font-black text-white transition-all hover:brightness-110"
            style={{ background: ORANGE }}>
            Process with Cadi →
          </button>
        </div>
      )}
    </div>
  );

  // ── Processing animation ──────────────────────────────────────────────────
  if (stage === 'processing') return (
    <div className="max-w-xl space-y-6 pb-8">
      <div>
        <h1 className="text-xl font-black text-[#010a4f]">Cadi is formatting your invoice</h1>
        <p className="text-sm text-gray-500 mt-0.5">Takes about 10 seconds. We'll match your records and apply the Britannia FM template.</p>
      </div>
      <div className="bg-white rounded-2xl border border-[#99c5ff]/20 shadow-sm p-7 space-y-5">
        <div className="flex flex-col items-center gap-5">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(79,120,255,0.1)', border: '1px solid rgba(79,120,255,0.2)' }}>
            <FileText size={28} className="text-[#4f78ff]" />
          </div>
          <div className="w-full space-y-3">
            {PROCESS_STEPS.map((step, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold transition-all ${
                  i < processStep   ? 'bg-emerald-500 text-white' :
                  i === processStep ? 'bg-[#4f78ff] text-white' :
                  'bg-gray-100 text-gray-300'
                }`}>
                  {i < processStep ? '✓' : i + 1}
                </div>
                <div className={`text-sm transition-all ${
                  i < processStep   ? 'text-emerald-600 font-medium' :
                  i === processStep ? 'text-[#010a4f] font-bold' :
                  'text-gray-300'
                }`}>{step}</div>
                {i === processStep && (
                  <div className="ml-auto flex gap-1">
                    {[0,1,2].map(d => (
                      <div key={d} className="w-1.5 h-1.5 rounded-full bg-[#4f78ff] animate-bounce"
                        style={{ animationDelay: `${d * 0.15}s` }} />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="w-full bg-gray-100 rounded-full h-1.5">
            <div className="h-full rounded-full bg-[#4f78ff] transition-all duration-700"
              style={{ width: `${(processStep / PROCESS_STEPS.length) * 100}%` }} />
          </div>
        </div>
      </div>
    </div>
  );

  // ── Preview ───────────────────────────────────────────────────────────────
  if (stage === 'preview') {
    const previewJobs = method === 'jobs' ? chosenJobs : UNINVOICED_JOBS.slice(0, 3);
    const total = previewJobs.reduce((s, j) => s + j.value, 0) * 1.2;
    return (
      <div className="max-w-2xl space-y-5 pb-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-black text-[#010a4f]">Review your invoice</h1>
            <p className="text-sm text-gray-500 mt-0.5">Cadi formatted this to Britannia FM's approved template. Check everything looks right.</p>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
            style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>
            <Shield size={11} className="text-emerald-600" />
            <span className="text-[10px] font-black text-emerald-700">Cadi verified</span>
          </div>
        </div>
        <InvoicePreview jobs={previewJobs} ref={invoiceRef} date="09 May 2026" />
        <div className="bg-white rounded-2xl border border-[#99c5ff]/20 shadow-sm p-5 flex items-center justify-between">
          <div>
            <div className="text-sm font-bold text-[#010a4f]">Total: £{total.toFixed(2)} inc. VAT</div>
            <div className="text-xs text-gray-400 mt-0.5">Britannia FM accounts team will receive this immediately</div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setStage('select')}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-gray-500 border border-gray-200 hover:border-gray-300 transition-colors">
              Edit
            </button>
            <button onClick={() => setStage('done')}
              className="px-5 py-2.5 rounded-xl text-sm font-black text-white transition-all hover:brightness-110"
              style={{ background: ORANGE }}>
              Submit to Britannia FM →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Done ──────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-lg space-y-5 pb-8">
      <div className="bg-white rounded-2xl border border-[#99c5ff]/20 shadow-sm p-8 text-center space-y-5">
        <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto">
          <CheckCircle2 size={32} className="text-emerald-500" />
        </div>
        <div>
          <h2 className="font-black text-xl text-[#010a4f]">Invoice submitted</h2>
          <p className="text-sm text-gray-500 mt-1">Dropped into Britannia FM's accounts queue · <span className="font-bold text-[#010a4f]">{invoiceRef}</span></p>
        </div>
        <div className="grid grid-cols-2 gap-3 text-left">
          {[
            { label: 'Reference',     value: invoiceRef    },
            { label: 'Submitted to',  value: 'Britannia FM' },
            { label: 'Amount',        value: `£${(chosenJobs.reduce((s,j)=>s+j.value,0)||248) * 1.2 |0} inc. VAT` },
            { label: 'Expected pay',  value: '09 Jun 2026'  },
            { label: 'Status',        value: 'Pending approval' },
            { label: 'Format',        value: 'Cadi PDF ✓'   },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl bg-[#f8faff] p-3">
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">{label}</div>
              <div className="text-sm font-bold text-[#010a4f]">{value}</div>
            </div>
          ))}
        </div>
        <div className="px-4 py-3 rounded-xl text-xs text-emerald-700 text-left"
          style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)' }}>
          <div className="font-bold mb-0.5 flex items-center gap-1.5"><Shield size={11} /> Submitted directly to accounts</div>
          No email needed. Your invoice is in Britannia FM's accounts queue right now, formatted and ready for approval.
        </div>
        <button onClick={() => { setStage('method'); setSelected([]); setUploadDone(false); setProcessStep(0); }}
          className="text-xs text-[#4f78ff] font-bold hover:underline">
          Submit another invoice →
        </button>
      </div>
    </div>
  );
}
