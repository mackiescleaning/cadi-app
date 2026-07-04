import { useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import CadiWordmark from '../CadiWordmark';

// If the user was signed in and momentarily drops to null while a token refresh
// is in flight (not a real sign-out), wait this long for the session to come back
// before redirecting to /login. Prevents the "land on dashboard, get bounced to
// the auth page" flicker that a transient refresh blip used to cause.
const REFRESH_GRACE_MS = 1500;

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-[#010a4f] flex items-center justify-center">
      <div className="text-center">
        <div className="flex justify-center mb-4 animate-pulse">
          <CadiWordmark height={28} />
        </div>
        <p className="text-[#99c5ff] text-sm font-semibold">Loading...</p>
      </div>
    </div>
  );
}

export default function ProtectedRoute({ children }) {
  const { user, loading, profileLoading } = useAuth();

  // Track whether we've ever had an authenticated user in this mount, so we can
  // tell a transient refresh drop (was logged in → briefly null) apart from a
  // genuinely-unauthenticated visitor (never logged in → redirect immediately).
  const hadUser = useRef(false);
  if (user) hadUser.current = true;

  const [graceExpired, setGraceExpired] = useState(false);

  useEffect(() => {
    if (loading || user) {
      setGraceExpired(false);
      return;
    }
    // No user and not loading. If we never had one, redirect now. If we did,
    // give the session a brief window to recover before ejecting.
    if (!hadUser.current) {
      setGraceExpired(true);
      return;
    }
    setGraceExpired(false);
    const t = setTimeout(() => setGraceExpired(true), REFRESH_GRACE_MS);
    return () => clearTimeout(t);
  }, [user, loading]);

  const isLoading = loading || (user && profileLoading);
  if (isLoading) return <LoadingScreen />;

  if (!user) {
    // Within the grace window after a transient drop — hold on the loader.
    if (hadUser.current && !graceExpired) return <LoadingScreen />;
    return <Navigate to="/login" replace />;
  }

  return children;
}
