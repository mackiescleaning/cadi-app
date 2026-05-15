/**
 * supabase/functions/truelayer-api/index.ts
 * Cadi — TrueLayer data API + categorisation + reconciliation (Phase 2)
 *
 * Actions:
 *   { action: "sync" }              → fetch + categorise + reconcile transactions
 *   { action: "transactions", days? } → return saved transactions for this business
 *   { action: "categorise", ... }   → manually categorise + save merchant rule
 *   { action: "accounts" }          → return connected account list
 *   { action: "balance" }           → return current account balance
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SANDBOX       = Deno.env.get("TL_SANDBOX") !== "false";
const CLIENT_ID     = Deno.env.get("TL_CLIENT_ID") ?? "";
const CLIENT_SECRET = Deno.env.get("TL_CLIENT_SECRET") ?? "";
const REDIRECT_URI  = "https://app.cadi.cleaning/truelayer/callback";

const API_BASE  = SANDBOX ? "https://api.truelayer-sandbox.com"  : "https://api.truelayer.com";
const AUTH_BASE = SANDBOX ? "https://auth.truelayer-sandbox.com" : "https://auth.truelayer.com";

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

// ── Category rules ────────────────────────────────────────────────────────────

const CATEGORY_RULES: Array<{ pattern: RegExp; category: string; isBusiness: boolean }> = [
  { pattern: /\b(fuel|petrol|diesel|shell|bp\b|esso|texaco|gulf|jet\b|total\b|moto\b|roadchef|welcome\s*break)/i, category: "fuel",           isBusiness: true  },
  { pattern: /\b(screwfix|toolstation|b&q|wickes|travis\s*perkins|jewson)/i,                                       category: "equipment",      isBusiness: true  },
  { pattern: /\b(insurance|aviva|axa|zurich|hiscox|simply\s*business|admiral|direct\s*line)/i,                    category: "insurance",      isBusiness: true  },
  { pattern: /\b(vodafone|o2\b|ee\b|three\b|bt\b|sky\b|talktalk|virgin\s*media)/i,                               category: "phone_internet", isBusiness: true  },
  { pattern: /\b(cleaning|bleach|flash\b|dettol|fairy|mr\s*muscle|jeyes|jangro|robert\s*scott|costco|booker|b&m)/i, category: "supplies",    isBusiness: true  },
  { pattern: /\b(van\s*lease|vehicle\s*finance|car\s*finance|lease\s*plan)/i,                                      category: "vehicle",        isBusiness: true  },
  { pattern: /\b(hmrc|self\s*assessment|vat\s*return|corporation\s*tax)/i,                                         category: "tax_payment",    isBusiness: true  },
  { pattern: /\b(wages|salary|payroll|employee|subcontract)/i,                                                     category: "staff",          isBusiness: true  },
  { pattern: /\b(accountant|bookkeeper|sage\b|freeagent)/i,                                                        category: "professional_services", isBusiness: true },
  { pattern: /\b(tesco|sainsbury|asda|morrisons|aldi|lidl|waitrose|co-op|marks\s*&?\s*spencer|iceland\b)/i,        category: "food_drink",     isBusiness: false },
  { pattern: /\b(mcdonald|kfc|subway|greggs|costa|starbucks|caffe\s*nero|restaurant|nando|pizza|deliveroo|uber\s*eat)/i, category: "food_drink", isBusiness: false },
  { pattern: /\b(netflix|spotify|disney\+?|prime\s*video|apple\.com\/bill|google\s*play)/i,                        category: "subscriptions",  isBusiness: false },
  { pattern: /\b(amazon(?!.*\bbusiness\b)|ebay|argos|currys|john\s*lewis|next\b|asos)/i,                          category: "shopping",       isBusiness: false },
  { pattern: /\b(bank\s*charge|monthly\s*fee|account\s*fee|overdraft\s*fee)/i,                                    category: "bank_charges",   isBusiness: true  },
  { pattern: /\b(marketing|facebook\s*ads?|google\s*ads?|instagram|meta\b)/i,                                     category: "marketing",      isBusiness: true  },
];

function autoCategory(description: string, merchant: string) {
  const text = `${description} ${merchant}`;
  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(text)) {
      return { category: rule.category, isBusiness: rule.isBusiness };
    }
  }
  return { category: "uncategorised", isBusiness: null as boolean | null };
}

function merchantKey(merchant: string, description: string): string {
  return (merchant || description).toLowerCase()
    .replace(/\s+\d[\d\s*]+$/, "")
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .split(/\s+/)
    .slice(0, 3)
    .join(" ");
}

function nameSimilarity(a: string, b: string): number {
  const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const ca = clean(a), cb = clean(b);
  if (!ca || !cb) return 0;
  if (ca === cb) return 1;
  if (ca.includes(cb) || cb.includes(ca)) return 0.8;
  const shorter = ca.length < cb.length ? ca : cb;
  const longer  = ca.length < cb.length ? cb : ca;
  let matches = 0;
  for (const ch of shorter) if (longer.includes(ch)) matches++;
  return matches / longer.length;
}

// ── Auth helpers ──────────────────────────────────────────────────────────────

async function getUser(req: Request) {
  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  const { data: { user }, error } = await sb.auth.getUser(token);
  if (error || !user) throw new Error("Unauthorized");
  return { user, sb };
}

async function getBusinessId(
  sb: ReturnType<typeof createClient>,
  userId: string,
): Promise<string> {
  const { data, error } = await sb
    .from("businesses")
    .select("id")
    .eq("owner_user_id", userId)
    .single();
  if (error || !data) throw new Error("Business not found");
  return data.id;
}

async function getActiveConnection(
  sb: ReturnType<typeof createClient>,
  businessId: string,
) {
  const { data } = await sb
    .from("bank_connections")
    .select("id, access_token, refresh_token, truelayer_account_id")
    .eq("business_id", businessId)
    .eq("is_active", true)
    .order("connected_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data?.access_token) throw new Error("Bank account not connected");
  return data as { id: string; access_token: string; refresh_token: string; truelayer_account_id: string | null };
}

async function getValidToken(
  sb: ReturnType<typeof createClient>,
  connection: { id: string; access_token: string; refresh_token: string },
): Promise<string> {
  const test = await fetch(`${API_BASE}/data/v1/me`, {
    headers: { Authorization: `Bearer ${connection.access_token}` },
  });
  if (test.ok) return connection.access_token;
  if (!connection.refresh_token) throw new Error("Bank session expired — please reconnect");

  const refreshRes = await fetch(`${AUTH_BASE}/connect/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type:    "refresh_token",
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: connection.refresh_token,
      redirect_uri:  REDIRECT_URI,
    }),
  });
  const refreshed = await refreshRes.json();
  if (!refreshRes.ok) throw new Error("Bank session expired — please reconnect");

  await sb.from("bank_connections").update({
    access_token:  refreshed.access_token,
    refresh_token: refreshed.refresh_token ?? connection.refresh_token,
  }).eq("id", connection.id);

  return refreshed.access_token;
}

async function tlFetch(token: string, path: string) {
  const res  = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? `TrueLayer error ${res.status}`);
  return data;
}

// ── Main handler ──────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const body   = await req.json() as Record<string, unknown>;
    const action = body.action as string;
    const { user, sb } = await getUser(req);
    const businessId = await getBusinessId(sb, user.id);

    // ── sync ──────────────────────────────────────────────────────────────────
    if (action === "sync") {
      const connection = await getActiveConnection(sb, businessId);
      const token      = await getValidToken(sb, connection);

      const { data: profile } = await sb
        .from("profiles")
        .select("stripe_subscription_id")
        .eq("id", user.id)
        .single();
      const isPro    = !!profile?.stripe_subscription_id;
      const daysBack = isPro ? 365 : 60;

      const [{ data: rulesRows }, { data: openInvoices }] = await Promise.all([
        sb.from("merchant_rules").select("merchant_key,category,is_business").eq("user_id", user.id),
        sb.from("invoices").select("id, customer, lines, status, customer_id")
          .eq("owner_id", user.id).in("status", ["sent", "viewed", "overdue"]),
      ]);

      const merchantRules = new Map<string, { category: string; isBusiness: boolean }>(
        (rulesRows ?? []).map((r: { merchant_key: string; category: string; is_business: boolean }) => [
          r.merchant_key, { category: r.category, isBusiness: r.is_business },
        ]),
      );

      // Resolve account IDs to sync
      let accounts: Array<{ account_id: string }> = [];
      if (connection.truelayer_account_id) {
        accounts = [{ account_id: connection.truelayer_account_id }];
      } else {
        const acctData = await tlFetch(token, "/data/v1/accounts");
        accounts = acctData.results ?? [];
        if (accounts[0]) {
          await sb.from("bank_connections")
            .update({ truelayer_account_id: accounts[0].account_id })
            .eq("id", connection.id);
        }
      }

      let totalImported = 0;
      let autoMatched   = 0;
      let metaBankName: string | null = null;
      let metaLast4:    string | null = null;

      for (const account of accounts) {
        const accountId = account.account_id;
        const from = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000)
          .toISOString().split("T")[0];
        const to   = new Date().toISOString().split("T")[0];

        let txData;
        try {
          txData = await tlFetch(token, `/data/v1/accounts/${accountId}/transactions?from=${from}&to=${to}`);
        } catch { continue; }

        // Fetch display metadata
        try {
          const detail  = await tlFetch(token, `/data/v1/accounts/${accountId}`);
          const acct    = detail.results?.[0] ?? detail;
          metaBankName  = acct?.provider?.display_name ?? acct?.provider?.provider_id ?? null;
          metaLast4     = acct?.account_number?.number?.slice(-4) ?? null;
        } catch { /* non-fatal */ }

        for (const tx of (txData.results ?? [])) {
          const description = tx.description ?? "";
          const merchant    = tx.merchant_name ?? tx.meta?.provider_merchant_name ?? "";
          const amount      = tx.amount ?? 0; // TrueLayer: positive=credit, negative=debit
          const txDate      = tx.timestamp?.split("T")[0] ?? to;
          const mKey        = merchantKey(merchant, description);
          const isCredit    = amount > 0;

          let category      = "uncategorised";
          let isBusiness: boolean | null = null;
          let confidence    = 0.0;
          let categorisedBy = "cadi_ai";

          if (mKey && merchantRules.has(mKey)) {
            const rule = merchantRules.get(mKey)!;
            category   = rule.category; isBusiness = rule.isBusiness;
            confidence = 1.0; categorisedBy = "user";
          } else {
            const auto = autoCategory(description, merchant);
            category   = auto.category; isBusiness = auto.isBusiness;
            confidence = category !== "uncategorised" ? 0.85 : 0.0;
          }

          let matchedInvoiceId: string | null  = null;
          let matchedCustomerId: string | null = null;
          let reconConfidence                  = 0.0;

          if (isCredit && openInvoices) {
            const absAmount = Math.abs(amount);
            const payerName = (tx.meta?.debtor_name ?? merchant ?? description) as string;

            for (const inv of openInvoices as Array<{
              id: string;
              customer: { name?: string; first_name?: string; last_name?: string };
              lines: Array<{ rate: number; qty: number }>;
              customer_id?: string;
            }>) {
              const invTotal = (inv.lines ?? []).reduce(
                (s: number, l: { rate: number; qty: number }) => s + (l.rate ?? 0) * (l.qty ?? 1), 0,
              );
              if (Math.abs(invTotal - absAmount) > 0.5) continue;
              const invCustomer = [inv.customer?.name, inv.customer?.first_name, inv.customer?.last_name]
                .filter(Boolean).join(" ");
              const score = nameSimilarity(payerName, invCustomer);
              if (score >= 0.6) {
                matchedInvoiceId  = inv.id;
                matchedCustomerId = inv.customer_id ?? null;
                reconConfidence   = score;
                category = "income_customer"; isBusiness = true;
                break;
              }
            }
          } else if (isCredit && category === "uncategorised") {
            category = "income_other"; isBusiness = true;
          }

          const { error: upsertErr } = await sb.from("transactions").upsert({
            business_id:               businessId,
            bank_connection_id:        connection.id,
            truelayer_transaction_id:  tx.transaction_id,
            transaction_date:          txDate,
            amount,
            currency:                  tx.currency ?? "GBP",
            description,
            merchant_name:             merchant || null,
            category,
            categorisation_confidence: confidence,
            categorised_by:            categorisedBy,
            matched_invoice_id:        matchedInvoiceId,
            matched_customer_id:       matchedCustomerId,
            reconciliation_confidence: reconConfidence > 0 ? reconConfidence : null,
            is_business:               isBusiness,
          }, { onConflict: "truelayer_transaction_id", ignoreDuplicates: false });

          if (!upsertErr) {
            totalImported++;
            if (matchedInvoiceId) {
              autoMatched++;
              await sb.from("invoices")
                .update({ status: "paid", paid_at: new Date().toISOString() })
                .eq("id", matchedInvoiceId);
            }
          }
        }
      }

      // Update connection record
      const connUpdate: Record<string, unknown> = {
        last_sync_at: new Date().toISOString(),
        sync_error:   null,
      };
      if (metaBankName) connUpdate.bank_name      = metaBankName;
      if (metaLast4)    connUpdate.account_last_4 = metaLast4;
      await sb.from("bank_connections").update(connUpdate).eq("id", connection.id);

      // Mark onboarding step complete
      await sb.from("onboarding_steps")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("business_id", businessId).eq("phase", 2).eq("step_key", "connect_open_banking")
        .neq("status", "completed");

      // Trigger walkthrough analysis (fire and forget)
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      fetch(`${supabaseUrl}/functions/v1/walkthrough-analysis`, {
        method:  "POST",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": req.headers.get("Authorization") ?? "",
          "apikey":        Deno.env.get("SUPABASE_ANON_KEY") ?? "",
        },
        body: JSON.stringify({ action: "generate" }),
      }).catch(() => { /* non-fatal */ });

      return json({ success: true, imported: totalImported, autoMatched, accounts: accounts.length, daysBack });
    }

    // ── transactions ──────────────────────────────────────────────────────────
    if (action === "transactions") {
      const days = Number(body.days ?? 60);
      const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

      const { data: rows } = await sb.from("transactions")
        .select("*")
        .eq("business_id", businessId)
        .gte("transaction_date", from)
        .eq("is_hidden", false)
        .order("transaction_date", { ascending: false });

      return json({ transactions: rows ?? [] });
    }

    // ── categorise ────────────────────────────────────────────────────────────
    if (action === "categorise") {
      const { transactionId, category, isBusiness } = body as {
        transactionId: string; category: string; isBusiness: boolean;
      };

      const { data: tx } = await sb.from("transactions")
        .select("merchant_name, description")
        .eq("id", transactionId).eq("business_id", businessId).single();

      if (tx) {
        const mKey = merchantKey(tx.merchant_name ?? "", tx.description ?? "");
        if (mKey) {
          await sb.from("merchant_rules").upsert({
            user_id: user.id, merchant_key: mKey, category, is_business: isBusiness,
            updated_at: new Date().toISOString(),
          }, { onConflict: "user_id,merchant_key" });

          await sb.from("transactions")
            .update({ category, is_business: isBusiness, categorised_by: "user", categorisation_confidence: 1.0 })
            .eq("business_id", businessId)
            .or(`merchant_name.eq.${tx.merchant_name},description.ilike.%${mKey}%`)
            .eq("categorised_by", "cadi_ai");
        }
      }

      await sb.from("transactions")
        .update({ category, is_business: isBusiness, categorised_by: "user", categorisation_confidence: 1.0 })
        .eq("id", transactionId).eq("business_id", businessId);

      return json({ success: true });
    }

    // ── accounts ──────────────────────────────────────────────────────────────
    if (action === "accounts") {
      const connection = await getActiveConnection(sb, businessId);
      const token      = await getValidToken(sb, connection);
      const data       = await tlFetch(token, "/data/v1/accounts");
      return json({ accounts: data.results ?? [] });
    }

    // ── balance ───────────────────────────────────────────────────────────────
    if (action === "balance") {
      const connection = await getActiveConnection(sb, businessId);
      const token      = await getValidToken(sb, connection);
      const accountId  = connection.truelayer_account_id;
      if (!accountId) return json({ balance: null });
      const data = await tlFetch(token, `/data/v1/accounts/${accountId}/balance`);
      const b    = data.results?.[0];
      return json({ balance: b?.available ?? b?.current ?? null, currency: b?.currency ?? "GBP" });
    }

    return json({ error: `Unknown action: ${action}` }, 400);

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("truelayer-api error:", msg);
    return json({ error: msg }, msg === "Unauthorized" ? 401 : 500);
  }
});
