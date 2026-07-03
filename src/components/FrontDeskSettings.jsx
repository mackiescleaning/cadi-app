import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, Check, MessageSquare, Settings, Play, CalendarCheck, Zap, Inbox } from 'lucide-react';
import FrontDeskPreview from './FrontDeskPreview';
import { supabase } from '../lib/supabase';
import { useBusinessId } from '../hooks/useBusinessId';
import { FD_GOLD, FD_BLUE, FD_SKY, ON_DARK, fdCard } from '../lib/frontDeskTheme';

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
      className="relative w-11 h-6 rounded-full transition-colors flex-shrink-0 disabled:opacity-50"
      style={{ background: enabled ? FD_BLUE : 'rgba(255,255,255,0.12)' }}
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
      <div className="rounded-2xl overflow-hidden" style={fdCard({ radius: 18 })}>
        <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${ON_DARK.line}` }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${FD_BLUE}18` }}>
              <MessageSquare size={18} style={{ color: FD_SKY }} />
            </div>
            <div>
              <h3 className="font-bold text-white">Sales Manager — web chat</h3>
              <p className="text-xs mt-0.5" style={{ color: ON_DARK.faint }}>AI chat widget for your website · instant quotes · lead capture</p>
            </div>
          </div>
          <Toggle enabled={enabled} onChange={handleToggle} disabled={saving || loading} />
        </div>

        <div className="px-6 py-4">
          {loading ? (
            <div className="flex items-center gap-2 text-sm" style={{ color: ON_DARK.faint }}>
              <div className="w-4 h-4 rounded-full border-2 animate-spin" style={{ borderColor: ON_DARK.lineHi, borderTopColor: FD_BLUE }} />
              Loading…
            </div>
          ) : installed ? (
            <div className="flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-emerald-300">Active</p>
                <p className="text-xs mt-0.5" style={{ color: ON_DARK.faint }}>
                  {chatCount} chat{chatCount !== 1 ? 's' : ''} total
                  {lastChatAt ? ` · last ${timeAgo(lastChatAt)}` : ''}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: FD_GOLD }} />
              <div>
                <p className="text-sm font-semibold" style={{ color: FD_GOLD }}>Not yet installed</p>
                <p className="text-xs mt-0.5" style={{ color: ON_DARK.faint }}>Add the snippet below to your website to go live</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Widget goal */}
      <div className="rounded-2xl overflow-hidden" style={fdCard({ radius: 18 })}>
        <div className="px-6 py-4 flex items-center justify-between gap-4" style={{ borderBottom: `1px solid ${ON_DARK.line}` }}>
          <div>
            <h3 className="font-bold text-white">What should your widget do?</h3>
            <p className="text-xs mt-0.5" style={{ color: ON_DARK.faint }}>This shapes the entire conversation — no other configuration needed.</p>
          </div>
          {goalSaved && (
            <div className="flex items-center gap-1.5 text-emerald-300 shrink-0">
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
                className="w-full text-left flex items-start gap-4 p-4 rounded-xl border-2 transition-all"
                style={active
                  ? { borderColor: FD_BLUE, background: `${FD_BLUE}18` }
                  : { borderColor: ON_DARK.line, background: 'rgba(255,255,255,0.02)' }}
              >
                <div className="mt-0.5 w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: active ? FD_BLUE : 'rgba(255,255,255,0.06)' }}>
                  <Icon size={16} style={{ color: active ? '#ffffff' : ON_DARK.faint }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-bold" style={{ color: active ? FD_SKY : '#ffffff' }}>{label}</p>
                    {badge && (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                        style={{ background: 'rgba(52,211,153,0.16)', color: '#34d399' }}>
                        {badge}
                      </span>
                    )}
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: ON_DARK.muted }}>{desc}</p>
                </div>
                <div className="mt-1 w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center"
                  style={{ borderColor: active ? FD_BLUE : ON_DARK.lineHi }}>
                  {active && <div className="w-2 h-2 rounded-full" style={{ background: FD_BLUE }} />}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Embed snippet */}
      <div className="rounded-2xl overflow-hidden" style={fdCard({ radius: 18 })}>
        <div className="px-6 py-4" style={{ borderBottom: `1px solid ${ON_DARK.line}` }}>
          <h3 className="font-bold text-white">Embed code</h3>
          <p className="text-xs mt-0.5" style={{ color: ON_DARK.faint }}>
            Paste this single line before the <code className="font-mono" style={{ color: FD_SKY }}>&lt;/body&gt;</code> tag on any page of your website.
          </p>
        </div>
        <div className="p-6 space-y-3">
          <div className="relative">
            <div className="rounded-xl px-4 py-3 pr-16 font-mono text-xs break-all leading-relaxed" style={{ background: '#010a4f', color: FD_SKY }}>
              {snippet}
            </div>
            <button
              onClick={handleCopy}
              disabled={!businessId}
              className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white rounded-lg hover:brightness-110 transition-all disabled:opacity-40"
              style={{ background: FD_BLUE }}
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
              <div key={f.label} className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${ON_DARK.line}` }}>
                <div className="text-lg mb-1">{f.icon}</div>
                <p className="text-xs font-bold text-white">{f.label}</p>
                <p className="text-xs mt-0.5" style={{ color: ON_DARK.faint }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Customise link */}
      <div className="flex items-center justify-between gap-4 p-6" style={fdCard({ radius: 18 })}>
        <div>
          <p className="text-sm font-bold text-white">Customise brand voice &amp; tone</p>
          <p className="text-xs mt-0.5" style={{ color: ON_DARK.faint }}>Change how Cadi sounds — sign-off name, tone and more</p>
        </div>
        <button
          onClick={() => navigate('/settings?tab=agents')}
          className="shrink-0 flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition-colors"
          style={{ color: FD_SKY, border: `1px solid ${FD_BLUE}4d` }}
        >
          <Settings size={13} />
          Agents
        </button>
      </div>

      {/* What it looks like on your site — kept as a light mockup since it's
          simulating a real customer-facing webpage, not Cadi's own UI. */}
      <div className="rounded-2xl overflow-hidden" style={fdCard({ radius: 18 })}>
        <div className="px-6 py-4" style={{ borderBottom: `1px solid ${ON_DARK.line}` }}>
          <h3 className="font-bold text-white">What it looks like on your site</h3>
          <p className="text-xs mt-0.5" style={{ color: ON_DARK.faint }}>Floats in the bottom-right corner — always visible, never in the way</p>
        </div>
        <div className="relative bg-gray-50 m-4 rounded-xl overflow-hidden border border-gray-200" style={{ height: 210 }}>
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
            className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-xl transition-colors disabled:opacity-40"
            style={{ color: FD_SKY, border: `1px solid ${FD_BLUE}4d` }}
          >
            <Play size={13} />
            Open full preview — chat with it live
          </button>
        </div>
      </div>

      {/* Try Front Desk */}
      <div className="flex items-center justify-between gap-4 p-6" style={fdCard({ radius: 18 })}>
        <div>
          <p className="text-sm font-bold text-white">Try your Sales Manager</p>
          <p className="text-xs mt-0.5" style={{ color: ON_DARK.faint }}>See exactly what your customers will see — using your real services and pricing</p>
        </div>
        <button
          onClick={() => setShowPreview(true)}
          disabled={!businessId}
          className="shrink-0 flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-white rounded-xl hover:brightness-110 transition-all disabled:opacity-40"
          style={{ background: FD_BLUE }}
        >
          <Play size={13} />
          Preview
        </button>
      </div>

      {showPreview && <FrontDeskPreview onClose={() => setShowPreview(false)} />}
    </div>
  );
}
