/**
 * src/pages/TlSandboxConnect.jsx
 * Cadi — TrueLayer sandbox connect trigger (test/staging path)
 *
 * Route: /truelayer/connect
 * A deliberately minimal entry point to exercise the TrueLayer Data (AIS)
 * integration end-to-end against TrueLayer's SANDBOX (mock banks). It calls
 * `truelayer-auth { action: 'url' }` and redirects into the TrueLayer consent
 * screen. The production/customer flow stays on Yapily (/banking/connect) until
 * TrueLayer production go-live; this page is how we prove the integration works
 * before that switch.
 *
 * Requires a signed-in Pro/Max account — `truelayer-auth` gates `url` on
 * isPaidTier(), same as the Yapily flow.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const BG =
  'min-h-screen bg-gradient-to-br from-[#0a0f1e] via-[#0d1530] to-[#0a1628] flex items-center justify-center p-4';
const CARD =
  'bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 max-w-sm w-full shadow-2xl';

export default function TlSandboxConnect() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function connect() {
    setLoading(true);
    setError('');
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error('Please sign in first, then come back to this page.');

      const { data, error: fnErr } = await supabase.functions.invoke('truelayer-auth', {
        body: { action: 'url' },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (fnErr) throw new Error(fnErr.message);
      if (data?.error) throw new Error(data.error);
      if (!data?.url)
        throw new Error('Could not get authorisation URL — check TL_CLIENT_ID is set.');

      window.location.href = data.url;
    } catch (err) {
      setError(err.message ?? 'Something went wrong — please try again.');
      setLoading(false);
    }
  }

  return (
    <div className={BG}>
      <div className={CARD}>
        <div className="text-xs font-semibold tracking-widest text-white/40 uppercase mb-6">
          Open Banking · TrueLayer (sandbox)
        </div>

        <h1 className="text-white font-black text-xl leading-tight mb-2">Connect a test bank</h1>
        <p className="text-white/50 text-sm mb-6 leading-relaxed">
          This runs the real TrueLayer Data (AIS) flow against their sandbox mock banks — read-only,
          no real account. Use it to verify the integration end to end before production go-live.
        </p>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        <button
          onClick={connect}
          disabled={loading}
          className="w-full py-4 rounded-xl bg-[#4f78ff] hover:bg-[#3d68ff] disabled:opacity-50 text-white font-black text-base transition-colors"
        >
          {loading ? 'Opening TrueLayer…' : 'Connect via TrueLayer'}
        </button>
        <button
          onClick={() => navigate('/dashboard')}
          className="w-full mt-2 py-2.5 text-sm text-white/40 hover:text-white/60 font-semibold transition-colors"
        >
          ← Back to dashboard
        </button>
      </div>
    </div>
  );
}
