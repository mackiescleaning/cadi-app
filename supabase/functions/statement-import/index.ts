/**
 * supabase/functions/statement-import/index.ts
 * Cadi — bank statement upload → transactions (launch bridge before open banking)
 *
 * Lets a user upload a bank statement (parsed client-side into normalised rows)
 * and get the same experience as an open-banking feed: rows land in the SAME
 * `transactions` table, auto-categorised and reconciled against open invoices,
 * so the Money tab surfaces them through its existing categorise/sort UX.
 *
 * Uploaded rows are distinguished from bank-fed rows by `bank_connection_id = null`.
 * Dedup is idempotent via a synthetic composite key stored in
 * `truelayer_transaction_id` (unique per business), so re-uploading overlapping
 * weeks never double-counts.
 *
 * Actions (POST JSON):
 *   { action: "import",  rows: NormalisedRow[], dryRun?: boolean }
 *     → dryRun: enrich + dedupe-check only, return preview + counts (no writes)
 *     → import: insert new rows, auto-flip high-confidence invoice matches
 *
 * NormalisedRow = { date: "YYYY-MM-DD", amount: number (+credit/-debit),
 *                   description?: string, merchant?: string, balance?: number }
 *
 * NOTE: The CATEGORY_RULES / autoCategory / merchantKey / tokenSimilarity helpers
 * are intentionally duplicated from yapily-api so this function stays fully
 * decoupled from the live bank-feed path. A future refactor should lift them into
 * supabase/functions/_shared/ and have both import them.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { tierForUser, isPaidTier } from "../_shared/entitlements.ts";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// ── Regex fallback categoriser ──────────────────────────────────────────────────
// Only used when neither a user merchant-rule nor the bank's own category applies.
// Emits chart-of-accounts KEYS directly (the chart derives lane / is_business / VAT).
const CATEGORY_RULES: Array<{ pattern: RegExp; key: string }> = [
  { pattern: /\b(fuel|petrol|diesel|shell|bp\b|esso|texaco|gulf|jet\b|total\b|moto\b|roadchef|welcome\s*break)/i, key: "fuel"        },
  { pattern: /\b(screwfix|toolstation|b&q|wickes|travis\s*perkins|jewson)/i,                                       key: "equipment"   },
  { pattern: /\b(insurance|aviva|axa|zurich|hiscox|simply\s*business|admiral|direct\s*line)/i,                    key: "insurance"   },
  { pattern: /\b(vodafone|o2\b|ee\b|three\b|bt\b|sky\b|talktalk|virgin\s*media)/i,                               key: "phone"       },
  { pattern: /\b(cleaning|bleach|flash\b|dettol|fairy|mr\s*muscle|jeyes|jangro|robert\s*scott|costco|booker|b&m)/i, key: "supplies"  },
  { pattern: /\b(van\s*lease|vehicle\s*finance|car\s*finance|lease\s*plan)/i,                                      key: "vehicle"     },
  { pattern: /\b(hmrc|self\s*assessment|vat\s*return|corporation\s*tax)/i,                                         key: "other"       },
  { pattern: /\b(wages|salary|payroll|employee|subcontract)/i,                                                     key: "staff"       },
  { pattern: /\b(accountant|bookkeeper|sage\b|freeagent)/i,                                                        key: "professional"},
  { pattern: /\b(tesco|sainsbury|asda|morrisons|aldi|lidl|waitrose|co-op|marks\s*&?\s*spencer|iceland\b)/i,        key: "personal"    },
  { pattern: /\b(mcdonald|kfc|subway|greggs|costa|starbucks|caffe\s*nero|restaurant|nando|pizza|deliveroo|uber\s*eat)/i, key: "personal" },
  { pattern: /\b(netflix|spotify|disney\+?|prime\s*video|apple\.com\/bill|google\s*play)/i,                        key: "subscriptions"},
  { pattern: /\b(amazon(?!.*\bbusiness\b)|ebay|argos|currys|john\s*lewis|next\b|asos)/i,                          key: "personal"    },
  { pattern: /\b(bank\s*charge|monthly\s*fee|account\s*fee|overdraft\s*fee)/i,                                    key: "bankfees"    },
  { pattern: /\b(marketing|facebook\s*ads?|google\s*ads?|instagram|meta\b)/i,                                     key: "marketing"   },
];

function autoCategory(description: string, merchant: string): string {
  const text = `${description} ${merchant}`;
  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(text)) return rule.key;
  }
  return "uncategorised";
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

// ── Normalisation helpers ──────────────────────────────────────────────────────
function normDate(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  // Already ISO-ish
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  // DD/MM/YYYY or DD-MM-YYYY (UK default) or DD.MM.YYYY
  const uk = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/);
  if (uk) {
    let [_, d, m, y] = uk; // eslint-disable-line @typescript-eslint/no-unused-vars
    if (y.length === 2) y = (Number(y) > 70 ? "19" : "20") + y;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return null;
}

function normAmount(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== "string") return null;
  // Strip currency symbols, thousands separators; handle (123.45) as negative
  let s = raw.trim().replace(/[£$€,\s]/g, "");
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  if (s.endsWith("-")) { neg = true; s = s.slice(0, -1); }
  const n = parseFloat(s);
  if (!Number.isFinite(n)) return null;
  return neg ? -Math.abs(n) : n;
}

// Synthetic, stable, per-business dedup key. Deliberately does NOT include the
// description/merchant — those depend on which columns the user maps, so a
// re-upload with a different mapping would otherwise look like new rows and
// double-import. Date + amount + running balance uniquely identify a Starling
// row; the occurrence counter handles the (rare) balance-less duplicate case.
function fingerprint(date: string, amount: number, balance: number | null, occ: number): string {
  const b = balance == null ? "" : balance.toFixed(2);
  return `up:${date}|${amount.toFixed(2)}|${b}|${occ}`;
}

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

async function getBusinessId(sb: ReturnType<typeof createClient>, userId: string): Promise<string> {
  const { data, error } = await sb.from("businesses").select("id").eq("owner_user_id", userId).single();
  if (error || !data) throw new Error("Business not found");
  return data.id as string;
}

interface NormalisedRow {
  date: string;
  amount: number;
  description?: string;
  merchant?: string;
  balance?: number | null;
  bankCategory?: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const body   = await req.json() as { action?: string; rows?: unknown; dryRun?: boolean };
    const dryRun = !!body.dryRun;
    const { user, sb } = await getUser(req);

    // ── Entitlement gate ────────────────────────────────────────────────────────
    // Statement import delivers the same "real bank transactions in the Money tab"
    // value as open banking, so we gate it to paid tiers for parity. If you want
    // the bridge available to Lite users too, remove this block (client gate is in
    // StatementImport.jsx).
    if (!isPaidTier(await tierForUser(sb, user.id))) {
      return json({ error: "Statement import requires a Pro or Max plan.", upgrade_required: true }, 403);
    }

    const businessId = await getBusinessId(sb, user.id);

    const rawRows = Array.isArray(body.rows) ? body.rows as Array<Record<string, unknown>> : [];
    if (!rawRows.length) return json({ error: "No rows supplied." }, 400);
    if (rawRows.length > 5000) return json({ error: "Too many rows in one upload (max 5000). Split the statement." }, 400);

    // Normalise + validate
    const clean: NormalisedRow[] = [];
    let skipped = 0;
    for (const r of rawRows) {
      const date   = normDate(r.date);
      const amount = normAmount(r.amount);
      if (!date || amount == null || amount === 0) { skipped++; continue; }
      clean.push({
        date,
        amount,
        description:  typeof r.description === "string" ? r.description.trim() : "",
        merchant:     typeof r.merchant === "string" ? r.merchant.trim() : "",
        balance:      r.balance == null ? null : normAmount(r.balance),
        bankCategory: typeof r.bankCategory === "string" ? r.bankCategory.trim() : "",
      });
    }
    if (!clean.length) return json({ error: "No valid rows after parsing — check the date and amount columns.", skipped }, 400);

    // Load, in one round-trip: user merchant rules, open+paid invoices (for matching),
    // the per-business chart of accounts, the bank-category map, and VAT status.
    // The chart is the source of truth for lane -> is_business / is_hidden + VAT.
    const [{ data: rulesRows }, { data: allInvoices }, { data: chartRows }, { data: bankRuleRows }, { data: taxRow }] = await Promise.all([
      sb.from("merchant_rules").select("merchant_key,category").eq("user_id", user.id),
      sb.from("invoices").select("id, customer, lines, status, customer_id")
        .eq("owner_id", user.id).in("status", ["sent", "viewed", "overdue", "partial", "paid"]),
      sb.from("chart_of_accounts").select("key,lane,vat_treatment").eq("business_id", businessId),
      sb.from("bank_category_rules").select("bank_category,chart_key").eq("business_id", businessId).eq("source", "starling"),
      sb.from("business_tax_profile").select("vat_registered,vat_registered_from").eq("business_id", businessId).maybeSingle(),
    ]);
    const merchantRules = new Map<string, string>(
      (rulesRows ?? []).map((r: { merchant_key: string; category: string }) => [r.merchant_key, r.category]),
    );
    const chart = new Map<string, { lane: string; vat_treatment: string | null }>(
      (chartRows ?? []).map((r: { key: string; lane: string; vat_treatment: string | null }) =>
        [r.key, { lane: r.lane, vat_treatment: r.vat_treatment }]),
    );
    const bankRules = new Map<string, string>(
      (bankRuleRows ?? []).map((r: { bank_category: string; chart_key: string }) => [r.bank_category, r.chart_key]),
    );
    const vatReg  = !!taxRow?.vat_registered;
    const vatFrom = (taxRow?.vat_registered_from ?? null) as string | null;
    const laneOf  = (k: string): string => chart.get(k)?.lane ?? "expense";
    const vatOf   = (k: string): string | null => chart.get(k)?.vat_treatment ?? null;

    // Fingerprint + enrich each row
    const occ = new Map<string, number>();
    type Enriched = {
      key: string; row: NormalisedRow; category: string; isBusiness: boolean | null;
      confidence: number; categorisedBy: string; hidden: boolean; vat: string | null;
      matchedInvoiceId: string | null; matchedCustomerId: string | null;
      reconConfidence: number; autoFlipSafe: boolean;
    };
    const enriched: Enriched[] = clean.map((row) => {
      const base = fingerprint(row.date, row.amount, row.balance ?? null, 0)
        .replace(/\|0$/, "");
      const n = occ.get(base) ?? 0;
      occ.set(base, n + 1);
      const fpKey = `${base}|${n}`;

      const mKey = merchantKey(row.merchant ?? "", row.description ?? "");
      const bankCat = (row.bankCategory ?? "").trim().toUpperCase();

      // Resolve the chart key: user merchant rule → bank's own category → regex guess.
      let catKey: string;
      let categorisedBy: string;
      if (mKey && merchantRules.has(mKey)) {
        catKey = merchantRules.get(mKey)!; categorisedBy = "user";
      } else if (bankCat && bankRules.has(bankCat)) {
        catKey = bankRules.get(bankCat)!; categorisedBy = "bank";
      } else {
        catKey = autoCategory(row.description ?? "", row.merchant ?? ""); categorisedBy = "cadi_ai";
      }

      // Reconciliation for credits (skip transfer lane). May upgrade catKey to income_customer.
      // Unpaid candidates are actionable (propose / auto-mark-paid); paid candidates are
      // attribution-only — link the payment to its customer/invoice without touching status.
      let matchedInvoiceId: string | null = null;
      let matchedCustomerId: string | null = null;
      let reconConfidence = 0.0;
      let autoFlipSafe = false;
      const isCredit = row.amount > 0;
      if (isCredit && allInvoices && laneOf(catKey) !== "transfer") {
        const absAmount = Math.abs(row.amount);
        const payerName = row.merchant || row.description || "";
        const openCands: Array<{ id: string; customerId: string | null; score: number }> = [];
        const paidCands: Array<{ id: string; customerId: string | null; score: number }> = [];
        for (const inv of allInvoices as Array<{ id: string; customer?: { name?: string; first_name?: string; last_name?: string }; lines?: Array<{ rate: number; qty: number }>; customer_id?: string; status?: string }>) {
          const invTotal = (inv.lines ?? []).reduce((s, l) => s + (l.rate ?? 0) * (l.qty ?? 1), 0);
          if (Math.abs(invTotal - absAmount) > 0.01) continue;
          const invCustomer = [inv.customer?.name, inv.customer?.first_name, inv.customer?.last_name].filter(Boolean).join(" ");
          const cand = { id: inv.id, customerId: inv.customer_id ?? null, score: tokenSimilarity(payerName, invCustomer) };
          (inv.status === "paid" ? paidCands : openCands).push(cand);
        }
        const bestOf = (c: typeof openCands) => (c.length ? [...c].sort((a, b) => b.score - a.score)[0] : null);
        const bestOpen = bestOf(openCands);
        const bestPaid = bestOf(paidCands);
        if (bestOpen && bestOpen.score >= 0.6) {
          matchedInvoiceId = bestOpen.id; matchedCustomerId = bestOpen.customerId; reconConfidence = bestOpen.score;
          catKey = "income_customer";
          if (openCands.length === 1 && bestOpen.score >= 0.95) autoFlipSafe = true;
        } else if (bestPaid && bestPaid.score >= 0.6) {
          matchedInvoiceId = bestPaid.id; matchedCustomerId = bestPaid.customerId; reconConfidence = bestPaid.score;
          catKey = "income_customer";
        } else if (catKey === "uncategorised") {
          catKey = "income_other";
        }
      } else if (isCredit && catKey === "uncategorised") {
        catKey = "income_other";
      }

      // Derive everything from the FINAL category via the chart of accounts.
      let category: string, hidden = false, vat: string | null = null, confidence = 0.0;
      let isBusiness: boolean | null = null;
      if (catKey === "uncategorised") {
        category = "uncategorised";                    // needs review (is_business null)
      } else {
        const lane = laneOf(catKey);
        category   = catKey;
        isBusiness = (lane === "income" || lane === "expense");
        hidden     = (lane === "transfer");
        confidence = categorisedBy === "user" ? 1.0 : categorisedBy === "bank" ? 0.9 : 0.85;
        if (vatReg && (!vatFrom || row.date >= vatFrom)) vat = vatOf(catKey);
      }

      return { key: fpKey, row, category, isBusiness, confidence, categorisedBy, hidden, vat, matchedInvoiceId, matchedCustomerId, reconConfidence, autoFlipSafe };
    });

    // Dedup against what's already stored for this business
    const keys = enriched.map(e => e.key);
    const existing = new Set<string>();
    for (let i = 0; i < keys.length; i += 500) {
      const chunk = keys.slice(i, i + 500);
      const { data: dupes } = await sb.from("transactions")
        .select("truelayer_transaction_id")
        .eq("business_id", businessId)
        .in("truelayer_transaction_id", chunk);
      (dupes ?? []).forEach((d: { truelayer_transaction_id: string }) => existing.add(d.truelayer_transaction_id));
    }
    const fresh = enriched.filter(e => !existing.has(e.key));

    const summary = {
      total:      clean.length,
      newRows:    fresh.length,
      duplicates: enriched.length - fresh.length,
      skipped,
      matched:    fresh.filter(e => e.matchedInvoiceId).length,
      transfers:  fresh.filter(e => e.hidden).length,
      credits:    fresh.filter(e => e.row.amount > 0 && !e.hidden).length,
      debits:     fresh.filter(e => e.row.amount < 0 && !e.hidden).length,
    };

    if (dryRun) {
      return json({
        success: true, dryRun: true, summary,
        preview: fresh.slice(0, 30).map(e => ({
          date: e.row.date, amount: e.row.amount, description: e.row.description,
          category: e.category, isBusiness: e.isBusiness, matched: !!e.matchedInvoiceId, excluded: e.hidden,
        })),
      });
    }

    // Insert fresh rows (chunked). ignoreDuplicates so a race can't clobber a
    // user's later manual categorisation of an already-imported row.
    let imported = 0;
    for (let i = 0; i < fresh.length; i += 500) {
      const chunk = fresh.slice(i, i + 500);
      const rows = chunk.map(e => ({
        business_id:               businessId,
        bank_connection_id:        null,
        truelayer_transaction_id:  e.key,
        transaction_date:          e.row.date,
        amount:                    e.row.amount,
        currency:                  "GBP",
        description:               e.row.description || null,
        merchant_name:             e.row.merchant || null,
        category:                  e.category,
        categorisation_confidence: e.confidence,
        categorised_by:            e.categorisedBy,
        matched_invoice_id:        e.matchedInvoiceId,
        matched_customer_id:       e.matchedCustomerId,
        reconciliation_confidence: e.reconConfidence > 0 ? e.reconConfidence : null,
        is_business:               e.isBusiness,
        is_hidden:                 e.hidden,
        vat_treatment:             e.vat,
      }));
      const { error: insErr, count } = await sb.from("transactions")
        .upsert(rows, { onConflict: "business_id,truelayer_transaction_id", ignoreDuplicates: true, count: "exact" });
      if (insErr) throw new Error(insErr.message);
      imported += count ?? chunk.length;
    }

    // Auto-flip only the very-high-confidence single-candidate matches
    let autoMatched = 0;
    for (const e of fresh) {
      if (e.matchedInvoiceId && e.autoFlipSafe) {
        const { error: flipErr } = await sb.from("invoices")
          .update({ status: "paid", paid_at: new Date().toISOString() })
          .eq("id", e.matchedInvoiceId).eq("owner_id", user.id);
        if (!flipErr) autoMatched++;
      }
    }

    return json({ success: true, imported, autoMatched, summary });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("statement-import error:", msg);
    return json({ error: msg }, msg === "Unauthorized" ? 401 : 500);
  }
});
