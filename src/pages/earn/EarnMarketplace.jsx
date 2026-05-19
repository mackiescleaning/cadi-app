import { useState } from 'react';
import { Search } from 'lucide-react';

const EARN_ORANGE = '#C2410C';

const SERVICE_COLOUR = {
  'Daily clean':    { bg: 'rgba(79,120,255,0.1)',  border: 'rgba(79,120,255,0.25)',  text: '#1d4ed8' },
  'Evening clean':  { bg: 'rgba(99,102,241,0.1)',  border: 'rgba(99,102,241,0.25)', text: '#4338ca' },
  'Deep clean':     { bg: 'rgba(139,92,246,0.1)', border: 'rgba(139,92,246,0.25)', text: '#7c3aed' },
  'Hospital clean': { bg: 'rgba(239,68,68,0.1)',  border: 'rgba(239,68,68,0.25)',  text: '#dc2626' },
  'Morning clean':  { bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.25)', text: '#059669' },
  'Office clean':   { bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.25)', text: '#d97706' },
};

const JOBS = [
  {
    id: 'j1', site: 'Premier Inn Luton Airport',    postcode: 'MK42', fm: 'Britannia FM',
    service: 'Daily clean',    freq: 'Recurring',  schedule: 'Mon–Fri',  window: '06:00–08:00',
    value: 85, valueFreq: '/visit', monthlyEst: 1700, matchScore: 94,
    matchReasons: ['Location match', 'Service match', 'Score threshold met'],
    deadline: 'Today 17:00', slaReq: '06:00–08:00', photosReq: true,
    action: 'accept',
  },
  {
    id: 'j2', site: 'Luton Central Library',         postcode: 'LU1',  fm: 'Britannia FM',
    service: 'Evening clean',  freq: 'Recurring',  schedule: 'Mon–Fri',  window: '18:00–20:00',
    value: 68, valueFreq: '/visit', monthlyEst: 1360, matchScore: 88,
    matchReasons: ['Service match', 'Score threshold met'],
    deadline: 'Tomorrow 12:00', slaReq: '18:00–20:00', photosReq: true,
    action: 'accept',
  },
  {
    id: 'j3', site: 'Next – Centre:MK',      postcode: 'MK41', fm: 'Metro Clean',
    service: 'Daily clean',    freq: 'Recurring',  schedule: 'Mon–Fri',  window: '06:30–08:30',
    value: 92, valueFreq: '/visit', monthlyEst: 1840, matchScore: 82,
    matchReasons: ['Location match', 'Service match'],
    deadline: 'Fri 16:00', slaReq: '06:30–08:30', photosReq: true,
    action: 'apply',
  },
  {
    id: 'j4', site: 'MK City Council Offices', postcode: 'MK9', fm: 'Compass FM',
    service: 'Deep clean',     freq: 'One-off',    schedule: 'Sat 17 May', window: '08:00–12:00',
    value: 380, valueFreq: '',  monthlyEst: null, matchScore: 76,
    matchReasons: ['Service match'],
    deadline: 'Wed 12:00', slaReq: '08:00–12:00', photosReq: true,
    action: 'apply',
  },
  {
    id: 'j5', site: 'Tesco Express',           postcode: 'MK40', fm: 'Spotless Networks',
    service: 'Morning clean',  freq: 'Recurring',  schedule: 'Daily',    window: '05:30–07:00',
    value: 55, valueFreq: '/visit', monthlyEst: 1650, matchScore: 71,
    matchReasons: ['Location match'],
    deadline: 'Mon 09:00', slaReq: '05:30–07:00', photosReq: false,
    action: 'apply',
  },
  {
    id: 'j6', site: 'L&D Hospital – Main Tower',     postcode: 'LU2',  fm: 'Britannia FM',
    service: 'Hospital clean', freq: 'Recurring',  schedule: 'Mon–Sat',  window: '06:00–09:00',
    value: 110, valueFreq: '/visit', monthlyEst: 2420, matchScore: 65,
    matchReasons: ['Service match'],
    deadline: 'Next Mon', slaReq: '06:00–09:00 strict', photosReq: true,
    action: 'apply',
  },
];

function ScoreBar({ score }) {
  const color = score >= 90 ? '#10b981' : score >= 80 ? '#3b82f6' : score >= 70 ? '#f59e0b' : '#9ca3af';
  return (
    <div className="flex items-center gap-2">
      <div className="w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-black shrink-0" style={{ borderColor: color, color }}>
        {score}
      </div>
      <div className="text-[10px] font-bold" style={{ color }}>
        {score >= 90 ? 'Excellent match' : score >= 80 ? 'Strong match' : score >= 70 ? 'Good match' : 'Partial match'}
      </div>
    </div>
  );
}

export default function EarnMarketplace() {
  const [filter,   setFilter]   = useState('all');
  const [search,   setSearch]   = useState('');
  const [applied,  setApplied]  = useState({});

  const filtered = JOBS.filter(j => {
    const matchFilter = filter === 'all' || (filter === 'recurring' ? j.freq === 'Recurring' : j.freq === 'One-off');
    const matchSearch = !search || j.site.toLowerCase().includes(search.toLowerCase()) || j.postcode.toLowerCase().includes(search.toLowerCase()) || j.service.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  return (
    <div className="max-w-3xl space-y-5 pb-8">

      {/* Header */}
      <div>
        <h1 className="text-xl font-black text-[#010a4f]">Marketplace</h1>
        <p className="text-sm text-gray-500 mt-0.5">Jobs matched to your Cadi score and location — accept or apply directly.</p>
      </div>

      {/* Search + filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Search by site, postcode or service…"
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm border border-[#99c5ff]/30 focus:outline-none focus:border-[#4f78ff] bg-white" />
        </div>
        <div className="flex items-center gap-2">
          {[['all', 'All jobs'], ['recurring', 'Recurring'], ['one-off', 'One-off']].map(([v, l]) => (
            <button key={v} onClick={() => setFilter(v)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                filter === v ? 'text-white' : 'bg-white border border-[#99c5ff]/30 text-gray-600 hover:border-gray-300'
              }`}
              style={filter === v ? { background: EARN_ORANGE } : {}}>
              {l}
            </button>
          ))}
          <span className="ml-auto text-xs text-gray-400">{filtered.length} jobs matched to you</span>
        </div>
      </div>

      {/* Job cards */}
      <div className="space-y-3">
        {filtered.map(job => {
          const sc = SERVICE_COLOUR[job.service] || SERVICE_COLOUR['Daily clean'];
          const done = applied[job.id];
          return (
            <div key={job.id}
              className="bg-white rounded-2xl border border-[#99c5ff]/20 shadow-sm p-5 space-y-4"
              style={done ? { opacity: 0.6 } : {}}>

              {/* Top row */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-bold text-[#010a4f] text-sm">{job.site}</span>
                    <span className="text-xs text-gray-400">{job.postcode}</span>
                    <span className="text-[9px] font-black px-2 py-0.5 rounded-full"
                      style={{ background: job.freq === 'Recurring' ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)', color: job.freq === 'Recurring' ? '#059669' : '#d97706', border: '1px solid ' + (job.freq === 'Recurring' ? 'rgba(16,185,129,0.25)' : 'rgba(245,158,11,0.25)') }}>
                      {job.freq}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: sc.bg, border: `1px solid ${sc.border}`, color: sc.text }}>
                      {job.service}
                    </span>
                    <span className="text-xs text-gray-400">{job.fm}</span>
                  </div>
                </div>
                <ScoreBar score={job.matchScore} />
              </div>

              {/* Details row */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-[#f8faff] p-3">
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Schedule</div>
                  <div className="text-sm font-bold text-[#010a4f]">{job.schedule}</div>
                  <div className="text-[10px] text-gray-500">{job.window}</div>
                </div>
                <div className="rounded-xl bg-[#f8faff] p-3">
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Value</div>
                  <div className="text-sm font-black text-[#010a4f]">£{job.value}{job.valueFreq}</div>
                  {job.monthlyEst && <div className="text-[10px] text-gray-500">~£{job.monthlyEst.toLocaleString()}/mo</div>}
                </div>
                <div className="rounded-xl bg-[#f8faff] p-3">
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Deadline</div>
                  <div className="text-sm font-bold text-[#010a4f]">{job.deadline}</div>
                  <div className="text-[10px] text-gray-500">SLA: {job.slaReq}</div>
                </div>
              </div>

              {/* Match reasons */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] text-gray-400">Why you're seeing this:</span>
                {job.matchReasons.map(r => (
                  <span key={r} className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#f0f4ff] text-[#4f78ff]">{r}</span>
                ))}
              </div>

              {/* Action */}
              <div className="flex items-center gap-3">
                {done ? (
                  <div className="flex items-center gap-2 text-sm font-bold"
                    style={{ color: done === 'apply' ? EARN_ORANGE : '#10b981' }}>
                    <span>✓</span>
                    {done === 'apply' ? 'Application sent' : 'Accepted — check your pipeline'}
                  </div>
                ) : (
                  <button
                    onClick={() => setApplied(p => ({ ...p, [job.id]: job.action }))}
                    className="px-6 py-2.5 rounded-xl text-sm font-black text-white transition-all hover:brightness-110"
                    style={{ background: EARN_ORANGE }}>
                    {job.action === 'accept' ? 'Accept job →' : 'Apply →'}
                  </button>
                )}
                <button className="text-xs text-gray-400 hover:text-gray-600 transition-colors">View full details</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
