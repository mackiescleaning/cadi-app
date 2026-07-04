import { createClient } from '@supabase/supabase-js';

// Prefer env vars at build time; fall back to the published anon key + URL.
// Both values are public (anon role, designed for client bundles) so the
// fallback is safe. Once VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are set
// on the Vercel project, the fallback becomes a no-op and can be removed.
//
// Exported so any raw-fetch helper (e.g. callConnectFn, callFmFn, edge
// function invokers) can use the same fallback chain. Reading
// import.meta.env directly elsewhere causes `apikey: undefined` and
// `/functions/v1/...` URLs that resolve to "undefined" host on prod
// where the env vars aren't set.
export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ||
  'https://cufgozpwbinjhjnkimmn.supabase.co';
export const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1ZmdvenB3YmluamhqbmtpbW1uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4ODM4NDUsImV4cCI6MjA5MDQ1OTg0NX0.Vv1DQvcQj5lvjxRmPZVj3TWya072ujgv1O_C-jzfdcM';

const supabaseUrl     = SUPABASE_URL;
const supabaseAnonKey = SUPABASE_ANON_KEY;

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

// Persistent session storage (localStorage): keep users signed in across tabs
// and browser restarts, and — critically — let supabase-js sync rotated refresh
// tokens between tabs via storage events. That cross-tab sync is what prevents
// the multi-tab token-rotation race that was spuriously firing SIGNED_OUT and
// bouncing users back to the login screen right after they signed in. Shared-
// device safety is covered by the 30-minute idle timeout in AuthContext, not by
// dropping the session when the tab closes.
//
// NB: do NOT reintroduce a startup sweep of `sb-*-auth-token` from localStorage —
// that would delete the very token this storage relies on and log everyone out
// on each load. (An earlier sessionStorage experiment had such a sweep.)
const authStorage =
  typeof window !== 'undefined' && window.localStorage
    ? window.localStorage
    : undefined; // SSR / Node tests fall back to in-memory default

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
