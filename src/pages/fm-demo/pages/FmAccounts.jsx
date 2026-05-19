import { useState } from 'react';
import { CheckCircle2, XCircle, Clock, FileText, ChevronDown, ChevronUp, Download, AlertTriangle } from 'lucide-react';

const INVOICES = [
  {
    id: 'INV-0041',
    cleaner: 'Sarah K.',
    utr: '12345 67890',
    submitted: '16 May 2026',
    period: '1–15 May 2026',
    jobs: [
      { date: '15 May', site: 'Next – Luton The Mall',     service: 'Retail morning clean', value: 85 },
      { date: '14 May', site: 'Premier Inn Luton Airport', service: 'Morning clean',         value: 78 },
      { date: '13 May', site: 'Next – Luton The Mall',     service: 'Retail morning clean', value: 85 },
      { date: '12 May', site: 'Next – Luton The Mall',     service: 'Retail morning clean', value: 85 },
      { date: '09 May', site: 'Aylesbury College',         service: 'Evening clean',         value: 120 },
    ],
    status: 'pending',
  },
  {
    id: 'INV-0040',
    cleaner: 'Marcus T.',
    utr: '98765 43210',
    submitted: '15 May 2026',
    period: '1–14 May 2026',
    jobs: [
      { date: '14 May', site: 'Luton & Dunstable Hospital', service: 'Daily hospital clean',  value: 140 },
      { date: '13 May', site: 'Luton & Dunstable Hospital', service: 'Daily hospital clean',  value: 140 },
      { date: '12 May', site: 'Luton & Dunstable Hospital', service: 'Daily hospital clean',  value: 140 },
    ],
    status: 'pending',
  },
  {
    id: 'INV-0039',
    cleaner: 'Priya N.',
    utr: '55544 33221',
    submitted: '10 May 2026',
    period: '1–9 May 2026',
    jobs: [
      { date: '09 May', site: 'Barnfield College',       service: 'School morning clean',  value: 95 },
      { date: '08 May', site: 'Barnfield College',       service: 'School morning clean',  value: 95 },
      { date: '07 May', site: 'Barnfield College',       service: 'School morning clean',  value: 95 },
      { date: '06 May', site: 'Office Park – Block A',   service: 'Office clean',           value: 68 },
    ],
    status: 'approved',
  },
  {
    id: 'INV-0038',
    cleaner: 'James O.',
    utr: '11223 44556',
    submitted: '02 May 2026',
    period: '21–30 Apr 2026',
    jobs: [
      { date: '30 Apr', site: 'Premier Inn Luton Airport', service: 'Morning clean',  value: 78 },
      { date: '29 Apr', site: 'Premier Inn Luton Airport', service: 'Morning clean',  value: 78 },
    ],
    status: 'rejected',
    rejectReason: 'Job on 29 Apr not verified — no site sign-off uploaded.',
  },
];

const STATUS = {
  pending:  { label: 'Awaiting approval', color: '#fbbf24', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.3)',  icon: Clock         },
  approved: { label: 'Approved',          color: '#34d399', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)', icon: CheckCircle2  },
  rejected: { label: 'Rejected',          color: '#f87171', bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.3)',  icon: XCircle       },
};

const VAT_RATE = 0.20;

function subtotal(jobs) { return jobs.reduce((s, j) => s + j.value, 0); }
function vat(jobs)      { return Math.round(subtotal(jobs) * VAT_RATE * 100) / 100; }
function total(jobs)    { return subtotal(jobs) + vat(jobs); }

function fmt(n) { return `£${n.toFixed(2)}`; }

export default function FmAccounts() {
  const [invoices, setInvoices] = useState(INVOICES);
  const [expanded, setExpanded] = useState(null);
  const [filter, setFilter]     = useState('all');

  function approve(id) {
    setInvoices(prev => prev.map(inv => inv.id === id ? { ...inv, status: 'approved' } : inv));
  }
  function reject(id) {
    const reason = prompt('Reason for rejection:');
    if (!reason) return;
    setInvoices(prev => prev.map(inv => inv.id === id ? { ...inv, status: 'rejected', rejectReason: reason } : inv));
  }

  const filtered = filter === 'all' ? invoices : invoices.filter(i => i.status === filter);

  const pendingCount  = invoices.filter(i => i.status === 'pending').length;
  const pendingValue  = invoices.filter(i => i.status === 'pending').reduce((s, i) => s + total(i.jobs), 0);
  const approvedValue = invoices.filter(i => i.status === 'approved').reduce((s, i) => s + total(i.jobs), 0);

  return (
    <div className="flex flex-col gap-6 p-6 min-h-full" style={{ background: 'transparent', color: '#e2e8f0' }}>

      {/* Header */}
      <div>
        <h1 className="text-xl font-black text-white tracking-tight">Accounts</h1>
        <p className="text-sm text-white/40 mt-0.5">Cleaner invoices submitted via Cadi Connect</p>
      </div>

      {/* Summary chips */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Awaiting approval', value: pendingCount,         unit: 'invoices', color: '#fbbf24' },
          { label: 'Value pending',     value: fmt(pendingValue),    unit: '',          color: '#fbbf24' },
          { label: 'Approved this month', value: fmt(approvedValue), unit: '',          color: '#34d399' },
        ].map(chip => (
          <div key={chip.label} className="rounded-2xl p-4"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="text-[11px] text-white/40 uppercase tracking-wider font-bold mb-1">{chip.label}</div>
            <div className="text-2xl font-black" style={{ color: chip.color }}>{chip.value}</div>
            {chip.unit && <div className="text-xs text-white/30 mt-0.5">{chip.unit}</div>}
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {['all', 'pending', 'approved', 'rejected'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className="px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all"
            style={filter === f
              ? { background: 'rgba(79,120,255,0.25)', color: '#7da4ff', border: '1px solid rgba(79,120,255,0.4)' }
              : { background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.08)' }
            }>
            {f === 'all' ? `All (${invoices.length})` : f}
            {f === 'pending' && pendingCount > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px]"
                style={{ background: 'rgba(245,158,11,0.25)', color: '#fbbf24' }}>{pendingCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* Invoice list */}
      <div className="flex flex-col gap-3">
        {filtered.map(inv => {
          const st  = STATUS[inv.status];
          const Icon = st.icon;
          const isOpen = expanded === inv.id;

          return (
            <div key={inv.id} className="rounded-2xl overflow-hidden transition-all"
              style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${isOpen ? 'rgba(79,120,255,0.35)' : 'rgba(255,255,255,0.08)'}` }}>

              {/* Row */}
              <button className="w-full flex items-center gap-4 p-4 text-left"
                onClick={() => setExpanded(isOpen ? null : inv.id)}>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-black text-white text-sm">{inv.cleaner}</span>
                    <span className="text-white/30 text-xs font-mono">{inv.id}</span>
                  </div>
                  <div className="text-[11px] text-white/40">{inv.period} · {inv.jobs.length} jobs</div>
                </div>

                <div className="text-right shrink-0">
                  <div className="font-black text-white">{fmt(total(inv.jobs))}</div>
                  <div className="text-[10px] text-white/30 mt-0.5">inc. VAT</div>
                </div>

                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg shrink-0"
                  style={{ background: st.bg, border: `1px solid ${st.border}` }}>
                  <Icon size={11} style={{ color: st.color }} />
                  <span className="text-[11px] font-bold" style={{ color: st.color }}>{st.label}</span>
                </div>

                {isOpen ? <ChevronUp size={14} className="text-white/30 shrink-0" /> : <ChevronDown size={14} className="text-white/30 shrink-0" />}
              </button>

              {/* Expanded detail */}
              {isOpen && (
                <div className="px-4 pb-4 flex flex-col gap-4"
                  style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>

                  {/* Cleaner info */}
                  <div className="pt-3 flex items-center gap-4 text-xs text-white/40">
                    <span>UTR: <span className="text-white/60 font-mono">{inv.utr}</span></span>
                    <span>Submitted: <span className="text-white/60">{inv.submitted}</span></span>
                  </div>

                  {/* Job lines */}
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                        {['Date', 'Site', 'Service', 'Net'].map(h => (
                          <th key={h} className="text-left pb-2 text-white/30 font-bold uppercase tracking-wider text-[10px]">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {inv.jobs.map((job, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          <td className="py-2 text-white/50 font-mono">{job.date}</td>
                          <td className="py-2 text-white/70 pr-3">{job.site}</td>
                          <td className="py-2 text-white/50">{job.service}</td>
                          <td className="py-2 text-white font-bold">{fmt(job.value)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Totals */}
                  <div className="rounded-xl p-3 flex flex-col gap-1 text-xs"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="flex justify-between text-white/40"><span>Subtotal</span><span>{fmt(subtotal(inv.jobs))}</span></div>
                    <div className="flex justify-between text-white/40"><span>VAT (20%)</span><span>{fmt(vat(inv.jobs))}</span></div>
                    <div className="flex justify-between text-white font-black text-sm mt-1 pt-1"
                      style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                      <span>Total</span><span>{fmt(total(inv.jobs))}</span>
                    </div>
                  </div>

                  {/* Rejection reason */}
                  {inv.status === 'rejected' && inv.rejectReason && (
                    <div className="flex items-start gap-2 rounded-xl p-3 text-xs"
                      style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                      <AlertTriangle size={13} className="shrink-0 mt-0.5" style={{ color: '#f87171' }} />
                      <span style={{ color: '#fca5a5' }}>{inv.rejectReason}</span>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2">
                    {inv.status === 'pending' && (
                      <>
                        <button onClick={() => approve(inv.id)}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all"
                          style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399', border: '1px solid rgba(16,185,129,0.35)' }}>
                          <CheckCircle2 size={13} /> Approve
                        </button>
                        <button onClick={() => reject(inv.id)}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all"
                          style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>
                          <XCircle size={13} /> Reject
                        </button>
                      </>
                    )}
                    <button className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold ml-auto transition-all"
                      style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.1)' }}>
                      <Download size={13} /> Download PDF
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center py-12 text-white/20 text-sm">No invoices in this category.</div>
        )}
      </div>
    </div>
  );
}
