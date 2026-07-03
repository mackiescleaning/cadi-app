/**
 * supabase/functions/crm-sales-plan/index.ts
 * Cadi — generates a per-customer upsell/cross-sell sales plan.
 *
 * POST { customer_id: string }
 *
 * Reads the customer's profile, service ledger, job history and the
 * business's own service catalogue, asks Claude for a structured plan,
 * then persists it:
 *   - archives the previous active customer_sales_plans row
 *   - inserts the new plan (status 'active')
 *   - inserts one draft customer_outreach row per opportunity
 *   - inserts customer_service_calendar rows for month-anchored opportunities
 *
 * All reads/writes use the CALLER's JWT, so RLS scopes everything to their
 * business — no service-role key in this function.
 *
 * Environment variables: ANTHROPIC_API_KEY
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const SUPABASE_URL      = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const MODEL             = "claude-sonnet-5";

const ALLOWED_ORIGINS = [
  Deno.env.get("APP_ORIGIN"),
  "https://cadi.cleaning",
  "https://app.cadi.cleaning",
].filter(Boolean);

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : (ALLOWED_ORIGINS[0] ?? "*");
  return {
    "Access-Control-Allow-Origin":  allowed,
    "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

const SYSTEM_PROMPT = `You are Cadi's revenue planner for a UK cleaning business. You are given one customer's profile, the services they currently use, their visit history, and the business's full service catalogue.

Produce a realistic sales plan to grow this customer's lifetime value. Think like a small-business owner who knows the customer personally: no pushy sales language, UK English, prices in GBP consistent with the catalogue and what the customer already pays.

Opportunity types:
- "upsell"             — better tier / larger scope of a service they already use
- "cross_sell"         — a catalogue service they don't use yet that genuinely fits them
- "frequency_increase" — same service, more often (only if their history supports it)
- "annual_service"     — a once-a-year service worth anchoring to a month (gutters, fascias, conservatory roof, deep clean, solar panels)
- "winback"            — only if the customer looks lapsed

Rules:
- 2 to 5 opportunities, ranked by likelihood of landing. Fewer good ones beats padding.
- Only suggest services from the catalogue, or obvious siblings of what they already use.
- suggested_month is "YYYY-MM" (the next sensible occurrence, in the future) for annual_service and seasonal ideas; null otherwise.
- email_subject/email_body: a short, warm, personal email the owner could send as-is. First name only. 60-110 words. No placeholders, no sign-off name (the app appends it).
- potential_annual_value: your honest estimate of the extra £/year if every opportunity lands.

Respond with ONLY a JSON object, no markdown fences:
{
  "summary": "2-3 sentences on this customer and the strategy",
  "opportunities": [
    {
      "key": "short_snake_case_id",
      "label": "Service name",
      "type": "upsell|cross_sell|frequency_increase|annual_service|winback",
      "rationale": "one sentence, owner-facing",
      "suggested_month": "YYYY-MM" | null,
      "price_estimate": number | null,
      "email_subject": "...",
      "email_body": "..."
    }
  ],
  "potential_annual_value": number
}`;

const json = (cors: Record<string, string>, data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

serve(async (req: Request) => {
  const cors = corsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: cors });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response("Unauthorized", { status: 401, headers: cors });

  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authError } = await sb.auth.getUser();
  if (authError || !user) return new Response("Unauthorized", { status: 401, headers: cors });

  let body: { customer_id?: string };
  try { body = await req.json(); }
  catch { return json(cors, { error: "Invalid JSON" }, 400); }

  const customerId = body.customer_id;
  if (!customerId) return json(cors, { error: "Missing customer_id" }, 400);

  // ── Load everything the plan needs (RLS scopes all of these) ──────────────
  const [{ data: customer }, { data: ledger }, { data: recentJobs }, { data: catalogue }] =
    await Promise.all([
      sb.from("customers_with_billing").select("*").eq("id", customerId).maybeSingle(),
      sb.from("customer_services")
        .select("label, status, frequency, price, first_used_at, last_used_at, times_used, total_revenue")
        .eq("customer_id", customerId),
      sb.from("jobs")
        .select("date, service, price, status")
        .eq("customer_id", customerId)
        .is("deleted_at", null)
        .order("date", { ascending: false })
        .limit(20),
      sb.from("services")
        .select("id, name, category, pricing_type, price_hourly_rate, price_fixed_standard, price_low, price_high, frequency_one_off, frequency_annually, is_active")
        .eq("is_active", true),
    ]);

  if (!customer) return json(cors, { error: "Customer not found" }, 404);

  const businessId = customer.business_id;
  if (!businessId) return json(cors, { error: "Customer has no business_id" }, 500);

  // ── Build the prompt ───────────────────────────────────────────────────────
  const currentMonth = new Date().toISOString().slice(0, 7);
  const userPrompt = JSON.stringify({
    current_month: currentMonth,
    customer: {
      name: customer.name,
      segment: customer.segment,
      category: customer.category,
      frequency: customer.frequency,
      schedule: customer.schedule,
      price_per_visit: customer.price_per_visit,
      lifetime_value: customer.lifetime_value,
      paid_lifetime_value: customer.paid_lifetime_value,
      customer_since: customer.customer_since,
      last_job_date: customer.last_job_date,
      next_job_date: customer.next_job_date,
      town: customer.town,
      tags: customer.tags,
      notes: customer.notes,
    },
    services_used: ledger ?? [],
    recent_jobs: recentJobs ?? [],
    business_catalogue: (catalogue ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      category: s.category,
      pricing_type: s.pricing_type,
      hourly_rate: s.price_hourly_rate,
      fixed_standard: s.price_fixed_standard,
      price_low: s.price_low,
      price_high: s.price_high,
      one_off: s.frequency_one_off,
      annual: s.frequency_annually,
    })),
  });

  // ── Call Claude ────────────────────────────────────────────────────────────
  const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type":      "application/json",
      "x-api-key":         ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model:      MODEL,
      max_tokens: 3000,
      system:     SYSTEM_PROMPT,
      messages:   [{ role: "user", content: userPrompt }],
    }),
  });

  const aiData = await anthropicRes.json();
  if (!anthropicRes.ok) {
    return json(cors, { error: "AI request failed", detail: aiData }, 502);
  }

  const rawText: string = aiData?.content?.[0]?.text ?? "";
  let plan: {
    summary?: string;
    opportunities?: Array<Record<string, unknown>>;
    potential_annual_value?: number;
  };
  try {
    plan = JSON.parse(rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
  } catch {
    return json(cors, { error: "AI returned unparseable plan", raw: rawText }, 502);
  }

  const opportunities = Array.isArray(plan.opportunities) ? plan.opportunities : [];

  // ── Persist: archive old plan, insert new one ─────────────────────────────
  await sb.from("customer_sales_plans")
    .update({ status: "archived" })
    .eq("customer_id", customerId)
    .eq("status", "active");

  const { data: planRow, error: planErr } = await sb
    .from("customer_sales_plans")
    .insert({
      business_id:            businessId,
      customer_id:            customerId,
      status:                 "active",
      generated_by:           "ai",
      model:                  MODEL,
      summary:                plan.summary ?? null,
      opportunities,
      potential_annual_value: plan.potential_annual_value ?? null,
    })
    .select("*")
    .single();

  if (planErr || !planRow) {
    return json(cors, { error: "Failed to save plan", detail: planErr?.message }, 500);
  }

  // ── Draft outreach + calendar entries per opportunity ─────────────────────
  let outreachCreated = 0;
  let calendarCreated = 0;

  for (const opp of opportunities) {
    const key   = String(opp.key ?? "");
    const label = String(opp.label ?? "");

    // Calendar entry for month-anchored opportunities
    let calendarId: string | null = null;
    const month = typeof opp.suggested_month === "string" &&
      /^\d{4}-\d{2}$/.test(opp.suggested_month) ? `${opp.suggested_month}-01` : null;
    if (month && label) {
      const { data: cal } = await sb.from("customer_service_calendar").insert({
        business_id:    businessId,
        customer_id:    customerId,
        label,
        planned_month:  month,
        recurrence:     opp.type === "annual_service" ? "annual" : "one_off",
        price_estimate: typeof opp.price_estimate === "number" ? opp.price_estimate : null,
        status:         "planned",
        notes:          typeof opp.rationale === "string" ? opp.rationale : null,
      }).select("id").single();
      if (cal) { calendarId = cal.id; calendarCreated++; }
    }

    if (typeof opp.email_subject === "string" && typeof opp.email_body === "string") {
      const { error: oErr } = await sb.from("customer_outreach").insert({
        business_id:     businessId,
        customer_id:     customerId,
        plan_id:         planRow.id,
        opportunity_key: key || null,
        calendar_id:     calendarId,
        channel:         "email",
        subject:         opp.email_subject,
        body:            opp.email_body,
        status:          "draft",
      });
      if (!oErr) outreachCreated++;
    }
  }

  return json(cors, {
    ok: true,
    plan: planRow,
    outreach_created: outreachCreated,
    calendar_created: calendarCreated,
  });
});
