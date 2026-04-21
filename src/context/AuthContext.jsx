import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

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

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          fetchProfile(session.user.id);
        } else {
          setProfile(null);
        }
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(userId) {
    setProfileLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (data) setProfile(data);
    setProfileLoading(false);
  }

  async function signUp(email, password, businessName, firstName) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { first_name: firstName, business_name: businessName }
      }
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

  async function updateProfile(updates) {
    // Demo user — update locally only
    if (user?.id === 'demo-user') {
      setProfile(prev => ({ ...prev, ...updates }));
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
    <AuthContext.Provider value={{
      user, profile, loading, profileLoading, isPro,
      signUp, signIn, signOut, loginAsDemo, updateProfile
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
