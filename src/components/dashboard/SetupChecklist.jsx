import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";

export default function SetupChecklist({ hasJobs, onNavigate, userId }) {
  const [checks, setChecks] = useState({ services: null, customers: null });
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem('cadi_setup_dismissed') === '1'; } catch { return false; }
  });

  useEffect(() => {
    if (!userId || userId === 'demo-user') return;
    try {
      if (localStorage.getItem('cadi_setup_dismissed') === '1') return;
    } catch {}

    supabase
      .from('businesses')
      .select('id')
      .eq('owner_user_id', userId)
      .maybeSingle()
      .then(({ data: biz }) => {
        if (!biz?.id) return;
        return Promise.all([
          supabase.from('services').select('id', { count: 'exact', head: true }).eq('business_id', biz.id),
          supabase.from('customers').select('id', { count: 'exact', head: true }).eq('business_id', biz.id),
        ]);
      })
      .then(results => {
        if (!results) return;
        const [srv, cust] = results;
        setChecks({ services: (srv.count ?? 0) > 0, customers: (cust.count ?? 0) > 0 });
      })
      .catch(() => {});
  }, [userId]);

  const steps = [
    {
      key: 'services',
      done: checks.services,
      icon: '🧹',
      title: 'Set up your services',
      body: 'Powers your quotes, scheduler and calculator with your real prices.',
      tab: 'services',
      cta: 'Add services →',
    },
    {
      key: 'customers',
      done: checks.customers,
      icon: '👤',
      title: 'Add your first customer',
      body: 'Drives job scheduling, invoicing, reminders and review requests.',
      tab: 'customers',
      cta: 'Add a customer →',
    },
    {
      key: 'jobs',
      done: hasJobs,
      icon: '📅',
      title: 'Schedule your first job',
      body: 'Gets your revenue tracking, health score and route planner running.',
      tab: 'scheduler',
      cta: 'Schedule a job →',
    },
  ];

  const allDone = steps.every(s => s.done === true);
  const doneCount = steps.filter(s => s.done === true).length;
  const loaded = checks.services !== null;

  useEffect(() => {
    if (!allDone || !loaded) return;
    const t = setTimeout(() => {
      try { localStorage.setItem('cadi_setup_dismissed', '1'); } catch {}
      setDismissed(true);
    }, 4000);
    return () => clearTimeout(t);
  }, [allDone, loaded]);

  if (dismissed || !loaded) return null;

  return (
    <div className="mx-4 mt-4 rounded-2xl border border-[rgba(31,72,255,0.25)] overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #05124a 0%, #091660 100%)' }}>

      <div className="px-4 py-3 flex items-center justify-between border-b border-white/10">
        <div>
          <p className="text-xs font-black text-white">
            {allDone ? '🎉 You\'re all set up!' : `Get started — ${doneCount} of 3 done`}
          </p>
          <p className="text-[11px] text-[rgba(153,197,255,0.45)] mt-0.5">
            {allDone ? 'Your dashboard is live and tracking your business.' : 'Complete these to get your dashboard running.'}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {steps.map(s => (
            <div
              key={s.key}
              className={`w-2 h-2 rounded-full transition-colors ${s.done ? 'bg-emerald-400' : 'bg-white/20'}`}
            />
          ))}
        </div>
      </div>

      {!allDone && steps.map((step, i) => (
        <div
          key={step.key}
          className={`flex items-center gap-3 px-4 py-3.5 ${i < steps.length - 1 ? 'border-b border-white/[0.06]' : ''}`}
        >
          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm transition-all ${
            step.done ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/8 text-base'
          }`}>
            {step.done ? '✓' : step.icon}
          </div>

          <div className="flex-1 min-w-0">
            <p className={`text-xs font-bold leading-snug ${step.done ? 'text-white/35 line-through' : 'text-white'}`}>
              {step.title}
            </p>
            {!step.done && (
              <p className="text-[11px] text-[rgba(153,197,255,0.45)] leading-snug mt-0.5">{step.body}</p>
            )}
          </div>

          {!step.done && (
            <button
              onClick={() => onNavigate(step.tab)}
              className="shrink-0 text-[11px] font-black text-[#99c5ff] hover:text-white transition-colors whitespace-nowrap px-2 py-1 rounded-lg hover:bg-white/10"
            >
              {step.cta}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
