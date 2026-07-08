/**
 * supabase/functions/staff-payment/index.ts
 * Staff-facing payment recording. Authenticated by the short-lived staff JWT
 * (Authorization: Bearer <token>) issued by staff-auth on PIN success.
 *
 * POST { job_id, method: 'cash'|'bacs'|'direct_debit', amount?, reference? }
 *
 *   cash | bacs   Record a receipt taken (or seen) on site. Settles the job's
 *                 invoice if one exists and writes ONE mirror income row into
 *                 money_entries, linked to the invoice via invoice_id so read
 *                 paths that already count invoices don't double-count (this is
 *                 the same contract InvoiceGenerator.handleUpdate uses — see
 *                 migration 082). Any active staff assigned to the job may do
 *                 this. Money is confirmed in hand, so it settles immediately.
 *
 *   direct_debit  Collect against the customer's GoCardless mandate.
 *                 SUPERVISORS/MANAGERS ONLY. The charge settles asynchronously,
 *                 so we insert a *pending* money_entry carrying the GC payment
 *                 id; gocardless-webhook flips it to paid (and marks the
 *                 invoice paid) on payments.confirmed / paid_out. We do NOT
 *                 mark the invoice paid here — a DD can still fail.
 *
 * Client gates are advisory. Every check here (active membership, assignment,
 * role for DD) is enforced server-side because a staff token could call this
 * directly.
 *
 * Deploy PUBLIC — the gateway can't validate our custom HS256 staff token:
 *   supabase functions deploy staff-payment --no-verify-jwt
 * (also pinned in config.toml).
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireStaffAuth } from "../_shared/staffJwt.ts";
import { writeAudit } from "../_shared/auditLog.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, apikey, authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

const METHODS = new Set(["cash", "bacs", "direct_debit"]);
const PRIVILEGED_ROLES = new Set(["supervisor", "manager"]);

// GoCardless — mirrors gocardless-api. Sandbox unless GC_SANDBOX=false.
const SANDBOX = Deno.env.get("GC_SANDBOX") !== "false";
const GC_API = SANDBOX ? "https://api-sandbox.gocardless.com" : "https://api.gocardless.com";
const GC_VERSION = "2015-07-06";

async function gcFetch(gcToken: string, path: string, method = "GET", body?: unknown) {
  const res = await fetch(`${GC_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${gcToken}`,
      "GoCardless-Version": GC_VERSION,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) {
    const detail = (data?.error?.errors ?? [])
      .map((e: { field?: string; message?: string }) => `${e.field ?? ""}: ${e.message ?? ""}`.trim())
      .filter(Boolean)
      .join("; ");
    throw new Error(detail || data?.error?.message || `GoCardless error ${res.status}`);
  }
  return data;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let claims;
  try {
    claims = await requireStaffAuth(req);
  } catch {
    return json({ error: "Unauthorized" }, 401);
  }

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Re-check the member is still active (revocation-by-deactivation) and read
  // the CURRENT role from the DB rather than trusting the token's role claim.
  const { data: member } = await sb
    .from("team_members")
    .select("id, first_name, last_name, role, is_active")
    .eq("id", claims.sub)
    .eq("business_id", claims.biz)
    .eq("is_active", true)
    .single();
  if (!member) return json({ error: "Unauthorized" }, 401);
  const staffName = [member.first_name, member.last_name].filter(Boolean).join(" ").trim();

  let body: { job_id?: string; method?: string; amount?: number; reference?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const { job_id, method, amount: amountRaw, reference } = body;
  if (!job_id || !method) return json({ error: "job_id and method required" }, 400);
  if (!METHODS.has(method)) return json({ error: "Invalid method" }, 400);

  // Load the job, scoped to the staff member's business.
  const { data: job } = await sb
    .from("jobs")
    .select("id, owner_id, customer_id, customer, price, assignee_ids, assignees, assignee")
    .eq("id", job_id)
    .eq("owner_id", claims.biz)
    .single();
  if (!job) return json({ error: "Job not found" }, 404);

  // Only staff assigned to the job may take payment on it.
  const ids = Array.isArray(job.assignee_ids) ? (job.assignee_ids as string[]) : [];
  const names = Array.isArray(job.assignees) ? (job.assignees as string[]) : [];
  const assigned = ids.includes(member.id) || names.includes(staffName) || job.assignee === staffName;
  if (!assigned) return json({ error: "Not assigned to this job" }, 403);

  const amount = Number(amountRaw) > 0 ? Number(amountRaw) : Number(job.price) || 0;
  if (amount <= 0) return json({ error: "Amount must be greater than zero" }, 400);

  const today = new Date().toISOString().slice(0, 10);

  // The invoice that contains this job's line, if any (same containment filter
  // the owner's JobDrawer uses). lines is a jsonb array of { job_id, ... }.
  const { data: invRows } = await sb
    .from("invoices")
    .select("id, status, paid_at, lines")
    .eq("owner_id", claims.biz)
    .filter("lines", "cs", JSON.stringify([{ job_id: job.id }]))
    .order("created_at", { ascending: false })
    .limit(1);
  const invoice = invRows?.[0] ?? null;

  // ── Direct Debit — supervisors/managers only ────────────────────────────────
  if (method === "direct_debit") {
    if (!PRIVILEGED_ROLES.has(member.role)) {
      return json({ error: "Only a supervisor or manager can collect Direct Debit" }, 403);
    }
    if (!job.customer_id) return json({ error: "No customer linked to this job" }, 400);

    const { data: prof } = await sb
      .from("profiles")
      .select("gc_access_token")
      .eq("id", claims.biz)
      .single();
    const gcToken =
      SANDBOX && Deno.env.get("GC_SANDBOX_TOKEN")
        ? Deno.env.get("GC_SANDBOX_TOKEN")!
        : prof?.gc_access_token;
    if (!gcToken) return json({ error: "GoCardless not connected" }, 400);

    const { data: cust } = await sb
      .from("customers")
      .select("name, gc_mandate_id, gc_mandate_status")
      .eq("id", job.customer_id)
      .eq("owner_id", claims.biz)
      .single();
    if (!cust?.gc_mandate_id) return json({ error: "No active mandate for this customer" }, 400);
    if (!["active", "submitted", "pending_submission"].includes(cust.gc_mandate_status ?? "")) {
      return json({ error: `Mandate status is '${cust.gc_mandate_status}' — cannot collect yet` }, 400);
    }

    let payRes;
    try {
      payRes = await gcFetch(gcToken, "/payments", "POST", {
        payments: {
          amount: Math.round(amount * 100),
          currency: "GBP",
          description: `Cleaning — ${cust.name ?? job.customer ?? ""}`.trim(),
          reference: reference || undefined,
          links: { mandate: cust.gc_mandate_id },
        },
      });
    } catch (e) {
      return json({ error: (e as Error).message || "GoCardless collection failed" }, 502);
    }

    const gcPaymentId = payRes?.payments?.id;
    const gcStatus = payRes?.payments?.status;

    // Pending mirror — the webhook flips gc_payment_status + settles the
    // invoice once GoCardless confirms the collection.
    await sb.from("money_entries").insert({
      owner_id: claims.biz,
      customer_id: job.customer_id,
      invoice_id: invoice?.id ?? null,
      client: cust.name ?? job.customer ?? null,
      amount,
      date: today,
      method: "direct_debit",
      kind: "income",
      gc_payment_id: gcPaymentId,
      gc_payment_status: gcStatus,
      notes: reference ? `Ref ${reference}` : null,
    });

    await writeAudit(sb, req, {
      ownerId: claims.biz,
      actorId: member.id,
      action: "staff.payment.dd_collected",
      category: "banking",
      detail: { job_id, amount, gc_payment_id: gcPaymentId },
    });

    return json({ ok: true, method: "direct_debit", pending: true, gc_payment_id: gcPaymentId, gc_status: gcStatus });
  }

  // ── Cash / BACS — settle now ────────────────────────────────────────────────
  // Idempotency: if the invoice is already paid, don't write a second mirror.
  if (invoice && (invoice.status === "paid" || invoice.paid_at)) {
    return json({ ok: true, alreadyPaid: true, invoice_id: invoice.id });
  }

  let invoiceSettled = false;
  if (invoice) {
    const { error: upErr } = await sb
      .from("invoices")
      .update({ status: "paid", paid_at: new Date().toISOString(), payment_method: method })
      .eq("id", invoice.id)
      .eq("owner_id", claims.biz);
    if (!upErr) invoiceSettled = true;
  }

  const { data: entry, error: meErr } = await sb
    .from("money_entries")
    .insert({
      owner_id: claims.biz,
      customer_id: job.customer_id ?? null,
      invoice_id: invoice?.id ?? null,
      client: job.customer ?? null,
      amount,
      date: today,
      method,
      kind: "income",
      notes: reference ? `Ref ${reference}` : null,
    })
    .select("id")
    .single();

  if (meErr) {
    console.error("staff-payment money_entry error:", meErr);
    return json({ error: "Failed to record payment" }, 500);
  }

  await writeAudit(sb, req, {
    ownerId: claims.biz,
    actorId: member.id,
    action: "staff.payment.recorded",
    category: "billing",
    detail: { job_id, amount, method, invoice_id: invoice?.id ?? null },
  });

  return json({ ok: true, method, amount, invoice_settled: invoiceSettled, money_entry_id: entry.id });
});
