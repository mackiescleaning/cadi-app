import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://cufgozpwbinjhjnkimmn.supabase.co';
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1ZmdvenB3YmluamhqbmtpbW1uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4ODM4NDUsImV4cCI6MjA5MDQ1OTg0NX0.Vv1DQvcQj5lvjxRmPZVj3TWya072ujgv1O_C-jzfdcM';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

if (process.env.NODE_ENV !== 'production') window._supabase = supabase;
