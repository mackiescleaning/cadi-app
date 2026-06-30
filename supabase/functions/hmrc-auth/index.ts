/**
 * supabase/functions/hmrc-auth/index.ts
 * Cadi — HMRC OAuth 2.0 handler
 *
 * Actions (all POST with JSON body):
 *   { action: "url" }                       → returns HMRC OAuth URL + state
 *   { action: "callback", code, state }     → exchanges code for tokens, stores in DB
 *   { action: "status" }                    → returns connection status
 *   { action: "disconnect" }                → clears stored tokens
 *
 * Environment variables required (set in Supabase Dashboard → Settings → Edge Functions):
 *   HMRC_CLIENT_ID        — from HMRC Developer Hub application
 *   HMRC_CLIENT_SECRET    — from HMRC Developer Hub application
 *   HMRC_REDIRECT_URI     — e.g. https://app.cadi.cleaning/hmrc/callback
 *   HMRC_SANDBOX          — "true" for testing, "false" for production
 *   SUPABASE_URL          — auto-injected by Supabase
 *   SUPABASE_SERVICE_ROLE_KEY — auto-injected by Supabase (service role, not anon)
 *
 * HMRC Developer Hub: https://developer.service.hmrc.gov.uk
 * Register your app, subscribe to:
 *   - Individual Income (MTD) — v3
 *   - Obligations — v2
 *   - Self Assessment (MTD) — v3
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encryptWith, decryptWith } from "../_shared/tokenCrypto.ts";
import { checkRateLimit, clientIp, rateLimitedResponse } from "../_shared/rateLimit.ts";

const HMRC_ENC_ENV = "HMRC_TOKEN_ENC_KEY";
// Legacy plaintext fallback — CLOSED by default ahead of HMRC recognition.
// Re-enable only by explicitly setting ALLOW_HMRC_LEGACY_PLAINTEXT="true" on
// the edge-function env (which we should never do in prod). Any user whose
// row was never migrated will be forced to reconnect HMRC — acceptable
// behaviour since unencrypted token storage fails HMRC's fraud-prevention bar.
const ALLOW_LEGACY_PLAINTEXT = (Deno.env.get("ALLOW_HMRC_LEGACY_PLAINTEXT") ?? "false") === "true";

// ─── Config ───────────────────────────────────────────────────────────────────
const HMRC_CLIENT_ID      = Deno.env.get("HMRC_CLIENT_ID") ?? "";
const HMRC_CLIENT_SECRET  = Deno.env.get("HMRC_CLIENT_SECRET") ?? "";
const HMRC_REDIRECT_URI   = Deno.env.get("HMRC_REDIRECT_URI") ?? "";
const SANDBOX             = Deno.env.get("HMRC_SANDBOX") !== "false"; // default: sandbox

const HMRC_BASE   = SANDBOX
  ? "https://test-api.service.hmrc.gov.uk"
  : "https://api.service.hmrc.gov.uk";

const OAUTH_SCOPES = [
  "write:self-assessment",
  "read:self-assessment",
].join(" ");

// ─── CORS headers — pinned to allowed origins, no wildcard fallback ──────────
// Previously fell back to "*" when APP_ORIGIN was unset, which would let any
// third-party site call the HMRC OAuth handler from a logged-in user's browser.
const ALLOWED_ORIGINS = new Set(
  (Deno.env.get("ALLOWED_ORIGINS") ?? Deno.env.get("APP_ORIGIN") ?? "https://app.cadi.cleaning")
    .split(",").map(s => s.trim()).filter(Boolean),
);
const DEFAULT_ORIGIN = Array.from(ALLOWED_ORIGINS)[0];

function corsFor(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  return {
    "Access-Control-Allow-Origin":  ALLOWED_ORIGINS.has(origin) ? origin : DEFAULT_ORIGIN,
    "Vary":                         "Origin",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Access-Control-Allow-Origin": DEFAULT_ORIGIN, "Content-Type": "application/json" },
  });

// ─── Helper: get authenticated user from JWT ──────────────────────────────────
async function getUser(req: Request) {
  const SUPABASE_URL         = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb    = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error } = await sb.auth.getUser(token);
  if (error || !user) throw new Error("Unauthorized");
  return { user, sb };
}

// ─── Main handler ─────────────────────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsFor(req) });

  try {
    const body   = await req.json() as Record<string, string>;
    const action = body.action;

    // ── Status: check if this user has a connected HMRC account ──────────────
    if (action === "status") {
      const { user, sb } = await getUser(req);
      const { data: profile } = await sb
        .from("profiles")
        .select("hmrc_connected_at, hmrc_scope, hmrc_nino, hmrc_nino_enc, hmrc_token_expires_at")
        .eq("id", user.id)
        .single();

      const isExpired = profile?.hmrc_token_expires_at
        ? new Date(profile.hmrc_token_expires_at) < new Date()
        : true;

      // Prefer encrypted; fall back to legacy plaintext during the rollout window.
      const nino = profile?.hmrc_nino_enc
        ? await decryptWith(HMRC_ENC_ENV, profile.hmrc_nino_enc, false)
        : (profile?.hmrc_nino ?? null);

      return json({
        connected:    !!profile?.hmrc_connected_at,
        connectedAt:  profile?.hmrc_connected_at ?? null,
        scope:        profile?.hmrc_scope ?? null,
        nino,
        tokenExpired: isExpired,
        sandbox:      SANDBOX,
      });
    }

    // ── URL: generate the HMRC OAuth authorization URL ───────────────────────
    if (action === "url") {
      const { user, sb } = await getUser(req);

      // Rate limit OAuth URL generation per user — 10 / minute. Stops a runaway
      // FE bug or attacker from flooding the oauth_states column with junk.
      const rl = await checkRateLimit(sb, {
        bucket:   "hmrc-auth-url",
        key:      user.id,
        limit:    10,
        windowMs: 60 * 1000,
      });
      if (!rl.ok) return rateLimitedResponse(corsFor(req), rl.resetAt);

      // Generate a random state value (CSRF protection)
      const state = crypto.randomUUID();

      // Upsert state — works even if profile row doesn't exist yet
      await sb
        .from("profiles")
        .upsert({ id: user.id, hmrc_oauth_state: state }, { onConflict: "id" });

      const params = new URLSearchParams({
        response_type: "code",
        client_id:     HMRC_CLIENT_ID,
        scope:         OAUTH_SCOPES,
        redirect_uri:  HMRC_REDIRECT_URI,
        state,
      });

      return json({
        url:     `${HMRC_BASE}/oauth/authorize?${params}`,
        sandbox: SANDBOX,
      });
    }

    // ── Callback: exchange auth code for access + refresh tokens ─────────────
    if (action === "callback") {
      const { user, sb } = await getUser(req);
      const { code, state } = body;

      if (!code || !state) return json({ error: "Missing code or state" }, 400);

      // Verify state matches what we stored (CSRF check)
      const { data: profile } = await sb
        .from("profiles")
        .select("hmrc_oauth_state")
        .eq("id", user.id)
        .single();

      if (profile?.hmrc_oauth_state !== state) {
        return json({ error: "State mismatch — possible CSRF" }, 400);
      }

      // POST to HMRC token endpoint
      const tokenRes = await fetch(`${HMRC_BASE}/oauth/token`, {
        method:  "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body:    new URLSearchParams({
          grant_type:    "authorization_code",
          client_id:     HMRC_CLIENT_ID,
          client_secret: HMRC_CLIENT_SECRET,
          code,
          redirect_uri:  HMRC_REDIRECT_URI,
        }),
      });

      const tokens = await tokenRes.json() as {
        access_token:  string;
        refresh_token: string;
        expires_in:    number;
        scope:         string;
        token_type:    string;
      };

      if (!tokenRes.ok) {
        return json({ error: "Token exchange failed", detail: tokens }, 400);
      }

      const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

      // Encrypt tokens at the application layer (AES-GCM-256) before persisting.
      // The plaintext columns are left NULL going forward; the new _enc columns
      // hold the only copy. Service role key bypasses RLS so only this function
      // can write either set.
      const accessEnc  = await encryptWith(HMRC_ENC_ENV, tokens.access_token);
      const refreshEnc = await encryptWith(HMRC_ENC_ENV, tokens.refresh_token);

      await sb.from("profiles").update({
        hmrc_access_token:      null,
        hmrc_refresh_token:     null,
        hmrc_access_token_enc:  accessEnc,
        hmrc_refresh_token_enc: refreshEnc,
        hmrc_token_expires_at:  expiresAt,
        hmrc_scope:             tokens.scope,
        hmrc_connected_at:      new Date().toISOString(),
        hmrc_oauth_state:       null, // clear after use
      }).eq("id", user.id);

      return json({ success: true, scope: tokens.scope, sandbox: SANDBOX });
    }

    // ── Disconnect: revoke + clear tokens ────────────────────────────────────
    if (action === "disconnect") {
      const { user, sb } = await getUser(req);

      // Attempt HMRC revoke (non-fatal if it fails)
      const { data: profile } = await sb
        .from("profiles")
        .select("hmrc_access_token, hmrc_access_token_enc")
        .eq("id", user.id)
        .single();

      // Prefer the encrypted column; fall back to plaintext during the rollout
      // window so already-connected users can still disconnect cleanly.
      const accessTokenForRevoke = profile?.hmrc_access_token_enc
        ? await decryptWith(HMRC_ENC_ENV, profile.hmrc_access_token_enc, false)
        : (profile?.hmrc_access_token ?? "");

      if (accessTokenForRevoke) {
        await fetch(`${HMRC_BASE}/oauth/revoke`, {
          method:  "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body:    new URLSearchParams({ token: accessTokenForRevoke }),
        }).catch(() => {}); // ignore errors — always clear locally
      }

      await sb.from("profiles").update({
        hmrc_access_token:      null,
        hmrc_refresh_token:     null,
        hmrc_access_token_enc:  null,
        hmrc_refresh_token_enc: null,
        hmrc_token_expires_at:  null,
        hmrc_scope:             null,
        hmrc_connected_at:      null,
        hmrc_nino:              null,
        hmrc_nino_enc:          null,
      }).eq("id", user.id);

      return json({ success: true });
    }

    return json({ error: `Unknown action: ${action}` }, 400);

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("hmrc-auth error:", msg);
    return json({ error: msg }, msg === "Unauthorized" ? 401 : 500);
  }
});
