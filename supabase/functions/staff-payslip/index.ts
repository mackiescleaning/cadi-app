/**
 * supabase/functions/staff-payslip/index.ts
 * Authenticated by short-lived staff JWT (Authorization: Bearer <token>).
 *
 * GET → recent payslips for this staff member, newest first, limit 12.
 *       Each row includes pay_run fields (payment_date, period_start,
 *       period_end, tax_year, period_no, status).
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireStaffAuth } from "../_shared/staffJwt.ts";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "content-type, apikey, authorization",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);

  let claims;
  try { claims = await requireStaffAuth(req); }
  catch { return json({ error: "Unauthorized" }, 401); }
  const staffId = claims.sub;
  const ownerId = claims.biz;

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Confirm member is still active (revocation by deactivation)
  const { data: member } = await sb
    .from("team_members")
    .select("id")
    .eq("id", staffId)
    .eq("business_id", ownerId)
    .eq("is_active", true)
    .single();
  if (!member) return json({ error: "Unauthorized" }, 401);

  // Fetch payslips with pay_run details
  const { data: payslips, error } = await sb
    .from("payslips")
    .select(`
      id,
      hours_worked,
      gross_pay,
      tax_period,
      ni_employee_period,
      ni_employer_period,
      net_pay,
      gross_pay_ytd,
      tax_ytd,
      ni_employee_ytd,
      ni_employer_ytd,
      tax_code,
      ni_category,
      status,
      pay_runs (
        id,
        tax_year,
        period_no,
        payment_date,
        period_start,
        period_end,
        status
      )
    `)
    .eq("staff_id", staffId)
    .eq("business_id", ownerId)
    .order("created_at", { ascending: false })
    .limit(12);

  if (error) return json({ error: error.message }, 500);

  return json({ payslips: payslips ?? [] });
});
