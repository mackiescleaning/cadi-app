import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export function useBusinessId() {
  const { user } = useAuth();
  const [businessId, setBusinessId] = useState(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('businesses')
      .select('id')
      .eq('owner_user_id', user.id)
      .single()
      .then(({ data }) => { if (data) setBusinessId(data.id); });
  }, [user?.id]);

  return businessId;
}
