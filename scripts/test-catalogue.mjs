// Catalogue seam acceptance — Phase D self-test.
// Run: `npm run test:catalogue`. Exits 1 on any failed assertion.
//
// Tests quotePrice against:
//   1. The proven Mackies catalogue from the spec §2 (the truth target)
//   2. Every branch of every pricing model
//   3. The enquiry-floor invariant (must override everything)
//
// Imports the published quotePrice module directly — same code path used by
// the Front Desk widget, scheduler, portal, quoter and reports.

import { strict as assert } from 'node:assert';
import { quotePrice } from '../src/lib/catalogue/quotePrice.js';

let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed++;
    process.stdout.write(`  ✓ ${name}\n`);
  } catch (err) {
    failed++;
    failures.push({ name, err });
    process.stdout.write(`  ✗ ${name}\n    ${err.message}\n`);
  }
}

// ── Mackies catalogue from spec §2 ─────────────────────────────────────────
const MACKIES_WINDOW = {
  id: 'svc-window',
  name: 'Window Cleaning',
  division: 'exterior',
  booking_mode: 'quick_quote',
  pricing_model: 'tiered',
  tiers: [
    { key: 'terraced', label: 'Terraced',      price: 10, is_default: false },
    { key: 'semi',     label: 'Semi-detached', price: 22, is_default: true  },
    { key: 'detached', label: 'Detached',      price: 46, is_default: false },
  ],
  modifiers: [
    { key: 'first-clean', label: 'First-clean surcharge', type: 'surcharge', value: 10, default_on: false, sort_order: 1 },
    { key: 'conservatory', label: 'Conservatory add-on', type: 'addon_fixed', value: 5, default_on: false, sort_order: 2 },
  ],
};
const MACKIES_COMMERCIAL = {
  id: 'svc-commercial',
  name: 'Commercial Cleaning Contract',
  division: 'commercial',
  booking_mode: 'enquiry',
  pricing_model: 'quote_only',
  modifiers: [],
};
const MACKIES_ONEOFF = {
  id: 'svc-oneoff',
  name: 'Exterior — One-off',
  division: 'exterior',
  booking_mode: 'enquiry',
  pricing_model: 'quote_only',
  modifiers: [],
};

console.log('\nMackies catalogue (spec §2 target):');
test('Window Cleaning default tier resolves to semi (£22)', () => {
  const { price } = quotePrice(MACKIES_WINDOW);
  assert.equal(price, 22);
});
test('Window Cleaning tier_key=terraced → £10', () => {
  const { price } = quotePrice(MACKIES_WINDOW, { tier_key: 'terraced' });
  assert.equal(price, 10);
});
test('Window Cleaning tier_key=detached → £46', () => {
  const { price } = quotePrice(MACKIES_WINDOW, { tier_key: 'detached' });
  assert.equal(price, 46);
});
test('Window Cleaning + first-clean surcharge → £22 + £10', () => {
  const { price } = quotePrice(MACKIES_WINDOW, { modifiers: ['first-clean'] });
  assert.equal(price, 32);
});
test('Window Cleaning + conservatory add-on → £22 + £5', () => {
  const { price } = quotePrice(MACKIES_WINDOW, { modifiers: ['conservatory'] });
  assert.equal(price, 27);
});
test('Window Cleaning + both modifiers → £22 + £10 + £5', () => {
  const { price } = quotePrice(MACKIES_WINDOW, { modifiers: ['first-clean', 'conservatory'] });
  assert.equal(price, 37);
});
test('Commercial Cleaning Contract → enquiry', () => {
  const { price } = quotePrice(MACKIES_COMMERCIAL);
  assert.equal(price, 'enquiry');
});
test('Exterior — One-off → enquiry', () => {
  const { price } = quotePrice(MACKIES_ONEOFF);
  assert.equal(price, 'enquiry');
});

// ── Branch coverage ────────────────────────────────────────────────────────
console.log('\nPricing model branches:');
test('flat → base price from pricing_config.price', () => {
  const svc = {
    booking_mode: 'instant',
    pricing_model: 'flat',
    pricing_config: { price: 75 },
    modifiers: [],
  };
  assert.equal(quotePrice(svc).price, 75);
});
test('by_unit → units × price_per_unit', () => {
  const svc = {
    booking_mode: 'quick_quote',
    pricing_model: 'by_unit',
    units: [{ unit_type: 'window', price_per_unit: 1.5 }],
    modifiers: [],
  };
  assert.equal(quotePrice(svc, { units: 20 }).price, 30);
});
test('by_unit min_charge top-up applied when below floor', () => {
  const svc = {
    booking_mode: 'quick_quote',
    pricing_model: 'by_unit',
    units: [{ unit_type: 'window', price_per_unit: 1.5, min_charge: 40 }],
    modifiers: [],
  };
  // 20 × 1.5 = 30 < min_charge 40 → top up to 40
  assert.equal(quotePrice(svc, { units: 20 }).price, 40);
});
test('by_unit without units → enquiry (needs selection)', () => {
  const svc = {
    booking_mode: 'quick_quote',
    pricing_model: 'by_unit',
    units: [{ unit_type: 'window', price_per_unit: 1.5 }],
    modifiers: [],
  };
  assert.equal(quotePrice(svc).price, 'enquiry');
});
test('by_frequency picks rate by selection', () => {
  const svc = {
    booking_mode: 'quick_quote',
    pricing_model: 'by_frequency',
    pricing_config: { rates: { weekly: 18, fortnightly: 24, '4weekly': 28 } },
    modifiers: [],
  };
  assert.equal(quotePrice(svc, { frequency: 'weekly' }).price, 18);
  assert.equal(quotePrice(svc, { frequency: 'fortnightly' }).price, 24);
  assert.equal(quotePrice(svc, { frequency: '4weekly' }).price, 28);
});
test('by_frequency without selection → enquiry', () => {
  const svc = {
    booking_mode: 'quick_quote',
    pricing_model: 'by_frequency',
    pricing_config: { rates: { weekly: 18 } },
    modifiers: [],
  };
  assert.equal(quotePrice(svc).price, 'enquiry');
});

// ── Modifier types ─────────────────────────────────────────────────────────
console.log('\nModifier types:');
test('addon_percent computed off base, not running total', () => {
  const svc = {
    booking_mode: 'instant',
    pricing_model: 'flat',
    pricing_config: { price: 100 },
    modifiers: [
      { key: 'sur', label: 'Sur', type: 'surcharge',     value: 20, default_on: false, sort_order: 1 },
      { key: 'pct', label: 'Pct', type: 'addon_percent', value: 10, default_on: false, sort_order: 2 },
    ],
  };
  // base=100, +20 surcharge = 120, then +10% of BASE (not of 120) = +10 = 130
  assert.equal(quotePrice(svc, { modifiers: ['sur', 'pct'] }).price, 130);
});
test('discount subtracts £', () => {
  const svc = {
    booking_mode: 'instant',
    pricing_model: 'flat',
    pricing_config: { price: 50 },
    modifiers: [
      { key: 'multi', label: 'Multi-service', type: 'discount', value: 5, default_on: false, sort_order: 1 },
    ],
  };
  assert.equal(quotePrice(svc, { modifiers: ['multi'] }).price, 45);
});
test('default_on modifiers auto-applied when no selections given', () => {
  const svc = {
    booking_mode: 'instant',
    pricing_model: 'flat',
    pricing_config: { price: 50 },
    modifiers: [
      { key: 'fuel', label: 'Fuel', type: 'surcharge', value: 3, default_on: true, sort_order: 1 },
    ],
  };
  assert.equal(quotePrice(svc).price, 53);
});

// ── The enquiry-floor invariant ────────────────────────────────────────────
console.log('\nEnquiry floor (spec §6.5 — enquiry overrides everything):');
test('booking_mode=enquiry overrides flat pricing', () => {
  const svc = {
    booking_mode: 'enquiry',
    pricing_model: 'flat',
    pricing_config: { price: 75 },
    modifiers: [],
  };
  assert.equal(quotePrice(svc).price, 'enquiry');
});
test('booking_mode=enquiry overrides tiered pricing', () => {
  const svc = { ...MACKIES_WINDOW, booking_mode: 'enquiry' };
  assert.equal(quotePrice(svc).price, 'enquiry');
});
test('quote_only pricing_model is always enquiry, regardless of mode', () => {
  const svc = {
    booking_mode: 'instant',     // even with an aggressive mode
    pricing_model: 'quote_only',
    modifiers: [],
  };
  assert.equal(quotePrice(svc).price, 'enquiry');
});

// ── Final report ───────────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed.\n`);
if (failed > 0) {
  console.log('Failures:');
  for (const f of failures) console.log(`  • ${f.name}: ${f.err.message}`);
  process.exit(1);
}
