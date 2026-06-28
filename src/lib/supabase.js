import { createClient } from '@supabase/supabase-js';

// Fail fast at module load if the env vars are missing. Previously these
// fell back to a hardcoded URL + anon key baked into the client bundle —
// a real (if minor) leak surface and a footgun if the project ever gets
// rotated. Now: missing env → loud error in the console + ProtectedRoute
// will fail to authenticate, which is what we want.
const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
if (!supabaseUrl)     throw new Error('VITE_SUPABASE_URL is required at build time');
if (!supabaseAnonKey) throw new Error('VITE_SUPABASE_ANON_KEY is required at build time');

// Lazy ref so the fetch wrapper can call supabase.auth after the client is created.
let _client = null;
let _refreshing = null;

async function fetchWithAuthRetry(url, options = {}) {
  const res = await fetch(url, options);
  // Skip auth endpoints to avoid infinite loops on refresh failures.
  if (res.status === 401 && _client && !String(url).includes('/auth/v1/')) {
    // Deduplicate concurrent 401s into a single refresh attempt.
    if (!_refreshing) {
      _refreshing = _client.auth.refreshSession().finally(() => { _refreshing = null; });
    }
    const { data } = await _refreshing;
    if (data?.session?.access_token) {
      // Retry with the fresh token. Use Headers constructor to handle both
      // plain objects and Headers instances that Supabase may pass.
      const newHeaders = new Headers(options.headers || {});
      newHeaders.set('Authorization', `Bearer ${data.session.access_token}`);
      return fetch(url, { ...options, headers: newHeaders });
    }
    // Refresh failed — Supabase will fire onAuthStateChange(null) and ProtectedRoute redirects.
  }
  return res;
}

// Tab-isolated session: each tab has its own auth token, and closing the last
// tab ends the session. Default Supabase behaviour is localStorage, which
// silently persisted across tabs and browser restarts until the refresh token
// expired — a real footgun on shared devices. If "Remember me on this device"
// ships later, flip this to localStorage conditionally at sign-in time.
const authStorage =
  typeof window !== 'undefined' && window.sessionStorage
    ? window.sessionStorage
    : undefined; // SSR / Node tests fall back to in-memory default

// One-time cleanup: existing users had their Supabase token in localStorage.
// Now that we use sessionStorage, the old entry would sit unused (and readable)
// until expiry. Wipe any `sb-*-auth-token` keys from localStorage on first load.
if (typeof window !== 'undefined' && window.localStorage) {
  try {
    for (let i = window.localStorage.length - 1; i >= 0; i--) {
      const k = window.localStorage.key(i);
      if (k && /^sb-.*-auth-token($|\.)/.test(k)) window.localStorage.removeItem(k);
    }
  } catch {}
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { fetch: fetchWithAuthRetry },
  auth: {
    storage: authStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

_client = supabase;
