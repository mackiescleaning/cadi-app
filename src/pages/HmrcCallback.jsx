/**
 * src/pages/HmrcCallback.jsx
 * Cadi — HMRC OAuth 2.0 redirect landing page
 *
 * HMRC redirects here after the user grants permission:
 *   https://app.cadi.co.uk/hmrc/callback?code=XXXX&state=YYYY
 *
 * This page:
 *   1. Reads ?code and ?state from the URL
 *   2. Calls the hmrc-auth Edge Function (action: "callback")
 *   3. Shows success / error feedback
 *   4. Redirects back to /accounts after 2s
 *
 * Route is registered OUTSIDE <ProtectedRoute> in App.js because the OAuth
 * redirect arrives before the user's session may be fully restored.
 * However, the Edge Function still requires a valid JWT — Supabase Auth restores
 * the session from localStorage, which should be present since the user was
 * already logged in when they started the OAuth flow.
 */

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { exchangeHmrcCode } from '../lib/db/hmrcDb';

// ─── Glassmorphism tokens (matches the rest of the app) ───────────────────────
const BG   = 'min-h-screen bg-gradient-to-br from-[#0a0f1e] via-[#0d1530] to-[#0a1628] flex items-center justify-center p-4';
const CARD = 'bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl';

// Spinner SVG
function Spinner() {
  return (
    <svg className="animate-spin h-10 w-10 text-blue-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path  className="opacity-75" fill="currentColor"
             d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// Checkmark SVG
function CheckIcon() {
  return (
    <div className="w-14 h-14 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center mx-auto mb-4">
      <svg className="w-7 h-7 text-green-400" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    </div>
  );
}

// X icon
function ErrorIcon() {
  return (
    <div className="w-14 h-14 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center mx-auto mb-4">
      <svg className="w-7 h-7 text-red-400" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </div>
  );
}

// ─── States ───────────────────────────────────────────────────────────────────
const STATES = {
  loading:  'loading',
  success:  'success',
  error:    'error',
  denied:   'denied',
  invalid:  'invalid',
};

export default function HmrcCallback() {
  const [searchParams] = useSearchParams();
  const navigate       = useNavigate();
  const [phase, setPhase]   = useState(STATES.loading);
  const [detail, setDetail] = useState('');

  useEffect(() => {
    const code  = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDesc = searchParams.get('error_description');

    // ── HMRC denied (user clicked "Deny" on HMRC consent screen) ────────────
    if (error === 'access_denied' || (!code && !state)) {
      setPhase(STATES.denied);
      setDetail(errorDesc ?? 'You cancelled the HMRC authorisation.');
      setTimeout(() => navigate('/accounts', { replace: true }), 3000);
      return;
    }

    if (!code || !state) {
      setPhase(STATES.invalid);
      setDetail('Missing authorisation code. Please try connecting again.');
      setTimeout(() => navigate('/accounts', { replace: true }), 3000);
      return;
    }

    // ── Exchange code for tokens ──────────────────────────────────────────────
    exchangeHmrcCode(code, state)
      .then(() => {
        setPhase(STATES.success);
        setTimeout(() => navigate('/accounts', { replace: true }), 2000);
      })
      .catch((err) => {
        setPhase(STATES.error);
        setDetail(err.message ?? 'Token exchange failed — please try again.');
        setTimeout(() => navigate('/accounts', { replace: true }), 4000);
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className={BG}>
      <div className={CARD}>

        {/* HMRC logo-ish badge */}
        <div className="text-xs font-semibold tracking-widest text-white/40 uppercase mb-6">
          HMRC · Making Tax Digital
        </div>

        {phase === STATES.loading && (
          <>
            <Spinner />
            <h2 className="text-white font-semibold text-lg mb-2">Connecting to HMRC…</h2>
            <p className="text-white/50 text-sm">Exchanging authorisation code for tokens.</p>
          </>
        )}

        {phase === STATES.success && (
          <>
            <CheckIcon />
            <h2 className="text-white font-semibold text-lg mb-2">Connected!</h2>
            <p className="text-white/50 text-sm">
              Your HMRC account is now linked. Redirecting you back to Accounts…
            </p>
          </>
        )}

        {(phase === STATES.error || phase === STATES.invalid) && (
          <>
            <ErrorIcon />
            <h2 className="text-white font-semibold text-lg mb-2">Connection failed</h2>
            <p className="text-white/50 text-sm mb-3">{detail}</p>
            <p className="text-white/30 text-xs">Redirecting you back in a moment…</p>
          </>
        )}

        {phase === STATES.denied && (
          <>
            <div className="w-14 h-14 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-amber-400" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
            </div>
            <h2 className="text-white font-semibold text-lg mb-2">Authorisation cancelled</h2>
            <p className="text-white/50 text-sm mb-3">{detail}</p>
            <p className="text-white/30 text-xs">Redirecting you back to Accounts…</p>
          </>
        )}

        {/* Progress bar */}
        <div className="mt-6 h-0.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-[2000ms] ease-linear ${
              phase === STATES.success ? 'bg-green-400 w-full' :
              phase === STATES.loading ? 'bg-blue-400 w-1/2 animate-pulse' :
              'bg-red-400 w-full'
            }`}
          />
        </div>

      </div>
    </div>
  );
}
