import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import CadiWordmark from '../../components/CadiWordmark';

export default function Confirm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const goToCheckout = searchParams.get('checkout') === '1' || localStorage.getItem('pendingCheckout') === '1';
  const [status, setStatus] = useState('confirming'); // confirming | error

  useEffect(() => {
    // Supabase automatically processes the session from the URL hash on load.
    // We just need to wait for a valid session, then act.
    let attempts = 0;

    async function tryRedirect() {
      const { data: { session } } = await supabase.auth.getSession();

      if (session) {
        if (goToCheckout) {
          try {
            const { data, error } = await supabase.functions.invoke('create-checkout', {
              body: { returnUrl: window.location.origin },
            });
            if (error) throw error;
            if (data?.url) {
              localStorage.removeItem('pendingCheckout');
              window.location.href = data.url;
              return;
            }
            throw new Error('No checkout URL');
          } catch {
            // Checkout failed — send them to Settings to subscribe manually
            navigate('/settings?checkout_error=1', { replace: true });
          }
        } else {
          navigate('/dashboard', { replace: true });
        }
        return;
      }

      // Session not ready yet — retry a few times (Supabase processes the hash async)
      attempts++;
      if (attempts < 10) {
        setTimeout(tryRedirect, 400);
      } else {
        setStatus('error');
      }
    }

    tryRedirect();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-[#010a4f] flex items-center justify-center px-4">
      <div className="text-center">
        <div className="flex justify-center mb-6">
          <CadiWordmark height={32} />
        </div>
        {status === 'confirming' ? (
          <>
            <div className="w-8 h-8 border-2 border-[#99c5ff] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-white font-semibold">Confirming your email…</p>
            <p className="text-[rgba(153,197,255,0.5)] text-sm mt-1">
              {goToCheckout ? 'Taking you to payment…' : 'Just a moment…'}
            </p>
          </>
        ) : (
          <>
            <p className="text-white font-semibold mb-2">Something went wrong</p>
            <p className="text-[rgba(153,197,255,0.5)] text-sm mb-4">
              Your link may have expired. Try signing in, or contact{' '}
              <a href="mailto:support@cadi.cleaning" className="underline">support@cadi.cleaning</a>.
            </p>
            <button
              onClick={() => navigate('/login')}
              className="px-6 py-2.5 bg-[#1f48ff] text-white text-sm font-bold rounded-xl"
            >
              Go to login
            </button>
          </>
        )}
      </div>
    </div>
  );
}
