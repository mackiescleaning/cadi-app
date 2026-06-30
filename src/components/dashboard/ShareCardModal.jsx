import { useState } from "react";
import CadiWordmark from "../CadiWordmark";
import { SECTOR_COLORS } from "./LeaderboardPanel";

export default function ShareCardModal({ onClose, businessName, sector, score, badges, rank, totalUsers, streak }) {
  const [copied, setCopied] = useState(false);
  const earnedBadges  = badges.filter(b => b.earned).slice(0, 4);
  const sc            = SECTOR_COLORS[sector] ?? SECTOR_COLORS.residential;
  const topPct        = Math.round(((rank ?? totalUsers) / (totalUsers ?? 1)) * 100);
  const tierColor     = score?.total >= 90 ? "#a78bfa" : score?.total >= 75 ? "#34d399" : score?.total >= 60 ? "#38bdf8" : score?.total >= 40 ? "#fbbf24" : "#f87171";
  const tier          = score?.tier ?? "Solid";
  const r             = 38;
  const circ          = 2 * Math.PI * r;
  const dashOffset    = circ * (1 - (score?.total ?? 0) / 100);

  const handleCopy = () => {
    navigator.clipboard?.writeText("Check out my Cadi Score! 🚀 cadi.cleaning").then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-sm">

        <div className="text-center mb-3">
          <p className="text-white/70 text-xs font-semibold">Screenshot this card and share it 📸</p>
        </div>

        <div
          className="relative overflow-hidden rounded-3xl shadow-2xl"
          style={{ background: 'linear-gradient(145deg, #010a4f 0%, #05124a 40%, #091660 70%, #0d1e78 100%)', aspectRatio: '9/16', maxHeight: '75vh' }}
        >
          <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'linear-gradient(rgba(153,197,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(153,197,255,1) 1px,transparent 1px)', backgroundSize: '32px 32px' }} />
          <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-brand-blue/30 blur-3xl" />
          <div className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full bg-brand-skyblue/15 blur-3xl" />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-skyblue to-transparent opacity-80" />

          <div className="relative h-full flex flex-col px-7 py-8 justify-between">

            <div className="flex items-center justify-between">
              <CadiWordmark height={20} />
              <span className={`text-xs font-bold px-3 py-1 rounded-full border ${sc.bg} ${sc.text} bg-opacity-20 border-current/30`}>
                {sc.label}
              </span>
            </div>

            <div className="flex flex-col items-center text-center gap-4">
              <div>
                <p className="text-brand-skyblue/70 text-xs font-bold uppercase tracking-widest mb-1">Cadi Score</p>
                <h2 className="text-white font-black text-2xl leading-tight tracking-tight">{businessName || "My Business"}</h2>
              </div>

              <div className="relative" style={{ width: 140, height: 140 }}>
                <svg width="140" height="140" viewBox="0 0 140 140" className="-rotate-90">
                  <circle cx="70" cy="70" r={r * 1.85} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" />
                  <circle
                    cx="70" cy="70" r={r * 1.85} fill="none"
                    stroke={tierColor} strokeWidth="10" strokeLinecap="round"
                    strokeDasharray={circ * 1.85}
                    strokeDashoffset={circ * 1.85 * (1 - (score?.total ?? 0) / 100)}
                    style={{ filter: `drop-shadow(0 0 8px ${tierColor})` }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-4xl font-black text-white tabular-nums leading-none">{score?.total ?? 0}</span>
                  <span className="text-xs font-bold mt-1" style={{ color: tierColor }}>{tier}</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex flex-col items-center px-4 py-2 rounded-xl bg-white/10 border border-white/10">
                  <span className="text-white font-black text-lg leading-none">#{rank ?? "?"}</span>
                  <span className="text-brand-skyblue/60 text-[10px] mt-0.5">Leaderboard</span>
                </div>
                {rank != null && (
                  <div className="flex flex-col items-center px-4 py-2 rounded-xl bg-white/10 border border-white/10">
                    <span className="text-white font-black text-lg leading-none">Top {topPct}%</span>
                    <span className="text-brand-skyblue/60 text-[10px] mt-0.5">All businesses</span>
                  </div>
                )}
                {streak > 0 && (
                  <div className="flex flex-col items-center px-4 py-2 rounded-xl bg-white/10 border border-white/10">
                    <span className="text-white font-black text-lg leading-none">🔥 {streak}</span>
                    <span className="text-brand-skyblue/60 text-[10px] mt-0.5">Day streak</span>
                  </div>
                )}
              </div>
            </div>

            {earnedBadges.length > 0 && (
              <div className="flex flex-col items-center gap-2">
                <p className="text-brand-skyblue/50 text-[10px] font-bold uppercase tracking-widest">Achievements</p>
                <div className="flex gap-3 justify-center">
                  {earnedBadges.map(b => (
                    <div key={b.id} className="flex flex-col items-center gap-1">
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${b.color} flex items-center justify-center text-lg shadow-lg`}>
                        {b.emoji}
                      </div>
                      <span className="text-[9px] text-white/50 font-semibold max-w-[40px] text-center leading-tight">{b.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-col items-center gap-1">
              <div className="w-16 h-px bg-white/20" />
              <p className="text-white/30 text-[10px] font-bold uppercase tracking-widest mt-1">Powered by Cadi</p>
              <p className="text-brand-skyblue/40 text-[10px]">cadi.cleaning · Your Cleaning Business OS</p>
            </div>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            onClick={handleCopy}
            className="flex-1 py-3 bg-white text-brand-navy text-xs font-black rounded-xl hover:bg-gray-100 transition-colors"
          >
            {copied ? "✓ Copied!" : "📋 Copy link"}
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-white/10 text-white text-xs font-bold rounded-xl hover:bg-white/20 transition-colors border border-white/20"
          >
            Close
          </button>
        </div>
        <p className="text-center text-white/30 text-[10px] mt-2">Take a screenshot to share on social media</p>
      </div>
    </div>
  );
}
