import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import MarketplaceWaitlistForm from '../components/MarketplaceWaitlistForm';
import PublicProfilePreview from '../components/PublicProfilePreview';

const EARN_ORANGE = '#C2410C';

export default function EarnLanding() {
  const { user, profile } = useAuth();
  const [showWaitlist, setShowWaitlist]         = useState(false);
  const [alreadyOptedIn, setAlreadyOptedIn]     = useState(false);
  const [checkingStatus, setCheckingStatus]     = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('marketplace_interest')
        .eq('id', user.id)
        .single();
      setAlreadyOptedIn(data?.marketplace_interest === true);
      setCheckingStatus(false);
    })();
  }, [user]);

  return (
    <div className="max-w-2xl mx-auto space-y-10 pb-16">

      {/* Hero */}
      <div className="rounded-2xl overflow-hidden text-center px-8 py-12"
        style={{ background: 'linear-gradient(135deg, #010a4f 0%, #1a0a00 100%)' }}>
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-4 text-xs font-black tracking-widest uppercase"
          style={{ backgroundColor: EARN_ORANGE + '22', color: EARN_ORANGE }}>
          Coming Soon
        </div>
        <h1 className="text-3xl font-black text-white mb-3 leading-tight">
          Connect.
        </h1>
        <p className="text-[#99c5ff]/70 text-base leading-relaxed max-w-lg mx-auto">
          The Cadi marketplace connects you to FM aggregators across the UK who need reliable subcontractors.
          Founding 200 members get first access.
        </p>

        {!checkingStatus && (
          alreadyOptedIn ? (
            <div className="mt-6 inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold"
              style={{ backgroundColor: EARN_ORANGE + '22', color: EARN_ORANGE }}>
              <span>✓</span> You're on the waitlist — we'll be in touch first
            </div>
          ) : (
            <button
              onClick={() => setShowWaitlist(true)}
              className="mt-6 px-7 py-3.5 rounded-xl text-white font-black text-sm transition-all hover:brightness-110 shadow-lg"
              style={{ backgroundColor: EARN_ORANGE }}
            >
              Join the marketplace waitlist
            </button>
          )
        )}
      </div>

      {/* The flywheel */}
      <div>
        <h2 className="text-sm font-black text-[#010a4f] uppercase tracking-widest mb-4">How it works</h2>
        <div className="space-y-3">
          {[
            {
              step: '1',
              title: 'Run your business well',
              desc: 'Log jobs, send invoices, track mileage. Every action builds your Cadi profile.',
              tab: 'Run tab',
              color: '#4f78ff',
            },
            {
              step: '2',
              title: 'Grow your Cadi score',
              desc: 'Hit targets, maintain compliance, grow your customer base. Your score reflects your reliability.',
              tab: 'Grow tab',
              color: '#059669',
            },
            {
              step: '3',
              title: 'Connect to more work',
              desc: 'Cadi matches you to FM jobs based on your score, location, and services. You get paid more, faster.',
              tab: 'Connect tab',
              color: EARN_ORANGE,
            },
          ].map(({ step, title, desc, tab, color }) => (
            <div key={step} className="flex gap-4 p-5 rounded-2xl bg-white border border-[#99c5ff]/20 shadow-sm">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-black shrink-0"
                style={{ backgroundColor: color }}>
                {step}
              </div>
              <div>
                <p className="font-bold text-[#010a4f] text-sm">{title}</p>
                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{desc}</p>
                <span className="inline-block mt-2 text-[10px] font-black tracking-wider px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: color + '15', color }}>
                  {tab}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Public profile preview */}
      <div>
        <h2 className="text-sm font-black text-[#010a4f] uppercase tracking-widest mb-1">
          What FMs will see about you
        </h2>
        <p className="text-xs text-gray-400 mb-4">This is your live profile — improve your score to move up the rankings.</p>
        <PublicProfilePreview />
      </div>

      {/* Waitlist modal */}
      {showWaitlist && (
        <MarketplaceWaitlistForm
          onClose={() => setShowWaitlist(false)}
          onSuccess={() => { setAlreadyOptedIn(true); setShowWaitlist(false); }}
        />
      )}
    </div>
  );
}
