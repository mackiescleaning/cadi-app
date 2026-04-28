import { useState } from 'react';
import { supabase } from '../lib/supabase';
import CadiWordmark from './CadiWordmark';
import { X } from 'lucide-react';

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

// Full-page overlay modal — use for tab locks and hard limits
export function UpgradeModal({ onClose, reason }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleUpgrade = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('create-checkout', {
        body: { returnUrl: window.location.origin },
      });
      if (fnError) throw fnError;
      if (data?.url) window.location.href = data.url;
      else throw new Error('No checkout URL');
    } catch {
      setError('Could not open checkout. Please try again or contact support@cadi.cleaning');
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
              <span className="text-4xl font-black text-white">£29</span>
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
            {loading ? 'Opening checkout…' : 'Upgrade to Pro — £29/month'}
          </button>

          <p className="text-center text-[10px] text-white/25 mt-3">Powered by Stripe · Secure payment</p>
        </div>
      </div>
    </div>
  );
}

// Inline card — use inside pages when a feature is locked
export function UpgradeBanner({ reason, compact = false }) {
  const [loading, setLoading] = useState(false);

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke('create-checkout', {
        body: { returnUrl: window.location.origin },
      });
      if (data?.url) window.location.href = data.url;
    } catch {
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
          {loading ? 'Opening checkout…' : 'Upgrade to Pro — £29/month'}
        </button>
        <p className="text-[10px] text-white/25 mt-3">Cancel anytime · Powered by Stripe</p>
      </div>
    </div>
  );
}
