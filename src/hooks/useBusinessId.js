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
      .maybeSingle()
      .then(({ data }) => {
        if (data) setBusinessId(data.id);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-fetch only when the signed-in user changes
  }, [user?.id]);

  return businessId;
}
