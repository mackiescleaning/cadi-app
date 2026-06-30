/**
 * supabase/functions/hmrc-api/index.ts
 * Cadi — HMRC MTD ITSA API proxy
 *
 * This function sits between the React app and HMRC's API.
 * The browser can't call HMRC directly (no CORS). We proxy through here,
 * automatically refreshing the access token when needed.
 *
 * Actions (POST with JSON body, user must be authenticated):
 *
 *   { action: "businesses" }
 *     → GET /individuals/business/details/{nino}/list
 *     → Returns the user's self-employment business ID (needed for all submissions)
 *
 *   { action: "obligations", fromDate, toDate }
 *     → GET /obligations/details/{nino}/income-tax
 *     → Returns which quarterly periods are open, fulfilled, or overdue
 *
 *   { action: "submit_quarter", businessId, periodStart, periodEnd, income, expenses }
 *     → POST /individuals/self-assessment/{nino}/self-employments/{businessId}/periods
 *     → Submits a quarterly income + expense summary to HMRC
 *     → income:   { turnover: number }
 *     → expenses: { costOfGoods?, travelCosts?, adminCosts?, advertisingCosts?, other?, ... }
 *
 *   { action: "trigger_calculation", taxYear }
 *     → POST /individuals/calculations/{nino}/self-assessment/{taxYear}
 *     → Asks HMRC to produce an in-year tax estimate. Returns calculationId.
 *
 *   { action: "get_calculation", taxYear, calculationId }
 *     → GET /individuals/calculations/{nino}/self-assessment/{taxYear}/{calculationId}
 *     → Returns HMRC's tax calculation (estimated bill, allowances, etc.)
 *
 *   { action: "trigger_bsas", businessId, periodStart, periodEnd }
 *     → POST /individuals/self-assessment/adjustable-summary/{nino}/trigger
 *     → Triggers a Business Source Adjustable Summary for the full tax year
 *     → Returns { calculationId }
 *
 *   { action: "get_bsas", taxYear, calculationId }
 *     → GET /individuals/self-assessment/adjustable-summary/{nino}/self-employment/{calculationId}/{taxYear}
 *     → Returns the BSAS detail (income/expense totals, adjustable fields)
 *
 *   { action: "list_bsas", taxYear }
 *     → GET /individuals/self-assessment/adjustable-summary/{nino}/{taxYear}
 *     → Lists all BSAS summaries for the tax year
 *
 *   { action: "final_declaration", taxYear, calculationId }
 *     → POST /individuals/calculations/{nino}/self-assessment/{taxYear}/{calculationId}/final-declaration
 *     → Submits the Final Declaration (replaces Self Assessment return). Returns 204 → { success: true }
 *     → Requires a prior trigger_calculation with calculationType="intent-to-finalise"
 *
 *   { action: "save_nino", nino }
 *     → Saves the user's NINO to their profile (needed for all API calls)
 *
 * HMRC API versioning — Accept headers required:
 *   business-details:  application/vnd.hmrc.2.0+json
 *   obligations:       application/vnd.hmrc.3.0+json
 *   self-employment:   application/vnd.hmrc.5.0+json
 *   calculations:      application/vnd.hmrc.8.0+json
 *   bsas:              application/vnd.hmrc.7.0+json
 */

import { serve }       from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encryptWith, decryptWith } from "../_shared/tokenCrypto.ts";
import { writeAudit } from "../_shared/auditLog.ts";

const HMRC_ENC_ENV = "HMRC_TOKEN_ENC_KEY";
// Legacy plaintext fallback — CLOSED by default ahead of HMRC recognition.
// Re-enable only by explicitly setting ALLOW_HMRC_LEGACY_PLAINTEXT="true".
// HMRC's fraud-prevention guidance requires tokens at rest to be encrypted;
// any unmigrated row will force a reconnect, which is the correct safety
// posture for an MTD-ITSA submission path.
const ALLOW_LEGACY_PLAINTEXT = (Deno.env.get("ALLOW_HMRC_LEGACY_PLAINTEXT") ?? "false") === "true";

// ─── Types ────────────────────────────────────────────────────────────────────
interface HmrcTokens {
  hmrc_access_token:      string | null;  // legacy plaintext (rollout window)
  hmrc_refresh_token:     string | null;  // legacy plaintext (rollout window)
  hmrc_access_token_enc:  string | null;
  hmrc_refresh_token_enc: string | null;
  hmrc_token_expires_at:  string | null;
  hmrc_nino:              string | null;  // legacy plaintext (rollout window)
  hmrc_nino_enc:          string | null;
}

interface DeviceInfo {
  deviceId:          string;
  userAgent:         string;
  browserPlugins:    string;
  doNotTrack:        string;
  screens:           string;
  windowSize:        string;
  timezone:          string;
  publicIp:          string | null;
  publicIpTimestamp: string;
  userId:            string | null;
}

interface SubmitExpenses {
  costOfGoods?:            number;
  travelCosts?:            number;
  premisesRunningCosts?:   number;
  maintenanceCosts?:       number;
  adminCosts?:             number;
  advertisingCosts?:       number;
  businessEntertainment?:  number;
  interest?:               number;
  financialCharges?:       number;
  badDebt?:                number;
  professionalFees?:       number;
  depreciation?:           number;
  other?:                  number;
}

// ─── Config ───────────────────────────────────────────────────────────────────
const HMRC_CLIENT_ID     = Deno.env.get("HMRC_CLIENT_ID") ?? "";
const HMRC_CLIENT_SECRET = Deno.env.get("HMRC_CLIENT_SECRET") ?? "";
const HMRC_REDIRECT_URI  = Deno.env.get("HMRC_REDIRECT_URI") ?? "";
const SANDBOX            = Deno.env.get("HMRC_SANDBOX") !== "false";
const VENDOR_VERSION     = Deno.env.get("HMRC_VENDOR_VERSION") ?? "1.0.0";
const VENDOR_PRODUCT     = "Cadi";

const HMRC_BASE = SANDBOX
  ? "https://test-api.service.hmrc.gov.uk"
  : "https://api.service.hmrc.gov.uk";

const CORS = {
  "Access-Control-Allow-Origin":  Deno.env.get("APP_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

/**
 * When an HMRC call fails, wrap the error in a 200 response so the Supabase
 * `functions.invoke` wrapper doesn't swallow the response body. The client
 * surfaces `data.error` as a thrown Error with the full HMRC status + body.
 */
function hmrcError(hmrcStatus: number, hmrcBody: unknown, path: string) {
  return json({
    error:      `HMRC ${hmrcStatus} on ${path}`,
    hmrcStatus,
    hmrcBody,
    path,
  }, 200);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Get authenticated Supabase user + service-role client */
async function getUser(req: Request) {
  const SUPABASE_URL  = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb    = createClient(SUPABASE_URL, SERVICE_KEY);
  const token = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
  const { data: { user }, error } = await sb.auth.getUser(token);
  if (error || !user) throw new Error("Unauthorized");
  return { user, sb };
}

/**
 * Get a valid HMRC access token for this user.
 * Automatically refreshes if expired (access tokens last 4 hours).
 * Refresh tokens last 18 months — re-authorisation is rarely needed.
 */
async function getAccessToken(userId: string, sb: ReturnType<typeof createClient>): Promise<{ token: string; nino: string | null }> {
  const { data: profile } = await sb
    .from("profiles")
    .select("hmrc_access_token, hmrc_refresh_token, hmrc_access_token_enc, hmrc_refresh_token_enc, hmrc_token_expires_at, hmrc_nino, hmrc_nino_enc")
    .eq("id", userId)
    .single<HmrcTokens>();

  // Prefer encrypted columns; fall back to legacy plaintext during the rollout
  // window (gated by ALLOW_LEGACY_PLAINTEXT). After backfill + grace period
  // the legacy plaintext columns are NULLed and this fallback never fires.
  const accessToken  = profile?.hmrc_access_token_enc
    ? await decryptWith(HMRC_ENC_ENV, profile.hmrc_access_token_enc, false)
    : (profile?.hmrc_access_token ?? null);
  const refreshToken = profile?.hmrc_refresh_token_enc
    ? await decryptWith(HMRC_ENC_ENV, profile.hmrc_refresh_token_enc, false)
    : (profile?.hmrc_refresh_token ?? null);
  const nino         = profile?.hmrc_nino_enc
    ? await decryptWith(HMRC_ENC_ENV, profile.hmrc_nino_enc, false)
    : (profile?.hmrc_nino ?? null);

  if (!refreshToken) {
    throw new Error("HMRC not connected — user must complete OAuth flow");
  }

  // Reject legacy plaintext fallback if disabled (post-backfill enforcement).
  if (!ALLOW_LEGACY_PLAINTEXT && !profile?.hmrc_refresh_token_enc) {
    throw new Error("HMRC token storage requires re-authorisation — please reconnect");
  }

  const expiresAt = profile?.hmrc_token_expires_at
    ? new Date(profile.hmrc_token_expires_at)
    : new Date(0);
  const needsRefresh = expiresAt < new Date(Date.now() + 5 * 60 * 1000); // refresh if < 5 min left

  // Passive migration: if we resolved tokens via the legacy plaintext columns
  // (no _enc twin yet), encrypt them now and null the plaintext. This makes the
  // first read after deploy migrate the user, so we don't have to wait for a
  // refresh-window to roll through every account.
  const needsBackfill = !profile?.hmrc_access_token_enc && !!profile?.hmrc_access_token;
  if (needsBackfill && accessToken && refreshToken) {
    const accessEnc  = await encryptWith(HMRC_ENC_ENV, accessToken);
    const refreshEnc = await encryptWith(HMRC_ENC_ENV, refreshToken);
    const ninoEnc    = nino ? await encryptWith(HMRC_ENC_ENV, nino) : null;
    await sb.from("profiles").update({
      hmrc_access_token:      null,
      hmrc_refresh_token:     null,
      hmrc_nino:              null,
      hmrc_access_token_enc:  accessEnc,
      hmrc_refresh_token_enc: refreshEnc,
      ...(ninoEnc ? { hmrc_nino_enc: ninoEnc } : {}),
    }).eq("id", userId);
  }

  if (!needsRefresh && accessToken) {
    return { token: accessToken, nino };
  }

  // ── Refresh the access token ───────────────────────────────────────────────
  const refreshRes = await fetch(`${HMRC_BASE}/oauth/token`, {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:    new URLSearchParams({
      grant_type:    "refresh_token",
      client_id:     HMRC_CLIENT_ID,
      client_secret: HMRC_CLIENT_SECRET,
      refresh_token: refreshToken,
    }),
  });

  const refreshed = await refreshRes.json() as {
    access_token:  string;
    refresh_token: string;
    expires_in:    number;
  };

  if (!refreshRes.ok) {
    // Refresh token expired — user needs to re-authorise. Null both legacy
    // and encrypted columns so the next sign-in path is unambiguous.
    await sb.from("profiles").update({
      hmrc_access_token:      null,
      hmrc_refresh_token:     null,
      hmrc_access_token_enc:  null,
      hmrc_refresh_token_enc: null,
      hmrc_token_expires_at:  null,
      hmrc_connected_at:      null,
    }).eq("id", userId);
    throw new Error("HMRC refresh token expired — please reconnect");
  }

  const newExpiry  = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
  const accessEnc  = await encryptWith(HMRC_ENC_ENV, refreshed.access_token);
  const refreshEnc = await encryptWith(HMRC_ENC_ENV, refreshed.refresh_token);

  await sb.from("profiles").update({
    // Null the legacy plaintext on first encrypted write (one-way migration).
    hmrc_access_token:      null,
    hmrc_refresh_token:     null,
    hmrc_access_token_enc:  accessEnc,
    hmrc_refresh_token_enc: refreshEnc,
    hmrc_token_expires_at:  newExpiry,
  }).eq("id", userId);

  return { token: refreshed.access_token, nino };
}

/**
 * Cached outbound public IP of this edge-function instance. HMRC wants
 * Gov-Vendor-Public-IP to be the IP the vendor's server actually used for
 * the call. Supabase Edge Functions don't have a fixed egress IP, so we
 * detect it at runtime and cache it for the lifetime of this container.
 */
let cachedVendorIp: string | null = null;
async function getVendorPublicIp(): Promise<string> {
  if (cachedVendorIp) return cachedVendorIp;
  try {
    const res = await fetch("https://api.ipify.org?format=json");
    const { ip } = await res.json() as { ip: string };
    cachedVendorIp = ip;
    return ip;
  } catch {
    return "0.0.0.0";
  }
}

/**
 * Build HMRC MTD Fraud Prevention headers for a WEB_APP_VIA_SERVER call.
 * The device fields come from the browser; the vendor fields come from us.
 *
 * Spec: https://developer.service.hmrc.gov.uk/guides/fraud-prevention/
 */
async function buildFraudHeaders(
  device: DeviceInfo | undefined,
  req:    Request,
): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    "Gov-Client-Connection-Method": "WEB_APP_VIA_SERVER",
    "Gov-Vendor-Product-Name":      encodeURIComponent(VENDOR_PRODUCT),
    "Gov-Vendor-Version":           `${VENDOR_PRODUCT}=${VENDOR_VERSION}`,
    "Gov-Vendor-Public-IP":         await getVendorPublicIp(),
  };

  if (!device) return headers;

  // Forward the chain of proxies HMRC might care about (browser → Supabase → us)
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    // Take the first hop (original client IP) if it differs from the one
    // the browser reported — this is the "Gov-Vendor-Forwarded" chain.
    headers["Gov-Vendor-Forwarded"] = `by=${await getVendorPublicIp()}&for=${xff.split(",")[0].trim()}`;
  }

  headers["Gov-Client-Device-ID"]            = device.deviceId;
  headers["Gov-Client-Browser-JS-User-Agent"] = device.userAgent;
  headers["Gov-Client-Browser-Plugins"]       = device.browserPlugins;
  headers["Gov-Client-Browser-Do-Not-Track"]  = device.doNotTrack;
  headers["Gov-Client-Screens"]               = device.screens;
  headers["Gov-Client-Window-Size"]           = device.windowSize;
  headers["Gov-Client-Timezone"]              = device.timezone;

  // Gov-Client-Public-IP — the END USER's public IP, not the vendor's.
  // Prefer the IP the browser reported via ipify (most accurate). If the
  // client couldn't reach ipify (CSP block, third-party outage, etc.), fall
  // back to the first hop of x-forwarded-for, which is the browser's IP as
  // seen by Supabase's edge. HMRC requires this header on every MTD call.
  if (device.publicIp) {
    headers["Gov-Client-Public-IP"]           = device.publicIp;
    headers["Gov-Client-Public-IP-Timestamp"] = device.publicIpTimestamp;
  } else {
    const xffFirst = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
    if (xffFirst) {
      headers["Gov-Client-Public-IP"]           = xffFirst;
      headers["Gov-Client-Public-IP-Timestamp"] = new Date().toISOString();
    }
  }
  if (device.userId) {
    headers["Gov-Client-User-IDs"] = `cadi=${encodeURIComponent(device.userId)}`;
  }

  // Gov-Client-Multi-Factor — omitted intentionally. HMRC's spec requires this
  // header only when the user authenticated with multi-factor. Cadi sign-in is
  // single-factor (Supabase email+password), so the correct posture is to omit
  // the header rather than send a placeholder. Re-add here when MFA ships.
  // See: https://developer.service.hmrc.gov.uk/guides/fraud-prevention/#gov-client-multi-factor

  return headers;
}

/**
 * HMRC ships Deprecation/Sunset/Link headers on endpoints scheduled for
 * retirement (post-Jan 2024 releases). We want a paper trail the moment any
 * endpoint we depend on is flagged — so a deprecated API doesn't silently
 * become a 410 Gone six months later. Returned to the caller so it can also
 * be persisted in the audit log alongside the action that triggered it.
 */
interface DeprecationInfo {
  deprecation: string;          // IMF-fixdate
  sunset?:     string;          // IMF-fixdate
  link?:       string;          // Documentation URL
}

function extractDeprecation(res: Response): DeprecationInfo | null {
  const dep = res.headers.get("deprecation");
  if (!dep) return null;
  return {
    deprecation: dep,
    sunset: res.headers.get("sunset") ?? undefined,
    link:   res.headers.get("link")   ?? undefined,
  };
}

/** Make an authenticated HMRC API call with fraud prevention headers */
async function hmrcFetch(
  path:    string,
  method:  string,
  token:   string,
  accept:  string,
  fraud:   Record<string, string>,
  body?:   unknown,
  extraHeaders?: Record<string, string>,
): Promise<{ ok: boolean; status: number; data: unknown; deprecation: DeprecationInfo | null }> {
  const headers: Record<string, string> = {
    ...fraud,
    ...(extraHeaders ?? {}),
    "Authorization": `Bearer ${token}`,
    "Accept":        accept,
  };
  if (body) headers["Content-Type"] = "application/json";

  const res = await fetch(`${HMRC_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    data = { raw: await res.text() };
  }

  // Non-2xx — error payload is returned to the caller so they can surface it

  return { ok: res.ok, status: res.status, data, deprecation: extractDeprecation(res) };
}

/**
 * Fire-and-forget audit write when HMRC flags an endpoint as deprecated. Keeps
 * the warning trail in `audit_log` so we have a date-stamped record the first
 * time the header appeared — useful when planning version bumps.
 */
async function logDeprecationIfPresent(
  sb: ReturnType<typeof createClient>,
  req: Request,
  userId: string,
  action: string,
  path: string,
  dep: DeprecationInfo | null,
): Promise<void> {
  if (!dep) return;
  try {
    await writeAudit(sb, req, {
      ownerId: userId, actorId: userId,
      action: "hmrc_endpoint_deprecated",
      category: "hmrc",
      detail: { triggeredBy: action, path, ...dep, sandbox: SANDBOX },
    });
    console.warn(`HMRC deprecation: ${path} → ${dep.deprecation}${dep.sunset ? ` (sunset ${dep.sunset})` : ""}`);
  } catch (e) {
    console.error("deprecation log failed:", e);
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const body            = await req.json() as Record<string, unknown>;
    const action          = body.action as string;
    const govTestScenario = (body.govTestScenario as string | undefined) ?? "DEFAULT";
    const { user, sb } = await getUser(req);

    // ── Save NINO (user enters this once — it's their tax reference) ──────────
    if (action === "save_nino") {
      const nino = (body.nino as string ?? "").toUpperCase().replace(/\s/g, "");
      // Basic UK NINO format: XX999999X
      if (!/^[A-CEGHJ-PR-TW-Z]{2}\d{6}[A-D]$/.test(nino)) {
        return json({ error: "Invalid NINO format. Expected e.g. QQ123456C" }, 400);
      }
      const ninoEnc = await encryptWith(HMRC_ENC_ENV, nino);
      // Null the plaintext column on every write — encrypted is now canonical.
      await sb.from("profiles").update({ hmrc_nino: null, hmrc_nino_enc: ninoEnc }).eq("id", user.id);
      return json({ success: true, nino });
    }

    // All subsequent actions need a valid token
    const { token, nino } = await getAccessToken(user.id, sb);
    if (!nino) {
      return json({ error: "NINO not set. Call save_nino first." }, 400);
    }

    // Fraud-prevention headers — required by HMRC on every MTD call.
    const device = body.deviceInfo as DeviceInfo | undefined;
    const fraud  = await buildFraudHeaders(device, req);

    // Auto-log Deprecation/Sunset headers from every HMRC call this request
    // makes. We swap the bare `hmrcFetch` in handlers below for `callHmrc`,
    // which is a closure that captures the audit context. Closure-based, so
    // concurrent requests don't see each other's context.
    const callHmrc = async (
      path: string, method: string, accept: string,
      reqBody?: unknown, extra?: Record<string, string>,
    ) => {
      const result = await hmrcFetch(path, method, token, accept, fraud, reqBody, extra);
      await logDeprecationIfPresent(sb, req, user.id, action, path, result.deprecation);
      return result;
    };

    // ── List self-employment businesses ───────────────────────────────────────
    // Business Details (MTD) API is v2.0 — sending v3.0 returns 404.
    if (action === "businesses") {
      const result = await callHmrc(
        `/individuals/business/details/${nino}/list`,
        "GET",
        "application/vnd.hmrc.2.0+json",
      );
      if (!result.ok) return hmrcError(result.status, result.data, action);
      return json(result.data);
    }

    // ── Get MTD ITSA Income & Expenditure obligations ─────────────────────────
    // Obligations (MTD) v3 — path is /income-and-expenditure (not /income-tax),
    // all query params are optional, scenario values are a different set.
    if (action === "obligations") {
      const from    = body.fromDate   as string | undefined;
      const to      = body.toDate     as string | undefined;
      const biz     = body.businessId as string | undefined;
      const status  = body.status     as string | undefined; // "Open" | "Fulfilled"

      const qs = new URLSearchParams();
      if (from)   qs.set("fromDate",  from);
      if (to)     qs.set("toDate",    to);
      if (biz) { qs.set("businessId", biz); qs.set("typeOfBusiness", "self-employment"); }
      if (status) qs.set("status",    status);
      const query = qs.toString() ? `?${qs}` : "";

      const result = await callHmrc(
        `/obligations/details/${nino}/income-and-expenditure${query}`,
        "GET",
        "application/vnd.hmrc.3.0+json",
      );
      if (!result.ok) return hmrcError(result.status, result.data, action);
      return json(result.data);
    }

    // ── Submit/amend cumulative self-employment summary ───────────────────────
    // Self-Employment Business (MTD) v5.0 uses cumulative PUT for 2025-26+ tax
    // years. The legacy POST .../periods endpoint (v3) was removed.
    //
    // NOTE: Request body below follows HMRC's general cumulative pattern, but
    // the v5 OAS detail page is incomplete. On first real submit (Aug 2026 for
    // Q1 2026-27), expect possible 400s — adjust field names per HMRC's error
    // response, which the hmrcError wrapper will surface.
    if (action === "submit_quarter") {
      const businessId   = body.businessId   as string;
      const taxYear      = body.taxYear      as string; // "2026-27"
      const periodStart  = body.periodStart  as string; // for our audit log
      const periodEnd    = body.periodEnd    as string;
      const incomeData   = body.income       as { turnover: number; other?: number };
      const expenseData  = body.expenses     as SubmitExpenses;

      if (!businessId || !taxYear) {
        return json({ error: "businessId and taxYear are required" }, 400);
      }

      // ── Digital-records guardrail (MTD ITSA ToU compliance) ──────────────
      // Every figure submitted to HMRC must derive from a digital record, not
      // a number typed into the submission screen. The client passes source
      // IDs in `digitalRecordRefs`, partitioned by table:
      //   { invoiceIds: [...], transactionIds: [...], moneyEntryIds: [...] }
      // We verify every ID exists for this owner and that the linked income
      // amounts sum to the declared turnover (±1p tolerance). Submissions
      // without refs, with missing rows, or with a sum mismatch return 422.
      const refs = body.digitalRecordRefs as {
        invoiceIds?:     string[];   // paid invoices (income)
        transactionIds?: string[];   // bank txns (income or expense)
        moneyEntryIds?:  string[];   // manual entries (income or expense)
      } | undefined;
      const requireRefs = Deno.env.get("HMRC_REQUIRE_DIGITAL_RECORDS") !== "false";
      if (requireRefs) {
        const totalRefs = (refs?.invoiceIds?.length ?? 0)
                        + (refs?.transactionIds?.length ?? 0)
                        + (refs?.moneyEntryIds?.length ?? 0);
        if (totalRefs === 0) {
          return json({
            error: "Submission refused: figures must derive from digital records (no manual entry). Pass digitalRecordRefs.",
            code:  "DIGITAL_RECORDS_REQUIRED",
          }, 422);
        }

        const invIds = refs?.invoiceIds     ?? [];
        const txIds  = refs?.transactionIds ?? [];
        const meIds  = refs?.moneyEntryIds  ?? [];

        const [inv, tx, me] = await Promise.all([
          invIds.length
            ? sb.from("invoices").select("id, total, paid_at, status").eq("owner_id", user.id).in("id", invIds)
            : Promise.resolve({ data: [] as Array<{ id: string; total: number; paid_at: string; status: string }> }),
          txIds.length
            ? sb.from("transactions").select("id, amount, date, is_business").eq("owner_id", user.id).in("id", txIds)
            : Promise.resolve({ data: [] as Array<{ id: string; amount: number; date: string; is_business: boolean | null }> }),
          meIds.length
            ? sb.from("money_entries").select("id, amount, entry_date, kind").eq("owner_id", user.id).in("id", meIds)
            : Promise.resolve({ data: [] as Array<{ id: string; amount: number; entry_date: string; kind: string }> }),
        ]);

        if ((inv.data?.length ?? 0) !== invIds.length ||
            (tx.data?.length  ?? 0) !== txIds.length  ||
            (me.data?.length  ?? 0) !== meIds.length) {
          return json({ error: "One or more digitalRecordRefs were not found in your account.", code: "DIGITAL_RECORDS_NOT_FOUND" }, 422);
        }

        // Income sum: every invoice is income; positive transactions are income;
        // money_entries with kind='income' are income. Expense rows excluded.
        const sumIncome =
          (inv.data ?? []).reduce((s, r) => s + Number(r.total  || 0), 0) +
          (tx.data  ?? []).filter(r => Number(r.amount) > 0)
                          .reduce((s, r) => s + Number(r.amount || 0), 0) +
          (me.data  ?? []).filter(r => r.kind === 'income')
                          .reduce((s, r) => s + Number(r.amount || 0), 0);
        const declaredIncome = Number(incomeData.turnover || 0) + Number(incomeData.other || 0);
        if (Math.abs(sumIncome - declaredIncome) > 0.01) {
          return json({
            error: `Income mismatch: declared £${declaredIncome.toFixed(2)} but linked records total £${sumIncome.toFixed(2)}.`,
            code:  "DIGITAL_RECORDS_INCOME_MISMATCH",
          }, 422);
        }
      }

      const expenses: Record<string, number> = {};
      const EXPENSE_MAP: Record<keyof SubmitExpenses, string> = {
        costOfGoods:           "costOfGoods",
        travelCosts:           "travelCosts",
        premisesRunningCosts:  "premisesRunningCosts",
        maintenanceCosts:      "maintenanceCosts",
        adminCosts:            "adminCosts",
        advertisingCosts:      "advertisingCosts",
        businessEntertainment: "businessEntertainmentCosts",
        interest:              "interestOnBankOtherLoans",
        financialCharges:      "financeCharges",
        badDebt:               "irrecoverableDebts",
        professionalFees:      "professionalFees",
        depreciation:          "depreciation",
        other:                 "other",
      };
      for (const [key, hmrcKey] of Object.entries(EXPENSE_MAP)) {
        const val = expenseData?.[key as keyof SubmitExpenses];
        if (val && val > 0) expenses[hmrcKey] = val;
      }

      // SE Business API v5 (June 2026 sandbox change) — optional adjustments
      // block, with adjustmentToProfitsForClass4 to manually reconcile Class 4
      // NI exposure across multiple businesses. We only send the block when at
      // least one adjustment is provided; HMRC rejects empty objects.
      const adjustmentsInput = body.adjustments as { adjustmentToProfitsForClass4?: number } | undefined;
      const adjustments: Record<string, number> = {};
      if (adjustmentsInput?.adjustmentToProfitsForClass4 !== undefined &&
          adjustmentsInput.adjustmentToProfitsForClass4 !== null) {
        adjustments.adjustmentToProfitsForClass4 = adjustmentsInput.adjustmentToProfitsForClass4;
      }

      const hmrcBody = {
        periodDates: {
          periodStartDate: periodStart,
          periodEndDate:   periodEnd,
        },
        periodIncome: {
          turnover: incomeData.turnover,
          ...(incomeData.other ? { other: incomeData.other } : {}),
        },
        ...(Object.keys(expenses).length > 0 ? { periodExpenses: expenses } : {}),
        ...(Object.keys(adjustments).length > 0 ? { adjustments } : {}),
      };

      const result = await callHmrc(
        `/individuals/business/self-employment/${nino}/${businessId}/cumulative/${taxYear}`,
        "PUT",
        "application/vnd.hmrc.5.0+json",
        hmrcBody,
        SANDBOX ? { "Gov-Test-Scenario": govTestScenario } : undefined,
      );

      if (result.ok) {
        await sb.from("hmrc_submissions").insert({
          owner_id:      user.id,
          period_start:  periodStart,
          period_end:    periodEnd,
          income:        incomeData.turnover,
          expenses:      Object.values(expenseData ?? {}).reduce((s: number, v: unknown) => s + (Number(v) || 0), 0),
          submitted_at:  new Date().toISOString(),
          hmrc_response: result.data,
        }).then(null, () => {});
      }

      // Audit trail — fire-and-forget regardless of HMRC outcome, with the
      // outcome captured in detail. Needed for FCA agent review.
      await writeAudit(sb, req, {
        ownerId:  user.id,
        actorId:  user.id,
        action:   "hmrc_submit_quarter",
        category: "hmrc",
        detail:   {
          ok:           result.ok,
          status:       result.status,
          businessId,
          taxYear,
          periodStart,
          periodEnd,
          turnover:     incomeData.turnover,
          sandbox:      SANDBOX,
        },
      });

      if (!result.ok) return hmrcError(result.status, result.data, action);
      return json(result.data);
    }

    // ── Trigger an in-year tax calculation ────────────────────────────────────
    // Call this after submitting a quarter to get HMRC's estimated tax bill
    // Individual Calculations (MTD) v7.0 — required for tax year 2026-27+.
    // Trigger path now includes /trigger/{calculationType} segment.
    // calculationType: "in-year" (default), "intent-to-finalise", "intent-to-amend".
    if (action === "trigger_calculation") {
      const taxYear         = (body.taxYear         as string) ?? "2026-27";
      const calculationType = (body.calculationType as string) ?? "in-year";
      const result = await callHmrc(
        `/individuals/calculations/${nino}/self-assessment/${taxYear}/trigger/${calculationType}`,
        "POST",
        "application/vnd.hmrc.8.0+json",
        {},
        SANDBOX ? { "Gov-Test-Scenario": govTestScenario } : undefined,
      );
      if (!result.ok) return hmrcError(result.status, result.data, action);
      return json(result.data);
    }

    // ── Get a specific tax calculation ────────────────────────────────────────
    if (action === "get_calculation") {
      const taxYear       = body.taxYear       as string;
      const calculationId = body.calculationId as string;
      const result = await callHmrc(
        `/individuals/calculations/${nino}/self-assessment/${taxYear}/${calculationId}`,
        "GET",
        "application/vnd.hmrc.8.0+json",
        undefined,
        SANDBOX ? { "Gov-Test-Scenario": govTestScenario } : undefined,
      );
      if (!result.ok) return hmrcError(result.status, result.data, action);
      return json(result.data);
    }

    // ── Trigger a BSAS (Business Source Adjustable Summary) ──────────────────
    // Self Assessment BSAS (MTD) v7.0
    // Must subscribe to "Self Assessment BSAS (MTD)" in HMRC Developer Hub
    if (action === "trigger_bsas") {
      const businessId  = body.businessId  as string;
      const periodStart = body.periodStart as string; // "2026-04-06"
      const periodEnd   = body.periodEnd   as string; // "2027-04-05"

      if (!businessId || !periodStart || !periodEnd) {
        return json({ error: "businessId, periodStart and periodEnd are required" }, 400);
      }

      const result = await callHmrc(
        `/individuals/self-assessment/adjustable-summary/${nino}/trigger`,
        "POST",
        "application/vnd.hmrc.7.0+json",
        {
          typeOfBusiness:   "self-employment",
          businessId,
          accountingPeriod: { startDate: periodStart, endDate: periodEnd },
        },
        SANDBOX ? { "Gov-Test-Scenario": govTestScenario } : undefined,
      );
      if (!result.ok) return hmrcError(result.status, result.data, action);
      return json(result.data);
    }

    // ── List BSAS summaries for a tax year ───────────────────────────────────
    if (action === "list_bsas") {
      const taxYear = body.taxYear as string; // "2026-27"
      if (!taxYear) return json({ error: "taxYear is required" }, 400);

      const result = await callHmrc(
        `/individuals/self-assessment/adjustable-summary/${nino}/${taxYear}`,
        "GET",
        "application/vnd.hmrc.7.0+json",
        undefined,
        SANDBOX ? { "Gov-Test-Scenario": govTestScenario } : undefined,
      );
      if (!result.ok) return hmrcError(result.status, result.data, action);
      return json(result.data);
    }

    // ── Get a specific BSAS ───────────────────────────────────────────────────
    if (action === "get_bsas") {
      const taxYear       = body.taxYear       as string; // "2026-27"
      const calculationId = body.calculationId as string;
      if (!taxYear || !calculationId) {
        return json({ error: "taxYear and calculationId are required" }, 400);
      }

      const result = await callHmrc(
        `/individuals/self-assessment/adjustable-summary/${nino}/self-employment/${calculationId}?taxYear=${taxYear}`,
        "GET",
        "application/vnd.hmrc.7.0+json",
        undefined,
        // No Gov-Test-Scenario — rely on stateful sandbox to return the triggered record
        undefined,
      );
      if (!result.ok) return hmrcError(result.status, result.data, action);
      return json(result.data);
    }

    // ── Submit Final Declaration ──────────────────────────────────────────────
    // Individual Calculations (MTD) v8.0
    // Step 1: call trigger_calculation with calculationType="intent-to-finalise"
    // Step 2: call this action with the calculationId from step 1
    // Returns 204 No Content on success → we return { success: true, declared: true }
    if (action === "final_declaration") {
      const taxYear       = body.taxYear       as string; // "2026-27"
      const calculationId = body.calculationId as string;
      if (!taxYear || !calculationId) {
        return json({ error: "taxYear and calculationId are required" }, 400);
      }

      const result = await callHmrc(
        `/individuals/calculations/${nino}/self-assessment/${taxYear}/${calculationId}/final-declaration`,
        "POST",
        "application/vnd.hmrc.8.0+json",
        {},
        SANDBOX ? { "Gov-Test-Scenario": govTestScenario } : undefined,
      );
      await writeAudit(sb, req, {
        ownerId:  user.id,
        actorId:  user.id,
        action:   "hmrc_final_declaration",
        category: "hmrc",
        detail:   { ok: result.ok, status: result.status, taxYear, calculationId, sandbox: SANDBOX },
      });

      if (!result.ok) return hmrcError(result.status, result.data, action);
      return json({ success: true, declared: true });
    }

    // ── Business Details v2 — update accounting type (cash vs accruals) ──────
    // June 2026 production release: customers may now switch between cash basis
    // and accruals in-year. PUT against the business's accounting-type endpoint.
    if (action === "update_accounting_type") {
      const businessId     = body.businessId     as string;
      const taxYear        = body.taxYear        as string;       // "2026-27"
      const accountingType = body.accountingType as string;       // "CASH" | "ACCRUALS"
      if (!businessId || !taxYear || !accountingType) {
        return json({ error: "businessId, taxYear and accountingType are required" }, 400);
      }
      const result = await callHmrc(
        `/individuals/business/details/${nino}/${businessId}/${taxYear}/accounting-type`,
        "PUT",
        "application/vnd.hmrc.2.0+json",
        { accountingType },
        SANDBOX ? { "Gov-Test-Scenario": govTestScenario } : undefined,
      );
      await writeAudit(sb, req, {
        ownerId: user.id, actorId: user.id,
        action: "hmrc_update_accounting_type",
        category: "hmrc",
        detail: { ok: result.ok, status: result.status, businessId, taxYear, accountingType, sandbox: SANDBOX },
      });
      if (!result.ok) return hmrcError(result.status, result.data, action);
      return json(result.data);
    }

    // ── Self Assessment Accounts v4 — list penalties ─────────────────────────
    // June 2026: read-only retrieval of ITSA penalties applied to the account.
    // Surfaced in the UI so users see what they owe before a sandbox test fails
    // with a surprise penalty in the calculation. Read-only.
    if (action === "list_penalties") {
      const result = await callHmrc(
        `/accounts/self-assessment/${nino}/penalties`,
        "GET",
        "application/vnd.hmrc.4.0+json",
        undefined,
        SANDBOX ? { "Gov-Test-Scenario": govTestScenario } : undefined,
      );
      if (!result.ok) return hmrcError(result.status, result.data, action);
      return json(result.data);
    }

    // ── Individual Losses v7 — submit brought-forward loss ───────────────────
    // Customer carries a self-employment loss forward into the new tax year.
    if (action === "submit_brought_forward_loss") {
      const businessId  = body.businessId  as string;
      const taxYear     = body.taxYear     as string;       // "2026-27"
      const lossAmount  = body.lossAmount  as number;
      const typeOfLoss  = (body.typeOfLoss as string) ?? "self-employment";
      if (!businessId || !taxYear || lossAmount == null) {
        return json({ error: "businessId, taxYear and lossAmount are required" }, 400);
      }
      const result = await callHmrc(
        `/individuals/losses/${nino}/brought-forward-losses`,
        "POST",
        "application/vnd.hmrc.7.0+json",
        { businessId, typeOfLoss, taxYearBroughtForwardFrom: taxYear, lossAmount },
        SANDBOX ? { "Gov-Test-Scenario": govTestScenario } : undefined,
      );
      await writeAudit(sb, req, {
        ownerId: user.id, actorId: user.id,
        action: "hmrc_submit_brought_forward_loss",
        category: "hmrc",
        detail: { ok: result.ok, status: result.status, businessId, taxYear, lossAmount, sandbox: SANDBOX },
      });
      if (!result.ok) return hmrcError(result.status, result.data, action);
      return json(result.data);
    }

    // ── Tax Liability Adjustments v1 — carry back loss to a prior year ───────
    // NEW API in June 2026. Sets off a loss from one tax year against profits
    // in a previous tax year, subject to HMRC rules. Read the calculation
    // result for the relief amount.
    if (action === "carry_back_loss") {
      const taxYearLossArose   = body.taxYearLossArose   as string; // "2026-27"
      const taxYearOfRelief    = body.taxYearOfRelief    as string; // "2025-26"
      const lossAmount         = body.lossAmount         as number;
      const typeOfLoss         = (body.typeOfLoss        as string) ?? "self-employment";
      if (!taxYearLossArose || !taxYearOfRelief || lossAmount == null) {
        return json({ error: "taxYearLossArose, taxYearOfRelief and lossAmount are required" }, 400);
      }
      const result = await callHmrc(
        `/individuals/tax-liability-adjustments/${nino}/carry-back-loss`,
        "POST",
        "application/vnd.hmrc.1.0+json",
        { typeOfLoss, taxYearLossArose, taxYearOfRelief, lossAmount },
        SANDBOX ? { "Gov-Test-Scenario": govTestScenario } : undefined,
      );
      await writeAudit(sb, req, {
        ownerId: user.id, actorId: user.id,
        action: "hmrc_carry_back_loss",
        category: "hmrc",
        detail: { ok: result.ok, status: result.status, taxYearLossArose, taxYearOfRelief, lossAmount, sandbox: SANDBOX },
      });
      if (!result.ok) return hmrcError(result.status, result.data, action);
      return json(result.data);
    }

    // ── Individuals Charges v3 — winter fuel payment ─────────────────────────
    // June 2026 sandbox: customer can declare a winter fuel payment to be
    // included in the calculation. Sole-trader cleaners aged 66+ may be in
    // scope. Read-only retrieval here; declaration uses a future PUT.
    if (action === "list_charges") {
      const taxYear = body.taxYear as string;
      if (!taxYear) return json({ error: "taxYear is required" }, 400);
      const result = await callHmrc(
        `/individuals/charges/${nino}/${taxYear}`,
        "GET",
        "application/vnd.hmrc.3.0+json",
        undefined,
        SANDBOX ? { "Gov-Test-Scenario": govTestScenario } : undefined,
      );
      if (!result.ok) return hmrcError(result.status, result.data, action);
      return json(result.data);
    }

    // ── Individuals Partner Income v1 — partner income summary ───────────────
    // Read-only stub for users with partnership income. Cleaners targeting the
    // sole-trader tier rarely hit this — included for production-coverage of
    // every supported income type.
    if (action === "list_partner_income") {
      const taxYear = body.taxYear as string;
      if (!taxYear) return json({ error: "taxYear is required" }, 400);
      const result = await callHmrc(
        `/individuals/partner-income/${nino}/${taxYear}`,
        "GET",
        "application/vnd.hmrc.1.0+json",
        undefined,
        SANDBOX ? { "Gov-Test-Scenario": govTestScenario } : undefined,
      );
      if (!result.ok) return hmrcError(result.status, result.data, action);
      return json(result.data);
    }

    // ── Create / Amend Self-Employment Annual Submission ─────────────────────
    // Used to declare annual allowances (AIA, capital allowances, structures &
    // buildings) and adjustments that aren't tied to a single quarter. Required
    // in the stateful sandbox journey before BSAS can be triggered.
    if (action === "submit_annual_submission") {
      const businessId = body.businessId as string;
      const taxYear    = body.taxYear    as string;       // "2026-27"
      const payload    = body.payload    as Record<string, unknown> | undefined;
      if (!businessId || !taxYear) {
        return json({ error: "businessId and taxYear are required" }, 400);
      }
      const result = await callHmrc(
        `/individuals/business/self-employment/${nino}/${businessId}/annual/${taxYear}`,
        "PUT",
        "application/vnd.hmrc.5.0+json",
        payload ?? {},
        SANDBOX ? { "Gov-Test-Scenario": govTestScenario } : undefined,
      );
      await writeAudit(sb, req, {
        ownerId: user.id, actorId: user.id,
        action: "hmrc_submit_annual_submission",
        category: "hmrc",
        detail: { ok: result.ok, status: result.status, businessId, taxYear, sandbox: SANDBOX },
      });
      if (!result.ok) return hmrcError(result.status, result.data, action);
      return json(result.data);
    }

    // ── Submit Self-Employment Accounting Adjustments ────────────────────────
    // Applied to a previously triggered BSAS to correct the figures (e.g.
    // business-insurance reclassification). Part of the stateful BSAS journey.
    if (action === "submit_accounting_adjustments") {
      const calculationId = body.calculationId as string;
      const payload       = body.payload       as Record<string, unknown> | undefined;
      if (!calculationId || !payload) {
        return json({ error: "calculationId and payload are required" }, 400);
      }
      const result = await callHmrc(
        `/individuals/self-assessment/adjustable-summary/${nino}/self-employment/${calculationId}/adjust`,
        "POST",
        "application/vnd.hmrc.7.0+json",
        payload,
        SANDBOX ? { "Gov-Test-Scenario": govTestScenario } : undefined,
      );
      await writeAudit(sb, req, {
        ownerId: user.id, actorId: user.id,
        action: "hmrc_submit_accounting_adjustments",
        category: "hmrc",
        detail: { ok: result.ok, status: result.status, calculationId, sandbox: SANDBOX },
      });
      if (!result.ok) return hmrcError(result.status, result.data, action);
      return json(result.data);
    }

    // ── Create and Amend Dividends Income ────────────────────────────────────
    // Personal dividends income (separate from a Ltd Co's dividends out). For
    // sole-trader cleaners this is rare but in scope for the journey.
    if (action === "submit_dividends_income") {
      const taxYear = body.taxYear as string;             // "2026-27"
      const payload = body.payload as Record<string, unknown> | undefined;
      if (!taxYear || !payload) {
        return json({ error: "taxYear and payload are required" }, 400);
      }
      const result = await callHmrc(
        `/individuals/income-received/dividends/${nino}/${taxYear}`,
        "PUT",
        "application/vnd.hmrc.2.0+json",
        payload,
        SANDBOX ? { "Gov-Test-Scenario": govTestScenario } : undefined,
      );
      await writeAudit(sb, req, {
        ownerId: user.id, actorId: user.id,
        action: "hmrc_submit_dividends_income",
        category: "hmrc",
        detail: { ok: result.ok, status: result.status, taxYear, sandbox: SANDBOX },
      });
      if (!result.ok) return hmrcError(result.status, result.data, action);
      return json(result.data);
    }

    // ── Agent Authorisation — get status of relationship ─────────────────────
    // Returns whether the current agent is "main" or "supporting" for this
    // customer. Use this client-side to gate UI actions: supporting agents
    // can't make final declarations or view calculations.
    if (action === "agent_relationship_status") {
      const arn = body.arn as string;   // agent reference number
      if (!arn) return json({ error: "arn is required" }, 400);
      const result = await callHmrc(
        `/agents/${arn}/relationship/status?service=HMRC-MTD-IT&clientId=${nino}`,
        "GET",
        "application/vnd.hmrc.1.0+json",
      );
      if (!result.ok) return hmrcError(result.status, result.data, action);
      return json(result.data);
    }

    // ── Records portability — export the user's HMRC-relevant data ───────────
    // ToU requirement: "Users must be able to access and export their records."
    // Bundles the audit trail, hmrc_submissions, money_entries, and bank
    // transactions for the requested tax-year window. Returned as JSON; the
    // client serialises to a download.
    if (action === "export_records") {
      const fromDate = body.fromDate as string | undefined;
      const toDate   = body.toDate   as string | undefined;

      const [subs, money, txns, audit] = await Promise.all([
        sb.from("hmrc_submissions").select("*").eq("owner_id", user.id)
          .gte("period_start", fromDate ?? "1900-01-01").lte("period_end", toDate ?? "2999-12-31"),
        sb.from("money_entries").select("*").eq("owner_id", user.id)
          .gte("entry_date", fromDate ?? "1900-01-01").lte("entry_date", toDate ?? "2999-12-31"),
        sb.from("transactions").select("*").eq("owner_id", user.id)
          .gte("date", fromDate ?? "1900-01-01").lte("date", toDate ?? "2999-12-31"),
        sb.from("audit_log").select("*").eq("owner_id", user.id).eq("category", "hmrc")
          .order("created_at", { ascending: false }).limit(2000),
      ]);

      await writeAudit(sb, req, {
        ownerId: user.id, actorId: user.id,
        action: "hmrc_export_records",
        category: "hmrc",
        detail: { fromDate: fromDate ?? null, toDate: toDate ?? null, submissions: subs.data?.length ?? 0 },
      });

      return json({
        exportedAt: new Date().toISOString(),
        nino,
        window: { fromDate: fromDate ?? null, toDate: toDate ?? null },
        submissions:  subs.data  ?? [],
        moneyEntries: money.data ?? [],
        transactions: txns.data  ?? [],
        auditLog:     audit.data ?? [],
      });
    }

    return json({ error: `Unknown action: ${action}` }, 400);

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("hmrc-api error:", msg);
    return json({ error: msg }, 200);
  }
});
