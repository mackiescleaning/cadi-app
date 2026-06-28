// /onboarding/customers — guided customer migration, rendered INSIDE the
// main AppLayout (sidebar + header visible). Resumable from
// onboarding_sessions.step. Light theme to match the rest of Cadi.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ensureSession } from '../../lib/db/onboardingDb';
import ProgressBar from './ProgressBar';
import StepDivisions from './StepDivisions';
import StepUpload from './StepUpload';
import StepReview from './StepReview';
import StepMenu from './StepMenu';
import StepReveal from './StepReveal';

export default function OnboardingMigration() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user || user.id === 'demo-user') {
      navigate('/login');
      return;
    }
    ensureSession()
      .then(s => { setSession(s); setLoading(false); })
      .catch(e => { setError(e?.message ?? "Couldn't start onboarding"); setLoading(false); });
  }, [authLoading, user, navigate]);

  const onAdvance = (updated) => setSession(updated);

  if (loading || authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="w-8 h-8 rounded-full border-2 border-[#1f48ff] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] p-6">
        <div className="text-center max-w-sm rounded-2xl bg-white border border-[#1f48ff]/15 shadow-sm p-6">
          <p className="text-base font-black text-[#010a4f] mb-2">Couldn't start onboarding.</p>
          <p className="text-sm text-[#010a4f]/60 mb-4">{error || 'Try refreshing.'}</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-5 py-2.5 rounded-xl bg-[#1f48ff] hover:bg-[#3a5eff] text-white text-sm font-black shadow"
          >
            Back to dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="-mx-4 md:-mx-8 -my-6">
      {/* Eyebrow + progress bar — sticks below the AppLayout header so the
          step state is always visible. We negate the main padding above so
          the bar can span edge-to-edge under the app chrome. */}
      <div className="sticky top-0 z-30 bg-white/85 backdrop-blur-md border-b border-[#1f48ff]/10">
        <div className="flex items-center justify-between px-4 md:px-8 py-2.5">
          <div className="flex items-baseline gap-2">
            <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-[#1f48ff]">Cadi</p>
            <span className="text-[#010a4f]/20">·</span>
            <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-[#010a4f]">Onboarding</p>
          </div>
          <button
            onClick={() => navigate('/dashboard')}
            className="text-[11px] font-bold text-[#010a4f]/55 hover:text-[#010a4f] transition-colors px-2 py-1 rounded-lg hover:bg-[#f0f4ff]"
            title="Exit — your progress is saved"
          >
            Exit ✕
          </button>
        </div>
        <ProgressBar step={session.step} />
      </div>

      <div className="px-4 md:px-8 py-6">
        {session.step === 'divisions' && (
          <StepDivisions session={session} onAdvance={onAdvance} />
        )}
        {(session.step === 'upload' || session.step === 'parsing') && (
          <StepUpload session={session} onAdvance={onAdvance} />
        )}
        {session.step === 'review' && <StepReview session={session} onAdvance={onAdvance} />}
        {session.step === 'menu_review' && <StepMenu session={session} onAdvance={onAdvance} />}
        {/* `schedule_review` is a legacy step value — render Reveal so any
            in-flight sessions still resolve, but it's no longer in the
            progress bar (the wizard jumps menu_review → reveal). */}
        {(session.step === 'schedule_review' || session.step === 'reveal') && <StepReveal session={session} onAdvance={onAdvance} />}
        {session.step === 'complete' && <CompletedState session={session} onAdvance={onAdvance} />}
      </div>
    </div>
  );
}

function CompletedState({ session, onAdvance }) {
  const navigate = useNavigate();
  return (
    <div className="flex items-center justify-center min-h-[50vh] p-6 text-center">
      <div className="max-w-md w-full rounded-2xl bg-white border border-[#1f48ff]/15 shadow-sm p-8">
        <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center bg-emerald-50 border border-emerald-200 text-emerald-600 text-3xl">
          ✓
        </div>
        <h1 className="text-xl font-black text-[#010a4f] mb-2">Onboarding complete.</h1>
        <p className="text-sm text-[#010a4f]/65 mb-6">
          Your customers, services and recurring revenue are all live. You can re-open the flow any time to make changes.
        </p>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => navigate('/scheduler')}
            className="px-5 py-2.5 rounded-xl bg-[#1f48ff] hover:bg-[#3a5eff] text-white text-sm font-black shadow"
          >
            Take me to my week
          </button>
          <button
            onClick={async () => {
              const { updateStep } = await import('../../lib/db/onboardingDb');
              await updateStep(session.id, 'reveal');
              onAdvance({ ...session, step: 'reveal' });
            }}
            className="px-5 py-2 text-xs font-semibold text-[#1f48ff] hover:text-[#010a4f] transition-colors"
          >
            Re-open onboarding to make changes
          </button>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-5 py-2 text-xs font-semibold text-[#010a4f]/50 hover:text-[#010a4f] transition-colors"
          >
            Back to dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
