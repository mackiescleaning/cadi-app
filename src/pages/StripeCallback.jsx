/**
 * src/pages/StripeCallback.jsx
 * Cadi — Stripe Connect OAuth callback
 *
 * Stripe redirects here after a business owner authorises their Stripe account:
 *   https://app.cadi.cleaning/stripe/callback?code=XXXX&state=YYYY
 *
 * Route is OUTSIDE <ProtectedRoute> in App.js (same pattern as other callbacks).
 */

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const BG   = 'min-h-screen bg-gradient-to-br from-[#0a0f1e] via-[#0d1530] to-[#0a1628] flex items-center justify-center p-4';
const CARD = 'bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl';

function Spinner() {
  return (
    <svg className="animate-spin h-10 w-10 text-[#635BFF] mx-auto mb-4" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
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
    <div className="w-14 h-14 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center mx-auto mb-4">
      <svg className="w-7 h-7 text-red-400" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </div>
  );
}

function CancelIcon() {
  return (
    <div className="w-14 h-14 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center mx-auto mb-4">
      <svg className="w-7 h-7 text-amber-400" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      </svg>
    </div>
  );
}

const RETURN_PATH = '/settings/invoice';

export default function StripeCallback() {
  const [searchParams] = useSearchParams();
  const navigate       = useNavigate();
  const [phase, setPhase]   = useState('loading');
  const [detail, setDetail] = useState('');

  useEffect(() => {
    const code  = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error || (!code && !state)) {
      setPhase('denied');
      setDetail('You cancelled the Stripe connection.');
      setTimeout(() => navigate(RETURN_PATH, { replace: true }), 3000);
      return;
    }

    if (!code) {
      setPhase('error');
      setDetail('Missing authorisation code. Please try connecting again.');
      setTimeout(() => navigate(RETURN_PATH, { replace: true }), 4000);
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
        const { data, error: fnErr } = await supabase.functions.invoke('stripe-connect-auth', {
          body:    { action: 'callback', code, state },
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (fnErr) throw new Error(fnErr.message ?? 'stripe-connect-auth error');
        if (data?.error) throw new Error(data.error);
        return data;
      })
      .then(() => {
        setPhase('success');
        setTimeout(() => navigate(RETURN_PATH, { replace: true }), 2500);
      })
      .catch((err) => {
        setPhase('error');
        setDetail(err.message ?? 'Connection failed — please try again.');
        setTimeout(() => navigate(RETURN_PATH, { replace: true }), 4000);
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={BG}>
      <div className={CARD}>
        <div className="text-xs font-semibold tracking-widest text-white/40 uppercase mb-6">
          Stripe · Card Payments
        </div>

        {phase === 'loading' && (
          <>
            <Spinner />
            <h2 className="text-white font-semibold text-lg mb-2">Connecting Stripe…</h2>
            <p className="text-white/50 text-sm">Exchanging authorisation code.</p>
          </>
        )}

        {phase === 'success' && (
          <>
            <CheckIcon />
            <h2 className="text-white font-semibold text-lg mb-2">Stripe connected!</h2>
            <p className="text-white/50 text-sm">
              Your Stripe account is linked. Customers will now see a "Pay now" button on every invoice.
            </p>
          </>
        )}

        {phase === 'error' && (
          <>
            <ErrorIcon />
            <h2 className="text-white font-semibold text-lg mb-2">Connection failed</h2>
            <p className="text-white/50 text-sm mb-3">{detail}</p>
            <p className="text-white/30 text-xs">Redirecting you back…</p>
          </>
        )}

        {phase === 'denied' && (
          <>
            <CancelIcon />
            <h2 className="text-white font-semibold text-lg mb-2">Connection cancelled</h2>
            <p className="text-white/50 text-sm mb-3">{detail}</p>
            <p className="text-white/30 text-xs">Redirecting you back…</p>
          </>
        )}

        <div className="mt-6 h-0.5 bg-white/10 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-[2500ms] ease-linear ${
            phase === 'success' ? 'bg-green-400 w-full' :
            phase === 'loading' ? 'bg-[#635BFF] w-1/2 animate-pulse' :
            'bg-red-400 w-full'
          }`} />
        </div>
      </div>
    </div>
  );
}
