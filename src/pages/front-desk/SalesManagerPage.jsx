// src/pages/front-desk/SalesManagerPage.jsx
// Sales Manager agent profile page — /front-desk/sales-manager

import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { MessageSquare, Settings, ArrowRight, Sparkles } from 'lucide-react';
import FrontDeskSettings from '../../components/FrontDeskSettings';
import { supabase } from '../../lib/supabase';
import { useBusinessId } from '../../hooks/useBusinessId';

function StatCard({ label, value, sub }) {
  return (
    <div className="bg-white rounded-xl border border-[#99c5ff]/20 px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">{label}</p>
      <p className="text-2xl font-black text-[#010a4f]">{value ?? '—'}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
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
    })();
  }, [businessId]);

  function dismissIntro() {
    setIntroDismissed(true);
    setSearchParams({});
  }

  return (
    <div className="space-y-6 max-w-3xl">

      {/* Phase 3 intro framing */}
      {fromPhase3 && !introDismissed && (
        <div
          className="rounded-2xl overflow-hidden border border-[#4f78ff]/30 p-6"
          style={{ background: 'linear-gradient(135deg, #010a4f 0%, #0d1e78 100%)' }}
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

      {/* Setup wizard CTA — shown until setup_step reaches 5 */}
      {setupStep !== null && setupStep < 5 && (
        <button
          onClick={() => navigate('/front-desk/sales-manager/setup')}
          className="w-full text-left rounded-2xl overflow-hidden border border-[#4f78ff]/30 p-5 flex items-center justify-between gap-4 hover:border-[#4f78ff]/60 transition-colors"
          style={{ background: 'linear-gradient(135deg, #010a4f 0%, #0d1e78 100%)' }}
        >
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
              <Sparkles size={18} className="text-[#99c5ff]" />
            </div>
            <div>
              <p className="text-sm font-black text-white">Finish setting up your widget</p>
              <p className="text-xs text-white/50 mt-0.5">
                {setupStep === 0
                  ? '5 quick steps — takes about 2 minutes'
                  : `Step ${setupStep + 1} of 5 — pick up where you left off`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-[#4f78ff] rounded-xl shrink-0">
            <span className="text-xs font-bold text-white">{setupStep === 0 ? 'Get started' : 'Continue'}</span>
            <ArrowRight size={13} className="text-white" />
          </div>
        </button>
      )}

      {/* Agent header */}
      <div className="bg-white rounded-2xl border border-[#99c5ff]/20 overflow-hidden">
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
        <div className="grid grid-cols-3 divide-x divide-[#f0f4ff] border-t border-[#99c5ff]/20">
          <div className="px-5 py-4 text-center">
            <p className="text-2xl font-black text-[#010a4f]">{stats.conversations ?? '—'}</p>
            <p className="text-[10px] font-semibold text-gray-400 mt-0.5 uppercase tracking-wide">Conversations</p>
          </div>
          <div className="px-5 py-4 text-center">
            <p className="text-2xl font-black text-[#010a4f]">{stats.lastActive ?? '—'}</p>
            <p className="text-[10px] font-semibold text-gray-400 mt-0.5 uppercase tracking-wide">Last active</p>
          </div>
          <div className="px-5 py-4 text-center">
            <div className="flex items-center justify-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <p className="text-sm font-bold text-emerald-600">Active</p>
            </div>
            <p className="text-[10px] font-semibold text-gray-400 mt-0.5 uppercase tracking-wide">Status</p>
          </div>
        </div>
      </div>

      {/* Settings */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Settings size={14} className="text-gray-400" />
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Settings</p>
        </div>
        <FrontDeskSettings />
      </div>

    </div>
  );
}
