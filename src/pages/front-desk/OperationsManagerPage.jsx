import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlan } from '../../hooks/usePlan';
import { useBusinessId } from '../../hooks/useBusinessId';
import { supabase } from '../../lib/supabase';
import ActivateOperationsManager from '../../components/ActivateOperationsManager';
import TeamMembersUI from '../../components/TeamMembersUI';
import {
  CalendarClock, Bell, Users, CreditCard,
  CheckCircle, Lock, ArrowRight, Sparkles,
} from 'lucide-react';

const FEATURES = [
  {
    icon: Bell,
    title: 'Customer reminders',
    body: 'Texts customers 24 hours before every job. Replies drop in your Front Desk for one-tap approval.',
  },
  {
    icon: Users,
    title: 'Team daily schedules',
    body: "Every morning your team gets today's jobs by SMS — with tap-through check-in links.",
  },
  {
    icon: CheckCircle,
    title: 'Job auto-completion',
    body: 'Jobs complete automatically from staff check-ins, payments, and reviews. Stop ticking off jobs by hand.',
  },
  {
    icon: CreditCard,
    title: 'Payment matching',
    body: 'Matches incoming payments to outstanding invoices. High-confidence matches are silent.',
  },
];

const EXAMPLE_ITEMS = [
  {
    icon: '📱',
    label: 'Customer reminder',
    text: '"Hi Mrs Patel, just a reminder your weekly clean is tomorrow at 2pm. See you then. — Mackies Cleaning"',
    sub: 'Sent automatically 24h before every job.',
  },
  {
    icon: '📋',
    label: 'Team daily schedule',
    text: '"Tomorrow, Sam:\n9:00 — Mrs Patel, Weekly Clean (2h) 👉 tap to check in\n11:00 — Office Park (3h) 👉 tap to check in\nAbout 5 hours total. Have a good one."',
    sub: "Each link lets staff tap 'I'm here / I've left'. Jobs auto-complete.",
  },
  {
    icon: '💷',
    label: 'Payment matched',
    text: '"£45 from \'PATEL R\' — match to Mrs Patel\'s outstanding £45 invoice?"',
    sub: 'High-confidence matches happen silently. Low-confidence comes to you.',
  },
];

function Toggle({ enabled, onChange, disabled }) {
  return (
    <button
      onClick={() => !disabled && onChange(!enabled)}
      disabled={disabled}
      className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 disabled:opacity-50 ${
        enabled ? 'bg-[#C2410C]' : 'bg-gray-200'
      }`}
    >
      <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
        enabled ? 'translate-x-5' : 'translate-x-0'
      }`} />
    </button>
  );
}

export default function OperationsManagerPage() {
  const navigate = useNavigate();
  const businessId = useBusinessId();
  const { isPro, canUseOperationsManager } = usePlan();

  const [showWizard, setShowWizard] = useState(false);
  const [activated, setActivated] = useState(false);
  const [omEnabled, setOmEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [omSettings, setOmSettings] = useState(null);

  useEffect(() => {
    if (!businessId || !canUseOperationsManager) {
      setLoading(false);
      return;
    }
    let mounted = true;

    Promise.all([
      supabase
        .from('agent_settings')
        .select('mode')
        .eq('business_id', businessId)
        .eq('agent', 'operations_manager')
        .maybeSingle(),
      supabase
        .from('autobooking_settings')
        .select('*')
        .eq('business_id', businessId)
        .maybeSingle(),
    ]).then(([{ data: agentRow }, { data: omRow }]) => {
      if (!mounted) return;
      const isActivated = !!omRow;
      setActivated(isActivated);
      setOmEnabled(agentRow?.mode === 'auto' || agentRow?.mode === 'approval');
      setOmSettings(omRow ?? null);
      setLoading(false);
    });

    return () => { mounted = false; };
  }, [businessId, canUseOperationsManager]);

  async function handleToggle(val) {
    if (!businessId) return;
    setSaving(true);
    setOmEnabled(val);
    await supabase
      .from('agent_settings')
      .upsert(
        { business_id: businessId, agent: 'operations_manager', mode: val ? 'auto' : 'off' },
        { onConflict: 'business_id,agent' }
      );
    setSaving(false);
  }

  function handleWizardComplete() {
    setShowWizard(false);
    setActivated(true);
    setOmEnabled(true);
  }

  return (
    <div className="space-y-6 max-w-3xl">

      {/* Agent header */}
      <div className="rounded-2xl overflow-hidden border border-[#99c5ff]/20">
        <div className="px-6 py-5" style={{ background: 'linear-gradient(135deg, #78350f 0%, #C2410C 100%)' }}>
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
              <CalendarClock size={22} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-orange-200/70 mb-1">Front Desk · Agent</p>
              <h1 className="text-xl font-black text-white">Operations Manager</h1>
              <p className="text-sm text-white/60 mt-1">
                Runs your schedule, reminders, and payment matching — so you stop manually ticking off jobs.
              </p>
            </div>
            {!canUseOperationsManager && (
              <span className="shrink-0 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/15 text-white">
                Pro
              </span>
            )}
          </div>
        </div>

        {/* Status bar */}
        <div className="bg-white px-6 py-4 flex items-center justify-between border-t border-[#99c5ff]/20">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <div className="w-4 h-4 rounded-full border-2 border-gray-300 border-t-[#C2410C] animate-spin" />
              Loading…
            </div>
          ) : !canUseOperationsManager ? (
            <>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-gray-300" />
                <span className="text-sm font-semibold text-gray-500">Pro feature — not activated</span>
              </div>
              <button
                onClick={() => navigate('/upgrade')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1f48ff] hover:bg-[#3a5eff] text-white text-xs font-bold rounded-lg transition-colors"
              >
                Upgrade to Pro <ArrowRight size={11} />
              </button>
            </>
          ) : activated ? (
            <>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${omEnabled ? 'bg-green-500' : 'bg-gray-300'}`} />
                <span className={`text-sm font-semibold ${omEnabled ? 'text-green-700' : 'text-gray-500'}`}>
                  {omEnabled ? 'Active' : 'Paused'}
                </span>
              </div>
              <Toggle enabled={omEnabled} onChange={handleToggle} disabled={saving} />
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-gray-300" />
                <span className="text-sm font-semibold text-gray-500">Not yet activated</span>
              </div>
              <button
                onClick={() => setShowWizard(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#C2410C] hover:bg-[#b03a0b] text-white text-xs font-bold rounded-lg transition-colors"
              >
                <Sparkles size={12} />
                Activate
              </button>
            </>
          )}
        </div>
      </div>

      {/* When activated: show team members + feature toggles */}
      {activated && canUseOperationsManager && omSettings && (
        <div className="bg-white rounded-2xl border border-[#99c5ff]/20 p-6">
          <TeamMembersUI />
        </div>
      )}

      {/* What it does */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">What your Operations Manager does</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="bg-white rounded-xl border border-[#99c5ff]/20 p-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
                  <Icon size={15} className="text-[#C2410C]" />
                </div>
                <div>
                  <p className="text-sm font-bold text-[#010a4f]">{title}</p>
                  <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{body}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Example interactions */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">What it looks like in practice</p>
        <div className="space-y-3">
          {EXAMPLE_ITEMS.map(({ icon, label, text, sub }) => (
            <div key={label} className="bg-white rounded-xl border border-[#99c5ff]/20 p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-base">{icon}</span>
                <span className="text-xs font-bold text-[#010a4f]">{label}</span>
              </div>
              <div className="bg-[#f8f9ff] rounded-lg px-3 py-2.5 mb-2">
                <p className="text-xs text-gray-700 whitespace-pre-line leading-relaxed font-mono">{text}</p>
              </div>
              <p className="text-[11px] text-gray-400">{sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom CTA for non-Pro */}
      {!canUseOperationsManager && (
        <div className="rounded-2xl border border-[#1f48ff]/20 p-6 text-center"
          style={{ background: 'linear-gradient(135deg, #010a4f 0%, #0d1e78 100%)' }}>
          <Lock size={24} className="text-[#99c5ff]/50 mx-auto mb-3" />
          <p className="text-base font-black text-white mb-1">Operations Manager is a Pro feature</p>
          <p className="text-sm text-[#99c5ff]/60 mb-4">
            Upgrade to Pro to activate your Operations Manager and stop manually ticking off jobs.
          </p>
          <button
            onClick={() => navigate('/upgrade')}
            className="px-6 py-3 bg-[#1f48ff] hover:bg-[#3a5eff] text-white font-black text-sm rounded-xl transition-all shadow-lg"
          >
            Upgrade to Pro — £39/month
          </button>
          <p className="text-[10px] text-white/25 mt-3">Cancel anytime · Powered by Stripe</p>
        </div>
      )}

      {/* Activation wizard modal */}
      {showWizard && (
        <ActivateOperationsManager
          onComplete={handleWizardComplete}
          onClose={() => setShowWizard(false)}
        />
      )}
    </div>
  );
}
