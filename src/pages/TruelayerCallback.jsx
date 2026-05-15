/**
 * src/pages/TruelayerCallback.jsx
 * Cadi — TrueLayer Open Banking OAuth callback (Phase 2)
 *
 * Route: /truelayer/callback (outside ProtectedRoute in App.js)
 */

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const BG   = 'min-h-screen bg-gradient-to-br from-[#0a0f1e] via-[#0d1530] to-[#0a1628] flex items-center justify-center p-4';
const CARD = 'bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl';

function Spinner() {
  return <div className="w-14 h-14 rounded-full border-2 border-[#4f78ff]/20 border-t-[#4f78ff] animate-spin mx-auto mb-4" />;
}

function CheckIcon() {
  return (
    <div className="w-14 h-14 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center mx-auto mb-4">
      <svg className="w-7 h-7 text-green-400" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    </div>
  );
}

function ErrorIcon() {
  return (
    <div className="w-14 h-14 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center mx-auto mb-4">
      <svg className="w-7 h-7 text-amber-400" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </div>
  );
}

export default function TruelayerCallback() {
  const [searchParams] = useSearchParams();
  const navigate       = useNavigate();
  const [phase, setPhase]       = useState('loading');
  const [detail, setDetail]     = useState('');
  const [bankName, setBankName] = useState('');
  const [last4, setLast4]       = useState('');

  useEffect(() => {
    const code  = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error || (!code && !state)) {
      setPhase('cancelled');
      return;
    }

    if (!code) {
      setPhase('error');
      setDetail('Missing authorisation code. Please try connecting again.');
      return;
    }

    supabase.auth.refreshSession()
      .then(async ({ data: { session } }) => {
        if (!session) {
          const { data: stored } = await supabase.auth.getSession();
          if (!stored.session) throw new Error('Session expired — please sign in and try again.');
          return stored.session;
        }
        return session;
      })
      .then(async (session) => {
        const { data, error: fnErr } = await supabase.functions.invoke('truelayer-auth', {
          body:    { action: 'callback', code, state },
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (fnErr) throw new Error(fnErr.message ?? 'Connection failed');
        if (data?.error) throw new Error(data.error);

        setBankName(data.bankName ?? '');
        setLast4(data.accountLast4 ?? '');

        // Kick off background sync (fire and forget — analysis triggered inside)
        supabase.functions.invoke('truelayer-api', {
          body:    { action: 'sync' },
          headers: { Authorization: `Bearer ${session.access_token}` },
        }).catch(() => {});

        return data;
      })
      .then(() => setPhase('success'))
      .catch((err) => {
        setPhase('error');
        setDetail(err.message ?? 'Connection failed — please try again.');
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={BG}>
      <div className={CARD}>
        <div className="text-xs font-semibold tracking-widest text-white/40 uppercase mb-6">
          Open Banking · TrueLayer
        </div>

        {phase === 'loading' && (
          <>
            <Spinner />
            <h2 className="text-white font-semibold text-lg mb-2">Connecting your bank…</h2>
            <p className="text-white/50 text-sm">Exchanging authorisation with TrueLayer.</p>
            <div className="mt-6 h-0.5 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-[#4f78ff] w-1/2 animate-pulse" />
            </div>
          </>
        )}

        {phase === 'success' && (
          <>
            <CheckIcon />
            <h2 className="text-white font-semibold text-lg mb-2">You're connected. 🎉</h2>
            <p className="text-white/50 text-sm mb-5">
              {bankName
                ? <>Cadi can now see transactions from your <span className="text-white font-semibold">{bankName}</span>{last4 ? ` account ending ${last4}` : ''}. </>
                : 'Your bank account is linked. '
              }
              I'm starting the analysis now — takes a few minutes. I'll let you know when I've got something to show you.
            </p>
            <button
              onClick={() => navigate('/dashboard', { replace: true })}
              className="w-full py-3 rounded-xl bg-[#4f78ff] hover:bg-[#3d68ff] text-white font-bold text-sm transition-colors"
            >
              Back to dashboard
            </button>
          </>
        )}

        {(phase === 'error' || phase === 'cancelled') && (
          <>
            <ErrorIcon />
            <h2 className="text-white font-semibold text-lg mb-2">Looks like that didn't connect.</h2>
            <p className="text-white/50 text-sm mb-5">
              {detail || 'No drama — happens occasionally. Most likely you closed the bank window, or something timed out. The financial walkthrough needs your bank connected to work.'}
            </p>
            <div className="space-y-2">
              <button
                onClick={() => navigate('/banking/connect', { replace: true })}
                className="w-full py-3 rounded-xl bg-[#4f78ff] hover:bg-[#3d68ff] text-white font-bold text-sm transition-colors"
              >
                Try again
              </button>
              <button
                onClick={() => navigate('/dashboard', { replace: true })}
                className="w-full py-2.5 text-sm text-white/40 hover:text-white/60 transition-colors"
              >
                Skip for now
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
