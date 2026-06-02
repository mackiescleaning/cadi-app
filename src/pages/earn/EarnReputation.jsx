import { useState } from 'react';
import PublicProfilePreview from '../../components/PublicProfilePreview';

const EARN_ORANGE = '#C2410C';

const REVIEWS = [
  {
    id: 'r1', fm: 'Britannia Group', site: 'Next – Luton The Mall', date: '8 May 2026',
    rating: 5, comment: 'Excellent as always — arrived on time, thorough clean, all photos uploaded. Store was ready well before opening. Site supervisor was very happy.',
    job: 'Retail morning clean',
  },
  {
    id: 'r2', fm: 'Britannia Group', site: 'Premier Inn Luton Airport', date: '6 May 2026',
    rating: 5, comment: 'Great job. Before and after photos excellent quality. Lobby and breakfast areas spotless. SLA met comfortably.',
    job: 'Morning clean',
  },
  {
    id: 'r3', fm: 'Britannia Group', site: 'Next – Luton The Mall', date: '30 Apr 2026',
    rating: 3, comment: 'Arrived 12 minutes late — slightly outside SLA window. Clean itself was good quality. Please flag any delays in advance.',
    job: 'Retail morning clean',
  },
  {
    id: 'r4', fm: 'Britannia Group', site: 'Next – Luton The Mall', date: '25 Apr 2026',
    rating: 5, comment: 'Outstanding deep clean. Every area completed, 31 photos uploaded with full sign-off. Fitting rooms and stockroom immaculate. Highly recommended.',
    job: 'Deep clean',
  },
];

const CONNECT_SCORE = 91;
const CONNECT_TIER = { label: 'Connect Verified', color: '#34d399', bg: 'rgba(52,211,153,0.1)', border: 'rgba(52,211,153,0.3)' };

const SUB_SCORES = [
  { label: 'Reliability',   score: 96, max: 30, desc: 'On-time arrival, SLA compliance, zero no-shows' },
  { label: 'Evidence',      score: 92, max: 25, desc: 'Photo quality, check-in/out compliance' },
  { label: 'Quality',       score: 88, max: 25, desc: 'FM ratings, client feedback, issue rate' },
  { label: 'Adaptability',  score: 82, max: 20, desc: 'New sites, cross-FM consistency' },
];

function Stars({ n }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(i => (
        <span key={i} className={`text-base ${i <= n ? 'text-amber-400' : 'text-gray-200'}`}>★</span>
      ))}
    </div>
  );
}

export default function EarnReputation() {
  const [available, setAvailable] = useState(true);

  return (
    <div className="max-w-2xl space-y-5 pb-8">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-[#010a4f]">My Profile</h1>
          <p className="text-sm text-gray-500 mt-0.5">This is how FM companies see you on Cadi Connect.</p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-3xl font-black text-[#010a4f]">{CONNECT_SCORE}</div>
          <div className="text-[10px] text-gray-400 mb-1">Connect Score</div>
          <span className="text-[10px] font-black px-2.5 py-1 rounded-full"
            style={{ color: CONNECT_TIER.color, background: CONNECT_TIER.bg, border: `1px solid ${CONNECT_TIER.border}` }}>
            {CONNECT_TIER.label}
          </span>
        </div>
      </div>

      {/* Availability toggle */}
      <div className="bg-white rounded-2xl border border-[#99c5ff]/20 shadow-sm px-5 py-4 flex items-center justify-between">
        <div>
          <div className="text-sm font-bold text-[#010a4f]">Availability</div>
          <div className="text-xs text-gray-400 mt-0.5">
            {available ? 'You are visible to FMs and accepting new work' : 'Hidden from FMs — not taking on new work'}
          </div>
        </div>
        <button
          onClick={() => setAvailable(v => !v)}
          className="relative w-12 h-6 rounded-full transition-colors"
          style={{ background: available ? '#059669' : '#e5e7eb' }}>
          <div className="absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all"
            style={{ left: available ? '24px' : '4px' }} />
        </button>
      </div>

      {/* Public profile (live data) */}
      <PublicProfilePreview />

      {/* Connect Score breakdown */}
      <div className="bg-white rounded-2xl border border-[#99c5ff]/20 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">Connect Score breakdown</div>
          <span className="text-[9px] font-black px-2 py-0.5 rounded-full"
            style={{ color: CONNECT_TIER.color, background: CONNECT_TIER.bg, border: `1px solid ${CONNECT_TIER.border}` }}>
            {CONNECT_TIER.label}
          </span>
        </div>
        <div className="space-y-3">
          {SUB_SCORES.map(({ label, score, max, desc }) => {
            const pct = Math.round((score / 100) * 100);
            const color = score >= 90 ? '#10b981' : score >= 80 ? '#3b82f6' : score >= 70 ? '#f59e0b' : '#ef4444';
            return (
              <div key={label}>
                <div className="flex items-center justify-between mb-1">
                  <div>
                    <span className="text-sm font-bold text-[#010a4f]">{label}</span>
                    <span className="text-xs text-gray-400 ml-2">{desc}</span>
                  </div>
                  <span className="text-sm font-black" style={{ color }}>{score}</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 p-3 rounded-xl text-xs text-gray-500 bg-[#f8faff] border border-[#99c5ff]/20">
          <span className="font-bold text-[#010a4f]">Connect Score</span> is your portable reputation across the Cadi network — separate from your Cadi business score. FM companies use it to find and trust new operatives. Complete more cross-FM jobs to build Adaptability and reach Connect Elite.
        </div>
      </div>

      {/* FM Reviews */}
      <div className="bg-white rounded-2xl border border-[#99c5ff]/20 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
          <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">FM reviews</div>
          <div className="flex items-center gap-2">
            <span className="text-amber-400 text-sm">★</span>
            <span className="text-sm font-black text-[#010a4f]">4.6</span>
            <span className="text-xs text-gray-400">({REVIEWS.length} reviews)</span>
          </div>
        </div>
        <div className="divide-y divide-gray-50">
          {REVIEWS.map(review => (
            <div key={review.id} className="px-5 py-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-[#010a4f]">{review.site}</span>
                    <span className="text-[10px] text-gray-400">{review.job}</span>
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">{review.fm} · {review.date}</div>
                </div>
                <Stars n={review.rating} />
              </div>
              <p className="text-sm text-gray-600 leading-relaxed">{review.comment}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
