import { useState } from 'react';

const MONTHS = ['May 2026', 'Apr 2026', 'Mar 2026', 'Feb 2026'];

const REPORT_DATA = {
  'May 2026': {
    sla: 99, jobs: 68, photos: 312, issues: { raised: 1, resolved: 1 },
    sites: [
      { name: 'Next – Luton The Mall',  jobs: 22, sla: 100 },
      { name: 'Next – Centre:MK',       jobs: 22, sla: 100 },
      { name: 'Next – Watford Atria',   jobs: 24, sla: 97  },
    ],
    weeks: [
      { label: 'w/c 28 Apr', jobs: 5,  sla: 100 },
      { label: 'w/c 5 May',  jobs: 5,  sla: 100, partial: true },
    ],
  },
  'Apr 2026': {
    sla: 98, jobs: 65, photos: 289, issues: { raised: 1, resolved: 1 },
    sites: [
      { name: 'Next – Luton The Mall',  jobs: 21, sla: 95  },
      { name: 'Next – Centre:MK',       jobs: 22, sla: 100 },
      { name: 'Next – Watford Atria',   jobs: 22, sla: 100 },
    ],
    weeks: [
      { label: 'w/c 31 Mar', jobs: 5, sla: 100 },
      { label: 'w/c 7 Apr',  jobs: 5, sla: 100 },
      { label: 'w/c 14 Apr', jobs: 5, sla: 100 },
      { label: 'w/c 22 Apr', jobs: 5, sla: 80  },
      { label: 'w/c 28 Apr', jobs: 2, sla: 100 },
    ],
  },
  'Mar 2026': {
    sla: 100, jobs: 72, photos: 338, issues: { raised: 0, resolved: 0 },
    sites: [
      { name: 'Next – Luton The Mall',  jobs: 24, sla: 100 },
      { name: 'Next – Centre:MK',       jobs: 24, sla: 100 },
      { name: 'Next – Watford Atria',   jobs: 24, sla: 100 },
    ],
    weeks: [
      { label: 'w/c 3 Mar',  jobs: 5, sla: 100 },
      { label: 'w/c 10 Mar', jobs: 5, sla: 100 },
      { label: 'w/c 17 Mar', jobs: 5, sla: 100 },
      { label: 'w/c 24 Mar', jobs: 5, sla: 100 },
      { label: 'w/c 31 Mar', jobs: 2, sla: 100 },
    ],
  },
  'Feb 2026': {
    sla: 99, jobs: 60, photos: 274, issues: { raised: 1, resolved: 1 },
    sites: [
      { name: 'Next – Luton The Mall',  jobs: 20, sla: 100 },
      { name: 'Next – Centre:MK',       jobs: 20, sla: 100 },
      { name: 'Next – Watford Atria',   jobs: 20, sla: 97  },
    ],
    weeks: [
      { label: 'w/c 3 Feb',  jobs: 5, sla: 100 },
      { label: 'w/c 10 Feb', jobs: 5, sla: 100 },
      { label: 'w/c 17 Feb', jobs: 5, sla: 95  },
      { label: 'w/c 24 Feb', jobs: 4, sla: 100 },
    ],
  },
};

function SlaBar({ value, prev }) {
  const diff = prev != null ? value - prev : null;
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-2xl font-black text-[#010a4f]">{value}%</span>
        {diff != null && (
          <span className={`text-xs font-bold ${diff >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {diff >= 0 ? `+${diff}%` : `${diff}%`} vs prev month
          </span>
        )}
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2.5">
        <div className="h-2.5 rounded-full transition-all"
          style={{ width: `${value}%`, background: value >= 98 ? '#10b981' : value >= 95 ? '#f59e0b' : '#ef4444' }} />
      </div>
    </div>
  );
}

export default function ClientReports({ showToast }) {
  const [month, setMonth] = useState('May 2026');
  const data  = REPORT_DATA[month];
  const monthIdx = MONTHS.indexOf(month);
  const prevData = monthIdx < MONTHS.length - 1 ? REPORT_DATA[MONTHS[monthIdx + 1]] : null;

  return (
    <div className="p-6 space-y-6 max-w-3xl">

      {/* Month selector */}
      <div className="flex items-center gap-3">
        <div className="text-xs font-black uppercase tracking-widest text-gray-400 mr-2">Report period</div>
        {MONTHS.map(m => (
          <button key={m} onClick={() => setMonth(m)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              month === m ? 'bg-[#010a4f] text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
            }`}>
            {m}
          </button>
        ))}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Jobs completed', value: data.jobs,   prev: prevData?.jobs,   suffix: '',   icon: '✅', color: '#010a4f' },
          { label: 'SLA hit rate',   value: data.sla,    prev: prevData?.sla,    suffix: '%',  icon: '📈', color: data.sla >= 98 ? '#10b981' : '#f59e0b' },
          { label: 'Photos uploaded',value: data.photos, prev: prevData?.photos, suffix: '',   icon: '📸', color: '#010a4f' },
          { label: 'Issues raised',  value: data.issues.raised, prev: null, suffix: '',        icon: data.issues.raised === 0 ? '🟢' : '⚠️', color: data.issues.raised === 0 ? '#10b981' : '#f59e0b' },
        ].map(({ label, value, prev, suffix, icon, color }) => {
          const diff = prev != null ? value - prev : null;
          return (
            <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="text-xl mb-2">{icon}</div>
              <div className="text-2xl font-black" style={{ color }}>{value}{suffix}</div>
              <div className="text-xs font-bold text-[#010a4f] mt-0.5">{label}</div>
              {diff != null && (
                <div className={`text-[10px] font-bold mt-1 ${diff > 0 ? 'text-emerald-600' : diff < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                  {diff > 0 ? `+${diff}` : diff < 0 ? `${diff}` : '='} vs last month
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* SLA rate detail */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="text-xs font-black uppercase tracking-widest text-gray-400 mb-4">SLA performance — {month}</div>
        <SlaBar value={data.sla} prev={prevData?.sla} />
        {data.issues.raised > 0 && (
          <div className="mt-3 flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
            <span>⚠️</span>
            <span>{data.issues.raised} exception recorded this month — {data.issues.resolved === data.issues.raised ? 'resolved and closed' : `${data.issues.resolved} resolved`}</span>
          </div>
        )}
        {data.issues.raised === 0 && (
          <div className="mt-3 flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
            <span>✓</span>
            <span>No exceptions or SLA breaches this month</span>
          </div>
        )}
      </div>

      {/* Per-site breakdown */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50">
          <div className="text-xs font-black uppercase tracking-widest text-gray-400">Per-site breakdown</div>
        </div>
        <div className="divide-y divide-gray-50">
          {data.sites.map(({ name, jobs, sla }) => (
            <div key={name} className="px-5 py-3.5 flex items-center gap-4">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: sla === 100 ? '#10b981' : sla >= 95 ? '#f59e0b' : '#ef4444' }} />
              <div className="flex-1 text-sm font-medium text-[#010a4f]">{name}</div>
              <div className="text-sm text-gray-500">{jobs} jobs</div>
              <div className="w-28">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold" style={{ color: sla === 100 ? '#10b981' : '#f59e0b' }}>{sla}% SLA</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-1.5">
                  <div className="h-1.5 rounded-full" style={{ width: `${sla}%`, backgroundColor: sla === 100 ? '#10b981' : '#f59e0b' }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Weekly jobs (current site) */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="text-xs font-black uppercase tracking-widest text-gray-400 mb-4">Next – Luton The Mall — weekly jobs</div>
        <div className="space-y-2">
          {data.weeks.map(({ label, jobs, sla, partial }) => (
            <div key={label} className="flex items-center gap-3">
              <div className="w-20 text-xs text-gray-500 shrink-0">{label}</div>
              <div className="flex-1 bg-gray-100 rounded-full h-2 relative">
                <div className="h-2 rounded-full transition-all"
                  style={{
                    width: partial ? `${(4 / 5) * 100}%` : '100%',
                    background: sla === 100 ? '#10b981' : '#f59e0b',
                    opacity: partial ? 0.5 : 1,
                  }} />
              </div>
              <div className="text-xs font-bold w-12 text-right" style={{ color: sla === 100 ? '#10b981' : '#f59e0b' }}>
                {partial ? '4 / 5' : `${jobs} / ${jobs}`}
              </div>
              {sla < 100 && <span className="text-[10px] text-amber-600 font-bold">↓ SLA note</span>}
              {partial && <span className="text-[10px] text-gray-400">in progress</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Export */}
      <div className="bg-[#f8faff] rounded-2xl border border-[#99c5ff]/20 p-5 flex items-center gap-5">
        <div className="flex-1">
          <div className="font-bold text-[#010a4f]">Monthly performance report</div>
          <div className="text-xs text-gray-400 mt-0.5">Branded Britannia FM report · PDF or shareable link</div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => showToast(`download ${month} PDF report`)}
            className="px-5 py-2.5 rounded-xl bg-[#010a4f] text-white text-xs font-bold hover:bg-[#1f48ff] transition-colors">
            Download PDF
          </button>
          <button onClick={() => showToast(`copy shareable report link for ${month}`)}
            className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-xs font-bold hover:border-gray-300 transition-colors bg-white">
            Share link
          </button>
        </div>
      </div>
    </div>
  );
}
