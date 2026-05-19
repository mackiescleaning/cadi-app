import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { usePlan } from '../hooks/usePlan';
import CadiWordmark from './CadiWordmark';
import { X, CheckCircle2, Sparkles, Users, BarChart3, CreditCard, Star, Zap, Shield } from 'lucide-react';

const PRO_FEATURES = [
  'Unlimited customers',
  'Money tracker, P&L & tax reserve',
  'HMRC MTD submissions',
  'Invoice chasing & payment links',
  'Open banking — auto-import transactions',
  'GoCardless direct debit & on-day payments',
  'Business Lab growth tools',
  'Staff management & training',
  'Annual review & 90-day sprint goals',
  'Full leaderboard & community',
];

// Extract a readable error message from a Supabase FunctionsHttpError
async function checkoutErrMsg(fnError) {
  try {
    const body = await fnError?.context?.json?.();
    if (body?.error) return body.error;
  } catch {}
  return fnError?.message ?? 'Unknown error';
}

// Full-page overlay modal — use for tab locks and hard limits
export function UpgradeModal({ onClose, reason }) {
  const { priceMonthly } = usePlan();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleUpgrade = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('create-checkout', {
        body: { tier: 'pro', returnUrl: window.location.origin },
      });
      if (fnError) {
        const msg = await checkoutErrMsg(fnError);
        console.error('create-checkout fnError:', msg);
        throw new Error(msg);
      }
      if (data?.url) window.location.href = data.url;
      else throw new Error(`No checkout URL returned. Response: ${JSON.stringify(data)}`);
    } catch (err) {
      console.error('checkout error:', err?.message);
      setError(err?.message || 'Could not open checkout. Please try again or contact support@cadi.cleaning');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: 'linear-gradient(145deg, #010a4f 0%, #05124a 50%, #0d1e78 100%)' }}>

        {/* Top shine */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#99c5ff]/60 to-transparent" />

        {/* Grid texture */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{ backgroundImage: 'linear-gradient(rgba(153,197,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(153,197,255,1) 1px,transparent 1px)', backgroundSize: '28px 28px' }} />

        <div className="relative p-6">
          {onClose && (
            <button onClick={onClose} className="absolute top-4 right-4 text-white/30 hover:text-white/70 transition-colors">
              <X size={18} />
            </button>
          )}

          <div className="flex justify-center mb-4">
            <CadiWordmark height={24} />
          </div>

          {reason && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-center">
              <p className="text-sm text-white/80">{reason}</p>
            </div>
          )}

          <div className="text-center mb-5">
            <div className="flex items-baseline justify-center gap-1 mb-1">
              <span className="text-4xl font-black text-white">£{priceMonthly || 39}</span>
              <span className="text-[rgba(153,197,255,0.5)] text-sm">/month</span>
            </div>
            <p className="text-[10px] text-white/30 uppercase tracking-widest">Cadi Pro · Cancel anytime</p>
          </div>

          <ul className="space-y-2 mb-5">
            {PRO_FEATURES.map(f => (
              <li key={f} className="flex items-center gap-2 text-sm text-white/70">
                <span className="text-[#99c5ff] shrink-0 text-xs">✓</span>
                {f}
              </li>
            ))}
          </ul>

          {error && (
            <p className="mb-3 text-xs text-red-300 text-center">{error}</p>
          )}

          <button
            onClick={handleUpgrade}
            disabled={loading}
            className="w-full py-3.5 bg-[#1f48ff] hover:bg-[#3a5eff] text-white font-black text-sm rounded-xl transition-all shadow-lg shadow-[#1f48ff]/40 disabled:opacity-50"
          >
            {loading ? 'Opening checkout…' : `Upgrade to Pro — £${priceMonthly || 39}/month`}
          </button>

          <p className="text-center text-[10px] text-white/25 mt-3">Powered by Stripe · Secure payment</p>
        </div>
      </div>
    </div>
  );
}

// Inline card — use inside pages when a feature is locked
export function UpgradeBanner({ reason, compact = false }) {
  const { priceMonthly } = usePlan();
  const [loading, setLoading] = useState(false);

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('create-checkout', {
        body: { tier: 'pro', returnUrl: window.location.origin },
      });
      if (fnError) {
        const msg = await checkoutErrMsg(fnError);
        console.error('create-checkout error:', msg);
        alert(`Checkout error: ${msg}`);
        setLoading(false);
        return;
      }
      if (data?.url) window.location.href = data.url;
      else { console.error('No URL in response:', data); setLoading(false); }
    } catch (err) {
      console.error('checkout error:', err?.message);
      setLoading(false);
    }
  };

  if (compact) {
    return (
      <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-[#010a4f]/5 border border-[#1f48ff]/20">
        <p className="text-xs text-gray-600">{reason || 'This feature requires Cadi Pro.'}</p>
        <button
          onClick={handleUpgrade}
          disabled={loading}
          className="shrink-0 px-3 py-1.5 bg-[#1f48ff] text-white text-xs font-black rounded-lg hover:bg-[#3a5eff] transition-colors disabled:opacity-50"
        >
          {loading ? '…' : 'Upgrade →'}
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl overflow-hidden border border-[#1f48ff]/20"
      style={{ background: 'linear-gradient(135deg, #010a4f 0%, #0d1e78 100%)' }}>
      <div className="px-6 py-8 text-center">
        <div className="text-3xl mb-3">🔒</div>
        <p className="text-base font-black text-white mb-1">Cadi Pro feature</p>
        <p className="text-sm text-white/50 mb-5">{reason || 'Upgrade to unlock this and everything else in Cadi Pro.'}</p>
        <button
          onClick={handleUpgrade}
          disabled={loading}
          className="px-6 py-3 bg-[#1f48ff] hover:bg-[#3a5eff] text-white font-black text-sm rounded-xl transition-all shadow-lg shadow-[#1f48ff]/40 disabled:opacity-50"
        >
          {loading ? 'Opening checkout…' : `Upgrade to Pro — £${priceMonthly || 39}/month`}
        </button>
        <p className="text-[10px] text-white/25 mt-3">Cancel anytime · Powered by Stripe</p>
      </div>
    </div>
  );
}

// ── Upgrade success modal — shown after Stripe checkout completes ──────────────
const PRO_UNLOCKED = [
  { icon: BarChart3,  label: 'Money tracker, P&L & tax reserve' },
  { icon: Shield,     label: 'HMRC MTD tax submissions' },
  { icon: CreditCard, label: 'Invoice chasing & GoCardless payments' },
  { icon: Users,      label: 'Staff management (up to 5 crew)' },
  { icon: Zap,        label: 'Front Desk AI web chat agent' },
  { icon: Star,       label: 'Unlimited review requests' },
];

export function UpgradeSuccessModal({ onClose }) {
  const [visible, setVisible] = useState(false);

  // Slight entrance delay so the animation feels intentional
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 60);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/70 backdrop-blur-sm transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}>
      <div
        className={`relative w-full max-w-md rounded-2xl overflow-hidden shadow-2xl transition-all duration-300 ${visible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}
        style={{ background: 'linear-gradient(145deg, #010a4f 0%, #05124a 50%, #0d1e78 100%)' }}
      >
        {/* Top shine */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#99c5ff]/70 to-transparent" />

        {/* Grid texture */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{ backgroundImage: 'linear-gradient(rgba(153,197,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(153,197,255,1) 1px,transparent 1px)', backgroundSize: '28px 28px' }} />

        <div className="relative p-6">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/30 hover:text-white/70 transition-colors"
          >
            <X size={18} />
          </button>

          {/* Header */}
          <div className="flex justify-center mb-5">
            <CadiWordmark height={22} />
          </div>

          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#1f48ff]/20 border border-[#1f48ff]/40 mb-4">
              <Sparkles size={28} className="text-[#99c5ff]" />
            </div>
            <h2 className="text-2xl font-black text-white mb-1">You're on Cadi Pro</h2>
            <p className="text-sm text-white/50">Everything's unlocked. Here's what you've got access to now.</p>
          </div>

          {/* Unlocked features */}
          <ul className="space-y-2.5 mb-6">
            {PRO_UNLOCKED.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-3">
                <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-[#1f48ff]/20 border border-[#1f48ff]/30 flex items-center justify-center">
                  <Icon size={13} className="text-[#99c5ff]" />
                </div>
                <span className="text-sm text-white/75">{label}</span>
                <CheckCircle2 size={14} className="ml-auto text-emerald-400 flex-shrink-0" />
              </li>
            ))}
          </ul>

          <button
            onClick={onClose}
            className="w-full py-3.5 bg-[#1f48ff] hover:bg-[#3a5eff] text-white font-black text-sm rounded-xl transition-all shadow-lg shadow-[#1f48ff]/40"
          >
            Start exploring Pro →
          </button>

          <p className="text-center text-[10px] text-white/25 mt-3">
            A confirmation email is on its way to you.
          </p>
        </div>
      </div>
    </div>
  );
}
