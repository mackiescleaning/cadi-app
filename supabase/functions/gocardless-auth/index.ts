/**
 * supabase/functions/gocardless-auth/index.ts
 * Cadi — GoCardless Partner OAuth handler
 *
 * Actions (all POST with JSON body):
 *   { action: "url" }                    → returns GoCardless OAuth URL + state
 *   { action: "callback", code, state }  → exchanges code, stores access_token + org_id
 *   { action: "status" }                 → returns connection status
 *   { action: "disconnect" }             → clears stored tokens
 *
 * Environment variables (set in Supabase Dashboard → Settings → Edge Functions):
 *   GC_CLIENT_ID          — GoCardless Partner app client ID
 *   GC_CLIENT_SECRET      — GoCardless Partner app client secret
 *   GC_REDIRECT_URI       — e.g. https://app.cadi.cleaning/gocardless/callback
 *   GC_SANDBOX            — "true" for sandbox, "false" for live
 *   SUPABASE_URL          — auto-injected
 *   SUPABASE_SERVICE_ROLE_KEY — auto-injected
 *
 * GoCardless Partner docs: https://developer.gocardless.com/getting-started/partners/
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GC_CLIENT_ID     = Deno.env.get("GC_CLIENT_ID") ?? "";
const GC_CLIENT_SECRET = Deno.env.get("GC_CLIENT_SECRET") ?? "";
const GC_REDIRECT_URI  = Deno.env.get("GC_REDIRECT_URI") ?? "";
const SANDBOX          = Deno.env.get("GC_SANDBOX") !== "false";

const GC_CONNECT_BASE = SANDBOX
  ? "https://connect-sandbox.gocardless.com"
  : "https://connect.gocardless.com";

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
    const body   = await req.json() as Record<string, string>;
    const action = body.action;

    // ── Status ────────────────────────────────────────────────────────────────
    if (action === "status") {
      const { user, sb } = await getUser(req);
      const { data: profile } = await sb
        .from("profiles")
        .select("gc_connected_at, gc_organisation_id")
        .eq("id", user.id)
        .single();

      return json({
        connected:      !!profile?.gc_connected_at,
        connectedAt:    profile?.gc_connected_at ?? null,
        organisationId: profile?.gc_organisation_id ?? null,
        sandbox:        SANDBOX,
      });
    }

    // ── URL: generate GoCardless OAuth authorise URL ──────────────────────────
    if (action === "url") {
      const { user, sb } = await getUser(req);
      const state = crypto.randomUUID();

      await sb
        .from("profiles")
        .upsert({ id: user.id, gc_oauth_state: state }, { onConflict: "id" });

      const params = new URLSearchParams({
        client_id:     GC_CLIENT_ID,
        redirect_uri:  GC_REDIRECT_URI,
        scope:         "read_write",
        response_type: "code",
        state,
      });

      return json({ url: `${GC_CONNECT_BASE}/oauth/authorize?${params}`, sandbox: SANDBOX });
    }

    // ── Callback: exchange code for access_token + organisation_id ────────────
    if (action === "callback") {
      const { user, sb } = await getUser(req);
      const { code, state } = body;

      if (!code || !state) return json({ error: "Missing code or state" }, 400);

      const { data: profile } = await sb
        .from("profiles")
        .select("gc_oauth_state")
        .eq("id", user.id)
        .single();

      if (profile?.gc_oauth_state !== state) {
        return json({ error: "State mismatch — possible CSRF" }, 400);
      }

      const tokenRes = await fetch(`${GC_CONNECT_BASE}/oauth/access_token`, {
        method:  "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body:    new URLSearchParams({
          client_id:     GC_CLIENT_ID,
          client_secret: GC_CLIENT_SECRET,
          code,
          grant_type:    "authorization_code",
          redirect_uri:  GC_REDIRECT_URI,
        }),
      });

      const tokens = await tokenRes.json() as {
        access_token:    string;
        organisation_id: string;
        scope:           string;
        token_type:      string;
        error?:          string;
      };

      if (!tokenRes.ok || tokens.error) {
        return json({ error: "Token exchange failed", detail: tokens }, 400);
      }

      await sb.from("profiles").update({
        gc_access_token:    tokens.access_token,
        gc_organisation_id: tokens.organisation_id,
        gc_connected_at:    new Date().toISOString(),
        gc_oauth_state:     null,
      }).eq("id", user.id);

      return json({
        success:        true,
        organisationId: tokens.organisation_id,
        sandbox:        SANDBOX,
      });
    }

    // ── Disconnect: clear stored tokens ───────────────────────────────────────
    if (action === "disconnect") {
      const { user, sb } = await getUser(req);

      await sb.from("profiles").update({
        gc_access_token:    null,
        gc_organisation_id: null,
        gc_connected_at:    null,
        gc_oauth_state:     null,
      }).eq("id", user.id);

      return json({ success: true });
    }

    return json({ error: `Unknown action: ${action}` }, 400);

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("gocardless-auth error:", msg);
    return json({ error: msg }, msg === "Unauthorized" ? 401 : 500);
  }
});
