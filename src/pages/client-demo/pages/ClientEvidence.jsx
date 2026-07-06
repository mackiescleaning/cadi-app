import { useState } from 'react';
import { Shield, Search, Download, X, Camera } from 'lucide-react';

const HASH_MAP = {
  e01: 'a3f9c2e1d874b56f',
  e02: 'b8e1a4c92f037d56',
  e03: 'c1d4e7f2a90b8653',
  e04: 'd2e5f8a1b94c7360',
  e05: 'e3f6a9b2c057d481',
  e06: 'f4a7b0c3d168e592',
  e07: 'a5b8c1d2e379f604',
  e08: 'b6c9d2e3f48a0715',
  e09: 'c7d0e3f4a59b1826',
  e10: 'd8e1f4a5b6c2093',
  e11: 'e9f2a5b6c7d31a04',
  e12: 'fa03b6c7d8e4b215',
  e13: 'ab14c7d8e9f5c326',
  e14: 'bc25d8e9f0a6d437',
  e15: 'cd36e9f0a1b7e548',
  e16: 'de47f0a1b2c8f659',
  e17: 'ef58a1b2c3d9076a',
  e18: 'f069b2c3d4ea187b',
};

function Lightbox({ photo, onClose }) {
  if (!photo) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'white',
          borderRadius: '1.25rem',
          overflow: 'hidden',
          maxWidth: 520,
          width: '100%',
          boxShadow: '0 40px 120px rgba(0,0,0,0.6)',
        }}
      >
        {/* Image area */}
        <div
          style={{
            height: 260,
            position: 'relative',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background:
              photo.phase === 'after'
                ? 'linear-gradient(135deg, #d1fae5, #a7f3d0)'
                : 'linear-gradient(135deg, #dbeafe, #bfdbfe)',
          }}
        >
          <Camera
            size={48}
            style={{
              color: photo.phase === 'after' ? 'rgba(5,150,105,0.25)' : 'rgba(37,99,235,0.25)',
            }}
          />
          {/* Before/After badge */}
          <div style={{ position: 'absolute', top: 12, left: 12 }}>
            <span
              style={{
                fontSize: '0.7rem',
                fontWeight: 900,
                padding: '3px 10px',
                borderRadius: 6,
                background: photo.phase === 'after' ? '#059669' : '#2563eb',
                color: 'white',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
              }}
            >
              {photo.phase === 'after' ? 'After' : 'Before'}
            </span>
          </div>
          {/* Close button */}
          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              width: 28,
              height: 28,
              borderRadius: '50%',
              border: 'none',
              background: 'rgba(0,0,0,0.45)',
              color: 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={14} />
          </button>
          {/* Geo badge */}
          <div style={{ position: 'absolute', bottom: 12, left: 12 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '4px 10px',
                borderRadius: 8,
                background: 'rgba(0,0,0,0.65)',
              }}
            >
              <Shield size={10} color="#34d399" />
              <span style={{ fontSize: '0.65rem', color: 'white', fontWeight: 700 }}>
                GEO VERIFIED · {photo.dist} from boundary
              </span>
            </div>
          </div>
        </div>

        {/* Details */}
        <div style={{ padding: '1.25rem 1.5rem 1.5rem' }}>
          <div style={{ fontWeight: 900, fontSize: '1rem', color: '#010a4f', marginBottom: 4 }}>
            {photo.label}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '1rem' }}>
            {photo.date} · {photo.time} · {photo.site}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
            {[
              { label: 'GPS Coordinates', value: `${photo.lat}, ${photo.lng}` },
              { label: 'Distance from boundary', value: `±${photo.dist}` },
              { label: 'Timestamp', value: `${photo.date} 2026 · ${photo.time}` },
              {
                label: 'Tamper-evident hash',
                value: `sha256:${HASH_MAP[photo.id] || 'a1b2c3d4e5f60718'}…`,
              },
            ].map(({ label, value }) => (
              <div
                key={label}
                style={{
                  borderRadius: '0.6rem',
                  padding: '0.6rem 0.75rem',
                  background: 'rgba(1,10,79,0.04)',
                  border: '1px solid rgba(1,10,79,0.08)',
                }}
              >
                <div
                  style={{
                    fontSize: '0.6rem',
                    fontWeight: 800,
                    color: '#9ca3af',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    marginBottom: 3,
                  }}
                >
                  {label}
                </div>
                <div
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    color: '#1f2937',
                    fontFamily: 'monospace',
                    wordBreak: 'break-all',
                  }}
                >
                  {value}
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              marginTop: '0.875rem',
              padding: '0.6rem 0.875rem',
              borderRadius: '0.6rem',
              background: 'rgba(16,185,129,0.08)',
              border: '1px solid rgba(16,185,129,0.2)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <Shield size={13} color="#059669" />
            <span style={{ fontSize: '0.68rem', color: '#065f46', fontWeight: 700 }}>
              Tamper-proof · GPS-stamped at upload · Cannot be backdated
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

const ALL_PHOTOS = [
  {
    id: 'e01',
    date: '9 May',
    time: '07:57',
    site: 'Luton',
    label: 'Corridor A — after',
    phase: 'after',
    dist: '5m',
    lat: '51.87971',
    lng: '-0.41380',
  },
  {
    id: 'e02',
    date: '9 May',
    time: '07:52',
    site: 'Luton',
    label: 'Toilets — after',
    phase: 'after',
    dist: '11m',
    lat: '51.87976',
    lng: '-0.41386',
  },
  {
    id: 'e03',
    date: '9 May',
    time: '07:45',
    site: 'Luton',
    label: 'Reception — after',
    phase: 'after',
    dist: '8m',
    lat: '51.87973',
    lng: '-0.41384',
  },
  {
    id: 'e04',
    date: '9 May',
    time: '07:41',
    site: 'Luton',
    label: 'Main entrance — after',
    phase: 'after',
    dist: '6m',
    lat: '51.87972',
    lng: '-0.41381',
  },
  {
    id: 'e05',
    date: '9 May',
    time: '07:08',
    site: 'Luton',
    label: 'Corridor A — before',
    phase: 'before',
    dist: '7m',
    lat: '51.87973',
    lng: '-0.41382',
  },
  {
    id: 'e06',
    date: '9 May',
    time: '07:04',
    site: 'Luton',
    label: 'Reception — before',
    phase: 'before',
    dist: '9m',
    lat: '51.87975',
    lng: '-0.41385',
  },
  {
    id: 'e07',
    date: '8 May',
    time: '07:44',
    site: 'Luton',
    label: 'Fitting rooms — after',
    phase: 'after',
    dist: '8m',
    lat: '51.87974',
    lng: '-0.41383',
  },
  {
    id: 'e08',
    date: '8 May',
    time: '07:38',
    site: 'Luton',
    label: 'Staff area — after',
    phase: 'after',
    dist: '6m',
    lat: '51.87970',
    lng: '-0.41379',
  },
  {
    id: 'e09',
    date: '8 May',
    time: '07:32',
    site: 'Luton',
    label: 'Main entrance — after',
    phase: 'after',
    dist: '4m',
    lat: '51.87972',
    lng: '-0.41381',
  },
  {
    id: 'e10',
    date: '8 May',
    time: '07:06',
    site: 'Luton',
    label: 'Toilets — before',
    phase: 'before',
    dist: '10m',
    lat: '51.87976',
    lng: '-0.41386',
  },
  {
    id: 'e11',
    date: '8 May',
    time: '07:01',
    site: 'Luton',
    label: 'Main entrance — before',
    phase: 'before',
    dist: '5m',
    lat: '51.87971',
    lng: '-0.41380',
  },
  {
    id: 'e12',
    date: '7 May',
    time: '07:39',
    site: 'Centre:MK',
    label: 'Entrance hall — after',
    phase: 'after',
    dist: '7m',
    lat: '52.04105',
    lng: '-0.76001',
  },
  {
    id: 'e13',
    date: '7 May',
    time: '07:28',
    site: 'Centre:MK',
    label: 'Ground floor — after',
    phase: 'after',
    dist: '9m',
    lat: '52.04108',
    lng: '-0.76005',
  },
  {
    id: 'e14',
    date: '7 May',
    time: '07:15',
    site: 'Centre:MK',
    label: 'Changing rooms — after',
    phase: 'after',
    dist: '6m',
    lat: '52.04103',
    lng: '-0.75998',
  },
  {
    id: 'e15',
    date: '7 May',
    time: '07:01',
    site: 'Centre:MK',
    label: 'Entrance — before',
    phase: 'before',
    dist: '8m',
    lat: '52.04105',
    lng: '-0.76001',
  },
  {
    id: 'e16',
    date: '6 May',
    time: '07:51',
    site: 'Luton',
    label: 'Toilets 1F — after',
    phase: 'after',
    dist: '9m',
    lat: '51.87976',
    lng: '-0.41386',
  },
  {
    id: 'e17',
    date: '6 May',
    time: '07:43',
    site: 'Luton',
    label: 'Corridor B — after',
    phase: 'after',
    dist: '6m',
    lat: '51.87973',
    lng: '-0.41382',
  },
  {
    id: 'e18',
    date: '6 May',
    time: '07:05',
    site: 'Watford',
    label: 'Entrance — before',
    phase: 'before',
    dist: '7m',
    lat: '51.65410',
    lng: '-0.39800',
  },
];

function PhotoCard({ photo, onView }) {
  const isAfter = photo.phase === 'after';
  const cardBg = isAfter
    ? 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)'
    : 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)';
  const iconColor = isAfter ? 'rgba(5,150,105,0.35)' : 'rgba(37,99,235,0.35)';

  return (
    <div
      className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden group cursor-pointer"
      onClick={onView}
    >
      {/* Photo area */}
      <div
        className="aspect-[4/3] relative overflow-hidden flex items-center justify-center"
        style={{ background: cardBg }}
      >
        <Camera size={26} style={{ color: iconColor }} />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity px-3 py-1.5 rounded-full text-[10px] font-bold text-white bg-black/40">
            View details →
          </div>
        </div>
        {/* Phase badge */}
        <div className="absolute top-2 left-2">
          <span
            className="text-[9px] font-black px-2 py-0.5 rounded-md text-white shadow-sm"
            style={{ background: isAfter ? '#059669' : '#3b82f6' }}
          >
            {isAfter ? 'AFTER' : 'BEFORE'}
          </span>
        </div>
        {/* GPS badge */}
        <div className="absolute bottom-2 right-2">
          <div
            className="flex items-center gap-1 px-2 py-1 rounded-lg"
            style={{ background: 'rgba(0,0,0,0.25)' }}
          >
            <Shield size={9} className="text-emerald-600 shrink-0" />
            <span
              className="text-[8px] font-bold"
              style={{ color: isAfter ? '#065f46' : '#1e40af' }}
            >
              GEO · {photo.dist}
            </span>
          </div>
        </div>
      </div>

      {/* Label row */}
      <div className="px-3 py-2.5">
        <div className="text-xs font-bold text-[#010a4f] truncate">{photo.label}</div>
        <div className="flex items-center justify-between mt-0.5">
          <span className="text-[10px] text-gray-400">
            {photo.date} · {photo.time}
          </span>
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded text-gray-500 bg-gray-100">
            {photo.site}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function ClientEvidence({ showToast }) {
  const [siteFilter, setSiteFilter] = useState('All');
  const [phaseFilter, setPhaseFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [lightbox, setLightbox] = useState(null);

  const sites = ['All', 'Luton', 'Centre:MK', 'Watford'];
  const phases = ['All', 'Before', 'After'];

  const filtered = ALL_PHOTOS.filter((p) => {
    const matchSite = siteFilter === 'All' || p.site === siteFilter;
    const matchPhase = phaseFilter === 'All' || p.phase === phaseFilter.toLowerCase();
    const matchSearch =
      !search ||
      p.label.toLowerCase().includes(search.toLowerCase()) ||
      p.date.toLowerCase().includes(search.toLowerCase());
    return matchSite && matchPhase && matchSearch;
  });

  const totalAll = ALL_PHOTOS.length;

  return (
    <div className="p-6 space-y-5 max-w-3xl">
      <Lightbox photo={lightbox} onClose={() => setLightbox(null)} />

      {/* ── Header ── */}
      <div>
        <h1 className="text-xl font-black text-[#010a4f]">Photo Evidence</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Every clean documented with geo-verified photos — your permanent audit trail.
        </p>
      </div>

      {/* ── Stats bar ── */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total photos', value: '312', color: '#4f78ff' },
          { label: 'Geo-verified', value: '100%', color: '#10b981' },
          { label: 'Flagged / rejected', value: '0', color: '#059669' },
          { label: 'Sites covered', value: '3', color: '#6366f1' },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center"
          >
            <div className="text-2xl font-black" style={{ color }}>
              {value}
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* ── GPS trust bar ── */}
      <div
        className="rounded-2xl px-5 py-3 flex items-center gap-3"
        style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)' }}
      >
        <Shield size={16} className="text-emerald-600 shrink-0" />
        <div className="flex-1">
          <span className="text-xs font-black text-emerald-700">
            Every photo is independently geo-verified by Cadi Connect
          </span>
          <span className="text-xs text-emerald-600 ml-2">
            — GPS coordinates, timestamp, and a tamper-evident hash are recorded at upload.
            Impossible to fake or backdate.
          </span>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="space-y-3">
        <div className="relative">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by area name or date…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm border border-gray-200 focus:outline-none focus:border-[#4f78ff] bg-white"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1">
            {sites.map((s) => (
              <button
                key={s}
                onClick={() => setSiteFilter(s)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  siteFilter === s
                    ? 'bg-[#010a4f] text-white'
                    : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="w-px h-4 bg-gray-200" />
          <div className="flex items-center gap-1">
            {phases.map((p) => (
              <button
                key={p}
                onClick={() => setPhaseFilter(p)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  phaseFilter === p
                    ? p === 'After'
                      ? 'bg-emerald-600 text-white'
                      : p === 'Before'
                        ? 'bg-blue-600 text-white'
                        : 'bg-[#010a4f] text-white'
                    : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          <span className="ml-auto text-xs text-gray-400">{filtered.length} photos</span>
        </div>
      </div>

      {/* ── Photo grid ── */}
      <div className="grid grid-cols-3 gap-3">
        {filtered.map((photo) => (
          <PhotoCard key={photo.id} photo={photo} onView={() => setLightbox(photo)} />
        ))}
        {filtered.length === 0 && (
          <div className="col-span-3 bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-400 text-sm">
            No photos match your filters
          </div>
        )}
      </div>

      {filtered.length < totalAll && (
        <div className="text-center">
          <button
            onClick={() => showToast(`load all ${totalAll} photos`)}
            className="px-6 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 hover:border-[#4f78ff]/30 hover:text-[#4f78ff] transition-colors bg-white"
          >
            Load more photos ({totalAll - filtered.length} remaining)
          </button>
        </div>
      )}

      {/* ── Export ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
        <Download size={20} className="text-[#010a4f] shrink-0" />
        <div className="flex-1">
          <div className="text-sm font-bold text-[#010a4f]">Export evidence pack</div>
          <div className="text-xs text-gray-400 mt-0.5">
            Download all photos with geo-stamps for compliance, audit, or dispute resolution —
            branded Britannia Group report
          </div>
        </div>
        <button
          onClick={() => showToast('export full geo-verified evidence pack')}
          className="px-5 py-2.5 rounded-xl bg-[#010a4f] text-white text-xs font-bold hover:bg-[#1f48ff] transition-colors shrink-0"
        >
          Export pack
        </button>
      </div>
    </div>
  );
}
