import { useState } from 'react';
import cleaners from '../mock/cleaners.json';

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

const ALL_SERVICES = [...new Set(NETWORK.flatMap(c => c.services))].sort();

export default function FmCadiConnect({ showToast }) {
  const [tierFilter, setTierFilter]   = useState('all');
  const [search, setSearch]           = useState('');
  const [requested, setRequested]     = useState(new Set());

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
    <div className="p-6 space-y-5 max-w-5xl">

      {/* Header */}
      <div className="rounded-2xl p-5"
        style={{ background: 'linear-gradient(135deg, rgba(167,139,250,0.1), rgba(79,120,255,0.08))', border: '1px solid rgba(167,139,250,0.25)' }}>
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
            style={{ background: 'rgba(167,139,250,0.2)', border: '1px solid rgba(167,139,250,0.35)' }}>🌐</div>
          <div>
            <div className="text-white font-black text-sm">Cadi Connect Network</div>
            <div className="text-white/45 text-xs mt-0.5">Verified operatives available to Britannia FM — all scored, all background-checked, all ready to deploy.</div>
          </div>
          <div className="ml-auto grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="font-black text-lg" style={{ color: '#a78bfa' }}>{eliteCount}</div>
              <div className="text-[10px] text-white/30">Elite</div>
            </div>
            <div>
              <div className="font-black text-lg" style={{ color: '#34d399' }}>{verifiedCount}</div>
              <div className="text-[10px] text-white/30">Verified</div>
            </div>
            <div>
              <div className="font-black text-lg" style={{ color: '#4f78ff' }}>{avgScore}</div>
              <div className="text-[10px] text-white/30">Avg score</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <input
          type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, town, or specialism…"
          className="flex-1 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
        />
        <div className="flex items-center gap-1 p-1 rounded-xl"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
          {[
            { id: 'all',      label: 'All',      count: NETWORK.length },
            { id: 'elite',    label: 'Elite',    count: eliteCount,    color: '#a78bfa' },
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

      {/* Grid */}
      <div className="grid grid-cols-2 gap-3">
        {filtered.map(c => {
          const tier = CONNECT_TIER[c.tier];
          const isRequested = requested.has(c.id);
          return (
            <div key={c.id} className="rounded-2xl p-4 transition-all"
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

              {/* Score bar */}
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
                    onClick={() => {
                      setRequested(prev => new Set([...prev, c.id]));
                      showToast(`request ${c.name} for Britannia FM`);
                    }}
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

      {filtered.length === 0 && (
        <div className="text-center py-12 text-white/25 text-sm">No operatives match your search</div>
      )}
    </div>
  );
}
