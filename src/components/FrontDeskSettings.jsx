import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, Check, MessageSquare, Settings, Play } from 'lucide-react';
import FrontDeskPreview from './FrontDeskPreview';
import { supabase } from '../lib/supabase';
import { useBusinessId } from '../hooks/useBusinessId';

const WIDGET_URL = 'https://widget.cadi.cleaning/widget.js';

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
      const [{ data: agentRow }, { count }, { data: lastConv }] = await Promise.all([
        supabase
          .from('agent_settings')
          .select('mode')
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
      if (agentRow) setEnabled(agentRow.mode !== 'off');
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
    await supabase
      .from('agent_settings')
      .upsert(
        { business_id: businessId, agent: 'front_desk', mode: val ? 'approval' : 'off' },
        { onConflict: 'business_id,agent' }
      );
    setSaving(false);
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
              <h3 className="font-bold text-[#010a4f]">Front Desk — web chat</h3>
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

      {/* Try Front Desk */}
      <div className="bg-white rounded-2xl shadow-sm border border-[#99c5ff]/20 p-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-[#010a4f]">Try Front Desk</p>
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
