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

// ─── Director: salary + dividends (personal tax) ────────────────────────────
export const DIVIDEND_ALLOWANCE   = 500;    // 2025/26 dividend allowance
export const DIV_BASIC_RATE       = 0.0875;
export const DIV_HIGHER_RATE      = 0.3375;
export const DIV_ADDITIONAL_RATE  = 0.3935;

/**
 * Personal tax on a director's salary + dividends for one tax year.
 * Salary uses the personal allowance first; dividends stack on top of salary
 * for band purposes. The £500 dividend allowance is 0%-rated but still uses
 * band space. Employee NI is ignored (typical director salary ≤ £12,570 pays
 * none) — this is a set-aside guide, not a payroll calculation.
 *
 * @param {number} salary    - annual gross director salary
 * @param {number} dividends - dividends taken in the tax year
 * @returns {{ salaryTax: number, dividendTax: number, total: number }}
 */
export function calcSalaryDividendTax(salary, dividends) {
  const s = Math.max(0, Number(salary) || 0);
  const d = Math.max(0, Number(dividends) || 0);

  // PA taper on total income (salary + dividends both count)
  const totalIncome = s + d;
  const PA_TAPER_START = 100_000;
  const pa = totalIncome > PA_TAPER_START
    ? Math.max(0, PERSONAL_ALLOWANCE - (totalIncome - PA_TAPER_START) / 2)
    : PERSONAL_ALLOWANCE;

  const basicSpan  = BASIC_RATE_THRESHOLD - PERSONAL_ALLOWANCE;              // £37,700
  const higherSpan = HIGHER_RATE_THRESHOLD - BASIC_RATE_THRESHOLD;

  // Salary first: PA covers it, remainder through the normal bands
  const salaryTaxable = Math.max(0, s - pa);
  let salaryTax = 0;
  if (salaryTaxable <= basicSpan) salaryTax = salaryTaxable * BASIC_RATE;
  else if (salaryTaxable <= basicSpan + higherSpan) salaryTax = basicSpan * BASIC_RATE + (salaryTaxable - basicSpan) * HIGHER_RATE;
  else salaryTax = basicSpan * BASIC_RATE + higherSpan * HIGHER_RATE + (salaryTaxable - basicSpan - higherSpan) * ADDITIONAL_RATE;

  // Dividends: leftover PA first, then the £500 allowance (0% but uses band
  // space), then taxed by where they sit in the bands above the salary.
  const paLeft = Math.max(0, pa - s);
  const divAfterPa = Math.max(0, d - paLeft);
  const divTaxable = Math.max(0, divAfterPa - DIVIDEND_ALLOWANCE);
  // Band position already used by salary + the 0%-rated dividend slice
  let pos = salaryTaxable + Math.min(divAfterPa, DIVIDEND_ALLOWANCE);
  let remaining = divTaxable;
  let dividendTax = 0;
  const bands = [
    { upTo: basicSpan,              rate: DIV_BASIC_RATE },
    { upTo: basicSpan + higherSpan, rate: DIV_HIGHER_RATE },
    { upTo: Infinity,               rate: DIV_ADDITIONAL_RATE },
  ];
  for (const { upTo, rate } of bands) {
    if (remaining <= 0) break;
    const room = Math.max(0, upTo - pos);
    const slice = Math.min(remaining, room);
    dividendTax += slice * rate;
    pos += slice; remaining -= slice;
  }

  return {
    salaryTax:   Math.round(salaryTax),
    dividendTax: Math.round(dividendTax),
    total:       Math.round(salaryTax + dividendTax),
  };
}
