/**
 * supabase/functions/truelayer-auth/index.ts
 * Cadi — TrueLayer OAuth handler for Open Banking (Phase 2)
 *
 * Actions (POST with JSON body):
 *   { action: "url" }                    → returns TrueLayer OAuth URL + state
 *   { action: "callback", code, state }  → exchanges code, stores to bank_connections
 *   { action: "status" }                 → returns connection status + bank metadata
 *   { action: "disconnect" }             → marks bank_connection inactive
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { tierForUser, isPaidTier } from "../_shared/entitlements.ts";

const SANDBOX       = Deno.env.get("TL_SANDBOX") !== "false";
const CLIENT_ID     = Deno.env.get("TL_CLIENT_ID") ?? "";
const CLIENT_SECRET = Deno.env.get("TL_CLIENT_SECRET") ?? "";
const REDIRECT_URI  = "https://app.cadi.cleaning/truelayer/callback";

const AUTH_BASE = SANDBOX
  ? "https://auth.truelayer-sandbox.com"
  : "https://auth.truelayer.com";

const API_BASE = SANDBOX
  ? "https://api.truelayer-sandbox.com"
  : "https://api.truelayer.com";

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

async function getBusinessId(
  sb: ReturnType<typeof createClient>,
  userId: string,
): Promise<string> {
  const { data, error } = await sb
    .from("businesses")
    .select("id")
    .eq("owner_user_id", userId)
    .single();
  if (error || !data) throw new Error("Business not found");
  return data.id;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const body   = await req.json() as Record<string, unknown>;
    const action = body.action as string;
    const { user, sb } = await getUser(req);

    // ── url ───────────────────────────────────────────────────────────────────
    if (action === "url") {
      // Server-side entitlement gate: open banking is a paid feature. The client
      // UI hides it for Lite, but that gate is bypassable by calling this directly.
      if (!isPaidTier(await tierForUser(sb, user.id))) {
        return json({ error: "Open banking requires a Pro or Max plan.", upgrade_required: true }, 403);
      }

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

      await sb.from("profiles").update({ tl_oauth_state: null }).eq("id", user.id);

      const businessId = await getBusinessId(sb, user.id);

      // Fetch account metadata for display
      let bankName    = null;
      let last4       = null;
      let accountName = null;
      let accountId   = null;

      try {
        const acctRes = await fetch(`${API_BASE}/data/v1/accounts`, {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        });
        if (acctRes.ok) {
          const acctData = await acctRes.json();
          const acct     = acctData.results?.[0];
          if (acct) {
            bankName    = acct.provider?.display_name ?? acct.provider?.provider_id ?? null;
            last4       = acct.account_number?.number?.slice(-4) ?? null;
            accountName = acct.display_name ?? null;
            accountId   = acct.account_id ?? null;
          }
        }
      } catch {
        // Non-fatal — metadata filled on first sync
      }

      // Deactivate any previous connection
      await sb
        .from("bank_connections")
        .update({ is_active: false, disconnected_at: new Date().toISOString() })
        .eq("business_id", businessId)
        .eq("is_active", true);

      const { data: conn, error: connErr } = await sb
        .from("bank_connections")
        .insert({
          business_id:          businessId,
          provider:             "truelayer",
          truelayer_account_id: accountId,
          bank_name:            bankName,
          account_name:         accountName,
          account_last_4:       last4,
          access_token:         tokens.access_token,
          refresh_token:        tokens.refresh_token,
          token_expires_at:     tokens.expires_in
            ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
            : null,
          is_active:    true,
          connected_at: new Date().toISOString(),
        })
        .select("id, bank_name, account_last_4")
        .single();

      if (connErr) throw new Error(connErr.message);

      return json({
        success:      true,
        connectionId: conn.id,
        bankName:     conn.bank_name,
        accountLast4: conn.account_last_4,
      });
    }

    // ── status ────────────────────────────────────────────────────────────────
    if (action === "status") {
      const businessId = await getBusinessId(sb, user.id);

      const { data: conn } = await sb
        .from("bank_connections")
        .select("id, bank_name, account_name, account_last_4, connected_at, last_sync_at, is_active")
        .eq("business_id", businessId)
        .eq("is_active", true)
        .order("connected_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      return json({
        connected:    !!conn,
        bankName:     conn?.bank_name ?? null,
        accountName:  conn?.account_name ?? null,
        accountLast4: conn?.account_last_4 ?? null,
        connectedAt:  conn?.connected_at ?? null,
        lastSyncAt:   conn?.last_sync_at ?? null,
        syncReady:    !!(conn?.last_sync_at),
      });
    }

    // ── disconnect ────────────────────────────────────────────────────────────
    if (action === "disconnect") {
      const businessId = await getBusinessId(sb, user.id);

      await sb
        .from("bank_connections")
        .update({ is_active: false, disconnected_at: new Date().toISOString() })
        .eq("business_id", businessId)
        .eq("is_active", true);

      return json({ success: true });
    }

    return json({ error: `Unknown action: ${action}` }, 400);

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("truelayer-auth error:", msg);
    return json({ error: msg }, msg === "Unauthorized" ? 401 : 500);
  }
});
