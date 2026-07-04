/**
 * _shared/scrub.ts
 * Pure PII/secret redaction for the GDPR export (export-data function).
 *
 * Dependency-free so the Vitest suite (src/test/scrub.test.js) can assert that
 * every sensitive field shape is redacted — a silent regression here would leak
 * OAuth tokens / signing keys into a user-downloadable export.
 */

// Field-name pattern: broadened to catch every token/key shape we know about plus
// likely future additions (webhook signing keys, bearer tokens, encrypted blobs,
// OAuth state, etc).
const SENSITIVE =
  /access_token|refresh_token|id_token|bearer|consent(_id|_token)?|secret|api_key|signing_key|webhook_secret|password|hash|salt|cookie|csrf|enc:v1:|nonce|otp|verification_code/i;

/** Strip sensitive fields from a single row (shallow). */
export function scrub<T extends Record<string, unknown>>(row: T): T {
  const out = { ...row } as Record<string, unknown>;
  for (const key of Object.keys(out)) {
    if (SENSITIVE.test(key)) {
      out[key] = "[REDACTED for security]";
    } else if (typeof out[key] === "string" && /^enc:v1:/.test(out[key] as string)) {
      // Defence-in-depth: also redact encrypted blobs we missed by key name.
      out[key] = "[REDACTED encrypted value]";
    }
  }
  return out as T;
}
