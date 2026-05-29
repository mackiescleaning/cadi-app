import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';

export const FREE_CUSTOMER_LIMIT = 30;

// Tabs locked behind Pro or above
export const PRO_TABS = ['/money', '/accounts', '/scaling', '/staff', '/review'];

// Feature matrix per tier
const FEATURES = {
  lite: {
    customerLimit:         FREE_CUSTOMER_LIMIT,
    canChaseInvoices:      false,
    canUseOpenBanking:     false,
    canUseGoCardless:      false,
    canUseOnDayPayments:   false,
    canUseTeamMode:        false,
    canUseFullLeaderboard: false,
    canUseAnnualReview:    false,
    canUseFrontDesk:       true,
    canUseReviewsAgent:          true,
    canUseOperationsManager:     false,
    frontDeskMonthlyLimit:       10,
    reviewsMonthlyLimit:         Infinity,
    canUseSmsReviews:            false,
    crewSeatLimit:               1,
    teamMemberLimit:             0,
  },
  pro: {
    customerLimit:         Infinity,
    canChaseInvoices:      true,
    canUseOpenBanking:     true,
    canUseGoCardless:      true,
    canUseOnDayPayments:   true,
    canUseTeamMode:        true,
    canUseFullLeaderboard: true,
    canUseAnnualReview:    true,
    canUseFrontDesk:       true,
    canUseReviewsAgent:          true,
    canUseOperationsManager:     true,
    frontDeskMonthlyLimit:       Infinity,
    reviewsMonthlyLimit:         Infinity,
    canUseSmsReviews:            false,
    crewSeatLimit:               5,
    teamMemberLimit:             5,
  },
  max: {
    customerLimit:         Infinity,
    canChaseInvoices:      true,
    canUseOpenBanking:     true,
    canUseGoCardless:      true,
    canUseOnDayPayments:   true,
    canUseTeamMode:        true,
    canUseFullLeaderboard: true,
    canUseAnnualReview:    true,
    canUseFrontDesk:       true,
    canUseReviewsAgent:          true,
    canUseOperationsManager:     true,
    frontDeskMonthlyLimit:       Infinity,
    reviewsMonthlyLimit:         Infinity,
    canUseSmsReviews:            true,
    crewSeatLimit:               20,
    teamMemberLimit:             Infinity,
  },
};

const PRICES = {
  lite: 0,
  pro:  39,
  max:  79,
};

function resolveTier(profile) {
  // subscription_tier is canonical — but only trust it if it's an upgraded tier
  const tier = profile?.subscription_tier;
  if (tier === 'pro' || tier === 'max') return tier;
  // fall back to legacy plan field (set by Stripe webhook alongside subscription_tier)
  if (profile?.plan === 'pro' || profile?.plan === 'max') return profile.plan;
  return 'lite';
}

export function usePlan() {
  const { profile } = useAuth();

  return useMemo(() => {
    const tier = resolveTier(profile);
    const features = FEATURES[tier] ?? FEATURES.lite;

    return {
      tier,
      // Legacy alias — many existing components check isPro
      isPro: tier === 'pro' || tier === 'max',
      isMax: tier === 'max',
      plan: tier,

      priceMonthly: PRICES[tier],

      ...features,

      proTabs:     PRO_TABS,
      isTabLocked: (path) => (tier === 'lite') && PRO_TABS.some(p => path.startsWith(p)),

      isFeatureEnabled: (key) => !!features[key],
    };
  }, [profile?.subscription_tier, profile?.plan]);
}
