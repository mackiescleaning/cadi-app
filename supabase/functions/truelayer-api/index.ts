/**
 * supabase/functions/truelayer-api/index.ts
 * Cadi — TrueLayer data API + smart matching engine
 *
 * Actions:
 *   { action: "sync" }
 *       → fetches accounts + last 90 days of transactions
 *       → applies merchant rules, invoice matching, GoCardless matching
 *       → auto-marks matched invoices as paid
 *
 *   { action: "transactions", days? }
 *       → returns saved bank_transactions for this user
 *
 *   { action: "categorise", transactionId, category, isBusiness }
 *       → manually categorise + save merchant rule so it never asks again
 *
 *   { action: "accounts" }
 *       → returns connected account list
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SANDBOX       = Deno.env.get("TL_SANDBOX") !== "false";
const CLIENT_ID     = Deno.env.get("TL_CLIENT_ID") ?? "";
const CLIENT_SECRET = Deno.env.get("TL_CLIENT_SECRET") ?? "";
const REDIRECT_URI  = "https://app.cadi.cleaning/truelayer/callback";

const API_BASE  = SANDBOX ? "https://api.truelayer-sandbox.com" : "https://api.truelayer.com";
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

// ── Auto-categorisation rules ─────────────────────────────────────────────────
const CATEGORY_RULES: Array<{ pattern: RegExp; category: string; isBusiness: boolean }> = [
  { pattern: /\b(fuel|petrol|diesel|shell|bp\b|esso|texaco|gulf|jet\b|total\b|moto\b|roadchef|welcome\s*break)/i, category: "fuel",           isBusiness: true  },
  { pattern: /\b(screwfix|toolstation|b&q|wickes|travis\s*perkins|jewson)/i,                                       category: "equipment",      isBusiness: true  },
  { pattern: /\b(insurance|aviva|axa|zurich|hiscox|simply\s*business|admiral|direct\s*line)/i,                    category: "insurance",      isBusiness: true  },
  { pattern: /\b(vodafone|o2\b|ee\b|three\b|bt\b|sky\b|talktalk|virgin\s*media)/i,                               category: "phone_broadband",isBusiness: true  },
  { pattern: /\b(cleaning|bleach|flash\b|dettol|fairy|mr\s*muscle|jeyes|jangro|robert\s*scott)/i,                 category: "supplies",       isBusiness: true  },
  { pattern: /\b(van\s*lease|vehicle\s*finance|car\s*finance|lease\s*plan)/i,                                      category: "vehicle",        isBusiness: true  },
  { pattern: /\b(hmrc|self\s*assessment|vat\s*return|corporation\s*tax)/i,                                         category: "tax",            isBusiness: true  },
  { pattern: /\b(wages|salary|payroll|employee|subcontract)/i,                                                     category: "staff",          isBusiness: true  },
  { pattern: /\b(accountant|bookkeeper|xero|quickbooks|sage\b|freeagent)/i,                                        category: "professional",   isBusiness: true  },
  { pattern: /\b(tesco|sainsbury|asda|morrisons|aldi|lidl|waitrose|co-op|marks\s*&?\s*spencer|iceland\b)/i,        category: "groceries",      isBusiness: false },
  { pattern: /\b(mcdonald|kfc|subway|greggs|costa|starbucks|caffe\s*nero|restaurant|nando|pizza|deliveroo|uber\s*eat)/i, category: "food",    isBusiness: false },
  { pattern: /\b(netflix|spotify|disney\+?|prime\s*video|apple\.com\/bill|google\s*play)/i,                        category: "subscriptions",  isBusiness: false },
  { pattern: /\b(amazon(?!.*\bbusiness\b)|ebay|argos|currys|john\s*lewis|next\b|asos)/i,                          category: "shopping",       isBusiness: false },
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

// Normalise merchant name to a stable key for the rules table
function merchantKey(merchant: string, description: string): string {
  const raw = (merchant || description).toLowerCase()
    .replace(/\s+\d[\d\s*]+$/, "")   // strip trailing ref numbers
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .split(/\s+/)
    .slice(0, 3)
    .join(" ");
  return raw;
}

// Simple name similarity — normalise and check substring overlap
function nameSimilarity(a: string, b: string): number {
  const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const ca = clean(a), cb = clean(b);
  if (!ca || !cb) return 0;
  if (ca === cb) return 1;
  if (ca.includes(cb) || cb.includes(ca)) return 0.8;
  // Count matching chars in shorter vs longer
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

async function getAccessToken(
  sb: ReturnType<typeof createClient>,
  userId: string,
): Promise<string> {
  const { data: profile } = await sb
    .from("profiles")
    .select("tl_access_token, tl_refresh_token")
    .eq("id", userId)
    .single();

  if (!profile?.tl_access_token) throw new Error("Bank account not connected");

  const test = await fetch(`${API_BASE}/data/v1/me`, {
    headers: { Authorization: `Bearer ${profile.tl_access_token}` },
  });
  if (test.ok) return profile.tl_access_token;

  if (!profile.tl_refresh_token) throw new Error("Bank session expired — please reconnect");

  const refreshRes = await fetch(`${AUTH_BASE}/connect/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type:    "refresh_token",
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: profile.tl_refresh_token,
      redirect_uri:  REDIRECT_URI,
    }),
  });
  const refreshed = await refreshRes.json();
  if (!refreshRes.ok) throw new Error("Bank session expired — please reconnect");

  await sb.from("profiles").update({
    tl_access_token:  refreshed.access_token,
    tl_refresh_token: refreshed.refresh_token ?? profile.tl_refresh_token,
  }).eq("id", userId);

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

    // ── sync ──────────────────────────────────────────────────────────────────
    if (action === "sync") {
      const token = await getAccessToken(sb, user.id);

      // Load merchant rules and open invoices in parallel
      const [{ data: rulesRows }, { data: openInvoices }] = await Promise.all([
        sb.from("merchant_rules").select("merchant_key,category,is_business").eq("user_id", user.id),
        sb.from("quotes").select("id,price,job_label,payload").eq("owner_id", user.id).neq("status", "paid"),
      ]);

      const merchantRules = new Map<string, { category: string; isBusiness: boolean }>(
        (rulesRows ?? []).map((r: { merchant_key: string; category: string; is_business: boolean }) => [
          r.merchant_key,
          { category: r.category, isBusiness: r.is_business },
        ]),
      );

      const invoices = (openInvoices ?? []) as Array<{
        id: string;
        price: number;
        job_label: string;
        payload: Record<string, unknown>;
      }>;

      const accountsData = await tlFetch(token, "/data/v1/accounts");
      const accounts     = accountsData.results ?? [];

      let totalImported = 0;
      let autoMatched   = 0;

      for (const account of accounts) {
        const accountId = account.account_id;
        const from = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
        const to   = new Date().toISOString().split("T")[0];

        let txData;
        try { txData = await tlFetch(token, `/data/v1/accounts/${accountId}/transactions?from=${from}&to=${to}`); }
        catch { continue; }

        const txs = txData.results ?? [];

        for (const tx of txs) {
          const description = tx.description ?? "";
          const merchant    = tx.merchant_name ?? tx.meta?.provider_merchant_name ?? "";
          const amount      = Math.abs(tx.amount ?? 0);
          const txType      = (tx.amount ?? 0) >= 0 ? "credit" : "debit";
          const txDate      = tx.timestamp?.split("T")[0] ?? to;
          const mKey        = merchantKey(merchant, description);

          // 1. Merchant rule lookup (highest priority)
          let category   = "uncategorised";
          let isBusiness: boolean | null = null;
          let needsReview = true;

          if (mKey && merchantRules.has(mKey)) {
            const rule = merchantRules.get(mKey)!;
            category    = rule.category;
            isBusiness  = rule.isBusiness;
            needsReview = false;
          } else {
            // 2. Pattern-based auto-categorisation
            const auto = autoCategory(description, merchant);
            category    = auto.category;
            isBusiness  = auto.isBusiness;
            needsReview = isBusiness === null;
          }

          // 3. Invoice matching (credits only, business)
          let matchedInvoiceId: string | null   = null;
          let matchedGcPaymentId: string | null = null;
          let wasAutoMatched = false;

          if (txType === "credit") {
            // GoCardless credit detection
            const isGc = /gocardless/i.test(description);

            if (isGc) {
              // Match by amount against open invoices
              const gcMatch = invoices.find(inv => {
                const diff = Math.abs(Number(inv.price) - amount);
                return diff < 0.02;
              });
              if (gcMatch) {
                matchedInvoiceId  = gcMatch.id;
                matchedGcPaymentId = description;
                category    = "income";
                isBusiness  = true;
                needsReview = false;
                wasAutoMatched = true;
              } else {
                category    = "income";
                isBusiness  = true;
                needsReview = false;
              }
            } else {
              // Regular bank transfer / invoice payment — match by amount + customer name
              const customerName = (tx.meta?.debtor_name ?? merchant ?? description) as string;
              const invoiceMatch = invoices.find(inv => {
                const amountDiff = Math.abs(Number(inv.price) - amount);
                if (amountDiff > 0.5) return false; // must be within 50p
                // Try to match customer name from invoice label or payload
                const invCustomer = String(inv.job_label ?? (inv.payload as Record<string,unknown>)?.customer ?? "");
                return nameSimilarity(customerName, invCustomer) >= 0.6;
              });
              if (invoiceMatch) {
                matchedInvoiceId = invoiceMatch.id;
                category         = "income";
                isBusiness       = true;
                needsReview      = false;
                wasAutoMatched   = true;
              } else if (amount > 50 && !needsReview) {
                // Large unmatched credit — likely income but flag for review
                category    = "income";
                isBusiness  = true;
                needsReview = false;
              }
            }
          }

          const row = {
            user_id:              user.id,
            tl_transaction_id:    tx.transaction_id,
            account_id:           accountId,
            date:                 txDate,
            description,
            amount,
            currency:             tx.currency ?? "GBP",
            transaction_type:     txType,
            merchant_name:        merchant || null,
            category,
            is_business:          isBusiness === true  ? true  : null,
            is_personal:          isBusiness === false ? true  : null,
            needs_review:         needsReview,
            matched_invoice_id:   matchedInvoiceId,
            matched_gc_payment_id: matchedGcPaymentId,
            auto_matched:         wasAutoMatched,
          };

          const { error: upsertErr } = await sb
            .from("bank_transactions")
            .upsert(row, { onConflict: "user_id,tl_transaction_id", ignoreDuplicates: false });

          if (!upsertErr) {
            totalImported++;
            if (wasAutoMatched) autoMatched++;
          }

          // Auto-mark matched invoice as paid + create money entry
          if (wasAutoMatched && matchedInvoiceId) {
            await sb.from("quotes").update({ status: "paid" }).eq("id", matchedInvoiceId);
            // Only insert money entry if one doesn't already exist for this quote
            const { data: existing } = await sb
              .from("money_entries")
              .select("id")
              .eq("quote_id", matchedInvoiceId)
              .maybeSingle();
            if (!existing) {
              await sb.from("money_entries").insert({
                owner_id:  user.id,
                quote_id:  matchedInvoiceId,
                client:    tx.meta?.debtor_name ?? merchant ?? "Bank payment",
                amount,
                date:      txDate,
                method:    "bank",
                kind:      "income",
                notes:     `Auto-matched from bank: ${description}`,
              });
            }
          }
        }
      }

      return json({
        success: true,
        imported: totalImported,
        autoMatched,
        accounts: accounts.length,
      });
    }

    // ── transactions ──────────────────────────────────────────────────────────
    if (action === "transactions") {
      const days = Number(body.days ?? 90);
      const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

      const { data: rows } = await sb
        .from("bank_transactions")
        .select("*")
        .eq("user_id", user.id)
        .gte("date", from)
        .order("date", { ascending: false });

      return json({ transactions: rows ?? [] });
    }

    // ── categorise ────────────────────────────────────────────────────────────
    if (action === "categorise") {
      const { transactionId, category, isBusiness } = body as {
        transactionId: string;
        category:      string;
        isBusiness:    boolean;
      };

      // Get the transaction so we can extract the merchant key
      const { data: tx } = await sb
        .from("bank_transactions")
        .select("merchant_name, description")
        .eq("id", transactionId)
        .eq("user_id", user.id)
        .single();

      // Save merchant rule so future transactions from this merchant auto-categorise
      if (tx) {
        const mKey = merchantKey(tx.merchant_name ?? "", tx.description ?? "");
        if (mKey) {
          await sb.from("merchant_rules").upsert({
            user_id:      user.id,
            merchant_key: mKey,
            category,
            is_business:  isBusiness,
            updated_at:   new Date().toISOString(),
          }, { onConflict: "user_id,merchant_key" });

          // Retroactively apply this rule to all other unreviewed transactions from same merchant
          await sb.from("bank_transactions")
            .update({
              category,
              is_business:  isBusiness,
              is_personal:  !isBusiness,
              needs_review: false,
            })
            .eq("user_id", user.id)
            .eq("needs_review", true)
            .or(`merchant_name.eq.${tx.merchant_name},description.ilike.%${mKey}%`);
        }
      }

      // Update this transaction
      await sb.from("bank_transactions").update({
        category,
        is_business:  isBusiness,
        is_personal:  !isBusiness,
        needs_review: false,
      }).eq("id", transactionId).eq("user_id", user.id);

      return json({ success: true });
    }

    // ── accounts ──────────────────────────────────────────────────────────────
    if (action === "accounts") {
      const token = await getAccessToken(sb, user.id);
      const data  = await tlFetch(token, "/data/v1/accounts");
      return json({ accounts: data.results ?? [] });
    }

    return json({ error: `Unknown action: ${action}` }, 400);

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("truelayer-api error:", msg);
    return json({ error: msg }, msg === "Unauthorized" ? 401 : 500);
  }
});
