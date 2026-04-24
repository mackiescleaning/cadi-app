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

// ─── Types ────────────────────────────────────────────────────────────────────
interface HmrcTokens {
  hmrc_access_token:     string | null;
  hmrc_refresh_token:    string | null;
  hmrc_token_expires_at: string | null;
  hmrc_nino:             string | null;
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
  "Access-Control-Allow-Origin":  "*",
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
    .select("hmrc_access_token, hmrc_refresh_token, hmrc_token_expires_at, hmrc_nino")
    .eq("id", userId)
    .single<HmrcTokens>();

  if (!profile?.hmrc_refresh_token) {
    throw new Error("HMRC not connected — user must complete OAuth flow");
  }

  const expiresAt = profile.hmrc_token_expires_at
    ? new Date(profile.hmrc_token_expires_at)
    : new Date(0);
  const needsRefresh = expiresAt < new Date(Date.now() + 5 * 60 * 1000); // refresh if < 5 min left

  if (!needsRefresh && profile.hmrc_access_token) {
    return { token: profile.hmrc_access_token, nino: profile.hmrc_nino };
  }

  // ── Refresh the access token ───────────────────────────────────────────────
  console.log(`Refreshing HMRC token for user ${userId}`);
  const refreshRes = await fetch(`${HMRC_BASE}/oauth/token`, {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:    new URLSearchParams({
      grant_type:    "refresh_token",
      client_id:     HMRC_CLIENT_ID,
      client_secret: HMRC_CLIENT_SECRET,
      refresh_token: profile.hmrc_refresh_token,
    }),
  });

  const refreshed = await refreshRes.json() as {
    access_token:  string;
    refresh_token: string;
    expires_in:    number;
  };

  if (!refreshRes.ok) {
    // Refresh token expired — user needs to re-authorise
    await sb.from("profiles").update({
      hmrc_access_token:     null,
      hmrc_refresh_token:    null,
      hmrc_token_expires_at: null,
      hmrc_connected_at:     null,
    }).eq("id", userId);
    throw new Error("HMRC refresh token expired — please reconnect");
  }

  const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();

  await sb.from("profiles").update({
    hmrc_access_token:     refreshed.access_token,
    hmrc_refresh_token:    refreshed.refresh_token, // HMRC may rotate this
    hmrc_token_expires_at: newExpiry,
  }).eq("id", userId);

  return { token: refreshed.access_token, nino: profile.hmrc_nino };
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

  if (device.publicIp) {
    headers["Gov-Client-Public-IP"]           = device.publicIp;
    headers["Gov-Client-Public-IP-Timestamp"] = device.publicIpTimestamp;
  }
  if (device.userId) {
    headers["Gov-Client-User-IDs"] = `cadi=${encodeURIComponent(device.userId)}`;
  }

  return headers;
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
): Promise<{ ok: boolean; status: number; data: unknown }> {
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

  // Diagnostic: surface HMRC's actual error payload in logs on non-2xx
  if (!res.ok) {
    console.error("HMRC non-2xx:", method, path, res.status, JSON.stringify(data));
  }

  return { ok: res.ok, status: res.status, data };
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
      await sb.from("profiles").update({ hmrc_nino: nino }).eq("id", user.id);
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

    // ── List self-employment businesses ───────────────────────────────────────
    // Business Details (MTD) API is v2.0 — sending v3.0 returns 404.
    if (action === "businesses") {
      const result = await hmrcFetch(
        `/individuals/business/details/${nino}/list`,
        "GET",
        token,
        "application/vnd.hmrc.2.0+json",
        fraud,
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

      const result = await hmrcFetch(
        `/obligations/details/${nino}/income-and-expenditure${query}`,
        "GET",
        token,
        "application/vnd.hmrc.3.0+json",
        fraud,
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

      const hmrcBody = {
        periodDates: {
          periodStartDate: periodStart,
          periodEndDate:   periodEnd,
        },
        periodIncome: {
          turnover: incomeData.turnover,
          ...(incomeData.other ? { other: incomeData.other } : {}),
        },
        periodExpenses: expenses,
      };

      const result = await hmrcFetch(
        `/individuals/business/self-employment/${nino}/${businessId}/cumulative/${taxYear}`,
        "PUT",
        token,
        "application/vnd.hmrc.5.0+json",
        fraud,
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
      const result = await hmrcFetch(
        `/individuals/calculations/${nino}/self-assessment/${taxYear}/trigger/${calculationType}`,
        "POST",
        token,
        "application/vnd.hmrc.8.0+json",
        fraud,
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
      const result = await hmrcFetch(
        `/individuals/calculations/${nino}/self-assessment/${taxYear}/${calculationId}`,
        "GET",
        token,
        "application/vnd.hmrc.8.0+json",
        fraud,
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

      const result = await hmrcFetch(
        `/individuals/self-assessment/adjustable-summary/${nino}/trigger`,
        "POST",
        token,
        "application/vnd.hmrc.7.0+json",
        fraud,
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

      const result = await hmrcFetch(
        `/individuals/self-assessment/adjustable-summary/${nino}/${taxYear}`,
        "GET",
        token,
        "application/vnd.hmrc.7.0+json",
        fraud,
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

      const result = await hmrcFetch(
        `/individuals/self-assessment/adjustable-summary/${nino}/self-employment/${calculationId}`,
        "GET",
        token,
        "application/vnd.hmrc.7.0+json",
        fraud,
        undefined,
        SANDBOX ? { "Gov-Test-Scenario": govTestScenario } : undefined,
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

      const result = await hmrcFetch(
        `/individuals/calculations/${nino}/self-assessment/${taxYear}/${calculationId}/final-declaration`,
        "POST",
        token,
        "application/vnd.hmrc.8.0+json",
        fraud,
        {},
        SANDBOX ? { "Gov-Test-Scenario": govTestScenario } : undefined,
      );
      if (!result.ok) return hmrcError(result.status, result.data, action);
      return json({ success: true, declared: true });
    }

    return json({ error: `Unknown action: ${action}` }, 400);

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("hmrc-api error:", msg);
    return json({ error: msg }, 200);
  }
});
