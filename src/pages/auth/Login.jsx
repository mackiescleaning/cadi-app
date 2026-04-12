import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { signIn } = useAuth();
  const navigate = useNavigate();

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
          <div className="mx-auto mb-4 inline-flex items-center gap-3 px-5 py-3 rounded-2xl bg-[#1f48ff] shadow-2xl shadow-[#1f48ff]/40">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="28" height="28" rx="8" fill="white" fillOpacity="0.15"/>
              <path d="M7 14C7 10.134 10.134 7 14 7C16.209 7 18.18 8.014 19.5 9.6L17.4 11.35C16.56 10.34 15.35 9.7 14 9.7C11.624 9.7 9.7 11.624 9.7 14C9.7 16.376 11.624 18.3 14 18.3C15.35 18.3 16.56 17.66 17.4 16.65L19.5 18.4C18.18 19.986 16.209 21 14 21C10.134 21 7 17.866 7 14Z" fill="white"/>
            </svg>
            <span className="text-white font-black text-2xl tracking-tight">cadi</span>
          </div>
          <p className="text-[#99c5ff] font-semibold text-sm">Your Cleaning Business OS</p>
        </div>

        <div className="bg-white rounded-2xl p-8 shadow-2xl">
          <h2 className="text-xl font-bold text-[#010a4f] mb-6">Sign in to your account</h2>

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
              <label className="block text-xs font-semibold text-gray-500 mb-1">Password</label>
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
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Don't have an account?{' '}
            <Link to="/signup" className="text-[#1f48ff] font-bold hover:underline">Sign up free</Link>
          </p>
          <div className="mt-4 pt-4 border-t border-gray-100 text-center">
            <p className="text-xs text-gray-400 mb-2">Are you a team member?</p>
            <a href="/staff-login"
              className="text-sm font-bold text-[#1f48ff] hover:underline">
              Team member login →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
