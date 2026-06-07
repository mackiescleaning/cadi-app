// src/lib/taxCalc.js
// Cadi — UK tax calculations, shared between Money tab and Accounting tab so
// both views always agree on the tax bill the user is staring at.
//
// Sources:
//   - 2025/26 self-employed bands: gov.uk/income-tax-rates
//   - 2025/26 Class 4 NI: gov.uk/self-employed-national-insurance-rates
//   - Corporation tax 2025/26 + marginal relief: gov.uk/corporation-tax-rates
//
// Whenever HMRC publishes new bands, update the constants below — do not
// duplicate them in any tab.

// ─── Self-employed (sole trader / partner) ──────────────────────────────────
export const PERSONAL_ALLOWANCE      = 12570;
export const BASIC_RATE_THRESHOLD    = 50270;   // total income, not above-PA
export const HIGHER_RATE_THRESHOLD   = 125140;  // PA tapers to zero
export const BASIC_RATE              = 0.20;
export const HIGHER_RATE             = 0.40;
export const ADDITIONAL_RATE         = 0.45;

// Class 4 NI (paid via SA — Class 2 abolished from April 2024)
export const NI_LOWER_PROFITS_LIMIT  = 12570;   // aligned with PA
export const NI_UPPER_PROFITS_LIMIT  = 50270;   // aligned with BRT
export const NI_RATE_MAIN            = 0.06;
export const NI_RATE_ADDITIONAL      = 0.02;

/**
 * Calculate income tax + Class 4 NI for a self-employed profit.
 * Accounts for personal allowance and the basic/higher/additional bands.
 * Above £125,140 the personal allowance is fully tapered.
 *
 * @param {number} profit - annual taxable profit (income − allowable expenses)
 * @returns {{ incomeTax: number, ni: number, total: number, effectivePA: number }}
 */
export function calcSelfEmployedTax(profit) {
  const p = Math.max(0, Number(profit) || 0);

  // PA taper: lose £1 for every £2 above £100k. Fully gone at £125,140.
  const PA_TAPER_START = 100_000;
  const effectivePA = p > PA_TAPER_START
    ? Math.max(0, PERSONAL_ALLOWANCE - (p - PA_TAPER_START) / 2)
    : PERSONAL_ALLOWANCE;

  const taxable = Math.max(0, p - effectivePA);

  let incomeTax = 0;
  const basicSpan  = Math.max(0, BASIC_RATE_THRESHOLD - effectivePA);
  const higherSpan = Math.max(0, HIGHER_RATE_THRESHOLD - BASIC_RATE_THRESHOLD);

  if (taxable <= basicSpan) {
    incomeTax = taxable * BASIC_RATE;
  } else if (taxable <= basicSpan + higherSpan) {
    incomeTax = basicSpan * BASIC_RATE + (taxable - basicSpan) * HIGHER_RATE;
  } else {
    incomeTax = basicSpan * BASIC_RATE
              + higherSpan * HIGHER_RATE
              + (taxable - basicSpan - higherSpan) * ADDITIONAL_RATE;
  }

  // Class 4 NI is on profit (not taxable income), still uses PA-aligned lower limit
  let ni = 0;
  const niBase    = Math.max(0, p - NI_LOWER_PROFITS_LIMIT);
  const niMainSpan = NI_UPPER_PROFITS_LIMIT - NI_LOWER_PROFITS_LIMIT;
  if (niBase <= niMainSpan) {
    ni = niBase * NI_RATE_MAIN;
  } else {
    ni = niMainSpan * NI_RATE_MAIN + (niBase - niMainSpan) * NI_RATE_ADDITIONAL;
  }

  return {
    incomeTax:   Math.round(incomeTax),
    ni:          Math.round(ni),
    total:       Math.round(incomeTax + ni),
    effectivePA: Math.round(effectivePA),
  };
}

// ─── Limited company (Corporation Tax) ──────────────────────────────────────
export const CT_SMALL_RATE          = 0.19;  // profit ≤ £50,000
export const CT_MAIN_RATE           = 0.25;  // profit ≥ £250,000
export const CT_MARGINAL_RATE       = 0.265; // marginal-relief band
export const CT_MARGINAL_DEDUCTION  = 3750;  // marginal relief flat deduction
export const CT_SMALL_THRESHOLD     = 50_000;
export const CT_MAIN_THRESHOLD      = 250_000;

/**
 * Calculate UK Corporation Tax with marginal relief band.
 * @param {number} profit - annual taxable profit
 * @returns {number} CT due (rounded to whole pounds)
 */
export function calculateCT(profit) {
  const p = Math.max(0, Number(profit) || 0);
  if (p === 0) return 0;
  if (p <= CT_SMALL_THRESHOLD)  return Math.round(p * CT_SMALL_RATE);
  if (p >= CT_MAIN_THRESHOLD)   return Math.round(p * CT_MAIN_RATE);
  return Math.round(p * CT_MARGINAL_RATE - CT_MARGINAL_DEDUCTION);
}
