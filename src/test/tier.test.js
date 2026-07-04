// Tier gating — the scariest path: a wrong tier resolution either gives away paid
// features for free or locks a paying customer out. The client gate (usePlan) and
// the server gate (_shared/tier.ts) MUST agree, because the client gate is only
// advisory and the server one is what actually protects paid actions.

import { describe, it, expect } from 'vitest';
import { resolveTier as clientResolveTier, FEATURES, PRICES } from '../hooks/usePlan.js';
import {
  resolveTier as serverResolveTier,
  isPaidTier,
  LITE_LIMITS,
} from '../../supabase/functions/_shared/tier.ts';

// Every profile shape worth caring about, with the tier both gates must return.
const CASES = [
  { name: 'null profile', profile: null, expected: 'lite' },
  { name: 'undefined profile', profile: undefined, expected: 'lite' },
  { name: 'empty profile', profile: {}, expected: 'lite' },
  { name: 'subscription_tier lite', profile: { subscription_tier: 'lite' }, expected: 'lite' },
  { name: 'subscription_tier pro', profile: { subscription_tier: 'pro' }, expected: 'pro' },
  { name: 'subscription_tier max', profile: { subscription_tier: 'max' }, expected: 'max' },
  { name: 'legacy plan pro (no sub tier)', profile: { plan: 'pro' }, expected: 'pro' },
  { name: 'legacy plan max (no sub tier)', profile: { plan: 'max' }, expected: 'max' },
  { name: 'legacy plan free', profile: { plan: 'free' }, expected: 'lite' },
  {
    name: 'subscription_tier pro wins over plan free',
    profile: { subscription_tier: 'pro', plan: 'free' },
    expected: 'pro',
  },
  {
    name: 'unknown subscription_tier falls back to plan',
    profile: { subscription_tier: 'garbage', plan: 'max' },
    expected: 'max',
  },
  {
    name: 'unknown subscription_tier + unknown plan → lite',
    profile: { subscription_tier: 'enterprise', plan: 'ultra' },
    expected: 'lite',
  },
  { name: 'null fields', profile: { subscription_tier: null, plan: null }, expected: 'lite' },
];

describe('resolveTier (client — usePlan.js)', () => {
  for (const { name, profile, expected } of CASES) {
    it(`${name} → ${expected}`, () => {
      expect(clientResolveTier(profile)).toBe(expected);
    });
  }
});

describe('resolveTier (server — _shared/tier.ts)', () => {
  for (const { name, profile, expected } of CASES) {
    it(`${name} → ${expected}`, () => {
      expect(serverResolveTier(profile)).toBe(expected);
    });
  }
});

describe('client and server tier resolution agree', () => {
  for (const { name, profile } of CASES) {
    it(`agree on: ${name}`, () => {
      expect(clientResolveTier(profile)).toBe(serverResolveTier(profile));
    });
  }
});

describe('isPaidTier', () => {
  it('treats pro and max as paid', () => {
    expect(isPaidTier('pro')).toBe(true);
    expect(isPaidTier('max')).toBe(true);
  });
  it('treats lite as unpaid', () => {
    expect(isPaidTier('lite')).toBe(false);
  });
});

describe('server LITE_LIMITS mirror the client FEATURES.lite', () => {
  // CLAUDE.md: "Keep LITE_LIMITS in entitlements.ts in sync with FEATURES.lite."
  // These assertions fail loudly if the two ever drift.
  it('customerLimit matches', () => {
    expect(LITE_LIMITS.customerLimit).toBe(FEATURES.lite.customerLimit);
  });
  it('frontDeskMonthlyLimit matches', () => {
    expect(LITE_LIMITS.frontDeskMonthlyLimit).toBe(FEATURES.lite.frontDeskMonthlyLimit);
  });
});

describe('FEATURES matrix gates the right things per tier', () => {
  it('lite is locked out of every paid capability', () => {
    const lite = FEATURES.lite;
    expect(lite.customerLimit).toBe(30);
    expect(lite.canChaseInvoices).toBe(false);
    expect(lite.canUseOpenBanking).toBe(false);
    expect(lite.canUseGoCardless).toBe(false);
    expect(lite.canUseAnnualReview).toBe(false);
    expect(lite.canUseReviewsAgent).toBe(false);
    expect(lite.canUseSmsReviews).toBe(false);
    expect(lite.frontDeskMonthlyLimit).toBe(5);
    expect(lite.crewSeatLimit).toBe(1);
    // Front Desk is the one AI surface Lite keeps (capped).
    expect(lite.canUseFrontDesk).toBe(true);
  });

  it('pro unlocks the paid agents but not SMS reviews', () => {
    const pro = FEATURES.pro;
    expect(pro.customerLimit).toBe(Infinity);
    expect(pro.canChaseInvoices).toBe(true);
    expect(pro.canUseOpenBanking).toBe(true);
    expect(pro.canUseReviewsAgent).toBe(true);
    expect(pro.canUseSmsReviews).toBe(false);
    expect(pro.crewSeatLimit).toBe(5);
  });

  it('max is the only tier with SMS reviews and the biggest crew', () => {
    const max = FEATURES.max;
    expect(max.canUseSmsReviews).toBe(true);
    expect(max.crewSeatLimit).toBe(20);
    expect(max.customerLimit).toBe(Infinity);
  });
});

describe('PRICES', () => {
  it('are lite £0 / pro £39 / max £79', () => {
    expect(PRICES).toEqual({ lite: 0, pro: 39, max: 79 });
  });
});
