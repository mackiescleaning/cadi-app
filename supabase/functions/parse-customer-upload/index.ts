/**
 * supabase/functions/parse-customer-upload/index.ts
 * Cadi — parse a messy customer import into structured parsed_customers rows.
 *
 * POST { import_id }
 *   The function pulls the file referenced by customer_imports.storage_path,
 *   dispatches to a path-specific parser, calls Sonnet to extract structured
 *   data, and writes parsed_customers rows. Nothing is committed to live
 *   customers/jobs/recurring_jobs — that happens later, after user review.
 *
 * Source dispatching:
 *   - csv/pasted_text → row-parse (CSV) or as-is text → batched Sonnet text call
 *   - image (jpg/png/webp) → Sonnet vision
 *   - pdf → Sonnet document content block
 *   - xlsx → returns a clear "export to CSV" message (Sonnet doesn't read xlsx
 *     directly and we don't ship SheetJS here — kept the surface small)
 *
 * Auth: requires Supabase JWT (verify_jwt=true). Uses service role internally
 * for storage reads and parsed_customers writes (RLS bypass intentional —
 * the user already authenticated to trigger the function).
 */

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { parse as parseCsv } from "https://deno.land/std@0.224.0/csv/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as XLSX from "https://esm.sh/xlsx@0.18.5?target=deno";

const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const SUPABASE_URL  = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BUCKET        = "customer-imports";
const MODEL         = "claude-sonnet-4-5";
const ROW_BATCH     = 25;

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

// ── System prompt ───────────────────────────────────────────────────────────
// Returns ONLY a JSON array. Per-field confidence 0-1. Bucketed.
//
// The seven real-world gotchas the parser must handle (drawn from the diary
// fixture + the Cadi-onboarding spec):
//   1. No currency symbol — numbers alone are GBP
//   2. Short-form services ("windows" not "window cleaning")
//   3. Address as the customer identifier when no name given ("64 Levengrove")
//   4. Multi-property bookings ("Nettlecroft x3") — one customer, N visits
//   5. Strike-throughs / "cancelled" / "void" = excluded from output
//   6. Mixed semantics on one source — daily diary entries vs new-customer rows
//      with explicit frequency. Different rules.
//   7. Action TODOs ("INVOICE Britannia", "follow up Tom") — never customers

const SYSTEM_PROMPT = `You are Cadi's customer-data parser. UK cleaning businesses send you messy real-world inputs (CSV exports, photos of paper diaries, screenshots, PDFs, pasted notes). Return ONLY a JSON array — no prose, no markdown fences, no explanation.

Each element of the array is one customer. Shape:
{
  "name": string | null,
  "address": string | null,
  "postcode": string | null,
  "phone": string | null,
  "email": string | null,
  "category": "residential" | "commercial" | "exterior" | null,
  "service_label": string | null,
  "price": number | null,
  "price_unit": "per_visit" | "per_hour" | "per_month" | null,
  "frequency_raw": string | null,
  "frequency_rrule": string | null,
  "anchor_date": "YYYY-MM-DD" | null,
  "anchor_type": "last_done" | "next_due" | "start_date" | null,
  "day_preference": string | null,
  "notes": string | null,
  "bucket": "ready" | "nearly" | "decision",
  "confidence": { "<field>": number 0-1 }
}

== Bucket rules ==
- "ready": has frequency_rrule AND anchor_date
- "nearly": has frequency_rrule but no anchor_date
- "decision": no rrule (one-off, ad-hoc, dormant, single diary entry with no recurrence info, OR a contact-only export with no schedule columns)

== One row = one entry (CSV/structured sources) ==
For CSV / spreadsheet / structured exports, EVERY data row that has any identifying info (name, address, phone, email) MUST produce an entry. Even if the file has no Schedule / Price / Due columns. That's a Customers/Contacts export — emit each row as bucket="decision" with frequency_rrule=null, anchor_date=null, price=null. The owner will add schedule info later or merge with a Jobs export.
Do NOT return [] just because there's no schedule data. The only reasons to drop a row are: it's cancelled/voided, it's a strike-through, it's an action TODO not a customer, or it has zero identifying info.

== Frequency → RRULE ==
- "weekly", "wk", "every week" → "FREQ=WEEKLY"
- "fortnightly", "F/N", "2wk", "bi-weekly", "every 2 weeks", "every other week" → "FREQ=WEEKLY;INTERVAL=2"
- "4-weekly", "4 weekly", "every 4 weeks" → "FREQ=WEEKLY;INTERVAL=4"
- "monthly" (cleaners often mean 4-weekly — lower confidence to 0.5 and note "monthly ambiguous" in the notes field) → "FREQ=WEEKLY;INTERVAL=4"
- "first Tuesday of the month" → "FREQ=MONTHLY;BYDAY=1TU"
- "6-weekly", "every 6 weeks" → "FREQ=WEEKLY;INTERVAL=6"
- "8 weekly", "every 8 weeks" → "FREQ=WEEKLY;INTERVAL=8"
- "6 monthly", "every 6 months", "twice yearly" → "FREQ=MONTHLY;INTERVAL=6"
- "one off", "ad hoc", "TBC", "when they call", blank, "one-off" → no rrule, bucket="decision"

== Day-of-week ==
- "Tuesdays", "Tues", "Tue only" → day_preference="Tuesday", BYDAY=TU on the rrule when unambiguous
- "term time" → day_preference="term time" only, no BYDAY
- Multiple days like "Tues/Fri" → day_preference="Tuesday or Friday", no BYDAY (ambiguous)

== Category inference ==
- Business names with "Ltd", "Limited", "PLC", "Pub", "Hotel", "Restaurant", "Inn", "Office", "School", "Surgery", "Clinic", "Salon", "Lettings", "Management" → "commercial"
- Service mentions windows / window / gutter / fascia / soffit / softwash / jet wash / pressure wash / render → "exterior"
- Person name + house/flat address with no commercial signal → "residential"
- When ambiguous: leave null, do not guess

== Date handling ==
- Dates are UK format DD/MM/YYYY. "1/6" or "1/6/26" = 1 June 2026.
- Two-digit years assume 20XX.
- "Last done 2/6" → anchor_date="2026-06-02", anchor_type="last_done"
- "Due 5/7" / "Next clean 5/7" → anchor_date="2026-07-05", anchor_type="next_due"
- If the year is impossible or missing context, leave null (don't guess).

== Real-world cleaner-diary gotchas ==
1. **No £ symbol.** Plain numbers next to a customer = price in GBP. "Dowling - 22 - windows" → price=22, service_label="windows".
2. **Short service names.** "windows", "wins", "Ws" → service_label="windows". Don't expand to "window cleaning" — preserve their language.
3. **Address as identifier.** When no person name, use the address as the customer name. "64 Levengrove - 20 - window" → name="64 Levengrove".
4. **Multi-property bookings.** "Nettlecroft x3 - 22" = THREE customer entries for the same customer name. Emit three rows, each price=22, mark notes="property 1 of 3" / "2 of 3" / "3 of 3".
5. **Cancellations.** Strike-throughs in handwriting, "cancelled", "void", "ignore", "X out" — DO NOT EMIT. Skip silently.
6. **Mixed semantics.** A diary page often has (a) today's scheduled work with times and (b) new customers being added with frequency notes. The TIMED entries are one-off visits unless the diary explicitly says recurrence → bucket="decision". The NAMED+PRICE+FREQUENCY entries at the bottom are recurring customers → bucket="ready"/"nearly" per the rrule rules above.
7. **Action TODOs.** "INVOICE Britannia", "follow up Tom", "ring back John" — these are reminders, not customers. SKIP.

== Confidence rules ==
- Score each populated field 0–1 based on how clearly you read it.
- Handwriting: cap at 0.85 unless the writing is exceptionally clear.
- Inferred values (category guessed from name) cap at 0.7.
- "Monthly" frequency cap at 0.5 (genuine ambiguity).

== Output ==
- ONLY the JSON array. Start the response with [ and end with ]. No code fences, no preamble.
- If you find zero customers in the input, return [].
- Trim whitespace. Don't add explanatory text inside notes — only what was in the source plus the multi-property "N of 3" markers.`;

// ── Anthropic call ──────────────────────────────────────────────────────────

async function callSonnet(content: any[]): Promise<string> {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content }],
    }),
  });
  if (!r.ok) {
    const errText = await r.text();
    throw new Error(`Anthropic ${r.status}: ${errText.slice(0, 400)}`);
  }
  const j = await r.json();
  return j?.content?.[0]?.text ?? "";
}

function parseModelOutput(text: string): any[] {
  // Defensive — strip code fences and grab the [...] block.
  const cleaned = text.replace(/```json\s*|```\s*$/g, "").trim();
  const start = cleaned.indexOf("[");
  const end   = cleaned.lastIndexOf("]");
  const slice = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;
  try {
    const parsed = JSON.parse(slice);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// ── Dispatch by source type ────────────────────────────────────────────────

type SourceType = "csv" | "xlsx" | "image" | "pdf" | "pasted_text" | "contacts";
type ImportRow = {
  id: string;
  business_id: string;
  source_type: SourceType;
  storage_path: string | null;
};

async function downloadFile(sb: any, path: string): Promise<{ bytes: Uint8Array; mime: string }> {
  const { data, error } = await sb.storage.from(BUCKET).download(path);
  if (error) throw new Error(`storage download: ${error.message}`);
  const ab = await data.arrayBuffer();
  return { bytes: new Uint8Array(ab), mime: data.type || "application/octet-stream" };
}

// Strip UTF-8 BOM and normalise whitespace before parsing. CleanerPlanner
// exports CSVs with a BOM + CRLF line endings — Deno's std/csv handles CRLF
// but the BOM leaks into the first column header as ﻿ which confuses
// Sonnet's column lookup.
function stripBom(s: string): string {
  return s.charCodeAt(0) === 0xFEFF ? s.slice(1) : s;
}

// Header → field index. Trims, case-insensitive, tolerant of common aliases.
function indexHeaders(headers: string[]): Record<string, number> {
  const idx: Record<string, number> = {};
  headers.forEach((h, i) => {
    const k = String(h ?? "").trim().toLowerCase();
    if (k) idx[k] = i;
  });
  return idx;
}
function pick(row: string[], idx: Record<string, number>, ...keys: string[]): string {
  for (const k of keys) {
    const i = idx[k.toLowerCase()];
    if (i !== undefined) {
      const v = String(row[i] ?? "").trim();
      if (v) return v;
    }
  }
  return "";
}

// "6 Weeks" / "Fortnightly" / "Monthly" → Cadi rrule.
// Returns null when the value is unrecognised — caller will keep it as raw.
function scheduleToRrule(raw: string): string | null {
  const s = String(raw || "").toLowerCase().trim();
  if (!s) return null;
  if (/(^|\b)(one[- ]?off|adhoc|ad[- ]?hoc|tbc|tba|n\/?a)\b/.test(s)) return null;
  if (/^weekly\b|every week\b/.test(s)) return "FREQ=WEEKLY";
  if (/fortnight|every 2 weeks?|bi[- ]?weekly|2[- ]?weekly/.test(s)) return "FREQ=WEEKLY;INTERVAL=2";
  const wkMatch = s.match(/(\d+)\s*(weekly|weeks?|wk|w)/);
  if (wkMatch) return `FREQ=WEEKLY;INTERVAL=${parseInt(wkMatch[1], 10)}`;
  if (/quarterly|every 3 months/.test(s)) return "FREQ=WEEKLY;INTERVAL=12";
  if (/twice yearly|every 6 months|6[- ]?monthly/.test(s)) return "FREQ=MONTHLY;INTERVAL=6";
  if (/annually|yearly|every year/.test(s)) return "FREQ=YEARLY";
  if (/^monthly\b|every month/.test(s)) return "FREQ=WEEKLY;INTERVAL=4"; // cleaner-monthly
  // Generic "N months" / "N month" — cleaning industry treats months as
  // 4-week cycles (route-based, not calendar-based). Convert to weekly.
  const moMatch = s.match(/(\d+)\s*months?\b/);
  if (moMatch) {
    const n = parseInt(moMatch[1], 10);
    if (n > 0) return `FREQ=WEEKLY;INTERVAL=${n * 4}`;
  }
  return null;
}

// "05/05/2026" / "5/5/26" / "5-5-2026" → "2026-05-05". UK day-first.
function parseUkDate(raw: string): string | null {
  const s = String(raw || "").trim();
  if (!s) return null;
  const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2}|\d{4})$/);
  if (!m) return null;
  let [, dd, mm, yy] = m;
  if (yy.length === 2) yy = `20${yy}`;
  const d = parseInt(dd, 10), mo = parseInt(mm, 10), y = parseInt(yy, 10);
  if (!d || !mo || mo > 12 || d > 31) return null;
  return `${y.toString().padStart(4, "0")}-${mo.toString().padStart(2, "0")}-${d.toString().padStart(2, "0")}`;
}

// Spec §6.1 archetype detection. Run BEFORE row mapping so we know whether
// this is an operational export (Cleaner Planner Jobs) or a contact export
// (QuickBooks customers) and route accordingly.
//   operational: per-job price + frequency column → schedulable
//   contact:     balance/contact columns only      → unscheduled, AR-only
//   partial:     anything in between               → treat as contact + enrich
type Archetype = "operational" | "contact" | "partial";

function detectArchetype(idx: Record<string, number>): Archetype {
  const hasFrequency = "schedule" in idx || "frequency" in idx;
  const hasPrice     = "price" in idx || "fee" in idx || "cost" in idx;
  // AR guard: balance / open balance / amount owed / outstanding / debit
  const hasBalance = Object.keys(idx).some(h =>
    /\b(balance|open\s*balance|amount\s*owed|outstanding|debit|debit\s*amount|amount\s*due)\b/i.test(h)
  );

  if (hasFrequency && hasPrice) return "operational";
  if (hasBalance && !hasPrice && !hasFrequency) return "contact";
  return "partial";
}

// Deterministic CleanerPlanner-style CSV mapper. Used when the headers look
// like a known structured export — bypasses the LLM entirely for these.
// Returns null if the headers don't match a known shape.
function deterministicCsvMap(headers: string[], rows: string[][]): { rows: any[]; archetype: Archetype } | null {
  const idx = indexHeaders(headers);
  const hasName  = "name" in idx || "first name" in idx || "last name" in idx;
  const hasRef   = "cust ref" in idx || "customer ref" in idx || "customer reference" in idx;
  const hasAddr  = "address line 1" in idx || "address" in idx;
  // Need at least a customer ref + (name or address) to trust the shape.
  if (!hasRef || !(hasName || hasAddr)) return null;

  const archetype = detectArchetype(idx);
  const hasSchedule = "schedule" in idx || "frequency" in idx;
  const hasDue      = "due" in idx || "next due" in idx;
  const hasPrice    = "price" in idx || "fee" in idx;
  const hasJobRef   = "job ref" in idx;

  // AR-guard column detection. Anything matching these names is RECEIVABLE,
  // never a per-job price. We pick it up into outstanding_balance.
  const balanceHeader = Object.keys(idx).find(h =>
    /\b(balance|open\s*balance|amount\s*owed|outstanding|debit|amount\s*due)\b/i.test(h)
  );

  const out: any[] = [];
  for (const r of rows) {
    if (!r || !r.length) continue;
    // Skip cancelled rows if there's a Status / Cancelled column.
    const status   = pick(r, idx, "status").toLowerCase();
    const cancelled = pick(r, idx, "cancelled").toLowerCase();
    if (status.includes("cancel") || cancelled === "yes" || cancelled === "true") continue;

    const title  = pick(r, idx, "title");
    const first  = pick(r, idx, "first name");
    const last   = pick(r, idx, "last name");
    const nameCol = pick(r, idx, "name");
    const fullName = nameCol || [title, first, last].filter(Boolean).join(" ").trim();
    const address  = pick(r, idx, "address line 1", "address");
    const phone    = pick(r, idx, "phone") || pick(r, idx, "telephone");
    const mobile   = pick(r, idx, "mobile");
    const email    = pick(r, idx, "email");
    const custRef  = pick(r, idx, "cust ref", "customer ref", "customer reference");

    // Need something identifying.
    if (!fullName && !address && !phone && !mobile && !email) continue;

    const schedRaw = hasSchedule ? pick(r, idx, "schedule", "frequency") : "";
    const dueRaw   = hasDue      ? pick(r, idx, "due", "next due")       : "";
    const priceNum = hasPrice    ? parseFloat(pick(r, idx, "price", "fee").replace(/[£,$,\s]/g, "")) : NaN;

    // AR-balance guard (spec §6.1). Anything in a Balance / Open Balance /
    // Amount Owed / Outstanding column is RECEIVABLE, not a per-visit price.
    // Captured separately so the Money tab can show "you're owed £X" without
    // ever polluting the catalogue or menu.
    const balanceRaw = balanceHeader
      ? pick(r, idx, balanceHeader).replace(/[£,$,\s]/g, "")
      : "";
    const balanceNum = balanceRaw ? parseFloat(balanceRaw) : NaN;

    // CleanerPlanner's "Round" column is the area + cadence label
    // (e.g. "Grovehill Every Twelve Weeks", "Saturday Window Round") —
    // NOT the service. Only treat it as a service if it explicitly
    // contains a known cleaning-service keyword. Otherwise leave service
    // null (user fills via chips) and stash the round name in notes.
    const roundRaw   = pick(r, idx, "round");
    const serviceRaw = pick(r, idx, "service");
    const SERVICE_KEYS = [
      { re: /window/i,        label: "Windows" },
      { re: /gutter/i,        label: "Gutters" },
      { re: /conservatory/i,  label: "Conservatory" },
      { re: /fascia|soffit/i, label: "Fascia & soffit" },
      { re: /carpet/i,        label: "Carpet clean" },
      { re: /oven/i,          label: "Oven clean" },
      { re: /driveway/i,      label: "Driveway" },
      { re: /patio/i,         label: "Patio" },
      { re: /softwash|soft wash/i, label: "Softwash" },
      { re: /roof/i,          label: "Roof" },
      { re: /pressure|jet wash/i,  label: "Pressure wash" },
      { re: /render/i,        label: "Render" },
      { re: /end of tenancy/i, label: "End of tenancy" },
      { re: /deep clean/i,    label: "Deep clean" },
      { re: /office/i,        label: "Office clean" },
      { re: /\bpub\b|restaurant/i, label: "Pub / restaurant" },
      { re: /airbnb|turnover/i, label: "Airbnb turnover" },
    ];
    let inferredService: string | null = serviceRaw || null;
    if (!inferredService && roundRaw) {
      const hit = SERVICE_KEYS.find(s => s.re.test(roundRaw));
      if (hit) inferredService = hit.label;
    }
    const serviceLabel = inferredService;
    const roundNote    = roundRaw && !inferredService ? `Round: ${roundRaw}` : null;

    // Division auto-detect — saves the owner from tapping division on every
    // card. ORDER MATTERS: commercial signal wins over exterior because
    // the customer type (business vs home) is what division actually
    // captures. "Holiday Inn + windows" is a commercial customer, not an
    // exterior one. Residential service words come last as a fallback.
    const haystack = `${fullName} ${address} ${serviceLabel ?? ""} ${roundRaw}`.toLowerCase();
    let category: "residential" | "commercial" | "exterior" | null = null;
    if (
      /\b(ltd|limited|plc|llp|inn|hotel|pub|restaurant|cafe|cafeteria|school|surgery|clinic|salon|lettings|management|nursery|church|estate|primary|industrial|workspace|office|warehouse|factory|shop|retail|store|hall|business park|trading estate|care home|nursing home|holiday inn|premier inn|travelodge|wetherspoon|community centre)\b/.test(haystack)
    ) {
      category = "commercial";
    } else if (/\b(window|gutter|conservatory|fascia|soffit|driveway|patio|softwash|soft wash|pressure|jet wash|render|roof)\b/.test(haystack)) {
      category = "exterior";
    } else if (
      /\b(regular clean|deep clean|domestic|oven|carpet|end of tenancy|airbnb|turnover|spring clean)\b/.test(haystack)
    ) {
      category = "residential";
    }

    const rrule  = scheduleToRrule(schedRaw);
    const anchor = parseUkDate(dueRaw);

    // Bucket: ready if both rrule + anchor; nearly if just rrule; decision otherwise.
    const bucket = rrule && anchor ? "ready" : rrule ? "nearly" : "decision";

    out.push({
      name:            fullName || address || null,
      address:         address || null,
      postcode:        null,
      phone:           phone || mobile || null,
      email:           email || null,
      customer_ref:    custRef || null,
      category:        category,
      service_label:   serviceLabel,
      price:           Number.isFinite(priceNum) && priceNum > 0 ? priceNum : null,
      price_unit:      Number.isFinite(priceNum) && priceNum > 0 ? "per_visit" : null,
      frequency_raw:   schedRaw || null,
      frequency_rrule: rrule,
      anchor_date:     anchor,
      anchor_type:     anchor ? "next_due" : null,
      day_preference:  null,
      notes:           [
                          pick(r, idx, "source") ? `Source: ${pick(r, idx, "source")}` : null,
                          roundNote,
                        ].filter(Boolean).join(" · ") || null,
      bucket,
      confidence:      { _deterministic: 1 },
      outstanding_balance: Number.isFinite(balanceNum) ? balanceNum : null,
    });
  }
  return { rows: out, archetype };
}

type ParseResult = { rows: any[]; archetype: Archetype };

// Convert an Excel workbook (.xls or .xlsx) into a clean CSV string.
// Handles QuickBooks-style exports that prefix the table with a business-name
// title row, a report title, a date, and a blank row before the real header.
// We score the first 20 rows for header-likeness and slice from there.
const HEADER_HINTS = [
  "name","customer","client","company","contact","display name",
  "email","phone","mobile","telephone","main phone","fax",
  "address","street","town","city","county","state","postcode","post code","zip","postal",
  "balance","open balance","outstanding",
  "round","route","due","schedule","frequency","ref","job ref","cust ref",
  "status","tags","notes","memo","comments",
  "bill to","ship to","billing address",
];

function xlsxToCsv(bytes: Uint8Array): string {
  const wb = XLSX.read(bytes, { type: "array", cellDates: true });
  if (!wb.SheetNames.length) throw new Error("xlsx: no sheets found");
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    raw: true,
    blankrows: false,
  });
  if (!aoa.length) throw new Error("xlsx: sheet is empty");

  let headerRowIdx = 0;
  let bestScore = 0;
  for (let i = 0; i < Math.min(aoa.length, 20); i++) {
    const row = aoa[i] ?? [];
    const cells = row.map((c) => String(c ?? "").toLowerCase().trim());
    const nonEmpty = cells.filter(Boolean).length;
    if (nonEmpty < 2) continue;
    const score = cells.reduce((acc, s) => {
      if (!s || s.length > 40) return acc;
      return acc + (HEADER_HINTS.some((h) => s === h || s.includes(h)) ? 1 : 0);
    }, 0);
    if (score > bestScore) {
      bestScore = score;
      headerRowIdx = i;
    }
  }

  const trimmed = aoa.slice(headerRowIdx);
  // Drop trailing "Total" summary rows that QuickBooks appends.
  const rows = trimmed.filter((row, i) => {
    if (i === 0) return true;
    const vals = (row ?? []).map((c) => String(c ?? "").trim()).filter(Boolean);
    if (vals.length === 0) return false;
    if (vals.length <= 2 && /^total\b/i.test(vals[0])) return false;
    return true;
  });

  const csvEscape = (v: unknown): string => {
    if (v instanceof Date && !isNaN(v.getTime())) {
      const dd = String(v.getDate()).padStart(2, "0");
      const mm = String(v.getMonth() + 1).padStart(2, "0");
      return `${dd}/${mm}/${v.getFullYear()}`;
    }
    const s = String(v ?? "");
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map((row) => (row ?? []).map(csvEscape).join(",")).join("\n");
}

async function parseXlsxSource(bytes: Uint8Array): Promise<ParseResult> {
  const csv = xlsxToCsv(bytes);
  return parseCsvSource(csv);
}

async function parseCsvSource(text: string): Promise<ParseResult> {
  const cleanText = stripBom(text);
  const rows = parseCsv(cleanText, { skipFirstRow: false });
  if (!rows.length) return { rows: [], archetype: "partial" };
  const headerRow = rows[0] as string[];
  const dataRows  = rows.slice(1) as string[][];
  const headerLine = headerRow.join(",");

  // First try the deterministic path. If the shape matches a known export
  // we trust the column mapping and skip the LLM entirely — fast, free,
  // and impossible to "creatively" return zero rows.
  const direct = deterministicCsvMap(headerRow, dataRows);
  if (direct && direct.rows.length > 0) {
    return direct;
  }

  // Fallback: send to Sonnet in batches. We can still compute archetype
  // from the headers we have.
  const idx = indexHeaders(headerRow);
  const archetype = detectArchetype(idx);

  // Run all Sonnet batches in parallel. The sequential loop here previously
  // ran each batch back-to-back (~10-15s each) and on files > 50 rows the
  // edge function would hit Supabase's 60s timeout and return whatever it
  // had accumulated so far — producing the silent "only 50 imported"
  // truncation we used to see on QuickBooks exports with 100+ customers.
  // Parallelising drops total wall-clock to roughly the slowest single
  // batch and lets us handle 200+ row files comfortably inside timeout.
  const batches: Array<{ i: number; chunk: string[][] }> = [];
  for (let i = 0; i < dataRows.length; i += ROW_BATCH) {
    batches.push({ i, chunk: dataRows.slice(i, i + ROW_BATCH) });
  }

  const results = await Promise.all(batches.map(async ({ i, chunk }) => {
    const tsv = chunk.map(r => r.join(",")).join("\n");
    const prompt = `CSV header:\n${headerLine}\n\nRows ${i + 1}–${i + chunk.length} (${chunk.length} rows):\n${tsv}\n\nParse to JSON array. Emit ONE entry per row — expect ${chunk.length} entries unless rows are clearly cancelled/voided/strike-through. Even if the file has no Schedule/Price/Due columns (contact-only export), emit each row as bucket="decision". Return ONLY the array.`;
    try {
      const out = await callSonnet([{ type: "text", text: prompt }]);
      return parseModelOutput(out);
    } catch (err) {
      console.error(`csv batch ${i / ROW_BATCH + 1} failed: ${(err as Error).message}`);
      return [];
    }
  }));

  const allParsed = results.flat();
  return { rows: allParsed, archetype };
}

async function parseTextSource(text: string): Promise<ParseResult> {
  const trimmed = String(text).slice(0, 60000);
  const out = await callSonnet([{ type: "text", text: `Pasted note from a cleaning business owner. Parse to JSON array. Return ONLY the array.\n\n${trimmed}` }]);
  return { rows: parseModelOutput(out), archetype: "partial" };
}

async function parseImageSource(bytes: Uint8Array, mime: string): Promise<ParseResult> {
  const b64 = base64Encode(bytes);
  const out = await callSonnet([
    { type: "image", source: { type: "base64", media_type: mime || "image/jpeg", data: b64 } },
    { type: "text",  text: "Photo or screenshot from a cleaning business — read every customer/job/price/frequency you can. Apply the cleaner-diary gotchas. Return ONLY the JSON array." },
  ]);
  // Photos / paper diary entries are operational by nature — there's a
  // price next to each name and a frequency or date written down.
  return { rows: parseModelOutput(out), archetype: "operational" };
}

async function parsePdfSource(bytes: Uint8Array): Promise<ParseResult> {
  const b64 = base64Encode(bytes);
  const out = await callSonnet([
    { type: "document", source: { type: "base64", media_type: "application/pdf", data: b64 } },
    { type: "text", text: "PDF export from cleaning-business software. Parse to JSON array. Return ONLY the array." },
  ]);
  // PDF exports vary too much to confidently classify — leave at partial.
  return { rows: parseModelOutput(out), archetype: "partial" };
}

function base64Encode(bytes: Uint8Array): string {
  // Chunked encode — atob/btoa handles strings, but for large binary we go
  // through a stable chunked approach to avoid stack blow-out.
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(bin);
}

// ── Duplicate detection ────────────────────────────────────────────────────
// Name similarity (case-insensitive Levenshtein on the first 24 chars) +
// postcode match. Sets is_duplicate_of on later rows that look like earlier
// ones. Cheap O(n²) — fine for the typical sub-1000-row import.

function detectDuplicates(rows: any[]): void {
  const normalised = rows.map(r => ({
    name: String(r.name ?? "").toLowerCase().trim().slice(0, 24),
    postcode: String(r.postcode ?? "").replace(/\s/g, "").toUpperCase(),
  }));
  for (let j = 1; j < rows.length; j++) {
    for (let i = 0; i < j; i++) {
      if (!normalised[i].name || !normalised[j].name) continue;
      if (normalised[i].postcode && normalised[j].postcode && normalised[i].postcode !== normalised[j].postcode) continue;
      if (levenshtein(normalised[i].name, normalised[j].name) <= 2) {
        rows[j].__duplicate_of_idx = i;
        break;
      }
    }
  }
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const v0 = new Array(b.length + 1).fill(0);
  const v1 = new Array(b.length + 1).fill(0);
  for (let i = 0; i <= b.length; i++) v0[i] = i;
  for (let i = 0; i < a.length; i++) {
    v1[0] = i + 1;
    for (let j = 0; j < b.length; j++) {
      const cost = a[i] === b[j] ? 0 : 1;
      v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost);
    }
    for (let j = 0; j <= b.length; j++) v0[j] = v1[j];
  }
  return v1[b.length];
}

// ── Bucket assignment fallback ─────────────────────────────────────────────
// Sonnet should set bucket per the system prompt, but be defensive — if the
// model left it null or contradicted itself, recompute from rrule + anchor.

function reconcileBucket(r: any): "ready" | "nearly" | "decision" {
  const hasRrule  = Boolean(r.frequency_rrule);
  const hasAnchor = Boolean(r.anchor_date);
  if (hasRrule && hasAnchor) return "ready";
  if (hasRrule)              return "nearly";
  return "decision";
}

// ── Persist ────────────────────────────────────────────────────────────────

async function writeParsed(sb: any, businessId: string, importId: string, parsed: any[]): Promise<void> {
  if (!parsed.length) return;

  const rows = parsed.map((p, idx) => ({
    business_id:     businessId,
    import_id:       importId,
    name:            stringOrNull(p.name),
    address:         stringOrNull(p.address),
    postcode:        stringOrNull(p.postcode),
    phone:           stringOrNull(p.phone),
    email:           stringOrNull(p.email),
    category:        ["residential","commercial","exterior"].includes(p.category) ? p.category : null,
    service_label:   stringOrNull(p.service_label),
    price:           numberOrNull(p.price),
    price_unit:      ["per_visit","per_hour","per_month"].includes(p.price_unit) ? p.price_unit : null,
    frequency_raw:   stringOrNull(p.frequency_raw),
    frequency_rrule: stringOrNull(p.frequency_rrule),
    anchor_date:     stringOrNull(p.anchor_date),
    anchor_type:     ["last_done","next_due","start_date"].includes(p.anchor_type) ? p.anchor_type : null,
    day_preference:  stringOrNull(p.day_preference),
    notes:           stringOrNull(p.notes),
    confidence:      typeof p.confidence === "object" && p.confidence ? p.confidence : {},
    bucket:          reconcileBucket(p),
    keep:            true,
    committed:       false,
    // AR-balance guard: separate from `price`. The commit step routes this
    // to customers.customer_balance, never to the catalogue or any menu.
    outstanding_balance: numberOrNull(p.outstanding_balance),
    __idx:           idx, // local for FK rewrite below
  }));

  // Insert first, then rewrite duplicate FKs by row index.
  const { data, error } = await sb
    .from("parsed_customers")
    .insert(rows.map(({ __idx, ...rest }) => rest))
    .select("id");
  if (error) throw new Error(`insert parsed_customers: ${error.message}`);

  const dupesToWrite = parsed
    .map((p, idx) => ({ idx, dup: p.__duplicate_of_idx }))
    .filter(x => typeof x.dup === "number" && data?.[x.dup]?.id);

  if (dupesToWrite.length) {
    await Promise.all(
      dupesToWrite.map(d =>
        sb.from("parsed_customers")
          .update({ is_duplicate_of: data![d.dup as number].id })
          .eq("id", data![d.idx].id),
      ),
    );
  }
}

function stringOrNull(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}
function numberOrNull(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/[£,\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}

// ── HTTP handler ────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST")    return json({ error: "POST only" }, 405);
  if (!ANTHROPIC_KEY)           return json({ error: "ANTHROPIC_API_KEY missing" }, 503);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "invalid JSON" }, 400); }

  const importId = String(body?.import_id ?? "");
  if (!importId) return json({ error: "import_id required" }, 400);

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);

  // Pull the import record
  const { data: imp, error: impErr } = await sb
    .from("customer_imports")
    .select("id, business_id, source_type, storage_path")
    .eq("id", importId)
    .maybeSingle<ImportRow>();
  if (impErr || !imp) return json({ error: "import not found" }, 404);

  // Mark as parsing
  await sb.from("customer_imports").update({ parse_status: "parsing", parse_error: null }).eq("id", importId);

  try {
    let result: ParseResult = { rows: [], archetype: "partial" };

    if (imp.source_type === "csv" || imp.source_type === "pasted_text") {
      if (!imp.storage_path) return json({ error: "storage_path missing" }, 400);
      const { bytes } = await downloadFile(sb, imp.storage_path);
      const text = new TextDecoder().decode(bytes);
      result = imp.source_type === "csv"
        ? await parseCsvSource(text)
        : await parseTextSource(text);
    } else if (imp.source_type === "image") {
      if (!imp.storage_path) return json({ error: "storage_path missing" }, 400);
      const { bytes, mime } = await downloadFile(sb, imp.storage_path);
      result = await parseImageSource(bytes, mime);
    } else if (imp.source_type === "pdf") {
      if (!imp.storage_path) return json({ error: "storage_path missing" }, 400);
      const { bytes } = await downloadFile(sb, imp.storage_path);
      result = await parsePdfSource(bytes);
    } else if (imp.source_type === "xlsx") {
      if (!imp.storage_path) return json({ error: "storage_path missing" }, 400);
      const { bytes } = await downloadFile(sb, imp.storage_path);
      result = await parseXlsxSource(bytes);
    } else if (imp.source_type === "contacts") {
      throw new Error("Contacts import: not implemented yet.");
    } else {
      throw new Error(`unsupported source_type: ${imp.source_type}`);
    }

    const parsed = result.rows;
    detectDuplicates(parsed);
    await writeParsed(sb, imp.business_id, imp.id, parsed);

    await sb.from("customer_imports").update({
      parse_status: "parsed",
      raw_row_count: parsed.length,
      archetype: result.archetype,
      parse_error: null,
    }).eq("id", importId);

    return json({ ok: true, count: parsed.length, archetype: result.archetype });
  } catch (err) {
    const msg = (err as Error).message ?? "unknown error";
    await sb.from("customer_imports").update({
      parse_status: "failed",
      parse_error: msg,
    }).eq("id", importId);
    return json({ error: msg }, 500);
  }
});
