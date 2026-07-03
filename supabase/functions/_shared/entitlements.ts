/**
 * _shared/entitlements.ts
 * Server-side plan entitlements — the trustworthy mirror of src/hooks/usePlan.js.
 *
 * The client FEATURES matrix is advisory only: anyone can call an edge function
 * directly and skip the React gate. Edge functions that perform paid-tier
 * actions MUST gate on these helpers instead. They read `subscription_tier` from
 * `profiles` — a column written only by the signature-verified Stripe webhook
 * and protected from client tampering by the enforce_profile_protected_columns
 * trigger — so it is a trustworthy server-side source of truth.
 *
 * Keep LITE_LIMITS in sync with FEATURES.lite in src/hooks/usePlan.js.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export type Tier = "lite" | "pro" | "max";
type SB = ReturnType<typeof createClient>;

// Server-authoritative Lite caps (mirror of usePlan.js FEATURES.lite).
export const LITE_LIMITS = {
  customerLimit:         30,
  frontDeskMonthlyLimit: 5,
} as const;

/** Canonical tier resolution — mirrors resolveTier() in usePlan.js. */
export function resolveTier(
  p?: { subscription_tier?: string | null; plan?: string | null } | null,
): Tier {
  const t = p?.subscription_tier;
  if (t === "pro" || t === "max") return t;
  if (p?.plan === "pro" || p?.plan === "max") return p.plan as Tier;
  return "lite";
}

export const isPaidTier = (t: Tier): boolean => t === "pro" || t === "max";

/** Resolve a user's tier from their profile (subscription_tier → plan → lite). */
export async function tierForUser(sb: SB, userId: string): Promise<Tier> {
  const { data } = await sb
    .from("profiles")
    .select("subscription_tier, plan")
    .eq("id", userId)
    .maybeSingle();
  return resolveTier(data as { subscription_tier?: string; plan?: string } | null);
}

/** Resolve the owning tier for a business (via businesses.owner_user_id). */
export async function tierForBusiness(sb: SB, businessId: string): Promise<Tier> {
  const { data: biz } = await sb
    .from("businesses")
    .select("owner_user_id")
    .eq("id", businessId)
    .maybeSingle();
  const ownerId = biz?.owner_user_id as string | undefined;
  if (!ownerId) return "lite";
  return tierForUser(sb, ownerId);
}
