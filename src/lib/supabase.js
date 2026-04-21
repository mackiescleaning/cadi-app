import { createClient } from '@supabase/supabase-js';

// The URL and publishable key are safe to bundle in the frontend — they're
// the project's public identifiers. Real security comes from RLS + JWT-verified
// edge functions. Env vars take precedence so staging/preview can override.
const supabaseUrl =
  process.env.REACT_APP_SUPABASE_URL || 'https://cufgozpwbinjhjnkimmn.supabase.co';

const supabaseAnonKey =
  process.env.REACT_APP_SUPABASE_ANON_KEY || 'sb_publishable_OVsjG9f2ijMPEh6ZqCEa0A_P2ogyke1';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
