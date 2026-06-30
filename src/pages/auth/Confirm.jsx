import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import CadiWordmark from '../../components/CadiWordmark';

export default function Confirm() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('confirming'); // 'confirming' | 'recovery' | 'error'
  const [password, setPassword] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    const isRecovery = window.location.hash.includes('type=recovery');

    if (isRecovery) {
      // Supabase auto-exchanges the recovery token on load and fires PASSWORD_RECOVERY.
      // Check if the session is already established (token exchanged before this effect ran).
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          setStatus('recovery');
          return;
        }
        // Otherwise wait for the exchange to complete.
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, sess) => {
          if (event === 'PASSWORD_RECOVERY' && sess) {
            setStatus('recovery');
            subscription.unsubscribe();
          }
        });
      });
      return;
    }

    // Email confirmation / magic link flow — redirect as soon as a session exists.
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

  async function handleSetPassword(e) {
    e.preventDefault();
    setSaveError('');
    if (password !== confirmPw) {
      setSaveError('Passwords do not match.');
      return;
    }
    if (password.length < 12) {
      setSaveError('Password must be at least 12 characters.');
      return;
    }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setSaveError(error.message);
      setSaving(false);
    } else {
      navigate('/dashboard', { replace: true });
    }
  }

  return (
    <div className="min-h-screen bg-[#010a4f] flex items-center justify-center px-4">
      <div className="text-center w-full max-w-sm">
        <div className="flex justify-center mb-6">
          <CadiWordmark height={32} />
        </div>

        {status === 'confirming' && (
          <>
            <div className="w-8 h-8 border-2 border-[#99c5ff] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-white font-semibold">Confirming your email…</p>
            <p className="text-[rgba(153,197,255,0.5)] text-sm mt-1">Just a moment…</p>
          </>
        )}

        {status === 'recovery' && (
          <form onSubmit={handleSetPassword} className="text-left">
            <p className="text-white font-semibold text-center mb-1">Set a new password</p>
            <p className="text-[rgba(153,197,255,0.5)] text-sm text-center mb-6">
              Choose a strong password of at least 12 characters.
            </p>
            <div className="mb-4">
              <label className="block text-[rgba(153,197,255,0.7)] text-sm mb-1">New password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoFocus
                className="w-full px-4 py-2.5 rounded-xl bg-white/10 text-white border border-white/20 focus:outline-none focus:border-[#99c5ff]"
              />
            </div>
            <div className="mb-5">
              <label className="block text-[rgba(153,197,255,0.7)] text-sm mb-1">Confirm password</label>
              <input
                type="password"
                value={confirmPw}
                onChange={e => setConfirmPw(e.target.value)}
                required
                className="w-full px-4 py-2.5 rounded-xl bg-white/10 text-white border border-white/20 focus:outline-none focus:border-[#99c5ff]"
              />
            </div>
            {saveError && (
              <p className="text-red-400 text-sm mb-3">{saveError}</p>
            )}
            <button
              type="submit"
              disabled={saving}
              className="w-full py-2.5 bg-[#1f48ff] text-white text-sm font-bold rounded-xl disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Set password'}
            </button>
          </form>
        )}

        {status === 'error' && (
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
