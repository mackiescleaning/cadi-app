/**
 * _shared/timingSafeEqual.ts
 * Constant-time string comparison for webhook signature checks.
 *
 * A plain `a === b` short-circuits on the first differing byte, leaking — via
 * response timing — how much of a forged signature was correct, which enables a
 * byte-at-a-time forgery attack. This compares in time independent of where the
 * first mismatch is.
 *
 * Dependency-free so both the Deno webhook functions (gocardless-webhook,
 * resend-webhook) and the Vitest suite (src/test/timingSafeEqual.test.js) use it.
 *
 * Note: the string LENGTHS are still compared up front and can differ in timing;
 * that's acceptable because a signature's length is not secret (the scheme fixes
 * it). What must not leak is the content comparison.
 */

/** Constant-time equality for two strings. Returns false on any length mismatch. */
export function timingSafeEqualStr(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
