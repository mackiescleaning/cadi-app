/**
 * src/pages/WeeklyReport.jsx
 * Cadi — Weekly Cadi Report reading page
 *
 * Route: /reports/:id
 * Renders the weekly report in clean prose format.
 * Marks viewed_at on load (triggers first_weekly_report step completion).
 * Pro paywall tease: shows locked sections for free users.
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { markStepComplete } from '../lib/db/thirtyDayPlanDb';

const BG = 'min-h-screen bg-gradient-to-br from-[#050c1e] via-[#080f28] to-[#050c1e]';

function BoldText({ text }) {
  if (!text) return null;
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith('**') && part.endsWith('**')
          ? <strong key={i} className="text-white">{part.slice(2, -2)}</strong>
          : part
      )}
    </>
  );
}

function NumbersSection({ text }) {
  if (!text) return null;
  const lines = text.split('\n').filter(Boolean);

  if (lines.some(l => l.startsWith('-') || l.startsWith('•'))) {
    return (
      <ul className="space-y-2">
        {lines.map((line, i) => {
          const clean = line.replace(/^[-•]\s*/, '');
          return (
            <li key={i} className="flex items-baseline gap-2.5 text-sm text-white/60 leading-relaxed">
              <span className="shrink-0 text-[#4f78ff] mt-0.5">→</span>
              <BoldText text={clean} />
            </li>
          );
        })}
      </ul>
    );
  }

  return <p className="text-sm text-white/60 leading-relaxed"><BoldText text={text} /></p>;
}

export default function WeeklyReport() {
  const { id }     = useParams();
  const navigate   = useNavigate();
  const [report, setReport]           = useState(null);
  const [loading, setLoading]         = useState(true);
  const [notFound, setNotFound]       = useState(false);
  const [isPro, setIsPro]             = useState(false);
  const [reaction, setReaction]       = useState(null);
  const [note, setNote]               = useState('');
  const [noteSubmitted, setNoteSubmitted] = useState(false);
  const [reactionSaved, setReactionSaved] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate('/login'); return; }

      const [{ data: rep }, { data: profile }] = await Promise.all([
        supabase.from('weekly_reports').select('*').eq('id', id).single(),
        supabase.from('profiles').select('stripe_subscription_status').eq('id', session.user.id).single(),
      ]);

      if (!rep) { setNotFound(true); setLoading(false); return; }

      setReport(rep);
      setReaction(rep.user_reaction ?? null);
      setNote(rep.user_note ?? '');
      setIsPro(profile?.stripe_subscription_status === 'active');

      // Mark viewed
      if (!rep.viewed_at) {
        await supabase.from('weekly_reports')
          .update({ viewed_at: new Date().toISOString() })
          .eq('id', id);

        // Complete Phase 2 step
        try {
          await markStepComplete('first_weekly_report', 2, { report_id: id });
        } catch { /* non-fatal */ }
      }

      setLoading(false);
    })();
  }, [id, navigate]);

  async function saveReaction(r) {
    setReaction(r);
    await supabase.from('weekly_reports').update({ user_reaction: r }).eq('id', id);
    setReactionSaved(true);
    setTimeout(() => setReactionSaved(false), 3000);
  }

  async function saveNote() {
    if (!note.trim()) return;
    await supabase.from('weekly_reports').update({ user_note: note.trim() }).eq('id', id);
    setNoteSubmitted(true);
  }

  if (loading) {
    return (
      <div className={BG + ' flex items-center justify-center'}>
        <div className="text-center">
          <div className="w-10 h-10 rounded-full border-2 border-[#4f78ff]/20 border-t-[#4f78ff] animate-spin mx-auto mb-3" />
          <p className="text-white/40 text-sm">Loading your report…</p>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className={BG + ' flex items-center justify-center p-4'}>
        <div className="text-center max-w-sm">
          <p className="text-white/50 mb-4">Report not found.</p>
          <button onClick={() => navigate('/dashboard')} className="text-[#4f78ff] text-sm font-semibold hover:text-[#99c5ff]">
            ← Back to dashboard
          </button>
        </div>
      </div>
    );
  }

  const weekRange = report.week_starting
    ? `${new Date(report.week_starting).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${new Date(report.week_ending).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
    : '';

  return (
    <div className={BG}>
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#050c1e]/90 backdrop-blur border-b border-white/5 px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-2 text-white/40 hover:text-white/70 text-sm font-semibold transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Dashboard
        </button>
        <div className="text-right">
          <p className="text-[10px] font-bold tracking-widest uppercase text-[#4f78ff]">Weekly Report</p>
          {weekRange && <p className="text-[10px] text-white/30 mt-0.5">{weekRange}</p>}
        </div>
      </div>

      <div className="px-4 py-8 max-w-xl mx-auto space-y-8">

        {/* Headline */}
        <div>
          <p className="text-2xl font-black text-white leading-tight">{report.headline}</p>
        </div>

        {/* The numbers */}
        {report.numbers_section && (
          <section>
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/30 mb-3">This week, in numbers</p>
            <NumbersSection text={report.numbers_section} />
          </section>
        )}

        {/* Focus area */}
        {report.focus_section && (
          <section className="p-4 rounded-xl bg-[#4f78ff]/6 border border-[#4f78ff]/15">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#4f78ff]/70 mb-2">Your focus</p>
            <p className="text-sm text-white/60 leading-relaxed"><BoldText text={report.focus_section} /></p>
          </section>
        )}

        {/* What I noticed (Pro gate on free for detailed version) */}
        {report.notes_section ? (
          <section>
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/30 mb-2">Something I noticed</p>
            <p className="text-sm text-white/60 leading-relaxed"><BoldText text={report.notes_section} /></p>
          </section>
        ) : !isPro && (
          <section className="relative overflow-hidden p-4 rounded-xl bg-white/3 border border-white/8">
            <div className="blur-sm pointer-events-none select-none mb-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/20 mb-2">Something I noticed</p>
              <p className="text-sm text-white/30 leading-relaxed">You always invoice on Sundays. Want me to nudge you Sunday morning so it stays a habit? Your busiest day is consistently Thursday…</p>
            </div>
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-t from-[#050c1e]/70 via-transparent">
              <div className="text-center px-4">
                <p className="text-xs font-bold text-[#4f78ff] mb-1">🔒 Pro feature</p>
                <p className="text-xs text-white/40">Pattern spotting is available on Pro.</p>
              </div>
            </div>
          </section>
        )}

        {/* One thought for next week */}
        {report.suggestion_section && (
          <section className="border-t border-white/5 pt-6">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/30 mb-2">One thought for next week</p>
            <p className="text-sm text-white/60 leading-relaxed"><BoldText text={report.suggestion_section} /></p>
          </section>
        )}

        {/* Reaction */}
        <section className="border-t border-white/5 pt-6">
          <p className="text-sm font-bold text-white/50 mb-3">Was this helpful?</p>
          <div className="flex gap-3 mb-4">
            <button
              onClick={() => saveReaction('helpful')}
              className={`px-5 py-2 rounded-xl text-sm font-bold border transition-all ${
                reaction === 'helpful'
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                  : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'
              }`}
            >
              👍 Yes
            </button>
            <button
              onClick={() => saveReaction('not_relevant')}
              className={`px-5 py-2 rounded-xl text-sm font-bold border transition-all ${
                reaction === 'not_relevant'
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                  : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'
              }`}
            >
              👎 Not really
            </button>
          </div>

          {reactionSaved && (
            <p className="text-xs text-white/40 mb-3 italic">
              {reaction === 'helpful' ? 'Glad it landed. See you Monday.' : "Got it. I'll tune what I look for."}
            </p>
          )}

          {!noteSubmitted ? (
            <div>
              <p className="text-xs text-white/30 mb-2">Anything you want me to focus on next week?</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && saveNote()}
                  placeholder="Optional — just type here"
                  className="flex-1 px-3 py-2 rounded-xl bg-white/4 border border-white/8 text-white text-sm placeholder-white/20 focus:border-[#4f78ff]/40 focus:outline-none"
                />
                {note.trim() && (
                  <button
                    onClick={saveNote}
                    className="px-4 py-2 rounded-xl bg-[#4f78ff] text-white text-xs font-bold hover:bg-[#3d68ff] transition-colors"
                  >
                    Save
                  </button>
                )}
              </div>
            </div>
          ) : (
            <p className="text-xs text-white/40 italic">Got it. I'll keep that in mind.</p>
          )}
        </section>

        {/* Pro teases */}
        {!isPro && (
          <section className="p-4 rounded-xl bg-white/3 border border-white/6 space-y-2">
            <p className="text-xs font-bold text-white/30">Upgrade to Pro to unlock:</p>
            {[
              'Richer reports written by Sonnet (better insights)',
              'Email delivery every Monday morning',
              'Report PDF export',
              'Monthly comparisons — see your changes land',
            ].map(item => (
              <p key={item} className="text-xs text-white/25 flex items-center gap-2">
                <span className="text-[#4f78ff]/40">🔒</span> {item}
              </p>
            ))}
          </section>
        )}

        {/* Back to dashboard */}
        <div className="pb-6">
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full py-3.5 rounded-xl bg-white/5 hover:bg-white/8 border border-white/8 text-white/60 font-semibold text-sm transition-colors"
          >
            Back to dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
