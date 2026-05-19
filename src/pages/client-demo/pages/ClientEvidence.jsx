import { useState } from 'react';
import { Shield, Search, Download } from 'lucide-react';

const ALL_PHOTOS = [
  { id: 'e01', date: '9 May',  time: '07:57', site: 'Luton',     label: 'Corridor A — after',       phase: 'after',  emoji: '✨', dist: '5m',  lat: '51.87971', lng: '-0.41380', bg: 'linear-gradient(135deg,#fef9c3,#fde68a)' },
  { id: 'e02', date: '9 May',  time: '07:52', site: 'Luton',     label: 'Toilets — after',           phase: 'after',  emoji: '🚿', dist: '11m', lat: '51.87976', lng: '-0.41386', bg: 'linear-gradient(135deg,#ede9fe,#c4b5fd)' },
  { id: 'e03', date: '9 May',  time: '07:45', site: 'Luton',     label: 'Reception — after',         phase: 'after',  emoji: '🪑', dist: '8m',  lat: '51.87973', lng: '-0.41384', bg: 'linear-gradient(135deg,#dbeafe,#bfdbfe)' },
  { id: 'e04', date: '9 May',  time: '07:41', site: 'Luton',     label: 'Main entrance — after',     phase: 'after',  emoji: '✨', dist: '6m',  lat: '51.87972', lng: '-0.41381', bg: 'linear-gradient(135deg,#d4fde8,#a7f3d0)' },
  { id: 'e05', date: '9 May',  time: '07:08', site: 'Luton',     label: 'Corridor A — before',       phase: 'before', emoji: '🚶', dist: '7m',  lat: '51.87973', lng: '-0.41382', bg: 'linear-gradient(135deg,#fce7f3,#fbcfe8)' },
  { id: 'e06', date: '9 May',  time: '07:04', site: 'Luton',     label: 'Reception — before',        phase: 'before', emoji: '🪑', dist: '9m',  lat: '51.87975', lng: '-0.41385', bg: 'linear-gradient(135deg,#dbeafe,#bfdbfe)' },
  { id: 'e07', date: '8 May',  time: '07:44', site: 'Luton',     label: 'Fitting rooms — after',     phase: 'after',  emoji: '🪟', dist: '8m',  lat: '51.87974', lng: '-0.41383', bg: 'linear-gradient(135deg,#d4fde8,#bbf7d0)' },
  { id: 'e08', date: '8 May',  time: '07:38', site: 'Luton',     label: 'Staff area — after',        phase: 'after',  emoji: '☕', dist: '6m',  lat: '51.87970', lng: '-0.41379', bg: 'linear-gradient(135deg,#fef9c3,#fde68a)' },
  { id: 'e09', date: '8 May',  time: '07:32', site: 'Luton',     label: 'Main entrance — after',     phase: 'after',  emoji: '✨', dist: '4m',  lat: '51.87972', lng: '-0.41381', bg: 'linear-gradient(135deg,#d4fde8,#a7f3d0)' },
  { id: 'e10', date: '8 May',  time: '07:06', site: 'Luton',     label: 'Toilets — before',          phase: 'before', emoji: '🚿', dist: '10m', lat: '51.87976', lng: '-0.41386', bg: 'linear-gradient(135deg,#ede9fe,#c4b5fd)' },
  { id: 'e11', date: '8 May',  time: '07:01', site: 'Luton',     label: 'Main entrance — before',    phase: 'before', emoji: '🚪', dist: '5m',  lat: '51.87971', lng: '-0.41380', bg: 'linear-gradient(135deg,#fce7f3,#fbcfe8)' },
  { id: 'e12', date: '7 May',  time: '07:39', site: 'Centre:MK', label: 'Entrance hall — after',     phase: 'after',  emoji: '✨', dist: '7m',  lat: '52.04105', lng: '-0.76001', bg: 'linear-gradient(135deg,#fef9c3,#fde68a)' },
  { id: 'e13', date: '7 May',  time: '07:28', site: 'Centre:MK', label: 'Ground floor — after',      phase: 'after',  emoji: '🛍️', dist: '9m',  lat: '52.04108', lng: '-0.76005', bg: 'linear-gradient(135deg,#d4fde8,#a7f3d0)' },
  { id: 'e14', date: '7 May',  time: '07:15', site: 'Centre:MK', label: 'Changing rooms — after',    phase: 'after',  emoji: '🪟', dist: '6m',  lat: '52.04103', lng: '-0.75998', bg: 'linear-gradient(135deg,#dbeafe,#bfdbfe)' },
  { id: 'e15', date: '7 May',  time: '07:01', site: 'Centre:MK', label: 'Entrance — before',         phase: 'before', emoji: '🚪', dist: '8m',  lat: '52.04105', lng: '-0.76001', bg: 'linear-gradient(135deg,#fce7f3,#fbcfe8)' },
  { id: 'e16', date: '6 May',  time: '07:51', site: 'Luton',     label: 'Toilets 1F — after',        phase: 'after',  emoji: '🚿', dist: '9m',  lat: '51.87976', lng: '-0.41386', bg: 'linear-gradient(135deg,#ede9fe,#c4b5fd)' },
  { id: 'e17', date: '6 May',  time: '07:43', site: 'Luton',     label: 'Corridor B — after',        phase: 'after',  emoji: '🚶', dist: '6m',  lat: '51.87973', lng: '-0.41382', bg: 'linear-gradient(135deg,#fef9c3,#fde68a)' },
  { id: 'e18', date: '6 May',  time: '07:05', site: 'Watford',   label: 'Entrance — before',         phase: 'before', emoji: '🚪', dist: '7m',  lat: '51.65410', lng: '-0.39800', bg: 'linear-gradient(135deg,#fce7f3,#fbcfe8)' },
];

function PhotoCard({ photo, onView }) {
  const [showGeo, setShowGeo] = useState(false);
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden group">
      {/* Photo area */}
      <div className="aspect-[4/3] relative cursor-pointer" style={{ background: photo.bg }}
        onClick={() => setShowGeo(v => !v)}>
        <div className="absolute inset-0 flex items-center justify-center text-4xl opacity-20 group-hover:opacity-35 transition-opacity">
          {photo.emoji}
        </div>
        {/* Phase badge */}
        <div className="absolute top-2 left-2">
          <span className="text-[9px] font-black px-2 py-0.5 rounded-md text-white shadow-sm"
            style={{ background: photo.phase === 'after' ? '#059669' : '#3b82f6' }}>
            {photo.phase === 'after' ? 'AFTER' : 'BEFORE'}
          </span>
        </div>
        {/* GPS badge */}
        <div className="absolute bottom-2 right-2">
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg shadow-sm"
            style={{ background: 'rgba(0,0,0,0.6)' }}>
            <Shield size={9} className="text-emerald-400 shrink-0" />
            <span className="text-[8px] text-white font-bold">GEO · {photo.dist}</span>
          </div>
        </div>
        {/* Camera icon overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="px-3 py-1.5 rounded-full text-[10px] font-bold text-white"
            style={{ background: 'rgba(0,0,0,0.5)' }}>
            View details
          </div>
        </div>
      </div>

      {/* Label row */}
      <div className="px-3 py-2.5">
        <div className="text-xs font-bold text-[#010a4f] truncate">{photo.label}</div>
        <div className="flex items-center justify-between mt-0.5">
          <span className="text-[10px] text-gray-400">{photo.date} · {photo.time}</span>
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded text-gray-500 bg-gray-100">{photo.site}</span>
        </div>
      </div>

      {/* Expandable geo detail */}
      {showGeo && (
        <div className="px-3 pb-3">
          <div className="rounded-xl p-2.5 space-y-1"
            style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)' }}>
            <div className="flex items-center gap-1.5">
              <Shield size={9} className="text-emerald-600 shrink-0" />
              <span className="text-[9px] font-black text-emerald-700 tracking-wide">GEO-VERIFIED</span>
              <span className="ml-auto text-[8px] text-emerald-500">tamper-evident</span>
            </div>
            <div className="text-[9px] text-emerald-700 font-mono">{photo.lat}, {photo.lng}</div>
            <div className="text-[9px] text-emerald-600">{photo.dist} from site boundary · {photo.time} · 9 May 2026</div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ClientEvidence({ showToast }) {
  const [siteFilter, setSiteFilter] = useState('All');
  const [phaseFilter, setPhaseFilter] = useState('All');
  const [search, setSearch] = useState('');

  const sites = ['All', 'Luton', 'Centre:MK', 'Watford'];
  const phases = ['All', 'Before', 'After'];

  const filtered = ALL_PHOTOS.filter(p => {
    const matchSite  = siteFilter === 'All' || p.site === siteFilter;
    const matchPhase = phaseFilter === 'All' || p.phase === phaseFilter.toLowerCase();
    const matchSearch = !search || p.label.toLowerCase().includes(search.toLowerCase()) || p.date.toLowerCase().includes(search.toLowerCase());
    return matchSite && matchPhase && matchSearch;
  });

  const verified   = filtered.length;
  const totalAll   = ALL_PHOTOS.length;

  return (
    <div className="p-6 space-y-5 max-w-3xl">

      {/* ── Header ── */}
      <div>
        <h1 className="text-xl font-black text-[#010a4f]">Photo Evidence</h1>
        <p className="text-sm text-gray-500 mt-0.5">Every clean documented with geo-verified photos — your permanent audit trail.</p>
      </div>

      {/* ── Stats bar ── */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total photos',       value: '312',   color: '#4f78ff' },
          { label: 'Geo-verified',        value: '100%',  color: '#10b981' },
          { label: 'Flagged / rejected',  value: '0',     color: '#059669' },
          { label: 'Sites covered',       value: '3',     color: '#6366f1' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
            <div className="text-2xl font-black" style={{ color }}>{value}</div>
            <div className="text-[10px] text-gray-400 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* ── GPS trust bar ── */}
      <div className="rounded-2xl px-5 py-3 flex items-center gap-3"
        style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)' }}>
        <Shield size={16} className="text-emerald-600 shrink-0" />
        <div className="flex-1">
          <span className="text-xs font-black text-emerald-700">Every photo is independently geo-verified by Cadi Connect</span>
          <span className="text-xs text-emerald-600 ml-2">— GPS coordinates, timestamp, and a tamper-evident hash are recorded at upload. Impossible to fake or backdate.</span>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="space-y-3">
        <div className="relative">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Search by area name or date…"
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm border border-gray-200 focus:outline-none focus:border-[#4f78ff] bg-white" />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1">
            {sites.map(s => (
              <button key={s} onClick={() => setSiteFilter(s)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  siteFilter === s ? 'bg-[#010a4f] text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
                }`}>{s}</button>
            ))}
          </div>
          <div className="w-px h-4 bg-gray-200" />
          <div className="flex items-center gap-1">
            {phases.map(p => (
              <button key={p} onClick={() => setPhaseFilter(p)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  phaseFilter === p
                    ? p === 'After' ? 'bg-emerald-600 text-white' : p === 'Before' ? 'bg-blue-600 text-white' : 'bg-[#010a4f] text-white'
                    : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
                }`}>{p}</button>
            ))}
          </div>
          <span className="ml-auto text-xs text-gray-400">{filtered.length} photos</span>
        </div>
      </div>

      {/* ── Photo grid ── */}
      <div className="grid grid-cols-3 gap-3">
        {filtered.map(photo => (
          <PhotoCard key={photo.id} photo={photo} onView={() => showToast(`view evidence: ${photo.label}`)} />
        ))}
        {filtered.length === 0 && (
          <div className="col-span-3 bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-400 text-sm">
            No photos match your filters
          </div>
        )}
      </div>

      {filtered.length < totalAll && (
        <div className="text-center">
          <button onClick={() => showToast(`load all ${totalAll} photos`)}
            className="px-6 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 hover:border-[#4f78ff]/30 hover:text-[#4f78ff] transition-colors bg-white">
            Load more photos ({totalAll - filtered.length} remaining)
          </button>
        </div>
      )}

      {/* ── Export ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
        <Download size={20} className="text-[#010a4f] shrink-0" />
        <div className="flex-1">
          <div className="text-sm font-bold text-[#010a4f]">Export evidence pack</div>
          <div className="text-xs text-gray-400 mt-0.5">Download all photos with geo-stamps for compliance, audit, or dispute resolution — branded Britannia FM report</div>
        </div>
        <button onClick={() => showToast('export full geo-verified evidence pack')}
          className="px-5 py-2.5 rounded-xl bg-[#010a4f] text-white text-xs font-bold hover:bg-[#1f48ff] transition-colors shrink-0">
          Export pack
        </button>
      </div>

    </div>
  );
}
