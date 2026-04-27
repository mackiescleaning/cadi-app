import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import CadiWordmark from '../../components/CadiWordmark';
import { Eye, EyeOff, AlertCircle, Mail } from 'lucide-react';

export default function Signup() {
  const [businessName, setBusinessName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match. Please check and try again.');
      return;
    }
    setLoading(true);
    setError('');

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { first_name: firstName, business_name: businessName },
        emailRedirectTo: `${window.location.origin}/auth/confirm?checkout=1`,
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#010a4f] flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <div className="flex justify-center mb-6"><CadiWordmark height={36} /></div>
          <div className="bg-white rounded-2xl p-8 shadow-2xl">
            <div className="w-14 h-14 bg-[#010a4f] rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Mail size={26} className="text-[#99c5ff]" />
            </div>
            <h2 className="text-xl font-bold text-[#010a4f] mb-2">Check your email</h2>
            <p className="text-sm text-gray-500 mb-1">
              We've sent a confirmation link to
            </p>
            <p className="text-sm font-semibold text-[#010a4f] mb-4">{email}</p>
            <p className="text-sm text-gray-400">
              Click the link to verify your address — we'll take you straight to payment after.
            </p>
            <p className="text-xs text-gray-400 mt-6">
              Wrong email?{' '}
              <button onClick={() => setSubmitted(false)} className="text-[#1f48ff] font-bold hover:underline">
                Go back
              </button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#010a4f] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-3"><CadiWordmark height={36} /></div>
          <p className="text-[#99c5ff] font-semibold text-xs tracking-wide uppercase">Your Cleaning Business, In Your Pocket</p>
        </div>

        <div className="bg-white rounded-2xl p-8 shadow-2xl">
          <h2 className="text-xl font-bold text-[#010a4f] mb-1">Run your whole business from one place.</h2>
          <p className="text-sm text-gray-400 mb-6">Scheduling · Invoicing · HMRC MTD · Growth — built for cleaning businesses.</p>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl mb-4">
              <AlertCircle size={15} className="text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Your name</label>
                <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)}
                  placeholder="Mackie" required
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:border-[#1f48ff] text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Business Name</label>
                <input type="text" value={businessName} onChange={e => setBusinessName(e.target.value)}
                  placeholder="Mackie's Cleaning" required
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:border-[#1f48ff] text-sm" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com" required
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:border-[#1f48ff] text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Password</label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Min 8 characters" required
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:border-[#1f48ff] text-sm pr-10" />
                <button type="button" onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Confirm Password</label>
              <div className="relative">
                <input type={showConfirmPassword ? 'text' : 'password'} value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password" required
                  className={`w-full px-4 py-3 rounded-xl border focus:outline-none focus:border-[#1f48ff] text-sm pr-10 ${confirmPassword && confirmPassword !== password ? 'border-red-300 focus:border-red-400' : confirmPassword && confirmPassword === password ? 'border-green-300 focus:border-green-400' : 'border-gray-200'}`} />
                <button type="button" onClick={() => setShowConfirmPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {confirmPassword && confirmPassword !== password && (
                <p className="text-xs text-red-500 mt-1">Passwords don't match yet</p>
              )}
              {confirmPassword && confirmPassword === password && (
                <p className="text-xs text-green-600 mt-1">✓ Passwords match</p>
              )}
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-3 bg-[#1f48ff] text-white font-bold rounded-xl hover:bg-[#3a5eff] transition-colors disabled:opacity-50 text-sm tracking-wide">
              {loading ? 'Setting up your account…' : 'Start for £29/month →'}
            </button>
          </form>

          <div className="flex items-center justify-center gap-3 mt-5">
            <span className="flex items-center gap-1 text-xs text-gray-400"><span className="text-green-500">✓</span> £29/month</span>
            <span className="text-gray-200">|</span>
            <span className="flex items-center gap-1 text-xs text-gray-400"><span className="text-green-500">✓</span> Cancel anytime</span>
            <span className="text-gray-200">|</span>
            <span className="flex items-center gap-1 text-xs text-gray-400"><span className="text-green-500">✓</span> Powered by Stripe</span>
          </div>

          <p className="text-center text-sm text-gray-500 mt-4">
            Already have an account?{' '}
            <Link to="/login" className="text-[#1f48ff] font-bold hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
