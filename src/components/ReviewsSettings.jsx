import { useEffect, useState } from 'react';
import { Save, ExternalLink, Mail } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useBusinessId } from '../hooks/useBusinessId';
import { loadAgentSettings, upsertAgentSettings, AGENT_MODES } from '../lib/agentFramework';
import { getBusinessSettings, upsertBusinessSettings } from '../lib/db/settingsDb';

const PLATFORMS = [
  { id: 'google', label: 'Google', hint: 'google.com/maps/…', icon: '🔍' },
  { id: 'trustpilot', label: 'Trustpilot', hint: 'trustpilot.com/review/…', icon: '⭐' },
  { id: 'facebook', label: 'Facebook', hint: 'facebook.com/…/reviews', icon: '👍' },
  { id: 'custom', label: 'Custom link', hint: 'https://…', icon: '🔗' },
];

const TIMING_OPTIONS = [
  { value: 0, label: 'Immediately' },
  { value: 1, label: '1 hour later' },
  { value: 2, label: '2 hours later' },
  { value: 24, label: 'Next day' },
];

const DEFAULT_TEMPLATE = `Hi {{name}}, thank you so much for having us over — it was a pleasure. If you have a spare minute, we'd really appreciate a quick review. It means the world to a small business like ours 🙏`;

function EmailPreview({ businessName, template, reviewLink, customerName = 'Jane' }) {
  const message = template.replace(/{{name}}/g, customerName);
  return (
    <div className="rounded-xl border border-[#99c5ff]/20 overflow-hidden text-sm">
      <div className="bg-[#010a4f] px-4 py-3 text-xs text-[#99c5ff] font-mono">
        Subject: How did we do, {customerName}?
      </div>
      <div className="bg-white p-5 space-y-4">
        <div className="bg-[#010a4f] rounded-xl px-5 py-4">
          <p className="text-white font-black text-base">{businessName || 'Your Business'}</p>
        </div>
        <p className="text-gray-700 leading-relaxed text-sm">{message}</p>
        <div>
          <span className="inline-block px-5 py-3 rounded-xl bg-[#1f48ff] text-white font-bold text-sm">
            ⭐ Leave us a review
          </span>
          {reviewLink && (
            <p className="mt-1 text-[10px] text-gray-400 font-mono truncate">{reviewLink}</p>
          )}
        </div>
        <p className="text-[10px] text-gray-400 border-t border-gray-100 pt-3">
          Sent via Cadi · You received this because you recently had a service from{' '}
          {businessName || 'us'}.
        </p>
      </div>
    </div>
  );
}

export default function ReviewsSettings() {
  const { profile } = useAuth();
  const businessId = useBusinessId();

  const [platform, setPlatform] = useState('google');
  const [link, setLink] = useState('');
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE);
  const [timing, setTiming] = useState(2);
  const [mode, setMode] = useState('approval');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showPreview, setShowPreview] = useState(false);

  const { user } = useAuth();
  const businessName =
    profile?.brand_voice?.business_name ||
    profile?.business_name ||
    profile?.display_name ||
    'Your Business';

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const settings = await getBusinessSettings();
        const sd = settings?.setup_data ?? {};
        if (sd.review_platform) setPlatform(sd.review_platform);
        if (sd.review_link) setLink(sd.review_link);
        if (sd.review_message_template) setTemplate(sd.review_message_template);
        if (sd.review_timing_hours != null) setTiming(sd.review_timing_hours);

        if (businessId) {
          const agentData = await loadAgentSettings(businessId, 'reviews');
          if (agentData?.mode) setMode(agentData.mode);
        }
      } catch {
        /* no session in demo — use defaults */
      }
      setLoading(false);
    })();
  }, [user, businessId]);

  async function handleSave() {
    if (!businessId) return;
    setSaving(true);
    const existing = await getBusinessSettings();
    const sd = existing?.setup_data ?? {};
    await Promise.all([
      upsertBusinessSettings({
        setup_data: {
          ...sd,
          review_platform: platform,
          review_link: link.trim(),
          review_message_template: template,
          review_timing_hours: timing,
        },
      }),
      upsertAgentSettings(businessId, 'reviews', mode),
    ]);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-24 rounded-2xl bg-white border border-[#99c5ff]/20 animate-pulse"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Agent mode */}
      <div className="bg-white rounded-2xl shadow-sm border border-[#99c5ff]/20 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="font-bold text-[#010a4f]">Reviews agent</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Automatically sends a review request to customers when a job is marked complete.
          </p>
        </div>
        <div className="px-6 py-4">
          <label className="block text-xs font-semibold text-gray-500 mb-1.5">Mode</label>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#1f48ff]"
          >
            {Object.entries(AGENT_MODES).map(([val, { label, desc }]) => (
              <option key={val} value={val}>
                {label} — {desc}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Platform */}
      <div className="bg-white rounded-2xl shadow-sm border border-[#99c5ff]/20 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="font-bold text-[#010a4f]">Review platform</h3>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {PLATFORMS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPlatform(p.id)}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-center ${
                  platform === p.id
                    ? 'border-[#1f48ff] bg-[#f0f4ff]'
                    : 'border-gray-100 bg-white hover:border-[#99c5ff]/40'
                }`}
              >
                <span className="text-xl">{p.icon}</span>
                <span
                  className={`text-xs font-bold ${platform === p.id ? 'text-[#1f48ff]' : 'text-gray-600'}`}
                >
                  {p.label}
                </span>
              </button>
            ))}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">
              Your review link
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder={PLATFORMS.find((p) => p.id === platform)?.hint ?? 'https://…'}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#1f48ff] focus:ring-2 focus:ring-[#1f48ff]/10 font-mono"
              />
              {link && (
                <a
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 flex items-center gap-1.5 px-3 py-2.5 text-xs font-bold text-[#1f48ff] border border-[#1f48ff]/30 rounded-xl hover:bg-[#1f48ff]/5 transition-colors"
                >
                  <ExternalLink size={12} />
                  Test
                </a>
              )}
            </div>
            {platform === 'google' && (
              <p className="text-[11px] text-gray-400 mt-1.5">
                Find your link at Google Business Profile → Get more reviews → Copy link
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Message template */}
      <div className="bg-white rounded-2xl shadow-sm border border-[#99c5ff]/20 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="font-bold text-[#010a4f]">Message template</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Use{' '}
            <code className="font-mono text-[#1f48ff] bg-[#f0f4ff] px-1 rounded">{'{{name}}'}</code>{' '}
            for the customer's first name.
          </p>
        </div>
        <div className="p-6 space-y-4">
          <textarea
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            rows={4}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#1f48ff] focus:ring-2 focus:ring-[#1f48ff]/10 resize-none leading-relaxed"
          />
          <button
            onClick={() => setShowPreview((v) => !v)}
            className="flex items-center gap-2 text-xs font-bold text-[#1f48ff] hover:underline"
          >
            <Mail size={12} />
            {showPreview ? 'Hide' : 'Preview'} email
          </button>
          {showPreview && (
            <EmailPreview businessName={businessName} template={template} reviewLink={link} />
          )}
        </div>
      </div>

      {/* Timing */}
      <div className="bg-white rounded-2xl shadow-sm border border-[#99c5ff]/20 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="font-bold text-[#010a4f]">Send timing</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            How long after a job is marked complete to send the request.
          </p>
        </div>
        <div className="px-6 py-4">
          <div className="flex gap-2 flex-wrap">
            {TIMING_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setTiming(opt.value)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  timing === opt.value
                    ? 'bg-[#1f48ff] text-white'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {timing > 0 && (
            <p className="text-[11px] text-gray-400 mt-2">
              Note: delayed sending requires a scheduled background job. For now Cadi will queue the
              request for manual approval at the right time.
            </p>
          )}
        </div>
      </div>

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-2 px-6 py-3 bg-[#1f48ff] text-white text-sm font-bold rounded-xl hover:bg-[#010a4f] transition-colors disabled:opacity-50"
      >
        {saved ? (
          <>✓ Saved</>
        ) : (
          <>
            <Save size={14} /> {saving ? 'Saving…' : 'Save Reviews settings'}
          </>
        )}
      </button>
    </div>
  );
}
