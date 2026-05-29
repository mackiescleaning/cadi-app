import { useState } from 'react';
import { Shield, MapPin, Clock, Copy, ExternalLink, ChevronRight, CheckCircle2, AlertCircle, X } from 'lucide-react';

const BLUE  = '#4f78ff';
const GREEN = '#10b981';
const AMBER = '#f59e0b';

const SITES = [
  {
    id: 's1',
    name: 'Next – Luton The Mall',
    address: 'Bute Street, Luton LU1 2TL',
    client: 'Next Retail UK Ltd',
    clientRef: 'NX-LTN-0041',
    service: 'Retail morning clean',
    freq: 'Mon–Sat',
    window: '06:00–08:00',
    score: 97,
    cleans: 47,
    sla: 98,
    avgTime: 64,
    photos: 312,
    issues: { raised: 3, resolved: 3 },
    cleaner: { name: 'Maria Kowalski', score: 91, avatar: 'MK' },
    recentCleans: [
      { date: '9 May',  time: '06:58–08:03', sla: true,  photos: 7,  value: 85,  geo: true  },
      { date: '8 May',  time: '07:01–08:05', sla: true,  photos: 6,  value: 85,  geo: true  },
      { date: '7 May',  time: '06:55–08:00', sla: true,  photos: 8,  value: 85,  geo: true  },
      { date: '6 May',  time: '07:10–08:15', sla: false, photos: 5,  value: 85,  geo: true  },
      { date: '5 May',  time: '06:59–08:02', sla: true,  photos: 9,  value: 85,  geo: true  },
    ],
  },
  {
    id: 's2',
    name: 'Luton Central Library',
    address: 'St George\'s Square, Luton LU1 2NG',
    client: 'Luton Borough Council',
    clientRef: 'LBC-LIB-0018',
    service: 'Evening clean',
    freq: 'Mon–Fri',
    window: '18:00–20:00',
    score: 94,
    cleans: 38,
    sla: 97,
    avgTime: 58,
    photos: 228,
    issues: { raised: 2, resolved: 2 },
    cleaner: { name: 'Sarah Patel', score: 88, avatar: 'SP' },
    recentCleans: [
      { date: '9 May',  time: '18:02–19:58', sla: true,  photos: 6,  value: 68,  geo: true  },
      { date: '8 May',  time: '18:18–20:05', sla: false, photos: 5,  value: 68,  geo: true  },
      { date: '7 May',  time: '18:00–19:55', sla: true,  photos: 7,  value: 68,  geo: true  },
      { date: '6 May',  time: '18:05–20:00', sla: true,  photos: 6,  value: 68,  geo: true  },
      { date: '5 May',  time: '18:01–19:59', sla: true,  photos: 8,  value: 68,  geo: true  },
    ],
  },
  {
    id: 's3',
    name: 'Premier Inn Luton Airport',
    address: '2 Percival Way, Luton LU2 9GP',
    client: 'Whitbread Hotels Ltd',
    clientRef: 'WB-LTN-0072',
    service: 'Hotel room changeover',
    freq: 'Daily',
    window: '08:00–14:00',
    score: 99,
    cleans: 61,
    sla: 100,
    avgTime: 280,
    photos: 488,
    issues: { raised: 1, resolved: 1 },
    cleaner: { name: 'Claire Nduka', score: 96, avatar: 'CN' },
    recentCleans: [
      { date: '9 May',  time: '08:05–13:55', sla: true,  photos: 14, value: 220, geo: true  },
      { date: '8 May',  time: '08:00–13:50', sla: true,  photos: 16, value: 220, geo: true  },
      { date: '7 May',  time: '08:02–13:58', sla: true,  photos: 12, value: 220, geo: true  },
      { date: '6 May',  time: '08:10–14:00', sla: true,  photos: 15, value: 220, geo: true  },
      { date: '5 May',  time: '08:00–13:45', sla: true,  photos: 13, value: 220, geo: true  },
    ],
  },
  {
    id: 's4',
    name: 'L&D University Hospital – Main Tower',
    address: 'Lewsey Road, Luton LU4 0DZ',
    client: 'Luton & Dunstable University Hospital NHS FT',
    clientRef: 'LDUH-0034',
    service: 'Daily hospital clean',
    freq: 'Mon–Sat',
    window: '05:00–07:00',
    score: 96,
    cleans: 54,
    sla: 99,
    avgTime: 112,
    photos: 756,
    issues: { raised: 2, resolved: 2 },
    cleaner: { name: 'Tara Hobson', score: 94, avatar: 'TH' },
    recentCleans: [
      { date: '9 May',  time: '05:01–07:00', sla: true,  photos: 18, value: 310, geo: true  },
      { date: '8 May',  time: '05:00–06:58', sla: true,  photos: 16, value: 310, geo: true  },
      { date: '7 May',  time: '05:03–07:05', sla: true,  photos: 21, value: 310, geo: true  },
      { date: '6 May',  time: '05:00–07:02', sla: true,  photos: 19, value: 310, geo: true  },
      { date: '5 May',  time: '05:02–07:01', sla: true,  photos: 17, value: 310, geo: true  },
    ],
  },
];

function ScoreRing({ score }) {
  const color = score >= 97 ? GREEN : score >= 90 ? BLUE : AMBER;
  const r = 42;
  const circumference = 2 * Math.PI * r;
  const dash = (score / 100) * circumference;
  return (
    <div className="relative w-28 h-28 flex items-center justify-center shrink-0">
      <svg width="112" height="112" className="absolute inset-0 -rotate-90">
        <circle cx="56" cy="56" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
        <circle cx="56" cy="56" r={r} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={`${dash} ${circumference}`} strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 8px ${color}60)` }} />
      </svg>
      <div className="text-center">
        <div className="text-3xl font-black" style={{ color }}>{score}</div>
        <div className="text-[9px] text-white/40 font-bold uppercase tracking-wider">score</div>
      </div>
    </div>
  );
}

function ClientReportModal({ site, onClose }) {
  const [copied, setCopied] = useState(false);
  const mockUrl = `clients.britanniagroup.co.uk/report/${site.clientRef}`;

  function handleCopy() {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const scoreColor = site.score >= 97 ? '#059669' : site.score >= 90 ? '#2563eb' : '#d97706';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: 'rgba(1,10,79,0.85)', backdropFilter: 'blur(12px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl" style={{ maxHeight: '90vh', overflowY: 'auto' }}>

        {/* Modal header — share controls (dark) */}
        <div className="px-6 py-4 flex items-center gap-3"
          style={{ background: 'rgba(2,12,62,0.98)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-1">Client share link</div>
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
              <ExternalLink size={12} className="text-white/30 shrink-0" />
              <span className="text-xs text-white/50 font-mono truncate">{mockUrl}</span>
            </div>
          </div>
          <button onClick={handleCopy}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-black text-white transition-all shrink-0"
            style={{ background: copied ? 'rgba(16,185,129,0.25)' : 'rgba(79,120,255,0.25)', border: `1px solid ${copied ? 'rgba(16,185,129,0.4)' : 'rgba(79,120,255,0.4)'}` }}>
            <Copy size={13} />
            {copied ? 'Copied!' : 'Copy link'}
          </button>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Client-facing report — clean white */}
        <div className="bg-white">

          {/* Report header */}
          <div className="px-8 py-6 border-b border-gray-100">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-black text-sm"
                    style={{ background: 'linear-gradient(135deg, #4f78ff, #010a4f)' }}>B</div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Britannia Services Group</span>
                </div>
                <h1 className="text-xl font-black text-gray-900">{site.name}</h1>
                <p className="text-sm text-gray-500 mt-0.5">{site.address}</p>
                <p className="text-xs text-gray-400 mt-1">Client ref: {site.clientRef} · Report generated 9 May 2026 09:14</p>
              </div>
              <div className="text-center shrink-0">
                <div className="text-4xl font-black" style={{ color: scoreColor }}>{site.score}%</div>
                <div className="text-xs font-bold text-gray-500 mt-0.5">Compliance score</div>
                <div className="text-[10px] text-gray-400">May 2026 YTD</div>
              </div>
            </div>
          </div>

          {/* KPI strip */}
          <div className="grid grid-cols-4 border-b border-gray-100">
            {[
              { label: 'Cleans completed', value: site.cleans, sub: 'May 2026 YTD', color: '#2563eb' },
              { label: 'SLA compliance',   value: `${site.sla}%`, sub: 'within time window', color: scoreColor },
              { label: 'Avg. time on site', value: `${site.avgTime}m`, sub: 'per clean', color: '#059669' },
              { label: 'Evidence photos',  value: site.photos.toLocaleString(), sub: 'geo-verified', color: '#7c3aed' },
            ].map(({ label, value, sub, color }) => (
              <div key={label} className="px-6 py-5 border-r border-gray-100 last:border-r-0">
                <div className="text-2xl font-black mb-1" style={{ color }}>{value}</div>
                <div className="text-xs font-bold text-gray-700">{label}</div>
                <div className="text-[10px] text-gray-400 mt-0.5">{sub}</div>
              </div>
            ))}
          </div>

          {/* Recent cleans */}
          <div className="px-8 py-6">
            <h2 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-4">Recent cleans — geo-verified evidence</h2>
            <div className="space-y-2">
              {site.recentCleans.map((clean, i) => (
                <div key={i} className="flex items-center gap-4 px-4 py-3 rounded-xl border border-gray-100 bg-gray-50">
                  <div className="w-12 text-xs font-bold text-gray-500 shrink-0">{clean.date}</div>
                  <div className="w-28 text-xs text-gray-500 shrink-0 font-mono">{clean.time}</div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {clean.sla ? (
                      <span className="flex items-center gap-1 text-[10px] font-black text-emerald-700 px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>
                        <CheckCircle2 size={10} /> SLA met
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[10px] font-black text-amber-700 px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}>
                        <AlertCircle size={10} /> Late
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 shrink-0">
                    <Shield size={10} />
                    {clean.photos} geo-photos
                  </div>
                  <div className="ml-auto text-xs font-black text-gray-700 shrink-0">£{clean.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Geo-verification note */}
          <div className="mx-8 mb-6 rounded-xl px-5 py-4 flex items-start gap-3"
            style={{ background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.2)' }}>
            <Shield size={16} className="text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-black text-emerald-800">All evidence is geo-verified and tamper-evident</div>
              <div className="text-xs text-emerald-700 mt-1 leading-relaxed">
                Every photo carries GPS coordinates (±4–7m accuracy), a precise timestamp, and a SHA-256 audit hash recorded at upload.
                Britannia Group guarantees that all evidence shown here was captured on-site within the agreed SLA window.
              </div>
            </div>
          </div>

          {/* Issues */}
          <div className="px-8 pb-6 border-t border-gray-100 pt-6">
            <h2 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-4">Issues — May 2026</h2>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-sm font-black text-amber-700">{site.issues.raised}</div>
                <div className="text-xs text-gray-600">Issues raised</div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-sm font-black text-emerald-700">{site.issues.resolved}</div>
                <div className="text-xs text-gray-600">Resolved</div>
              </div>
              <div className="flex items-center gap-2 ml-2">
                <CheckCircle2 size={14} className="text-emerald-500" />
                <div className="text-xs font-bold text-emerald-700">100% resolution rate</div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-8 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
            <div className="text-[10px] text-gray-400">
              Issued by Britannia Services Group · Powered by Cadi · {mockUrl}
            </div>
            <div className="text-[10px] text-gray-400">Confidential — for {site.client} use only</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function GlassCard({ children, className = '', style = {} }) {
  return (
    <div className={`rounded-2xl ${className}`}
      style={{ background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.1)', ...style }}>
      {children}
    </div>
  );
}

const IMPACT = [
  { before: 'Monthly PDF report built manually, sent by email', after: 'Live client portal — they see it before you send anything', icon: '📊' },
  { before: 'Clients dispute SLA claims with no proof',         after: 'Geo-verified evidence behind every visit — undisputable',  icon: '🔒' },
  { before: 'Compliance packs take half a day to compile',      after: 'Exportable with one click — always up to date',            icon: '⚡' },
];

export default function FmClientReport({ showToast }) {
  const [selectedSite, setSelectedSite] = useState(SITES[0]);
  const [showModal, setShowModal]       = useState(false);

  const s = selectedSite;
  const scoreColor = s.score >= 97 ? GREEN : s.score >= 90 ? BLUE : AMBER;

  return (
    <div className="p-8 space-y-6 relative">

      {showModal && <ClientReportModal site={s} onClose={() => setShowModal(false)} />}

      {/* Impact strip */}
      <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(79,120,255,0.18)', background: 'rgba(1,8,40,0.6)' }}>
        <div className="px-5 py-2.5 flex items-center gap-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(79,120,255,0.06)' }}>
          <span className="text-[9px] font-black uppercase tracking-widest text-white/30">What Cadi replaces</span>
          <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
          <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: '#4f78ff' }}>With Cadi</span>
        </div>
        <div className="grid grid-cols-3 divide-x" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          {IMPACT.map(({ before, after, icon }) => (
            <div key={icon} className="px-4 py-3 flex items-start gap-3">
              <span className="text-xl flex-shrink-0 mt-0.5">{icon}</span>
              <div><div className="text-[10px] text-white/30 line-through decoration-white/20 mb-1 leading-snug">{before}</div>
              <div className="text-[10px] font-bold leading-snug" style={{ color: '#60a5fa' }}>{after}</div></div>
            </div>
          ))}
        </div>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="text-white font-black text-xl">Client Compliance Reports</div>
          <div className="text-white/40 text-sm mt-0.5">Live site-by-site compliance — shareable with clients instantly</div>
        </div>
        <button
          onClick={() => window.open('/client-demo', '_blank')}
          className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-black text-white transition-all shadow-lg"
          style={{ background: 'linear-gradient(135deg, #4f78ff, #2d4fd4)', boxShadow: '0 4px 24px rgba(79,120,255,0.35)' }}
          onMouseEnter={e => e.currentTarget.style.filter = 'brightness(1.1)'}
          onMouseLeave={e => e.currentTarget.style.filter = ''}>
          <ExternalLink size={15} />
          Open client portal →
        </button>
      </div>

      {/* Site selector */}
      <div className="grid grid-cols-4 gap-3">
        {SITES.map(site => {
          const sc = site.score >= 97 ? GREEN : site.score >= 90 ? BLUE : AMBER;
          const isActive = selectedSite.id === site.id;
          return (
            <button key={site.id} onClick={() => setSelectedSite(site)}
              className="p-4 rounded-2xl text-left transition-all"
              style={{
                background: isActive ? 'rgba(79,120,255,0.15)' : 'rgba(255,255,255,0.05)',
                border: isActive ? '1px solid rgba(79,120,255,0.4)' : '1px solid rgba(255,255,255,0.09)',
              }}>
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-black" style={{ color: sc }}>{site.score}%</div>
                {isActive && <div className="w-1.5 h-1.5 rounded-full bg-[#4f78ff]" />}
              </div>
              <div className="text-white font-bold text-xs leading-tight truncate">{site.name}</div>
              <div className="text-white/35 text-[10px] mt-0.5 truncate">{site.client}</div>
            </button>
          );
        })}
      </div>

      {/* Main report area */}
      <div className="grid grid-cols-[1fr_280px] gap-5">

        {/* Left — site detail */}
        <div className="space-y-5">

          {/* Site header card */}
          <GlassCard className="p-6">
            <div className="flex items-center gap-6">
              <ScoreRing score={s.score} />
              <div className="flex-1 min-w-0">
                <div className="text-white font-black text-lg leading-tight">{s.name}</div>
                <div className="text-white/45 text-sm mt-0.5">{s.address}</div>
                <div className="flex items-center gap-3 mt-3 flex-wrap">
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full"
                    style={{ background: 'rgba(79,120,255,0.15)', border: '1px solid rgba(79,120,255,0.3)', color: '#93b4ff' }}>
                    {s.service}
                  </span>
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full"
                    style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.5)' }}>
                    {s.freq} · {s.window}
                  </span>
                  <span className="text-[10px] text-white/30">Ref: {s.clientRef}</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-white/35 text-[10px] font-black uppercase tracking-widest mb-1">Client</div>
                <div className="text-white font-bold text-sm">{s.client}</div>
                <div className="mt-3">
                  <button onClick={() => window.open('/client-demo', '_blank')}
                    className="flex items-center gap-1.5 text-xs font-black px-3 py-1.5 rounded-xl transition-colors"
                    style={{ background: 'rgba(79,120,255,0.2)', border: '1px solid rgba(79,120,255,0.4)', color: '#93b4ff' }}>
                    <ExternalLink size={11} /> Client portal
                  </button>
                </div>
              </div>
            </div>
          </GlassCard>

          {/* KPI strip */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Cleans',         value: s.cleans,                color: BLUE,   icon: '📋' },
              { label: 'SLA rate',       value: `${s.sla}%`,            color: scoreColor, icon: '✅' },
              { label: 'Avg on site',    value: `${s.avgTime}m`,        color: GREEN,  icon: '⏱' },
              { label: 'Geo photos',     value: s.photos.toLocaleString(), color: '#a78bfa', icon: '📍' },
            ].map(({ label, value, color, icon }) => (
              <div key={label} className="rounded-2xl p-4"
                style={{
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.04) 100%)',
                  border: `1px solid ${color}22`,
                }}>
                <div className="text-lg mb-0.5">{icon}</div>
                <div className="text-xl font-black" style={{ color }}>{value}</div>
                <div className="text-white/40 text-[10px] mt-0.5">{label}</div>
              </div>
            ))}
          </div>

          {/* Recent cleans */}
          <GlassCard>
            <div className="px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="text-white font-bold text-sm">Recent cleans</div>
              <div className="text-white/35 text-xs mt-0.5">All evidence geo-verified on site</div>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {s.recentCleans.map((clean, i) => (
                <div key={i} className="px-6 py-3.5 flex items-center gap-4">
                  <div className="w-14 text-white/50 text-xs shrink-0">{clean.date}</div>
                  <div className="w-28 font-mono text-xs text-white/40 shrink-0">{clean.time}</div>
                  <div className="flex items-center gap-2 flex-1">
                    <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
                      style={clean.sla
                        ? { background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', color: '#34d399' }
                        : { background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', color: '#fbbf24' }}>
                      {clean.sla ? '✓ SLA' : '⚠ Late'}
                    </span>
                    <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 shrink-0">
                      <Shield size={10} /> {clean.photos} geo
                    </span>
                  </div>
                  <div className="text-white font-bold text-sm shrink-0">£{clean.value}</div>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>

        {/* Right — summary panel */}
        <div className="space-y-4">

          {/* Assigned cleaner */}
          <GlassCard className="p-5">
            <div className="text-white/35 text-[10px] font-black uppercase tracking-widest mb-4">Assigned cleaner</div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-xl bg-[#4f78ff]/20 border border-[#4f78ff]/30 flex items-center justify-center text-white font-black text-sm shrink-0">
                {s.cleaner.avatar}
              </div>
              <div>
                <div className="text-white font-bold text-sm">{s.cleaner.name}</div>
                <div className="text-white/40 text-xs mt-0.5">Cadi score: <span className="text-emerald-400 font-bold">{s.cleaner.score}</span></div>
              </div>
            </div>
            <div className="space-y-2.5">
              {[
                { label: 'Reliability',  pct: 96 },
                { label: 'Quality',      pct: 93 },
                { label: 'Compliance',   pct: 98 },
              ].map(({ label, pct }) => (
                <div key={label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-white/50 text-[10px]">{label}</span>
                    <span className="text-white/70 text-[10px] font-bold">{pct}</span>
                  </div>
                  <div className="h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.07)' }}>
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: GREEN }} />
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>

          {/* Issues */}
          <GlassCard className="p-5">
            <div className="text-white/35 text-[10px] font-black uppercase tracking-widest mb-4">Issues — May 2026</div>
            <div className="flex items-center gap-4">
              <div className="text-center">
                <div className="text-2xl font-black text-amber-400">{s.issues.raised}</div>
                <div className="text-[10px] text-white/35">Raised</div>
              </div>
              <div className="flex-1 h-px bg-white/10" />
              <div className="text-center">
                <div className="text-2xl font-black text-emerald-400">{s.issues.resolved}</div>
                <div className="text-[10px] text-white/35">Resolved</div>
              </div>
            </div>
            <div className="mt-3 text-center text-[10px] font-bold text-emerald-400">100% resolution rate</div>
          </GlassCard>

          {/* Geo audit summary */}
          <GlassCard className="p-5">
            <div className="text-white/35 text-[10px] font-black uppercase tracking-widest mb-3">Geo audit</div>
            <div className="space-y-2.5 text-xs">
              {[
                { label: 'Photos geo-verified', value: '100%',   color: GREEN },
                { label: 'Max distance from site', value: '11m', color: GREEN },
                { label: 'GPS accuracy avg',    value: '±5m',    color: GREEN },
                { label: 'Tamper-evident hash', value: 'SHA-256', color: BLUE },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-white/40">{label}</span>
                  <span className="font-bold" style={{ color }}>{value}</span>
                </div>
              ))}
            </div>
          </GlassCard>

          {/* Share CTA */}
          <button onClick={() => window.open('/client-demo', '_blank')}
            className="w-full py-4 rounded-2xl text-sm font-black text-white transition-all"
            style={{ background: 'linear-gradient(135deg, rgba(79,120,255,0.25), rgba(79,120,255,0.15))', border: '1px solid rgba(79,120,255,0.4)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'linear-gradient(135deg, rgba(79,120,255,0.4), rgba(79,120,255,0.25))'}
            onMouseLeave={e => e.currentTarget.style.background = 'linear-gradient(135deg, rgba(79,120,255,0.25), rgba(79,120,255,0.15))'}>
            <div className="flex items-center justify-center gap-2">
              <ExternalLink size={15} />
              Open client portal →
            </div>
            <div className="text-white/40 text-[10px] mt-1 font-normal">What {s.client.split(' ')[0]} sees in their portal</div>
          </button>
        </div>
      </div>
    </div>
  );
}
