import { useState } from 'react';

const EARN_ORANGE = '#C2410C';

const PERIOD_DATA = {
  month: {
    label: 'May 2026',
    earned: 595,
    pending: 460,
    forecast: 1055,
    breakdown: [
      { fm: 'Britannia FM', jobs: 7, value: 595, status: 'paid',           color: '#10b981' },
      { fm: 'Britannia FM', jobs: 4, value: 340, status: 'pending-review', color: '#f59e0b' },
      { fm: 'Metro Clean',  jobs: 1, value: 120, status: 'pending-pay',    color: '#f59e0b' },
    ],
    payments: [
      { date: '07 May 2026', fm: 'Britannia FM', jobs: 5,  amount: 425, ref: '#BF-PAY-0512', status: 'paid' },
      { date: '30 Apr 2026', fm: 'Britannia FM', jobs: 2,  amount: 170, ref: '#BF-PAY-0490', status: 'paid' },
      { date: 'Pending',     fm: 'Britannia FM', jobs: 4,  amount: 340, ref: '—',             status: 'pending' },
      { date: 'Pending',     fm: 'Metro Clean',  jobs: 1,  amount: 120, ref: '—',             status: 'pending' },
    ],
  },
  quarter: {
    label: 'Q2 2026 (Apr–Jun)',
    earned: 1780,
    pending: 460,
    forecast: 3200,
    breakdown: [
      { fm: 'Britannia FM', jobs: 28, value: 1660, status: 'paid',           color: '#10b981' },
      { fm: 'Metro Clean',  jobs: 1,  value: 120,  status: 'pending-pay',    color: '#f59e0b' },
      { fm: 'Britannia FM', jobs: 4,  value: 340,  status: 'pending-review', color: '#f59e0b' },
    ],
    payments: [
      { date: '07 May 2026', fm: 'Britannia FM', jobs: 5,  amount: 425, ref: '#BF-PAY-0512', status: 'paid' },
      { date: '30 Apr 2026', fm: 'Britannia FM', jobs: 8,  amount: 720, ref: '#BF-PAY-0490', status: 'paid' },
      { date: '15 Apr 2026', fm: 'Britannia FM', jobs: 6,  amount: 515, ref: '#BF-PAY-0481', status: 'paid' },
      { date: 'Pending',     fm: 'Britannia FM', jobs: 4,  amount: 340, ref: '—',             status: 'pending' },
      { date: 'Pending',     fm: 'Metro Clean',  jobs: 1,  amount: 120, ref: '—',             status: 'pending' },
    ],
  },
  year: {
    label: '2026 YTD',
    earned: 4680,
    pending: 460,
    forecast: 13800,
    breakdown: [
      { fm: 'Britannia FM', jobs: 62, value: 4560, status: 'paid',           color: '#10b981' },
      { fm: 'Metro Clean',  jobs: 1,  value: 120,  status: 'pending-pay',    color: '#f59e0b' },
      { fm: 'Britannia FM', jobs: 4,  value: 340,  status: 'pending-review', color: '#f59e0b' },
    ],
    payments: [],
  },
};

const PAYMENT_STATUS = {
  paid:           { label: 'Paid',           color: '#10b981', bg: 'rgba(16,185,129,0.08)',  border: 'rgba(16,185,129,0.2)' },
  'pending-review':{ label: 'FM reviewing',  color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)' },
  'pending-pay':  { label: 'Awaiting payment', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)' },
  pending:        { label: 'Pending',        color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)' },
};

export default function EarnEarnings() {
  const [period, setPeriod] = useState('month');
  const data = PERIOD_DATA[period];

  return (
    <div className="max-w-2xl space-y-5 pb-8">

      {/* Header */}
      <div>
        <h1 className="text-xl font-black text-[#010a4f]">Earnings</h1>
        <p className="text-sm text-gray-500 mt-0.5">FM payments tracked separately from your Money tab — confirmed, pending, and forecast.</p>
      </div>

      {/* Period selector */}
      <div className="flex items-center gap-2">
        {[['month', 'This month'], ['quarter', 'This quarter'], ['year', 'YTD']].map(([v, l]) => (
          <button key={v} onClick={() => setPeriod(v)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              period === v ? 'text-white' : 'bg-white border border-[#99c5ff]/30 text-gray-600 hover:border-gray-300'
            }`}
            style={period === v ? { background: EARN_ORANGE } : {}}>
            {l}
          </button>
        ))}
        <span className="ml-auto text-xs font-bold text-gray-400">{data.label}</span>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl border border-[#99c5ff]/20 shadow-sm p-5">
          <div className="text-2xl font-black text-emerald-600">£{data.earned.toLocaleString()}</div>
          <div className="text-xs font-bold text-[#010a4f] mt-1">Earned</div>
          <div className="text-[10px] text-gray-400 mt-0.5">Confirmed & paid</div>
        </div>
        <div className="bg-white rounded-2xl border border-[#99c5ff]/20 shadow-sm p-5">
          <div className="text-2xl font-black text-amber-500">£{data.pending.toLocaleString()}</div>
          <div className="text-xs font-bold text-[#010a4f] mt-1">Pending</div>
          <div className="text-[10px] text-gray-400 mt-0.5">Awaiting FM sign-off</div>
        </div>
        <div className="bg-white rounded-2xl border border-[#99c5ff]/20 shadow-sm p-5">
          <div className="text-2xl font-black" style={{ color: EARN_ORANGE }}>£{data.forecast.toLocaleString()}</div>
          <div className="text-xs font-bold text-[#010a4f] mt-1">Forecast</div>
          <div className="text-[10px] text-gray-400 mt-0.5">Based on accepted jobs</div>
        </div>
      </div>

      {/* FM breakdown */}
      <div className="bg-white rounded-2xl border border-[#99c5ff]/20 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50">
          <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">Breakdown by FM</div>
        </div>
        <div className="divide-y divide-gray-50">
          {data.breakdown.map((row, i) => {
            const pst = PAYMENT_STATUS[row.status];
            return (
              <div key={i} className="px-5 py-4 flex items-center gap-4">
                <div className="flex-1">
                  <div className="text-sm font-bold text-[#010a4f]">{row.fm}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{row.jobs} {row.jobs === 1 ? 'job' : 'jobs'}</div>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: pst.bg, border: `1px solid ${pst.border}`, color: pst.color }}>
                  {pst.label}
                </span>
                <div className="text-sm font-black text-[#010a4f] w-14 text-right">£{row.value.toLocaleString()}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Payment ledger */}
      {data.payments.length > 0 && (
        <div className="bg-white rounded-2xl border border-[#99c5ff]/20 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50">
            <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">Payment ledger</div>
          </div>
          <div className="divide-y divide-gray-50">
            {data.payments.map((pay, i) => {
              const pst = PAYMENT_STATUS[pay.status];
              return (
                <div key={i} className="px-5 py-3.5 flex items-center gap-4">
                  <div className="flex-1">
                    <div className="text-sm font-bold text-[#010a4f]">{pay.fm}</div>
                    <div className="text-xs text-gray-400">{pay.date} · {pay.jobs} jobs · {pay.ref}</div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
                    style={{ background: pst.bg, border: `1px solid ${pst.border}`, color: pst.color }}>
                    {pst.label}
                  </span>
                  <div className="text-sm font-black text-[#010a4f] w-14 text-right">£{pay.amount.toLocaleString()}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Note */}
      <div className="rounded-xl bg-[#f8faff] border border-[#99c5ff]/20 px-4 py-3 text-xs text-gray-500">
        <span className="font-bold text-[#010a4f]">Note:</span> FM payments are made directly to you — Cadi tracks status but does not process payments.
        Payment terms vary by FM (typically Net 14–30). Contact your FM for disputes.
      </div>
    </div>
  );
}
