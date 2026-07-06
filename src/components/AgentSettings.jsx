import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useBusinessId } from '../hooks/useBusinessId';
import {
  TRUST_LEVELS,
  AGENT_MODES,
  AGENTS,
  TONE_OPTIONS,
  upsertAgentSettings,
} from '../lib/agentFramework';
import { Check, MessageSquare, Star, CalendarDays, Sparkles } from 'lucide-react';

const AGENT_ICONS = {
  front_desk: MessageSquare,
  reviews: Star,
  scheduler: CalendarDays,
};

function TrustCard({ value, selected, onSelect }) {
  const cfg = TRUST_LEVELS[value];
  return (
    <button
      onClick={() => onSelect(value)}
      className={`w-full text-left px-4 py-3.5 rounded-xl border-2 transition-all ${
        selected
          ? 'border-[#1f48ff] bg-[#f0f4ff]'
          : 'border-gray-200 bg-white hover:border-[#1f48ff]/40'
      }`}
    >
      <div className="flex items-center justify-between">
        <p className={`text-sm font-bold ${selected ? 'text-[#1f48ff]' : 'text-[#010a4f]'}`}>
          {cfg.label}
        </p>
        {selected && <Check size={14} className="text-[#1f48ff]" />}
      </div>
      <p className="text-xs text-gray-500 mt-0.5">{cfg.desc}</p>
    </button>
  );
}

function AgentModeRow({ agentKey, mode, onModeChange }) {
  const Icon = AGENT_ICONS[agentKey] ?? MessageSquare;
  const agent = AGENTS[agentKey];

  return (
    <div className="flex items-center justify-between px-5 py-4">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-[#f0f4ff] flex items-center justify-center">
          <Icon size={15} className="text-[#1f48ff]" />
        </div>
        <div>
          <p className="text-sm font-semibold text-[#010a4f]">{agent.label}</p>
          <p className="text-xs text-gray-400">{agent.desc}</p>
        </div>
      </div>
      <div className="relative">
        <select
          value={mode}
          onChange={(e) => onModeChange(agentKey, e.target.value)}
          className="appearance-none pl-3 pr-7 py-2 rounded-xl border border-[#99c5ff]/40 text-xs font-semibold text-[#010a4f] bg-white focus:outline-none focus:border-[#1f48ff] focus:ring-2 focus:ring-[#1f48ff]/20"
        >
          {Object.entries(AGENT_MODES).map(([val, { label }]) => (
            <option key={val} value={val}>
              {label}
            </option>
          ))}
        </select>
        <svg
          className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400"
          width="10"
          height="10"
          viewBox="0 0 10 10"
        >
          <path
            d="M2 3l3 4 3-4"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
            strokeLinecap="round"
          />
        </svg>
      </div>
    </div>
  );
}

function TonePreview({ tone, businessName, signOffName }) {
  const toneOpt = TONE_OPTIONS.find((t) => t.value === tone);
  if (!toneOpt) return null;

  let example = toneOpt.example;
  if (businessName)
    example = example.replace('Just checking in', `Just checking in from ${businessName}`);

  return (
    <div className="mt-2 p-3 rounded-xl bg-[#f0f4ff] border border-[#1f48ff]/10">
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
        Preview
      </p>
      <p className="text-xs text-gray-600 italic">{example}</p>
      {signOffName && <p className="text-xs text-gray-500 mt-1">— {signOffName}</p>}
    </div>
  );
}

export default function AgentSettings() {
  const { profile, user } = useAuth();
  const businessId = useBusinessId();

  // Trust level — stored on profiles
  const [trustLevel, setTrustLevel] = useState(profile?.trust_level ?? 'cautious');
  const [savingTrust, setSavingTrust] = useState(false);
  const [trustSaved, setTrustSaved] = useState(false);

  // Per-agent modes
  const [agentModes, setAgentModes] = useState({
    front_desk: 'approval',
    reviews: 'approval',
    scheduler: 'off',
  });

  // Brand voice — stored in profiles.brand_voice jsonb
  const [tone, setTone] = useState(profile?.brand_voice?.tone ?? 'warm');
  const [businessName, setBusinessName] = useState(profile?.brand_voice?.business_name ?? '');
  const [signOffName, setSignOffName] = useState(profile?.brand_voice?.sign_off_name ?? '');
  const [savingVoice, setSavingVoice] = useState(false);
  const [voiceSaved, setVoiceSaved] = useState(false);

  const loadModes = useCallback(async () => {
    if (!businessId) return;
    const agentKeys = Object.keys(AGENTS);
    const { data } = await supabase
      .from('agent_settings')
      .select('agent, mode')
      .eq('business_id', businessId)
      .in('agent', agentKeys);
    if (data?.length) {
      const map = {};
      data.forEach((row) => {
        map[row.agent] = row.mode;
      });
      setAgentModes((prev) => ({ ...prev, ...map }));
    }
  }, [businessId]);

  useEffect(() => {
    loadModes();
  }, [loadModes]);

  const handleTrustSave = async () => {
    if (!user) return;
    setSavingTrust(true);
    await supabase.from('profiles').update({ trust_level: trustLevel }).eq('id', user.id);
    setSavingTrust(false);
    setTrustSaved(true);
    setTimeout(() => setTrustSaved(false), 2500);
  };

  const handleModeChange = async (agentKey, mode) => {
    if (!businessId) return;
    setAgentModes((prev) => ({ ...prev, [agentKey]: mode }));
    await upsertAgentSettings(businessId, agentKey, mode);
  };

  const handleVoiceSave = async () => {
    if (!user) return;
    setSavingVoice(true);
    await supabase
      .from('profiles')
      .update({ brand_voice: { tone, business_name: businessName, sign_off_name: signOffName } })
      .eq('id', user.id);
    setSavingVoice(false);
    setVoiceSaved(true);
    setTimeout(() => setVoiceSaved(false), 2500);
  };

  return (
    <div className="space-y-6">
      {/* ── Trust level ── */}
      <div className="bg-white rounded-2xl border border-[#99c5ff]/20 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-bold text-[#010a4f]">Trust level</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Controls how much autonomy Cadi has across all agents. You can override per-agent below.
          </p>
        </div>
        <div className="p-5 space-y-2.5">
          {Object.keys(TRUST_LEVELS).map((val) => (
            <TrustCard
              key={val}
              value={val}
              selected={trustLevel === val}
              onSelect={setTrustLevel}
            />
          ))}
          <button
            onClick={handleTrustSave}
            disabled={savingTrust}
            className="mt-1 w-full py-2.5 bg-[#1f48ff] hover:bg-[#3a5eff] disabled:opacity-50 text-white font-black text-sm rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {trustSaved ? (
              <>
                <Check size={14} /> Saved
              </>
            ) : savingTrust ? (
              'Saving…'
            ) : (
              'Save trust level'
            )}
          </button>
        </div>
      </div>

      {/* ── Per-agent modes ── */}
      <div className="bg-white rounded-2xl border border-[#99c5ff]/20 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-bold text-[#010a4f]">Agent modes</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Fine-tune each agent independently. "Needs approval" is the safe default.
          </p>
        </div>
        <div className="divide-y divide-gray-50">
          {Object.keys(AGENTS).map((key) => (
            <AgentModeRow
              key={key}
              agentKey={key}
              mode={agentModes[key] ?? 'approval'}
              onModeChange={handleModeChange}
            />
          ))}
        </div>
        <div className="px-5 py-3 bg-gray-50 border-t border-gray-100">
          <p className="text-xs text-gray-400">Changes save automatically per agent.</p>
        </div>
      </div>

      {/* ── Brand voice ── */}
      <div className="bg-white rounded-2xl border border-[#99c5ff]/20 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Sparkles size={15} className="text-[#1f48ff]" />
            <h3 className="font-bold text-[#010a4f]">Brand voice</h3>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            Cadi will write all customer messages in your business's tone.
          </p>
        </div>
        <div className="p-5 space-y-5">
          {/* Tone */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
              Tone
            </label>
            <div className="space-y-2">
              {TONE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setTone(opt.value)}
                  className={`w-full text-left px-3.5 py-2.5 rounded-xl border-2 transition-all ${
                    tone === opt.value
                      ? 'border-[#1f48ff] bg-[#f0f4ff]'
                      : 'border-gray-200 bg-white hover:border-[#1f48ff]/30'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p
                      className={`text-sm font-semibold ${tone === opt.value ? 'text-[#1f48ff]' : 'text-[#010a4f]'}`}
                    >
                      {opt.label}
                    </p>
                    {tone === opt.value && <Check size={13} className="text-[#1f48ff]" />}
                  </div>
                </button>
              ))}
            </div>
            <TonePreview tone={tone} businessName={businessName} signOffName={signOffName} />
          </div>

          {/* Business name */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
              Business name in messages
            </label>
            <input
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="e.g. Sparkle Clean"
              className="w-full px-3 py-2.5 rounded-xl border border-[#99c5ff]/40 text-sm focus:outline-none focus:border-[#1f48ff] focus:ring-2 focus:ring-[#1f48ff]/20"
            />
          </div>

          {/* Sign-off name */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
              Sign-off name
            </label>
            <input
              type="text"
              value={signOffName}
              onChange={(e) => setSignOffName(e.target.value)}
              placeholder="e.g. Rhianna at Sparkle Clean"
              className="w-full px-3 py-2.5 rounded-xl border border-[#99c5ff]/40 text-sm focus:outline-none focus:border-[#1f48ff] focus:ring-2 focus:ring-[#1f48ff]/20"
            />
          </div>

          <button
            onClick={handleVoiceSave}
            disabled={savingVoice}
            className="w-full py-2.5 bg-[#1f48ff] hover:bg-[#3a5eff] disabled:opacity-50 text-white font-black text-sm rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {voiceSaved ? (
              <>
                <Check size={14} /> Saved
              </>
            ) : savingVoice ? (
              'Saving…'
            ) : (
              'Save brand voice'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
