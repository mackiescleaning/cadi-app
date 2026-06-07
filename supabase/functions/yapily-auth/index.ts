/**
 * supabase/functions/yapily-auth/index.ts
 * Cadi — Yapily OAuth handler for Open Banking (production-ready)
 *
 * Actions (POST with JSON body):
 *   { action: "institutions" }                            → list available UK banks
 *   { action: "url", institutionId }                      → create consent + return URL; REQUIRES institutionId
 *   { action: "callback", consent, state, institutionId } → verify state, store consent, fetch accounts
 *   { action: "status" }                                  → connection status + bank metadata + reauth flag
 *   { action: "disconnect" }                              → revokes consent at Yapily + marks inactive
 *
 * Security:
 *   - All bank consent tokens encrypted at rest (AES-GCM-256). Fails closed if key missing.
 *   - OAuth state nonce prevents cross-account consent linking.
 *   - On disconnect, calls Yapily DELETE /consents/{id} for PSD2 compliance.
 *   - Allowed origins pinned via ALLOWED_ORIGINS env var (comma-separated).
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const APP_ID         = Deno.env.get("YAPILY_APP_ID")     ?? "";
const APP_SECRET     = Deno.env.get("YAPILY_SECRET")     ?? "";
const ENC_KEY_HEX    = Deno.env.get("BANK_TOKEN_ENC_KEY") ?? "";
const REDIRECT_URI   = Deno.env.get("YAPILY_REDIRECT_URI") ?? "https://app.cadi.cleaning/yapily/callback";
const API_BASE       = "https://api.yapily.com";

// Fail fast at boot — every prod-critical secret must be present and well-formed.
// This throws before serve() is set up so the function never accepts requests with a broken config.
function assertEnv() {
  const problems: string[] = [];
  if (!APP_ID)                      problems.push("YAPILY_APP_ID is unset");
  if (!APP_SECRET)                  problems.push("YAPILY_SECRET is unset");
  if (!ENC_KEY_HEX)                 problems.push("BANK_TOKEN_ENC_KEY is unset");
  else if (ENC_KEY_HEX.length !== 64) problems.push(`BANK_TOKEN_ENC_KEY must be 64 hex chars (got ${ENC_KEY_HEX.length})`);
  else if (!/^[0-9a-fA-F]{64}$/.test(ENC_KEY_HEX)) problems.push("BANK_TOKEN_ENC_KEY must be hex");
  if (problems.length) {
    throw new Error(`yapily-auth config invalid: ${problems.join("; ")}`);
  }
}
assertEnv();

const BASIC_AUTH = "Basic " + btoa(`${APP_ID}:${APP_SECRET}`);

// ── Token encryption (AES-GCM-256) ────────────────────────────────────────────
// Ciphertext format: "enc:v1:<iv_hex>:<ciphertext_b64>"
// FAILS CLOSED — if the key is missing/invalid, encryption throws rather than
// silently persisting plaintext tokens. assertEnv() above already validates the key.

let _cachedKey: CryptoKey | null = null;
async function getEncKey(): Promise<CryptoKey> {
  if (_cachedKey) return _cachedKey;
  const raw = new Uint8Array(ENC_KEY_HEX.match(/.{2}/g)!.map(b => parseInt(b, 16)));
  _cachedKey = await crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
  return _cachedKey;
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}
function unhex(s: string): Uint8Array {
  return new Uint8Array(s.match(/.{2}/g)!.map(b => parseInt(b, 16)));
}
function b64(bytes: Uint8Array): string {
  let s = ""; for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
function unb64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function encryptToken(plaintext: string): Promise<string> {
  const key = await getEncKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plaintext));
  return `enc:v1:${hex(iv)}:${b64(new Uint8Array(ct))}`;
}

async function decryptToken(stored: string | null | undefined): Promise<string> {
  if (!stored) return "";
  if (!stored.startsWith("enc:v1:")) {
    // Legacy plaintext rows from sandbox era. ALLOW_LEGACY_PLAINTEXT_TOKENS gates this in prod.
    if (Deno.env.get("ALLOW_LEGACY_PLAINTEXT_TOKENS") !== "true") {
      throw new Error("Refusing to use unencrypted legacy token (set ALLOW_LEGACY_PLAINTEXT_TOKENS=true to migrate)");
    }
    return stored;
  }
  const key = await getEncKey();
  const [, , ivHex, ctB64] = stored.split(":");
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unhex(ivHex) }, key, unb64(ctB64));
  return new TextDecoder().decode(pt);
}

// ── CORS — pinned to known origins ────────────────────────────────────────────
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ??
  "https://app.cadi.cleaning,https://cadi.cleaning,http://localhost:5173,http://localhost:3000")
  .split(",").map(s => s.trim()).filter(Boolean);

function corsHeaders(origin: string | null): HeadersInit {
  const allow = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin":  allow,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary":                         "Origin",
  };
}

function json(data: unknown, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
  });
}

// ── Yapily helpers ────────────────────────────────────────────────────────────
async function yapilyFetch(path: string, opts: RequestInit = {}, consentToken?: string) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      Authorization: BASIC_AUTH,
      "Content-Type": "application/json",
      ...(consentToken ? { consent: consentToken } : {}),
      ...(opts.headers ?? {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const raw = data?.error?.message ?? data?.message ?? data?.error ?? data;
    const msg = typeof raw === "string" ? raw : JSON.stringify(raw);
    throw new Error(`Yapily ${res.status}: ${msg}`);
  }
  return data;
}

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

async function ensureYapilyUser(userId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/users`, {
    method: "POST",
    headers: { Authorization: BASIC_AUTH, "Content-Type": "application/json" },
    body: JSON.stringify({ applicationUserId: userId }),
  });
  if (res.ok || res.status === 409) return;
  const data = await res.json().catch(() => ({}));
  const raw = data?.error?.message ?? data?.message ?? data?.error ?? data;
  const msg = typeof raw === "string" ? raw : JSON.stringify(raw);
  throw new Error(`Yapily ${res.status}: ${msg}`);
}

// ── Main handler ──────────────────────────────────────────────────────────────
serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(origin) });

  try {
    const body   = await req.json() as Record<string, unknown>;
    const action = body.action as string;
    const { user, sb } = await getUser(req);

    // ── institutions ──────────────────────────────────────────────────────────
    if (action === "institutions") {
      const data = await yapilyFetch("/institutions?countries=GB&features=ACCOUNT_STATEMENT&sort=full_name");
      const institutions = (data.data ?? []).map((inst: Record<string, unknown>) => ({
        id:      inst.id,
        name:    inst.fullName ?? inst.name,
        logoUrl: (inst.media as Array<{ source: string; type: string }>)
          ?.find((m) => m.type === "icon")?.source ?? null,
        countries: inst.countries ?? [],
      }));
      return json({ institutions }, 200, origin);
    }

    // ── url ───────────────────────────────────────────────────────────────────
    // institutionId is REQUIRED. No default — sandbox banks are gated by the
    // client passing the sandbox id explicitly when VITE_YAPILY_ENV=sandbox.
    if (action === "url") {
      const institutionId = body.institutionId as string;
      if (!institutionId || typeof institutionId !== "string") {
        return json({ error: "institutionId required" }, 400, origin);
      }

      await ensureYapilyUser(user.id);

      // Generate CSRF nonce and persist before redirect. Lifetime 15 min.
      const state = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      const { error: stateErr } = await sb.from("oauth_states").insert({
        state, user_id: user.id, provider: "yapily", institution_id: institutionId, expires_at: expiresAt,
      });
      if (stateErr) throw new Error(`Could not persist OAuth state: ${stateErr.message}`);

      // Append state to callback URL so the IDP echoes it back
      const callbackUrl = `${REDIRECT_URI}?state=${encodeURIComponent(state)}`;

      const consent = await yapilyFetch("/account-auth-requests", {
        method: "POST",
        body: JSON.stringify({
          applicationUserId: user.id,
          institutionId,
          callback: callbackUrl,
        }),
      });

      const authorisationUrl = consent?.data?.authorisationUrl;
      if (!authorisationUrl) throw new Error("No authorisationUrl returned from Yapily");

      return json({ url: authorisationUrl, state }, 200, origin);
    }

    // ── callback ──────────────────────────────────────────────────────────────
    if (action === "callback") {
      const consentToken = body.consent as string;
      const state        = body.state   as string | undefined;
      if (!consentToken) return json({ error: "Missing consent token" }, 400, origin);
      if (!state)        return json({ error: "Missing state parameter" }, 400, origin);

      // Verify + consume the state nonce. Must match this user and not be expired.
      const { data: stateRow, error: stateErr } = await sb
        .from("oauth_states")
        .select("user_id, institution_id, expires_at")
        .eq("state", state)
        .maybeSingle();
      if (stateErr) throw new Error(stateErr.message);
      if (!stateRow)                                  return json({ error: "Invalid state" }, 400, origin);
      if (stateRow.user_id !== user.id)               return json({ error: "State user mismatch" }, 403, origin);
      if (new Date(stateRow.expires_at) < new Date()) return json({ error: "State expired" }, 400, origin);
      // Consume the state (one-shot)
      await sb.from("oauth_states").delete().eq("state", state);

      const businessId = await getBusinessId(sb, user.id);

      // Identify the consent by ID. We pull the user's full consent list and
      // match the most recent for the expected institution, then verify owner.
      const consentList = await yapilyFetch(`/users/${user.id}/consents`).catch(() => ({ data: [] }));
      const matching = (consentList?.data ?? [])
        .filter((c: { institutionId: string; applicationUserId?: string; status?: string }) =>
          c.institutionId === stateRow.institution_id && c.applicationUserId === user.id)
        .sort((a: { createdAt: string }, b: { createdAt: string }) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

      if (matching && matching.applicationUserId !== user.id) {
        return json({ error: "Consent does not belong to this user" }, 403, origin);
      }

      const yapilyConsentId   = matching?.id ?? null;
      const consentExpiresAt  = matching?.expiresAt ?? null; // 90-day rolling, set by Yapily

      // Deactivate any previous connection (and revoke its consent — see disconnect logic below)
      const { data: prevConns } = await sb
        .from("bank_connections")
        .select("id, access_token, yapily_consent_id")
        .eq("business_id", businessId)
        .eq("is_active", true);

      for (const pc of (prevConns ?? [])) {
        if (pc.yapily_consent_id) {
          await fetch(`${API_BASE}/consents/${pc.yapily_consent_id}`, {
            method: "DELETE", headers: { Authorization: BASIC_AUTH },
          }).catch(() => {});
        }
      }
      await sb
        .from("bank_connections")
        .update({ is_active: false, disconnected_at: new Date().toISOString(), access_token: null })
        .eq("business_id", businessId)
        .eq("is_active", true);

      // Fetch all accounts under this consent (multi-account banks supported)
      let accounts: Array<{ id: string; accountNames?: Array<{ name: string }>; accountIdentifications?: Array<{ type: string; identification: string }>; type?: string; currency?: string }> = [];
      try {
        const acctData = await fetch(`${API_BASE}/accounts`, {
          headers: { Authorization: BASIC_AUTH, consent: consentToken },
        }).then(r => r.json());
        accounts = acctData?.data ?? [];
      } catch {
        // Non-fatal — accounts populated on first sync
      }

      const firstAcct = accounts[0];
      const bankName = stateRow.institution_id
        .replace(/-sandbox$/, "")
        .replace(/-/g, " ")
        .replace(/\b\w/g, (l: string) => l.toUpperCase());

      const { data: conn, error: connErr } = await sb
        .from("bank_connections")
        .insert({
          business_id:          businessId,
          provider:             "yapily",
          truelayer_account_id: firstAcct?.id ?? null, // primary, for display
          bank_name:            bankName,
          account_name:         firstAcct?.accountNames?.[0]?.name ?? null,
          account_last_4:       firstAcct?.accountIdentifications
                                  ?.find((i) => i.type === "ACCOUNT_NUMBER")
                                  ?.identification?.slice(-4) ?? null,
          access_token:         await encryptToken(consentToken),
          refresh_token:        null,
          token_expires_at:     null,
          yapily_consent_id:    yapilyConsentId,
          consent_expires_at:   consentExpiresAt,
          needs_reauth:         false,
          sync_error:           null,
          sync_error_code:      null,
          is_active:            true,
          connected_at:         new Date().toISOString(),
        })
        .select("id, bank_name, account_last_4")
        .single();

      if (connErr) throw new Error(connErr.message);

      // Persist all bank accounts so multi-account banks work end-to-end
      if (accounts.length > 0) {
        const rows = accounts.map(a => ({
          business_id:        businessId,
          bank_connection_id: conn.id,
          yapily_account_id:  a.id,
          account_name:       a.accountNames?.[0]?.name ?? null,
          account_type:       a.type ?? null,
          account_last_4:     a.accountIdentifications
                                ?.find((i) => i.type === "ACCOUNT_NUMBER")
                                ?.identification?.slice(-4) ?? null,
          currency:           a.currency ?? "GBP",
          is_included:        true,
        }));
        const { error: acctErr } = await sb.from("bank_accounts").insert(rows);
        if (acctErr) console.error("bank_accounts insert error:", acctErr.message);
      }

      return json({
        success:      true,
        connectionId: conn.id,
        bankName:     conn.bank_name,
        accountLast4: conn.account_last_4,
        accountCount: accounts.length,
      }, 200, origin);
    }

    // ── status ────────────────────────────────────────────────────────────────
    if (action === "status") {
      const businessId = await getBusinessId(sb, user.id);

      const { data: conn } = await sb
        .from("bank_connections")
        .select("id, bank_name, account_name, account_last_4, connected_at, last_sync_at, is_active, consent_expires_at, needs_reauth, sync_error, sync_error_code, last_sync_error_at")
        .eq("business_id", businessId)
        .eq("is_active", true)
        .order("connected_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // Surface re-consent warning when expiry is within 14 days
      let reconsentDaysLeft: number | null = null;
      if (conn?.consent_expires_at) {
        const daysLeft = Math.ceil((new Date(conn.consent_expires_at).getTime() - Date.now()) / 86_400_000);
        if (daysLeft <= 14) reconsentDaysLeft = daysLeft;
      }

      // Count accounts under this connection
      let accountCount = 0;
      if (conn?.id) {
        const { count } = await sb
          .from("bank_accounts")
          .select("id", { count: "exact", head: true })
          .eq("bank_connection_id", conn.id);
        accountCount = count ?? 0;
      }

      return json({
        connected:        !!conn,
        bankName:         conn?.bank_name        ?? null,
        accountName:      conn?.account_name     ?? null,
        accountLast4:     conn?.account_last_4   ?? null,
        connectedAt:      conn?.connected_at     ?? null,
        lastSyncAt:       conn?.last_sync_at     ?? null,
        consentExpiresAt: conn?.consent_expires_at ?? null,
        needsReauth:      !!conn?.needs_reauth,
        reconsentDaysLeft,
        syncError:        conn?.sync_error        ?? null,
        syncErrorCode:    conn?.sync_error_code   ?? null,
        lastSyncErrorAt:  conn?.last_sync_error_at ?? null,
        accountCount,
        syncReady:        !!(conn?.last_sync_at),
      }, 200, origin);
    }

    // ── disconnect ────────────────────────────────────────────────────────────
    // Revoke the consent at Yapily AND mark inactive locally. Falls back to
    // marking inactive even if Yapily call fails (user expectation is one-click).
    if (action === "disconnect") {
      const businessId = await getBusinessId(sb, user.id);

      const { data: conns } = await sb
        .from("bank_connections")
        .select("id, yapily_consent_id")
        .eq("business_id", businessId)
        .eq("is_active", true);

      for (const c of (conns ?? [])) {
        if (c.yapily_consent_id) {
          await fetch(`${API_BASE}/consents/${c.yapily_consent_id}`, {
            method: "DELETE", headers: { Authorization: BASIC_AUTH },
          }).catch(() => { /* tolerate 404 / network — local row will still be deactivated */ });
        }
      }

      // Drop the encrypted token so a future leak can't replay it
      await sb
        .from("bank_connections")
        .update({
          is_active:        false,
          disconnected_at:  new Date().toISOString(),
          access_token:     null,
          needs_reauth:     false,
        })
        .eq("business_id", businessId)
        .eq("is_active", true);

      return json({ success: true }, 200, origin);
    }

    return json({ error: `Unknown action: ${action}` }, 400, origin);

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("yapily-auth error:", msg);
    return json({ error: msg }, msg === "Unauthorized" ? 401 : 500, origin);
  }
});
