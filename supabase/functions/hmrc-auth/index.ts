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
 *   HMRC_REDIRECT_URI     — e.g. https://app.cadi.co.uk/hmrc/callback
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

// ─── CORS headers ─────────────────────────────────────────────────────────────
const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

// ─── Helper: get authenticated user from JWT ──────────────────────────────────
async function getUser(req: Request) {
  const SUPABASE_URL         = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb    = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const token = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
  const { data: { user }, error } = await sb.auth.getUser(token);
  if (error || !user) throw new Error("Unauthorized");
  return { user, sb };
}

// ─── Main handler ─────────────────────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const body   = await req.json() as Record<string, string>;
    const action = body.action;

    // ── Status: check if this user has a connected HMRC account ──────────────
    if (action === "status") {
      const { user, sb } = await getUser(req);
      const { data: profile } = await sb
        .from("profiles")
        .select("hmrc_connected_at, hmrc_scope, hmrc_nino, hmrc_token_expires_at")
        .eq("id", user.id)
        .single();

      const isExpired = profile?.hmrc_token_expires_at
        ? new Date(profile.hmrc_token_expires_at) < new Date()
        : true;

      return json({
        connected:    !!profile?.hmrc_connected_at,
        connectedAt:  profile?.hmrc_connected_at ?? null,
        scope:        profile?.hmrc_scope ?? null,
        nino:         profile?.hmrc_nino ?? null,
        tokenExpired: isExpired,
        sandbox:      SANDBOX,
      });
    }

    // ── URL: generate the HMRC OAuth authorization URL ───────────────────────
    if (action === "url") {
      const { user, sb } = await getUser(req);

      // Generate a random state value (CSRF protection)
      const state = crypto.randomUUID();

      // Persist state so callback can verify it
      await sb
        .from("profiles")
        .update({ hmrc_oauth_state: state })
        .eq("id", user.id);

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
        console.error("HMRC token exchange failed:", tokens);
        return json({ error: "Token exchange failed", detail: tokens }, 400);
      }

      const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

      // Store tokens — service role key bypasses RLS so only this function can write them
      await sb.from("profiles").update({
        hmrc_access_token:    tokens.access_token,
        hmrc_refresh_token:   tokens.refresh_token,
        hmrc_token_expires_at: expiresAt,
        hmrc_scope:           tokens.scope,
        hmrc_connected_at:    new Date().toISOString(),
        hmrc_oauth_state:     null, // clear after use
      }).eq("id", user.id);

      return json({ success: true, scope: tokens.scope, sandbox: SANDBOX });
    }

    // ── Disconnect: revoke + clear tokens ────────────────────────────────────
    if (action === "disconnect") {
      const { user, sb } = await getUser(req);

      // Attempt HMRC revoke (non-fatal if it fails)
      const { data: profile } = await sb
        .from("profiles")
        .select("hmrc_access_token")
        .eq("id", user.id)
        .single();

      if (profile?.hmrc_access_token) {
        await fetch(`${HMRC_BASE}/oauth/revoke`, {
          method:  "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body:    new URLSearchParams({ token: profile.hmrc_access_token }),
        }).catch(() => {}); // ignore errors — always clear locally
      }

      await sb.from("profiles").update({
        hmrc_access_token:     null,
        hmrc_refresh_token:    null,
        hmrc_token_expires_at: null,
        hmrc_scope:            null,
        hmrc_connected_at:     null,
        hmrc_nino:             null,
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
