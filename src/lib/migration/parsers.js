// parsers.js — pure helpers for messy migration data
// Shared by CustomerImport, ServiceChat, AddCustomerModal.
//
// Goals (audit + founder direction):
//   • Cleaner-Planner-grade migration depth — handle every quirk competitors leak.
//   • Pure functions, fully testable, no I/O.

// ── Frequency ─────────────────────────────────────────────────────────────────
// Worded numbers, common UK phrasing, and competitor shorthand.

const NUMBER_WORDS = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, twelve: 12,
};

// Return { freq, interval, days } — freq is 'one-off' | 'daily' | 'weekly' | 'monthly'
// `days` is a flat day-count for legacy parseFrequencyDays parity.
// Returns null if unparseable.
export function parseFrequency(input) {
  if (input == null) return null;
  const s = String(input).toLowerCase().trim();
  if (!s) return null;

  if (/(one\s*[- ]?off|adhoc|ad\s*hoc|once|single visit)/.test(s)) {
    return { freq: 'one-off', interval: 1, days: 0 };
  }

  // "daily" / "every day" / "every weekday"
  if (/^(daily|every\s+day|each\s+day)$/.test(s)) return { freq: 'daily', interval: 1, days: 1 };
  if (/^(weekdays?|every\s+weekday|mon\s*[-–]\s*fri|monday\s+to\s+friday)$/.test(s)) {
    return { freq: 'daily', interval: 1, days: 1 };
  }

  // "every N days" — worded or digit
  const dayMatch = s.match(/every\s+(\d+|[a-z]+)\s+days?/);
  if (dayMatch) {
    const n = parseCount(dayMatch[1]);
    if (n > 0) return { freq: 'daily', interval: n, days: n };
  }

  // "weekly" / "every week"
  if (/^(weekly|every\s+week)$/.test(s)) return { freq: 'weekly', interval: 1, days: 7 };

  // "fortnightly" / "biweekly" / "bi-weekly" / "every fortnight" / "every other week"
  if (/(fortnightly|biweekly|bi[-\s]?weekly|every\s+(?:other|2nd|second)\s+week|every\s+fortnight)/.test(s)) {
    return { freq: 'weekly', interval: 2, days: 14 };
  }

  // "monthly" / "every month" / "4 weekly"
  if (/^(monthly|every\s+month)$/.test(s)) return { freq: 'monthly', interval: 1, days: 30 };
  if (/^(4\s*weekly|four\s*weekly|every\s+4\s+weeks|every\s+four\s+weeks)$/.test(s)) {
    return { freq: 'weekly', interval: 4, days: 28 };
  }

  // "twice monthly" / "bi-monthly" (ambiguous — treat as every 2 weeks per UK norms)
  if (/(twice[-\s]+monthly|2[-\s]*x\s*month|bi[-\s]?monthly)/.test(s)) {
    return { freq: 'weekly', interval: 2, days: 14 };
  }

  // "every N weeks" / "every two weeks" — worded or digit
  const wkMatch = s.match(/every\s+(\d+|[a-z]+)\s+weeks?/);
  if (wkMatch) {
    const n = parseCount(wkMatch[1]);
    if (n > 0) return { freq: 'weekly', interval: n, days: 7 * n };
  }

  // "every N months" / "every two months" — convert to Cadi-native
  // weekly cadence (cleaners think in 4-week months, not calendar months,
  // because the route doesn't care about calendar drift).
  const moMatch = s.match(/every\s+(\d+|[a-z]+)\s+months?/);
  if (moMatch) {
    const n = parseCount(moMatch[1]);
    if (n > 0) return { freq: 'weekly', interval: n * 4, days: 28 * n };
  }

  // "N weekly" — "6 weekly", "12 weekly"
  const nWk = s.match(/^(\d+)\s*weekly$/);
  if (nWk) {
    const n = parseInt(nWk[1], 10);
    if (n > 0) return { freq: 'weekly', interval: n, days: 7 * n };
  }

  // Generic "N weeks" / "N week" / "N wk" / "N w" — \b kept for short
  // forms; plural "weeks" handled via `s?`.
  const generic = s.match(/(\d+)\s*(weeks?|wk|w\b)/);
  if (generic) {
    const n = parseInt(generic[1], 10);
    if (n > 0) return { freq: 'weekly', interval: n, days: 7 * n };
  }

  // Generic "N months" / "N month" / "N mo" — converted to weekly per
  // cleaning-industry convention (1 month = 4 weeks).
  const genericMo = s.match(/(\d+)\s*(months?|mo\b)/);
  if (genericMo) {
    const n = parseInt(genericMo[1], 10);
    if (n > 0) return { freq: 'weekly', interval: n * 4, days: 28 * n };
  }

  return null;
}

// Back-compat shim for callers that just want the day-count
export function parseFrequencyDays(input) {
  const f = parseFrequency(input);
  return f ? f.days : null;
}

function parseCount(token) {
  const n = parseInt(token, 10);
  if (!isNaN(n)) return n;
  return NUMBER_WORDS[token] ?? 0;
}

// ── Currency / balance with CR / DR suffix ────────────────────────────────────
// Returns a signed number: credit (CR) → positive (customer overpaid),
// debit (DR) → negative (customer owes). Strips currency symbols and commas.
// Returns null when truly unparseable; 0 when value present but zero.

export function parseBalance(input) {
  if (input == null) return null;
  const s = String(input).trim();
  if (!s || s === '-') return null;

  const upper = s.toUpperCase();
  const hasCR = /\b(CR|CREDIT)\b/.test(upper);
  const hasDR = /\b(DR|DEBIT|OWING|OWED|DUE)\b/.test(upper);

  // Pull the first signed-ish number
  const m = s.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  if (!m) return null;
  let n = parseFloat(m[0]);
  if (isNaN(n)) return null;

  // CR = customer is in credit (positive). DR = customer owes (negative).
  // If the raw number was already negative, treat it as authoritative.
  if (n > 0 && hasDR) n = -n;
  if (n < 0 && hasCR) n = -n;
  return n;
}

// ── UK postcode normaliser ────────────────────────────────────────────────────
// Uppercase, single space between outward/inward.
// "sw191aa" → "SW19 1AA", "EC1A 1BB" → "EC1A 1BB", invalid → null.

const POSTCODE_RE = /^([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})$/i;

export function normalisePostcode(input) {
  if (!input) return null;
  const collapsed = String(input).replace(/\s+/g, '').toUpperCase();
  if (collapsed.length < 5 || collapsed.length > 7) return null;
  // Re-insert space before the last 3 chars (the inward code)
  const candidate = `${collapsed.slice(0, -3)} ${collapsed.slice(-3)}`;
  const m = candidate.match(POSTCODE_RE);
  return m ? `${m[1].toUpperCase()} ${m[2].toUpperCase()}` : null;
}

// ── Address splitter ──────────────────────────────────────────────────────────
// Splits a single-field address into structured parts. Pulls a UK postcode
// off the tail first; remaining parts are split by comma into line1, line2,
// town, county (best-effort, tolerant of varying part counts).

export function splitAddress(input) {
  if (!input) return { addressLine1: null, addressLine2: null, town: null, county: null, postcode: null };
  const raw = String(input).trim();
  if (!raw) return { addressLine1: null, addressLine2: null, town: null, county: null, postcode: null };

  // Find a trailing postcode anywhere in the string (start of an OUTCODE pattern)
  const pcMatch = raw.toUpperCase().match(/([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\s*$/);
  let bodyForParts = raw;
  let postcode = null;
  if (pcMatch) {
    postcode = normalisePostcode(pcMatch[1]);
    bodyForParts = raw.slice(0, pcMatch.index).replace(/[, ]+$/, '');
  }

  const parts = bodyForParts
    .split(',')
    .map(p => p.trim())
    .filter(Boolean);

  // Heuristic: from the right, the last part is county (if there are ≥3),
  // the second-from-last is town. Everything before is address lines.
  let addressLine1 = null, addressLine2 = null, town = null, county = null;

  if (parts.length >= 4) {
    county       = parts[parts.length - 1];
    town         = parts[parts.length - 2];
    addressLine2 = parts[parts.length - 3];
    addressLine1 = parts.slice(0, parts.length - 3).join(', ');
  } else if (parts.length === 3) {
    town         = parts[2];
    addressLine2 = parts[1];
    addressLine1 = parts[0];
  } else if (parts.length === 2) {
    town         = parts[1];
    addressLine1 = parts[0];
  } else if (parts.length === 1) {
    addressLine1 = parts[0];
  }

  return { addressLine1, addressLine2, town, county, postcode };
}

// ── Plain currency ────────────────────────────────────────────────────────────
// Lenient numeric parse for price/amount cells. Strips currency symbols and any
// non-numeric noise. "quote" and empty → null (no price yet). Unlike parseBalance
// it has no CR/DR sign logic — use it for prices, not balances.

export function parseCurrency(str) {
  if (!str) return null;
  const s = String(str).trim();
  if (s.toLowerCase() === 'quote' || s === '') return null;
  const n = parseFloat(s.replace(/[^0-9.-]/g, ''));
  return isNaN(n) ? null : n;
}

// ── Cleaner-industry date parser ──────────────────────────────────────────────
// Normalises the many date shapes competitor exports leak (ISO, Excel serials,
// DD/MM/YYYY, DD-MM-YY, "1st Jun 2026", Date objects) to an ISO YYYY-MM-DD string.
// Returns null for blanks and non-dates ("-", "n/a", "overdue").

const MONTH_MAP = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

export function parseCleanerDate(val) {
  if (!val) return null;

  // Already a JS Date object (XLSX parses Excel date cells as Date objects)
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    return val.toISOString().slice(0, 10);
  }

  const s = String(val).trim();
  if (!s || s === '-' || s.toLowerCase() === 'n/a' || s.toLowerCase() === 'overdue') return null;

  // ISO: YYYY-MM-DD (already normalised)
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);

  // Excel serial number (e.g. 46983 — days since 1900-01-01)
  if (/^\d{5}$/.test(s)) {
    const serial = Number(s);
    // Excel epoch: Dec 31 1899 (with Lotus leap-year bug offset 1)
    const d = new Date(Date.UTC(1899, 11, 31) + serial * 86400000);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }

  // DD/MM/YYYY or DD/MM/YY
  const slash = s.split('/');
  if (slash.length === 3) {
    const [d, m, y] = slash;
    const year = y.length === 2 ? `20${y}` : y;
    const result = `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    if (/^\d{4}-\d{2}-\d{2}$/.test(result)) return result;
  }

  // DD-MM-YYYY or DD-MM-YY (dash separated, day first)
  const dash = s.split('-');
  if (dash.length === 3 && dash[0].length <= 2 && isNaN(Number(dash[1])) === false) {
    const [d, m, y] = dash;
    const year = y.length === 2 ? `20${y}` : y;
    const result = `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    if (/^\d{4}-\d{2}-\d{2}$/.test(result)) return result;
  }

  // D MMM YYYY or DD MMM YY  (e.g. "1 Jun 2026", "01 Jun 26", "1st Jun 2026")
  const named = s.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]{3})[a-z]*[\s,]+(\d{2,4})$/i);
  if (named) {
    const d = named[1];
    const m = MONTH_MAP[named[2].toLowerCase()];
    const yr = named[3].length === 2 ? `20${named[3]}` : named[3];
    if (m) return `${yr}-${String(m).padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // Fallback: let JS Date try to parse it (handles "Thu Jun 05 2026 00:00:00 GMT+…")
  const js = new Date(s);
  if (!isNaN(js.getTime())) return js.toISOString().slice(0, 10);

  return null;
}

// ── Source detectors ──────────────────────────────────────────────────────────
// Each takes a normalised array of lowercased headers and returns true if the
// file looks like an export from that source. Order from most-specific to least.

export function detectSource(headers = []) {
  const lower = headers.map(h => String(h).toLowerCase().trim());
  const has = (...ks) => ks.every(k => lower.includes(k));
  const someIncludes = (k) => lower.some(h => h.includes(k));

  // CleanerPlanner Jobs export — owns cust ref + round + job ref
  if (has('cust ref', 'round', 'job ref')) return 'cleaner-planner';

  // QuickBooks Customer Contact List — "bill to" or "open balance" with customer/company
  if ((someIncludes('bill to') || someIncludes('open balance') || someIncludes('billing address'))
      && (someIncludes('customer') || someIncludes('company'))) {
    return 'quickbooks';
  }

  // Squeegee — distinctive: "round name" + "next due" + "balance"
  if (has('round name', 'next due') && lower.some(h => h.includes('balance'))) return 'squeegee';

  // Aworka — "customer code" + "round" + "frequency"
  if (has('customer code') && lower.some(h => h.includes('round')) && lower.some(h => h.includes('frequency'))) {
    return 'aworka';
  }

  // Jobber CSV (Customers) — owns "client" terminology + their own ref
  if (lower.some(h => h.includes('client')) && lower.some(h => h.includes('property')) && lower.includes('client id')) {
    return 'jobber';
  }

  // ServiceM8 — "company name" + "site address" + their own job number column
  if (lower.some(h => h.includes('company name')) && lower.some(h => h.includes('site address'))) {
    return 'servicem8';
  }

  // Housecall Pro — "customer first name" + "customer last name"
  if (lower.includes('customer first name') && lower.includes('customer last name')) return 'housecall-pro';

  return null;
}
