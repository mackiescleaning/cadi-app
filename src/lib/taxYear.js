// src/lib/taxYear.js
// Cadi — UK tax year helpers
// The UK tax year runs 6 April → 5 April. All HMRC dates derive from these helpers.
// Never hardcode dates — they go stale and silently break tax calculations.

/** Today's date as ISO string (YYYY-MM-DD), UTC-stable. */
export function today() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * The current UK tax year starting calendar year.
 * e.g. on 5 April 2027 → 2026 (tax year 2026/27 is still running)
 *      on 6 April 2027 → 2027 (new tax year 2027/28 starts)
 */
export function currentTaxYear(now = new Date()) {
  const y = now.getFullYear();
  const m = now.getMonth() + 1; // 1-12
  const d = now.getDate();
  if (m < 4 || (m === 4 && d < 6)) return y - 1;
  return y;
}

/** YTD start date for the current tax year (ISO string). */
export function taxYearStart(year = currentTaxYear()) {
  return `${year}-04-06`;
}

/** YTD end date for the current tax year (ISO string). */
export function taxYearEnd(year = currentTaxYear()) {
  return `${year + 1}-04-05`;
}

/** Display label like "2026/27" for a tax year starting year. */
export function taxYearLabel(year = currentTaxYear()) {
  return `${year}/${String((year + 1) % 100).padStart(2, '0')}`;
}

/** Parse "2026/27" → 2026. Returns null for invalid input. */
export function parseTaxYearLabel(label) {
  const m = /^(\d{4})\/(\d{2})$/.exec(label ?? '');
  if (!m) return null;
  return Number(m[1]);
}

/** Last N tax year labels including current, newest last. */
export function recentTaxYears(n = 3, now = new Date()) {
  const current = currentTaxYear(now);
  const out = [];
  for (let i = n - 1; i >= 0; i--) out.push(taxYearLabel(current - i));
  return out;
}

/** UK tax quarter bounds for a given tax year. */
export function taxQuarterBounds(year = currentTaxYear()) {
  return {
    Q1: { start: `${year}-04-06`,     end: `${year}-07-05` },
    Q2: { start: `${year}-07-06`,     end: `${year}-10-05` },
    Q3: { start: `${year}-10-06`,     end: `${year + 1}-01-05` },
    Q4: { start: `${year + 1}-01-06`, end: `${year + 1}-04-05` },
  };
}
