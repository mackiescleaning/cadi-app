import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import CadiWordmark from '../../components/CadiWordmark';

export default function Confirm() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('confirming');

  useEffect(() => {
    let attempts = 0;

    async function tryRedirect() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate('/', { replace: true });
        return;
      }
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
            <p className="text-[rgba(153,197,255,0.5)] text-sm mt-1">Just a moment…</p>
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
