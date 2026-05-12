import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';

export const FREE_CUSTOMER_LIMIT = 50;

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
    canUseFrontDesk:       false,
    canUseReviewsAgent:    false,
    reviewsMonthlyLimit:   5,
    canUseSmsReviews:      false,
    crewSeatLimit:         1,
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
    canUseReviewsAgent:    true,
    reviewsMonthlyLimit:   Infinity,
    canUseSmsReviews:      false,
    crewSeatLimit:         5,
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
    canUseReviewsAgent:    true,
    reviewsMonthlyLimit:   Infinity,
    canUseSmsReviews:      true,
    crewSeatLimit:         20,
  },
};

const PRICES = {
  lite: 0,
  pro:  39,
  max:  79,
};

function resolveTier(profile) {
  // subscription_tier is the canonical field post-migration
  if (profile?.subscription_tier) return profile.subscription_tier;
  // fall back to legacy plan field for any users not yet migrated
  if (profile?.plan === 'pro') return 'pro';
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
      plan: tier,

      priceMonthly: PRICES[tier],

      ...features,

      proTabs:     PRO_TABS,
      isTabLocked: (path) => (tier === 'lite') && PRO_TABS.some(p => path.startsWith(p)),

      isFeatureEnabled: (key) => !!features[key],
    };
  }, [profile?.subscription_tier, profile?.plan]);
}
