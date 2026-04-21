import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';

const LOCKED_TABS_FREE = ['accounts', 'staff', 'review'];

const FREE_LIMITS = {
  maxResComCustomers: 20,
  maxExteriorCustomers: 50,
};

export function usePlan() {
  const { profile } = useAuth();

  return useMemo(() => {
    const isPro = profile?.plan === 'pro';

    return {
      isPro,
      plan: isPro ? 'pro' : 'free',
      maxResComCustomers: isPro ? Infinity : FREE_LIMITS.maxResComCustomers,
      maxExteriorCustomers: isPro ? Infinity : FREE_LIMITS.maxExteriorCustomers,
      lockedTabs: isPro ? [] : LOCKED_TABS_FREE,
      isTabLocked: (tabPath) => {
        if (isPro) return false;
        const slug = tabPath.replace(/^\//, '');
        return LOCKED_TABS_FREE.includes(slug);
      },
      priceMonthly: 59,
    };
  }, [profile?.plan]);
}
