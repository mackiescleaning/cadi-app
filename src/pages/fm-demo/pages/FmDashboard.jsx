import { useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import jobs     from '../mock/jobs.json';
import cleaners from '../mock/cleaners.json';
import sites    from '../mock/sites.json';
import { getServiceColour, getJobStatusColour } from '../utils/colours';

const SITE_COORDS = {
  s1:  [52.136, -0.460], s2:  [52.120, -0.470], s3:  [52.140, -0.455],
  s4:  [52.040, -0.780], s5:  [52.038, -0.773], s6:  [51.883, -0.432],
  s7:  [51.757, -0.459], s8:  [51.878, -0.414], s9:  [51.880, -0.420],
  s10: [51.657, -0.396], s11: [52.041, -0.756], s12: [51.816, -0.811],
  s13: [51.875, -0.412], s14: [51.655, -0.399], s15: [51.818, -0.806],
};

const HEAT_ZONES = [
  { latlng: [52.135, -0.462], intensity: 0.55 },
  { latlng: [52.040, -0.775], intensity: 0.42 },
  { latlng: [51.882, -0.428], intensity: 0.65 },
  { latlng: [51.758, -0.460], intensity: 0.38 },
  { latlng: [51.656, -0.398], intensity: 0.48 },
  { latlng: [51.817, -0.810], intensity: 0.35 },
];

const STATUS_DOT = {
  'completed':   '#10b981',
  'in-progress': '#3b82f6',
  'awaiting-qa': '#f59e0b',
  'sla-risk':    '#ef4444',
  'assigned':    '#6366f1',
  'open':        '#9ca3af',
};

function MapStyler() {
  const map = useMap();
  useEffect(() => { map.getContainer().style.background = '#020c3e'; }, [map]);
  return null;
}

const FEED = [
  { time: '09:14', icon: '📍', text: 'Sarah Patel arrived at Riverside Primary',                     type: 'arrival'   },
  { time: '09:08', icon: '✅', text: 'Nursery clean completed — Wharfside Nursery · 7 photos',       type: 'complete'  },
  { time: '08:52', icon: '📸', text: 'Evidence uploaded — MK Hospital North Wing · 6 photos',        type: 'photos'    },
  { time: '08:31', icon: '✅', text: 'School clean completed — Aylesbury College · 9 photos',        type: 'complete'  },
  { time: '08:22', icon: '✅', text: 'Annex clean completed — on time · SLA met',                    type: 'complete'  },
  { time: '07:48', icon: '📍', text: 'Kwame Boateng en route to Riverside Academy',                  type: 'arrival'   },
  { time: '07:41', icon: '⏳', text: 'Civic Centre clean completed — awaiting QA sign-off',          type: 'pending'   },
  { time: '07:10', icon: '⚠️', text: 'SLA risk flagged — Luton Library: cleaner not on site',        type: 'alert'     },
  { time: '06:55', icon: '✅', text: 'Warehouse clean completed — Tesco Hub · 18 photos',            type: 'complete'  },
  { time: '06:42', icon: '📍', text: 'Marcus Webb checked in at Luton Civic Centre',                 type: 'arrival'   },
];

const FEED_COLORS = {
  complete: 'text-emerald-400',
  arrival:  'text-blue-400',
  photos:   'text-indigo-400',
  pending:  'text-amber-400',
  alert:    'text-red-400',
};



function GlassCard({ children, className = '', style = {} }) {
  return (
    <div
      className={`rounded-2xl ${className}`}
      style={{
        background: 'rgba(255,255,255,0.06)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.1)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function StatCard({ label, value, sub, color, icon }) {
  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-3"
      style={{
        background: `linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.04) 100%)`,
        backdropFilter: 'blur(16px)',
        border: `1px solid ${color}25`,
        boxShadow: `0 0 30px ${color}12`,
      }}
    >
      <div className="flex items-start justify-between">
        <div className="text-3xl font-black" style={{ color }}>{value}</div>
        <div className="text-lg opacity-70">{icon}</div>
      </div>
      <div>
        <div className="text-white font-bold text-sm">{label}</div>
        <div className="text-white/40 text-xs mt-0.5">{sub}</div>
      </div>
    </div>
  );
}

export default function FmDashboard({ showToast, onNavigate }) {
  const today      = jobs.filter(j => j.date === '2026-05-09');
  const inProgress = today.filter(j => j.status === 'in-progress').length;
  const awaitingQA = today.filter(j => j.status === 'awaiting-qa').length;
  const alerts     = today.filter(j => j.status === 'sla-risk').length;

  return (
    <div className="p-8 space-y-6 min-h-full">

      {/* SLA alert strip */}
      {alerts > 0 && (
        <div className="flex items-center gap-4 rounded-xl px-5 py-3.5"
          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}>
          <span className="text-red-400 text-base shrink-0">⚠️</span>
          <span className="text-sm font-bold text-red-300 flex-1">
            {alerts} SLA breach risk — Luton Library: cleaner 18 min late
          </span>
          <button onClick={() => onNavigate('live')}
            className="text-xs font-bold text-red-400 hover:text-red-300 underline underline-offset-2 shrink-0 transition-colors">
            View live ops →
          </button>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Jobs today"    value={today.length} sub="across all sites"   color="#4f78ff" icon="📋" />
        <StatCard label="In progress"   value={inProgress}   sub="cleaners on site"   color="#34d399" icon="🔄" />
        <StatCard label="Awaiting QA"   value={awaitingQA}   sub="ready for sign-off" color="#fbbf24" icon="⏳" />
        <StatCard label="SLA hit rate"  value="98%"          sub="this month"         color="#a78bfa" icon="📈" />
      </div>

      {/* Map + Feed row */}
      <div className="grid grid-cols-[1fr_320px] gap-5">

        {/* Coverage map — real Leaflet */}
        <GlassCard style={{ overflow: 'hidden' }}>
          <div className="px-5 pt-4 pb-3 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <div>
              <div className="text-white font-bold text-sm">Coverage map</div>
              <div className="text-white/40 text-xs mt-0.5">Hertfordshire · Bedfordshire · Buckinghamshire</div>
            </div>
            <div className="flex items-center gap-4 text-xs">
              {[['#10b981','Completed'],['#3b82f6','On site'],['#f59e0b','Awaiting QA'],['#ef4444','SLA risk']].map(([c,l]) => (
                <div key={l} className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: c }} />
                  <span className="text-white/50">{l}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ height: 260, position: 'relative' }}>
            <MapContainer
              center={[52.0, -0.5]}
              zoom={9}
              style={{ width: '100%', height: '100%' }}
              zoomControl={false}
              attributionControl={false}
              dragging={false}
              scrollWheelZoom={false}
              doubleClickZoom={false}
            >
              <MapStyler />
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                subdomains="abcd"
                maxZoom={19}
              />
              {HEAT_ZONES.map((zone, i) => (
                <CircleMarker key={`h${i}`} center={zone.latlng}
                  radius={Math.round(zone.intensity * 70)}
                  pathOptions={{ color: 'transparent', fillColor: '#4f78ff', fillOpacity: zone.intensity * 0.25 }}
                />
              ))}
              {today.map(job => {
                const coords = SITE_COORDS[job.siteId];
                if (!coords) return null;
                const color = STATUS_DOT[job.status] || STATUS_DOT.open;
                return (
                  <CircleMarker key={job.id} center={coords} radius={7}
                    pathOptions={{ color: 'rgba(255,255,255,0.4)', weight: 1.5, fillColor: color, fillOpacity: 0.9 }}
                  />
                );
              })}
            </MapContainer>
            <div className="absolute bottom-3 left-4 z-[1000] text-white/30 text-xs font-medium pointer-events-none"
              style={{ textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>
              {today.length} jobs today
            </div>
          </div>
        </GlassCard>

        {/* Live activity feed */}
        <GlassCard className="flex flex-col">
          <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="text-white font-bold text-sm">Live activity</div>
            <div className="text-white/40 text-xs mt-0.5">Real-time updates</div>
          </div>
          <div className="flex-1 overflow-y-auto" style={{ maxHeight: 300 }}>
            {FEED.map((item, i) => (
              <div key={i} className="flex items-start gap-3 px-5 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <span className="text-[10px] font-bold text-white/30 shrink-0 mt-0.5 w-10">{item.time}</span>
                <span className="text-xs text-white/60 leading-relaxed flex-1">{item.text}</span>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      {/* Today's jobs table */}
      <GlassCard>
        <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="text-white font-bold text-sm">Today's jobs</div>
          <span className="text-white/40 text-xs">{today.length} scheduled</span>
        </div>
        {/* Table header */}
        <div className="grid px-6 py-2.5" style={{ gridTemplateColumns: '1fr 160px 140px 90px 110px' }}>
          {['Site', 'Cleaner', 'Service / Window', 'Value', 'Status'].map(h => (
            <div key={h} className="text-[10px] font-black uppercase tracking-widest text-white/25">{h}</div>
          ))}
        </div>
        <div>
          {today.slice(0, 10).map(job => {
            const site    = sites.find(s => s.id === job.siteId);
            const cleaner = cleaners.find(c => c.id === job.cleanerId);
            const st      = getJobStatusColour(job.status);
            const sc      = getServiceColour(job.service);
            return (
              <div key={job.id}
                className="grid px-6 py-3 transition-colors"
                style={{
                  gridTemplateColumns: '1fr 160px 140px 90px 110px',
                  borderTop: '1px solid rgba(255,255,255,0.05)',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                onMouseLeave={e => e.currentTarget.style.background = ''}
              >
                <div>
                  <div className="text-white font-medium text-sm truncate">{site?.name || '—'}</div>
                  <div className="text-white/35 text-xs truncate">{site?.address?.split(',')[0]}</div>
                </div>
                <div className="text-white/70 text-sm self-center truncate">{cleaner?.name || <span className="text-white/30">Unassigned</span>}</div>
                <div className="self-center">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: sc.bg, border: `1px solid ${sc.border}`, color: sc.text }}>
                    {job.service}
                  </span>
                  <div className="text-white/35 text-xs mt-0.5">{job.timeWindow}</div>
                </div>
                <div className="text-white font-bold text-sm self-center">£{job.value}</div>
                <div className="self-center">
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: st.bg, border: `1px solid ${st.border}`, color: st.color }}>
                    {st.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </GlassCard>
    </div>
  );
}
