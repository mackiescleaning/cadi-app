/**
 * _shared/tier.ts
 * Pure, dependency-free tier logic — the single source of truth for
 * subscription-tier resolution on the server.
 *
 * Kept free of any imports (no esm.sh, no Deno APIs) so it can be imported by:
 *   - Deno edge functions (entitlements.ts and friends), and
 *   - the Node/Vitest unit suite (src/test/tier.test.js),
 * which lets us assert it stays in sync with src/hooks/usePlan.js resolveTier().
 */

export type Tier = "lite" | "pro" | "max";

// Server-authoritative Lite caps (mirror of usePlan.js FEATURES.lite).
export const LITE_LIMITS = {
  customerLimit: 30,
  frontDeskMonthlyLimit: 5,
} as const;

/**
 * Canonical tier resolution. subscription_tier is authoritative, but only when
 * it names an upgraded tier; otherwise fall back to the legacy `plan` column,
 * then Lite. Mirrors resolveTier() in src/hooks/usePlan.js — keep them identical.
 */
export function resolveTier(
  p?: { subscription_tier?: string | null; plan?: string | null } | null,
): Tier {
  const t = p?.subscription_tier;
  if (t === "pro" || t === "max") return t;
  if (p?.plan === "pro" || p?.plan === "max") return p.plan as Tier;
  return "lite";
}

export const isPaidTier = (t: Tier): boolean => t === "pro" || t === "max";
