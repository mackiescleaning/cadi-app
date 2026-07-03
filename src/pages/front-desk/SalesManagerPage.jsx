// src/pages/front-desk/SalesManagerPage.jsx
// Sales Manager agent profile page — /front-desk/sales-manager

import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { MessageSquare, Settings, ArrowRight, Check, Circle, AlertTriangle } from 'lucide-react';
import FrontDeskSettings from '../../components/FrontDeskSettings';
import { supabase } from '../../lib/supabase';
import { useBusinessId } from '../../hooks/useBusinessId';
import { FD_GOLD, FD_GOLD_SOFT, FD_GOLD_BORDER, FD_BLUE, FD_SKY, ON_DARK, fdCard, fdCanvas } from '../../lib/frontDeskTheme';

const SETUP_STEPS = [
  { n: 0, label: 'Services & sectors',   desc: 'What kind of work you cover' },
  { n: 1, label: 'Business basics',      desc: 'Name, response time, service area' },
  { n: 2, label: 'Tone of voice',        desc: 'How Cadi sounds to your customers' },
  { n: 3, label: 'Notifications',        desc: 'Where new leads land' },
  { n: 4, label: 'Install on your site', desc: 'Paste the snippet and go live' },
];

function StatCard({ label, value, sub }) {
  return (
    <div className="rounded-xl px-4 py-3" style={fdCard({ radius: 12 })}>
      <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: ON_DARK.faint }}>{label}</p>
      <p className="text-2xl font-black text-white">{value ?? '—'}</p>
      {sub && <p className="text-xs mt-0.5" style={{ color: ON_DARK.muted }}>{sub}</p>}
    </div>
  );
}

// Enhanced setup support — replaces the old single vague CTA banner with a
// real per-step checklist, plus an "is it actually live?" install signal
// that's independent of finishing the wizard (a user can complete all 5
// steps and still forget to paste the snippet on their site).
function SetupChecklist({ setupStep, hasChats, navigate }) {
  const allStepsDone = setupStep >= 5;
  const installUnconfirmed = allStepsDone && !hasChats;

  return (
    <div className="rounded-2xl overflow-hidden" style={fdCard({ radius: 18, gold: !allStepsDone })}>
      <div className="px-5 py-4 flex items-center justify-between gap-3" style={{ borderBottom: `1px solid ${ON_DARK.line}` }}>
        <div className="flex items-center gap-2.5">
          <div className="w-1.5 h-4 rounded-full" style={{ background: FD_GOLD, boxShadow: `0 0 8px 2px ${FD_GOLD}88` }} />
          <p className="text-xs font-black uppercase tracking-[0.14em]" style={{ color: FD_SKY }}>
            {allStepsDone ? 'Setup checklist' : 'Finish setting up'}
          </p>
        </div>
        <span className="text-[10px] font-bold" style={{ color: ON_DARK.muted }}>
          {Math.min(setupStep, 5)} of 5 done
        </span>
      </div>

      <div className="px-3 py-3 space-y-1">
        {SETUP_STEPS.map(step => {
          const done = setupStep > step.n;
          const isNext = !done && setupStep === step.n;
          const isFinalAndUnconfirmed = step.n === 4 && done && installUnconfirmed;
          return (
            <button
              key={step.n}
              onClick={() => navigate(`/front-desk/sales-manager/setup?step=${step.n + 1}`)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors hover:bg-white/[0.04]"
            >
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                style={
                  isFinalAndUnconfirmed
                    ? { background: FD_GOLD_SOFT, border: `1.5px solid ${FD_GOLD_BORDER}` }
                    : done
                    ? { background: 'rgba(52,211,153,0.18)', border: '1.5px solid rgba(52,211,153,0.45)' }
                    : isNext
                    ? { background: `${FD_BLUE}22`, border: `1.5px solid ${FD_BLUE}66` }
                    : { background: 'rgba(255,255,255,0.04)', border: `1.5px solid ${ON_DARK.lineHi}` }
                }
              >
                {isFinalAndUnconfirmed
                  ? <AlertTriangle size={11} style={{ color: FD_GOLD }} />
                  : done
                  ? <Check size={12} className="text-emerald-300" />
                  : <Circle size={7} fill={isNext ? FD_SKY : 'transparent'} style={{ color: isNext ? FD_SKY : ON_DARK.faint }} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-bold ${done && !isFinalAndUnconfirmed ? 'text-white/70' : 'text-white'}`}>{step.label}</p>
                <p className="text-xs mt-0.5" style={{ color: isFinalAndUnconfirmed ? FD_GOLD : ON_DARK.muted }}>
                  {isFinalAndUnconfirmed ? "Snippet not detected yet — we haven't seen a chat come through" : step.desc}
                </p>
              </div>
              {(isNext || isFinalAndUnconfirmed) && <ArrowRight size={13} style={{ color: isFinalAndUnconfirmed ? FD_GOLD : FD_SKY }} className="shrink-0" />}
            </button>
          );
        })}
      </div>

      {!allStepsDone && (
        <div className="px-5 pb-4">
          <button
            onClick={() => navigate('/front-desk/sales-manager/setup')}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-black transition-all hover:brightness-110"
            style={{ background: `linear-gradient(180deg, #fde68a 0%, ${FD_GOLD} 100%)`, color: '#010a4f' }}
          >
            {setupStep === 0 ? 'Get started — 2 minutes' : 'Continue setup'} <ArrowRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

export default function SalesManagerPage() {
  const navigate    = useNavigate();
  const businessId  = useBusinessId();
  const [searchParams, setSearchParams] = useSearchParams();
  const fromPhase3 = searchParams.get('from') === 'phase3';
  const [introDismissed, setIntroDismissed] = useState(false);
  const [stats, setStats] = useState({ conversations: null, lastActive: null });
  const [setupStep, setSetupStep] = useState(null); // null = loading

  useEffect(() => {
    if (!businessId) return;
    (async () => {
      try {
        const [{ count: convCount }, { data: recent }, { data: wc }] = await Promise.all([
          supabase.from('conversations').select('*', { count: 'exact', head: true })
            .eq('business_id', businessId).eq('channel', 'web_chat'),
          supabase.from('conversations').select('last_message_at')
            .eq('business_id', businessId).eq('channel', 'web_chat')
            .order('last_message_at', { ascending: false }).limit(1).maybeSingle(),
          supabase.from('widget_configs').select('setup_step').eq('business_id', businessId).maybeSingle(),
        ]);
        const lastAt = recent?.last_message_at;
        let lastActive = null;
        if (lastAt) {
          const diff = Math.floor((Date.now() - new Date(lastAt)) / 86_400_000);
          lastActive = diff === 0 ? 'today' : diff === 1 ? 'yesterday' : `${diff} days ago`;
        }
        setStats({ conversations: convCount ?? 0, lastActive });
        setSetupStep(wc?.setup_step ?? 0);
      } catch (e) {
        console.error('SalesManager load error:', e);
        setSetupStep(0);
      }
    })();
  }, [businessId]);

  function dismissIntro() {
    setIntroDismissed(true);
    setSearchParams({});
  }

  return (
    <div style={fdCanvas()} className="-mx-4 md:-mx-8 -mt-6 -mb-24 md:-mb-6">
    <div className="max-w-3xl mx-auto px-4 md:px-8 py-8 space-y-6">

      {/* Phase 3 intro framing */}
      {fromPhase3 && !introDismissed && (
        <div
          className="rounded-2xl overflow-hidden p-6"
          style={{ background: 'linear-gradient(135deg, #010a4f 0%, #0d1e78 100%)', border: `1px solid ${FD_BLUE}4d` }}
        >
          <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#99c5ff]/50 mb-2">Phase 3 · Step 1</p>
          <h2 className="text-xl font-black text-white mb-3 leading-snug">Meet your Sales Manager.</h2>
          <p className="text-sm text-white/60 leading-relaxed mb-4">
            This is the agent at your Front Desk who handles incoming enquiries — quoting, booking, answering questions while you're working.
          </p>
          <p className="text-sm text-white/60 leading-relaxed mb-5">
            Front Desk gets the enquiry. Your Sales Manager replies using your services menu and your tone of voice. New work books itself in without you lifting a finger.
          </p>
          <p className="text-sm font-bold text-white mb-5">Let's hire them.</p>
          <button
            onClick={dismissIntro}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-[#4f78ff] rounded-xl hover:bg-[#3d68ff] transition-colors"
          >
            Set up Sales Manager <ArrowRight size={14} />
          </button>
        </div>
      )}

      {/* Setup checklist — real per-step progress, shown until fully live */}
      {setupStep !== null && (
        <SetupChecklist setupStep={setupStep} hasChats={(stats.conversations ?? 0) > 0} navigate={navigate} />
      )}

      {/* Agent header */}
      <div className="rounded-2xl overflow-hidden" style={fdCard({ radius: 20 })}>
        <div className="px-6 py-5" style={{ background: 'linear-gradient(135deg, #010a4f 0%, #1f48ff 100%)' }}>
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
              <MessageSquare size={22} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#99c5ff]/70">Front Desk · Agent</p>
              </div>
              <h1 className="text-xl font-black text-white">Sales Manager</h1>
              <p className="text-sm text-white/60 mt-1">
                Handles inbound enquiries, quotes new work, and books in new customers.
              </p>
            </div>
          </div>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-3 divide-x" style={{ borderTop: `1px solid ${ON_DARK.line}`, borderColor: 'rgba(79,120,255,0.10)' }}>
          <div className="px-5 py-4 text-center">
            <p className="text-2xl font-black text-white">{stats.conversations ?? '—'}</p>
            <p className="text-[10px] font-semibold mt-0.5 uppercase tracking-wide" style={{ color: ON_DARK.faint }}>Conversations</p>
          </div>
          <div className="px-5 py-4 text-center">
            <p className="text-2xl font-black text-white">{stats.lastActive ?? '—'}</p>
            <p className="text-[10px] font-semibold mt-0.5 uppercase tracking-wide" style={{ color: ON_DARK.faint }}>Last active</p>
          </div>
          <div className="px-5 py-4 text-center">
            <div className="flex items-center justify-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <p className="text-sm font-bold text-emerald-300">Active</p>
            </div>
            <p className="text-[10px] font-semibold mt-0.5 uppercase tracking-wide" style={{ color: ON_DARK.faint }}>Status</p>
          </div>
        </div>
      </div>

      {/* Settings */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Settings size={14} style={{ color: ON_DARK.faint }} />
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: ON_DARK.faint }}>Settings</p>
        </div>
        <FrontDeskSettings />
      </div>

    </div>
    </div>
  );
}
