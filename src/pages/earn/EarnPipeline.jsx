import { useState } from 'react';

const EARN_ORANGE = '#C2410C';

const STATUS_CONFIG = {
  'in-progress':         { label: 'On site now',       color: '#3b82f6', bg: 'rgba(59,130,246,0.08)',  border: 'rgba(59,130,246,0.25)'  },
  'awaiting-evidence':   { label: 'Upload evidence',   color: EARN_ORANGE, bg: 'rgba(194,65,12,0.08)', border: 'rgba(194,65,12,0.25)'   },
  'pending-review':      { label: 'Pending FM review', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.25)'  },
  'upcoming':            { label: 'Upcoming',          color: '#6366f1', bg: 'rgba(99,102,241,0.08)', border: 'rgba(99,102,241,0.25)'  },
  'paid':                { label: 'Paid',              color: '#10b981', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.25)'  },
};

const PIPELINE = [
  { id: 'p1', status: 'in-progress',       site: 'Next – Luton The Mall',   postcode: 'MK41', fm: 'Britannia FM',       service: 'Morning clean',  date: 'Today',      time: '06:58–',       value: 85,  evidenceCount: 6  },
  { id: 'p2', status: 'awaiting-evidence', site: 'Premier Inn Luton Airport',   postcode: 'MK42', fm: 'Britannia FM',       service: 'Morning clean',  date: '08 May',     time: '07:15–07:58',  value: 78,  evidenceCount: 0  },
  { id: 'p3', status: 'pending-review',    site: 'Aylesbury College',   postcode: 'HP20', fm: 'Metro Clean',        service: 'Evening clean',  date: '08 May',     time: '18:30–20:15',  value: 120, evidenceCount: 11 },
  { id: 'p4', status: 'pending-review',    site: 'Central Beds Council HQ',        postcode: 'MK9',  fm: 'Britannia FM',       service: 'Office clean',   date: '07 May',     time: '07:00–08:45',  value: 95,  evidenceCount: 8  },
  { id: 'p5', status: 'upcoming',          site: 'Next – Luton The Mall',   postcode: 'MK41', fm: 'Britannia FM',       service: 'Morning clean',  date: 'Sat 10 May', time: '06:00–08:00',  value: 85,  evidenceCount: 0  },
  { id: 'p6', status: 'upcoming',          site: 'Luton Central Library',       postcode: 'LU1',  fm: 'Britannia FM',       service: 'Evening clean',  date: 'Mon 12 May', time: '18:00–20:00',  value: 68,  evidenceCount: 0  },
  { id: 'p7', status: 'paid',              site: 'Next – Luton The Mall',   postcode: 'MK41', fm: 'Britannia FM',       service: 'Morning clean',  date: '05–08 May',  time: '4 jobs',       value: 340, evidenceCount: 47 },
  { id: 'p8', status: 'paid',              site: 'Premier Inn Luton Airport',   postcode: 'MK42', fm: 'Britannia FM',       service: 'Morning clean',  date: '05–07 May',  time: '3 jobs',       value: 234, evidenceCount: 30 },
];

const STATUS_ORDER = ['in-progress', 'awaiting-evidence', 'pending-review', 'upcoming', 'paid'];

export default function EarnPipeline() {
  const [expanded, setExpanded] = useState({ 'in-progress': true, 'awaiting-evidence': true, 'pending-review': true, upcoming: true, paid: false });

  const grouped = STATUS_ORDER.map(status => ({
    status,
    jobs: PIPELINE.filter(j => j.status === status),
  }));

  const pendingValue = PIPELINE.filter(j => ['in-progress', 'awaiting-evidence', 'pending-review'].includes(j.status)).reduce((s, j) => s + j.value, 0);

  return (
    <div className="max-w-2xl space-y-5 pb-8">

      {/* Header */}
      <div>
        <h1 className="text-xl font-black text-[#010a4f]">Job Pipeline</h1>
        <p className="text-sm text-gray-500 mt-0.5">Your live pipeline — from accepted to paid. Each stage has a required action.</p>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'In progress',   value: PIPELINE.filter(j => j.status === 'in-progress').length,         color: '#3b82f6' },
          { label: 'Action needed', value: PIPELINE.filter(j => j.status === 'awaiting-evidence').length,   color: EARN_ORANGE },
          { label: 'Pending payment', value: `£${pendingValue}`,                                            color: '#f59e0b' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-[#99c5ff]/20 shadow-sm p-4 text-center">
            <div className="text-2xl font-black" style={{ color }}>{value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Grouped stages */}
      {grouped.map(({ status, jobs }) => {
        if (!jobs.length) return null;
        const cfg = STATUS_CONFIG[status];
        const isOpen = expanded[status];
        return (
          <div key={status} className="bg-white rounded-2xl border border-[#99c5ff]/20 shadow-sm overflow-hidden">
            <button
              onClick={() => setExpanded(p => ({ ...p, [status]: !p[status] }))}
              className="w-full px-5 py-4 flex items-center gap-3 text-left hover:bg-gray-50 transition-colors">
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cfg.color }} />
              <span className="flex-1 text-sm font-bold text-[#010a4f]">{cfg.label}</span>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color }}>
                {jobs.length} {jobs.length === 1 ? 'job' : 'jobs'}
              </span>
              <svg className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {isOpen && (
              <div className="divide-y divide-gray-50">
                {jobs.map(job => (
                  <div key={job.id} className="px-5 py-4 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-[#010a4f] truncate">{job.site}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{job.fm} · {job.service} · {job.date}</div>
                      <div className="text-xs text-gray-400">{job.time}{job.evidenceCount > 0 ? ` · ${job.evidenceCount} photos` : ''}</div>
                    </div>
                    <div className="text-sm font-black text-[#010a4f] shrink-0">£{job.value}</div>
                    {status === 'awaiting-evidence' && (
                      <button className="px-3 py-1.5 rounded-xl text-xs font-black text-white shrink-0 transition-all hover:brightness-110"
                        style={{ background: EARN_ORANGE }}>
                        Upload →
                      </button>
                    )}
                    {status === 'in-progress' && (
                      <div className="flex items-center gap-1.5 text-xs font-bold text-blue-600 shrink-0">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                        Live
                      </div>
                    )}
                    {status === 'paid' && <span className="text-emerald-500 shrink-0 text-lg">✓</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
