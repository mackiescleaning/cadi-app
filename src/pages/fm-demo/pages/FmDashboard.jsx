import { useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import jobs     from '../mock/jobs.json';
import cleaners from '../mock/cleaners.json';
import sites    from '../mock/sites.json';
import { getServiceColour, getJobStatusColour } from '../utils/colours';

const SITE_COORDS = {
  s1:  [51.880, -0.413], s2:  [52.042, -0.754], s3:  [51.657, -0.396],
  s4:  [51.886, -0.452], s5:  [51.885, -0.451], s6:  [51.882, -0.530],
  s7:  [51.656, -0.396], s8:  [51.879, -0.413], s9:  [51.879, -0.416],
  s10: [51.878, -0.424], s11: [51.874, -0.370], s12: [52.036, -0.338],
  s13: [51.879, -0.413], s14: [52.135, -0.465], s15: [51.886, -0.524],
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

const FEED = [
  { time: '09:14', text: 'Sarah Patel arrived at Next – Luton The Mall',                    type: 'arrival'  },
  { time: '09:08', text: 'Retail clean completed — Next Watford · 7 photos',                type: 'complete' },
  { time: '08:52', text: 'Evidence uploaded — L&D Hospital Main Tower · 6 photos',          type: 'photos'   },
  { time: '08:31', text: 'Campus clean completed — UoB Luton Campus · 9 photos',            type: 'complete' },
  { time: '08:22', text: 'Offices clean completed — Watling House · SLA met',               type: 'complete' },
  { time: '07:48', text: 'Kwame Boateng en route to Central Beds – Priory House',           type: 'arrival'  },
  { time: '07:41', text: 'Customer Service Centre — awaiting QA sign-off',                  type: 'pending'  },
  { time: '07:10', text: 'SLA risk flagged — Luton Central Library: cleaner not on site',  type: 'alert'    },
  { time: '06:55', text: 'Distribution clean completed — Aldi Dunstable RDC · 18 photos',  type: 'complete' },
  { time: '06:42', text: 'Marcus Webb checked in at Luton Customer Service Centre',         type: 'arrival'  },
];

const FEED_META = {
  complete: { color: '#34d399', bg: 'rgba(52,211,153,0.12)',  border: 'rgba(52,211,153,0.25)',  dot: '✓' },
  arrival:  { color: '#60a5fa', bg: 'rgba(96,165,250,0.12)',  border: 'rgba(96,165,250,0.25)',  dot: '↗' },
  photos:   { color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.25)', dot: '⬡' },
  pending:  { color: '#fbbf24', bg: 'rgba(251,191,36,0.12)',  border: 'rgba(251,191,36,0.25)',  dot: '◎' },
  alert:    { color: '#f87171', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.25)', dot: '!' },
};

function MapStyler() {
  const map = useMap();
  useEffect(() => { map.getContainer().style.background = '#010b38'; }, [map]);
  return null;
}

function Sparkline({ data, color, id }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 88, h = 32;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * h * 0.75 - h * 0.1;
    return [x, y];
  });
  const linePath = `M ${pts.map(p => p.join(',')).join(' L ')}`;
  const areaPath = `M 0,${h} L ${pts.map(p => p.join(',')).join(' L ')} L ${w},${h} Z`;
  const gradId = `spark-${id}`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* End dot */}
      <circle cx={pts[pts.length-1][0]} cy={pts[pts.length-1][1]} r="2.5" fill={color} />
    </svg>
  );
}

function StatCard({ label, value, sub, color, sparkData, sparkId, trend }) {
  return (
    <div className="rounded-2xl p-5 relative overflow-hidden flex flex-col gap-0" style={{
      background: 'rgba(255,255,255,0.05)',
      backdropFilter: 'blur(20px)',
      border: `1px solid ${color}28`,
      boxShadow: `0 0 0 0 transparent, inset 0 1px 0 rgba(255,255,255,0.07)`,
    }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 0 40px ${color}18, inset 0 1px 0 rgba(255,255,255,0.1)`; e.currentTarget.style.borderColor = `${color}50`; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = `0 0 0 0 transparent, inset 0 1px 0 rgba(255,255,255,0.07)`; e.currentTarget.style.borderColor = `${color}28`; }}
    >
      {/* Corner glow */}
      <div style={{
        position: 'absolute', top: -24, right: -24,
        width: 80, height: 80, borderRadius: '50%',
        background: `radial-gradient(circle, ${color}22 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      <div className="flex items-start justify-between mb-2">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold shrink-0"
          style={{ background: `${color}15`, border: `1px solid ${color}25`, color }}>
          {trend ? '↑' : '◈'}
        </div>
        {trend && (
          <span className="text-[10px] font-black px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399', border: '1px solid rgba(52,211,153,0.2)' }}>
            {trend}
          </span>
        )}
      </div>

      {/* Gradient value */}
      <div className="text-3xl font-black leading-none mb-1.5" style={{
        background: `linear-gradient(135deg, white 20%, ${color} 100%)`,
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
      }}>{value}</div>

      <div className="text-white/80 font-bold text-sm leading-tight">{label}</div>
      <div className="text-white/30 text-xs mt-0.5 mb-3">{sub}</div>

      {sparkData && (
        <div className="flex justify-end opacity-70 mt-auto">
          <Sparkline data={sparkData} color={color} id={sparkId} />
        </div>
      )}
    </div>
  );
}

function GlassCard({ children, className = '', style = {} }) {
  return (
    <div className={`rounded-2xl ${className}`} style={{
      background: 'rgba(255,255,255,0.05)',
      backdropFilter: 'blur(20px)',
      border: '1px solid rgba(255,255,255,0.08)',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.07)',
      ...style,
    }}>
      {children}
    </div>
  );
}

const IMPACT = [
  { before: 'Morning ops round: calls, WhatsApp, chasing no-shows', after: 'Every site, every region — covered or flagged, no calls needed', icon: '📍' },
  { before: 'SLA breach discovered when the client calls you',       after: 'Site flagged before the window closes — you act, not your client', icon: '⏱' },
  { before: 'Cover gap at 5am — 2 hours of calls to fill it',        after: 'Cover pool visible in advance — gaps filled before the shift starts', icon: '🔄' },
  { before: 'Margin erosion invisible until the contract review',    after: 'Cost vs revenue per contract visible every week',                    icon: '💷' },
];

export default function FmDashboard({ showToast, onNavigate }) {
  const today      = jobs.filter(j => j.date === '2026-05-09');
  const inProgress = today.filter(j => j.status === 'in-progress').length;
  const awaitingQA = today.filter(j => j.status === 'awaiting-qa').length;
  const alerts     = today.filter(j => j.status === 'sla-risk').length;

  return (
    <div className="p-8 space-y-6 min-h-full">

      {/* Before → With Cadi strip */}
      <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(79,120,255,0.18)', background: 'rgba(1,8,40,0.6)' }}>
        <div className="px-5 py-3 flex items-center gap-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(79,120,255,0.06)' }}>
          <div className="text-[9px] font-black uppercase tracking-widest text-white/30">What Cadi replaces</div>
          <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
          <div className="text-[9px] font-black uppercase tracking-widest" style={{ color: '#4f78ff' }}>With Cadi</div>
        </div>
        <div className="grid grid-cols-4 divide-x" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          {IMPACT.map(({ before, after, icon }) => (
            <div key={icon} className="px-4 py-3.5">
              <div className="text-lg mb-2">{icon}</div>
              <div className="text-[10px] text-white/30 leading-snug mb-2 line-through decoration-white/20">{before}</div>
              <div className="text-[10px] font-bold leading-snug" style={{ color: '#60a5fa' }}>{after}</div>
            </div>
          ))}
        </div>
      </div>

      {/* SLA alert strip */}
      {alerts > 0 && (
        <div className="flex items-center gap-4 rounded-xl px-5 py-3.5 relative overflow-hidden"
          style={{
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.3)',
            boxShadow: '0 0 30px rgba(239,68,68,0.08)',
          }}>
          <div style={{
            position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
            background: 'linear-gradient(180deg, transparent, #ef4444, transparent)',
          }} />
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-sm"
            style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', animation: 'alert-pulse 2s ease-in-out infinite' }}>
            ⚠
          </div>
          <span className="text-sm font-bold text-red-300 flex-1">
            {alerts} SLA breach risk — Luton Library: cleaner 18 min late
          </span>
          <button onClick={() => onNavigate('live')}
            className="text-xs font-black px-3 py-1.5 rounded-lg transition-all hover:brightness-110 shrink-0"
            style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.35)', color: '#fca5a5' }}>
            View live ops →
          </button>
        </div>
      )}

      {/* TUPE active alert card */}
      <button
        onClick={() => onNavigate('tupe')}
        className="w-full text-left rounded-2xl overflow-hidden transition-all"
        style={{
          background: 'rgba(99,102,241,0.06)',
          border: '1px solid rgba(99,102,241,0.28)',
          boxShadow: '0 0 24px rgba(99,102,241,0.06)',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.11)'; e.currentTarget.style.borderColor = 'rgba(99,102,241,0.45)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.06)'; e.currentTarget.style.borderColor = 'rgba(99,102,241,0.28)'; }}
      >
        <div className="flex items-center gap-4 px-5 py-3.5 relative">
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: 'linear-gradient(180deg, transparent, #6366f1, transparent)', borderRadius: '2px 0 0 2px' }} />
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-base"
            style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)' }}>
            👥
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-sm font-black text-white">TUPE in progress</span>
              <span className="text-[9px] font-black px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.35)', color: '#a5b4fc' }}>
                ACTIVE
              </span>
            </div>
            <div className="text-xs text-white/45">
              Asda Luton — 24 staff transferring · <span style={{ color: '#a5b4fc', fontWeight: 700 }}>Day 12 of 28</span> · 3 actions outstanding
            </div>
          </div>
          {/* Progress bar */}
          <div className="shrink-0 flex flex-col items-end gap-1">
            <div className="text-[10px] font-black text-white/30">43% complete</div>
            <div className="w-28 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <div className="h-full rounded-full" style={{ width: '43%', background: 'linear-gradient(90deg, #6366f1, #818cf8)' }} />
            </div>
          </div>
          <div className="text-indigo-400 text-sm shrink-0">→</div>
        </div>
      </button>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="Jobs today"   value={today.length}  sub="across all sites"
          color="#4f78ff"  sparkId="jobs"
          sparkData={[8,11,9,13,12,15,14,15]}  trend="+2 vs yesterday"
        />
        <StatCard
          label="On site now"  value={inProgress}    sub="cleaners active"
          color="#34d399"  sparkId="active"
          sparkData={[1,2,3,2,4,3,4,3]}
        />
        <StatCard
          label="Awaiting QA"  value={awaitingQA}    sub="ready for sign-off"
          color="#fbbf24"  sparkId="qa"
          sparkData={[3,4,2,5,3,4,3,2]}
        />
        <StatCard
          label="Cover rate"   value="97%"            sub="shifts filled this week"
          color="#a78bfa"  sparkId="cover"
          sparkData={[91,93,94,92,95,96,96,97]}  trend="↑ 3pts vs last week"
        />
      </div>

      {/* Map + Feed row */}
      <div className="grid grid-cols-[1fr_310px] gap-5">

        {/* Coverage map */}
        <GlassCard style={{ overflow: 'hidden' }}>
          <div className="px-5 pt-4 pb-3 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div>
              <div className="text-white font-bold text-sm">Coverage map</div>
              <div className="text-white/35 text-xs mt-0.5">Hertfordshire · Bedfordshire · Buckinghamshire</div>
            </div>
            <div className="flex items-center gap-3 text-xs">
              {[['#10b981','Completed'],['#3b82f6','On site'],['#f59e0b','Awaiting QA'],['#ef4444','SLA risk']].map(([c,l]) => (
                <div key={l} className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: c, boxShadow: `0 0 4px ${c}` }} />
                  <span className="text-white/40">{l}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ height: 260, position: 'relative' }}>
            <MapContainer
              center={[52.0, -0.5]} zoom={9}
              style={{ width: '100%', height: '100%' }}
              zoomControl={true} attributionControl={false}
              dragging={true} scrollWheelZoom={true} doubleClickZoom={true}
            >
              <MapStyler />
              <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" subdomains="abcd" maxZoom={19} />
              {HEAT_ZONES.map((zone, i) => (
                <CircleMarker key={`h${i}`} center={zone.latlng}
                  radius={Math.round(zone.intensity * 70)}
                  pathOptions={{ color: 'transparent', fillColor: '#4f78ff', fillOpacity: zone.intensity * 0.25 }} />
              ))}
              {today.map(job => {
                const coords = SITE_COORDS[job.siteId];
                if (!coords) return null;
                const color = STATUS_DOT[job.status] || STATUS_DOT.open;
                return (
                  <CircleMarker key={job.id} center={coords} radius={7}
                    pathOptions={{ color: 'rgba(255,255,255,0.35)', weight: 1.5, fillColor: color, fillOpacity: 0.9 }} />
                );
              })}
            </MapContainer>
            <div className="absolute bottom-3 left-4 z-[1000] pointer-events-none">
              <span className="text-white/40 text-xs font-medium px-2.5 py-1 rounded-lg"
                style={{ background: 'rgba(1,11,56,0.7)', backdropFilter: 'blur(8px)' }}>
                {today.length} jobs today
              </span>
            </div>
          </div>
        </GlassCard>

        {/* Live activity feed */}
        <GlassCard className="flex flex-col">
          <div className="px-5 py-4 flex items-center justify-between flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div>
              <div className="text-white font-bold text-sm">Live activity</div>
              <div className="text-white/35 text-xs mt-0.5">Real-time updates</div>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" style={{ boxShadow: '0 0 6px #34d399', animation: 'alert-pulse 2s ease-in-out infinite' }} />
              <span className="text-white/30 text-[10px] font-bold">LIVE</span>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto py-2" style={{ maxHeight: 300 }}>
            {FEED.map((item, i) => {
              const meta = FEED_META[item.type];
              return (
                <div key={i} className="flex items-start gap-3 px-4 py-2.5 transition-colors"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                  onMouseLeave={e => e.currentTarget.style.background = ''}>
                  <div className="w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-black shrink-0 mt-0.5"
                    style={{ background: meta.bg, border: `1px solid ${meta.border}`, color: meta.color }}>
                    {meta.dot}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-white/65 text-xs leading-snug">{item.text}</div>
                  </div>
                  <span className="text-[10px] font-bold text-white/25 shrink-0 mt-0.5">{item.time}</span>
                </div>
              );
            })}
          </div>
        </GlassCard>
      </div>

      {/* Today's jobs table */}
      <GlassCard>
        <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="text-white font-bold text-sm">Today's jobs</div>
          <span className="text-white/30 text-xs font-bold px-2.5 py-1 rounded-lg"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
            {today.length} scheduled
          </span>
        </div>
        <div className="grid px-6 py-2.5" style={{ gridTemplateColumns: '1fr 160px 140px 90px 110px' }}>
          {['Site', 'Cleaner', 'Service / Window', 'Value', 'Status'].map(h => (
            <div key={h} className="text-[10px] font-black uppercase tracking-widest text-white/20">{h}</div>
          ))}
        </div>
        <div>
          {today.slice(0, 10).map((job, idx) => {
            const site    = sites.find(s => s.id === job.siteId);
            const cleaner = cleaners.find(c => c.id === job.cleanerId);
            const st      = getJobStatusColour(job.status);
            const sc      = getServiceColour(job.service);
            return (
              <div key={job.id}
                className="grid px-6 py-3.5 transition-all cursor-default"
                style={{
                  gridTemplateColumns: '1fr 160px 140px 90px 110px',
                  borderTop: '1px solid rgba(255,255,255,0.04)',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(79,120,255,0.05)'; e.currentTarget.style.borderTopColor = 'rgba(79,120,255,0.12)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.borderTopColor = 'rgba(255,255,255,0.04)'; }}
              >
                <div className="self-center">
                  <div className="text-white font-semibold text-sm truncate">{site?.name || '—'}</div>
                  <div className="text-white/30 text-xs truncate mt-0.5">{site?.address?.split(',')[0]}</div>
                </div>
                <div className="text-white/60 text-sm self-center truncate">{cleaner?.name || <span className="text-white/25 italic">Unassigned</span>}</div>
                <div className="self-center">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: sc.bg, border: `1px solid ${sc.border}`, color: sc.text }}>
                    {job.service}
                  </span>
                  <div className="text-white/30 text-xs mt-0.5">{job.timeWindow}</div>
                </div>
                <div className="text-white font-bold text-sm self-center">
                  <span className="text-white/40 text-xs mr-0.5">£</span>{job.value}
                </div>
                <div className="self-center">
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                    style={{ background: st.bg, border: `1px solid ${st.border}`, color: st.color, boxShadow: `0 0 8px ${st.color}20` }}>
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
