import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://cufgozpwbinjhjnkimmn.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1ZmdvenB3YmluamhqbmtpbW1uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4ODM4NDUsImV4cCI6MjA5MDQ1OTg0NX0.Vv1DQvcQj5lvjxRmPZVj3TWya072ujgv1O_C-jzfdcM';

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

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { fetch: fetchWithAuthRetry },
});

_client = supabase;
window._supabase = supabase;
