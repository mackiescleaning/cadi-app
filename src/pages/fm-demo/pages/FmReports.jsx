import { useState } from 'react';
import clients from '../mock/clients.json';
import { Download, TrendingUp, TrendingDown, X, FileText, ChevronRight } from 'lucide-react';

/* ── Monthly data ─────────────────────────────────────────────────── */
const MONTHS = [
  {
    id: 'nov25',
    label: 'Nov 2025',
    short: 'Nov',
    jobs: 189,
    sla: 96,
    value: 23200,
    cleaners: 22,
    sites: 13,
    photos: 1890,
    disputes: 3,
  },
  {
    id: 'dec25',
    label: 'Dec 2025',
    short: 'Dec',
    jobs: 201,
    sla: 97,
    value: 24800,
    cleaners: 23,
    sites: 13,
    photos: 2130,
    disputes: 2,
  },
  {
    id: 'jan26',
    label: 'Jan 2026',
    short: 'Jan',
    jobs: 218,
    sla: 98,
    value: 26900,
    cleaners: 25,
    sites: 14,
    photos: 2340,
    disputes: 1,
  },
  {
    id: 'feb26',
    label: 'Feb 2026',
    short: 'Feb',
    jobs: 209,
    sla: 96,
    value: 25700,
    cleaners: 24,
    sites: 14,
    photos: 2210,
    disputes: 2,
  },
  {
    id: 'mar26',
    label: 'Mar 2026',
    short: 'Mar',
    jobs: 234,
    sla: 98,
    value: 28900,
    cleaners: 26,
    sites: 15,
    photos: 2650,
    disputes: 1,
  },
  {
    id: 'apr26',
    label: 'Apr 2026',
    short: 'Apr',
    jobs: 241,
    sla: 99,
    value: 29700,
    cleaners: 27,
    sites: 15,
    photos: 2760,
    disputes: 0,
  },
  {
    id: 'may26',
    label: 'May 2026',
    short: 'May',
    jobs: 98,
    sla: 98,
    value: 12100,
    cleaners: 27,
    sites: 15,
    photos: 1120,
    disputes: 0,
    partial: true,
  },
];

const CLIENT_DATA = {
  apr26: [
    { clientId: 'cl2', jobs: 61, value: 9800, sla: 100, trend: +3 },
    { clientId: 'cl5', jobs: 48, value: 5900, sla: 99, trend: +1 },
    { clientId: 'cl1', jobs: 42, value: 5200, sla: 100, trend: 0 },
    { clientId: 'cl3', jobs: 31, value: 4200, sla: 97, trend: -1 },
    { clientId: 'cl6', jobs: 28, value: 3600, sla: 98, trend: +2 },
    { clientId: 'cl4', jobs: 18, value: 1900, sla: 100, trend: 0 },
    { clientId: 'cl7', jobs: 8, value: 1760, sla: 100, trend: +2 },
    { clientId: 'cl8', jobs: 5, value: 950, sla: 99, trend: 0 },
  ],
  mar26: [
    { clientId: 'cl2', jobs: 58, value: 9200, sla: 97, trend: +1 },
    { clientId: 'cl5', jobs: 47, value: 5700, sla: 98, trend: +2 },
    { clientId: 'cl1', jobs: 42, value: 5200, sla: 100, trend: +1 },
    { clientId: 'cl3', jobs: 32, value: 4350, sla: 98, trend: +3 },
    { clientId: 'cl6', jobs: 26, value: 3300, sla: 96, trend: -2 },
    { clientId: 'cl4', jobs: 18, value: 1900, sla: 100, trend: 0 },
    { clientId: 'cl7', jobs: 6, value: 1320, sla: 98, trend: +1 },
    { clientId: 'cl8', jobs: 5, value: 950, sla: 99, trend: 0 },
  ],
};
const DEFAULT_CLIENT_DATA = CLIENT_DATA.apr26;

const TOP_CLEANERS = [
  { name: 'Sarah Mitchell', avatar: 'SM', score: 96, jobs: 28, sla: 100, rating: 4.9 },
  { name: 'Maria Kowalski', avatar: 'MK', score: 94, jobs: 24, sla: 99, rating: 4.8 },
  { name: 'Tara Hobson', avatar: 'TH', score: 91, jobs: 22, sla: 100, rating: 4.7 },
  { name: 'Kwame Boateng', avatar: 'KB', score: 89, jobs: 19, sla: 98, rating: 4.6 },
  { name: 'Marcus Webb', avatar: 'MW', score: 87, jobs: 17, sla: 97, rating: 4.5 },
];

/* ── SVG bar chart ───────────────────────────────────────────────── */
function BarChart({ data, activeId }) {
  const max = Math.max(...data.map((d) => d.jobs));
  const W = 520,
    H = 140,
    BAR_W = 48,
    GAP = (W - data.length * BAR_W) / (data.length + 1);

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H + 24}`} style={{ overflow: 'visible' }}>
      <defs>
        {data.map((d) => (
          <linearGradient key={d.id} id={`bg-${d.id}`} x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              stopColor={d.id === activeId ? '#6b8fff' : d.partial ? '#4f78ff' : '#4f78ff'}
              stopOpacity={d.id === activeId ? 0.95 : d.partial ? 0.35 : 0.75}
            />
            <stop
              offset="100%"
              stopColor={d.id === activeId ? '#3b5fd6' : '#2a4abf'}
              stopOpacity={d.id === activeId ? 0.95 : d.partial ? 0.2 : 0.55}
            />
          </linearGradient>
        ))}
      </defs>
      {/* Grid lines */}
      {[0.25, 0.5, 0.75, 1].map((t) => (
        <line
          key={t}
          x1={0}
          y1={H * (1 - t)}
          x2={W}
          y2={H * (1 - t)}
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={1}
        />
      ))}
      {data.map((d, i) => {
        const x = GAP + i * (BAR_W + GAP);
        const bh = Math.max(4, (d.jobs / max) * H * 0.92);
        const isActive = d.id === activeId;
        return (
          <g key={d.id}>
            <rect
              x={x}
              y={H - bh}
              width={BAR_W}
              height={bh}
              rx={6}
              fill={`url(#bg-${d.id})`}
              style={{ filter: isActive ? 'drop-shadow(0 0 8px rgba(79,120,255,0.5))' : 'none' }}
            />
            {/* Value label */}
            <text
              x={x + BAR_W / 2}
              y={H - bh - 6}
              textAnchor="middle"
              fill={isActive ? 'white' : 'rgba(255,255,255,0.45)'}
              fontSize={isActive ? 11 : 10}
              fontWeight={isActive ? 800 : 600}
            >
              {d.jobs}
              {d.partial ? '*' : ''}
            </text>
            {/* Month label */}
            <text
              x={x + BAR_W / 2}
              y={H + 18}
              textAnchor="middle"
              fill={isActive ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.35)'}
              fontSize={11}
              fontWeight={isActive ? 800 : 500}
            >
              {d.short}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ── SVG SLA line chart ──────────────────────────────────────────── */
function SlaChart({ data, activeId }) {
  const W = 240,
    H = 80;
  const minV = 94,
    maxV = 100;
  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - ((d.sla - minV) / (maxV - minV)) * H * 0.85 - H * 0.08;
    return [x, y];
  });
  const line = `M ${pts.map((p) => p.join(',')).join(' L ')}`;
  const area = `M 0,${H} L ${pts.map((p) => p.join(',')).join(' L ')} L ${W},${H} Z`;

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id="sla-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#34d399" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#sla-fill)" />
      <path
        d={line}
        fill="none"
        stroke="#34d399"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ filter: 'drop-shadow(0 0 4px rgba(52,211,153,0.5))' }}
      />
      {pts.map(([x, y], i) => {
        const isActive = data[i].id === activeId;
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={isActive ? 4 : 2.5}
            fill={isActive ? '#34d399' : '#1a5c47'}
            stroke={isActive ? '#34d399' : 'none'}
            style={{ filter: isActive ? 'drop-shadow(0 0 5px #34d399)' : 'none' }}
          />
        );
      })}
    </svg>
  );
}

/* ── Stat card ───────────────────────────────────────────────────── */
function KpiCard({ label, value, sub, color, prevValue, up }) {
  const hasTrend = prevValue !== undefined;
  return (
    <div
      className="rounded-2xl p-5 relative overflow-hidden"
      style={{
        background: 'rgba(255,255,255,0.05)',
        backdropFilter: 'blur(20px)',
        border: `1px solid ${color}28`,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.07)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: -20,
          right: -20,
          width: 72,
          height: 72,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${color}20 0%, transparent 70%)`,
          pointerEvents: 'none',
        }}
      />
      <div
        className="text-3xl font-black leading-none mb-1.5"
        style={{
          background: `linear-gradient(135deg, white 20%, ${color} 100%)`,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}
      >
        {value}
      </div>
      <div className="text-white/75 font-bold text-sm">{label}</div>
      <div className="flex items-center gap-2 mt-1">
        <span className="text-white/30 text-xs">{sub}</span>
        {hasTrend && (
          <span
            className="flex items-center gap-0.5 text-[10px] font-black"
            style={{ color: up ? '#34d399' : '#f87171' }}
          >
            {up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
            {prevValue}
          </span>
        )}
      </div>
    </div>
  );
}

/* ── Report modal ────────────────────────────────────────────────── */
function ReportModal({ month, clientRows, onClose }) {
  const prevIdx = MONTHS.findIndex((m) => m.id === month.id) - 1;
  const prev = prevIdx >= 0 ? MONTHS[prevIdx] : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: 'rgba(1,8,40,0.88)', backdropFilter: 'blur(16px)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl"
        style={{ background: '#fff' }}
      >
        {/* PDF-style header */}
        <div
          className="px-8 py-6"
          style={{ background: 'linear-gradient(135deg, #020c3e 0%, #0d1b4f 100%)' }}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#4f78ff] flex items-center justify-center text-white font-black text-base shadow-lg shadow-[#4f78ff]/30">
                B
              </div>
              <div>
                <div className="text-white font-black text-base leading-tight">Britannia Group</div>
                <div className="text-white/40 text-xs">Monthly Operations Report</div>
              </div>
            </div>
            <button onClick={onClose} className="text-white/30 hover:text-white transition-colors">
              <X size={18} />
            </button>
          </div>
          <div className="mt-5 flex items-end justify-between">
            <div>
              <div className="text-white/40 text-[10px] font-black uppercase tracking-widest">
                Report period
              </div>
              <div className="text-white font-black text-2xl mt-0.5">{month.label}</div>
              {month.partial && (
                <div className="text-white/35 text-xs mt-0.5">Partial month (MTD)</div>
              )}
            </div>
            <div className="text-right">
              <div className="text-white/40 text-[10px]">Generated</div>
              <div className="text-white/70 text-sm font-bold">18 May 2026 · Cadi Platform</div>
            </div>
          </div>
        </div>

        <div className="px-8 py-6 space-y-6">
          {/* Executive summary */}
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">
              Executive summary
            </div>
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: 'Jobs completed', value: month.jobs.toString(), color: '#4f78ff' },
                { label: 'SLA hit rate', value: `${month.sla}%`, color: '#10b981' },
                {
                  label: 'Total invoiced',
                  value: `£${(month.value / 1000).toFixed(1)}k`,
                  color: '#8b5cf6',
                },
                { label: 'Active cleaners', value: month.cleaners.toString(), color: '#f59e0b' },
              ].map(({ label, value, color }) => (
                <div
                  key={label}
                  className="rounded-xl p-3 text-center"
                  style={{ background: `${color}0f`, border: `1px solid ${color}20` }}
                >
                  <div className="text-xl font-black" style={{ color }}>
                    {value}
                  </div>
                  <div className="text-gray-500 text-[10px] font-bold mt-0.5 leading-tight">
                    {label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* vs prior month */}
          {prev && (
            <div
              className="rounded-xl px-4 py-3.5"
              style={{ background: '#f8faff', border: '1px solid #e0eaff' }}
            >
              <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">
                vs {prev.label}
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                {[
                  { label: 'Jobs', cur: month.jobs, prv: prev.jobs, fmt: (v) => v.toString() },
                  { label: 'SLA', cur: month.sla, prv: prev.sla, fmt: (v) => `${v}%` },
                  {
                    label: 'Revenue',
                    cur: month.value,
                    prv: prev.value,
                    fmt: (v) => `£${v.toLocaleString()}`,
                  },
                ].map(({ label, cur, prv, fmt }) => {
                  const up = cur >= prv;
                  const diff = cur - prv;
                  return (
                    <div key={label} className="flex items-center justify-between">
                      <span className="text-gray-500 text-xs">{label}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-[#010a4f] text-xs">{fmt(cur)}</span>
                        <span
                          className="text-[10px] font-black flex items-center gap-0.5"
                          style={{ color: up ? '#10b981' : '#ef4444' }}
                        >
                          {up ? '↑' : '↓'} {Math.abs(diff)}
                          {label === 'SLA' ? 'pp' : ''}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Client breakdown */}
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">
              Client performance
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                  {['Client', 'Sector', 'Jobs', 'Value', 'SLA'].map((h) => (
                    <th
                      key={h}
                      className="text-left pb-2 text-[10px] font-black uppercase tracking-wider text-gray-400 pr-4"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {clientRows.map(({ clientId, jobs, value, sla }) => {
                  const client = clients.find((c) => c.id === clientId);
                  const slaColor = sla === 100 ? '#10b981' : sla >= 98 ? '#4f78ff' : '#f59e0b';
                  return (
                    <tr key={clientId} style={{ borderBottom: '1px solid #f8fafc' }}>
                      <td className="py-2.5 pr-4">
                        <div className="font-bold text-[#010a4f]">{client?.name}</div>
                      </td>
                      <td className="py-2.5 pr-4 text-gray-400 text-xs">{client?.sector}</td>
                      <td className="py-2.5 pr-4 font-bold text-[#010a4f]">{jobs}</td>
                      <td className="py-2.5 pr-4 font-bold text-[#010a4f]">
                        £{value.toLocaleString()}
                      </td>
                      <td className="py-2.5">
                        <span
                          className="text-xs font-black px-2 py-0.5 rounded-full"
                          style={{
                            background: `${slaColor}15`,
                            color: slaColor,
                            border: `1px solid ${slaColor}30`,
                          }}
                        >
                          {sla}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Top cleaners */}
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">
              Top performing cleaners
            </div>
            <div className="space-y-2">
              {TOP_CLEANERS.slice(0, 3).map((c, i) => (
                <div
                  key={c.name}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                  style={{ background: '#f8faff' }}
                >
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black shrink-0"
                    style={{
                      background: i === 0 ? '#fef9c3' : '#f1f5f9',
                      color: i === 0 ? '#ca8a04' : '#64748b',
                    }}
                  >
                    {i + 1}
                  </div>
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black text-white shrink-0"
                    style={{ background: '#4f78ff' }}
                  >
                    {c.avatar}
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-[#010a4f] text-sm">{c.name}</div>
                    <div className="text-gray-400 text-xs">
                      {c.jobs} jobs · {c.sla}% SLA · ★ {c.rating}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-black text-sm" style={{ color: '#4f78ff' }}>
                      {c.score}
                    </div>
                    <div className="text-gray-400 text-[10px]">Cadi score</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Geo compliance note */}
          <div
            className="rounded-xl px-4 py-3"
            style={{
              background: 'rgba(16,185,129,0.06)',
              border: '1px solid rgba(16,185,129,0.18)',
            }}
          >
            <div
              className="text-[10px] font-black uppercase tracking-widest mb-1.5"
              style={{ color: '#10b981' }}
            >
              Geo-verification compliance
            </div>
            <div className="text-gray-600 text-xs leading-relaxed">
              {month.photos.toLocaleString()} photos geo-stamped this period. All evidence stored
              with SHA-256 tamper-evident hashes, available on request for client audits or contract
              disputes.
            </div>
          </div>

          {/* Footer */}
          <div
            className="pt-2 flex items-center justify-between text-xs text-gray-400"
            style={{ borderTop: '1px solid #f1f5f9' }}
          >
            <span>Generated by Cadi · cadi.cleaning</span>
            <span>Confidential — Britannia Group internal use</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Main page ───────────────────────────────────────────────────── */
const IMPACT = [
  {
    before: '3–4 hrs per client building monthly reports in Excel',
    after: 'Auto-generated in seconds — every month, every client, zero effort',
    icon: '⏱',
  },
  {
    before: "Client questions a clean — you can't prove it without chasing",
    after: 'Every visit evidenced and timestamped — answer any query in seconds',
    icon: '✅',
  },
  {
    before: 'Which contracts are profitable? Nobody actually knows',
    after: 'Cost vs revenue per contract, per region — margin visible every week',
    icon: '💷',
  },
];

export default function FmReports({ showToast }) {
  const [activeId, setActiveId] = useState('apr26');
  const [showReport, setShowReport] = useState(false);

  const month = MONTHS.find((m) => m.id === activeId) || MONTHS[5];
  const prevIdx = MONTHS.findIndex((m) => m.id === activeId) - 1;
  const prev = prevIdx >= 0 ? MONTHS[prevIdx] : null;
  const clientRows = CLIENT_DATA[activeId] || DEFAULT_CLIENT_DATA;
  const maxJobs = Math.max(...clientRows.map((c) => c.jobs));

  function delta(cur, prv, suffix = '') {
    if (!prv) return null;
    const d = cur - prv;
    return { up: d >= 0, label: `${d >= 0 ? '+' : ''}${d}${suffix}` };
  }

  return (
    <>
      {showReport && (
        <ReportModal month={month} clientRows={clientRows} onClose={() => setShowReport(false)} />
      )}

      <div className="p-8 space-y-6 min-h-full">
        {/* Impact strip */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ border: '1px solid rgba(79,120,255,0.18)', background: 'rgba(1,8,40,0.6)' }}
        >
          <div
            className="px-5 py-2.5 flex items-center gap-3"
            style={{
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              background: 'rgba(79,120,255,0.06)',
            }}
          >
            <span className="text-[9px] font-black uppercase tracking-widest text-white/30">
              What Cadi replaces
            </span>
            <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
            <span
              className="text-[9px] font-black uppercase tracking-widest"
              style={{ color: '#4f78ff' }}
            >
              With Cadi
            </span>
          </div>
          <div
            className="grid grid-cols-3 divide-x"
            style={{ borderColor: 'rgba(255,255,255,0.06)' }}
          >
            {IMPACT.map(({ before, after, icon }) => (
              <div key={icon} className="px-4 py-3 flex items-start gap-3">
                <span className="text-xl flex-shrink-0 mt-0.5">{icon}</span>
                <div>
                  <div className="text-[10px] text-white/30 line-through decoration-white/20 mb-1 leading-snug">
                    {before}
                  </div>
                  <div className="text-[10px] font-bold leading-snug" style={{ color: '#60a5fa' }}>
                    {after}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="text-white font-black text-xl">Monthly Reports</div>
            <div className="text-white/35 text-sm mt-0.5">
              Britannia Group Network · 15 sites · Herts, Beds &amp; Bucks
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowReport(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black text-white transition-all hover:brightness-110"
              style={{
                background: 'linear-gradient(135deg, rgba(79,120,255,0.35), rgba(99,102,241,0.28))',
                border: '1px solid rgba(79,120,255,0.5)',
                boxShadow: '0 0 20px rgba(79,120,255,0.15)',
              }}
            >
              <FileText size={14} />
              Generate report
            </button>
            <button
              onClick={() => showToast('export data to CSV')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white/55 hover:text-white transition-colors"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              <Download size={13} />
              CSV
            </button>
          </div>
        </div>

        {/* Month selector */}
        <div className="flex items-center gap-1.5">
          {MONTHS.map((m) => (
            <button
              key={m.id}
              onClick={() => setActiveId(m.id)}
              className="px-4 py-2 rounded-xl text-xs font-bold transition-all relative"
              style={
                activeId === m.id
                  ? {
                      background:
                        'linear-gradient(135deg, rgba(79,120,255,0.25), rgba(99,102,241,0.18))',
                      border: '1px solid rgba(79,120,255,0.5)',
                      color: 'white',
                      boxShadow: '0 0 16px rgba(79,120,255,0.15)',
                    }
                  : {
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.09)',
                      color: 'rgba(255,255,255,0.45)',
                    }
              }
            >
              {m.short}
              {m.partial && <span className="ml-1 text-[8px] text-white/30">MTD</span>}
            </button>
          ))}
          <span className="ml-auto text-white/25 text-xs">{month.label}</span>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-4 gap-4">
          <KpiCard
            label="Jobs completed"
            value={month.jobs.toString()}
            color="#4f78ff"
            sub="this period"
            prevValue={prev ? delta(month.jobs, prev.jobs)?.label : undefined}
            up={prev ? month.jobs >= prev.jobs : true}
          />
          <KpiCard
            label="SLA hit rate"
            value={`${month.sla}%`}
            color="#34d399"
            sub="on-time completions"
            prevValue={prev ? delta(month.sla, prev.sla, 'pp')?.label : undefined}
            up={prev ? month.sla >= prev.sla : true}
          />
          <KpiCard
            label="Total invoiced"
            value={`£${(month.value / 1000).toFixed(1)}k`}
            color="#a78bfa"
            sub="excl. VAT"
            prevValue={
              prev
                ? delta(month.value, prev.value)?.label.replace(/(\d)(?=(\d{3})+$)/g, '$1,')
                : undefined
            }
            up={prev ? month.value >= prev.value : true}
          />
          <KpiCard
            label="Geo-stamped photos"
            value={month.photos.toLocaleString()}
            color="#fbbf24"
            sub="tamper-evident"
          />
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-[1fr_300px] gap-5">
          {/* Bar chart */}
          <div
            className="rounded-2xl overflow-hidden"
            style={{
              background: 'rgba(255,255,255,0.04)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
            }}
          >
            <div
              className="px-6 pt-5 pb-3 flex items-center justify-between"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
            >
              <div>
                <div className="text-white font-bold text-sm">Job volume</div>
                <div className="text-white/30 text-xs mt-0.5">
                  Nov 2025 – May 2026 · click a month to select
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-1.5 rounded-full bg-[#4f78ff]" />
                  <span className="text-white/35">Completed</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-1.5 rounded-full bg-[#4f78ff]/35" />
                  <span className="text-white/35">Partial</span>
                </div>
              </div>
            </div>
            <div className="px-6 py-5 cursor-pointer" onClick={() => {}}>
              <BarChart data={MONTHS} activeId={activeId} />
            </div>
            <div className="px-6 pb-4 text-white/20 text-[10px]">
              * May 2026 is a partial month (MTD through 18 May)
            </div>
          </div>

          {/* SLA trend + network stats */}
          <div className="space-y-4">
            <div
              className="rounded-2xl p-5"
              style={{
                background: 'rgba(255,255,255,0.04)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255,255,255,0.08)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
              }}
            >
              <div className="text-white/30 text-[10px] font-black uppercase tracking-widest mb-1">
                SLA trend
              </div>
              <div className="flex items-end justify-between mb-3">
                <div
                  className="text-2xl font-black"
                  style={{
                    background: 'linear-gradient(135deg, white 0%, #34d399 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  {month.sla}%
                </div>
                <span className="text-xs font-bold" style={{ color: '#34d399' }}>
                  {month.sla >= 99
                    ? '↑ Record high'
                    : month.sla >= 98
                      ? '↑ Above target'
                      : '→ On target'}
                </span>
              </div>
              <SlaChart data={MONTHS} activeId={activeId} />
              <div className="flex justify-between mt-2">
                {MONTHS.map((m) => (
                  <span
                    key={m.id}
                    className="text-[9px] font-bold"
                    style={{
                      color: m.id === activeId ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.2)',
                    }}
                  >
                    {m.short}
                  </span>
                ))}
              </div>
            </div>

            <div
              className="rounded-2xl p-4"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
              }}
            >
              <div className="text-white/30 text-[10px] font-black uppercase tracking-widest mb-3">
                Network
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Active cleaners', value: month.cleaners },
                  { label: 'Sites covered', value: month.sites },
                  { label: 'Disputes raised', value: month.disputes, good: true },
                  { label: 'Photos uploaded', value: month.photos.toLocaleString() },
                ].map(({ label, value, good }) => (
                  <div
                    key={label}
                    className="rounded-xl px-3 py-2.5"
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.07)',
                    }}
                  >
                    <div
                      className="text-white font-black text-base"
                      style={good && value === 0 ? { color: '#34d399' } : {}}
                    >
                      {value}
                    </div>
                    <div className="text-white/30 text-[10px] mt-0.5 leading-tight">{label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Client breakdown */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: 'rgba(255,255,255,0.04)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
          }}
        >
          <div
            className="px-6 py-4 flex items-center justify-between"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
          >
            <div className="text-white font-bold text-sm">Client breakdown — {month.label}</div>
            <span className="text-white/25 text-xs">{clientRows.length} active clients</span>
          </div>
          <div
            className="grid px-6 py-2.5"
            style={{
              gridTemplateColumns: '1fr 60px 1fr 100px 100px 130px',
              borderBottom: '1px solid rgba(255,255,255,0.05)',
            }}
          >
            {['Client', 'Jobs', 'Volume', 'Value', 'SLA', ''].map((h) => (
              <div
                key={h}
                className="text-[9px] font-black uppercase tracking-widest text-white/20"
              >
                {h}
              </div>
            ))}
          </div>
          {clientRows.map(({ clientId, jobs, value, sla, trend }) => {
            const client = clients.find((c) => c.id === clientId);
            const slaStyle =
              sla === 100
                ? { bg: 'rgba(52,211,153,0.1)', border: 'rgba(52,211,153,0.25)', color: '#34d399' }
                : sla >= 98
                  ? {
                      bg: 'rgba(79,120,255,0.1)',
                      border: 'rgba(79,120,255,0.25)',
                      color: '#60a5fa',
                    }
                  : {
                      bg: 'rgba(245,158,11,0.1)',
                      border: 'rgba(245,158,11,0.25)',
                      color: '#fbbf24',
                    };
            return (
              <div
                key={clientId}
                className="grid px-6 py-3.5 transition-all"
                style={{
                  gridTemplateColumns: '1fr 60px 1fr 100px 100px 130px',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(79,120,255,0.04)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '';
                }}
              >
                <div className="self-center">
                  <div className="text-white font-semibold text-sm truncate">{client?.name}</div>
                  <div className="text-white/30 text-xs">{client?.sector}</div>
                </div>
                <div className="text-white font-bold text-sm self-center">{jobs}</div>
                <div className="self-center pr-6">
                  <div
                    className="h-1.5 rounded-full overflow-hidden"
                    style={{ background: 'rgba(255,255,255,0.08)' }}
                  >
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${(jobs / maxJobs) * 100}%`,
                        background: 'linear-gradient(90deg, #3b5fd6, #4f78ff)',
                        boxShadow: '0 0 6px rgba(79,120,255,0.4)',
                      }}
                    />
                  </div>
                </div>
                <div className="text-white font-bold text-sm self-center">
                  £{value.toLocaleString()}
                </div>
                <div className="self-center">
                  <span
                    className="text-xs font-bold px-2.5 py-1 rounded-full"
                    style={{
                      background: slaStyle.bg,
                      border: `1px solid ${slaStyle.border}`,
                      color: slaStyle.color,
                    }}
                  >
                    {sla}% SLA
                  </span>
                </div>
                <div className="self-center flex items-center gap-2">
                  {trend !== undefined && (
                    <span
                      className="text-[10px] font-black flex items-center gap-0.5"
                      style={{
                        color:
                          trend > 0 ? '#34d399' : trend < 0 ? '#f87171' : 'rgba(255,255,255,0.25)',
                      }}
                    >
                      {trend > 0 ? (
                        <TrendingUp size={10} />
                      ) : trend < 0 ? (
                        <TrendingDown size={10} />
                      ) : null}
                      {trend !== 0 ? `${trend > 0 ? '+' : ''}${trend} vs prev` : '—'}
                    </span>
                  )}
                  <button
                    onClick={() => setShowReport(true)}
                    className="text-xs font-bold text-[#4f78ff]/60 hover:text-[#4f78ff] transition-colors flex items-center gap-0.5"
                  >
                    Report <ChevronRight size={11} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Top cleaners */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: 'rgba(255,255,255,0.04)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
          }}
        >
          <div className="px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="text-white font-bold text-sm">
              Top performing cleaners — {month.label}
            </div>
          </div>
          <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
            {TOP_CLEANERS.map((c, i) => (
              <div
                key={c.name}
                className="px-6 py-3.5 flex items-center gap-4 transition-all"
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '')}
              >
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0"
                  style={
                    i === 0
                      ? {
                          background: 'rgba(251,191,36,0.2)',
                          border: '1px solid rgba(251,191,36,0.4)',
                          color: '#fbbf24',
                        }
                      : { background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' }
                  }
                >
                  {i + 1}
                </div>
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black text-white shrink-0"
                  style={{
                    background:
                      'linear-gradient(135deg, rgba(79,120,255,0.35), rgba(99,102,241,0.25))',
                    border: '1px solid rgba(79,120,255,0.35)',
                  }}
                >
                  {c.avatar}
                </div>
                <div className="flex-1">
                  <div className="text-white font-bold text-sm">{c.name}</div>
                  <div className="text-white/35 text-xs mt-0.5">
                    {c.jobs} jobs · {c.sla}% SLA · ★ {c.rating}
                  </div>
                </div>
                <div className="text-center">
                  <div
                    className="text-lg font-black"
                    style={{
                      background: 'linear-gradient(135deg, white, #4f78ff)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                    }}
                  >
                    {c.score}
                  </div>
                  <div className="text-white/25 text-[9px]">Cadi score</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Download CTA */}
        <div
          className="rounded-2xl p-6 flex items-center justify-between"
          style={{
            background:
              'linear-gradient(135deg, rgba(79,120,255,0.12) 0%, rgba(99,102,241,0.07) 100%)',
            border: '1px solid rgba(79,120,255,0.22)',
            boxShadow: '0 0 30px rgba(79,120,255,0.06)',
          }}
        >
          <div>
            <div className="text-white font-black text-base">{month.label} full report pack</div>
            <div className="text-white/40 text-sm mt-0.5">
              Per-client PDFs · SLA evidence · network performance · invoice totals · geo-audit log
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-6">
            <button
              onClick={() => setShowReport(true)}
              className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-black text-white transition-all hover:brightness-110"
              style={{
                background: 'rgba(79,120,255,0.35)',
                border: '1px solid rgba(79,120,255,0.55)',
                boxShadow: '0 0 20px rgba(79,120,255,0.15)',
              }}
            >
              <FileText size={14} />
              Preview report
            </button>
            <button
              onClick={() => showToast('download full report pack')}
              className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold text-white/55 hover:text-white transition-colors"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              <Download size={13} />
              Download PDF
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
