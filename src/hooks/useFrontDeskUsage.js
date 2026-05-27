import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useBusinessId } from './useBusinessId';
import { usePlan } from './usePlan';

export function useFrontDeskUsage() {
  const businessId = useBusinessId();
  const { isPro, frontDeskMonthlyLimit } = usePlan();
  const [used,    setUsed]    = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!businessId) return;
    const thisMonth = new Date().toISOString().slice(0, 7) + '-01';
    supabase
      .from('front_desk_monthly_usage')
      .select('month, action_count')
      .eq('business_id', businessId)
      .maybeSingle()
      .then(({ data }) => {
        if (data && data.month >= thisMonth) setUsed(data.action_count);
        setLoading(false);
      });
  }, [businessId]);

  const limit      = frontDeskMonthlyLimit ?? 10;
  const remaining  = Math.max(0, limit - used);
  const isAtLimit  = !isPro && used >= limit;
  const isNearLimit = !isPro && remaining <= 2 && remaining > 0;

  return { used, limit, remaining, isAtLimit, isNearLimit, loading, isPro };
}
