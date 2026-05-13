// ThirtyDayPlan.jsx — Persistent 30 Day Plan panel on the dashboard
// Shows Phase 1 step progress. Celebrates completion. Collapses to badge after all 4 phases done.

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Lock, ChevronDown, ChevronUp, Sparkles, ArrowRight } from 'lucide-react';
import { getPhase1State, syncPhase1Steps, checkAndCompletePhase1, getPhase1Stats } from '../lib/db/thirtyDayPlanDb';
import { countActiveServices } from '../lib/db/servicesDb';
import { supabase } from '../lib/supabase';

// ── Step definitions ──────────────────────────────────────────────────────────

const PHASE1_STEPS = [
  {
    key: 'services_menu',
    title: 'Set up your services menu',
    incompleteSub: 'Tell Cadi what you sell so it can quote, schedule, and bill correctly.',
    completeSub: () => 'Services menu live.',
    cta: 'Open services menu',
    path: '/services',
  },
  {
    key: 'add_customers',
    title: 'Add your customers',
    incompleteSub: 'Bring your customer list into Cadi. Upload a CSV or add them one at a time.',
    completeSub: () => 'Customers in Cadi.',
    cta: 'Add customers',
    path: '/customers',
  },
  {
    key: 'first_job',
    title: 'Schedule your first job',
    incompleteSub: 'Put your first job in the schedule. Cadi takes it from here.',
    completeSub: (meta) => meta?.customer_name ? `First job scheduled — ${meta.customer_name}.` : 'First job scheduled.',
    cta: 'Open schedule',
    path: '/scheduler',
  },
  {
    key: 'activate_front_desk',
    title: 'Activate Front Desk',
    incompleteSub: 'Switch on the AI that handles your enquiries, quotes, and bookings — optional but powerful.',
    completeSub: () => 'Front Desk is live and answering enquiries.',
    cta: 'Activate Front Desk',
    path: '/settings',
    optional: true,
  },
];

const SUBHEADS = [
  "Let's get your business set up. This takes about 20 minutes.",
  "Good start. Two more to go.",
  "One step away from Phase 1 complete.",
  "", // handled by celebration
];

// ── Step status indicator ─────────────────────────────────────────────────────

function StepDot({ status }) {
  if (status === 'completed') {
    return (
      <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
        <Check size={12} className="text-white" strokeWidth={3} />
      </div>
    );
  }
  if (status === 'in_progress') {
    return (
      <div className="w-6 h-6 rounded-full border-2 border-[#4f78ff] flex items-center justify-center shrink-0">
        <div className="w-2.5 h-2.5 rounded-full bg-[#4f78ff] animate-pulse" />
      </div>
    );
  }
  if (status === 'locked') {
    return (
      <div className="w-6 h-6 rounded-full border-2 border-gray-200 flex items-center justify-center shrink-0">
        <Lock size={10} className="text-gray-300" />
      </div>
    );
  }
  // available
  return (
    <div className="w-6 h-6 rounded-full border-2 border-[rgba(79,120,255,0.4)] shrink-0" />
  );
}

// ── Phase 1 celebration modal ─────────────────────────────────────────────────

function FrontDeskCelebration({ onContinue }) {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div
        className="relative w-full max-w-md rounded-2xl overflow-hidden border border-[rgba(79,120,255,0.3)] p-8 text-center"
        style={{ background: 'linear-gradient(160deg, #010b52 0%, #040e3e 60%, #0d1e78 100%)' }}
      >
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{
          backgroundImage: 'linear-gradient(rgba(153,197,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(153,197,255,1) 1px,transparent 1px)',
          backgroundSize: '28px 28px',
        }} />
        <div className="relative">
          <div className="text-5xl mb-6">✨</div>
          <h2 className="text-2xl font-black text-white mb-4 leading-tight">That booking came from Cadi.</h2>
          <p className="text-[rgba(153,197,255,0.8)] text-sm leading-relaxed mb-8">
            A customer found you. Front Desk quoted them. They booked. And you didn't lift a finger.
            <br /><br />
            This is what running a cleaning business with Cadi actually feels like.
          </p>
          <button
            onClick={onContinue}
            className="w-full py-3.5 rounded-xl bg-[#4f78ff] hover:bg-[#3d68ff] text-white font-black text-sm transition-colors"
          >
            See what just happened →
          </button>
        </div>
      </div>
    </div>
  );
}

function Phase1Celebration({ stats, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div
        className="relative w-full max-w-md rounded-2xl overflow-hidden border border-[rgba(79,120,255,0.3)]"
        style={{ background: 'linear-gradient(160deg, #010b52 0%, #040e3e 60%, #0d1e78 100%)' }}
      >
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{
          backgroundImage: 'linear-gradient(rgba(153,197,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(153,197,255,1) 1px,transparent 1px)',
          backgroundSize: '28px 28px',
        }} />
        <div className="relative p-8 text-center">
          <div className="text-5xl mb-4">🎉</div>
          <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#4f78ff] mb-1">Phase 1 complete</p>
          <h2 className="text-2xl font-black text-white mb-2 leading-tight">Look what you just built.</h2>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3 my-6">
            {stats.serviceCount !== null && (
              <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                <p className="text-3xl font-black text-white">{stats.serviceCount}</p>
                <p className="text-xs text-[rgba(153,197,255,0.6)] mt-1">services in your menu</p>
              </div>
            )}
            {stats.customerCount !== null && (
              <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                <p className="text-3xl font-black text-white">{stats.customerCount}</p>
                <p className="text-xs text-[rgba(153,197,255,0.6)] mt-1">customers in Cadi</p>
              </div>
            )}
            {stats.firstJobDate && (
              <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                <p className="text-sm font-black text-white">{stats.firstJobDate}</p>
                <p className="text-xs text-[rgba(153,197,255,0.6)] mt-1">first job</p>
              </div>
            )}
            {stats.frontDeskLive && (
              <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                <p className="text-lg font-black text-emerald-400">LIVE</p>
                <p className="text-xs text-[rgba(153,197,255,0.6)] mt-1">Front Desk</p>
              </div>
            )}
          </div>

          {stats.durationLabel && (
            <p className="text-xs text-[rgba(153,197,255,0.5)] mb-6">
              You built this in <span className="text-[#99c5ff] font-bold">{stats.durationLabel}</span>. Most cleaners take months to get this organised.
            </p>
          )}

          <p className="text-sm text-[rgba(153,197,255,0.7)] mb-6">
            Phase 2 starts when you're ready. We're going to show you what's really going on inside your business.
          </p>

          <div className="space-y-2">
            <button
              onClick={onClose}
              className="w-full py-3.5 rounded-xl bg-[#4f78ff] hover:bg-[#3d68ff] text-white font-black text-sm transition-colors"
            >
              See Phase 2
            </button>
            <button
              onClick={onClose}
              className="w-full py-2.5 text-sm text-[rgba(153,197,255,0.5)] hover:text-[#99c5ff] font-semibold transition-colors"
            >
              Back to dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ThirtyDayPlan({ onRefresh }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(null);
  const [steps, setSteps] = useState([]);
  const [collapsed, setCollapsed] = useState(false);
  const [celebration, setCelebration] = useState(null); // null | 'front_desk' | 'phase1'
  const [celebrationStats, setCelebrationStats] = useState(null);

  const load = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      // Fetch live counts to auto-complete steps
      const [{ count: customerCount }, serviceCount, { data: frontDeskData }, { count: jobCount }] = await Promise.all([
        supabase.from('customers').select('*', { count: 'exact', head: true }),
        countActiveServices(),
        supabase.from('agent_settings').select('mode').eq('agent', 'front_desk').maybeSingle(),
        supabase.from('jobs').select('*', { count: 'exact', head: true }),
      ]);

      const frontDeskActive = frontDeskData?.mode === 'autonomous' || frontDeskData?.mode === 'approval';

      const result = await syncPhase1Steps({ serviceCount, customerCount, frontDeskActive, jobCount });

      if (result?.completed && !result?.alreadyDone) {
        const stats = await getPhase1Stats();
        setCelebrationStats(stats);
        setCelebration(stats.frontDeskSourced ? 'front_desk' : 'phase1');
      }

      const { progress: prog, steps: stepRows } = await getPhase1State();
      setProgress(prog);
      setSteps(stepRows);
    } catch (e) {
      console.error('ThirtyDayPlan load error', JSON.stringify(e), e?.message, e?.code, e?.details);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Completed phase 1 and beyond → collapsed badge
  const phase1Done = progress?.phase_1_completed_at != null;
  const currentPhase = progress?.current_phase ?? 1;

  const requiredKeys = ['services_menu', 'add_customers', 'first_job'];
  const requiredCompleted = steps.filter(s => requiredKeys.includes(s.step_key) && s.status === 'completed').length;
  const subhead = SUBHEADS[Math.min(requiredCompleted, 3)];

  const getStepObj = (key) => steps.find(s => s.step_key === key);
  const getStepDef = (key) => PHASE1_STEPS.find(s => s.key === key);

  if (loading) return null;

  // Collapsed badge (all phases complete — not in scope for Phase 1, but handle gracefully)
  if (phase1Done && currentPhase > 1 && collapsed) {
    return (
      <div className="bg-[#040810] border-b border-[rgba(79,120,255,0.2)] px-5 py-2 flex items-center justify-between">
        <button
          onClick={() => setCollapsed(false)}
          className="flex items-center gap-2 text-xs font-bold text-[#4f78ff] hover:text-[#99c5ff] transition-colors"
        >
          <Sparkles size={12} /> 30 Day Plan — Phase {currentPhase} of 4
        </button>
      </div>
    );
  }

  return (
    <>
      <div
        className="border-b border-[rgba(79,120,255,0.15)]"
        style={{ background: 'linear-gradient(135deg, #040810 0%, #06103c 50%, #080d28 100%)' }}
      >
        {/* Panel header */}
        <div className="px-5 sm:px-6 pt-5 pb-3 flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#4f78ff] mb-1">Your Cadi 30 Day Plan</p>
            <h3 className="text-base font-black text-white leading-tight">
              Phase 1 of 4 — Build your business inside Cadi
            </h3>
            {!phase1Done && subhead && (
              <p className="text-xs text-[rgba(153,197,255,0.55)] mt-1">{subhead}</p>
            )}
          </div>
          <button
            onClick={() => setCollapsed(c => !c)}
            className="shrink-0 w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors mt-0.5"
          >
            {collapsed
              ? <ChevronDown size={14} className="text-[#99c5ff]" />
              : <ChevronUp size={14} className="text-[#99c5ff]" />
            }
          </button>
        </div>

        {!collapsed && (
          <>
            {/* Phase progress bar */}
            <div className="px-5 sm:px-6 mb-4">
              <div className="flex gap-1.5 mb-2">
                {[1,2,3,4].map(ph => (
                  <div key={ph} className="flex-1 flex flex-col gap-1">
                    <div className={`h-1 rounded-full transition-all ${
                      ph < currentPhase ? 'bg-emerald-500' :
                      ph === currentPhase ? 'bg-[#4f78ff]' :
                      'bg-[rgba(153,197,255,0.1)]'
                    }`} />
                    <p className={`text-[9px] font-bold text-center hidden sm:block ${
                      ph === currentPhase ? 'text-[#4f78ff]' : ph < currentPhase ? 'text-emerald-500' : 'text-[rgba(153,197,255,0.2)]'
                    }`}>
                      {ph < currentPhase ? '✓' : ph === currentPhase ? `Phase ${ph}` : <Lock size={8} />}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Steps */}
            <div className="px-5 sm:px-6 pb-5 space-y-2">
              {PHASE1_STEPS.map((def) => {
                const stepRow = getStepObj(def.key);
                const status = stepRow?.status ?? 'available';
                const done = status === 'completed';
                const isOptional = def.optional === true;

                return (
                  <div
                    key={def.key}
                    className={`flex items-start gap-3 p-3 rounded-xl transition-all cursor-pointer group ${
                      done
                        ? 'bg-emerald-500/10 border border-emerald-500/20'
                        : isOptional
                          ? 'bg-white/3 border border-[rgba(153,197,255,0.07)] hover:bg-white/6 hover:border-[rgba(79,120,255,0.2)]'
                          : 'bg-white/4 border border-[rgba(153,197,255,0.1)] hover:bg-white/8 hover:border-[rgba(79,120,255,0.3)]'
                    }`}
                    onClick={() => !done && navigate(def.path)}
                  >
                    <StepDot status={status} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className={`text-sm font-bold leading-tight ${
                          done ? 'line-through text-[rgba(153,197,255,0.4)]' : isOptional ? 'text-[rgba(153,197,255,0.6)]' : 'text-white'
                        }`}>{def.title}</p>
                        {isOptional && (
                          <span className="text-[9px] font-bold tracking-widest uppercase px-1.5 py-0.5 rounded bg-[rgba(79,120,255,0.15)] text-[#4f78ff]">
                            optional
                          </span>
                        )}
                      </div>
                      <p className={`text-xs mt-0.5 ${
                        done ? 'text-[rgba(153,197,255,0.3)]' : isOptional ? 'text-[rgba(153,197,255,0.35)]' : 'text-[rgba(153,197,255,0.5)]'
                      }`}>
                        {done
                          ? def.completeSub(stepRow?.metadata)
                          : def.incompleteSub
                        }
                      </p>
                    </div>
                    {!done && (
                      <button
                        onClick={e => { e.stopPropagation(); navigate(def.path); }}
                        className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                          isOptional
                            ? 'bg-white/8 hover:bg-white/12 text-[rgba(153,197,255,0.7)]'
                            : 'bg-[#4f78ff] hover:bg-[#3d68ff] text-white'
                        }`}
                      >
                        {def.cta}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Phase 2 locked / unlocked preview */}
            {phase1Done ? (
              <div className="mx-5 sm:mx-6 mb-5 flex items-center gap-2.5 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <ArrowRight size={12} className="text-emerald-400 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-emerald-400">Phase 2 unlocked</p>
                  <p className="text-[10px] text-[rgba(153,197,255,0.4)] mt-0.5">See what's really going on inside your business.</p>
                </div>
              </div>
            ) : (
              <div className="mx-5 sm:mx-6 mb-5 flex items-center gap-2.5 px-4 py-3 rounded-xl bg-[rgba(153,197,255,0.04)] border border-[rgba(153,197,255,0.08)]">
                <Lock size={12} className="text-[rgba(153,197,255,0.2)] shrink-0" />
                <div>
                  <p className="text-xs font-bold text-[rgba(153,197,255,0.3)]">Phase 2 unlocks after the first 3 steps</p>
                  <p className="text-[10px] text-[rgba(153,197,255,0.2)] mt-0.5">Front Desk is optional — it won't hold you back.</p>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Celebration modals */}
      {celebration === 'front_desk' && (
        <FrontDeskCelebration onContinue={() => setCelebration('phase1')} />
      )}
      {celebration === 'phase1' && celebrationStats && (
        <Phase1Celebration
          stats={celebrationStats}
          onClose={() => { setCelebration(null); onRefresh?.(); }}
        />
      )}
    </>
  );
}
