import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { acceptInvite } from '../lib/db/teamDb';

export default function InviteAccept() {
  const { token }   = useParams();
  const navigate    = useNavigate();
  const [step, setStep]         = useState('loading'); // loading | otp_email | otp_sent | preview | accepting | done | error
  const [invite, setInvite]     = useState(null);
  const [bizName, setBizName]   = useState('');
  const [error, setError]       = useState('');
  const [email, setEmail]       = useState('');
  const [busy, setBusy]         = useState(false);

  // On mount: sign out any existing session so the accountant gets their own account
  useEffect(() => {
    async function init() {
      // Always sign out first — invite links must not inherit the owner's session
      await supabase.auth.signOut();

      const { data, error: err } = await supabase
        .from('account_members')
        .select('id, member_email, role, status, owner_id, expires_at')
        .eq('invite_token', token)
        .single();

      if (err || !data) { setStep('error'); setError('Invite not found or already used.'); return; }
      if (data.status !== 'pending') { setStep('error'); setError('This invite has already been accepted or revoked.'); return; }
      if (data.expires_at && new Date(data.expires_at) < new Date()) { setStep('error'); setError('This invite has expired.'); return; }

      setInvite(data);
      setEmail(data.member_email); // pre-fill with the invited email

      const { data: biz } = await supabase
        .from('business_settings')
        .select('business_name')
        .eq('owner_id', data.owner_id)
        .single();
      setBizName(biz?.business_name ?? 'your client');

      setStep('otp_email');
    }
    init();
  }, [token]);

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
          emailRedirectTo: `${window.location.origin}/invite/${token}`,
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
      await acceptInvite(token);
      setStep('done');
    } catch (err) {
      setStep('error');
      setError(err.message);
    }
  }

  const roleLabel = invite?.role === 'bookkeeper' ? 'bookkeeper' : invite?.role === 'manager' ? 'manager' : 'accountant';

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        <div className="text-center mb-8">
          <span className="text-2xl font-black text-white tracking-tight">Cadi</span>
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
              <p className="text-xs font-bold text-[rgba(153,197,255,0.5)] uppercase tracking-widest mb-1">Team invite</p>
              <h2 className="text-xl font-black text-white mb-2">{bizName} has invited you</h2>
              <p className="text-sm text-[rgba(153,197,255,0.5)] mb-6 leading-relaxed">
                You've been invited as <strong className="text-white">{roleLabel}</strong> for {bizName}.
                Enter your email to receive a one-time sign-in link — no password needed.
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
                  className="w-full py-3 rounded-xl bg-[#1f48ff] text-white text-sm font-black hover:bg-[#3a5eff] transition-colors disabled:opacity-50">
                  {busy ? 'Sending…' : 'Send sign-in link →'}
                </button>
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
              <p className="text-xs font-bold text-[rgba(153,197,255,0.5)] uppercase tracking-widest mb-1">Team invite</p>
              <h2 className="text-xl font-black text-white mb-2">Accept access to {bizName}?</h2>
              <p className="text-sm text-[rgba(153,197,255,0.5)] mb-6 leading-relaxed">
                You'll be added as <strong className="text-white">{roleLabel}</strong> for {bizName}.
                The business owner controls what you can view and change.
              </p>
              <div className="bg-[rgba(153,197,255,0.04)] border border-[rgba(153,197,255,0.08)] rounded-xl p-4 mb-6 space-y-2">
                {[
                  { label: 'Business', val: bizName },
                  { label: 'Your role', val: roleLabel.charAt(0).toUpperCase() + roleLabel.slice(1) },
                  { label: 'Invited to', val: invite.member_email },
                ].map(({ label, val }) => (
                  <div key={label} className="flex justify-between text-sm">
                    <span className="text-[rgba(153,197,255,0.45)]">{label}</span>
                    <span className="font-black text-white">{val}</span>
                  </div>
                ))}
              </div>
              <button
                onClick={handleAccept}
                className="w-full py-3 rounded-xl bg-[#1f48ff] text-white text-sm font-black hover:bg-[#3a5eff] transition-colors mb-3">
                Accept invite →
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
                You now have access to {bizName} on Cadi.
              </p>
              <p className="text-xs text-[rgba(153,197,255,0.35)] mb-6">
                To log back in, go to <strong className="text-[rgba(153,197,255,0.6)]">app.cadi.cleaning</strong> and use "sign in with email" — no password needed.
              </p>
              <button
                onClick={() => navigate('/')}
                className="w-full py-3 rounded-xl bg-[#1f48ff] text-white text-sm font-black hover:bg-[#3a5eff] transition-colors">
                Go to Cadi →
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
