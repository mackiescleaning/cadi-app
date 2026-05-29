import { useState } from 'react';
import { Search } from 'lucide-react';

const JOBS = [
  { id: 'h1',  date: '09 May 2026', service: 'Morning clean', status: 'in-progress', time: '06:58–',        photos: 6,  sla: true,  area: 'Full site',   cleaner: 'Your assigned operative' },
  { id: 'h2',  date: '08 May 2026', service: 'Morning clean', status: 'completed',   time: '07:02–07:44',   photos: 14, sla: true,  area: 'Full site',   cleaner: 'Your assigned operative' },
  { id: 'h3',  date: '07 May 2026', service: 'Morning clean', status: 'completed',   time: '06:59–07:51',   photos: 9,  sla: true,  area: 'Full site',   cleaner: 'Your assigned operative' },
  { id: 'h4',  date: '06 May 2026', service: 'Morning clean', status: 'completed',   time: '07:01–07:39',   photos: 11, sla: true,  area: 'Full site',   cleaner: 'Your assigned operative' },
  { id: 'h5',  date: '05 May 2026', service: 'Morning clean', status: 'completed',   time: '06:58–07:42',   photos: 12, sla: true,  area: 'Full site',   cleaner: 'Your assigned operative' },
  { id: 'h6',  date: '02 May 2026', service: 'Morning clean', status: 'completed',   time: '07:05–07:55',   photos: 10, sla: true,  area: 'Full site',   cleaner: 'Your assigned operative' },
  { id: 'h7',  date: '01 May 2026', service: 'Morning clean', status: 'completed',   time: '06:57–07:48',   photos: 11, sla: true,  area: 'Full site',   cleaner: 'Your assigned operative' },
  { id: 'h8',  date: '30 Apr 2026', service: 'Morning clean', status: 'completed',   time: '07:12–08:04',   photos: 8,  sla: false, area: 'Full site',   cleaner: 'Your assigned operative', note: 'Late arrival — logged and resolved by Britannia Group' },
  { id: 'h9',  date: '29 Apr 2026', service: 'Morning clean', status: 'completed',   time: '07:00–07:52',   photos: 10, sla: true,  area: 'Full site',   cleaner: 'Your assigned operative' },
  { id: 'h10', date: '28 Apr 2026', service: 'Morning clean', status: 'completed',   time: '06:55–07:47',   photos: 11, sla: true,  area: 'Full site',   cleaner: 'Your assigned operative' },
  { id: 'h11', date: '25 Apr 2026', service: 'Deep clean',    status: 'completed',   time: '07:00–10:45',   photos: 31, sla: true,  area: 'Hall + rooms', cleaner: 'Your assigned operative' },
  { id: 'h12', date: '25 Apr 2026', service: 'Morning clean', status: 'completed',   time: '06:58–07:50',   photos: 12, sla: true,  area: 'Full site',   cleaner: 'Your assigned operative' },
];

const EVIDENCE_BY_PHOTO_COUNT = {
  small:  ['Main entrance — after', 'Reception — after', 'Corridor — after', 'Toilets — after', 'Main entrance — before', 'Reception — before'],
  medium: ['Main entrance — before', 'Reception — before', 'Corridor A — before', 'Toilets — before', 'Main entrance — after', 'Reception — after', 'Corridor A — after', 'Toilets — after', 'Classroom 1 — after', 'Staff room — after', 'Kitchen — after'],
  large:  ['Main entrance — before', 'Reception — before', 'Hall — before', 'Corridor A — before', 'Corridor B — before', 'Toilets GF — before', 'Toilets FF — before', 'Hall — after', 'Main entrance — after', 'Reception — after', 'Corridor A — after', 'Corridor B — after', 'Toilets GF — after', 'Toilets FF — after', 'Classroom 1 — after', 'Classroom 2 — after', 'Classroom 3 — after', 'Staff room — after', 'Kitchen — after', 'Sports store — after', 'Playground gate — after', 'Sign-off signature'],
};

function getEvidence(photos) {
  if (photos <= 6) return EVIDENCE_BY_PHOTO_COUNT.small.slice(0, photos);
  if (photos <= 14) return EVIDENCE_BY_PHOTO_COUNT.medium.slice(0, photos);
  return EVIDENCE_BY_PHOTO_COUNT.large.slice(0, photos);
}

const SERVICE_FILTERS = ['All', 'Morning clean', 'Deep clean'];

export default function ClientJobHistory({ showToast }) {
  const [selected, setSelected] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [serviceFilter, setServiceFilter] = useState('All');
  const [search, setSearch] = useState('');

  const filtered = JOBS.filter(j => {
    const matchStatus  = statusFilter === 'all' || j.status === statusFilter;
    const matchService = serviceFilter === 'All' || j.service === serviceFilter;
    const matchSearch  = !search || j.date.toLowerCase().includes(search.toLowerCase()) || j.service.toLowerCase().includes(search.toLowerCase()) || j.area.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchService && matchSearch;
  });

  const selectedJob = JOBS.find(j => j.id === selected);

  return (
    <div className="p-6 space-y-4 max-w-2xl">

      {/* Search + filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Search by date, service or area…"
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm focus:outline-none border border-gray-200 focus:border-[#4f78ff] bg-white" />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {[['all', 'All jobs'], ['completed', 'Completed'], ['in-progress', 'In progress']].map(([v, l]) => (
            <button key={v} onClick={() => setStatusFilter(v)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                statusFilter === v ? 'bg-[#010a4f] text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
              }`}>{l}</button>
          ))}
          <div className="w-px h-4 bg-gray-200" />
          {SERVICE_FILTERS.map(s => (
            <button key={s} onClick={() => setServiceFilter(s)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                serviceFilter === s ? 'bg-[#4f78ff]/10 text-[#4f78ff] border border-[#4f78ff]/30' : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
              }`}>{s}</button>
          ))}
          <span className="ml-auto text-xs text-gray-400">{filtered.length} jobs</span>
        </div>
      </div>

      {/* Job list */}
      <div className="space-y-2">
        {filtered.map(job => (
          <button key={job.id} onClick={() => setSelected(job.id === selected ? null : job.id)}
            className={`w-full bg-white rounded-2xl border text-left p-4 hover:shadow-sm transition-all ${
              selected === job.id ? 'border-[#4f78ff] shadow-sm' : job.sla ? 'border-gray-100' : 'border-amber-200'
            }`}>
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-sm text-[#010a4f]">{job.date}</span>
                  {!job.sla && (
                    <span className="text-[9px] font-black bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">SLA note</span>
                  )}
                  {job.service === 'Deep clean' && (
                    <span className="text-[9px] font-black bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">Deep clean</span>
                  )}
                </div>
                <div className="text-xs text-gray-400 mt-0.5">{job.service} · {job.time} · {job.area}</div>
              </div>
              <div className={`text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0 ${
                job.status === 'completed'   ? 'bg-emerald-100 text-emerald-700' :
                job.status === 'in-progress' ? 'bg-blue-100 text-blue-700' :
                'bg-gray-100 text-gray-500'
              }`}>
                {job.status}
              </div>
              <div className="text-xs text-gray-400 shrink-0">{job.photos} photos</div>
            </div>
          </button>
        ))}
        {filtered.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-400 text-sm">
            No jobs match your filters
          </div>
        )}
      </div>

      {/* Detail panel (inline expand on mobile, modal feel) */}
      {selected && selectedJob && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-white px-6 py-5 border-b border-gray-100 flex items-start justify-between">
              <div>
                <h2 className="font-black text-[#010a4f]">{selectedJob.date}</h2>
                <p className="text-xs text-gray-400 mt-0.5">{selectedJob.service} · {selectedJob.time}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-xl mt-0.5">×</button>
            </div>

            <div className="p-6 space-y-5">
              <div className="space-y-2">
                {[
                  { label: 'Operative',  value: selectedJob.cleaner },
                  { label: 'Area',       value: selectedJob.area },
                  { label: 'Duration',   value: selectedJob.time },
                  { label: 'SLA met',    value: selectedJob.sla ? '✅ Yes — within window' : '⚠️ Late arrival' },
                  { label: 'Evidence',   value: `${selectedJob.photos} photos uploaded` },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between text-sm">
                    <span className="text-gray-400">{label}</span>
                    <span className="font-medium text-[#010a4f] text-right max-w-[60%]">{value}</span>
                  </div>
                ))}
                {selectedJob.note && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 font-medium mt-2">
                    {selectedJob.note}
                  </div>
                )}
              </div>

              {selectedJob.status !== 'in-progress' && (
                <div>
                  <div className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-2">Evidence uploaded</div>
                  <div className="grid grid-cols-2 gap-2">
                    {getEvidence(selectedJob.photos).slice(0, 8).map((e, i) => (
                      <button key={i} onClick={() => showToast(`view photo: ${e}`)}
                        className="bg-gray-50 hover:bg-gray-100 rounded-xl p-3 flex items-center gap-2 text-left transition-colors">
                        <span>{e.includes('before') ? '📷' : e.includes('signature') ? '✍️' : '✅'}</span>
                        <span className="text-xs text-gray-600 leading-tight">{e}</span>
                      </button>
                    ))}
                    {selectedJob.photos > 8 && (
                      <button onClick={() => showToast(`view all ${selectedJob.photos} photos for ${selectedJob.date}`)}
                        className="bg-gray-50 hover:bg-gray-100 rounded-xl p-3 flex items-center justify-center text-xs font-bold text-[#4f78ff] transition-colors col-span-2">
                        + {selectedJob.photos - 8} more photos
                      </button>
                    )}
                  </div>
                </div>
              )}

              <button onClick={() => showToast(`export job record for ${selectedJob.date}`)}
                className="w-full py-3 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:border-gray-300 hover:text-gray-800 transition-all">
                Export this record (PDF)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk export */}
      <div className="bg-[#f8faff] rounded-2xl border border-[#99c5ff]/20 p-4 flex items-center gap-4">
        <div className="flex-1">
          <div className="text-sm font-bold text-[#010a4f]">Export job history</div>
          <div className="text-xs text-gray-400 mt-0.5">Download a full audit trail for Ofsted, CQC, or internal reporting</div>
        </div>
        <button onClick={() => showToast('export full job history as PDF')}
          className="px-4 py-2 rounded-xl bg-[#010a4f] text-white text-xs font-bold hover:bg-[#1f48ff] transition-colors shrink-0">
          Export all
        </button>
      </div>
    </div>
  );
}
