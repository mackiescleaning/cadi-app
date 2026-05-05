/**
 * supabase/functions/gocardless-api/index.ts
 * Cadi — GoCardless API proxy
 *
 * All calls are authenticated: the caller's JWT is used to look up their
 * stored GoCardless access_token, then proxied to the GoCardless API.
 *
 * Actions (POST with JSON body):
 *   { action: "sync_customer", customerId }
 *       → creates/updates the GoCardless customer record, returns gc_customer_id
 *
 *   { action: "create_mandate_link", customerId }
 *       → creates a billing request + flow, returns a hosted payment page URL
 *         that the cleaning business sends to their end-customer
 *
 *   { action: "create_payment", customerId, amountPence, description, reference }
 *       → creates a one-off payment against the customer's active mandate
 *         returns gc_payment_id
 *
 *   { action: "list_mandates" }
 *       → returns all mandates for this organisation
 *
 *   { action: "payment_status", gcPaymentId }
 *       → returns current status of a payment
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SANDBOX          = Deno.env.get("GC_SANDBOX") !== "false";
const GC_SANDBOX_TOKEN = Deno.env.get("GC_SANDBOX_TOKEN") ?? ""; // bypass OAuth for sandbox testing
const GC_API           = SANDBOX
  ? "https://api-sandbox.gocardless.com"
  : "https://api.gocardless.com";

const GC_VERSION = "2015-07-06";

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

async function getUserAndToken(req: Request) {
  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  const { data: { user }, error } = await sb.auth.getUser(token);
  if (error || !user) throw new Error("Unauthorized");

  // Sandbox bypass: if GC_SANDBOX_TOKEN is set, use it directly instead of
  // requiring the user to have completed the OAuth connect flow.
  if (GC_SANDBOX_TOKEN) {
    return { user, sb, gcToken: GC_SANDBOX_TOKEN, sandboxBypass: true };
  }

  const { data: profile } = await sb
    .from("profiles")
    .select("gc_access_token, gc_organisation_id")
    .eq("id", user.id)
    .single();

  if (!profile?.gc_access_token) throw new Error("GoCardless not connected");

  return { user, sb, gcToken: profile.gc_access_token, sandboxBypass: false };
}

function gcHeaders(gcToken: string) {
  return {
    "Authorization":   `Bearer ${gcToken}`,
    "GoCardless-Version": GC_VERSION,
    "Content-Type":    "application/json",
  };
}

async function gcFetch(gcToken: string, path: string, method = "GET", body?: unknown) {
  const res = await fetch(`${GC_API}${path}`, {
    method,
    headers: gcHeaders(gcToken),
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

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const body   = await req.json() as Record<string, unknown>;
    const action = body.action as string;

    const { user, sb, gcToken } = await getUserAndToken(req);

    // ── sync_customer ─────────────────────────────────────────────────────────
    // Creates or updates the GoCardless customer record for a Cadi customer.
    if (action === "sync_customer") {
      const customerId = body.customerId as string;

      const { data: customer } = await sb
        .from("customers")
        .select("id, name, email, phone, gc_customer_id")
        .eq("id", customerId)
        .eq("owner_id", user.id)
        .single();

      if (!customer) return json({ error: "Customer not found" }, 404);

      const nameParts = (customer.name ?? "").trim().split(" ");
      const firstName = nameParts[0] ?? "";
      const lastName  = nameParts.slice(1).join(" ") || "-";

      let gcCustomerId = customer.gc_customer_id;

      if (gcCustomerId) {
        // Update existing GoCardless customer
        await gcFetch(gcToken, `/customers/${gcCustomerId}`, "PUT", {
          customers: { given_name: firstName, family_name: lastName, email: customer.email ?? "" },
        });
      } else {
        // Create new GoCardless customer
        const res = await gcFetch(gcToken, "/customers", "POST", {
          customers: {
            given_name:  firstName,
            family_name: lastName,
            email:       customer.email ?? "",
            phone_number: customer.phone ?? undefined,
            metadata: { cadi_customer_id: customerId },
          },
        });
        gcCustomerId = res.customers.id;

        await sb
          .from("customers")
          .update({ gc_customer_id: gcCustomerId })
          .eq("id", customerId);
      }

      return json({ success: true, gcCustomerId });
    }

    // ── create_mandate_link ───────────────────────────────────────────────────
    // Returns a hosted payment page URL. Send this link to the end-customer
    // so they can authorise the Direct Debit mandate.
    if (action === "create_mandate_link") {
      const customerId = body.customerId as string;

      const { data: customer } = await sb
        .from("customers")
        .select("id, name, email, gc_customer_id")
        .eq("id", customerId)
        .eq("owner_id", user.id)
        .single();

      if (!customer) return json({ error: "Customer not found" }, 404);

      // Ensure the customer exists in GoCardless first
      if (!customer.gc_customer_id) {
        return json({ error: "Sync customer to GoCardless first" }, 400);
      }

      // Create a billing request
      const brRes = await gcFetch(gcToken, "/billing_requests", "POST", {
        billing_requests: {
          mandate_request: {
            currency:    "GBP",
            description: "Direct Debit — cleaning services",
          },
          links: { customer: customer.gc_customer_id },
        },
      });

      const redirectUri = "https://app.cadi.cleaning/customers";
      const exitUri     = "https://app.cadi.cleaning/customers";

      // Create a billing request flow (hosted payment page)
      const flowRes = await gcFetch(gcToken, "/billing_request_flows", "POST", {
        billing_request_flows: {
          redirect_uri: redirectUri,
          exit_uri:     exitUri,
          links: { billing_request: brRes.billing_requests.id },
        },
      });

      return json({
        success:            true,
        mandateUrl:         flowRes.billing_request_flows.authorisation_url,
        billingRequestId:   brRes.billing_requests.id,
      });
    }

    // ── create_payment ────────────────────────────────────────────────────────
    // Collects a one-off payment against an active mandate.
    if (action === "create_payment") {
      const { customerId, amountPence, description, reference } = body as {
        customerId:  string;
        amountPence: number;
        description: string;
        reference?:  string;
      };

      const { data: customer } = await sb
        .from("customers")
        .select("gc_mandate_id, gc_mandate_status")
        .eq("id", customerId)
        .eq("owner_id", user.id)
        .single();

      if (!customer?.gc_mandate_id) return json({ error: "No active mandate for this customer" }, 400);
      const collectableStatuses = ["active", "submitted", "pending_submission"];
      if (!collectableStatuses.includes(customer.gc_mandate_status ?? "")) {
        return json({ error: `Mandate status is '${customer.gc_mandate_status}' — cannot collect yet` }, 400);
      }

      const payRes = await gcFetch(gcToken, "/payments", "POST", {
        payments: {
          amount:      Math.round(amountPence),
          currency:    "GBP",
          description: description ?? "Cleaning services",
          reference:   reference ?? undefined,
          links: { mandate: customer.gc_mandate_id },
        },
      });

      return json({
        success:      true,
        gcPaymentId:  payRes.payments.id,
        status:       payRes.payments.status,
      });
    }

    // ── sync_mandate ──────────────────────────────────────────────────────────
    // Fetches the latest mandate for a customer from GoCardless and saves it.
    if (action === "sync_mandate") {
      const customerId = body.customerId as string;

      const { data: customer } = await sb
        .from("customers")
        .select("id, gc_customer_id")
        .eq("id", customerId)
        .eq("owner_id", user.id)
        .single();

      if (!customer) return json({ error: "Customer not found" }, 404);
      if (!customer.gc_customer_id) return json({ error: "Sync customer to GoCardless first" }, 400);

      const res = await gcFetch(gcToken, `/mandates?customer=${customer.gc_customer_id}`);
      const mandates: Array<{ id: string; status: string }> = res.mandates ?? [];

      const mandate =
        mandates.find(m => m.status === "active") ??
        mandates.find(m => m.status === "submitted") ??
        mandates.find(m => m.status === "pending_submission") ??
        mandates[0];

      if (!mandate) return json({ error: "No mandate found — has the customer completed the setup link?" }, 404);

      await sb
        .from("customers")
        .update({ gc_mandate_id: mandate.id, gc_mandate_status: mandate.status })
        .eq("id", customerId);

      return json({ success: true, mandateId: mandate.id, mandateStatus: mandate.status });
    }

    // ── list_mandates ─────────────────────────────────────────────────────────
    if (action === "list_mandates") {
      const res = await gcFetch(gcToken, "/mandates");
      return json({ mandates: res.mandates });
    }

    // ── payment_status ────────────────────────────────────────────────────────
    if (action === "payment_status") {
      const gcPaymentId = body.gcPaymentId as string;
      const res = await gcFetch(gcToken, `/payments/${gcPaymentId}`);
      return json({ payment: res.payments });
    }

    return json({ error: `Unknown action: ${action}` }, 400);

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("gocardless-api error:", msg);
    const status = msg === "Unauthorized" ? 401
      : msg === "GoCardless not connected" ? 403
      : 500;
    return json({ error: msg }, status);
  }
});
