import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CadiWordmark from '../CadiWordmark';

const FEATURES = [
  'Unlimited customers',
  'Invoicing + payment tracking',
  'Scheduler + route planner',
  'Money tracker + P&L',
  'HMRC MTD submissions',
  'Staff management + training',
  'Business Lab tools',
  'Annual review + 90-day sprints',
];

export default function ProUpgradePage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubscribe = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('create-checkout', {
        body: { returnUrl: window.location.origin },
      });
      if (fnError) throw fnError;
      if (data?.url) window.location.href = data.url;
      else throw new Error('No checkout URL returned');
    } catch {
      setError('Could not start checkout. Please try again or contact support@cadi.cleaning');
      setLoading(false);
    }
  };

  if (profile?.plan === 'pro') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#010a4f] via-[#05124a] to-[#0d1e78] flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <p className="text-5xl mb-4">✓</p>
          <h1 className="text-2xl font-black text-white mb-2">You're subscribed</h1>
          <p className="text-[rgba(153,197,255,0.6)] text-sm mb-6">You have full access to everything in Cadi.</p>
          <button onClick={() => navigate('/dashboard')} className="px-6 py-3 bg-[#1f48ff] text-white font-bold rounded-xl hover:bg-[#3a5eff] transition-colors">
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#010a4f] via-[#05124a] to-[#0d1e78] relative flex items-center justify-center px-4">
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{ backgroundImage: "linear-gradient(rgba(153,197,255,0.5) 1px,transparent 1px),linear-gradient(90deg,rgba(153,197,255,0.5) 1px,transparent 1px)", backgroundSize: "32px 32px" }} />

      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <CadiWordmark height={32} className="mx-auto mb-6" />
          <h1 className="text-2xl font-black text-white mb-2">Subscribe to Cadi</h1>
          <p className="text-[rgba(153,197,255,0.6)] text-sm">Everything you need to run your cleaning business.</p>
        </div>

        <div className="rounded-2xl border-2 border-[#1f48ff] p-6 relative overflow-hidden"
          style={{ background: 'linear-gradient(145deg, #0d1e78 0%, #1a2d8f 50%, #0d1e78 100%)' }}>
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#99c5ff] to-transparent" />

          <div className="flex items-baseline gap-1 mb-1">
            <span className="text-4xl font-black text-white">£29</span>
            <span className="text-[rgba(153,197,255,0.5)] text-sm">/month</span>
          </div>
          <p className="text-[rgba(153,197,255,0.4)] text-xs mb-6">Cancel anytime · Powered by Stripe</p>

          <ul className="space-y-2.5 mb-6">
            {FEATURES.map(f => (
              <li key={f} className="flex items-center gap-2 text-sm text-white/80">
                <span className="text-[#99c5ff] shrink-0">✓</span>
                {f}
              </li>
            ))}
          </ul>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/15 border border-red-500/25 text-xs text-red-300">{error}</div>
          )}

          <button
            onClick={handleSubscribe}
            disabled={loading}
            className="w-full py-4 bg-[#1f48ff] hover:bg-[#3a5eff] text-white font-black text-sm rounded-xl transition-all shadow-lg shadow-[#1f48ff]/40 disabled:opacity-50"
          >
            {loading ? 'Opening checkout…' : 'Subscribe — £29/month'}
          </button>
          <p className="text-center text-[10px] text-[rgba(153,197,255,0.3)] mt-3">
            Questions? <a href="mailto:support@cadi.cleaning" className="underline hover:text-[rgba(153,197,255,0.6)]">support@cadi.cleaning</a>
          </p>
        </div>
      </div>
    </div>
  );
}
