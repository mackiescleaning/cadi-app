/**
 * supabase/functions/payroll-submit-fps/index.ts
 *
 * POST { pay_run_id }  — requires manager JWT
 *
 * 1. Loads payroll_settings, pay_run, payslips, and staff details
 * 2. Builds GovTalkMessage / IRenvelope FPS XML (HMRC RTI 2025-26 schema)
 * 3. Calculates IRmark (SHA-1 of IRenvelope bytes, base64-encoded)
 * 4. POSTs to HMRC transaction engine (sandbox or live based on settings)
 * 5. Polls for acknowledgement (up to 30 s)
 * 6. Stores response and updates pay_run status
 *
 * XML schema: http://www.govtalk.gov.uk/taxation/PAYE/RTI/FullPaymentSubmission/25-26/1
 * Validate element names against the official 2025-26 RIM XSD before live use.
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

// ── XML helpers ───────────────────────────────────────────────────────────────

function esc(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function generateCorrelationId(): string {
  // 32-char uppercase hex
  return crypto.randomUUID().replace(/-/g, "").toUpperCase();
}

async function sha1Base64(text: string): Promise<string> {
  const bytes  = new TextEncoder().encode(text);
  const hash   = await crypto.subtle.digest("SHA-1", bytes);
  return btoa(String.fromCharCode(...new Uint8Array(hash)));
}

// ── FPS XML builders ──────────────────────────────────────────────────────────

interface Settings {
  tax_office_no: string;
  paye_ref: string;
  ao_ref: string;
  gateway_user_id: string;
  gateway_password_enc: string;
  contact_fore: string | null;
  contact_sur: string | null;
  contact_email: string | null;
  payment_frequency: string;
  sandbox_mode: boolean;
}

interface PayRun {
  id: string;
  tax_year: string;       // "2025-26"
  period_no: number;
  payment_date: string;   // YYYY-MM-DD
  period_end: string;     // YYYY-MM-DD
}

interface StaffPayslip {
  staff_id: string;
  first_name: string;
  last_name: string;
  ni_number: string | null;
  date_of_birth: string | null;
  gender: string | null;
  address_line1: string | null;
  address_postcode: string | null;
  tax_code: string;
  ni_category: string;
  payroll_id: string | null;
  contract_start_date: string | null;
  // Payslip figures
  gross_pay: number;
  tax_period: number;
  ni_employee_period: number;
  ni_employer_period: number;
  gross_pay_ytd: number;
  tax_ytd: number;
  ni_employee_ytd: number;
  ni_employer_ytd: number;
}

function buildEmployeeXml(emp: StaffPayslip, payRun: PayRun, freq: string): string {
  const isMonthly = freq.startsWith("M");
  const periodTag = isMonthly ? `<MonthNo>${payRun.period_no}</MonthNo>` : `<WeekNo>${payRun.period_no}</WeekNo>`;

  // PayId falls back to staff_id if no explicit payroll_id
  const payId = emp.payroll_id || emp.staff_id;

  return `        <Employee>
          <EmployeeDetails>
            <NINO>${esc(emp.ni_number ?? "")}</NINO>
            <Name>
              <Fore>${esc(emp.first_name)}</Fore>
              <Sur>${esc(emp.last_name)}</Sur>
            </Name>
            <Address>
              <Line>${esc(emp.address_line1 ?? "")}</Line>
              <UKPostcode>${esc(emp.address_postcode ?? "")}</UKPostcode>
            </Address>${emp.date_of_birth ? `\n            <BirthDate>${emp.date_of_birth}</BirthDate>` : ""}
            <Gender>${esc(emp.gender ?? "U")}</Gender>
          </EmployeeDetails>
          <Employment>
            <PayId>${esc(payId)}</PayId>${emp.contract_start_date ? `\n            <StartDate>${emp.contract_start_date}</StartDate>` : ""}
            <FiguresToDate>
              <TaxablePay>${emp.gross_pay_ytd.toFixed(2)}</TaxablePay>
              <TotalTax>${emp.tax_ytd.toFixed(2)}</TotalTax>
            </FiguresToDate>
            <Payment>
              <PayFreq>${freq}</PayFreq>
              <PmtDate>${payRun.payment_date}</PmtDate>
              ${periodTag}
              <TaxablePay>${emp.gross_pay.toFixed(2)}</TaxablePay>
              <TaxDeductedOrRefunded>${emp.tax_period.toFixed(2)}</TaxDeductedOrRefunded>
            </Payment>
            <NIlettersAndValues>
              <NIletter>${esc(emp.ni_category)}</NIletter>
              <GrossEarningsForNICsInPd>${emp.gross_pay.toFixed(2)}</GrossEarningsForNICsInPd>
              <GrossEarningsForNICsYTD>${emp.gross_pay_ytd.toFixed(2)}</GrossEarningsForNICsYTD>
              <TotalEmpNICInPd>${emp.ni_employer_period.toFixed(2)}</TotalEmpNICInPd>
              <TotalEmpNICYTD>${emp.ni_employer_ytd.toFixed(2)}</TotalEmpNICYTD>
              <EmpeeContribsInPd>${emp.ni_employee_period.toFixed(2)}</EmpeeContribsInPd>
              <EmpeeContribsYTD>${emp.ni_employee_ytd.toFixed(2)}</EmpeeContribsYTD>
            </NIlettersAndValues>
          </Employment>
        </Employee>`;
}

async function buildFpsXml(
  settings: Settings,
  payRun: PayRun,
  employees: StaffPayslip[],
  correlationId: string,
): Promise<string> {
  const freq      = settings.payment_frequency;
  const sandbox   = settings.sandbox_mode;
  const endpoint  = sandbox
    ? "https://test-transaction-engine.tax.service.gov.uk/submission"
    : "https://transaction-engine.tax.service.gov.uk/submission";

  // Tax year in short form e.g. "25-26"
  const taxYear = payRun.tax_year.replace(/20(\d\d)-20(\d\d)/, "$1-$2");

  const employeesXml = employees.map(e => buildEmployeeXml(e, payRun, freq)).join("\n");

  // Build IRenvelope first (needed for IRmark)
  const irEnvelopeBody = `    <IRenvelope xmlns="http://www.govtalk.gov.uk/taxation/PAYE/RTI/FullPaymentSubmission/25-26/1">
      <IRheader>
        <Keys>
          <Key Type="TaxOfficeNumber">${esc(settings.tax_office_no)}</Key>
          <Key Type="TaxOfficeReference">${esc(settings.paye_ref)}</Key>
        </Keys>
        <PeriodEnd>${payRun.period_end}</PeriodEnd>
        <IRmark Type="generic">IRMARK_PLACEHOLDER</IRmark>
        <Sender>
          <Originator/>
          <Contact>
            <Name>
              <Fore>${esc(settings.contact_fore ?? "Payroll")}</Fore>
              <Sur>${esc(settings.contact_sur ?? "Administrator")}</Sur>
            </Name>
            <Email>${esc(settings.contact_email ?? "")}</Email>
          </Contact>
          <Agent>
            <Company>Cadi</Company>
            <Address>
              <Line>Online</Line>
            </Address>
          </Agent>
        </Sender>
      </IRheader>
      <FullPaymentSubmission>
        <EmpRefs>
          <OfficeNo>${esc(settings.tax_office_no)}</OfficeNo>
          <PayeRef>${esc(settings.paye_ref)}</PayeRef>
          <AORef>${esc(settings.ao_ref)}</AORef>
        </EmpRefs>
        <RelatedTaxYear>${taxYear}</RelatedTaxYear>
${employeesXml}
      </FullPaymentSubmission>
    </IRenvelope>`;

  // IRmark = SHA-1 of the IRenvelope XML (excluding the placeholder tag content)
  const xmlForHashing = irEnvelopeBody.replace("IRMARK_PLACEHOLDER", "");
  const irmark = await sha1Base64(xmlForHashing);
  const irEnvelope = irEnvelopeBody.replace("IRMARK_PLACEHOLDER", irmark);

  const now = new Date().toISOString();

  return `<?xml version="1.0" encoding="UTF-8"?>
<GovTalkMessage xmlns="http://www.govtalk.gov.uk/CM/envelope">
  <EnvelopeVersion>2.0</EnvelopeVersion>
  <Header>
    <MessageDetails>
      <Class>HMRC-PAYE-RTI-FPS-TIL</Class>
      <Qualifier>request</Qualifier>
      <Function>submit</Function>
      <TransactionID>${correlationId}</TransactionID>
      <CorrelationID>${correlationId}</CorrelationID>
      <Transformation>XML</Transformation>${sandbox ? "\n      <GatewayTest>1</GatewayTest>" : ""}
    </MessageDetails>
    <SenderDetails>
      <IDAuthentication>
        <SenderID>${esc(settings.gateway_user_id)}</SenderID>
        <Authentication>
          <Method>clear</Method>
          <Role>principal</Role>
          <Value>${esc(settings.gateway_password_enc)}</Value>
        </Authentication>
      </IDAuthentication>
    </SenderDetails>
  </Header>
  <GovTalkDetails>
    <Keys>
      <Key Type="TaxOfficeNumber">${esc(settings.tax_office_no)}</Key>
      <Key Type="TaxOfficeReference">${esc(settings.paye_ref)}</Key>
    </Keys>
    <TargetDetails>
      <Organisation>IR</Organisation>
    </TargetDetails>
    <ChannelRouting>
      <Channel>
        <URI>${endpoint}</URI>
        <Product>Cadi</Product>
        <Version>1.0</Version>
        <Timestamp>${now}</Timestamp>
      </Channel>
    </ChannelRouting>
  </GovTalkDetails>
  <Body>
${irEnvelope}
  </Body>
</GovTalkMessage>`;
}

// ── HMRC submission + polling ─────────────────────────────────────────────────

async function submitFps(xml: string, sandbox: boolean): Promise<string> {
  const endpoint = sandbox
    ? "https://test-transaction-engine.tax.service.gov.uk/submission"
    : "https://transaction-engine.tax.service.gov.uk/submission";

  const res = await fetch(endpoint, {
    method:  "POST",
    headers: { "Content-Type": "text/xml; charset=UTF-8" },
    body:    xml,
  });

  return res.text();
}

function extractPollUrl(responseXml: string): string | null {
  const m = responseXml.match(/<ResponseEndPoint[^>]*>([^<]+)<\/ResponseEndPoint>/);
  return m ? m[1].trim() : null;
}

function extractQualifier(responseXml: string): string {
  const m = responseXml.match(/<Qualifier>([^<]+)<\/Qualifier>/);
  return m ? m[1].trim() : "unknown";
}

function extractCorrelationFromResponse(responseXml: string): string | null {
  const m = responseXml.match(/<CorrelationID>([^<]+)<\/CorrelationID>/);
  return m ? m[1].trim() : null;
}

async function pollForResult(
  pollUrl: string,
  correlationId: string,
  maxAttempts = 6,
  intervalMs = 5_000,
): Promise<string> {
  const pollXml = `<?xml version="1.0" encoding="UTF-8"?>
<GovTalkMessage xmlns="http://www.govtalk.gov.uk/CM/envelope">
  <EnvelopeVersion>2.0</EnvelopeVersion>
  <Header>
    <MessageDetails>
      <Class>HMRC-PAYE-RTI-FPS-TIL</Class>
      <Qualifier>poll</Qualifier>
      <Function>submit</Function>
      <CorrelationID>${correlationId}</CorrelationID>
      <Transformation>XML</Transformation>
    </MessageDetails>
  </Header>
  <GovTalkDetails/>
  <Body/>
</GovTalkMessage>`;

  for (let i = 0; i < maxAttempts; i++) {
    if (i > 0) await new Promise(r => setTimeout(r, intervalMs));

    const res = await fetch(pollUrl, {
      method:  "POST",
      headers: { "Content-Type": "text/xml; charset=UTF-8" },
      body:    pollXml,
    });

    const body      = await res.text();
    const qualifier = extractQualifier(body);

    if (qualifier === "response" || qualifier === "error") return body;
    // qualifier === "acknowledgement" → still processing, keep polling
  }

  return "poll_timeout";
}

// ── main handler ──────────────────────────────────────────────────────────────

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

  // ── load payroll_settings ─────────────────────────────────────────────────
  const { data: settings, error: sErr } = await sb
    .from("payroll_settings")
    .select("*")
    .eq("business_id", user.id)
    .single();

  if (sErr || !settings)
    return json({ error: "Payroll settings not configured" }, 422);

  if (!settings.gateway_user_id || !settings.gateway_password_enc)
    return json({ error: "Government Gateway credentials not set" }, 422);

  // ── load pay_run ──────────────────────────────────────────────────────────
  const { data: payRun, error: prErr } = await sb
    .from("pay_runs")
    .select("*")
    .eq("id", pay_run_id)
    .eq("business_id", user.id)
    .single();

  if (prErr || !payRun) return json({ error: "Pay run not found" }, 404);
  if (payRun.status !== "calculated")
    return json({ error: `Pay run must be in 'calculated' state (current: ${payRun.status})` }, 409);

  // ── load payslips + staff details ─────────────────────────────────────────
  const { data: payslips, error: psErr } = await sb
    .from("payslips")
    .select(`
      staff_id, gross_pay, tax_period, ni_employee_period, ni_employer_period,
      gross_pay_ytd, tax_ytd, ni_employee_ytd, ni_employer_ytd,
      tax_code, ni_category
    `)
    .eq("pay_run_id", pay_run_id)
    .eq("status", "calculated");

  if (psErr || !payslips?.length)
    return json({ error: "No calculated payslips found" }, 422);

  // Fetch staff details for each payslip
  const staffIds = payslips.map(p => p.staff_id);
  const { data: staffRows } = await sb
    .from("team_members")
    .select("id, first_name, last_name, ni_number, date_of_birth, gender, address_line1, address_postcode, payroll_id, contract_start_date")
    .in("id", staffIds);

  const staffById = Object.fromEntries((staffRows ?? []).map(s => [s.id, s]));

  const employees: StaffPayslip[] = payslips.map(ps => ({
    staff_id:             ps.staff_id,
    first_name:           staffById[ps.staff_id]?.first_name ?? "",
    last_name:            staffById[ps.staff_id]?.last_name ?? "",
    ni_number:            staffById[ps.staff_id]?.ni_number ?? null,
    date_of_birth:        staffById[ps.staff_id]?.date_of_birth ?? null,
    gender:               staffById[ps.staff_id]?.gender ?? null,
    address_line1:        staffById[ps.staff_id]?.address_line1 ?? null,
    address_postcode:     staffById[ps.staff_id]?.address_postcode ?? null,
    payroll_id:           staffById[ps.staff_id]?.payroll_id ?? null,
    contract_start_date:  staffById[ps.staff_id]?.contract_start_date ?? null,
    tax_code:             ps.tax_code,
    ni_category:          ps.ni_category,
    gross_pay:            ps.gross_pay,
    tax_period:           ps.tax_period,
    ni_employee_period:   ps.ni_employee_period,
    ni_employer_period:   ps.ni_employer_period,
    gross_pay_ytd:        ps.gross_pay_ytd,
    tax_ytd:              ps.tax_ytd,
    ni_employee_ytd:      ps.ni_employee_ytd,
    ni_employer_ytd:      ps.ni_employer_ytd,
  }));

  // ── build FPS XML ─────────────────────────────────────────────────────────
  const correlationId = generateCorrelationId();
  const fpsXml = await buildFpsXml(settings, payRun, employees, correlationId);

  // ── mark as submitting, store XML ─────────────────────────────────────────
  await sb.from("pay_runs").update({
    status:             "submitting",
    fps_correlation_id: correlationId,
    fps_submitted_at:   new Date().toISOString(),
    fps_xml:            fpsXml,
    updated_at:         new Date().toISOString(),
  }).eq("id", pay_run_id);

  // ── submit to HMRC ────────────────────────────────────────────────────────
  let responseXml: string;
  try {
    responseXml = await submitFps(fpsXml, settings.sandbox_mode);
  } catch (err) {
    await sb.from("pay_runs").update({
      status:       "rejected",
      fps_response: String(err),
      updated_at:   new Date().toISOString(),
    }).eq("id", pay_run_id);
    return json({ error: "HMRC network error", detail: String(err) }, 502);
  }

  const qualifier = extractQualifier(responseXml);

  // ── poll if HMRC returned an acknowledgement (still processing) ───────────
  let finalResponse = responseXml;
  if (qualifier === "acknowledgement") {
    const pollUrl = extractPollUrl(responseXml);
    const pollCorr = extractCorrelationFromResponse(responseXml) ?? correlationId;
    if (pollUrl) {
      finalResponse = await pollForResult(pollUrl, pollCorr);
    }
  }

  const finalQualifier = extractQualifier(finalResponse);
  const accepted        = finalQualifier === "response";
  const newStatus       = accepted ? "accepted" : finalResponse === "poll_timeout" ? "submitted" : "rejected";

  // ── update payslip statuses ────────────────────────────────────────────────
  if (accepted) {
    await sb.from("payslips")
      .update({ status: "submitted", updated_at: new Date().toISOString() })
      .eq("pay_run_id", pay_run_id);
  }

  // ── store final response ──────────────────────────────────────────────────
  await sb.from("pay_runs").update({
    status:       newStatus,
    fps_response: finalResponse,
    updated_at:   new Date().toISOString(),
  }).eq("id", pay_run_id);

  return json({
    status:         newStatus,
    correlation_id: correlationId,
    hmrc_qualifier: finalQualifier,
    sandbox:        settings.sandbox_mode,
  });
});
