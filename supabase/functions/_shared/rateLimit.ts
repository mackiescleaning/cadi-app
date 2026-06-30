/**
 * supabase/functions/_shared/rateLimit.ts
 *
 * Lightweight rate limiter backed by the `rate_limits` table + the
 * `check_and_increment_rate_limit` RPC. Fixed-window per (bucket, key).
 *
 * Designed for security-sensitive low-traffic endpoints (auth, PIN, invite
 * lookup) — one DB roundtrip per call is acceptable. NOT suitable for
 * high-RPS request paths (those should use a KV store).
 *
 * Bucket = logical endpoint name. Key = the dimension being rate-limited
 * (usually IP, optionally + token). Both are caller-supplied.
 *
 * Returns { ok, count, resetAt }. On `ok: false`, caller responds with 429
 * and a Retry-After header.
 */

// deno-lint-ignore no-explicit-any
type Sb = any;

export function clientIp(req: Request): string {
  // Supabase edge runtime forwards the real client IP in x-forwarded-for.
  // First IP in the comma-separated list is the originator.
  const xff = req.headers.get("x-forwarded-for") ?? "";
  const ip = xff.split(",")[0].trim();
  return ip || (req.headers.get("x-real-ip") ?? "unknown");
}

export async function checkRateLimit(
  sb: Sb,
  opts: { bucket: string; key: string; limit: number; windowMs: number },
): Promise<{ ok: boolean; count: number; resetAt: string }> {
  const { data, error } = await sb.rpc("check_and_increment_rate_limit", {
    p_bucket:    opts.bucket,
    p_key:       opts.key,
    p_limit:     opts.limit,
    p_window_ms: opts.windowMs,
  });
  if (error) {
    // Fail OPEN on rate-limit DB errors so a transient DB blip can't lock
    // legit users out — the lockout counters in the business logic itself
    // (e.g. validate_staff_pin) are the security backstop.
    console.error("rate-limit RPC error:", error);
    return { ok: true, count: 0, resetAt: new Date().toISOString() };
  }
  const row = Array.isArray(data) ? data[0] : data;
  return {
    ok:      !!row?.ok,
    count:   row?.count ?? 0,
    resetAt: row?.reset_at ?? new Date().toISOString(),
  };
}

/** Build a JSON 429 response with Retry-After. */
export function rateLimitedResponse(corsHeaders: Record<string, string>, resetAt: string): Response {
  const retryAfterSec = Math.max(1, Math.ceil((new Date(resetAt).getTime() - Date.now()) / 1000));
  return new Response(
    JSON.stringify({ error: "Too many requests. Please slow down.", retry_after_ms: retryAfterSec * 1000 }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Retry-After":  String(retryAfterSec),
      },
    },
  );
}
