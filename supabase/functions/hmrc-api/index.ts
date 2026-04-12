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
 *   { action: "save_nino", nino }
 *     → Saves the user's NINO to their profile (needed for all API calls)
 *
 * HMRC API versioning — Accept headers required:
 *   business-details:  application/vnd.hmrc.3.0+json
 *   obligations:       application/vnd.hmrc.2.0+json
 *   self-assessment:   application/vnd.hmrc.3.0+json
 *   calculations:      application/vnd.hmrc.6.0+json
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

/** Make an authenticated HMRC API call */
async function hmrcFetch(
  path:    string,
  method:  string,
  token:   string,
  accept:  string,
  body?:   unknown,
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const headers: Record<string, string> = {
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

  return { ok: res.ok, status: res.status, data };
}

// ─── Main handler ─────────────────────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const body   = await req.json() as Record<string, unknown>;
    const action = body.action as string;
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

    // ── List self-employment businesses ───────────────────────────────────────
    if (action === "businesses") {
      const result = await hmrcFetch(
        `/individuals/business/details/${nino}/list`,
        "GET",
        token,
        "application/vnd.hmrc.3.0+json",
      );
      return json(result.data, result.ok ? 200 : result.status);
    }

    // ── Get MTD ITSA obligations ───────────────────────────────────────────────
    // Returns which quarterly periods are: Open, Fulfilled, or Overdue
    if (action === "obligations") {
      const from = (body.fromDate as string) ?? `${new Date().getFullYear() - 1}-04-06`;
      const to   = (body.toDate   as string) ?? `${new Date().getFullYear() + 1}-04-05`;
      const biz  = body.businessId as string | undefined;

      const params = new URLSearchParams({
        typeOfBusiness: "self-employment",
        fromDate:       from,
        toDate:         to,
        ...(biz ? { businessId: biz } : {}),
      });

      const result = await hmrcFetch(
        `/obligations/details/${nino}/income-tax?${params}`,
        "GET",
        token,
        "application/vnd.hmrc.2.0+json",
      );
      return json(result.data, result.ok ? 200 : result.status);
    }

    // ── Submit a quarterly period summary ─────────────────────────────────────
    // This is the core MTD ITSA action — sends income + expenses for a quarter
    if (action === "submit_quarter") {
      const businessId   = body.businessId   as string;
      const periodStart  = body.periodStart  as string; // "2026-04-06"
      const periodEnd    = body.periodEnd    as string; // "2026-07-05"
      const incomeData   = body.income       as { turnover: number; other?: number };
      const expenseData  = body.expenses     as SubmitExpenses;

      if (!businessId || !periodStart || !periodEnd) {
        return json({ error: "businessId, periodStart, periodEnd are required" }, 400);
      }

      // Build HMRC request body — only include non-zero expense fields
      const deductions: Record<string, { amount: number }> = {};
      const EXPENSE_MAP: Record<keyof SubmitExpenses, string> = {
        costOfGoods:           "costOfGoods",
        travelCosts:           "travelCosts",
        premisesRunningCosts:  "premisesRunningCosts",
        maintenanceCosts:      "maintenanceCosts",
        adminCosts:            "adminCosts",
        advertisingCosts:      "advertisingCosts",
        businessEntertainment: "businessEntertainmentCosts",
        interest:              "interest",
        financialCharges:      "financialCharges",
        badDebt:               "badDebt",
        professionalFees:      "professionalFees",
        depreciation:          "depreciation",
        other:                 "other",
      };
      for (const [key, hmrcKey] of Object.entries(EXPENSE_MAP)) {
        const val = expenseData?.[key as keyof SubmitExpenses];
        if (val && val > 0) deductions[hmrcKey] = { amount: val };
      }

      const hmrcBody = {
        periodStartDate: periodStart,
        periodEndDate:   periodEnd,
        incomes: {
          turnover: { amount: incomeData.turnover },
          ...(incomeData.other ? { other: { amount: incomeData.other } } : {}),
        },
        deductions,
      };

      const result = await hmrcFetch(
        `/individuals/self-assessment/${nino}/self-employments/${businessId}/periods`,
        "POST",
        token,
        "application/vnd.hmrc.3.0+json",
        hmrcBody,
      );

      // Log submission to DB for audit trail
      if (result.ok) {
        await sb.from("hmrc_submissions").insert({
          owner_id:      user.id,
          period_start:  periodStart,
          period_end:    periodEnd,
          income:        incomeData.turnover,
          expenses:      Object.values(expenseData ?? {}).reduce((s, v) => s + (v || 0), 0),
          submitted_at:  new Date().toISOString(),
          hmrc_response: result.data,
        }).catch(() => {}); // non-fatal — table may not exist yet
      }

      return json(result.data, result.ok ? 200 : result.status);
    }

    // ── Trigger an in-year tax calculation ────────────────────────────────────
    // Call this after submitting a quarter to get HMRC's estimated tax bill
    if (action === "trigger_calculation") {
      const taxYear = (body.taxYear as string) ?? "2026-27"; // HMRC format: "2026-27"
      const result  = await hmrcFetch(
        `/individuals/calculations/${nino}/self-assessment/${taxYear}`,
        "POST",
        token,
        "application/vnd.hmrc.6.0+json",
        {},
      );
      return json(result.data, result.ok ? 200 : result.status);
    }

    // ── Get a specific tax calculation ────────────────────────────────────────
    if (action === "get_calculation") {
      const taxYear       = body.taxYear       as string;
      const calculationId = body.calculationId as string;
      const result = await hmrcFetch(
        `/individuals/calculations/${nino}/self-assessment/${taxYear}/${calculationId}`,
        "GET",
        token,
        "application/vnd.hmrc.6.0+json",
      );
      return json(result.data, result.ok ? 200 : result.status);
    }

    return json({ error: `Unknown action: ${action}` }, 400);

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("hmrc-api error:", msg);
    return json({ error: msg }, msg.includes("Unauthorized") ? 401 : 500);
  }
});
