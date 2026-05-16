import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import CadiWordmark from '../../components/CadiWordmark';
import { Eye, EyeOff, AlertCircle, Mail } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { signIn, loginAsDemo } = useAuth();
  const navigate = useNavigate();
  const [resetMode, setResetMode] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [magicMode, setMagicMode] = useState(false);
  const [magicEmail, setMagicEmail] = useState('');
  const [magicSent, setMagicSent] = useState(false);
  const [magicLoading, setMagicLoading] = useState(false);

  const handleMagicLink = async (e) => {
    e.preventDefault();
    setMagicLoading(true);
    await supabase.auth.signInWithOtp({
      email: magicEmail,
      options: { emailRedirectTo: `${window.location.origin}/dashboard`, shouldCreateUser: false },
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { error } = await signIn(email, password);
    if (error) {
      setError('Invalid email or password. Please try again.');
      setLoading(false);
    } else {
      navigate('/dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-[#010a4f] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-3"><CadiWordmark height={36} /></div>
          <p className="text-[#99c5ff] font-semibold text-sm">Your Cleaning Business OS</p>
        </div>

        <div className="bg-white rounded-2xl p-8 shadow-2xl">
          <h2 className="text-xl font-bold text-[#010a4f] mb-6">
            {resetMode ? 'Reset your password' : magicMode ? 'Sign in without a password' : 'Sign in to your account'}
          </h2>

          {/* ── Magic link panel ── */}
          {magicMode ? (
            magicSent ? (
              <div className="text-center py-2">
                <div className="w-12 h-12 bg-[#010a4f] rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Mail size={22} className="text-[#99c5ff]" />
                </div>
                <p className="text-sm font-semibold text-[#010a4f] mb-1">Check your inbox</p>
                <p className="text-sm text-gray-400 mb-6">We've sent a sign-in link to <span className="font-semibold text-[#010a4f]">{magicEmail}</span></p>
                <button onClick={() => { setMagicMode(false); setMagicSent(false); setMagicEmail(''); }}
                  className="text-sm font-bold text-[#1f48ff] hover:underline">
                  Back to sign in
                </button>
              </div>
            ) : (
              <form onSubmit={handleMagicLink} className="space-y-4">
                <p className="text-sm text-gray-400 -mt-2 mb-2">Enter your email and we'll send you a one-time sign-in link — no password needed.</p>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Email</label>
                  <input type="email" value={magicEmail} onChange={e => setMagicEmail(e.target.value)}
                    placeholder="you@example.com" required
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:border-[#1f48ff] focus:ring-2 focus:ring-[#1f48ff]/20 text-sm" />
                </div>
                <button type="submit" disabled={magicLoading}
                  className="w-full py-3 bg-[#1f48ff] text-white font-bold rounded-xl hover:bg-[#010a4f] transition-colors disabled:opacity-50 text-sm">
                  {magicLoading ? 'Sending…' : 'Send sign-in link →'}
                </button>
                <button type="button" onClick={() => setMagicMode(false)}
                  className="w-full py-2 text-sm text-gray-400 hover:text-gray-600 transition-colors">
                  Back to sign in
                </button>
              </form>
            )
          ) : null}

          {/* ── Reset password panel ── */}
          {!magicMode && resetMode ? (
            resetSent ? (
              <div className="text-center py-2">
                <div className="w-12 h-12 bg-[#010a4f] rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Mail size={22} className="text-[#99c5ff]" />
                </div>
                <p className="text-sm font-semibold text-[#010a4f] mb-1">Check your inbox</p>
                <p className="text-sm text-gray-400 mb-6">We've sent a reset link to <span className="font-semibold text-[#010a4f]">{resetEmail}</span></p>
                <button onClick={() => { setResetMode(false); setResetSent(false); setResetEmail(''); }}
                  className="text-sm font-bold text-[#1f48ff] hover:underline">
                  Back to sign in
                </button>
              </div>
            ) : (
              <form onSubmit={handleReset} className="space-y-4">
                <p className="text-sm text-gray-400 -mt-2 mb-2">Enter your email and we'll send you a link to reset your password.</p>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Email</label>
                  <input type="email" value={resetEmail} onChange={e => setResetEmail(e.target.value)}
                    placeholder="you@example.com" required
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:border-[#1f48ff] focus:ring-2 focus:ring-[#1f48ff]/20 text-sm" />
                </div>
                <button type="submit" disabled={resetLoading}
                  className="w-full py-3 bg-[#1f48ff] text-white font-bold rounded-xl hover:bg-[#010a4f] transition-colors disabled:opacity-50 text-sm">
                  {resetLoading ? 'Sending…' : 'Send reset link →'}
                </button>
                <button type="button" onClick={() => setResetMode(false)}
                  className="w-full py-2 text-sm text-gray-400 hover:text-gray-600 transition-colors">
                  Back to sign in
                </button>
              </form>
            )
          ) : !magicMode && (
            <>
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl mb-4">
                  <AlertCircle size={15} className="text-red-500 flex-shrink-0" />
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Email</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com" required
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:border-[#1f48ff] focus:ring-2 focus:ring-[#1f48ff]/20 text-sm" />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-gray-500">Password</label>
                    <button type="button" onClick={() => { setResetMode(true); setResetEmail(email); }}
                      className="text-xs font-semibold text-[#1f48ff] hover:underline">
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <input type={showPassword ? 'text' : 'password'} value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••" required
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:border-[#1f48ff] focus:ring-2 focus:ring-[#1f48ff]/20 text-sm pr-10" />
                    <button type="button" onClick={() => setShowPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <button type="submit" disabled={loading}
                  className="w-full py-3 bg-[#1f48ff] text-white font-bold rounded-xl hover:bg-[#010a4f] transition-colors disabled:opacity-50">
                  {loading ? 'Signing in...' : 'Sign In'}
                </button>
                <button type="button" onClick={() => { setMagicMode(true); setMagicEmail(email); }}
                  className="w-full py-2 text-xs text-gray-400 hover:text-[#1f48ff] transition-colors">
                  Sign in without a password →
                </button>
              </form>
            </>
          )}

          {!resetMode && !magicMode && (
            <>
              {/* Demo login */}
              <div className="mt-4 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => { loginAsDemo(); navigate('/dashboard'); }}
                  className="w-full py-3 bg-[#010a4f]/5 border-2 border-dashed border-[#1f48ff]/30 text-[#1f48ff] font-bold rounded-xl hover:bg-[#1f48ff]/10 hover:border-[#1f48ff]/50 transition-all text-sm"
                >
                  Try Demo — no account needed
                </button>
              </div>

              <p className="text-center text-sm text-gray-500 mt-6">
                Don't have an account?{' '}
                <Link to="/signup" className="text-[#1f48ff] font-bold hover:underline">Sign up free</Link>
              </p>
              <div className="mt-4 pt-4 border-t border-gray-100 text-center">
                <p className="text-xs text-gray-400 mb-2">Are you a team member?</p>
                <a href="/staff-login" className="text-sm font-bold text-[#1f48ff] hover:underline">
                  Team member login →
                </a>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
