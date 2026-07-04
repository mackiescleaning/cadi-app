// @vitest-environment jsdom
//
// Invoice VAT/total math and PDF generation. These numbers go on a legal UK
// invoice and into the customer's inbox — an off-by-a-penny VAT bug is a real
// problem, so the arithmetic is pinned here.

import { describe, it, expect } from 'vitest';
import { calcTotals, generateInvoicePdf } from './invoicePdf.js';

describe('calcTotals', () => {
  it('returns zeros for no lines', () => {
    expect(calcTotals([])).toEqual({ subtotal: 0, vatAmount: 0, total: 0 });
  });

  it('multiplies qty × rate with no VAT', () => {
    const t = calcTotals([{ qty: 2, rate: 25, vatRate: 0 }]);
    expect(t.subtotal).toBe(50);
    expect(t.vatAmount).toBe(0);
    expect(t.total).toBe(50);
  });

  it('applies a per-line VAT rate', () => {
    const t = calcTotals([{ qty: 1, rate: 100, vatRate: 20 }]);
    expect(t.subtotal).toBe(100);
    expect(t.vatAmount).toBeCloseTo(20, 10);
    expect(t.total).toBeCloseTo(120, 10);
  });

  it('sums multiple lines with mixed VAT rates', () => {
    const t = calcTotals([
      { qty: 2, rate: 50, vatRate: 20 }, // 100 net, 20 vat
      { qty: 1, rate: 30, vatRate: 0 }, //  30 net,  0 vat
    ]);
    expect(t.subtotal).toBe(130);
    expect(t.vatAmount).toBeCloseTo(20, 10);
    expect(t.total).toBeCloseTo(150, 10);
  });

  it('coerces string numbers (form inputs arrive as strings)', () => {
    const t = calcTotals([{ qty: '3', rate: '10.50', vatRate: '20' }]);
    expect(t.subtotal).toBeCloseTo(31.5, 10);
    expect(t.vatAmount).toBeCloseTo(6.3, 10);
    expect(t.total).toBeCloseTo(37.8, 10);
  });

  it('treats missing/invalid qty, rate and vatRate as zero, not NaN', () => {
    const t = calcTotals([{ desc: 'no numbers' }, { qty: 'x', rate: 'y', vatRate: 'z' }]);
    expect(t.subtotal).toBe(0);
    expect(t.vatAmount).toBe(0);
    expect(t.total).toBe(0);
    expect(Number.isNaN(t.total)).toBe(false);
  });

  it('defaults a missing vatRate to no VAT', () => {
    const t = calcTotals([{ qty: 1, rate: 200 }]);
    expect(t.subtotal).toBe(200);
    expect(t.vatAmount).toBe(0);
    expect(t.total).toBe(200);
  });
});

describe('generateInvoicePdf', () => {
  const invoice = {
    num: 'INV-2026-001',
    date: '2026-07-01',
    dueDate: '2026-07-15',
    customer: { name: 'Britannia', address: '1 High St, London', email: 'ap@britannia.example' },
    lines: [{ desc: 'Monthly clean', qty: 1, rate: 100, vatRate: 20 }],
  };
  const business = { name: 'Sparkle Co', address: '2 Mill Rd, Leeds', vatNumber: 'GB123' };

  it('returns non-empty base64 and a sanitised filename', () => {
    const { base64, filename } = generateInvoicePdf(invoice, business, { vatRegistered: true });
    expect(typeof base64).toBe('string');
    expect(base64.length).toBeGreaterThan(100);
    expect(filename).toBe('INV-2026-001.pdf');
  });

  it('strips unsafe characters out of the filename', () => {
    const { filename } = generateInvoicePdf({ ...invoice, num: 'INV/2026\\09 #7' }, business, {});
    expect(filename).toBe('INV_2026_09__7.pdf');
    expect(filename).not.toMatch(/[/\\#]/);
  });

  it('falls back to a default filename when the invoice has no number', () => {
    const { filename } = generateInvoicePdf({ ...invoice, num: undefined }, business, {});
    expect(filename).toBe('invoice.pdf');
  });

  it('produces a real PDF (base64 decodes to a %PDF header)', () => {
    const { base64 } = generateInvoicePdf(invoice, business, { vatRegistered: true });
    const header = atob(base64).slice(0, 5);
    expect(header).toBe('%PDF-');
  });
});
