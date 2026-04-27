import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';

export function usePlan() {
  const { profile } = useAuth();

  return useMemo(() => {
    const isPro = profile?.plan === 'pro';

    return {
      isPro,
      plan: isPro ? 'pro' : 'unpaid',
      priceMonthly: 29,
      // All tabs and features are available — access is all-or-nothing
      lockedTabs: [],
      isTabLocked: () => false,
      maxResComCustomers: Infinity,
      maxExteriorCustomers: Infinity,
    };
  }, [profile?.plan]);
}
