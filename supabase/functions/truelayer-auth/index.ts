/**
 * supabase/functions/truelayer-auth/index.ts
 * Cadi — TrueLayer OAuth handler for open banking
 *
 * Actions (POST with JSON body):
 *   { action: "url" }                    → returns TrueLayer OAuth URL + state
 *   { action: "callback", code, state }  → exchanges code, stores tokens
 *   { action: "status" }                 → returns connection status
 *   { action: "disconnect" }             → clears stored tokens
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SANDBOX       = Deno.env.get("TL_SANDBOX") !== "false";
const CLIENT_ID     = Deno.env.get("TL_CLIENT_ID") ?? "";
const CLIENT_SECRET = Deno.env.get("TL_CLIENT_SECRET") ?? "";
const REDIRECT_URI  = "https://app.cadi.cleaning/truelayer/callback";

const AUTH_BASE = SANDBOX
  ? "https://auth.truelayer-sandbox.com"
  : "https://auth.truelayer.com";

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

async function getUser(req: Request) {
  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  const { data: { user }, error } = await sb.auth.getUser(token);
  if (error || !user) throw new Error("Unauthorized");
  return { user, sb };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const body   = await req.json() as Record<string, unknown>;
    const action = body.action as string;
    const { user, sb } = await getUser(req);

    // ── url ───────────────────────────────────────────────────────────────────
    if (action === "url") {
      const state = crypto.randomUUID();
      await sb.from("profiles").update({ tl_oauth_state: state }).eq("id", user.id);

      const providers = SANDBOX ? "mock" : "uk-ob-all uk-oauth-all";
      const params = new URLSearchParams({
        response_type: "code",
        client_id:     CLIENT_ID,
        scope:         "accounts transactions balance offline_access",
        redirect_uri:  REDIRECT_URI,
        providers,
        state,
      });

      return json({ url: `${AUTH_BASE}/?${params}` });
    }

    // ── callback ──────────────────────────────────────────────────────────────
    if (action === "callback") {
      const { code, state } = body as { code: string; state: string };

      const { data: profile } = await sb
        .from("profiles")
        .select("tl_oauth_state")
        .eq("id", user.id)
        .single();

      if (!profile || profile.tl_oauth_state !== state) {
        return json({ error: "Invalid state — possible CSRF" }, 400);
      }

      const tokenRes = await fetch(`${AUTH_BASE}/connect/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type:    "authorization_code",
          client_id:     CLIENT_ID,
          client_secret: CLIENT_SECRET,
          code,
          redirect_uri:  REDIRECT_URI,
        }),
      });

      const tokens = await tokenRes.json();
      if (!tokenRes.ok) throw new Error(tokens.error_description ?? "Token exchange failed");

      await sb.from("profiles").update({
        tl_access_token:  tokens.access_token,
        tl_refresh_token: tokens.refresh_token,
        tl_connected_at:  new Date().toISOString(),
        tl_oauth_state:   null,
      }).eq("id", user.id);

      return json({ success: true });
    }

    // ── status ────────────────────────────────────────────────────────────────
    if (action === "status") {
      const { data: profile } = await sb
        .from("profiles")
        .select("tl_connected_at")
        .eq("id", user.id)
        .single();

      return json({
        connected:   !!profile?.tl_connected_at,
        connectedAt: profile?.tl_connected_at ?? null,
      });
    }

    // ── disconnect ────────────────────────────────────────────────────────────
    if (action === "disconnect") {
      await sb.from("profiles").update({
        tl_access_token:  null,
        tl_refresh_token: null,
        tl_connected_at:  null,
      }).eq("id", user.id);
      return json({ success: true });
    }

    return json({ error: `Unknown action: ${action}` }, 400);

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("truelayer-auth error:", msg);
    return json({ error: msg }, msg === "Unauthorized" ? 401 : 500);
  }
});
