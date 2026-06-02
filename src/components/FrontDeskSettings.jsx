import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, Check, MessageSquare, Settings, Play, CalendarCheck, Zap, Inbox } from 'lucide-react';
import FrontDeskPreview from './FrontDeskPreview';
import { supabase } from '../lib/supabase';
import { useBusinessId } from '../hooks/useBusinessId';

const WIDGET_URL = 'https://widget.cadi.cleaning/widget.js';

const WIDGET_GOALS = [
  {
    id: 'site_visit',
    icon: CalendarCheck,
    label: 'Book site visits',
    desc: 'Widget collects contact details and what they need. Drops straight into your inbox. Perfect for exterior, commercial, or anything that needs a quote in person.',
    badge: 'Recommended',
  },
  {
    id: 'instant_quote',
    icon: Zap,
    label: 'Give instant quotes',
    desc: 'Widget quotes prices on the spot based on your services menu. Best for residential cleaning with fixed or per-bedroom pricing.',
    badge: null,
  },
  {
    id: 'enquiry',
    icon: Inbox,
    label: 'Take general enquiries',
    desc: 'Lightweight lead capture. Widget has a quick conversation, collects name and contact info, and sends it to your inbox. No pricing needed.',
    badge: null,
  },
];

function Toggle({ enabled, onChange, disabled }) {
  return (
    <button
      onClick={() => !disabled && onChange(!enabled)}
      disabled={disabled}
      className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 disabled:opacity-50 ${
        enabled ? 'bg-[#1f48ff]' : 'bg-gray-200'
      }`}
    >
      <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
        enabled ? 'translate-x-5' : 'translate-x-0'
      }`} />
    </button>
  );
}

function timeAgo(dateStr) {
  if (!dateStr) return null;
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export default function FrontDeskSettings() {
  const navigate = useNavigate();
  const businessId = useBusinessId();
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [goalSaving, setGoalSaving] = useState(false);
  const [goalSaved, setGoalSaved] = useState(false);
  const [widgetGoal, setWidgetGoal] = useState('site_visit');
  const [chatCount, setChatCount] = useState(null);
  const [lastChatAt, setLastChatAt] = useState(null);
  const [loading, setLoading] = useState(true);

  const snippet = businessId
    ? `<script src="${WIDGET_URL}" data-business-id="${businessId}" async></script>`
    : `<script src="${WIDGET_URL}" data-business-id="…" async></script>`;

  useEffect(() => {
    if (!businessId) return;
    let mounted = true;

    (async () => {
      const [{ data: widgetRow }, { data: agentRow }, { count }, { data: lastConv }] = await Promise.all([
        supabase
          .from('widget_configs')
          .select('enabled, modes')
          .eq('business_id', businessId)
          .maybeSingle(),
        supabase
          .from('agent_settings')
          .select('mode, config')
          .eq('business_id', businessId)
          .eq('agent', 'front_desk')
          .maybeSingle(),
        supabase
          .from('conversations')
          .select('*', { count: 'exact', head: true })
          .eq('business_id', businessId)
          .eq('channel', 'web_chat'),
        supabase
          .from('conversations')
          .select('last_message_at')
          .eq('business_id', businessId)
          .eq('channel', 'web_chat')
          .order('last_message_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (!mounted) return;

      // widget_configs is primary; fall back to agent_settings for legacy rows
      if (widgetRow) {
        setEnabled(widgetRow.enabled);
      } else if (agentRow) {
        setEnabled(agentRow.mode !== 'off');
      }
      if (agentRow) {
        setWidgetGoal(agentRow.config?.widget_goal ?? 'site_visit');
      }
      setChatCount(count ?? 0);
      setLastChatAt(lastConv?.last_message_at ?? null);
      setLoading(false);
    })();

    return () => { mounted = false; };
  }, [businessId]);

  async function handleToggle(val) {
    if (!businessId) return;
    setSaving(true);
    setEnabled(val);
    // Write to widget_configs (primary) + keep agent_settings in sync (legacy)
    await Promise.all([
      supabase
        .from('widget_configs')
        .upsert(
          { business_id: businessId, enabled: val },
          { onConflict: 'business_id' }
        ),
      supabase
        .from('agent_settings')
        .upsert(
          { business_id: businessId, agent: 'front_desk', mode: val ? 'approval' : 'off' },
          { onConflict: 'business_id,agent' }
        ),
    ]);
    setSaving(false);
  }

  async function handleGoalChange(goal) {
    if (!businessId || goalSaving) return;
    setGoalSaving(true);
    setWidgetGoal(goal);
    await supabase
      .from('agent_settings')
      .upsert(
        { business_id: businessId, agent: 'front_desk', config: { widget_goal: goal } },
        { onConflict: 'business_id,agent' }
      );
    setGoalSaving(false);
    setGoalSaved(true);
    setTimeout(() => setGoalSaved(false), 2500);
  }

  function handleCopy() {
    navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const installed = chatCount !== null && chatCount > 0;

  return (
    <div className="space-y-5">

      {/* Status card */}
      <div className="bg-white rounded-2xl shadow-sm border border-[#99c5ff]/20 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#f0f4ff] flex items-center justify-center shrink-0">
              <MessageSquare size={18} className="text-[#1f48ff]" />
            </div>
            <div>
              <h3 className="font-bold text-[#010a4f]">Sales Manager — web chat</h3>
              <p className="text-xs text-gray-400 mt-0.5">AI chat widget for your website · instant quotes · lead capture</p>
            </div>
          </div>
          <Toggle enabled={enabled} onChange={handleToggle} disabled={saving || loading} />
        </div>

        <div className="px-6 py-4">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <div className="w-4 h-4 rounded-full border-2 border-gray-300 border-t-[#1f48ff] animate-spin" />
              Loading…
            </div>
          ) : installed ? (
            <div className="flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-green-700">Active</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {chatCount} chat{chatCount !== 1 ? 's' : ''} total
                  {lastChatAt ? ` · last ${timeAgo(lastChatAt)}` : ''}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-gray-300 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-gray-500">Not yet installed</p>
                <p className="text-xs text-gray-400 mt-0.5">Add the snippet below to your website to go live</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Widget goal */}
      <div className="bg-white rounded-2xl shadow-sm border border-[#99c5ff]/20 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-[#010a4f]">What should your widget do?</h3>
            <p className="text-xs text-gray-400 mt-0.5">This shapes the entire conversation — no other configuration needed.</p>
          </div>
          {goalSaved && (
            <div className="flex items-center gap-1.5 text-emerald-600 shrink-0">
              <Check size={13} />
              <span className="text-xs font-semibold">Saved</span>
            </div>
          )}
        </div>
        <div className="p-4 space-y-2">
          {WIDGET_GOALS.map(({ id, icon: Icon, label, desc, badge }) => {
            const active = widgetGoal === id;
            return (
              <button
                key={id}
                onClick={() => handleGoalChange(id)}
                disabled={goalSaving}
                className={`w-full text-left flex items-start gap-4 p-4 rounded-xl border-2 transition-all ${
                  active
                    ? 'border-[#1f48ff] bg-[#f0f4ff]'
                    : 'border-gray-100 hover:border-[#99c5ff]/40 hover:bg-gray-50'
                }`}
              >
                <div className={`mt-0.5 w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  active ? 'bg-[#1f48ff]' : 'bg-gray-100'
                }`}>
                  <Icon size={16} className={active ? 'text-white' : 'text-gray-500'} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className={`text-sm font-bold ${active ? 'text-[#1f48ff]' : 'text-[#010a4f]'}`}>{label}</p>
                    {badge && (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                        {badge}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
                </div>
                <div className={`mt-1 w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                  active ? 'border-[#1f48ff]' : 'border-gray-300'
                }`}>
                  {active && <div className="w-2 h-2 rounded-full bg-[#1f48ff]" />}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Embed snippet */}
      <div className="bg-white rounded-2xl shadow-sm border border-[#99c5ff]/20 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="font-bold text-[#010a4f]">Embed code</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Paste this single line before the <code className="font-mono text-[#1f48ff]">&lt;/body&gt;</code> tag on any page of your website.
          </p>
        </div>
        <div className="p-6 space-y-3">
          <div className="relative">
            <div className="rounded-xl bg-[#010a4f] px-4 py-3 pr-16 font-mono text-xs text-[#99c5ff] break-all leading-relaxed">
              {snippet}
            </div>
            <button
              onClick={handleCopy}
              disabled={!businessId}
              className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-[#1f48ff] rounded-lg hover:bg-[#3a5eff] transition-colors disabled:opacity-40"
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            {[
              { icon: '⚡', label: 'Instant quotes', desc: 'Calculates prices from your pricing rules' },
              { icon: '📋', label: 'Lead capture', desc: 'Name, email & phone saved to your Inbox' },
              { icon: '🎨', label: 'Branded', desc: 'Matches your business name and tone' },
            ].map(f => (
              <div key={f.label} className="p-3 rounded-xl bg-[#f8faff] border border-[#e8eeff]">
                <div className="text-lg mb-1">{f.icon}</div>
                <p className="text-xs font-bold text-[#010a4f]">{f.label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Customise link */}
      <div className="bg-white rounded-2xl shadow-sm border border-[#99c5ff]/20 p-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-[#010a4f]">Customise brand voice &amp; tone</p>
          <p className="text-xs text-gray-400 mt-0.5">Change how Cadi sounds — sign-off name, tone and more</p>
        </div>
        <button
          onClick={() => navigate('/settings?tab=agents')}
          className="shrink-0 flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-[#1f48ff] border border-[#1f48ff]/30 rounded-xl hover:bg-[#1f48ff]/5 transition-colors"
        >
          <Settings size={13} />
          Agents
        </button>
      </div>

      {/* What it looks like on your site */}
      <div className="bg-white rounded-2xl shadow-sm border border-[#99c5ff]/20 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="font-bold text-[#010a4f]">What it looks like on your site</h3>
          <p className="text-xs text-gray-400 mt-0.5">Floats in the bottom-right corner — always visible, never in the way</p>
        </div>
        <div className="relative bg-gray-50 m-4 rounded-xl overflow-hidden border border-gray-100" style={{ height: 210 }}>
          {/* Fake page skeleton */}
          <div className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-4 w-4 rounded-full bg-gray-200" />
              <div className="h-3 bg-gray-200 rounded-full w-24" />
              <div className="h-3 bg-gray-100 rounded-full w-16 ml-auto" />
              <div className="h-3 bg-gray-100 rounded-full w-14" />
            </div>
            <div className="h-3 bg-gray-200 rounded-full w-2/3 mb-2" />
            <div className="h-2.5 bg-gray-100 rounded-full w-full mb-1.5" />
            <div className="h-2.5 bg-gray-100 rounded-full w-4/5 mb-1.5" />
            <div className="h-2.5 bg-gray-100 rounded-full w-3/5 mb-4" />
            <div className="flex gap-2">
              <div className="h-7 bg-[#1f48ff]/20 rounded-lg w-20" />
              <div className="h-7 bg-gray-100 rounded-lg w-16" />
            </div>
          </div>
          {/* Widget — bottom right */}
          <div className="absolute bottom-4 right-4 flex flex-col items-end gap-2 pointer-events-none">
            {/* Greeting bubble */}
            <div className="relative bg-white rounded-xl shadow-md border border-gray-100 px-3 py-2">
              <p className="text-[11px] text-gray-700 leading-snug max-w-[150px]">
                👋 Hi! Get an instant quote — what can I help with?
              </p>
              <div className="absolute -bottom-[6px] right-4 w-0 h-0" style={{ borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: '6px solid white' }} />
            </div>
            {/* Widget button */}
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center shadow-lg"
              style={{ background: 'linear-gradient(135deg, #010a4f 0%, #1f48ff 100%)', boxShadow: '0 4px 20px rgba(31,72,255,0.4)' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" fill="rgba(255,255,255,0.95)" />
              </svg>
            </div>
          </div>
        </div>
        <div className="px-6 pb-5">
          <button
            onClick={() => setShowPreview(true)}
            disabled={!businessId}
            className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-bold text-[#1f48ff] border border-[#1f48ff]/30 rounded-xl hover:bg-[#1f48ff]/5 transition-colors disabled:opacity-40"
          >
            <Play size={13} />
            Open full preview — chat with it live
          </button>
        </div>
      </div>

      {/* Try Front Desk */}
      <div className="bg-white rounded-2xl shadow-sm border border-[#99c5ff]/20 p-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-[#010a4f]">Try your Sales Manager</p>
          <p className="text-xs text-gray-400 mt-0.5">See exactly what your customers will see — using your real services and pricing</p>
        </div>
        <button
          onClick={() => setShowPreview(true)}
          disabled={!businessId}
          className="shrink-0 flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-[#1f48ff] rounded-xl hover:bg-[#3a5eff] transition-colors disabled:opacity-40"
        >
          <Play size={13} />
          Preview
        </button>
      </div>

      {showPreview && <FrontDeskPreview onClose={() => setShowPreview(false)} />}
    </div>
  );
}
