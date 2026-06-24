import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { acceptInvite } from '../lib/db/teamDb';

export default function InviteAccept() {
  const { token }   = useParams();
  const navigate    = useNavigate();
  const [searchParams] = useSearchParams();
  const isConnect   = searchParams.get('source') === 'connect';

  const [step, setStep]         = useState('loading'); // loading | otp_email | otp_sent | preview | accepting | done | error
  const [invite, setInvite]     = useState(null);
  const [bizName, setBizName]   = useState('');
  const [error, setError]       = useState('');
  const [email, setEmail]       = useState('');
  const [busy, setBusy]         = useState(false);

  // On mount: sign out any existing session so the new user gets their own account
  useEffect(() => {
    async function init() {
      // Always sign out first — invite links must not inherit the owner's session
      await supabase.auth.signOut();

      if (isConnect) {
        // Connect-source: look up via the Connect-specific function backed by sub_invitations.
        // Using raw fetch instead of supabase.functions.invoke() so the request doesn't carry
        // an x-client-info header — the function gateway's preflight rejects it.
        let data;
        try {
          const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/connect-invite-lookup`, {
            method:  'POST',
            headers: {
              'Content-Type':  'application/json',
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
              'apikey':        import.meta.env.VITE_SUPABASE_ANON_KEY,
            },
            body: JSON.stringify({ token }),
          });
          data = await res.json().catch(() => ({}));
          if (!res.ok || !data?.ok) {
            setStep('error');
            setError(data?.error || 'Invite not found or already used.');
            return;
          }
        } catch (err) {
          setStep('error');
          setError('Could not reach Cadi — please try again.');
          return;
        }
        setInvite(data);
        setEmail(data.email ?? '');
        setBizName(data.fm_name ?? 'an FM partner');
      } else {
        // Accountant/team-source: existing flow against account_members
        const { data, error: err } = await supabase.functions.invoke('invite-lookup', {
          body: { token },
        });
        if (err || !data || data.error) {
          setStep('error');
          setError(data?.error || 'Invite not found or already used.');
          return;
        }
        setInvite(data);
        setEmail(data.member_email);
        setBizName(data.business_name ?? 'your client');
      }

      setStep('otp_email');
    }
    init();
  }, [token, isConnect]);

  // After returning from magic link, user is now authenticated — proceed to accept
  useEffect(() => {
    supabase.auth.onAuthStateChange(async (event, session) => {
      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session && step === 'otp_sent') {
        setStep('preview');
      }
    });
  }, [step]);

  async function handleSendOtp(e) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const { error: err } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/invite/${token}${isConnect ? '?source=connect' : ''}`,
          shouldCreateUser: true,
        },
      });
      if (err) throw err;
      setStep('otp_sent');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleAccept() {
    setStep('accepting');
    try {
      if (isConnect) {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/connect-invite-accept`, {
          method:  'POST',
          headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'apikey':        import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ token }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      } else {
        await acceptInvite(token);
      }
      setStep('done');
    } catch (err) {
      setStep('error');
      setError(err.message);
    }
  }

  const roleLabel = invite?.role === 'bookkeeper' ? 'bookkeeper' : invite?.role === 'manager' ? 'manager' : 'accountant';
  const connectAccent = '#C2410C';

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        <div className="text-center mb-8">
          <span className="text-2xl font-black text-white tracking-tight">
            Cadi{isConnect && <span style={{ color: connectAccent }}> Connect</span>}
          </span>
        </div>

        <div className="bg-[#111118] border border-[rgba(153,197,255,0.12)] rounded-2xl p-8">

          {/* Loading */}
          {step === 'loading' && (
            <div className="text-center py-8">
              <div className="w-6 h-6 border-2 border-[#1f48ff] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-sm text-[rgba(153,197,255,0.5)]">Loading invite…</p>
            </div>
          )}

          {/* Error */}
          {step === 'error' && (
            <div className="text-center py-4">
              <div className="text-3xl mb-4">⚠️</div>
              <h2 className="text-lg font-black text-white mb-2">Invite unavailable</h2>
              <p className="text-sm text-[rgba(153,197,255,0.5)] mb-6">{error}</p>
              <button onClick={() => navigate('/')} className="text-sm font-black text-[#1f48ff] hover:underline">
                Go to Cadi →
              </button>
            </div>
          )}

          {/* Step 1: enter email, send magic link */}
          {step === 'otp_email' && invite && (
            <>
              <p className="text-xs font-bold uppercase tracking-widest mb-1"
                style={{ color: isConnect ? 'rgba(255,165,80,0.65)' : 'rgba(153,197,255,0.5)' }}>
                {isConnect ? 'Subcontractor invite' : 'Team invite'}
              </p>
              <h2 className="text-xl font-black text-white mb-2">{bizName} has invited you</h2>
              <p className="text-sm text-[rgba(153,197,255,0.5)] mb-6 leading-relaxed">
                {isConnect ? (
                  <>You've been invited to <strong className="text-white">{bizName}</strong> on Cadi Connect — how you'll receive jobs, complete work on site, and get paid. Enter your email for a one-time sign-in link — no password needed.</>
                ) : (
                  <>You've been invited as <strong className="text-white">{roleLabel}</strong> for {bizName}. Enter your email to receive a one-time sign-in link — no password needed.</>
                )}
              </p>
              <form onSubmit={handleSendOtp} className="space-y-3">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="Your email address"
                  className="w-full bg-[rgba(153,197,255,0.05)] border border-[rgba(153,197,255,0.12)] rounded-xl px-4 py-3 text-sm text-white placeholder-[rgba(153,197,255,0.3)] focus:outline-none focus:border-[#1f48ff]"
                />
                {error && <p className="text-xs text-red-400">{error}</p>}
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full py-3 rounded-xl text-white text-sm font-black transition-colors disabled:opacity-50"
                  style={{ background: isConnect ? connectAccent : '#1f48ff' }}>
                  {busy ? 'Sending…' : 'Send sign-in link →'}
                </button>
                <p className="text-[10px] text-center text-[rgba(153,197,255,0.4)] mt-2">
                  By continuing you agree to our{' '}
                  <Link to="/terms" target="_blank" className="text-[rgba(153,197,255,0.7)] hover:text-white underline">Terms</Link>
                  {' '}and{' '}
                  <Link to="/privacy" target="_blank" className="text-[rgba(153,197,255,0.7)] hover:text-white underline">Privacy Policy</Link>.
                </p>
              </form>
            </>
          )}

          {/* Step 2: check email */}
          {step === 'otp_sent' && (
            <div className="text-center py-4">
              <div className="text-4xl mb-4">📬</div>
              <h2 className="text-xl font-black text-white mb-2">Check your email</h2>
              <p className="text-sm text-[rgba(153,197,255,0.5)] leading-relaxed">
                We've sent a sign-in link to <strong className="text-white">{email}</strong>.
                Click it to continue — the link expires in 1 hour.
              </p>
              <button
                onClick={() => setStep('otp_email')}
                className="mt-6 text-xs text-[rgba(153,197,255,0.4)] hover:text-[rgba(153,197,255,0.7)] transition-colors">
                Wrong email? Go back
              </button>
            </div>
          )}

          {/* Step 3: confirm accept */}
          {step === 'preview' && invite && (
            <>
              <p className="text-xs font-bold uppercase tracking-widest mb-1"
                style={{ color: isConnect ? 'rgba(255,165,80,0.65)' : 'rgba(153,197,255,0.5)' }}>
                {isConnect ? 'Subcontractor invite' : 'Team invite'}
              </p>
              <h2 className="text-xl font-black text-white mb-2">
                {isConnect ? `Join ${bizName} on Cadi Connect?` : `Accept access to ${bizName}?`}
              </h2>
              <p className="text-sm text-[rgba(153,197,255,0.5)] mb-6 leading-relaxed">
                {isConnect ? (
                  <>Your account is free — <strong className="text-white">{bizName}</strong> is covering it. You'll see their jobs in the Connect tab inside Cadi.</>
                ) : (
                  <>You'll be added as <strong className="text-white">{roleLabel}</strong> for {bizName}. The business owner controls what you can view and change.</>
                )}
              </p>
              <div className="bg-[rgba(153,197,255,0.04)] border border-[rgba(153,197,255,0.08)] rounded-xl p-4 mb-6 space-y-2">
                {(isConnect ? [
                  { label: 'FM partner',  val: bizName },
                  { label: 'Your company', val: invite.company_name || '—' },
                  { label: 'Invited to',  val: invite.email || '—' },
                ] : [
                  { label: 'Business',  val: bizName },
                  { label: 'Your role', val: roleLabel.charAt(0).toUpperCase() + roleLabel.slice(1) },
                  { label: 'Invited to', val: invite.member_email },
                ]).map(({ label, val }) => (
                  <div key={label} className="flex justify-between text-sm">
                    <span className="text-[rgba(153,197,255,0.45)]">{label}</span>
                    <span className="font-black text-white">{val}</span>
                  </div>
                ))}
              </div>
              <button
                onClick={handleAccept}
                className="w-full py-3 rounded-xl text-white text-sm font-black transition-colors mb-3"
                style={{ background: isConnect ? connectAccent : '#1f48ff' }}>
                {isConnect ? 'Set up my account →' : 'Accept invite →'}
              </button>
              <button
                onClick={() => navigate('/')}
                className="w-full py-3 rounded-xl text-xs text-[rgba(153,197,255,0.4)] hover:text-[rgba(153,197,255,0.7)] transition-colors">
                Decline
              </button>
            </>
          )}

          {/* Accepting */}
          {step === 'accepting' && (
            <div className="text-center py-8">
              <div className="w-6 h-6 border-2 border-[#1f48ff] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-sm text-[rgba(153,197,255,0.5)]">Accepting invite…</p>
            </div>
          )}

          {/* Done */}
          {step === 'done' && (
            <div className="text-center py-4">
              <div className="text-4xl mb-4">✓</div>
              <h2 className="text-xl font-black text-white mb-2">You're in</h2>
              <p className="text-sm text-[rgba(153,197,255,0.5)] mb-2 leading-relaxed">
                {isConnect
                  ? <>You can now see {bizName}'s jobs in the <strong className="text-white">Connect</strong> tab.</>
                  : <>You now have access to {bizName} on Cadi.</>}
              </p>
              <p className="text-xs text-[rgba(153,197,255,0.35)] mb-6">
                To log back in, go to <strong className="text-[rgba(153,197,255,0.6)]">app.cadi.cleaning</strong> and use "sign in with email" — no password needed.
              </p>
              <button
                onClick={() => navigate(isConnect ? '/connect' : '/')}
                className="w-full py-3 rounded-xl text-white text-sm font-black transition-colors"
                style={{ background: isConnect ? connectAccent : '#1f48ff' }}>
                {isConnect ? 'Open Cadi Connect →' : 'Go to Cadi →'}
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
