/**
 * supabase/functions/export-data/index.ts
 * Cadi — GDPR Article 15 (right of access) + Article 20 (data portability)
 *
 * Returns the full export of all personal data Cadi holds for the calling user:
 *   - profile + business
 *   - customers, quotes, invoices, payments
 *   - bank connections (metadata only — no tokens), transactions, merchant rules
 *   - manual money entries, mileage logs
 *   - staff, payroll runs, holiday allowances
 *   - onboarding state, walkthrough analyses, weekly reports
 *
 * SECURITY: only returns data for the authenticated caller. Bank tokens and
 * HMRC OAuth tokens are scrubbed before export.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit } from "../_shared/rateLimit.ts";
import { writeAudit } from "../_shared/auditLog.ts";

// CORS pinned to known origins — no wildcard on a function that emits PII
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

function json(data: unknown, status = 200, origin: string | null = null, extraHeaders: HeadersInit = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      ...corsHeaders(origin),
      "Content-Type":   "application/json",
      "Cache-Control":  "no-store",
      ...extraHeaders,
    },
  });
}

// Strip sensitive fields. Pattern broadened to catch every shape of token / key
// we know about plus likely future additions (webhook signing keys, bearer
// tokens, encrypted blobs, OAuth state, etc).
function scrub<T extends Record<string, unknown>>(row: T): T {
  const SENSITIVE = /access_token|refresh_token|id_token|bearer|consent(_id|_token)?|secret|api_key|signing_key|webhook_secret|password|hash|salt|cookie|csrf|enc:v1:|nonce|otp|verification_code/i;
  const out = { ...row } as Record<string, unknown>;
  for (const key of Object.keys(out)) {
    if (SENSITIVE.test(key)) {
      out[key] = '[REDACTED for security]';
    } else if (typeof out[key] === 'string' && /^enc:v1:/.test(out[key] as string)) {
      // Defence-in-depth: also redact encrypted blobs we missed by key name
      out[key] = '[REDACTED encrypted value]';
    }
  }
  return out as T;
}

serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(origin) });

  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    const { data: { user }, error: authErr } = await sb.auth.getUser(token);
    if (authErr || !user) return json({ error: "Unauthorized" }, 401, origin);

    // Rate limit: an export is an expensive full-account scan of PII. Cap per
    // user (not IP) so a stolen session can't be used to exfiltrate on a loop.
    const rl = await checkRateLimit(sb, { bucket: "export-data", key: user.id, limit: 5, windowMs: 3_600_000 });
    if (!rl.ok) {
      const retryAfter = Math.max(1, Math.ceil((new Date(rl.resetAt).getTime() - Date.now()) / 1000));
      return json({ error: "Too many export requests. Please try again later.", retry_after_ms: retryAfter * 1000 },
        429, origin, { "Retry-After": String(retryAfter) });
    }

    // Look up the business id (may be null if onboarding incomplete)
    const { data: bizRow } = await sb
      .from("businesses").select("id").eq("owner_user_id", user.id).maybeSingle();
    const businessId = bizRow?.id as string | undefined;

    // Helper: fetch all rows from a table by a column = value
    const fetchBy = async (table: string, col: string, val: string | undefined) => {
      if (!val) return [];
      const { data, error } = await sb.from(table).select("*").eq(col, val);
      // Log, don't swallow: a silently-empty section in a GDPR export is a
      // compliance risk. This is how the staff/payroll omission went unnoticed.
      if (error) console.error(`export-data: fetch ${table}.${col} failed:`, error.message);
      return (data ?? []).map(scrub);
    };

    // Concurrent fetches across all owned data
    const [
      profile,
      businessRow,
      customers,
      quotes,
      invoices,
      moneyEntries,
      merchantRules,
      mileageLogs,
      bankConnections,
      transactions,
      onboardingProgress,
      onboardingSteps,
      walkthroughs,
      walkthroughAnalyses,
      weeklyReports,
      staffRows,
      payrollRuns,
    ] = await Promise.all([
      sb.from("profiles").select("*").eq("id", user.id).maybeSingle()
        .then(r => r.data ? scrub(r.data) : null),
      businessId
        ? sb.from("businesses").select("*").eq("id", businessId).maybeSingle()
            .then(r => r.data ? scrub(r.data) : null)
        : Promise.resolve(null),
      fetchBy("customers",       "owner_id",     user.id),
      fetchBy("quotes",          "owner_id",     user.id),
      fetchBy("invoices",        "owner_id",     user.id),
      fetchBy("money_entries",   "owner_id",     user.id),
      fetchBy("merchant_rules",  "user_id",      user.id),
      fetchBy("mileage_logs",    "owner_id",     user.id).catch(() => []),
      fetchBy("bank_connections","business_id",  businessId),
      fetchBy("transactions",    "business_id",  businessId),
      fetchBy("onboarding_progress", "business_id", businessId).catch(() => []),
      fetchBy("onboarding_steps",    "business_id", businessId).catch(() => []),
      fetchBy("walkthroughs",        "business_id", businessId).catch(() => []),
      fetchBy("walkthrough_analysis","business_id", businessId).catch(() => []),
      fetchBy("weekly_reports",      "business_id", businessId).catch(() => []),
      fetchBy("staff_members",       "owner_id",    user.id).catch(() => []),
      fetchBy("pay_runs",            "business_id", businessId).catch(() => []),
    ]);

    // Additional PII-bearing tables the export previously omitted. Scoping
    // columns verified against the live schema (owner_id vs business_id vs user_id).
    const [staffAbsences, staffTraining, timesheets, payslips, bankTransactions, leads, reviews] =
      await Promise.all([
        fetchBy("staff_absences",   "owner_id",    user.id).catch(() => []),
        fetchBy("staff_training",   "business_id", businessId).catch(() => []),
        fetchBy("timesheets",       "business_id", businessId).catch(() => []),
        fetchBy("payslips",         "business_id", businessId).catch(() => []),
        fetchBy("bank_transactions","user_id",     user.id).catch(() => []),
        fetchBy("leads",            "business_id", businessId).catch(() => []),
        fetchBy("reviews",          "business_id", businessId).catch(() => []),
      ]);

    const exportBundle = {
      meta: {
        exportedAt:  new Date().toISOString(),
        exportedFor: { userId: user.id, email: user.email },
        notes: [
          "This export contains all personal data Cadi holds for your account.",
          "Sensitive fields (OAuth tokens, API secrets, bank consent tokens) have been redacted for security.",
          "For questions about this export, contact support@cadi.cleaning.",
          "Under UK GDPR you have the right to rectify inaccurate data or request erasure — see the Privacy Policy.",
        ],
      },
      profile,
      business: businessRow,
      customers,
      quotes,
      invoices,
      moneyEntries,
      merchantRules,
      mileageLogs,
      bankConnections,
      transactions,
      onboardingProgress,
      onboardingSteps,
      walkthroughs,
      walkthroughAnalyses,
      weeklyReports,
      staff: staffRows,
      staffAbsences,
      staffTraining,
      timesheets,
      payrollRuns,
      payslips,
      bankTransactions,
      leads,
      reviews,
    };

    // Audit the access (GDPR Art. 15 requests must be traceable: who, what, when).
    await writeAudit(sb, req, {
      ownerId:  user.id,
      actorId:  user.id,
      action:   "data.export",
      category: "account",
      detail: {
        customers:    customers.length,
        invoices:     invoices.length,
        moneyEntries: moneyEntries.length,
        staff:        staffRows.length,
        payRuns:      payrollRuns.length,
      },
    });

    // Add Content-Disposition so browsers download rather than render inline —
    // this is a PII bundle, not a webpage.
    const filename = `cadi-export-${new Date().toISOString().slice(0, 10)}.json`;
    return json(exportBundle, 200, origin, {
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Referrer-Policy":     "no-referrer",
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("export-data error:", msg);
    return json({ error: msg }, 500, origin);
  }
});
