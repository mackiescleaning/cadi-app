// src/pages/auth/FmLogin.jsx
//
// Cadi Connect — FM Ops Portal sign-in.
// Separate page from /login so FM admins can be sent a clean URL distinct
// from the cleaner-business-owner flow. Same Supabase auth backend; the
// post-login route is /fm-ops/overview, and the page links to /apply/fm
// instead of /signup (FMs join via the admin-reviewed application flow,
// not self-serve signup).

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { Eye, EyeOff, AlertCircle, Mail, Building2 } from 'lucide-react';

const ORANGE     = '#ea580c';
const ORANGE_DK  = '#9a3412';
const ORANGE_BG  = '#fff7ed';
const INK        = '#0f172a';
const SUB        = '#64748b';
const LINE       = '#e2e8f0';

export default function FmLogin() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const [resetMode, setResetMode]       = useState(false);
  const [resetEmail, setResetEmail]     = useState('');
  const [resetSent, setResetSent]       = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const [magicMode, setMagicMode]       = useState(false);
  const [magicEmail, setMagicEmail]     = useState('');
  const [magicSent, setMagicSent]       = useState(false);
  const [magicLoading, setMagicLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { data, error: signInErr } = await signIn(email, password);
    if (signInErr) {
      setError('Invalid email or password. Please try again.');
      setLoading(false);
      return;
    }
    // Verify the signed-in user actually has FM org access before sending
    // them into the portal. Use the userId from signIn's response directly
    // — supabase.auth.getUser() right after sign-in can race with the
    // client's JWT-attach step and return stale state on first call.
    //
    // The single retry-after-refreshSession() is defensive — if the profile
    // read ever returns null for a transient reason (RLS / network), give
    // the session one chance to settle before failing the user out.
    const userId = data?.user?.id ?? data?.session?.user?.id;
    let profile = null;
    for (let attempt = 0; attempt < 2 && !profile; attempt++) {
      const { data: row } = await supabase
        .from('profiles')
        .select('fm_organisation_id')
        .eq('id', userId)
        .maybeSingle();
      profile = row;
      if (!profile && attempt === 0) await supabase.auth.refreshSession();
    }
    if (!profile?.fm_organisation_id) {
      await supabase.auth.signOut();
      setError("This sign-in is for FM organisation users. If you're a cleaning business owner, sign in at the main Cadi app instead.");
      setLoading(false);
      return;
    }
    navigate('/fm-ops/overview');
  };

  const handleMagicLink = async (e) => {
    e.preventDefault();
    setMagicLoading(true);
    await supabase.auth.signInWithOtp({
      email: magicEmail,
      options: { emailRedirectTo: `${window.location.origin}/fm-ops/overview`, shouldCreateUser: false },
    });
    setMagicSent(true);
    setMagicLoading(false);
  };

  const handleReset = async (e) => {
    e.preventDefault();
    setResetLoading(true);
    await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/auth/confirm`,
    });
    setResetSent(true);
    setResetLoading(false);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <div style={{ width: '100%', maxWidth: 440 }}>

        {/* Brand header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: ORANGE, display: 'inline-flex',
            alignItems: 'center', justifyContent: 'center',
            marginBottom: 14, boxShadow: '0 8px 20px rgba(234, 88, 12, 0.25)',
          }}>
            <Building2 size={26} color="white" strokeWidth={2.4} />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: INK, margin: '0 0 4px', letterSpacing: '-0.5px' }}>
            Cadi Connect
          </h1>
          <p style={{ fontSize: 13, color: SUB, margin: 0, fontWeight: 500 }}>
            FM Ops Portal sign-in
          </p>
        </div>

        {/* Card */}
        <div style={{ background: 'white', borderRadius: 16, padding: 28, border: `1px solid ${LINE}`, boxShadow: '0 4px 24px rgba(15, 23, 42, 0.06)' }}>

          <h2 style={{ fontSize: 16, fontWeight: 800, color: INK, margin: '0 0 18px' }}>
            {resetMode ? 'Reset your password' : magicMode ? 'Sign in without a password' : 'Welcome back'}
          </h2>

          {/* ── Magic link panel ── */}
          {magicMode && (
            magicSent ? (
              <div style={{ textAlign: 'center', padding: '12px 0 4px' }}>
                <div style={{ width: 48, height: 48, background: ORANGE_BG, borderRadius: 14, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                  <Mail size={22} color={ORANGE} />
                </div>
                <p style={{ fontSize: 14, fontWeight: 700, color: INK, margin: '0 0 4px' }}>Check your inbox</p>
                <p style={{ fontSize: 13, color: SUB, margin: '0 0 18px' }}>
                  We've sent a sign-in link to <strong style={{ color: INK }}>{magicEmail}</strong>
                </p>
                <button
                  onClick={() => { setMagicMode(false); setMagicSent(false); setMagicEmail(''); }}
                  style={{ background: 'none', border: 'none', color: ORANGE, fontWeight: 700, fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Back to sign in
                </button>
              </div>
            ) : (
              <form onSubmit={handleMagicLink} style={{ display: 'grid', gap: 12 }}>
                <p style={{ fontSize: 13, color: SUB, margin: '-4px 0 4px', lineHeight: 1.5 }}>
                  Enter your email and we'll send you a one-time sign-in link — no password needed.
                </p>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: SUB, marginBottom: 5, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Email</label>
                  <input type="email" value={magicEmail} onChange={e => setMagicEmail(e.target.value)} placeholder="you@yourfm.co.uk" required
                    style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: `1px solid ${LINE}`, fontSize: 14, color: INK, outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <button type="submit" disabled={magicLoading}
                  style={{ width: '100%', padding: 12, background: ORANGE, color: 'white', fontWeight: 700, borderRadius: 10, border: 'none', fontSize: 14, cursor: 'pointer', opacity: magicLoading ? 0.5 : 1 }}>
                  {magicLoading ? 'Sending…' : 'Send sign-in link →'}
                </button>
                <button type="button" onClick={() => setMagicMode(false)}
                  style={{ width: '100%', padding: 8, background: 'none', border: 'none', color: SUB, fontSize: 12, cursor: 'pointer' }}>
                  Back to sign in
                </button>
              </form>
            )
          )}

          {/* ── Reset password panel ── */}
          {!magicMode && resetMode && (
            resetSent ? (
              <div style={{ textAlign: 'center', padding: '12px 0 4px' }}>
                <div style={{ width: 48, height: 48, background: ORANGE_BG, borderRadius: 14, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                  <Mail size={22} color={ORANGE} />
                </div>
                <p style={{ fontSize: 14, fontWeight: 700, color: INK, margin: '0 0 4px' }}>Check your inbox</p>
                <p style={{ fontSize: 13, color: SUB, margin: '0 0 18px' }}>
                  We've sent a reset link to <strong style={{ color: INK }}>{resetEmail}</strong>
                </p>
                <button
                  onClick={() => { setResetMode(false); setResetSent(false); setResetEmail(''); }}
                  style={{ background: 'none', border: 'none', color: ORANGE, fontWeight: 700, fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Back to sign in
                </button>
              </div>
            ) : (
              <form onSubmit={handleReset} style={{ display: 'grid', gap: 12 }}>
                <p style={{ fontSize: 13, color: SUB, margin: '-4px 0 4px', lineHeight: 1.5 }}>
                  Enter your email and we'll send you a link to reset your password.
                </p>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: SUB, marginBottom: 5, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Email</label>
                  <input type="email" value={resetEmail} onChange={e => setResetEmail(e.target.value)} placeholder="you@yourfm.co.uk" required
                    style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: `1px solid ${LINE}`, fontSize: 14, color: INK, outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <button type="submit" disabled={resetLoading}
                  style={{ width: '100%', padding: 12, background: ORANGE, color: 'white', fontWeight: 700, borderRadius: 10, border: 'none', fontSize: 14, cursor: 'pointer', opacity: resetLoading ? 0.5 : 1 }}>
                  {resetLoading ? 'Sending…' : 'Send reset link →'}
                </button>
                <button type="button" onClick={() => setResetMode(false)}
                  style={{ width: '100%', padding: 8, background: 'none', border: 'none', color: SUB, fontSize: 12, cursor: 'pointer' }}>
                  Back to sign in
                </button>
              </form>
            )
          )}

          {/* ── Main sign-in form ── */}
          {!magicMode && !resetMode && (
            <>
              {error && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: 12, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, marginBottom: 14 }}>
                  <AlertCircle size={15} color="#dc2626" style={{ flexShrink: 0, marginTop: 1 }} />
                  <p style={{ fontSize: 13, color: '#b91c1c', margin: 0, lineHeight: 1.5 }}>{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: SUB, marginBottom: 5, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Email</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@yourfm.co.uk" required
                    style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: `1px solid ${LINE}`, fontSize: 14, color: INK, outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: SUB, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Password</label>
                    <button type="button" onClick={() => { setResetMode(true); setResetEmail(email); }}
                      style={{ background: 'none', border: 'none', color: ORANGE, fontWeight: 700, fontSize: 11, cursor: 'pointer', textDecoration: 'underline' }}>
                      Forgot password?
                    </button>
                  </div>
                  <div style={{ position: 'relative' }}>
                    <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required
                      style={{ width: '100%', padding: '11px 38px 11px 14px', borderRadius: 10, border: `1px solid ${LINE}`, fontSize: 14, color: INK, outline: 'none', boxSizing: 'border-box' }} />
                    <button type="button" onClick={() => setShowPassword(v => !v)}
                      style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: SUB, cursor: 'pointer', display: 'flex' }}>
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <button type="submit" disabled={loading}
                  style={{ width: '100%', padding: 12, background: ORANGE, color: 'white', fontWeight: 700, borderRadius: 10, border: 'none', fontSize: 14, cursor: 'pointer', opacity: loading ? 0.5 : 1, marginTop: 4 }}>
                  {loading ? 'Signing in…' : 'Sign in to FM Ops →'}
                </button>
                <button type="button" onClick={() => { setMagicMode(true); setMagicEmail(email); }}
                  style={{ width: '100%', padding: 6, background: 'none', border: 'none', color: SUB, fontSize: 12, cursor: 'pointer' }}>
                  Sign in without a password →
                </button>
              </form>

              {/* No signup link — FMs join via the admin-reviewed application flow */}
              <div style={{ marginTop: 22, paddingTop: 18, borderTop: `1px solid ${LINE}`, textAlign: 'center' }}>
                <p style={{ fontSize: 12, color: SUB, margin: '0 0 6px' }}>Don't have access yet?</p>
                <Link to="/apply/fm" style={{ fontSize: 13, color: ORANGE_DK, fontWeight: 700, textDecoration: 'underline' }}>
                  Apply for Cadi Connect →
                </Link>
              </div>

              {/* Cross-link to main app for users who landed here by mistake */}
              <div style={{ marginTop: 14, textAlign: 'center' }}>
                <Link to="/login" style={{ fontSize: 11, color: SUB, textDecoration: 'underline' }}>
                  Cleaning business owner? Sign in to Cadi →
                </Link>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <p style={{ textAlign: 'center', fontSize: 11, color: '#94a3b8', marginTop: 20 }}>
          By signing in you agree to our{' '}
          <Link to="/terms" style={{ color: SUB, textDecoration: 'underline' }}>Terms</Link>
          {' '}and{' '}
          <Link to="/privacy" style={{ color: SUB, textDecoration: 'underline' }}>Privacy Policy</Link>.
        </p>
      </div>
    </div>
  );
}
