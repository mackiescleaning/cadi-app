import { Shield, ChevronRight, Camera, Clock, Star, TrendingUp } from 'lucide-react';

const NAVY = '#010a4f';

const PHOTO_THUMBS = [
  { phase: 'after',  emoji: '✨', label: 'Main entrance — after',   dist: '4m',  bg: 'linear-gradient(135deg,#d4fde8,#a7f3d0)' },
  { phase: 'before', emoji: '🪑', label: 'Reception — before',      dist: '9m',  bg: 'linear-gradient(135deg,#dbeafe,#bfdbfe)' },
  { phase: 'after',  emoji: '🚿', label: 'Toilets — after',         dist: '7m',  bg: 'linear-gradient(135deg,#ede9fe,#c4b5fd)' },
  { phase: 'after',  emoji: '✨', label: 'Corridor A — after',      dist: '5m',  bg: 'linear-gradient(135deg,#fef9c3,#fde68a)' },
  { phase: 'before', emoji: '🚪', label: 'Main entrance — before',  dist: '6m',  bg: 'linear-gradient(135deg,#fce7f3,#fbcfe8)' },
  { phase: 'after',  emoji: '🪟', label: 'Fitting rooms — after',   dist: '8m',  bg: 'linear-gradient(135deg,#d4fde8,#bbf7d0)' },
];

const SITES = [
  {
    id: 'lu', name: 'Next – Luton The Mall', address: 'Bute Street, Luton LU1 2TL',
    status: 'live', service: 'Retail morning clean', jobs: 22, sla: 100,
    nextClean: 'Today 06:00–08:00', streak: [true, true, true, true, null],
  },
  {
    id: 'mk', name: 'Next – Centre:MK', address: 'Silbury Arcade, Milton Keynes MK9 3EB',
    status: 'good', service: 'Retail morning clean', jobs: 22, sla: 100,
    nextClean: 'Today 06:00–08:30', streak: [true, true, true, true, null],
  },
  {
    id: 'wf', name: 'Next – Watford Atria', address: 'The Atria, Watford WD17 1NJ',
    status: 'warning', service: 'Retail morning clean', jobs: 24, sla: 97,
    nextClean: 'Today 07:30–08:30', streak: [true, true, true, false, null],
    note: '16 May — late arrival · logged and resolved',
  },
];

const STATUS = {
  live:    { dot: '#3b82f6', bg: 'rgba(59,130,246,0.09)',  border: 'rgba(59,130,246,0.22)',  text: '#2563eb', label: 'Live now'     },
  good:    { dot: '#10b981', bg: 'rgba(16,185,129,0.08)',  border: 'rgba(16,185,129,0.2)',   text: '#059669', label: 'All good'     },
  warning: { dot: '#f59e0b', bg: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.2)',   text: '#d97706', label: 'Note on file' },
};

function PhotoThumb({ photo, onClick }) {
  return (
    <button onClick={onClick}
      className="aspect-square rounded-xl overflow-hidden relative group cursor-pointer"
      style={{ background: photo.bg }}>
      <div className="absolute inset-0 flex items-center justify-center text-3xl opacity-20 group-hover:opacity-35 transition-opacity">
        {photo.emoji}
      </div>
      <div className="absolute top-1.5 right-1.5">
        <span className="text-[7px] font-black px-1.5 py-0.5 rounded text-white"
          style={{ background: photo.phase === 'after' ? '#059669' : '#3b82f6' }}>
          {photo.phase === 'after' ? 'AFT' : 'BEF'}
        </span>
      </div>
      <div className="absolute bottom-1.5 left-1.5">
        <div className="flex items-center gap-0.5 px-1 py-0.5 rounded"
          style={{ background: 'rgba(0,0,0,0.55)' }}>
          <Shield size={7} className="text-emerald-400 shrink-0" />
          <span className="text-[7px] text-white font-bold">{photo.dist}</span>
        </div>
      </div>
    </button>
  );
}

export default function ClientOverview({ showToast, onNavigate }) {
  return (
    <div className="p-6 space-y-5 max-w-3xl">

      {/* ── Live Now Hero ── */}
      <div className="rounded-2xl overflow-hidden shadow-lg"
        style={{ background: 'linear-gradient(135deg, #010a4f 0%, #0d1f6e 100%)' }}>
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                <span className="text-[10px] font-black text-blue-300 tracking-[0.18em] uppercase">Live right now</span>
              </div>
              <h2 className="text-white font-black text-xl leading-tight">Morning clean in progress</h2>
              <p className="text-blue-200 text-sm mt-1">Next – Luton The Mall · Operative on site since 06:58</p>
              <div className="flex items-center gap-5 mt-3">
                <div className="flex items-center gap-1.5">
                  <Camera size={12} className="text-blue-300" />
                  <span className="text-[11px] text-blue-200">6 photos uploaded</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Shield size={12} className="text-emerald-400" />
                  <span className="text-[11px] text-emerald-300 font-bold">SLA on track</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock size={12} className="text-blue-300" />
                  <span className="text-[11px] text-blue-200">Est. complete 08:00</span>
                </div>
              </div>
            </div>
            <button onClick={() => onNavigate('live')}
              className="shrink-0 px-4 py-2 rounded-xl text-xs font-black text-white border border-white/20 hover:bg-white/10 transition-colors flex items-center gap-1.5">
              Watch live <ChevronRight size={12} />
            </button>
          </div>
        </div>
        {/* Progress bar */}
        <div className="mx-6 mb-2">
          <div className="flex justify-between text-[9px] text-white/40 mb-1">
            <span>06:00 start</span>
            <span className="text-blue-300 font-bold">73% through SLA window</span>
            <span>08:00 SLA</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/10">
            <div className="h-full rounded-full bg-gradient-to-r from-blue-400 to-blue-300" style={{ width: '73%' }} />
          </div>
        </div>
        <div className="px-6 py-3 border-t border-white/8 flex items-center justify-between">
          <span className="text-[10px] text-white/30">Next – Centre:MK clean starts 08:30</span>
          <span className="text-[10px] text-blue-300/70">3 sites monitored</span>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Jobs this month', value: '68',  sub: 'across 3 sites',    color: '#4f78ff' },
          { label: 'SLA hit rate',    value: '99%', sub: '1 exception logged', color: '#10b981' },
          { label: 'Photos on file',  value: '312', sub: 'all geo-verified',   color: '#6366f1' },
          { label: 'Open issues',     value: '0',   sub: 'all resolved',       color: '#059669' },
        ].map(({ label, value, sub, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-shadow">
            <div className="text-2xl font-black mt-1 mb-1" style={{ color }}>{value}</div>
            <div className="text-xs font-bold text-[#010a4f]">{label}</div>
            <div className="text-[10px] text-gray-400 mt-0.5">{sub}</div>
          </div>
        ))}
      </div>

      {/* ── Operative Trust Card ── */}
      <div className="bg-white rounded-2xl border border-[#99c5ff]/30 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-50 flex items-center justify-between">
          <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">Your assigned operative</div>
          <span className="text-[9px] font-black px-2.5 py-1 rounded-full"
            style={{ color: '#34d399', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.3)' }}>
            Cadi Connect Verified
          </span>
        </div>
        <div className="p-5">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-black shrink-0"
              style={{ background: 'linear-gradient(135deg, #f0f4ff, #dbeafe)', color: '#4f78ff' }}>
              SK
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                <span className="font-black text-[#010a4f]">Sarah K.</span>
                <div className="flex items-center gap-0.5">
                  {[1,2,3,4,5].map(i => <span key={i} className="text-amber-400">★</span>)}
                  <span className="text-xs text-gray-400 ml-1.5">4.8 · 47 jobs</span>
                </div>
              </div>
              <div className="text-xs text-gray-400">Lead operative · Britannia FM · Bedfordshire & Luton</div>
              <div className="grid grid-cols-4 gap-2 mt-3">
                {[
                  { label: 'Connect Score', value: '91', color: '#10b981' },
                  { label: 'Reliability',   value: '96', color: '#3b82f6' },
                  { label: 'Evidence',      value: '92', color: '#6366f1' },
                  { label: 'DBS Status',    value: 'Clear', color: '#059669' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="rounded-xl bg-[#f8faff] p-2.5 text-center border border-[#99c5ff]/15">
                    <div className="text-sm font-black" style={{ color }}>{value}</div>
                    <div className="text-[9px] text-gray-400 mt-0.5 leading-tight">{label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-4 px-4 py-3 rounded-xl text-xs text-emerald-700 leading-relaxed"
            style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.18)' }}>
            <div className="font-bold mb-1 flex items-center gap-1.5">
              <Shield size={11} /> Independently verified by Cadi Connect
            </div>
            Sarah's identity, right to work, DBS certificate, and insurance have been verified by the Cadi network. Her scores are calculated from real job data across all FM companies she works with — not self-reported.
          </div>
        </div>
      </div>

      {/* ── Latest Evidence Strip ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">
            Latest evidence — today, 9 May
          </div>
          <button onClick={() => onNavigate('evidence')}
            className="text-xs text-[#4f78ff] font-bold flex items-center gap-1 hover:underline">
            View all 312 <ChevronRight size={12} />
          </button>
        </div>
        <div className="grid grid-cols-6 gap-2">
          {PHOTO_THUMBS.map((photo, i) => (
            <PhotoThumb key={i} photo={photo} onClick={() => showToast(`view evidence: ${photo.label}`)} />
          ))}
        </div>
        <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-xl"
          style={{ background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.15)' }}>
          <Shield size={11} className="text-emerald-600 shrink-0" />
          <span className="text-[10px] text-emerald-700">6/6 photos geo-verified · all within 15m of site boundary · tamper-evident hashes recorded</span>
        </div>
      </div>

      {/* ── Sites ── */}
      <div>
        <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">Your sites</div>
        <div className="space-y-3">
          {SITES.map(site => {
            const st = STATUS[site.status];
            return (
              <div key={site.id}
                className="bg-white rounded-2xl border shadow-sm p-5 transition-all hover:shadow-md"
                style={{ borderColor: st.border }}>
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-bold text-sm text-[#010a4f]">{site.name}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: st.bg, border: `1px solid ${st.border}`, color: st.text }}>
                        {st.label}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400">{site.address} · {site.service}</div>
                    {site.note && <div className="text-xs text-amber-600 font-medium mt-0.5">{site.note}</div>}
                    <div className="flex items-center gap-2 mt-2.5">
                      <span className="text-[10px] text-gray-400">This week</span>
                      <div className="flex gap-1">
                        {['M','T','W','T','F'].map((d, i) => {
                          const s = site.streak[i];
                          return (
                            <div key={i} className="flex flex-col items-center gap-0.5">
                              <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[9px] font-bold ${
                                s === true  ? 'bg-emerald-100 text-emerald-700' :
                                s === false ? 'bg-amber-100 text-amber-700' :
                                'bg-gray-100 text-gray-400'
                              }`}>
                                {s === true ? '✓' : s === false ? '!' : d}
                              </div>
                              <span className="text-[8px] text-gray-300">{d}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-5 shrink-0">
                    <div className="text-right">
                      <div className="text-sm font-bold text-[#010a4f]">{site.jobs}</div>
                      <div className="text-[10px] text-gray-400">jobs</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold" style={{ color: site.sla === 100 ? '#10b981' : '#f59e0b' }}>
                        {site.sla}%
                      </div>
                      <div className="text-[10px] text-gray-400">SLA</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-semibold text-gray-600">{site.nextClean}</div>
                      <div className="text-[10px] text-gray-400">next clean</div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Quick Actions ── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Report an issue',          icon: '⚠️', action: () => onNavigate('issue')   },
          { label: 'Request additional work',   icon: '📋', action: () => showToast('submit additional work request') },
          { label: 'Download compliance pack',  icon: '📄', action: () => showToast('download portfolio compliance pack') },
        ].map(({ label, icon, action }) => (
          <button key={label} onClick={action}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center hover:border-[#4f78ff]/30 hover:shadow-md transition-all">
            <div className="text-2xl mb-2">{icon}</div>
            <div className="text-xs font-bold text-[#010a4f]">{label}</div>
          </button>
        ))}
      </div>

      {/* ── Cadi Connect Explainer ── */}
      <div className="rounded-2xl px-5 py-4 flex items-center gap-4"
        style={{ background: 'linear-gradient(135deg, rgba(1,10,79,0.03) 0%, rgba(79,120,255,0.06) 100%)', border: '1px solid rgba(79,120,255,0.14)' }}>
        <TrendingUp size={20} className="text-[#4f78ff] shrink-0" />
        <div className="flex-1">
          <div className="text-xs font-black text-[#010a4f]">This level of visibility is only possible through Cadi Connect</div>
          <div className="text-[10px] text-gray-500 mt-0.5 leading-relaxed">
            Real-time GPS tracking, geo-verified photo evidence, and independently verified operatives — none of this exists with traditional FM contracts. Britannia FM chose Cadi Connect so every client gets proof, not promises.
          </div>
        </div>
      </div>

    </div>
  );
}
