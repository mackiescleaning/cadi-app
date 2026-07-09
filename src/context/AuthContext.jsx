import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

// Idle timeout: sign out after this many minutes with no pointer/key activity.
// Activity in any tab resets the timer (BroadcastChannel sync).
const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const IDLE_WARNING_MS = 60 * 1000; // warn 60s before sign-out
// Last user activity across ALL tabs, shared via localStorage. The idle timer
// measures inactivity against this so a stale/background tab can't sign out a
// tab you're actively using (Supabase shares one session per browser).
const LAST_ACTIVITY_KEY = 'cadi_last_activity_at';

const AuthContext = createContext({});

const DEMO_USER = { id: 'demo-user', email: 'demo@cadi.app' };
const DEMO_PROFILE = {
  id: 'demo-user',
  first_name: 'Demo',
  business_name: 'Demo Cleaning Co',
  plan: 'pro',
  phone: '07700 900000',
  cleaner_type: 'residential',
  biz_structure: 'sole_trader',
  team_structure: 'solo',
  dashboard_tour_complete: true,
  onboarding_complete: true,
  founding_member: true,
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [idleWarning, setIdleWarning] = useState(false);
  const idleTimerRef = useRef(null);
  const idleWarningRef = useRef(null);

  useEffect(() => {
    // Restore demo session if active
    const isDemo = sessionStorage.getItem('cadi_demo_session');
    if (isDemo) {
      setUser(DEMO_USER);
      setProfile(DEMO_PROFILE);
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Forgot-password links log the user in with a temporary recovery
      // session and fire PASSWORD_RECOVERY. Supabase may redirect them to the
      // Site URL root rather than /auth/confirm, so handle it globally here:
      // send them to the set-new-password screen wherever the link landed.
      // (Guard against a redirect loop once we're already on that screen.)
      if (event === 'PASSWORD_RECOVERY' && !window.location.pathname.startsWith('/auth/confirm')) {
        window.location.replace('/auth/confirm#type=recovery');
        return;
      }

      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
        if (window.FS) {
          window.FS('setIdentity', {
            uid: session.user.id,
            properties: {
              email: session.user.email ?? '',
              displayName: session.user.user_metadata?.first_name ?? session.user.email ?? '',
            },
          });
        }
      } else {
        setProfile(null);
        if (window.FS) window.FS('setIdentity', { anonymous: true });
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // ── Idle timeout ───────────────────────────────────────────────────────────
  // Sign the user out after 30 minutes of no pointer / key activity. Activity
  // in any open tab resets every tab's timer via a BroadcastChannel.
  useEffect(() => {
    if (!user) {
      setIdleWarning(false);
      clearTimeout(idleTimerRef.current);
      clearTimeout(idleWarningRef.current);
      return;
    }

    const channel =
      typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('cadi-activity') : null;

    const readLastActivity = () => {
      try {
        return Number(localStorage.getItem(LAST_ACTIVITY_KEY)) || 0;
      } catch {
        return 0;
      }
    };
    // Throttle writes so mousemove doesn't hammer localStorage.
    let lastWrite = 0;
    const markActivity = () => {
      const now = Date.now();
      if (now - lastWrite < 2000) return;
      lastWrite = now;
      try {
        localStorage.setItem(LAST_ACTIVITY_KEY, String(now));
      } catch {}
    };

    // Self-rescheduling idle check. "Idle" is measured against the most recent
    // activity in ANY tab (shared via localStorage) — so when this timer fires
    // it re-checks and only signs out after a full IDLE_TIMEOUT_MS of
    // inactivity everywhere, instead of ejecting a tab you're actively using.
    const scheduleCheck = () => {
      clearTimeout(idleTimerRef.current);
      clearTimeout(idleWarningRef.current);
      const last = readLastActivity() || Date.now();
      const remaining = IDLE_TIMEOUT_MS - (Date.now() - last);
      if (remaining <= 0) {
        console.warn('[auth] idle sign-out — no activity in any tab for 30m');
        signOut();
        return;
      }
      const warnIn = remaining - IDLE_WARNING_MS;
      if (warnIn <= 0) setIdleWarning(true);
      else idleWarningRef.current = setTimeout(() => setIdleWarning(true), warnIn);
      idleTimerRef.current = setTimeout(scheduleCheck, remaining);
    };

    const onLocalActivity = () => {
      markActivity();
      setIdleWarning(false);
      scheduleCheck();
      try {
        channel?.postMessage('activity');
      } catch {}
    };
    const onRemoteActivity = (ev) => {
      if (ev.data === 'activity') {
        setIdleWarning(false);
        scheduleCheck();
      }
    };
    // Second cross-tab signal in case BroadcastChannel is unavailable: another
    // tab writing LAST_ACTIVITY_KEY fires a storage event here.
    const onStorage = (e) => {
      if (e.key === LAST_ACTIVITY_KEY) {
        setIdleWarning(false);
        scheduleCheck();
      }
    };

    const events = [
      'mousemove',
      'mousedown',
      'keydown',
      'touchstart',
      'scroll',
      'visibilitychange',
    ];
    events.forEach((e) => window.addEventListener(e, onLocalActivity, { passive: true }));
    if (channel) channel.addEventListener('message', onRemoteActivity);
    window.addEventListener('storage', onStorage);
    markActivity();
    scheduleCheck();

    return () => {
      events.forEach((e) => window.removeEventListener(e, onLocalActivity));
      if (channel) {
        channel.removeEventListener('message', onRemoteActivity);
        channel.close();
      }
      window.removeEventListener('storage', onStorage);
      clearTimeout(idleTimerRef.current);
      clearTimeout(idleWarningRef.current);
    };
  }, [user]);

  async function fetchProfile(userId) {
    setProfileLoading(true);
    try {
      const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
      if (data) setProfile(data);
    } catch {}
    setProfileLoading(false);
  }

  async function signUp(email, password, businessName, firstName) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { first_name: firstName, business_name: businessName },
      },
    });
    return { data, error };
  }

  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { data, error };
  }

  function loginAsDemo() {
    sessionStorage.setItem('cadi_demo_session', '1');
    setUser(DEMO_USER);
    setProfile(DEMO_PROFILE);
  }

  async function signOut() {
    sessionStorage.removeItem('cadi_demo_session');
    setUser(null);
    setProfile(null);
    await supabase.auth.signOut();
  }

  async function refreshProfile() {
    if (user?.id && user.id !== 'demo-user') {
      await fetchProfile(user.id);
    }
  }

  async function updateProfile(updates) {
    // Demo user — update locally only
    if (user?.id === 'demo-user') {
      setProfile((prev) => ({ ...prev, ...updates }));
      return { data: { ...profile, ...updates }, error: null };
    }
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single();
    if (data) setProfile(data);
    return { data, error };
  }

  const isPro = profile?.plan === 'pro';

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        profileLoading,
        isPro,
        idleWarning,
        dismissIdleWarning: () => setIdleWarning(false),
        signUp,
        signIn,
        signOut,
        loginAsDemo,
        updateProfile,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
