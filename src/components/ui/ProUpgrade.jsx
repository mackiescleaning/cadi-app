import { useAuth } from '../../context/AuthContext';
import { usePlan } from '../../hooks/usePlan';
import { supabase } from '../../lib/supabase';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CadiWordmark from '../CadiWordmark';

const FREE_FEATURES = [
  "Dashboard + health score",
  "Pricing calculator (all 3 sectors)",
  "Scheduler (day/week/month/quarter)",
  "20 residential/commercial customers",
  "50 exterior customers",
  "Inventory management",
  "Money tracker",
  "Invoice generator + email sending",
  "Route planner + mileage log",
  "Business Lab (6 tools)",
];

const PRO_FEATURES = [
  "Everything in Free, plus:",
  "Unlimited customers",
  "Accounts + HMRC MTD integration",
  "Staff management + training",
  "Annual review + 90-day sprints",
  "Open banking connection",
  "Priority support",
  "Early access to new features",
];

export default function ProUpgradePage() {
  const { user, profile } = useAuth();
  const { isPro, priceMonthly } = usePlan();
  const navigate = useNavigate();
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
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (err) {
      console.error('Checkout error:', err);
      setError('Could not start checkout. Please try again or contact support.');
      setLoading(false);
    }
  };

  if (isPro) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#010a4f] via-[#05124a] to-[#0d1e78] flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <span className="text-5xl mb-4 block">🎉</span>
          <h1 className="text-2xl font-black text-white mb-2">You're on Pro</h1>
          <p className="text-[rgba(153,197,255,0.6)] text-sm mb-6">You have access to everything Cadi has to offer.</p>
          <button onClick={() => navigate('/dashboard')} className="px-6 py-3 bg-[#1f48ff] text-white font-bold rounded-xl hover:bg-[#3a5eff] transition-colors">
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#010a4f] via-[#05124a] to-[#0d1e78] relative">
      {/* Grid texture */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{ backgroundImage: "linear-gradient(rgba(153,197,255,0.5) 1px,transparent 1px),linear-gradient(90deg,rgba(153,197,255,0.5) 1px,transparent 1px)", backgroundSize: "32px 32px" }} />

      <div className="relative max-w-4xl mx-auto px-4 py-12">

        {/* Hero */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-6"><CadiWordmark height={36} /></div>
          <h1 className="text-3xl sm:text-4xl font-black text-white mb-3">Unlock everything</h1>
          <p className="text-lg text-[rgba(153,197,255,0.6)] max-w-lg mx-auto">
            Go Pro and get unlimited customers, HMRC integration, staff management, and more.
          </p>
        </div>

        {/* Pricing cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">

          {/* Free */}
          <div className="rounded-2xl border border-[rgba(153,197,255,0.12)] p-6"
            style={{ background: 'linear-gradient(145deg, #05124a 0%, #0d1e78 100%)' }}>
            <div className="mb-6">
              <p className="text-[10px] font-bold tracking-widest uppercase text-[rgba(153,197,255,0.4)] mb-1">Current plan</p>
              <p className="text-2xl font-black text-white">Free</p>
              <p className="text-sm text-[rgba(153,197,255,0.5)] mt-1">£0/month — forever</p>
            </div>
            <ul className="space-y-2.5">
              {FREE_FEATURES.map(f => (
                <li key={f} className="flex items-start gap-2 text-sm text-[rgba(153,197,255,0.6)]">
                  <span className="text-emerald-400 shrink-0 mt-0.5">✓</span>
                  {f}
                </li>
              ))}
            </ul>
          </div>

          {/* Pro */}
          <div className="rounded-2xl border-2 border-[#1f48ff] p-6 relative overflow-hidden"
            style={{ background: 'linear-gradient(145deg, #0d1e78 0%, #1a2d8f 50%, #0d1e78 100%)' }}>
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#99c5ff] to-transparent" />
            <div className="absolute -top-20 -right-20 w-40 h-40 rounded-full bg-[#1f48ff]/20 blur-3xl pointer-events-none" />

            <div className="relative mb-6">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-[10px] font-bold tracking-widest uppercase text-[#99c5ff]">Recommended</p>
                <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-[#1f48ff] text-white">POPULAR</span>
              </div>
              <p className="text-2xl font-black text-white">Pro</p>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-3xl font-black text-white">£{priceMonthly}</span>
                <span className="text-sm text-[rgba(153,197,255,0.5)]">/month</span>
              </div>
            </div>

            <ul className="space-y-2.5 mb-8 relative">
              {PRO_FEATURES.map(f => (
                <li key={f} className="flex items-start gap-2 text-sm text-white/80">
                  <span className="text-[#99c5ff] shrink-0 mt-0.5">✓</span>
                  {f}
                </li>
              ))}
            </ul>

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/15 border border-red-500/25 text-xs text-red-300">
                {error}
              </div>
            )}

            <button
              onClick={handleUpgrade}
              disabled={loading}
              className="relative w-full py-4 bg-[#1f48ff] hover:bg-[#3a5eff] text-white font-black text-sm rounded-xl transition-all shadow-lg shadow-[#1f48ff]/40 disabled:opacity-50"
            >
              {loading ? 'Starting checkout...' : `Upgrade to Pro — £${priceMonthly}/month`}
            </button>
            <p className="text-center text-[10px] text-[rgba(153,197,255,0.3)] mt-3">Cancel anytime · Powered by Stripe</p>
          </div>
        </div>

        {/* FAQ */}
        <div className="text-center">
          <p className="text-xs text-[rgba(153,197,255,0.4)]">
            Questions? Email <a href="mailto:support@cadi.app" className="text-[#99c5ff] hover:text-white">support@cadi.app</a>
          </p>
        </div>
      </div>
    </div>
  );
}
