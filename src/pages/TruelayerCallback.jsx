import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function TruelayerCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('Connecting your bank account…');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code   = params.get('code');
    const state  = params.get('state');
    const error  = params.get('error');

    if (error || !code) {
      setStatus('Bank connection cancelled.');
      setTimeout(() => navigate('/money'), 2000);
      return;
    }

    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const { data, error: fnErr } = await supabase.functions.invoke('truelayer-auth', {
          body: { action: 'callback', code, state },
          headers: { Authorization: `Bearer ${session?.access_token}` },
        });
        if (fnErr || data?.error) throw new Error(data?.error ?? fnErr?.message);
        setStatus('Bank connected! Importing transactions…');
        // Trigger first sync
        await supabase.functions.invoke('truelayer-api', {
          body: { action: 'sync' },
          headers: { Authorization: `Bearer ${session?.access_token}` },
        });
        setStatus('All done!');
        setTimeout(() => navigate('/money'), 1500);
      } catch (e) {
        setStatus(`Connection failed: ${e.message}`);
        setTimeout(() => navigate('/money'), 3000);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-[#010a4f] flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="w-12 h-12 border-2 border-[#99c5ff] border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-white font-bold">{status}</p>
      </div>
    </div>
  );
}
