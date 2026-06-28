import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';

// 60-second countdown banner that appears 1 minute before idle sign-out.
// Tapping anywhere dismisses it (handled by AuthContext's activity listener).
export default function IdleWarningBanner() {
  const { idleWarning, dismissIdleWarning } = useAuth();
  const [seconds, setSeconds] = useState(60);

  useEffect(() => {
    if (!idleWarning) { setSeconds(60); return; }
    setSeconds(60);
    const t = setInterval(() => {
      setSeconds(s => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [idleWarning]);

  if (!idleWarning) return null;

  return (
    <div
      role="alert"
      aria-live="polite"
      className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] max-w-md w-[calc(100%-2rem)] px-4 py-3 rounded-xl shadow-2xl border border-amber-400/40 bg-amber-50 text-amber-900 flex items-center gap-3"
    >
      <span className="text-lg shrink-0">⏰</span>
      <div className="flex-1 text-sm">
        <p className="font-bold leading-tight">Signing you out in {seconds}s</p>
        <p className="text-[11px] text-amber-800/80 mt-0.5">Move your mouse, tap, or click to stay signed in.</p>
      </div>
      <button
        onClick={dismissIdleWarning}
        className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-black shadow-sm"
      >
        Stay
      </button>
    </div>
  );
}
