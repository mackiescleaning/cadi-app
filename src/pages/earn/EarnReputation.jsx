import { useState } from 'react';
import PublicProfilePreview from '../../components/PublicProfilePreview';

const EARN_ORANGE = '#C2410C';

const REVIEWS = [
  {
    id: 'r1', fm: 'Britannia FM', site: 'Riverside Primary', date: '8 May 2026',
    rating: 5, comment: 'Excellent as always — arrived on time, thorough clean, all photos uploaded. Site supervisor was very happy.',
    job: 'Morning clean',
  },
  {
    id: 'r2', fm: 'Britannia FM', site: 'Wharfside Nursery',  date: '6 May 2026',
    rating: 5, comment: 'Great job. Before and after photos excellent quality. SLA met comfortably.',
    job: 'Morning clean',
  },
  {
    id: 'r3', fm: 'Britannia FM', site: 'Riverside Primary', date: '30 Apr 2026',
    rating: 3, comment: 'Arrived 12 minutes late — slightly outside SLA window. Clean itself was good quality. Please flag any delays in advance.',
    job: 'Morning clean',
  },
  {
    id: 'r4', fm: 'Britannia FM', site: 'Riverside Primary', date: '25 Apr 2026',
    rating: 5, comment: 'Outstanding deep clean. Every area completed, 31 photos uploaded with full sign-off. Highly recommended.',
    job: 'Deep clean',
  },
];

const SUB_SCORES = [
  { label: 'Reliability',  score: 96, desc: 'On-time arrival, SLA compliance' },
  { label: 'Quality',      score: 92, desc: 'FM ratings, photo standards' },
  { label: 'Compliance',   score: 98, desc: 'DBS, insurance, accreditations' },
  { label: 'Responsiveness', score: 88, desc: 'Application speed, communication' },
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

      {/* Preview banner */}
      <div className="flex items-center gap-3 rounded-xl px-4 py-3"
        style={{ background: 'rgba(194,65,12,0.07)', border: '1px solid rgba(194,65,12,0.2)' }}>
        <span className="text-[9px] font-black tracking-widest px-2 py-0.5 rounded-full shrink-0"
          style={{ background: EARN_ORANGE, color: 'white' }}>PREVIEW</span>
        <span className="text-xs text-[#7c2d12]">
          This is how FM aggregators see your profile. Your score is built by everything you do in Cadi.
        </span>
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

      {/* Score breakdown */}
      <div className="bg-white rounded-2xl border border-[#99c5ff]/20 shadow-sm p-5">
        <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-4">Score breakdown</div>
        <div className="space-y-3">
          {SUB_SCORES.map(({ label, score, desc }) => {
            const color = score >= 95 ? '#10b981' : score >= 85 ? '#3b82f6' : score >= 75 ? '#f59e0b' : '#ef4444';
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
                  <div className="h-2 rounded-full transition-all" style={{ width: `${score}%`, backgroundColor: color }} />
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 text-xs text-gray-400 border-t border-gray-50 pt-3">
          Score updates daily. Complete more jobs, maintain SLA, and keep documents current to improve your tier.
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
