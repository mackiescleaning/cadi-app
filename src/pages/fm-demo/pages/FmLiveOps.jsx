import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import jobs     from '../mock/jobs.json';
import cleaners from '../mock/cleaners.json';
import sites    from '../mock/sites.json';
import clients  from '../mock/clients.json';
import { getServiceColour, getJobStatusColour } from '../utils/colours';

// ── Real UK coordinates derived from site postcodes ──────────────────────────
const SITE_COORDS = {
  s1:  [52.136, -0.460],   // Riverside Primary — Bedford MK41
  s2:  [52.120, -0.470],   // Oakhill Secondary — Bedford MK42
  s3:  [52.140, -0.455],   // Wharfside Nursery — Bedford MK40
  s4:  [52.040, -0.780],   // MK Hospital — Milton Keynes MK6
  s5:  [52.038, -0.773],   // Premier Inn MK — Milton Keynes MK6
  s6:  [51.883, -0.432],   // Tesco Hub — Luton LU3
  s7:  [51.757, -0.459],   // Crown Gate — Hemel Hempstead HP1
  s8:  [51.878, -0.414],   // Luton Civic Centre — Luton LU1
  s9:  [51.880, -0.420],   // Luton Library — Luton LU1
  s10: [51.657, -0.396],   // Watford Life Sciences — Watford WD18
  s11: [52.041, -0.756],   // MK Retail Park — Milton Keynes MK9
  s12: [51.816, -0.811],   // Aylesbury College — Aylesbury HP21
  s13: [51.875, -0.412],   // Luton Airport Hotel — Luton LU2
  s14: [51.655, -0.399],   // Watford Offices — Watford WD18
  s15: [51.818, -0.806],   // Aylesbury Civic — Aylesbury HP21
};

// ── Heat zones — density blobs across the region ─────────────────────────────
const HEAT_ZONES = [
  { latlng: [52.135, -0.462], radius: 28000, intensity: 0.55 },  // Bedford cluster
  { latlng: [52.040, -0.775], radius: 22000, intensity: 0.42 },  // Milton Keynes
  { latlng: [51.882, -0.428], radius: 24000, intensity: 0.65 },  // Luton
  { latlng: [51.758, -0.460], radius: 18000, intensity: 0.38 },  // Hemel Hempstead
  { latlng: [51.656, -0.398], radius: 20000, intensity: 0.48 },  // Watford
  { latlng: [51.817, -0.810], radius: 16000, intensity: 0.35 },  // Aylesbury
  { latlng: [51.900, -0.600], radius: 14000, intensity: 0.22 },  // St Albans area
  { latlng: [52.200, -0.250], radius: 12000, intensity: 0.18 },  // Stevenage area
];

const STATUS_DOT = {
  'in-progress': { color: '#3b82f6', pulse: true  },
  'assigned':    { color: '#6366f1', pulse: false },
  'completed':   { color: '#10b981', pulse: false },
  'awaiting-qa': { color: '#f59e0b', pulse: false },
  'sla-risk':    { color: '#ef4444', pulse: true  },
  'disputed':    { color: '#ef4444', pulse: false },
  'open':        { color: '#9ca3af', pulse: false },
};

function MapStyler() {
  const map = useMap();
  useEffect(() => {
    map.getContainer().style.background = '#020c3e';
  }, [map]);
  return null;
}

export default function FmLiveOps({ showToast }) {
  const [selected, setSelected] = useState(null);

  const liveJobs = jobs.filter(j =>
    ['in-progress','assigned','sla-risk','awaiting-qa'].includes(j.status)
  );

  const sel        = liveJobs.find(j => j.id === selected);
  const selSite    = sel ? sites.find(s => s.id === sel.siteId)    : null;
  const selCleaner = sel?.cleanerId ? cleaners.find(c => c.id === sel.cleanerId) : null;
  const selClient  = sel ? clients.find(c => c.id === sel.clientId) : null;

  const inProgressCount = liveJobs.filter(j => j.status === 'in-progress').length;
  const slaRiskCount    = liveJobs.filter(j => j.status === 'sla-risk').length;
  const assignedCount   = liveJobs.filter(j => j.status === 'assigned').length;

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Left: job list ── */}
      <div className="w-72 flex flex-col overflow-hidden flex-shrink-0"
        style={{ borderRight: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="px-5 py-4 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="text-white font-bold text-sm">Live operations</div>
          <div className="flex items-center gap-3 mt-2 text-xs">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400 inline-block" /><span className="text-white/50">{inProgressCount} on site</span></span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" /><span className="text-white/50">{slaRiskCount} SLA risk</span></span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-400 inline-block" /><span className="text-white/50">{assignedCount} en route</span></span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {liveJobs.map(job => {
            const site    = sites.find(s => s.id === job.siteId);
            const cleaner = cleaners.find(c => c.id === job.cleanerId);
            const st      = getJobStatusColour(job.status);
            const sc      = getServiceColour(job.service);
            const isActive = selected === job.id;
            const dot     = STATUS_DOT[job.status] || STATUS_DOT.open;
            return (
              <button key={job.id}
                onClick={() => setSelected(job.id === selected ? null : job.id)}
                className="w-full p-3.5 rounded-xl text-left transition-all"
                style={{
                  background: isActive ? 'rgba(79,120,255,0.14)' : 'rgba(255,255,255,0.05)',
                  border: isActive ? '1px solid rgba(79,120,255,0.4)' : '1px solid rgba(255,255,255,0.08)',
                  backdropFilter: 'blur(12px)',
                }}>
                <div className="flex items-start gap-2.5">
                  <div className="w-2 h-2 rounded-full mt-1 shrink-0 relative">
                    {dot.pulse && <div className="absolute -inset-1 rounded-full animate-ping opacity-40" style={{ backgroundColor: dot.color }} />}
                    <div className="relative w-2 h-2 rounded-full" style={{ backgroundColor: dot.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-white font-bold text-xs truncate">{site?.name}</div>
                    <div className="text-white/40 text-[10px] truncate mt-0.5">{cleaner?.name || 'Unassigned'}</div>
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{ background: sc.bg, border: `1px solid ${sc.border}`, color: sc.text }}>
                        {job.service}
                      </span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{ background: st.bg, border: `1px solid ${st.border}`, color: st.color }}>
                        {st.label}
                      </span>
                    </div>
                  </div>
                  <div className="text-white/30 text-[10px] shrink-0">{job.timeWindow?.split('–')[0]}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Centre: real map ── */}
      <div className="flex-1 relative overflow-hidden">
        <MapContainer
          center={[52.0, -0.5]}
          zoom={9}
          style={{ width: '100%', height: '100%', background: '#020c3e' }}
          zoomControl={false}
          attributionControl={false}
        >
          <MapStyler />
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://carto.com/">CARTO</a>'
            subdomains="abcd"
            maxZoom={19}
          />

          {/* Heatmap blobs */}
          {HEAT_ZONES.map((zone, i) => (
            <CircleMarker
              key={`heat-${i}`}
              center={zone.latlng}
              radius={Math.round(zone.intensity * 80)}
              pathOptions={{
                color: 'transparent',
                fillColor: '#4f78ff',
                fillOpacity: zone.intensity * 0.28,
              }}
            />
          ))}

          {/* Job pins */}
          {liveJobs.map(job => {
            const coords = SITE_COORDS[job.siteId];
            if (!coords) return null;
            const site    = sites.find(s => s.id === job.siteId);
            const cleaner = cleaners.find(c => c.id === job.cleanerId);
            const dot     = STATUS_DOT[job.status] || STATUS_DOT.open;
            const sc      = getServiceColour(job.service);
            const isActive = selected === job.id;
            return (
              <CircleMarker
                key={job.id}
                center={coords}
                radius={isActive ? 12 : 8}
                pathOptions={{
                  color: isActive ? '#ffffff' : dot.color,
                  weight: isActive ? 2.5 : 1.5,
                  fillColor: dot.color,
                  fillOpacity: isActive ? 1 : 0.85,
                }}
                eventHandlers={{ click: () => setSelected(job.id === selected ? null : job.id) }}
              >
                <Popup className="cadi-popup">
                  <div style={{ background: '#0d1b4f', border: '1px solid rgba(79,120,255,0.3)', borderRadius: 12, padding: '10px 14px', minWidth: 200 }}>
                    <div style={{ color: 'white', fontWeight: 800, fontSize: 13, marginBottom: 2 }}>{site?.name}</div>
                    <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginBottom: 8 }}>{cleaner?.name || 'Unassigned'}</div>
                    <span style={{ background: sc.bg, border: `1px solid ${sc.border}`, color: sc.text, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999 }}>
                      {job.service}
                    </span>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>

        {/* Map legend overlay */}
        <div className="absolute bottom-5 left-5 rounded-xl px-4 py-3 space-y-1.5 z-[1000]"
          style={{ background: 'rgba(2,12,62,0.85)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.1)' }}>
          {[
            { color: '#3b82f6', label: 'On site'     },
            { color: '#6366f1', label: 'En route'    },
            { color: '#f59e0b', label: 'Awaiting QA' },
            { color: '#ef4444', label: 'SLA risk'    },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
              <span className="text-white/55 text-xs">{label}</span>
            </div>
          ))}
          <div className="pt-1 mt-1" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full shrink-0 bg-[#4f78ff] opacity-50" />
              <span className="text-white/55 text-xs">Demand heat</span>
            </div>
          </div>
        </div>

        {/* Zoom buttons */}
        <div className="absolute top-4 right-4 flex flex-col gap-1 z-[1000]">
          <button className="w-8 h-8 rounded-lg text-white font-bold text-lg flex items-center justify-center transition-colors"
            style={{ background: 'rgba(2,12,62,0.85)', border: '1px solid rgba(255,255,255,0.15)' }}>+</button>
          <button className="w-8 h-8 rounded-lg text-white font-bold text-lg flex items-center justify-center transition-colors"
            style={{ background: 'rgba(2,12,62,0.85)', border: '1px solid rgba(255,255,255,0.15)' }}>−</button>
        </div>
      </div>

      {/* ── Right: selected job detail ── */}
      <div className="w-80 flex-shrink-0 overflow-y-auto"
        style={{ borderLeft: '1px solid rgba(255,255,255,0.07)' }}>
        {!sel ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-center px-6">
            <div className="text-3xl opacity-25">📍</div>
            <div className="text-white/35 text-sm font-medium">Select a job from the list or click a map pin</div>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            {/* Header */}
            <div>
              <div className="text-white font-black text-base">{selSite?.name}</div>
              <div className="text-white/45 text-sm mt-0.5">{selClient?.name}</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(() => {
                  const sc = getServiceColour(sel.service);
                  const st = getJobStatusColour(sel.status);
                  return (<>
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                      style={{ background: sc.bg, border: `1px solid ${sc.border}`, color: sc.text }}>
                      {sel.service}
                    </span>
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                      style={{ background: st.bg, border: `1px solid ${st.border}`, color: st.color }}>
                      {st.label}
                    </span>
                  </>);
                })()}
              </div>
            </div>

            {/* Cleaner */}
            {selCleaner && (
              <div className="rounded-xl p-4 flex items-center gap-3"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <div className="w-10 h-10 rounded-xl bg-[#4f78ff]/20 border border-[#4f78ff]/25 text-white flex items-center justify-center text-sm font-black shrink-0">
                  {selCleaner.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-white font-bold text-sm">{selCleaner.name}</div>
                  <div className="text-white/40 text-xs">{selCleaner.town}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-black" style={{ color: '#f59e0b' }}>{selCleaner.score}</div>
                  <div className="text-white/30 text-[10px]">score</div>
                </div>
              </div>
            )}

            {/* Details grid */}
            <div className="rounded-xl p-4 space-y-2.5"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)' }}>
              {[
                { label: 'Time window', value: sel.timeWindow },
                { label: 'SLA window',  value: selSite?.slaWindow || '06:00–08:00' },
                { label: 'Date',        value: sel.date },
                { label: 'Value',       value: `£${sel.value}` },
                { label: 'Evidence',    value: sel.evidenceCount ? `${sel.evidenceCount} photos` : 'Not yet' },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between text-xs">
                  <span className="text-white/35">{label}</span>
                  <span className="text-white font-medium">{value || '—'}</span>
                </div>
              ))}
            </div>

            {/* SLA risk alert */}
            {sel.status === 'sla-risk' && (
              <div className="rounded-xl px-4 py-3"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
                <div className="text-red-400 font-black text-xs mb-1">⚠ SLA Breach Risk</div>
                <div className="text-red-300/80 text-xs">Cleaner not yet on site. SLA window closes soon.</div>
              </div>
            )}

            {/* Actions */}
            <div className="space-y-2">
              <button onClick={() => showToast(`contact cleaner for job at ${selSite?.name}`)}
                className="w-full py-2.5 rounded-xl text-xs font-bold text-white transition-colors"
                style={{ background: 'rgba(79,120,255,0.2)', border: '1px solid rgba(79,120,255,0.4)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(79,120,255,0.32)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(79,120,255,0.2)'}>
                Contact cleaner
              </button>
              {sel.status === 'awaiting-qa' && (
                <button onClick={() => showToast(`review QA evidence for job at ${selSite?.name}`)}
                  className="w-full py-2.5 rounded-xl text-xs font-bold text-white transition-colors"
                  style={{ background: 'rgba(245,158,11,0.2)', border: '1px solid rgba(245,158,11,0.4)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(245,158,11,0.32)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(245,158,11,0.2)'}>
                  Review QA evidence →
                </button>
              )}
              {sel.status === 'sla-risk' && (
                <button onClick={() => showToast(`find cover for SLA risk job at ${selSite?.name}`)}
                  className="w-full py-2.5 rounded-xl text-xs font-bold text-white transition-colors"
                  style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.32)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(239,68,68,0.2)'}>
                  Find emergency cover →
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
