/**
 * supabase/functions/payroll-calculate/index.ts
 *
 * POST { pay_run_id }  — requires manager JWT
 *
 * For each active staff member in the business:
 *   1. Sums timesheet hours in the pay run period
 *   2. Calculates gross pay = hourly_rate × hours
 *   3. Fetches YTD figures from prior payslips this tax year
 *   4. Calculates PAYE (cumulative method, 2025-26 rates)
 *   5. Calculates NI employee + employer (period method, 2025-26 rates)
 *   6. Upserts payslip record
 * Then marks the pay_run as 'calculated'.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "content-type, authorization, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

// ── 2025-26 tax constants ─────────────────────────────────────────────────────
const TAX = {
  personalAllowance: 12_570,
  basicRateLimit:    50_270,
  higherRateLimit:  125_140,
  basicRate:          0.20,
  higherRate:         0.40,
  additionalRate:     0.45,
};

// NI thresholds (annual) scaled per period inside the calc functions
const NI_ANNUAL = {
  lel:  6_396,  // Lower Earnings Limit
  pt:  12_570,  // Primary Threshold
  st:   5_000,  // Secondary Threshold
  uel: 50_270,  // Upper Earnings Limit
};

function periodsPerYear(freq: string): number {
  return ({ W1: 52, W2: 26, W4: 13, M1: 12, M3: 4, M6: 2, MA: 1 } as Record<string, number>)[freq] ?? 12;
}

function round2(n: number): number { return Math.round(n * 100) / 100; }

/**
 * PAYE — cumulative method.
 * grossYtd:   cumulative gross including this period
 * prevTaxYtd: tax paid in periods before this one
 * periodNo:   1-based period number in the tax year
 */
function calcPAYE(
  grossYtd: number,
  prevTaxYtd: number,
  periodNo: number,
  totalPeriods: number,
  taxCode: string,
): number {
  const codeNum = parseInt(taxCode.replace(/[^0-9]/g, "")) || 1257;
  const annualAllowance = codeNum * 10;  // e.g. 1257 → £12,570

  const freePayToDate  = annualAllowance * (periodNo / totalPeriods);
  const taxableToDate  = Math.max(0, grossYtd - freePayToDate);

  // Band limits scaled to YTD proportion of the year
  const basicBand  = (TAX.basicRateLimit  - TAX.personalAllowance) * (periodNo / totalPeriods);
  const higherBand = (TAX.higherRateLimit - TAX.personalAllowance) * (periodNo / totalPeriods);

  let taxToDate = 0;
  if (taxableToDate <= basicBand) {
    taxToDate = taxableToDate * TAX.basicRate;
  } else if (taxableToDate <= higherBand) {
    taxToDate = basicBand * TAX.basicRate
      + (taxableToDate - basicBand) * TAX.higherRate;
  } else {
    taxToDate = basicBand * TAX.basicRate
      + (higherBand - basicBand) * TAX.higherRate
      + (taxableToDate - higherBand) * TAX.additionalRate;
  }

  return round2(Math.max(0, taxToDate - prevTaxYtd));
}

/**
 * NI — period method (NI is never cumulative).
 * grossPeriod: gross pay this period
 * periodNo / totalPeriods: used to scale annual thresholds to period thresholds
 */
function calcNI(
  grossPeriod: number,
  periodNo: number,
  totalPeriods: number,
): { employeeNI: number; employerNI: number } {
  const scale = periodNo / totalPeriods;  // proportion of year completed
  // Derive per-period thresholds from annual figures
  // NI is per-period so we divide by totalPeriods (not scale by periodNo)
  const periodFraction = 1 / totalPeriods;
  const pt  = NI_ANNUAL.pt  * periodFraction;
  const st  = NI_ANNUAL.st  * periodFraction;
  const uel = NI_ANNUAL.uel * periodFraction;

  // Employee: 8% on (PT → UEL), 2% above UEL
  const band1 = Math.max(0, Math.min(grossPeriod, uel) - pt);
  const band2 = Math.max(0, grossPeriod - uel);
  const employeeNI = round2(band1 * 0.08 + band2 * 0.02);

  // Employer: 15% above ST
  const employerNI = round2(Math.max(0, grossPeriod - st) * 0.15);

  return { employeeNI, employerNI };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // ── auth ──────────────────────────────────────────────────────────────────
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Missing auth" }, 401);

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: { user }, error: authErr } = await sb.auth.getUser();
  if (authErr || !user) return json({ error: "Unauthorised" }, 401);

  // ── parse body ────────────────────────────────────────────────────────────
  let body: { pay_run_id: string };
  try { body = await req.json(); }
  catch { return json({ error: "Invalid JSON" }, 400); }

  const { pay_run_id } = body;
  if (!pay_run_id) return json({ error: "Missing pay_run_id" }, 400);

  // ── fetch pay_run ─────────────────────────────────────────────────────────
  const { data: payRun, error: prErr } = await sb
    .from("pay_runs")
    .select("*")
    .eq("id", pay_run_id)
    .eq("business_id", user.id)
    .single();

  if (prErr || !payRun) return json({ error: "Pay run not found" }, 404);
  if (!["draft", "calculated"].includes(payRun.status))
    return json({ error: "Pay run already submitted" }, 409);

  // ── fetch payroll settings (for payment frequency) ────────────────────────
  const { data: settings } = await sb
    .from("payroll_settings")
    .select("payment_frequency")
    .eq("business_id", user.id)
    .single();

  const freq        = settings?.payment_frequency ?? "M1";
  const totalPeriods = periodsPerYear(freq);

  // Mark as calculating
  await sb.from("pay_runs").update({ status: "calculating", updated_at: new Date().toISOString() })
    .eq("id", pay_run_id);

  // ── fetch all active staff with hourly_rate ───────────────────────────────
  const { data: staff } = await sb
    .from("team_members")
    .select("id, first_name, last_name, hourly_rate, tax_code, ni_category")
    .eq("business_id", user.id)
    .eq("is_active", true);

  if (!staff?.length) {
    await sb.from("pay_runs").update({ status: "draft", updated_at: new Date().toISOString() })
      .eq("id", pay_run_id);
    return json({ error: "No active staff found" }, 400);
  }

  const payslips = [];

  for (const member of staff) {
    if (!member.hourly_rate) continue;  // skip staff with no rate

    // ── sum timesheet hours for this period ─────────────────────────────────
    const { data: timesheets } = await sb
      .from("timesheets")
      .select("clock_in_at, clock_out_at")
      .eq("staff_id", member.id)
      .eq("business_id", user.id)
      .eq("status", "clocked_out")
      .gte("date", payRun.period_start)
      .lte("date", payRun.period_end);

    const hoursWorked = (timesheets ?? []).reduce((sum, ts) => {
      if (!ts.clock_in_at || !ts.clock_out_at) return sum;
      const mins = (new Date(ts.clock_out_at).getTime() - new Date(ts.clock_in_at).getTime()) / 60_000;
      return sum + mins / 60;
    }, 0);

    const grossPeriod = round2(member.hourly_rate * hoursWorked);

    // ── fetch YTD figures from prior payslips in this tax year ───────────────
    const { data: priorPayslips } = await sb
      .from("payslips")
      .select("gross_pay, tax_period, ni_employee_period, ni_employer_period, pay_run_id")
      .eq("staff_id", member.id)
      .eq("business_id", user.id)
      .neq("pay_run_id", pay_run_id);

    // Filter to same tax year via period_start >= 6 Apr
    const [tyFrom, tyTo] = payRun.tax_year.split("-").map(Number);
    const taxYearStart = `20${tyFrom}-04-06`;
    const taxYearEnd   = `20${tyTo}-04-05`;

    // Get pay_run ids in this tax year
    const { data: taxYearRuns } = await sb
      .from("pay_runs")
      .select("id")
      .eq("business_id", user.id)
      .gte("period_start", taxYearStart)
      .lte("period_end", taxYearEnd)
      .neq("id", pay_run_id);

    const taxYearRunIds = new Set((taxYearRuns ?? []).map((r: { id: string }) => r.id));

    const ytd = (priorPayslips ?? [])
      .filter(p => taxYearRunIds.has(p.pay_run_id))
      .reduce(
        (acc, p) => ({
          gross:       acc.gross       + (p.gross_pay           ?? 0),
          tax:         acc.tax         + (p.tax_period          ?? 0),
          niEmployee:  acc.niEmployee  + (p.ni_employee_period  ?? 0),
          niEmployer:  acc.niEmployer  + (p.ni_employer_period  ?? 0),
        }),
        { gross: 0, tax: 0, niEmployee: 0, niEmployer: 0 },
      );

    const grossYtd = round2(ytd.gross + grossPeriod);

    // ── calculate PAYE ────────────────────────────────────────────────────────
    const taxCode    = member.tax_code ?? "1257L";
    const taxPeriod  = calcPAYE(grossYtd, ytd.tax, payRun.period_no, totalPeriods, taxCode);
    const taxYtd     = round2(ytd.tax + taxPeriod);

    // ── calculate NI ──────────────────────────────────────────────────────────
    const { employeeNI, employerNI } = calcNI(grossPeriod, payRun.period_no, totalPeriods);
    const niEmployeeYtd = round2(ytd.niEmployee + employeeNI);
    const niEmployerYtd = round2(ytd.niEmployer + employerNI);

    const netPay = round2(grossPeriod - taxPeriod - employeeNI);

    payslips.push({
      pay_run_id,
      business_id:         user.id,
      staff_id:            member.id,
      hours_worked:        round2(hoursWorked),
      gross_pay:           grossPeriod,
      tax_period:          taxPeriod,
      ni_employee_period:  employeeNI,
      ni_employer_period:  employerNI,
      net_pay:             netPay,
      gross_pay_ytd:       grossYtd,
      tax_ytd:             taxYtd,
      ni_employee_ytd:     niEmployeeYtd,
      ni_employer_ytd:     niEmployerYtd,
      tax_code:            taxCode,
      ni_category:         member.ni_category ?? "A",
      status:              "calculated",
      updated_at:          new Date().toISOString(),
    });
  }

  // ── upsert payslips ────────────────────────────────────────────────────────
  if (payslips.length) {
    const { error: upsertErr } = await sb
      .from("payslips")
      .upsert(payslips, { onConflict: "pay_run_id,staff_id" });

    if (upsertErr) {
      await sb.from("pay_runs").update({ status: "draft", updated_at: new Date().toISOString() })
        .eq("id", pay_run_id);
      return json({ error: upsertErr.message }, 500);
    }
  }

  // ── mark pay_run calculated ────────────────────────────────────────────────
  await sb.from("pay_runs")
    .update({ status: "calculated", updated_at: new Date().toISOString() })
    .eq("id", pay_run_id);

  return json({
    pay_run_id,
    payslip_count: payslips.length,
    totals: {
      gross:       round2(payslips.reduce((s, p) => s + p.gross_pay, 0)),
      tax:         round2(payslips.reduce((s, p) => s + p.tax_period, 0)),
      ni_employee: round2(payslips.reduce((s, p) => s + p.ni_employee_period, 0)),
      ni_employer: round2(payslips.reduce((s, p) => s + p.ni_employer_period, 0)),
      net:         round2(payslips.reduce((s, p) => s + p.net_pay, 0)),
    },
  });
});
