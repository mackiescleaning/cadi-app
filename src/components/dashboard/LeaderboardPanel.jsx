import { useState } from "react";

export const LEADERBOARD_DEMO = [
  { id: "l1",  name: "Sparkle & Shine",  sector: "residential", score: 97, delta: +4,  region: "SW" },
  { id: "l2",  name: "CleanPro SW",      sector: "commercial",  score: 94, delta: +1,  region: "SE" },
  { id: "l3",  name: "Crystal Clear",    sector: "exterior",    score: 91, delta: -1,  region: "NW" },
  { id: "l4",  name: "Prestige Clean",   sector: "commercial",  score: 88, delta: +6,  region: "M"  },
  { id: "l5",  name: "Gleam Team",       sector: "residential", score: 86, delta: +2,  region: "E"  },
  { id: "l6",  name: "FreshStart Svcs",  sector: "residential", score: 83, delta: -3,  region: "W"  },
  { id: "l7",  name: "AceClean Ltd",     sector: "commercial",  score: 81, delta: +5,  region: "NE" },
  { id: "l8",  name: "BrightSide Co",    sector: "exterior",    score: 79, delta: 0,   region: "SW" },
  { id: "l9",  name: "Spotless & Co",    sector: "residential", score: 77, delta: +3,  region: "SE" },
  { id: "l10", name: "ProShine NW",      sector: "exterior",    score: 74, delta: -2,  region: "NW" },
  { id: "l11", name: "Diamond Clean",    sector: "commercial",  score: 72, delta: +1,  region: "M"  },
  { id: "l12", name: "TopGloss Ltd",     sector: "residential", score: 69, delta: +4,  region: "E"  },
  { id: "l13", name: "SwiftClean Co",    sector: "exterior",    score: 66, delta: -1,  region: "SW" },
  { id: "l14", name: "Immaculate Svcs",  sector: "commercial",  score: 63, delta: +2,  region: "SE" },
  { id: "l15", name: "CleanSweep Pro",   sector: "residential", score: 60, delta: 0,   region: "W"  },
  { id: "l16", name: "PureClean UK",     sector: "exterior",    score: 57, delta: +3,  region: "NE" },
  { id: "l17", name: "GoldDust Clean",   sector: "residential", score: 53, delta: -4,  region: "NW" },
  { id: "l18", name: "MintFresh Ltd",    sector: "commercial",  score: 49, delta: +1,  region: "M"  },
  { id: "l19", name: "AllBright Svcs",   sector: "exterior",    score: 44, delta: 0,   region: "SE" },
  { id: "l20", name: "BestClean Co",     sector: "residential", score: 38, delta: +2,  region: "E"  },
];

export const SECTOR_COLORS = {
  residential: { bg: "bg-emerald-100", text: "text-emerald-700", dot: "bg-emerald-500", label: "Residential" },
  commercial:  { bg: "bg-blue-100",    text: "text-brand-blue",  dot: "bg-brand-blue",  label: "Commercial"  },
  exterior:    { bg: "bg-orange-100",  text: "text-orange-700",  dot: "bg-orange-500",  label: "Exterior"    },
};

// Dot glow per sector — bright enough for the dark card.
const SECTOR_DOT_GLOW = {
  residential: "bg-emerald-400 shadow-[0_0_6px_1px_rgba(52,211,153,0.5)]",
  commercial:  "bg-[#4f78ff] shadow-[0_0_6px_1px_rgba(79,120,255,0.5)]",
  exterior:    "bg-orange-400 shadow-[0_0_6px_1px_rgba(251,146,60,0.5)]",
};

// Matches DASH_CARD_BG in Dashboard.jsx — the shared module surface.
const CARD_BG = 'linear-gradient(135deg, #040810 0%, #06103c 50%, #080d28 100%)';

export default function LeaderboardPanel({ userScore, userBizName, userSector, communityOptIn, onOptIn, healthDelta = 0, entries, isPreview = false }) {
  const [filter, setFilter] = useState("all");
  const [showExplainer, setShowExplainer] = useState(() => {
    try { return !localStorage.getItem('cadi_lb_explained'); } catch { return true; }
  });

  const dismissExplainer = () => {
    setShowExplainer(false);
    try { localStorage.setItem('cadi_lb_explained', '1'); } catch {}
  };

  const userEntry = {
    id: "me",
    owner_id: "me",
    name: communityOptIn ? (userBizName || "Your Business") : "Your Business",
    sector: userSector || "residential",
    score: userScore ?? 42,
    prev_score: null,
    region: "You",
    isMe: true,
  };

  // No demo fallback here — the Dashboard decides what to pass (real-only for
  // live users, padded demo board for demo mode). An empty board stays honest.
  const boardSource = entries ?? [];
  const allSource   = [...boardSource, userEntry];

  // Deterministic sort: score desc, then updated_at asc (older entries win ties for
  // having held their score longer), then owner_id asc as final tie-break.
  const sortFn = (a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const ta = a.updated_at ?? '';
    const tb = b.updated_at ?? '';
    if (ta !== tb) return ta.localeCompare(tb);
    return String(a.owner_id ?? a.id ?? '').localeCompare(String(b.owner_id ?? b.id ?? ''));
  };

  const globalRanked = [...allSource]
    .sort(sortFn)
    .map((e, i) => ({ ...e, globalRank: i + 1 }));

  const globalPrevRanked = [...allSource]
    .sort((a, b) => (b.prev_score ?? b.score) - (a.prev_score ?? a.score))
    .map((e, i) => ({ ...e, globalPrevRank: i + 1 }));

  const prevRankMap = {};
  globalPrevRanked.forEach(e => { prevRankMap[e.owner_id ?? e.id] = e.globalPrevRank; });

  const allEntries = globalRanked.map(e => {
    const key      = e.owner_id ?? e.id;
    const prevRank = prevRankMap[key] ?? e.globalRank;
    return { ...e, rank: e.globalRank, rankDelta: prevRank - e.globalRank };
  });

  const sectorLabel = filter === "all" ? null : SECTOR_COLORS[filter]?.label ?? filter;

  const filtered = filter === "all"
    ? allEntries
    : (() => {
        const inSector  = allSource.filter(e => e.sector === filter || e.isMe);
        const sPrevMap  = {};
        [...inSector]
          .sort((a, b) => (b.prev_score ?? b.score) - (a.prev_score ?? a.score))
          .forEach((e, i) => { sPrevMap[e.owner_id ?? e.id] = i + 1; });
        return [...inSector]
          .sort(sortFn)
          .map((e, i) => {
            const key = e.owner_id ?? e.id;
            return { ...e, rank: i + 1, rankDelta: (sPrevMap[key] ?? i + 1) - (i + 1) };
          });
      })();

  const userRank   = filtered.find(e => e.isMe)?.rank ?? filtered.length;
  const totalCount = filtered.length;
  const globalRank = allEntries.find(e => e.isMe)?.rank ?? allEntries.length;
  // Tier label must be computed from the GLOBAL pool, not the sector-filtered one —
  // otherwise an N=1 sector filter would show "Elite" for "#1 of 1".
  const topPct     = Math.round((globalRank / allEntries.length) * 100);

  const podium = filtered.filter(e => !e.isMe).slice(0, 3);

  const tierLabel = topPct <= 10 ? "Elite" : topPct <= 25 ? "Pro" : topPct <= 50 ? "Rising" : "Starter";

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-[rgba(251,191,36,0.35)]"
      style={{
        background: CARD_BG,
        boxShadow: '0 0 0 1px rgba(251,191,36,0.12), 0 0 22px -2px rgba(251,191,36,0.28), 0 0 60px -12px rgba(251,191,36,0.20), 0 24px 60px -24px rgba(0,0,0,0.6)',
      }}
    >
      {/* Ambient glow — gold for the podium spirit, blue for the family look */}
      <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(251,191,36,0.10) 0%, transparent 70%)' }} />
      <div className="absolute -bottom-16 -left-12 w-48 h-48 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(79,120,255,0.10) 0%, transparent 70%)' }} />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/40 to-transparent" />

      <div className="relative">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[rgba(79,120,255,0.12)] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-1.5 h-4 rounded-full bg-amber-400 shadow-[0_0_8px_2px_rgba(251,191,36,0.55)] shrink-0" />
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#99c5ff] truncate">
                {sectorLabel ? `${sectorLabel} league` : "Community leaderboard"}
              </p>
              <p className="text-[10px] text-[rgba(153,197,255,0.35)] mt-0.5 truncate">
                {sectorLabel ? `Ranked among ${sectorLabel.toLowerCase()} cleaners · ` : "All sectors · "}
                Cadi Score · updated weekly
              </p>
            </div>
          </div>
          {!isPreview && (
            <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border shrink-0 ${
              topPct <= 10 ? "bg-yellow-400/20 border-yellow-400/40 text-yellow-300"
              : topPct <= 25 ? "bg-emerald-400/15 border-emerald-400/35 text-emerald-300"
              : topPct <= 50 ? "bg-[#4f78ff]/20 border-[#4f78ff]/35 text-[#99c5ff]"
              : "bg-white/5 border-white/15 text-[rgba(153,197,255,0.5)]"
            }`}>{tierLabel}</span>
          )}
        </div>

        {showExplainer && (
          <div className="mx-4 mt-4 p-3 rounded-xl bg-white/[0.04] border border-white/10 relative">
            <button onClick={dismissExplainer} className="absolute top-2 right-2 text-white/20 hover:text-white/50 text-xs">✕</button>
            <p className="text-xs font-black text-white mb-1.5">🏆 Welcome to the Cadi community</p>
            <div className="space-y-1 text-[11px] text-[rgba(153,197,255,0.5)] leading-relaxed">
              <p>• Your rank is based on your <span className="font-semibold text-white/80">Cadi Score</span> — optimise to climb</p>
              <p>• All business names are <span className="font-semibold text-white/80">anonymous</span> unless you opt in to the community</p>
              <p>• Reach <span className="font-semibold text-yellow-400">Elite tier (top 10%)</span> to unlock exclusive badges and the share card</p>
            </div>
          </div>
        )}

        {!communityOptIn && !isPreview && (
          <div className="mx-4 mt-4 mb-2 p-4 rounded-xl border border-[rgba(79,120,255,0.25)]" style={{ background: 'linear-gradient(135deg, rgba(79,120,255,0.14) 0%, rgba(153,197,255,0.05) 100%)' }}>
            <div className="flex items-start gap-3">
              <span className="text-2xl shrink-0" style={{ filter: 'drop-shadow(0 0 10px rgba(153,197,255,0.4))' }}>👻</span>
              <div className="flex-1">
                <p className="text-sm font-black text-white mb-0.5">
                  You'd be ranked ~#{globalRank} if you joined
                </p>
                <p className="text-xs text-[rgba(153,197,255,0.5)] leading-relaxed mb-3">
                  Reveal {userBizName || "your business name"} to claim your spot on the leaderboard — and get featured when you hit Elite tier.
                </p>
                <button
                  onClick={onOptIn}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-black text-white rounded-xl transition-all hover:brightness-110"
                  style={{ background: 'linear-gradient(135deg, #4f78ff, #1a3de0)', boxShadow: '0 8px 20px -6px rgba(79,120,255,0.6), inset 0 1px 0 rgba(255,255,255,0.2)' }}
                >
                  Claim my spot →
                </button>
                <p className="text-[10px] text-[rgba(153,197,255,0.3)] mt-1.5">Your business name replaces "Your Business" on the board</p>
              </div>
            </div>
          </div>
        )}

        {/* Your ranking strip */}
        <div className="px-5 py-4 border-y border-[rgba(79,120,255,0.12)] bg-white/[0.03] flex items-center justify-between">
          {isPreview ? (
            <div className="flex-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-[rgba(153,197,255,0.4)] mb-1">Your ranking</p>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl">🔒</span>
                <p className="text-sm font-black text-white">Building your rank…</p>
              </div>
              <p className="text-xs text-[rgba(153,197,255,0.4)] leading-relaxed">Add customers, jobs and invoices to see where your business stands against others.</p>
            </div>
          ) : (
            <>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-[rgba(153,197,255,0.4)] mb-1">
                  {sectorLabel ? `Your ${sectorLabel} rank` : "Your ranking"}
                </p>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-black tabular-nums text-white" style={{ textShadow: '0 0 24px rgba(251,191,36,0.25)' }}>#{userRank}</span>
                  <span className="text-sm text-[rgba(153,197,255,0.4)]">of {totalCount} {sectorLabel ? `${sectorLabel.toLowerCase()} businesses` : "businesses"}</span>
                </div>
                <p className="text-xs text-[rgba(153,197,255,0.5)] mt-1">
                  Top <span className="font-bold text-white">{topPct}%</span> · <span className={`font-black ${topPct <= 10 ? "text-yellow-400" : topPct <= 25 ? "text-emerald-400" : topPct <= 50 ? "text-[#99c5ff]" : "text-[rgba(153,197,255,0.4)]"}`}>{tierLabel}</span>
                  {sectorLabel && <span className="text-[rgba(153,197,255,0.3)] font-normal"> · #{globalRank} overall</span>}
                </p>
              </div>
              <div className="text-right">
                {healthDelta !== 0 && (
                  <>
                    <div className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border ${
                      healthDelta > 0 ? "bg-emerald-500/15 border-emerald-500/30" : "bg-red-500/15 border-red-500/30"
                    }`}>
                      <span className={`text-sm font-black ${healthDelta > 0 ? "text-emerald-300" : "text-red-300"}`}>
                        {healthDelta > 0 ? `↑ +${healthDelta}` : `↓ ${healthDelta}`}
                      </span>
                      <span className={`text-[10px] ${healthDelta > 0 ? "text-emerald-300/70" : "text-red-300/70"}`}>pts</span>
                    </div>
                    <p className="text-[10px] text-[rgba(153,197,255,0.25)] mt-1.5">since last session</p>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        {/* Podium */}
        <div className="px-5 py-4 border-b border-[rgba(79,120,255,0.12)]">
          <p className="text-[10px] font-black uppercase tracking-widest text-[rgba(153,197,255,0.4)] mb-3">
            {sectorLabel ? `${sectorLabel} podium` : "This week's podium"}
          </p>
          {podium.length === 0 && (
            <div className="flex items-center gap-3 px-3 py-3 rounded-xl bg-white/[0.03] border border-dashed border-amber-400/25">
              <span className="text-2xl" style={{ filter: 'drop-shadow(0 0 10px rgba(251,191,36,0.5))' }}>🥇</span>
              <p className="text-xs text-[rgba(153,197,255,0.5)] leading-relaxed">
                The podium is empty — you're in early. The first businesses to join the community take the medals.
              </p>
            </div>
          )}
          <div className="flex items-end justify-center gap-2">
            {[podium[1], podium[0], podium[2]].map((entry, i) => {
              const heights  = ["h-16", "h-24", "h-14"];
              const medals   = ["🥈", "🥇", "🥉"];
              const configs  = [
                { bar: "bg-gradient-to-b from-slate-300 to-slate-400",  glow: "shadow-[0_0_18px_4px_rgba(148,163,184,0.45)]",  border: "border-slate-300/60",  score: "text-slate-100" },
                { bar: "bg-gradient-to-b from-yellow-300 to-amber-400", glow: "shadow-[0_0_22px_6px_rgba(251,191,36,0.55)]",  border: "border-yellow-300/70", score: "text-yellow-100" },
                { bar: "bg-gradient-to-b from-orange-400 to-amber-600", glow: "shadow-[0_0_16px_4px_rgba(251,146,60,0.45)]",  border: "border-orange-400/60", score: "text-orange-100" },
              ];
              if (!entry) return null;
              const cfg = configs[i];
              return (
                <div key={entry.id} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-lg" style={{ filter: i === 1 ? 'drop-shadow(0 0 8px rgba(251,191,36,0.6))' : undefined }}>{medals[i]}</span>
                  <p className="text-[10px] font-bold text-white/70 text-center truncate w-full px-1">{entry.name}</p>
                  <div className={`flex items-end justify-center w-full ${heights[i]} ${cfg.bar} ${cfg.glow} rounded-t-lg border ${cfg.border}`}>
                    <span className={`text-sm font-black pb-2 ${cfg.score}`}>{entry.score}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sector filters */}
        <div className="px-5 pt-3 flex gap-1.5 flex-wrap">
          {[
            { key: "all",         label: "All sectors" },
            { key: "residential", label: "🏠 Residential" },
            { key: "commercial",  label: "🏢 Commercial" },
            { key: "exterior",    label: "🪟 Exterior" },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-2.5 py-1.5 text-[10px] font-black rounded-full border transition-all ${
                filter === f.key
                  ? "bg-amber-400/20 text-amber-300 border-amber-400/40 shadow-[0_0_10px_rgba(251,191,36,0.2)]"
                  : "text-[rgba(153,197,255,0.4)] border-white/10 hover:border-white/25 hover:text-white/70"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Rows */}
        <div className="divide-y divide-[rgba(79,120,255,0.08)] mt-2 max-h-60 overflow-y-auto">
          {(() => {
            const top10 = filtered.slice(0, 10);
            const userEntryFiltered = filtered.find(e => e.isMe);
            // If user is outside top 10, pin their row at the bottom with a separator so
            // they always see where they stand.
            const meInTop = top10.some(e => e.isMe);
            const tail = !meInTop && userEntryFiltered ? [{ __divider: true }, userEntryFiltered] : [];
            return [...top10, ...tail].map((entry, idx) => {
              if (entry.__divider) {
                return (
                  <div key={`divider-${idx}`} className="px-4 py-1.5 text-center text-[9px] font-bold tracking-[0.2em] uppercase text-white/20">
                    · · ·
                  </div>
                );
              }
              const dotGlow = SECTOR_DOT_GLOW[entry.sector] ?? SECTOR_DOT_GLOW.residential;
              return (
                <div
                  key={entry.id}
                  className={`flex items-center gap-3 px-5 py-2.5 transition-colors ${
                    entry.isMe
                      ? "border-l-2 border-amber-400"
                      : "hover:bg-white/[0.03]"
                  }`}
                  style={entry.isMe ? { background: 'linear-gradient(90deg, rgba(251,191,36,0.10) 0%, transparent 65%)' } : undefined}
                >
                  <span className={`text-xs font-black w-6 text-center shrink-0 tabular-nums ${entry.isMe ? "text-amber-300" : "text-[rgba(153,197,255,0.3)]"}`}>
                    #{entry.rank}
                  </span>
                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotGlow}`} />
                  <p className={`flex-1 text-xs truncate ${entry.isMe ? "text-white font-black" : "text-[rgba(153,197,255,0.6)] font-semibold"}`}>
                    {entry.name} {entry.isMe && <span className="text-amber-300 font-bold">(you)</span>}
                  </p>
                  <span className={`text-xs font-black tabular-nums ${entry.isMe ? "text-white" : "text-[rgba(153,197,255,0.5)]"}`}>{entry.score}</span>
                  {entry.rankDelta !== 0 && entry.rankDelta !== undefined && (
                    <span className={`text-[10px] font-bold w-8 text-right shrink-0 ${entry.rankDelta > 0 ? "text-emerald-300" : "text-red-300"}`}>
                      {entry.rankDelta > 0 ? `↑${entry.rankDelta}` : `↓${Math.abs(entry.rankDelta)}`}
                    </span>
                  )}
                </div>
              );
            });
          })()}
        </div>

        {/* Footer */}
        <div className="px-5 py-2.5 border-t border-[rgba(79,120,255,0.12)]">
          <p className="text-[10px] text-[rgba(153,197,255,0.25)] text-center">
            {communityOptIn ? "Your business name is visible to the Cadi community" : "Join the community to show your real business name on the leaderboard"}
          </p>
        </div>
      </div>
    </div>
  );
}
