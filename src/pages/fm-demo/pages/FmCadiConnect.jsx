import { useState } from 'react';
import { Globe, ExternalLink, TrendingUp, Users, Zap as ZapIcon } from 'lucide-react';
import cleaners from '../mock/cleaners.json';
import CadiWordmark from '../../../components/CadiWordmark';

// ─── Schedule demo ────────────────────────────────────────────────────────────

const DAYS = ['Mon 19', 'Tue 20', 'Wed 21', 'Thu 22', 'Fri 23', 'Sat 24', 'Sun 25'];

const WEEK_JOBS = [
  // Regular Cadi jobs (own clients)
  { day: 0, start: 9,  dur: 2,   label: 'Smith Residence',      type: 'residential', source: 'cadi' },
  { day: 0, start: 13, dur: 1.5, label: 'Park Lane Offices',    type: 'commercial',  source: 'cadi' },
  { day: 1, start: 8,  dur: 2,   label: 'Jones Flat Tenancy',   type: 'residential', source: 'cadi' },
  { day: 2, start: 10, dur: 1.5, label: 'Abbey Road Apt',       type: 'residential', source: 'cadi' },
  { day: 3, start: 9,  dur: 2,   label: 'Wilson Residence',     type: 'residential', source: 'cadi' },
  { day: 4, start: 11, dur: 2,   label: 'High St Office',       type: 'commercial',  source: 'cadi' },
  // Cadi Connect jobs (FM subcontract)
  { day: 0, start: 6,  dur: 2,   label: 'Premier Inn Luton Airport',  type: 'connect', source: 'connect', fm: 'Britannia Group', ref: '#BF-4471' },
  { day: 1, start: 6,  dur: 2,   label: 'Premier Inn Luton Airport',  type: 'connect', source: 'connect', fm: 'Britannia Group', ref: '#BF-4472' },
  { day: 2, start: 6,  dur: 2,   label: 'Premier Inn Luton Airport',  type: 'connect', source: 'connect', fm: 'Britannia Group', ref: '#BF-4473' },
  { day: 3, start: 6,  dur: 2,   label: 'Premier Inn Luton Airport',  type: 'connect', source: 'connect', fm: 'Britannia Group', ref: '#BF-4474' },
  { day: 4, start: 6,  dur: 2,   label: 'Premier Inn Luton Airport',  type: 'connect', source: 'connect', fm: 'Britannia Group', ref: '#BF-4475' },
  { day: 1, start: 18, dur: 2,   label: 'Luton Central Library',      type: 'connect', source: 'connect', fm: 'Britannia Group', ref: '#BF-4476' },
  { day: 2, start: 18, dur: 2,   label: 'Luton Central Library',      type: 'connect', source: 'connect', fm: 'Britannia Group', ref: '#BF-4477' },
  { day: 3, start: 18, dur: 2,   label: 'Luton Central Library',      type: 'connect', source: 'connect', fm: 'Britannia Group', ref: '#BF-4478' },
];

const TYPE_CFG = {
  residential: { bar: '#10B981', fill: '#ECFDF5', ink: '#064E3B', label: 'Residential' },
  commercial:  { bar: '#1F48FF', fill: '#EEF2FF', ink: '#1E3A8A', label: 'Commercial'  },
  connect:     { bar: '#C2410C', fill: '#FFF4E6', ink: '#7C2D12', label: 'Connect'     },
};

const HOURS = Array.from({ length: 16 }, (_, i) => i + 5); // 05:00–20:00
const ROW_H = 44;

function ConnectSchedule() {
  const [hoveredJob, setHoveredJob] = useState(null);

  const connectCount = WEEK_JOBS.filter(j => j.source === 'connect').length;
  const cadiCount    = WEEK_JOBS.filter(j => j.source === 'cadi').length;
  const connectValue = connectCount * 77; // approx

  return (
    <div style={{ background: '#f8faff', minHeight: '100%', padding: '1.25rem', fontFamily: "'Satoshi','Inter',sans-serif" }}>

      {/* Integration banner */}
      <div style={{
        borderRadius: '1rem', padding: '0.875rem 1.25rem', marginBottom: '1.25rem',
        background: 'linear-gradient(135deg, #fff4e6, #fef9f0)',
        border: '1px solid rgba(194,65,12,0.2)',
        display: 'flex', alignItems: 'center', gap: '0.875rem',
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: '0.625rem', flexShrink: 0,
          background: '#C2410C', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <ZapIcon size={17} color="white" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: '0.8rem', color: '#010a4f', marginBottom: '0.15rem' }}>
            Connect jobs appear alongside your own Cadi schedule
          </div>
          <div style={{ fontSize: '0.72rem', color: '#6b7280', lineHeight: 1.4 }}>
            In the full build, Cadi Connect jobs sync directly into your main Cadi scheduler — one calendar, everything in view. Conflicts and gaps flagged automatically.
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
          <div style={{ textAlign: 'center', background: '#fff', borderRadius: '0.5rem', padding: '0.4rem 0.65rem', border: '1px solid #e8eeff' }}>
            <div style={{ fontWeight: 900, fontSize: '0.95rem', color: '#10B981' }}>{cadiCount}</div>
            <div style={{ fontSize: '0.62rem', color: '#6b7280', fontWeight: 600 }}>Cadi jobs</div>
          </div>
          <div style={{ textAlign: 'center', background: '#fff', borderRadius: '0.5rem', padding: '0.4rem 0.65rem', border: '1px solid rgba(194,65,12,0.2)' }}>
            <div style={{ fontWeight: 900, fontSize: '0.95rem', color: '#C2410C' }}>{connectCount}</div>
            <div style={{ fontSize: '0.62rem', color: '#6b7280', fontWeight: 600 }}>Connect jobs</div>
          </div>
          <div style={{ textAlign: 'center', background: '#fff', borderRadius: '0.5rem', padding: '0.4rem 0.65rem', border: '1px solid #e8eeff' }}>
            <div style={{ fontWeight: 900, fontSize: '0.95rem', color: '#010a4f' }}>£{connectValue}</div>
            <div style={{ fontSize: '0.62rem', color: '#6b7280', fontWeight: 600 }}>Connect val</div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '0.875rem', marginBottom: '0.875rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Legend</span>
        {Object.entries(TYPE_CFG).map(([k, cfg]) => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: cfg.bar }} />
            <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>{cfg.label}</span>
          </div>
        ))}
        <span style={{ fontSize: '0.7rem', color: '#94a3b8', marginLeft: 'auto' }}>Week of 25–31 May 2026</span>
      </div>

      {/* Week grid */}
      <div style={{ background: 'white', borderRadius: '1rem', border: '1px solid #e8eeff', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>

        {/* Day headers */}
        <div style={{ display: 'grid', gridTemplateColumns: '48px repeat(7, 1fr)', borderBottom: '1px solid #e8eeff' }}>
          <div style={{ padding: '0.6rem 0', borderRight: '1px solid #e8eeff' }} />
          {DAYS.map((d, i) => (
            <div key={d} style={{
              padding: '0.5rem 0.4rem', textAlign: 'center', fontSize: '0.72rem', fontWeight: 700,
              color: i === 0 ? '#010a4f' : '#64748b',
              background: i === 0 ? '#f0f4ff' : 'white',
              borderRight: i < 6 ? '1px solid #e8eeff' : 'none',
            }}>{d}</div>
          ))}
        </div>

        {/* Time rows */}
        <div style={{ position: 'relative' }}>
          {HOURS.map((hour, hi) => (
            <div key={hour} style={{
              display: 'grid', gridTemplateColumns: '48px repeat(7, 1fr)',
              height: ROW_H,
              borderBottom: hi < HOURS.length - 1 ? '1px solid #f1f5f9' : 'none',
            }}>
              <div style={{
                padding: '0 0.5rem', fontSize: '0.65rem', color: '#94a3b8', fontWeight: 600,
                borderRight: '1px solid #e8eeff', display: 'flex', alignItems: 'flex-start',
                paddingTop: '0.25rem',
              }}>
                {String(hour).padStart(2,'0')}:00
              </div>
              {DAYS.map((_, di) => (
                <div key={di} style={{
                  borderRight: di < 6 ? '1px solid #f1f5f9' : 'none',
                  position: 'relative',
                }} />
              ))}
            </div>
          ))}

          {/* Job blocks overlaid */}
          {WEEK_JOBS.map((job, ji) => {
            const cfg = TYPE_CFG[job.type];
            const topOffset = (job.start - 5) * ROW_H;
            const height    = job.dur * ROW_H - 3;
            const colWidth  = `calc((100% - 48px) / 7)`;
            const left      = `calc(48px + ${job.day} * (100% - 48px) / 7 + 3px)`;
            const isConnect = job.source === 'connect';
            const isHov     = hoveredJob === ji;

            return (
              <div
                key={ji}
                onMouseEnter={() => setHoveredJob(ji)}
                onMouseLeave={() => setHoveredJob(null)}
                style={{
                  position: 'absolute',
                  top: topOffset + 2,
                  left,
                  width: `calc((100% - 48px) / 7 - 6px)`,
                  height,
                  borderRadius: '0.5rem',
                  background: isHov ? cfg.bar : cfg.fill,
                  borderLeft: `3px solid ${cfg.bar}`,
                  borderTop: `1px solid ${cfg.bar}40`,
                  borderRight: `1px solid ${cfg.bar}30`,
                  borderBottom: `1px solid ${cfg.bar}30`,
                  padding: '0.2rem 0.35rem',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                  boxShadow: isConnect ? `0 1px 6px ${cfg.bar}30` : 'none',
                  zIndex: isHov ? 10 : 1,
                }}
              >
                <div style={{
                  fontSize: '0.62rem', fontWeight: 800, color: isHov ? 'white' : cfg.ink,
                  lineHeight: 1.2, overflow: 'hidden',
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                }}>
                  {job.label}
                </div>
                {isConnect && height > 50 && (
                  <div style={{
                    marginTop: '0.15rem', fontSize: '0.58rem', fontWeight: 700,
                    color: isHov ? 'rgba(255,255,255,0.8)' : cfg.bar,
                    display: 'flex', alignItems: 'center', gap: 2,
                  }}>
                    <Globe size={8} /> {job.fm}
                  </div>
                )}
                {isConnect && (
                  <div style={{
                    position: 'absolute', top: 3, right: 4,
                    width: 6, height: 6, borderRadius: '50%', background: cfg.bar,
                    boxShadow: `0 0 4px ${cfg.bar}`,
                  }} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Hovered tooltip */}
      {hoveredJob !== null && (() => {
        const j = WEEK_JOBS[hoveredJob];
        if (!j) return null;
        const cfg = TYPE_CFG[j.type];
        return (
          <div style={{
            marginTop: '0.75rem', borderRadius: '0.875rem', padding: '0.75rem 1rem',
            background: 'white', border: `1px solid ${cfg.bar}30`,
            boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
            display: 'flex', alignItems: 'center', gap: '1rem',
          }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: cfg.bar, flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.82rem', color: '#010a4f' }}>{j.label}</div>
              <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                {String(j.start).padStart(2,'0')}:00 – {String(j.start + j.dur).padStart(2,'0')}:00
                {j.fm && ` · ${j.fm}`}
                {j.ref && ` · ${j.ref}`}
              </div>
            </div>
            <div style={{ marginLeft: 'auto' }}>
              <span style={{
                fontSize: '0.68rem', fontWeight: 800, padding: '0.25rem 0.6rem',
                borderRadius: '999px', background: `${cfg.bar}15`, color: cfg.bar,
                border: `1px solid ${cfg.bar}30`,
              }}>{j.source === 'connect' ? '🌐 Connect' : '✦ Cadi'}</span>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ─── FM Network view (original) ───────────────────────────────────────────────

const CONNECT_TIER = {
  elite:    { label: 'Connect Elite',    color: '#a78bfa', min: 93 },
  verified: { label: 'Connect Verified', color: '#34d399', min: 80 },
  eligible: { label: 'Connect Eligible', color: '#fbbf24', min: 70 },
};

function getTier(score) {
  if (score >= 93) return 'elite';
  if (score >= 80) return 'verified';
  return 'eligible';
}

const NETWORK = cleaners.map(c => ({
  ...c,
  connectScore: Math.max(70, Math.round(c.score * 0.97 + Math.random() * 4 - 2)),
  tier: getTier(c.score),
  distance: (Math.random() * 18 + 1).toFixed(1),
})).filter(c => c.score >= 70);

function FmNetworkView({ showToast }) {
  const [tierFilter, setTierFilter] = useState('all');
  const [search, setSearch]         = useState('');
  const [requested, setRequested]   = useState(new Set());

  const filtered = NETWORK.filter(c => {
    const matchTier   = tierFilter === 'all' || c.tier === tierFilter;
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.town.toLowerCase().includes(search.toLowerCase()) ||
      c.services.some(s => s.toLowerCase().includes(search.toLowerCase()));
    return matchTier && matchSearch;
  });

  const eliteCount    = NETWORK.filter(c => c.tier === 'elite').length;
  const verifiedCount = NETWORK.filter(c => c.tier === 'verified').length;
  const eligibleCount = NETWORK.filter(c => c.tier === 'eligible').length;
  const avgScore      = Math.round(NETWORK.reduce((s, c) => s + c.connectScore, 0) / NETWORK.length);

  return (
    <div className="p-6 space-y-4 max-w-5xl">
      <div className="rounded-2xl p-5"
        style={{ background: 'linear-gradient(135deg, rgba(167,139,250,0.1), rgba(79,120,255,0.08))', border: '1px solid rgba(167,139,250,0.25)' }}>
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
            style={{ background: 'rgba(167,139,250,0.2)', border: '1px solid rgba(167,139,250,0.35)' }}>🌐</div>
          <div>
            <div className="flex items-center gap-1.5 font-black text-sm"><CadiWordmark height={16} /> <span className="text-white">Connect Network</span></div>
            <div className="text-white/45 text-xs mt-0.5">Verified operatives available to Britannia Group — all scored, background-checked, ready to deploy.</div>
          </div>
          <div className="ml-auto grid grid-cols-3 gap-4 text-center">
            <div><div className="font-black text-lg" style={{ color: '#a78bfa' }}>{eliteCount}</div><div className="text-[10px] text-white/30">Elite</div></div>
            <div><div className="font-black text-lg" style={{ color: '#34d399' }}>{verifiedCount}</div><div className="text-[10px] text-white/30">Verified</div></div>
            <div><div className="font-black text-lg" style={{ color: '#4f78ff' }}>{avgScore}</div><div className="text-[10px] text-white/30">Avg score</div></div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, town, or specialism…"
          className="flex-1 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }} />
        <div className="flex items-center gap-1 p-1 rounded-xl"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
          {[
            { id: 'all', label: 'All', count: NETWORK.length },
            { id: 'elite', label: 'Elite', count: eliteCount, color: '#a78bfa' },
            { id: 'verified', label: 'Verified', count: verifiedCount, color: '#34d399' },
            { id: 'eligible', label: 'Eligible', count: eligibleCount, color: '#fbbf24' },
          ].map(({ id, label, count, color }) => (
            <button key={id} onClick={() => setTierFilter(id)}
              className="px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all"
              style={tierFilter === id ? {
                background: color ? `${color}20` : 'rgba(255,255,255,0.12)',
                border: `1px solid ${color ? `${color}40` : 'rgba(255,255,255,0.2)'}`,
                color: color || 'white',
              } : { color: 'rgba(255,255,255,0.3)', border: '1px solid transparent' }}>
              {label} <span className="opacity-50">({count})</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {filtered.map(c => {
          const tier = CONNECT_TIER[c.tier];
          const isRequested = requested.has(c.id);
          return (
            <div key={c.id} className="rounded-2xl p-4"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-xs font-black shrink-0"
                  style={{ background: 'linear-gradient(135deg, rgba(79,120,255,0.4), rgba(99,102,241,0.3))', border: '1px solid rgba(79,120,255,0.3)' }}>
                  {c.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-black text-sm">{c.name}</span>
                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full"
                      style={{ color: tier.color, background: `${tier.color}15`, border: `1px solid ${tier.color}35` }}>
                      {tier.label}
                    </span>
                  </div>
                  <div className="text-white/35 text-[10px] mt-0.5">{c.town} · {c.distance} mi away</div>
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {c.services.slice(0, 2).map(s => (
                      <span key={s} className="text-[9px] px-1.5 py-0.5 rounded text-white/45"
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)' }}>{s}</span>
                    ))}
                    {c.services.length > 2 && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded text-white/25"
                        style={{ background: 'rgba(255,255,255,0.04)' }}>+{c.services.length - 2}</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <div className="text-[10px] text-white/30 w-24 shrink-0">Connect Score</div>
                <div className="flex-1 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
                  <div className="h-full rounded-full" style={{ width: `${c.connectScore}%`, background: tier.color, boxShadow: `0 0 6px ${tier.color}60` }} />
                </div>
                <span className="text-[11px] font-black shrink-0" style={{ color: tier.color }}>{c.connectScore}</span>
              </div>
              <div className="mt-3 flex items-center gap-2 text-[10px] text-white/30">
                <span>{c.completions} jobs</span>
                <span className="text-white/15">·</span>
                <span>{c.avgRating}★</span>
                <span className="text-white/15">·</span>
                <span>{c.slaRate}% SLA</span>
                <div className="ml-auto">
                  <button
                    onClick={() => { setRequested(prev => new Set([...prev, c.id])); showToast(`request ${c.name} for Britannia Group`); }}
                    className="px-3 py-1.5 rounded-lg text-[10px] font-black transition-all"
                    style={isRequested ? {
                      background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.3)', color: '#34d399',
                    } : {
                      background: `${tier.color}15`, border: `1px solid ${tier.color}35`, color: tier.color,
                    }}>
                    {isRequested ? '✓ Requested' : 'Request operative'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GrowthStoryHeader() {
  return (
    <div style={{ padding: '1.25rem 1.5rem 0', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

      {/* Headline */}
      <div style={{ borderRadius: '1rem', padding: '1rem 1.25rem', background: 'rgba(22,163,74,0.07)', border: '1px solid rgba(22,163,74,0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.875rem' }}>
          <div style={{ width: 36, height: 36, borderRadius: '0.625rem', background: 'rgba(22,163,74,0.15)', border: '1px solid rgba(22,163,74,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <TrendingUp size={16} style={{ color: '#4ade80' }} />
          </div>
          <div>
            <div style={{ fontWeight: 900, fontSize: '0.9rem', color: 'white', lineHeight: 1.2, marginBottom: '0.25rem' }}>
              Win contracts you couldn't bid before
            </div>
            <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>
              Your contractor pool handles your current contracts — but when a bigger tender needs cover across 3 regions on short notice, that's where Cadi Connect turns a maybe into a yes.
            </div>
          </div>
        </div>
      </div>

      {/* Three value props */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.6rem' }}>
        {[
          { icon: Users,    color: '#a78bfa', n: '1,200+', label: 'vetted operatives on the network', sub: 'All DBS-checked, scored, insured' },
          { icon: ZapIcon,  color: '#fb923c', n: '24 hrs', label: 'average time to fill a gap',       sub: 'vs 2+ days of phone calls' },
          { icon: TrendingUp, color: '#34d399', n: '£0',   label: 'to join the network',              sub: 'Pay per job dispatched, nothing upfront' },
        ].map(({ icon: Icon, color, n, label, sub }) => (
          <div key={n} style={{ borderRadius: '0.75rem', padding: '0.75rem 0.875rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <Icon size={13} style={{ color, marginBottom: '0.3rem' }} />
            <div style={{ fontWeight: 900, fontSize: '1.2rem', color: 'white', lineHeight: 1 }}>{n}</div>
            <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.55)', fontWeight: 700, lineHeight: 1.3, marginTop: '0.18rem' }}>{label}</div>
            <div style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.22)', lineHeight: 1.3, marginTop: '0.1rem' }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* How it works */}
      <div style={{ borderRadius: '0.75rem', padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ fontSize: '0.58rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.22)', marginBottom: '0.55rem' }}>
          When a tender needs more than your own pool
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0' }}>
          {[
            { n: '1', label: 'Tender arrives\nneeding 50 staff in 3 regions' },
            { n: '2', label: 'Your pool covers\n30 — gap flagged' },
            { n: '3', label: 'Cadi Connect\nfills remaining 20' },
            { n: '4', label: 'You win the\ncontract, Cadi handles dispatch' },
          ].map((s, i) => (
            <div key={s.n} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem', flex: 1, padding: '0 0.15rem' }}>
                <div style={{ width: 20, height: 20, borderRadius: '50%', background: i === 2 ? 'rgba(22,163,74,0.2)' : 'rgba(255,255,255,0.07)', border: `1px solid ${i === 2 ? 'rgba(22,163,74,0.4)' : 'rgba(255,255,255,0.1)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.55rem', fontWeight: 900, color: i === 2 ? '#4ade80' : 'rgba(255,255,255,0.35)', flexShrink: 0 }}>{s.n}</div>
                <div style={{ fontSize: '0.52rem', color: i === 2 ? '#4ade80' : 'rgba(255,255,255,0.38)', fontWeight: 700, textAlign: 'center', lineHeight: 1.3, whiteSpace: 'pre-line' }}>{s.label}</div>
              </div>
              {i < 3 && <div style={{ width: 16, height: 1, background: 'rgba(255,255,255,0.1)', flexShrink: 0 }} />}
            </div>
          ))}
        </div>
      </div>

      <div style={{ fontSize: '0.62rem', fontWeight: 800, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', paddingTop: '0.25rem' }}>
        Network operatives — request for your contracts ↓
      </div>
    </div>
  );
}

export default function FmCadiConnect({ showToast }) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <GrowthStoryHeader />
        <FmNetworkView showToast={showToast} />
      </div>

      {/* Floating operative app link */}
      <div className="flex-shrink-0 px-6 py-3 flex items-center justify-between"
        style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.2)' }}>
        <div className="text-[11px] text-white/35">
          See what a contractor experiences on the other side
        </div>
        <button
          onClick={() => window.open('/operative-demo', '_blank')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black"
          style={{ background: 'rgba(194,65,12,0.15)', border: '1px solid rgba(194,65,12,0.3)', color: '#fb923c' }}>
          <ExternalLink size={10} /> Preview operative app
        </button>
      </div>
    </div>
  );
}
