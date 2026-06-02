/**
 * SiteSurvey.jsx
 * Commercial Site Survey → Quote/Plan → Onboarding Pack
 * Route: /survey/:surveyId
 *
 * State machine: capturing → structured → quoted → accepted
 * Tier gate: subscription_tier='max' required.
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import {
  getSurvey, getSurveyStructured, getPackForCustomer,
  getSurveyDefaults, saveSurveyDefaults,
} from '../lib/db/surveyDb';
import SurveyIntroModal from '../components/survey/SurveyIntroModal';
import SurveyCapture    from '../components/survey/SurveyCapture';
import SurveyStructure  from '../components/survey/SurveyStructure';
import SurveyQuote      from '../components/survey/SurveyQuote';
import OnboardingPack   from '../components/survey/OnboardingPack';

const STATUS_STEPS = ['capturing', 'structured', 'quoted', 'accepted'];

function StepIndicator({ status }) {
  const idx = STATUS_STEPS.indexOf(status);
  const labels = ['Capture', 'Structure', 'Quote', 'Pack'];
  return (
    <div className="flex items-center gap-0">
      {labels.map((label, i) => (
        <div key={label} className="flex items-center">
          <div className={`flex flex-col items-center ${i < labels.length - 1 ? 'mr-0' : ''}`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
              i < idx  ? 'bg-emerald-500 border-emerald-500 text-white' :
              i === idx ? 'bg-[#1f48ff] border-[#1f48ff] text-white' :
                          'bg-transparent border-[rgba(153,197,255,0.2)] text-[rgba(153,197,255,0.3)]'
            }`}>
              {i < idx ? '✓' : i + 1}
            </div>
            <span className={`text-[9px] font-bold tracking-wide mt-1 ${
              i === idx ? 'text-[#99c5ff]' : i < idx ? 'text-emerald-400' : 'text-[rgba(153,197,255,0.3)]'
            }`}>{label}</span>
          </div>
          {i < labels.length - 1 && (
            <div className={`w-8 h-px mx-1 mb-3 ${i < idx ? 'bg-emerald-500' : 'bg-[rgba(153,197,255,0.12)]'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

export default function SiteSurvey() {
  const { surveyId } = useParams();
  const navigate     = useNavigate();
  const { user, profile } = useAuth();

  const [survey, setSurvey]           = useState(null);
  const [structured, setStructured]   = useState(null);
  const [quote, setQuote]             = useState(null);
  const [pack, setPack]               = useState(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);

  // Intro / primer
  const [showIntro, setShowIntro]     = useState(false);
  const [defaults, setDefaults]       = useState(null);

  // Check tier
  const tier = profile?.subscription_tier ?? 'lite';
  const isMax = tier === 'max';

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [svRow, defs] = await Promise.all([
        getSurvey(surveyId),
        getSurveyDefaults(),
      ]);
      setSurvey(svRow);
      setDefaults(defs);

      // Check first-run intro flag
      const { data: prof } = await supabase
        .from('profiles')
        .select('quick_wins_done')
        .eq('id', user?.id)
        .maybeSingle();
      const done = prof?.quick_wins_done ?? [];
      if (!done.includes('survey_intro_seen')) {
        setShowIntro(true);
      }

      // Load structured if exists
      if (['structured', 'quoted', 'accepted'].includes(svRow.status)) {
        const str = await getSurveyStructured(surveyId);
        setStructured(str);
      }

      // Load quote if quoted/accepted
      if (['quoted', 'accepted'].includes(svRow.status)) {
        const { data: qRow } = await supabase
          .from('quotes')
          .select('*')
          .eq('survey_id', surveyId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        setQuote(qRow);
      }

      // Load pack if accepted
      if (svRow.status === 'accepted') {
        const packRow = await getPackForCustomer(svRow.customer_id);
        setPack(packRow);
      }
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [surveyId, user?.id]);

  useEffect(() => { load(); }, [load]);

  const handleIntroComplete = async (primerDefaults) => {
    setShowIntro(false);
    // Save defaults to business_settings
    try {
      await saveSurveyDefaults(primerDefaults);
      setDefaults(primerDefaults);
    } catch { /* non-fatal */ }
    // Mark intro seen on profile
    try {
      const current = await supabase.from('profiles').select('quick_wins_done').eq('id', user?.id).maybeSingle();
      const done = current.data?.quick_wins_done ?? [];
      if (!done.includes('survey_intro_seen')) {
        await supabase.from('profiles').update({ quick_wins_done: [...done, 'survey_intro_seen'] }).eq('id', user?.id);
      }
    } catch { /* non-fatal */ }
  };

  const handleStructureDone = async () => {
    // Reload structured data after edge function has written it
    const [updatedSurvey, str] = await Promise.all([
      getSurvey(surveyId),
      getSurveyStructured(surveyId),
    ]);
    setSurvey(updatedSurvey);
    setStructured(str);
  };

  const handleQuoteCreated = ({ quote: q, structured: str }) => {
    setQuote(q);
    setStructured(str);
    setSurvey(prev => ({ ...prev, status: 'quoted' }));
  };

  const handleQuoteAccepted = async () => {
    setSurvey(prev => ({ ...prev, status: 'accepted' }));
    // Pack will be created in OnboardingPack on first assemble click
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#010a4f]">
        <div className="flex items-center gap-3 px-5 py-3 rounded-xl bg-white/5 border border-[rgba(153,197,255,0.12)]">
          <div className="w-4 h-4 border-2 border-[#1f48ff] border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-[rgba(153,197,255,0.6)]">Loading survey…</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#010a4f] p-4">
        <div className="text-center">
          <p className="text-red-400 font-bold mb-2">Failed to load survey</p>
          <p className="text-xs text-[rgba(153,197,255,0.5)] mb-4">{error}</p>
          <button onClick={() => navigate('/customers')} className="text-sm text-[#99c5ff] underline">← Back to customers</button>
        </div>
      </div>
    );
  }

  if (!isMax) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#010a4f] p-4">
        <div
          className="w-full max-w-sm rounded-2xl p-6 border border-[rgba(153,197,255,0.12)] text-center"
          style={{ background: 'linear-gradient(160deg, #0d1e78 0%, #05124a 100%)' }}
        >
          <p className="text-3xl mb-3">🏗</p>
          <p className="text-white font-bold mb-2">Commercial surveys — Max plan</p>
          <p className="text-xs text-[rgba(153,197,255,0.6)] mb-4">
            Commercial site surveys, onboarding packs, and compliance documents are part of the Max (£79/mo) plan.
          </p>
          <button
            onClick={() => navigate('/upgrade')}
            className="w-full h-10 rounded-xl bg-[#1f48ff] text-white font-bold text-sm"
          >
            Upgrade to Max
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#010a4f]">
      {showIntro && (
        <SurveyIntroModal onComplete={handleIntroComplete} existingDefaults={defaults} />
      )}

      {/* Header */}
      <div
        className="relative sticky top-0 z-10 px-4 py-3 border-b border-[rgba(153,197,255,0.08)]"
        style={{ background: 'linear-gradient(135deg, #0d1e78 0%, #05124a 100%)' }}
      >
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#99c5ff]/40 to-transparent" />
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => navigate('/customers')}
            className="flex items-center gap-1.5 text-xs text-[rgba(153,197,255,0.5)] hover:text-[#99c5ff] transition-colors"
          >
            ← Customers
          </button>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-[rgba(31,72,255,0.2)] border border-[rgba(31,72,255,0.3)] text-[#99c5ff] uppercase tracking-widest">
              Commercial
            </span>
            {survey?.status === 'archived' && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-white/10 border border-white/15 text-[rgba(153,197,255,0.4)] uppercase tracking-widest">
                Archived
              </span>
            )}
          </div>
        </div>
        <StepIndicator status={survey?.status ?? 'capturing'} />
      </div>

      {/* Body */}
      <div className="max-w-xl mx-auto px-4 py-6">

        {/* Phase 1 — Capture */}
        {survey?.status === 'capturing' && (
          <SurveyCapture
            survey={survey}
            onNotesChange={() => {}} // auto-saves inside component
            onPhotoAdded={() => {}}
            onDone={handleStructureDone}
          />
        )}

        {/* Phase 2 — Structure */}
        {survey?.status === 'structured' && (
          <SurveyStructure
            survey={survey}
            structured={structured}
            onConfirm={handleQuoteCreated}
            onBack={() => setSurvey(prev => ({ ...prev, status: 'capturing' }))}
          />
        )}

        {/* Phase 3 — Quote (+ pack if accepted) */}
        {['quoted', 'accepted'].includes(survey?.status) && (
          <div className="flex flex-col gap-6">
            <SurveyQuote
              survey={survey}
              quote={quote}
              onAccept={handleQuoteAccepted}
              onDecline={() => setSurvey(prev => ({ ...prev, status: 'archived' }))}
            />

            {survey?.status === 'accepted' && (
              <OnboardingPack
                survey={survey}
                quote={quote}
                pack={pack}
                onPackCreated={p => setPack(p)}
                onSigned={p => setPack(p)}
              />
            )}
          </div>
        )}

        {/* Archived */}
        {survey?.status === 'archived' && (
          <div className="text-center py-12">
            <p className="text-3xl mb-3">📂</p>
            <p className="text-white font-bold mb-2">Survey archived</p>
            <p className="text-xs text-[rgba(153,197,255,0.5)] mb-4">
              {survey?.customers?.name ?? 'Customer'} — this survey has been closed.
            </p>
            <button onClick={() => navigate('/customers')} className="text-sm text-[#99c5ff] underline">
              ← Back to customers
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
