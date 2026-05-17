// src/pages/front-desk/ReviewAgentPage.jsx
// Review Agent profile page — /front-desk/review-agent

import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Star, Settings, ArrowRight } from 'lucide-react';
import ReviewsSettings from '../../components/ReviewsSettings';
import { supabase } from '../../lib/supabase';
import { useBusinessId } from '../../hooks/useBusinessId';
import { useAuth } from '../../context/AuthContext';
import { usePlan } from '../../hooks/usePlan';

export default function ReviewAgentPage() {
  const businessId = useBusinessId();
  const { user } = useAuth();
  const { isPro, reviewsMonthlyLimit } = usePlan();
  const [searchParams, setSearchParams] = useSearchParams();
  const fromPhase3 = searchParams.get('from') === 'phase3';
  const [introDismissed, setIntroDismissed] = useState(false);
  const [stats, setStats] = useState({ requestsSent: null, reviewsReceived: null, avgRating: null, sentThisMonth: null });

  useEffect(() => {
    if (!businessId || !user) return;
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
    const monthStartIso = monthStart.toISOString();
    (async () => {
      try {
        const [{ count: sent }, { data: received }, { count: sentThisMonth }] = await Promise.all([
          supabase.from('agent_actions')
            .select('*', { count: 'exact', head: true })
            .eq('business_id', businessId)
            .in('agent', ['reviews', 'review_agent'])
            .eq('action_type', 'send_review_request')
            .neq('status', 'pending_approval'),
          supabase.from('reviews')
            .select('rating')
            .eq('business_id', businessId)
            .not('rating', 'is', null),
          supabase.from('agent_actions')
            .select('*', { count: 'exact', head: true })
            .eq('business_id', businessId)
            .in('agent', ['reviews', 'review_agent'])
            .eq('action_type', 'send_review_request')
            .neq('status', 'pending_approval')
            .gte('created_at', monthStartIso),
        ]);

        const ratings = received ?? [];
        const avg = ratings.length > 0
          ? (ratings.reduce((s, r) => s + (r.rating ?? 0), 0) / ratings.length).toFixed(1)
          : null;

        setStats({
          requestsSent:    sent ?? 0,
          reviewsReceived: ratings.length,
          avgRating:       avg,
          sentThisMonth:   sentThisMonth ?? 0,
        });
      } catch (e) {
        console.error('ReviewAgent load error:', e);
      }
    })();
  }, [businessId, user]);

  function dismissIntro() {
    setIntroDismissed(true);
    setSearchParams({});
  }

  return (
    <div className="space-y-6 max-w-3xl">

      {/* Phase 3 intro framing */}
      {fromPhase3 && !introDismissed && (
        <div
          className="rounded-2xl overflow-hidden border border-emerald-500/30 p-6"
          style={{ background: 'linear-gradient(135deg, #064e3b 0%, #065f46 100%)' }}
        >
          <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-emerald-300/50 mb-2">Phase 3 · Step 2</p>
          <h2 className="text-xl font-black text-white mb-3 leading-snug">Meet your Review Agent.</h2>
          <p className="text-sm text-white/60 leading-relaxed mb-3">
            Now the agent who builds your reputation.
          </p>
          <p className="text-sm text-white/60 leading-relaxed mb-3">
            Every time a job's completed, your Review Agent sends a polite request asking the customer for a review. You'd never get round to asking — they will. Every time. On cue.
          </p>
          <p className="text-sm text-white/60 leading-relaxed mb-5">
            Over weeks and months this is how a cleaning business gets known. Reviews stack up. Front Desk enquiries convert better because there's proof.
          </p>
          <p className="text-sm font-bold text-white mb-5">Let's hire them.</p>
          <button
            onClick={dismissIntro}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition-colors"
          >
            Set up Review Agent <ArrowRight size={14} />
          </button>
        </div>
      )}

      {/* Agent header */}
      <div className="bg-white rounded-2xl border border-[#99c5ff]/20 overflow-hidden">
        <div className="px-6 py-5" style={{ background: 'linear-gradient(135deg, #064e3b 0%, #059669 100%)' }}>
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
              <Star size={22} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-emerald-200/70 mb-1">Front Desk · Agent</p>
              <h1 className="text-xl font-black text-white">Review Agent</h1>
              <p className="text-sm text-white/60 mt-1">
                Builds your reputation — sends review requests after every completed job, automatically.
              </p>
            </div>
          </div>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-3 divide-x divide-[#f0f4ff] border-t border-[#99c5ff]/20">
          <div className="px-5 py-4 text-center">
            <p className="text-2xl font-black text-[#010a4f]">{stats.requestsSent ?? '—'}</p>
            <p className="text-[10px] font-semibold text-gray-400 mt-0.5 uppercase tracking-wide">Requests sent</p>
          </div>
          <div className="px-5 py-4 text-center">
            <p className="text-2xl font-black text-[#010a4f]">{stats.reviewsReceived ?? '—'}</p>
            <p className="text-[10px] font-semibold text-gray-400 mt-0.5 uppercase tracking-wide">Reviews received</p>
          </div>
          <div className="px-5 py-4 text-center">
            <div className="flex items-center justify-center gap-1">
              {stats.avgRating ? (
                <>
                  <Star size={14} className="text-amber-400 fill-amber-400" />
                  <p className="text-2xl font-black text-[#010a4f]">{stats.avgRating}</p>
                </>
              ) : (
                <p className="text-2xl font-black text-gray-300">—</p>
              )}
            </div>
            <p className="text-[10px] font-semibold text-gray-400 mt-0.5 uppercase tracking-wide">Avg rating</p>
          </div>
        </div>

        {/* Monthly usage — lite only */}
        {!isPro && stats.sentThisMonth !== null && (
          <div className={`px-5 py-3 border-t border-[#99c5ff]/20 flex items-center justify-between gap-3 ${stats.sentThisMonth >= reviewsMonthlyLimit ? 'bg-amber-50' : ''}`}>
            <div>
              <p className="text-xs font-black text-[#010a4f]">
                {stats.sentThisMonth} of {reviewsMonthlyLimit} review requests used this month
              </p>
              {stats.sentThisMonth >= reviewsMonthlyLimit && (
                <p className="text-[10px] text-amber-600 mt-0.5">Monthly limit reached — upgrade to Pro for unlimited requests.</p>
              )}
            </div>
            <div className="h-1.5 flex-1 max-w-[120px] bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${stats.sentThisMonth >= reviewsMonthlyLimit ? 'bg-amber-400' : 'bg-emerald-400'}`}
                style={{ width: `${Math.min((stats.sentThisMonth / reviewsMonthlyLimit) * 100, 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Settings */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Settings size={14} className="text-gray-400" />
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Settings</p>
        </div>
        <ReviewsSettings />
      </div>

    </div>
  );
}
