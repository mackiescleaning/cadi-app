import { Shield, MapPin, Clock, Camera, ChevronRight } from 'lucide-react';

const PHOTO_FEED = [
  { id: 'p7', time: '07:57', label: 'Corridor A — after',      emoji: '✨', phase: 'after',  dist: '5m',  accuracy: '±4m', bg: 'linear-gradient(135deg,#fef9c3,#fde68a)',  lat: '51.87971', lng: '-0.41380' },
  { id: 'p6', time: '07:52', label: 'Toilets — after',         emoji: '🚿', phase: 'after',  dist: '11m', accuracy: '±7m', bg: 'linear-gradient(135deg,#ede9fe,#c4b5fd)',  lat: '51.87976', lng: '-0.41386' },
  { id: 'p5', time: '07:45', label: 'Reception — after',       emoji: '🪑', phase: 'after',  dist: '8m',  accuracy: '±5m', bg: 'linear-gradient(135deg,#dbeafe,#bfdbfe)',  lat: '51.87973', lng: '-0.41384' },
  { id: 'p4', time: '07:41', label: 'Main entrance — after',   emoji: '✨', phase: 'after',  dist: '6m',  accuracy: '±4m', bg: 'linear-gradient(135deg,#d4fde8,#a7f3d0)',  lat: '51.87972', lng: '-0.41381' },
  { id: 'p3', time: '07:08', label: 'Corridor A — before',     emoji: '🚶', phase: 'before', dist: '7m',  accuracy: '±5m', bg: 'linear-gradient(135deg,#fce7f3,#fbcfe8)',  lat: '51.87973', lng: '-0.41382' },
  { id: 'p2', time: '07:04', label: 'Reception — before',      emoji: '🪑', phase: 'before', dist: '9m',  accuracy: '±6m', bg: 'linear-gradient(135deg,#dbeafe,#bfdbfe)',  lat: '51.87975', lng: '-0.41385' },
  { id: 'p1', time: '07:01', label: 'Main entrance — before',  emoji: '🚪', phase: 'before', dist: '5m',  accuracy: '±4m', bg: 'linear-gradient(135deg,#d4fde8,#bbf7d0)',  lat: '51.87971', lng: '-0.41380' },
];

const TIMELINE = [
  { time: '06:00', label: 'Clean scheduled',                 status: 'done',    icon: '📋' },
  { time: '06:58', label: 'Operative arrived on site',       status: 'done',    icon: '📍', note: 'GPS confirmed within 10m of site' },
  { time: '07:01', label: 'Before photos uploaded — 3 of 3', status: 'done',    icon: '📷', note: 'All geo-verified within 15m' },
  { time: '07:41', label: 'After photos uploading…',         status: 'done',    icon: '✅', note: '4 uploaded so far, 2 expected' },
  { time: '08:00', label: 'Clean expected complete',         status: 'current', icon: '⏳', note: 'SLA window closes — on track' },
  { time: '08:00', label: 'FM sign-off requested',           status: 'upcoming',icon: '🔔' },
];

const WEEK = [
  { day: 'Mon', date: '5 May',  done: true,  checkout: '07:42', photos: 12, sla: true  },
  { day: 'Tue', date: '6 May',  done: true,  checkout: '07:39', photos: 11, sla: true  },
  { day: 'Wed', date: '7 May',  done: true,  checkout: '07:51', photos: 9,  sla: true  },
  { day: 'Thu', date: '8 May',  done: true,  checkout: '07:44', photos: 14, sla: true  },
  { day: 'Fri', date: '9 May',  done: false, checkout: null,    photos: 7,  sla: null, live: true },
];

function PhotoCard({ photo, showToast }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex gap-0">
        {/* Thumbnail */}
        <div className="w-16 h-16 shrink-0 relative overflow-hidden" style={{ background: photo.bg }}>
          <div className="absolute inset-0 flex items-center justify-center text-2xl opacity-30">
            {photo.emoji}
          </div>
          <div className="absolute top-1 right-1">
            <span className="text-[6px] font-black px-1 py-0.5 rounded text-white"
              style={{ background: photo.phase === 'after' ? '#059669' : '#3b82f6' }}>
              {photo.phase === 'after' ? 'AFT' : 'BEF'}
            </span>
          </div>
        </div>
        {/* Info */}
        <div className="flex-1 px-3 py-2.5 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-bold text-[#010a4f] truncate">{photo.label}</span>
            <span className="text-[10px] text-gray-400 shrink-0 font-mono">{photo.time}</span>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <div className="flex items-center gap-1 text-[10px] text-emerald-700"
              style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 6, padding: '1px 6px' }}>
              <Shield size={9} className="shrink-0" />
              <span className="font-bold">GEO VERIFIED</span>
            </div>
            <span className="text-[10px] text-gray-400">{photo.dist} from site · {photo.accuracy}</span>
          </div>
          <div className="text-[9px] text-gray-300 mt-0.5 font-mono">{photo.lat}, {photo.lng}</div>
        </div>
        <button onClick={() => showToast(`view ${photo.label}`)}
          className="flex items-center px-3 border-l border-gray-50 text-gray-300 hover:text-[#4f78ff] transition-colors">
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

export default function ClientLiveActivity({ showToast, onNavigate }) {
  return (
    <div className="p-6 space-y-6 max-w-2xl">

      {/* ── Live Hero ── */}
      <div className="rounded-2xl overflow-hidden shadow-lg"
        style={{ background: 'linear-gradient(135deg, #010a4f 0%, #0d1f6e 100%)' }}>
        <div className="px-6 pt-6 pb-5">
          <div className="flex items-start gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-pulse" />
                <span className="text-[10px] font-black text-blue-300 tracking-[0.2em] uppercase">Live · 9 May 2026</span>
              </div>
              <div className="text-white font-black text-lg">Next – Luton The Mall</div>
              <div className="text-blue-200 text-sm mt-0.5">Retail morning clean · SLA window 06:00–08:00</div>
              <div className="grid grid-cols-3 gap-3 mt-4">
                {[
                  { label: 'On site since', value: '06:58', icon: <MapPin size={12} className="text-blue-300" /> },
                  { label: 'Photos uploaded', value: '7 / 8', icon: <Camera size={12} className="text-blue-300" /> },
                  { label: 'Est. complete', value: '08:00', icon: <Clock size={12} className="text-blue-300" /> },
                ].map(({ label, value, icon }) => (
                  <div key={label} className="rounded-xl px-3 py-2.5 text-center"
                    style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <div className="flex justify-center mb-1">{icon}</div>
                    <div className="text-white font-black text-sm">{value}</div>
                    <div className="text-[9px] text-blue-200/60 mt-0.5">{label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        {/* GPS bar */}
        <div className="px-6 py-3 flex items-center gap-3"
          style={{ background: 'rgba(16,185,129,0.12)', borderTop: '1px solid rgba(16,185,129,0.2)' }}>
          <Shield size={14} className="text-emerald-400 shrink-0" />
          <div className="flex-1">
            <div className="text-[10px] font-black text-emerald-300 mb-0.5">GPS LOCATION CONFIRMED</div>
            <div className="text-[10px] text-emerald-400/70">Operative confirmed within 15m of site boundary throughout visit · all coordinates tamper-evident</div>
          </div>
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
        </div>
      </div>

      {/* ── Photo Evidence Feed ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">Evidence uploaded today</div>
          <button onClick={() => onNavigate('evidence')}
            className="text-xs text-[#4f78ff] font-bold flex items-center gap-1 hover:underline">
            All evidence <ChevronRight size={12} />
          </button>
        </div>
        <div className="space-y-2">
          {PHOTO_FEED.map(photo => (
            <PhotoCard key={photo.id} photo={photo} showToast={showToast} />
          ))}
        </div>
      </div>

      {/* ── Today's Timeline ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50">
          <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">Today's audit trail</div>
        </div>
        <div className="p-5">
          <div className="relative">
            <div className="absolute left-[14px] top-3 bottom-3 w-px bg-gray-100" />
            <div className="space-y-4">
              {TIMELINE.map(({ time, label, status, icon, note }, i) => (
                <div key={i} className="flex items-start gap-3.5">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm shrink-0 z-10 relative ${
                    status === 'done'     ? 'bg-emerald-50 border border-emerald-200' :
                    status === 'current'  ? 'bg-blue-50 border-2 border-blue-400'     :
                    'bg-gray-50 border border-gray-200'
                  }`}>
                    {status === 'done'
                      ? <span className="text-[10px] text-emerald-600 font-black">✓</span>
                      : <span className="text-xs">{icon}</span>}
                  </div>
                  <div className="flex-1 pb-0.5">
                    <div className="flex items-baseline gap-3">
                      <span className="text-[11px] font-bold text-gray-400 shrink-0 tabular-nums">{time}</span>
                      <span className={`text-sm font-medium ${
                        status === 'done'    ? 'text-[#010a4f]' :
                        status === 'current' ? 'text-blue-700 font-bold' :
                        'text-gray-400'
                      }`}>{label}</span>
                    </div>
                    {note && (
                      <div className={`text-[10px] mt-0.5 ml-12 ${
                        status === 'done'    ? 'text-emerald-600' :
                        status === 'current' ? 'text-blue-500'    :
                        'text-gray-400'
                      }`}>{note}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── This Week ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-4">This week — Next – Luton</div>
        <div className="space-y-2.5">
          {WEEK.map(({ day, date, done, checkout, photos, sla, live }) => (
            <div key={day} className="flex items-center gap-3">
              <div className="w-8 shrink-0">
                <div className="text-xs font-black text-gray-500">{day}</div>
                <div className="text-[9px] text-gray-300">{date.split(' ')[0]}</div>
              </div>
              <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 ${
                live   ? 'bg-blue-100 text-blue-700 border border-blue-300'       :
                done   ? 'bg-emerald-100 text-emerald-700'                        :
                         'bg-gray-100 text-gray-300'
              }`}>
                {live ? '→' : done ? '✓' : '·'}
              </div>
              <div className="flex-1 text-sm font-medium text-[#010a4f]">Morning clean</div>
              {checkout && <div className="text-xs text-gray-400">Done {checkout}</div>}
              {photos > 0 && <div className="text-xs text-gray-400">{photos} photos</div>}
              {sla === false && <div className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">SLA note</div>}
              {live && <div className="flex items-center gap-1 text-xs text-blue-600 font-bold">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                Live
              </div>}
            </div>
          ))}
        </div>
        <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-between">
          <div className="text-[10px] text-gray-400">4/4 completed cleans · 16 photos · 100% SLA this week</div>
          <button onClick={() => onNavigate('history')}
            className="text-xs text-[#4f78ff] font-bold hover:underline flex items-center gap-1">
            Full history <ChevronRight size={11} />
          </button>
        </div>
      </div>

    </div>
  );
}
