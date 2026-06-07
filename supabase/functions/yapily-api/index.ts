/**
 * supabase/functions/yapily-api/index.ts
 * Cadi — Yapily data API + categorisation + reconciliation (production-ready)
 *
 * Actions:
 *   { action: "sync", force? }   → fetch + categorise + reconcile. Throttled to 1 / 15 min unless force.
 *   { action: "transactions", days? }
 *   { action: "categorise", transactionId, category, isBusiness }
 *   { action: "accounts" }
 *   { action: "balance" }
 *
 * Notes:
 *   - All bank_accounts under the active connection are synced (multi-account support).
 *   - Consent expiry / revocation is detected and written to bank_connections.sync_error_code
 *     + needs_reauth so the UI can prompt for re-consent. last_sync_at is only bumped on success.
 *   - Auto-mark-paid is conservative: requires exact amount + strong name match + unique candidate.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const APP_ID         = Deno.env.get("YAPILY_APP_ID")      ?? "";
const APP_SECRET     = Deno.env.get("YAPILY_SECRET")      ?? "";
const ENC_KEY_HEX    = Deno.env.get("BANK_TOKEN_ENC_KEY") ?? "";
const API_BASE       = "https://api.yapily.com";

// Capture config problems at module load but DON'T throw — surface them on
// first request so OPTIONS preflight succeeds and the client gets a clear error.
const ENV_PROBLEMS: string[] = (() => {
  const problems: string[] = [];
  if (!APP_ID)                                       problems.push("YAPILY_APP_ID is unset");
  if (!APP_SECRET)                                   problems.push("YAPILY_SECRET is unset");
  if (!ENC_KEY_HEX)                                  problems.push("BANK_TOKEN_ENC_KEY is unset");
  else if (ENC_KEY_HEX.length !== 64)                problems.push(`BANK_TOKEN_ENC_KEY must be 64 hex chars (got ${ENC_KEY_HEX.length})`);
  else if (!/^[0-9a-fA-F]{64}$/.test(ENC_KEY_HEX))   problems.push("BANK_TOKEN_ENC_KEY must be hex");
  return problems;
})();

const BASIC_AUTH = "Basic " + btoa(`${APP_ID}:${APP_SECRET}`);

// Sync throttle — refuse to call Yapily more than once per 15 minutes
const SYNC_MIN_INTERVAL_MS = 15 * 60 * 1000;

// ── Token decryption ──────────────────────────────────────────────────────────
let _cachedKey: CryptoKey | null = null;
async function getEncKey(): Promise<CryptoKey> {
  if (_cachedKey) return _cachedKey;
  const raw = new Uint8Array(ENC_KEY_HEX.match(/.{2}/g)!.map(b => parseInt(b, 16)));
  _cachedKey = await crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
  return _cachedKey;
}
function unhex(s: string): Uint8Array {
  return new Uint8Array(s.match(/.{2}/g)!.map(b => parseInt(b, 16)));
}
function unb64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
async function decryptToken(stored: string | null | undefined): Promise<string> {
  if (!stored) return "";
  if (!stored.startsWith("enc:v1:")) {
    if (Deno.env.get("ALLOW_LEGACY_PLAINTEXT_TOKENS") !== "true") {
      throw new Error("Refusing to use unencrypted legacy token");
    }
    return stored;
  }
  const key = await getEncKey();
  const [, , ivHex, ctB64] = stored.split(":");
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unhex(ivHex) }, key, unb64(ctB64));
  return new TextDecoder().decode(pt);
}

// ── CORS ──────────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ??
  "https://app.cadi.cleaning,https://cadi.cleaning,http://localhost:5173,http://localhost:3000")
  .split(",").map(s => s.trim()).filter(Boolean);

function corsHeaders(origin: string | null): HeadersInit {
  const allow = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin":  allow,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age":       "60",
    "Vary":                         "Origin",
  };
}
function json(data: unknown, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
  });
}

// ── Category rules (unchanged from prior) ────────────────────────────────────
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
    if (rule.pattern.test(text)) return { category: rule.category, isBusiness: rule.isBusiness };
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

// Token-based Jaro-Winkler-ish — better than char-overlap for "John Smith" vs "Jon Smithson"
function tokenSimilarity(a: string, b: string): number {
  const tok = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
  const A = tok(a), B = tok(b);
  if (!A.length || !B.length) return 0;
  const shorter = A.length < B.length ? A : B;
  const longer  = A.length < B.length ? B : A;
  let matched = 0;
  for (const t of shorter) {
    if (longer.some(u => u === t || (t.length >= 4 && (u.startsWith(t) || t.startsWith(u))))) matched++;
  }
  return matched / longer.length;
}

// ── BST-safe date conversion: UTC bookingDateTime → local Europe/London date ─
function toLondonDate(iso: string | undefined): string | null {
  if (!iso) return null;
  try {
    // en-CA gives YYYY-MM-DD
    return new Date(iso).toLocaleDateString("en-CA", { timeZone: "Europe/London" });
  } catch {
    return iso.split("T")[0] ?? null;
  }
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
  sb: ReturnType<typeof createClient>, userId: string,
): Promise<string> {
  const { data, error } = await sb
    .from("businesses").select("id")
    .eq("owner_user_id", userId).single();
  if (error || !data) throw new Error("Business not found");
  return data.id;
}

async function getActiveConnection(
  sb: ReturnType<typeof createClient>, businessId: string,
) {
  const { data } = await sb
    .from("bank_connections")
    .select("id, access_token, truelayer_account_id, last_sync_at, needs_reauth, yapily_consent_id, consent_expires_at")
    .eq("business_id", businessId)
    .eq("is_active", true)
    .order("connected_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data?.access_token) throw new Error("Bank account not connected");
  return data as {
    id: string; access_token: string; truelayer_account_id: string | null;
    last_sync_at: string | null; needs_reauth: boolean;
    yapily_consent_id: string | null; consent_expires_at: string | null;
  };
}

async function yapilyFetch(path: string, consentToken?: string) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      Authorization: BASIC_AUTH,
      ...(consentToken ? { consent: consentToken } : {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const raw = data?.error?.message ?? data?.message ?? data?.error ?? data;
    const msg = typeof raw === "string" ? raw : JSON.stringify(raw);
    const code = data?.error?.code ?? data?.errorCode ?? `HTTP_${res.status}`;
    const err: Error & { code?: string; status?: number } = new Error(`Yapily ${res.status}: ${msg}`);
    err.code = code; err.status = res.status;
    throw err;
  }
  return data;
}

function isConsentExpiredError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const code = (err as { code?: string }).code ?? "";
  const status = (err as { status?: number }).status ?? 0;
  const msg = err.message.toLowerCase();
  return status === 401 || status === 403
    || code === "CONSENT_INVALID" || code === "CONSENT_EXPIRED"
    || /consent.*(expired|invalid|revoked)/.test(msg);
}

// ── Main handler ──────────────────────────────────────────────────────────────
serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(origin) });

  if (ENV_PROBLEMS.length) {
    return json({
      error:    `yapily-api config invalid: ${ENV_PROBLEMS.join("; ")}`,
      code:     "CONFIG_INVALID",
      problems: ENV_PROBLEMS,
    }, 500, origin);
  }

  try {
    const body       = await req.json() as Record<string, unknown>;
    const action     = body.action as string;
    const { user, sb } = await getUser(req);
    const businessId = await getBusinessId(sb, user.id);

    // ── sync ──────────────────────────────────────────────────────────────────
    if (action === "sync") {
      const force      = !!body.force;
      const connection = await getActiveConnection(sb, businessId);

      // Throttle — refuse to fan out to Yapily more than once per 15 min unless force
      if (!force && connection.last_sync_at) {
        const sinceLast = Date.now() - new Date(connection.last_sync_at).getTime();
        if (sinceLast < SYNC_MIN_INTERVAL_MS) {
          return json({ success: true, skipped: true, reason: "throttled", nextAllowedInMs: SYNC_MIN_INTERVAL_MS - sinceLast }, 200, origin);
        }
      }

      // If a prior sync flagged re-consent, don't try again until user reconnects
      if (connection.needs_reauth) {
        return json({ success: false, skipped: true, reason: "needs_reauth" }, 200, origin);
      }

      const consentToken = await decryptToken(connection.access_token);

      const { data: profile } = await sb
        .from("profiles")
        .select("stripe_subscription_id")
        .eq("id", user.id)
        .single();
      const isPro    = !!profile?.stripe_subscription_id;
      const daysBack = isPro ? 365 : 60;

      const [{ data: rulesRows }, { data: openInvoices }] = await Promise.all([
        sb.from("merchant_rules").select("merchant_key,category,is_business").eq("user_id", user.id),
        sb.from("invoices").select("id, customer, lines, status, customer_id, amount")
          .eq("owner_id", user.id).in("status", ["sent", "viewed", "overdue"]),
      ]);

      const merchantRules = new Map<string, { category: string; isBusiness: boolean }>(
        (rulesRows ?? []).map((r: { merchant_key: string; category: string; is_business: boolean }) => [
          r.merchant_key, { category: r.category, isBusiness: r.is_business },
        ]),
      );

      // ── Resolve accounts ────────────────────────────────────────────────────
      // Prefer locally cached bank_accounts rows; refresh from Yapily on every sync
      // so newly-opened accounts under the same consent are picked up.
      let accountIds: string[] = [];
      try {
        const acctData = await yapilyFetch("/accounts", consentToken);
        const freshAccounts = (acctData.data ?? []) as Array<{ id: string; accountNames?: Array<{ name: string }>; type?: string; currency?: string; accountIdentifications?: Array<{ type: string; identification: string }> }>;

        // Upsert bank_accounts rows
        if (freshAccounts.length > 0) {
          const rows = freshAccounts.map(a => ({
            business_id:        businessId,
            bank_connection_id: connection.id,
            yapily_account_id:  a.id,
            account_name:       a.accountNames?.[0]?.name ?? null,
            account_type:       a.type ?? null,
            account_last_4:     a.accountIdentifications?.find(i => i.type === "ACCOUNT_NUMBER")?.identification?.slice(-4) ?? null,
            currency:           a.currency ?? "GBP",
          }));
          await sb.from("bank_accounts").upsert(rows, { onConflict: "bank_connection_id,yapily_account_id" });
        }

        // Only sync accounts the user hasn't excluded
        const { data: localAccts } = await sb
          .from("bank_accounts")
          .select("yapily_account_id, is_included")
          .eq("bank_connection_id", connection.id);
        accountIds = (localAccts ?? []).filter(a => a.is_included).map(a => a.yapily_account_id);
      } catch (err) {
        if (isConsentExpiredError(err)) {
          await sb.from("bank_connections").update({
            sync_error:        (err as Error).message,
            sync_error_code:   "CONSENT_EXPIRED",
            needs_reauth:      true,
            last_sync_error_at: new Date().toISOString(),
          }).eq("id", connection.id);
          return json({ success: false, error: "Bank consent has expired — please reconnect.", needsReauth: true }, 200, origin);
        }
        throw err;
      }

      let totalImported = 0;
      let autoMatched   = 0;
      let anySuccess    = false;
      let firstError: string | null = null;
      let firstErrorCode: string | null = null;

      const from = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      const to   = new Date().toISOString().split("T")[0];

      for (const accountId of accountIds) {
        let txData;
        try {
          txData = await yapilyFetch(`/accounts/${accountId}/transactions?from=${from}&to=${to}`, consentToken);
          anySuccess = true;
        } catch (err) {
          if (!firstError) {
            firstError = (err as Error).message;
            firstErrorCode = (err as Error & { code?: string }).code ?? null;
          }
          if (isConsentExpiredError(err)) {
            // Stop iterating — every account will fail with the same expired consent
            await sb.from("bank_connections").update({
              sync_error:         firstError,
              sync_error_code:    "CONSENT_EXPIRED",
              needs_reauth:       true,
              last_sync_error_at: new Date().toISOString(),
            }).eq("id", connection.id);
            return json({ success: false, error: "Bank consent has expired — please reconnect.", needsReauth: true, imported: totalImported }, 200, origin);
          }
          continue;
        }

        // Locate this account's bank_accounts.id for the FK
        const { data: bankAcctRow } = await sb
          .from("bank_accounts")
          .select("id")
          .eq("bank_connection_id", connection.id)
          .eq("yapily_account_id", accountId)
          .maybeSingle();
        const bankAccountId = bankAcctRow?.id ?? null;

        for (const tx of (txData.data ?? [])) {
          const description = tx.description ?? tx.transactionInformation ?? "";
          const merchant    = tx.merchantName ?? "";
          const amount      = tx.amount ?? 0;
          const txDate      = tx.date ?? toLondonDate(tx.bookingDateTime) ?? to;
          const txId        = tx.id as string;
          const mKey        = merchantKey(merchant, description);
          const isCredit    = amount > 0;

          let category      = "uncategorised";
          let isBusiness: boolean | null = null;
          let confidence    = 0.0;
          let categorisedBy = "cadi_ai";

          if (mKey && merchantRules.has(mKey)) {
            const rule = merchantRules.get(mKey)!;
            category = rule.category; isBusiness = rule.isBusiness;
            confidence = 1.0; categorisedBy = "user";
          } else {
            const auto = autoCategory(description, merchant);
            category = auto.category; isBusiness = auto.isBusiness;
            confidence = category !== "uncategorised" ? 0.85 : 0.0;
          }

          // ── Proposed-match-only reconciliation ─────────────────────────────
          // We NEVER auto-flip invoice.status here. We write the proposed match
          // to transactions.matched_invoice_id + reconciliation_confidence so
          // the UI can offer "Confirm payment" — except when we're VERY sure:
          // exact amount, single candidate at that amount, similarity > 0.95.
          let matchedInvoiceId: string | null  = null;
          let matchedCustomerId: string | null = null;
          let reconConfidence                  = 0.0;
          let autoFlipSafe                     = false;

          if (isCredit && openInvoices) {
            const absAmount = Math.abs(amount);
            const payerName = merchant || description;

            const candidates: Array<{ inv: { id: string; customer: { name?: string; first_name?: string; last_name?: string }; customer_id?: string; lines?: Array<{ rate: number; qty: number }> }; total: number; score: number }> = [];
            for (const inv of openInvoices as Array<{
              id: string;
              customer: { name?: string; first_name?: string; last_name?: string };
              lines: Array<{ rate: number; qty: number }>;
              customer_id?: string;
              amount?: number;
            }>) {
              const invTotal = (inv.lines ?? []).reduce(
                (s: number, l: { rate: number; qty: number }) => s + (l.rate ?? 0) * (l.qty ?? 1), 0,
              );
              if (Math.abs(invTotal - absAmount) > 0.01) continue; // exact only
              const invCustomer = [inv.customer?.name, inv.customer?.first_name, inv.customer?.last_name]
                .filter(Boolean).join(" ");
              const score = tokenSimilarity(payerName, invCustomer);
              candidates.push({ inv, total: invTotal, score });
            }

            if (candidates.length > 0) {
              const best = candidates.sort((a, b) => b.score - a.score)[0];
              if (best.score >= 0.6) {
                matchedInvoiceId  = best.inv.id;
                matchedCustomerId = best.inv.customer_id ?? null;
                reconConfidence   = best.score;
                category = "income_customer"; isBusiness = true;
                // High-confidence auto-flip: exact amount, single candidate at that amount, very strong name match
                if (candidates.length === 1 && best.score >= 0.95) autoFlipSafe = true;
              }
            }
          } else if (isCredit && category === "uncategorised") {
            category = "income_other"; isBusiness = true;
          }

          const { error: upsertErr } = await sb.from("transactions").upsert({
            business_id:               businessId,
            bank_connection_id:        connection.id,
            bank_account_id:           bankAccountId,
            truelayer_transaction_id:  txId,
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
          }, { onConflict: "business_id,truelayer_transaction_id", ignoreDuplicates: false });

          if (!upsertErr) {
            totalImported++;
            if (matchedInvoiceId && autoFlipSafe) {
              autoMatched++;
              await sb.from("invoices")
                .update({ status: "paid", paid_at: new Date().toISOString() })
                .eq("id", matchedInvoiceId)
                .eq("owner_id", user.id);
            }
          }
        }

        // Per-account last-synced
        if (bankAccountId) {
          await sb.from("bank_accounts").update({ last_sync_at: new Date().toISOString() }).eq("id", bankAccountId);
        }
      }

      // Only mark the connection as synced if at least one account succeeded.
      // Otherwise persist the structured error so the UI can surface it.
      if (anySuccess) {
        await sb.from("bank_connections").update({
          last_sync_at:     new Date().toISOString(),
          sync_error:       null,
          sync_error_code:  null,
        }).eq("id", connection.id);
      } else if (firstError) {
        await sb.from("bank_connections").update({
          sync_error:         firstError,
          sync_error_code:    firstErrorCode,
          last_sync_error_at: new Date().toISOString(),
        }).eq("id", connection.id);
      }

      // Mark onboarding step complete (best-effort)
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

      return json({ success: anySuccess, imported: totalImported, autoMatched, accounts: accountIds.length, daysBack, error: anySuccess ? null : firstError }, 200, origin);
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

      return json({ transactions: rows ?? [] }, 200, origin);
    }

    // ── categorise ────────────────────────────────────────────────────────────
    // Bulk apply uses two scoped updates (eq + ilike) — no raw string interpolation into PostgREST .or().
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

          // Two parameterised passes — safe regardless of merchant string contents
          if (tx.merchant_name) {
            await sb.from("transactions")
              .update({ category, is_business: isBusiness, categorised_by: "user", categorisation_confidence: 1.0 })
              .eq("business_id", businessId)
              .eq("merchant_name", tx.merchant_name)
              .eq("categorised_by", "cadi_ai");
          }
          await sb.from("transactions")
            .update({ category, is_business: isBusiness, categorised_by: "user", categorisation_confidence: 1.0 })
            .eq("business_id", businessId)
            .ilike("description", `%${mKey}%`)
            .eq("categorised_by", "cadi_ai");
        }
      }

      await sb.from("transactions")
        .update({ category, is_business: isBusiness, categorised_by: "user", categorisation_confidence: 1.0 })
        .eq("id", transactionId).eq("business_id", businessId);

      return json({ success: true }, 200, origin);
    }

    // ── accounts ──────────────────────────────────────────────────────────────
    if (action === "accounts") {
      // Prefer cached local rows — avoid an extra Yapily call per page-load
      const { data: localAccts } = await sb
        .from("bank_accounts")
        .select("id, yapily_account_id, account_name, account_type, account_last_4, currency, is_included, last_sync_at")
        .eq("business_id", businessId);
      return json({ accounts: localAccts ?? [] }, 200, origin);
    }

    // ── balance ───────────────────────────────────────────────────────────────
    if (action === "balance") {
      const connection   = await getActiveConnection(sb, businessId);
      const consentToken = await decryptToken(connection.access_token);
      const accountId    = (body.accountId as string) || connection.truelayer_account_id;
      if (!accountId) return json({ balance: null }, 200, origin);

      try {
        const data = await yapilyFetch(`/accounts/${accountId}/balances`, consentToken);
        const b    = data.data?.[0];
        return json({
          balance:  b?.balanceAmount?.amount ?? null,
          currency: b?.balanceAmount?.currency ?? "GBP",
        }, 200, origin);
      } catch (err) {
        if (isConsentExpiredError(err)) {
          await sb.from("bank_connections").update({
            sync_error: (err as Error).message, sync_error_code: "CONSENT_EXPIRED",
            needs_reauth: true, last_sync_error_at: new Date().toISOString(),
          }).eq("id", connection.id);
          return json({ balance: null, needsReauth: true }, 200, origin);
        }
        throw err;
      }
    }

    return json({ error: `Unknown action: ${action}` }, 400, origin);

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("yapily-api error:", msg);
    return json({ error: msg }, msg === "Unauthorized" ? 401 : 500, origin);
  }
});
