// SetupWizard.jsx
// In-app guided setup — replaces the pre-login onboarding flow.
//
// Each step navigates the user to the relevant tab and detects
// completion automatically where possible, or lets them tick it manually.
//
// Steps sync to the actual app tabs — answers written by the user inside
// each tab are detected on return, and the step checks itself off.

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

// ─── Step definitions ──────────────────────────────────────────────────────────
const STEPS = [
  {
    id: 'sectors',
    emoji: '🧹',
    title: 'Choose your cleaning sectors',
    mission: 'Tell Cadi what you do — residential, commercial or exterior — and the entire app reorders itself around your work.',
    tab: 'settings',
    tabLabel: 'Open Settings',
    hint: 'Head to Settings → Profile → Cleaning Sector',
    detect: (profile) => !!profile?.cleaner_type,
    autoDetect: true,
  },
  {
    id: 'pricing',
    emoji: '💷',
    title: 'Set your pricing foundations',
    mission: 'Add your hourly rate and minimum job price. These flow automatically into every quote, invoice and job card across Cadi.',
    tab: 'calculator',
    tabLabel: 'Open Pricing',
    hint: 'Set your base hourly rate in the Pricing calculator',
    detect: (profile, sd) => !!sd?.hourly_rate,
    autoDetect: true,
  },
  {
    id: 'services',
    emoji: '✅',
    title: 'Build your service menu',
    mission: "Pick every service you offer. They'll appear as options on job cards, customer profiles and invoices — no more typing from scratch.",
    tab: 'calculator',
    tabLabel: 'Open Pricing',
    hint: 'Select your services in the Pricing tab service list',
    detect: (profile, sd) => Array.isArray(sd?.services) && sd.services.length > 0,
    autoDetect: true,
  },
  {
    id: 'customers',
    emoji: '👥',
    title: 'Add your first customers',
    mission: 'Log your existing clients — names, addresses, notes and a star rating. This is the foundation of everything: scheduling, invoicing, routes.',
    tab: 'customers',
    tabLabel: 'Open Customers',
    hint: 'Add at least one customer to get started',
    detect: null,
    autoDetect: false,
  },
  {
    id: 'schedule',
    emoji: '📅',
    title: 'Fill in your first week',
    mission: 'Drop your current jobs onto the scheduler. See your week take shape — and let the dashboard start showing real numbers.',
    tab: 'scheduler',
    tabLabel: 'Open Scheduler',
    hint: 'Add your jobs for the week in the Scheduler',
    detect: null,
    autoDetect: false,
  },
  {
    id: 'kit',
    emoji: '🧴',
    title: 'Build your cleaning kit',
    mission: 'Log your products, quantities and restock dates. Cadi tracks what you use so you never run out mid-job.',
    tab: 'inventory',
    tabLabel: 'Open Inventory',
    hint: 'Add your cleaning products in Inventory',
    detect: null,
    autoDetect: false,
  },
  {
    id: 'goals',
    emoji: '🎯',
    title: 'Set your first business goal',
    mission: "Create a 90-day sprint with a revenue target. Cadi will track every job against it and tell you exactly how many bookings stand between you and your goal.",
    tab: 'review',
    tabLabel: 'Open Sprint Planner',
    hint: 'Create a 90-day sprint in the Annual Review tab',
    detect: (profile, sd) => !!sd?.target_revenue,
    autoDetect: true,
  },
];

const TOTAL = STEPS.length;

// ─── Component ─────────────────────────────────────────────────────────────────
export default function SetupWizard({ onAllDone }) {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [setupData,   setSetupData]   = useState(null);
  const [completed,   setCompleted]   = useState([]); // step ids
  const [collapsed,   setCollapsed]   = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const [dismissed,   setDismissed]   = useState(false);
  const [activeStep,  setActiveStep]  = useState(null);

  // ── Load setup_data + saved wizard progress from Supabase ──────────────────
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('business_settings')
        .select('setup_data')
        .eq('owner_id', user.id)
        .single();

      const sd = data?.setup_data ?? {};
      setSetupData(sd);

      // Load previously ticked steps
      const saved = sd?.wizard_completed_steps ?? [];
      setCompleted(saved);
    })();
  }, [user]);

  // ── Auto-detect completed steps whenever profile or setupData changes ──────
  useEffect(() => {
    if (!profile || setupData === null) return;

    setCompleted(prev => {
      const next = new Set(prev);
      STEPS.forEach(step => {
        if (step.autoDetect && step.detect && step.detect(profile, setupData)) {
          next.add(step.id);
        }
      });
      return [...next];
    });
  }, [profile, setupData]);

  // ── Persist completed steps ────────────────────────────────────────────────
  const saveCompleted = useCallback(async (ids) => {
    if (!user) return;
    const { data } = await supabase
      .from('business_settings')
      .select('setup_data')
      .eq('owner_id', user.id)
      .single();
    const existing = data?.setup_data ?? {};
    await supabase
      .from('business_settings')
      .update({ setup_data: { ...existing, wizard_completed_steps: ids } })
      .eq('owner_id', user.id);
  }, [user]);

  const tick = (id) => {
    setCompleted(prev => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      saveCompleted(next);
      if (next.length === TOTAL) {
        setCelebrating(true);
        setTimeout(() => { setCelebrating(false); onAllDone?.(); }, 3000);
      }
      return next;
    });
    setActiveStep(null);
  };

  const untick = (id) => {
    setCompleted(prev => {
      const next = prev.filter(x => x !== id);
      saveCompleted(next);
      return next;
    });
  };

  const goToTab = (step) => {
    setActiveStep(step.id);
    navigate(`/${step.tab}`);
  };

  if (dismissed) return null;

  const doneCount   = completed.length;
  const pct         = Math.round((doneCount / TOTAL) * 100);
  const allDone     = doneCount === TOTAL;
  const currentStep = STEPS.find(s => !completed.includes(s.id));

  // ── Celebration state ──────────────────────────────────────────────────────
  if (celebrating) {
    return (
      <div className="rounded-2xl overflow-hidden border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 p-6 text-center">
        <div className="text-4xl mb-3 animate-bounce">🎉</div>
        <h3 className="text-lg font-black text-emerald-800 mb-1">Setup complete!</h3>
        <p className="text-sm text-emerald-600">Your business is now fully configured in Cadi. Time to grow.</p>
      </div>
    );
  }

  // ── All done — compact badge ───────────────────────────────────────────────
  if (allDone) {
    return (
      <div className="rounded-2xl overflow-hidden border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center text-white text-lg">✓</div>
          <div>
            <p className="text-sm font-black text-emerald-800">Cadi setup complete!</p>
            <p className="text-xs text-emerald-600">Your business is fully configured — your health score is now live</p>
          </div>
        </div>
        <button onClick={() => setDismissed(true)} className="text-xs text-emerald-500 hover:text-emerald-700 font-semibold">Dismiss</button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl overflow-hidden border border-[#99c5ff]/30 bg-white shadow-sm">

      {/* ── Header ── */}
      <div
        className="px-5 py-4 bg-gradient-to-r from-[#010a4f] to-[#0d1e78] flex items-center justify-between cursor-pointer select-none"
        onClick={() => setCollapsed(v => !v)}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center">
            <span className="text-base">🗺️</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-black text-white">Setup Guide</p>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-blue/40 text-brand-skyblue border border-brand-blue/30">
                {doneCount}/{TOTAL} complete
              </span>
            </div>
            <p className="text-xs text-brand-skyblue/60 mt-0.5">
              {collapsed
                ? currentStep ? `Next: ${currentStep.title}` : 'All done!'
                : "Complete each mission to unlock your full business dashboard"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Progress ring */}
          <div className="relative w-9 h-9 shrink-0">
            <svg width="36" height="36" viewBox="0 0 36 36" className="-rotate-90">
              <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(153,197,255,0.15)" strokeWidth="3.5" />
              <circle
                cx="18" cy="18" r="14" fill="none"
                stroke="#10b981" strokeWidth="3.5" strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 14}
                strokeDashoffset={2 * Math.PI * 14 * (1 - pct / 100)}
                style={{ transition: 'stroke-dashoffset 0.5s ease' }}
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[9px] font-black text-white">{pct}%</span>
          </div>
          <span className="text-white/40 text-sm">{collapsed ? '▼' : '▲'}</span>
        </div>
      </div>

      {/* ── Progress bar ── */}
      <div className="h-1 bg-gray-100">
        <div
          className="h-full bg-gradient-to-r from-brand-blue to-emerald-400 transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* ── Steps list ── */}
      {!collapsed && (
        <div className="divide-y divide-gray-50">
          {STEPS.map((step, idx) => {
            const done    = completed.includes(step.id);
            const isCurrent = !done && STEPS.findIndex(s => !completed.includes(s.id)) === idx;
            const isActive  = activeStep === step.id;

            return (
              <div
                key={step.id}
                className={`transition-colors ${
                  done        ? 'bg-emerald-50/30'
                  : isCurrent ? 'bg-brand-blue/[0.03]'
                  : ''
                }`}
              >
                <div className="flex items-start gap-3 px-5 py-3.5">
                  {/* Tick button */}
                  <button
                    onClick={() => done ? untick(step.id) : tick(step.id)}
                    className={`mt-0.5 shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                      done
                        ? 'bg-emerald-500 border-emerald-500 text-white'
                        : isCurrent
                        ? 'border-brand-blue hover:bg-brand-blue/10'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    {done && <span className="text-[10px] font-black">✓</span>}
                  </button>

                  {/* Step content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-sm font-bold leading-tight ${done ? 'line-through text-gray-400' : isCurrent ? 'text-brand-navy' : 'text-gray-600'}`}>
                        {step.emoji} {step.title}
                      </span>
                      {isCurrent && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-blue text-white">NOW</span>
                      )}
                    </div>

                    {/* Expand current step */}
                    {isCurrent && (
                      <div className="mt-2 space-y-2">
                        <p className="text-xs text-gray-500 leading-relaxed">{step.mission}</p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            onClick={() => goToTab(step)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-navy text-white text-xs font-bold rounded-lg hover:bg-brand-blue transition-colors"
                          >
                            {step.tabLabel} →
                          </button>
                          {!step.autoDetect && (
                            <button
                              onClick={() => tick(step.id)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-emerald-300 text-emerald-700 bg-emerald-50 text-xs font-bold rounded-lg hover:bg-emerald-100 transition-colors"
                            >
                              ✓ Mark as done
                            </button>
                          )}
                        </div>
                        <p className="text-[10px] text-gray-400 flex items-center gap-1">
                          <span>💡</span> {step.hint}
                        </p>
                      </div>
                    )}

                    {/* Show mission for collapsed non-current steps on hover */}
                    {!isCurrent && !done && (
                      <p className="text-xs text-gray-400 mt-0.5 leading-snug line-clamp-1">{step.mission}</p>
                    )}
                  </div>

                  {/* Go button for non-current incomplete steps */}
                  {!done && !isCurrent && (
                    <button
                      onClick={() => goToTab(step)}
                      className="shrink-0 text-xs font-bold text-gray-400 hover:text-brand-blue transition-colors"
                    >
                      Go →
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Footer ── */}
      {!collapsed && (
        <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
          <p className="text-xs text-gray-400">
            {TOTAL - doneCount} step{TOTAL - doneCount !== 1 ? 's' : ''} remaining · your dashboard unlocks fully when complete
          </p>
          <button
            onClick={() => setDismissed(true)}
            className="text-xs text-gray-400 hover:text-gray-600 font-semibold transition-colors"
          >
            Hide guide
          </button>
        </div>
      )}
    </div>
  );
}
