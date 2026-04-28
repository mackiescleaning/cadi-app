import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';

export const FREE_CUSTOMER_LIMIT = 50;

// Tabs that require Pro — free users see a lock and upgrade prompt
export const PRO_TABS = ['/money', '/accounts', '/scaling', '/staff', '/review'];

export function usePlan() {
  const { profile } = useAuth();

  return useMemo(() => {
    const isPro = profile?.plan === 'pro';

    return {
      isPro,
      plan: isPro ? 'pro' : 'free',
      priceMonthly: 29,

      // Customer limit
      customerLimit: isPro ? Infinity : FREE_CUSTOMER_LIMIT,

      // Tab access
      proTabs: PRO_TABS,
      isTabLocked: (path) => !isPro && PRO_TABS.some(p => path.startsWith(p)),

      // Feature flags
      canChaseInvoices:      isPro,
      canUseOpenBanking:     isPro,
      canUseGoCardless:      isPro,
      canUseOnDayPayments:   isPro,
      canUseTeamMode:        isPro,
      canUseFullLeaderboard: isPro,
      canUseAnnualReview:    isPro,
    };
  }, [profile?.plan]);
}
