// src/lib/saPack.js
// Cadi — Self Assessment / accountant export pack
// Builds the year-end figures (SA103F box-by-box for sole traders, P&L + CT
// estimate for Ltd companies) from the useYtdIncome/useYtdExpenses hook shapes,
// and exports them as CSV download or a print-ready summary window.
//
// No PDF library — the "PDF" export opens a styled print window; every browser
// offers "Save as PDF" from there. Zero deps, works offline.

import { CATEGORY_TO_SA103 } from '../hooks/useYtdExpenses';
import { taxYearLabel, taxQuarterBounds } from './taxYear';
import { calcSelfEmployedTax, calculateCT } from './taxCalc';

/**
 * Build the pack model.
 * @param {object} p
 * @param {number} p.taxYearNum   - tax year starting year, e.g. 2026 for 2026/27
 * @param {object} p.income       - useYtdIncome result ({ ytdTotal, byQuarter, bySource })
 * @param {object} p.expenses     - useYtdExpenses result ({ ytdTotal, byQuarter, byCategory })
 * @param {string} p.entityType   - 'sole_trader' | 'limited_company'
 */
export function buildSaPack({ taxYearNum, income, expenses, entityType = 'sole_trader' }) {
  const label = taxYearLabel(taxYearNum);
  const bounds = taxQuarterBounds(taxYearNum);

  // Group expense categories into SA103 boxes
  const boxMap = new Map(); // box -> { box, label, amount, cats: [] }
  for (const [cat, amount] of Object.entries(expenses.byCategory ?? {})) {
    if (!amount) continue;
    const m = CATEGORY_TO_SA103[cat] ?? CATEGORY_TO_SA103.other;
    if (!boxMap.has(m.box)) boxMap.set(m.box, { box: m.box, label: m.label, amount: 0, cats: [] });
    const row = boxMap.get(m.box);
    row.amount += amount;
    row.cats.push(cat);
  }
  const boxRows = Array.from(boxMap.values())
    .sort((a, b) => a.box.localeCompare(b.box, undefined, { numeric: true }));

  const turnover      = income.ytdTotal ?? 0;
  const totalExpenses = expenses.ytdTotal ?? 0;
  const profit        = turnover - totalExpenses;

  const quarters = ['Q1', 'Q2', 'Q3', 'Q4'].map(q => ({
    q,
    start:    bounds[q].start,
    end:      bounds[q].end,
    income:   income.byQuarter?.[q] ?? 0,
    expenses: expenses.byQuarter?.[q] ?? 0,
  }));

  const isLtd = entityType === 'limited_company';
  const tax = isLtd
    ? { ct: calculateCT(profit) }
    : calcSelfEmployedTax(profit);

  return { label, taxYearNum, entityType, isLtd, turnover, totalExpenses, profit, boxRows, quarters, tax };
}

const money = (n) => (Math.round((Number(n) || 0) * 100) / 100).toFixed(2);
const csvEscape = (s) => /[",\n]/.test(String(s)) ? `"${String(s).replace(/"/g, '""')}"` : String(s);

/** Pack → CSV string (Xero/QuickBooks-friendly flat rows). */
export function saPackToCsv(pack) {
  const rows = [
    ['Cadi export', pack.isLtd ? 'Limited company P&L' : 'Self Assessment (SA103F) pack'],
    ['Tax year', pack.label],
    [],
    ['Section', 'Box', 'Description', 'Amount (GBP)'],
    ['Income', pack.isLtd ? '' : 'Box 15', 'Turnover — sales & services', money(pack.turnover)],
    ...pack.boxRows.map(r => ['Expenses', pack.isLtd ? '' : r.box, r.label, money(r.amount)]),
    ['Expenses', '', 'Total allowable expenses', money(pack.totalExpenses)],
    ['Profit', '', pack.isLtd ? 'Profit before Corporation Tax' : 'Net profit (turnover − expenses)', money(pack.profit)],
    ...(pack.isLtd
      ? [['Tax', '', 'Estimated Corporation Tax', money(pack.tax.ct)]]
      : [
          ['Tax', '', 'Estimated income tax', money(pack.tax.incomeTax)],
          ['Tax', '', 'Estimated Class 4 NI', money(pack.tax.ni)],
          ['Tax', '', 'Estimated total tax', money(pack.tax.total)],
        ]),
    [],
    ['Quarter', 'Period', 'Income (GBP)', 'Expenses (GBP)'],
    ...pack.quarters.map(q => [q.q, `${q.start} to ${q.end}`, money(q.income), money(q.expenses)]),
  ];
  return rows.map(r => r.map(csvEscape).join(',')).join('\n');
}

/** Trigger a browser download of a CSV string. */
export function downloadCsv(filename, csv) {
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Pack → print-ready HTML (opened in a new window; user prints / saves as PDF). */
export function saPackToPrintableHtml(pack, businessName = '') {
  const fmtQ = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const taxRows = pack.isLtd
    ? `<tr><td>Estimated Corporation Tax</td><td class="num">£${money(pack.tax.ct)}</td></tr>`
    : `<tr><td>Estimated income tax</td><td class="num">£${money(pack.tax.incomeTax)}</td></tr>
       <tr><td>Estimated Class 4 National Insurance</td><td class="num">£${money(pack.tax.ni)}</td></tr>
       <tr class="total"><td>Estimated total tax</td><td class="num">£${money(pack.tax.total)}</td></tr>`;
  return `<!doctype html><html><head><meta charset="utf-8">
<title>${pack.isLtd ? 'P&L pack' : 'Self Assessment pack'} ${pack.label}</title>
<style>
  body { font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; color: #111; margin: 40px; }
  h1 { font-size: 20px; margin: 0 0 2px; }
  .sub { color: #666; font-size: 12px; margin-bottom: 24px; }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.06em; color: #444; margin: 24px 0 8px; }
  table { border-collapse: collapse; width: 100%; font-size: 13px; }
  td, th { padding: 6px 10px; border-bottom: 1px solid #e5e5e5; text-align: left; }
  th { font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: #666; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .total td { font-weight: 700; border-top: 2px solid #111; }
  .note { margin-top: 28px; font-size: 11px; color: #888; line-height: 1.5; }
  @media print { body { margin: 16px; } }
</style></head><body>
  <h1>${businessName ? businessName + ' — ' : ''}${pack.isLtd ? 'Profit & Loss pack' : 'Self Assessment pack (SA103F)'}</h1>
  <p class="sub">Tax year ${pack.label} · Generated by Cadi · app.cadi.cleaning</p>

  <h2>Income</h2>
  <table>
    <tr><td>${pack.isLtd ? '' : '<strong>Box 15</strong> · '}Turnover — sales & services</td><td class="num">£${money(pack.turnover)}</td></tr>
  </table>

  <h2>Allowable expenses</h2>
  <table>
    ${pack.boxRows.map(r => `<tr><td>${pack.isLtd ? '' : `<strong>${r.box}</strong> · `}${r.label}</td><td class="num">£${money(r.amount)}</td></tr>`).join('')}
    <tr class="total"><td>Total allowable expenses</td><td class="num">£${money(pack.totalExpenses)}</td></tr>
  </table>

  <h2>Profit & estimated tax</h2>
  <table>
    <tr class="total"><td>${pack.isLtd ? 'Profit before Corporation Tax' : 'Net profit'}</td><td class="num">£${money(pack.profit)}</td></tr>
    ${taxRows}
  </table>

  <h2>Quarterly breakdown (MTD periods)</h2>
  <table>
    <tr><th>Quarter</th><th>Period</th><th class="num">Income</th><th class="num">Expenses</th></tr>
    ${pack.quarters.map(q => `<tr><td>${q.q}</td><td>${fmtQ(q.start)} – ${fmtQ(q.end)}</td><td class="num">£${money(q.income)}</td><td class="num">£${money(q.expenses)}</td></tr>`).join('')}
  </table>

  <p class="note">
    Figures are drawn from invoices marked paid, bank transactions categorised as business, and manual
    entries recorded in Cadi for the ${pack.label} tax year. Estimated tax uses current-year rates and
    is a guide, not advice — confirm final figures with your accountant before filing.
  </p>
</body></html>`;
}

/** Open the printable pack in a new window and trigger the print dialog. */
export function openPrintablePack(html) {
  const w = window.open('', '_blank', 'noopener,width=900,height=1100');
  if (!w) throw new Error('Pop-up blocked — allow pop-ups for this site to export the PDF pack.');
  w.document.write(html);
  w.document.close();
  // Give the window a beat to render before the print dialog
  setTimeout(() => { try { w.focus(); w.print(); } catch { /* user closed it */ } }, 350);
}
