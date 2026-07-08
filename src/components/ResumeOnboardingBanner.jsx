// Resume-onboarding nudge.
// The customer-migration wizard hands off to the service-menu builder
// (onboarding_sessions.step = 'menu_review') and then a reveal step. If a
// user drops out mid-flow there's otherwise no obvious way back — the setup
// checklist has already ticked "customers" done. This surfaces a one-tap
// route back into /onboarding/customers, which resumes at the saved step.
//
// Self-contained: loads the active session + a services count itself, and
// only shows while the catalogue is still empty (the genuinely-stuck case),
// so a populated menu from an older abandoned session doesn't keep nagging.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadActiveSession } from '../lib/db/onboardingDb';
import { supabase } from '../lib/supabase';

function resumeCopy(step) {
  if (step === 'menu_review')
    return {
      title: 'Finish building your service menu',
      body: "Your customers are in and Cadi drafted a menu from them — review the prices and lock it in, and it'll fill your Services tab.",
    };
  if (step === 'schedule_review' || step === 'reveal')
    return {
      title: 'One step left to finish setup',
      body: 'Wrap up your onboarding to go live.',
    };
  return {
    title: 'Pick up your setup where you left off',
    body: "You've got a Cadi onboarding in progress.",
  };
}

export default function ResumeOnboardingBanner({ className = '' }) {
  const navigate = useNavigate();
  const [session, setSession] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const s = await loadActiveSession();
        if (!alive || !s || s.step === 'complete') return;
        // Only nag while the catalogue is still empty — that's the stuck case.
        const { count } = await supabase
          .from('services')
          .select('id', { count: 'exact', head: true });
        if (!alive) return;
        if ((count ?? 0) === 0) setSession(s);
      } catch {
        /* no session / not signed in / demo — silently skip */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (!session) return null;
  const copy = resumeCopy(session.step);

  return (
    <div className={`px-4 sm:px-6 pt-4 ${className}`}>
      <div className="rounded-2xl border border-[#4f78ff]/30 bg-[#4f78ff]/10 p-4 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-[#4f78ff]/20 border border-[#4f78ff]/30 flex items-center justify-center shrink-0 text-lg">
          ↩️
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-white">{copy.title}</p>
          <p className="text-xs text-[rgba(153,197,255,0.65)] leading-snug mt-0.5">{copy.body}</p>
        </div>
        <button
          onClick={() => navigate('/onboarding/customers')}
          className="shrink-0 px-3.5 py-2 rounded-xl bg-[#4f78ff] hover:bg-[#3d68ff] text-white text-xs font-black transition-colors"
        >
          Pick up where you left off →
        </button>
      </div>
    </div>
  );
}
