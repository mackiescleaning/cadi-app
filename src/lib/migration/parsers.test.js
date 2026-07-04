// Migration parsers — the code that ingests messy competitor exports (CleanerPlanner,
// Squeegee, QuickBooks…). Bad parsing here silently corrupts a cleaner's whole
// customer book on day one, so the awkward real-world shapes are pinned below.

import { describe, it, expect } from 'vitest';
import {
  parseFrequency,
  parseFrequencyDays,
  parseBalance,
  parseCurrency,
  parseCleanerDate,
  normalisePostcode,
  splitAddress,
  detectSource,
} from './parsers.js';

describe('parseFrequency', () => {
  it('parses plain cadences to a day count', () => {
    expect(parseFrequency('weekly').days).toBe(7);
    expect(parseFrequency('fortnightly').days).toBe(14);
    expect(parseFrequency('monthly').days).toBe(30);
    expect(parseFrequency('daily').days).toBe(1);
  });

  it('parses one-off / ad-hoc to zero days', () => {
    expect(parseFrequency('one-off').days).toBe(0);
    expect(parseFrequency('ad hoc').days).toBe(0);
    expect(parseFrequency('single visit').days).toBe(0);
  });

  it('handles "every N weeks", worded and digit', () => {
    expect(parseFrequency('every 3 weeks').days).toBe(21);
    expect(parseFrequency('every two weeks').days).toBe(14);
    expect(parseFrequency('6 weekly').days).toBe(42);
  });

  it('treats biweekly/every other week as a 14-day cadence', () => {
    expect(parseFrequency('biweekly').days).toBe(14);
    expect(parseFrequency('every other week').days).toBe(14);
  });

  it('converts monthly cadences using the 4-week cleaning-industry month', () => {
    expect(parseFrequency('4 weekly').days).toBe(28);
    expect(parseFrequency('every 2 months').days).toBe(56);
  });

  it('returns null for unparseable input', () => {
    expect(parseFrequency('whenever')).toBeNull();
    expect(parseFrequency('')).toBeNull();
    expect(parseFrequency(null)).toBeNull();
  });

  it('parseFrequencyDays is the day-count shim', () => {
    expect(parseFrequencyDays('weekly')).toBe(7);
    expect(parseFrequencyDays('nonsense')).toBeNull();
  });
});

describe('parseBalance (CR/DR aware)', () => {
  it('reads a credit as positive (customer overpaid)', () => {
    expect(parseBalance('£100 CR')).toBe(100);
    expect(parseBalance('100 CREDIT')).toBe(100);
  });

  it('reads a debit as negative (customer owes)', () => {
    expect(parseBalance('£100 DR')).toBe(-100);
    expect(parseBalance('100 DEBIT')).toBe(-100);
    expect(parseBalance('50 owing')).toBe(-50);
  });

  it('honours an explicit minus sign', () => {
    expect(parseBalance('-50')).toBe(-50);
    expect(parseBalance('50')).toBe(50);
  });

  it('strips commas and currency symbols', () => {
    expect(parseBalance('£1,234.56')).toBeCloseTo(1234.56, 10);
  });

  it('returns null for blanks / dashes', () => {
    expect(parseBalance('')).toBeNull();
    expect(parseBalance('-')).toBeNull();
    expect(parseBalance(null)).toBeNull();
  });
});

describe('parseCurrency (plain price)', () => {
  it('strips symbols and commas', () => {
    expect(parseCurrency('£50.00')).toBe(50);
    expect(parseCurrency('1,000')).toBe(1000);
  });

  it('returns null for "quote", blank and non-numeric', () => {
    expect(parseCurrency('quote')).toBeNull();
    expect(parseCurrency('')).toBeNull();
    expect(parseCurrency(null)).toBeNull();
    expect(parseCurrency('abc')).toBeNull();
  });
});

describe('parseCleanerDate', () => {
  it('passes ISO dates straight through', () => {
    expect(parseCleanerDate('2026-06-01')).toBe('2026-06-01');
    expect(parseCleanerDate('2026-06-01T09:00:00Z')).toBe('2026-06-01');
  });

  it('parses UK DD/MM/YYYY and DD/MM/YY', () => {
    expect(parseCleanerDate('01/06/2026')).toBe('2026-06-01');
    expect(parseCleanerDate('1/6/26')).toBe('2026-06-01');
  });

  it('parses dash-separated day-first dates', () => {
    expect(parseCleanerDate('01-06-2026')).toBe('2026-06-01');
  });

  it('parses named months with ordinal suffixes', () => {
    expect(parseCleanerDate('1st Jun 2026')).toBe('2026-06-01');
    expect(parseCleanerDate('01 June 26')).toBe('2026-06-01');
  });

  it('accepts a JS Date object (how xlsx hands back date cells)', () => {
    expect(parseCleanerDate(new Date(Date.UTC(2026, 5, 1)))).toBe('2026-06-01');
  });

  it('parses 5-digit Excel serial numbers to an ISO date', () => {
    const a = parseCleanerDate('45658');
    const b = parseCleanerDate('45659');
    expect(a).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // Consecutive serials are exactly one day apart.
    const dayMs = 86400000;
    expect(new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')).toBe(dayMs);
  });

  it('returns null for blanks and non-dates', () => {
    expect(parseCleanerDate('')).toBeNull();
    expect(parseCleanerDate(null)).toBeNull();
    expect(parseCleanerDate('-')).toBeNull();
    expect(parseCleanerDate('n/a')).toBeNull();
    expect(parseCleanerDate('overdue')).toBeNull();
    expect(parseCleanerDate(new Date('not a date'))).toBeNull();
  });
});

describe('normalisePostcode', () => {
  it('normalises spacing and case', () => {
    expect(normalisePostcode('sw191aa')).toBe('SW19 1AA');
    expect(normalisePostcode('ec1a1bb')).toBe('EC1A 1BB');
    expect(normalisePostcode('EC1A 1BB')).toBe('EC1A 1BB');
    expect(normalisePostcode('  m1  1ae ')).toBe('M1 1AE');
  });

  it('returns null for anything that is not a UK postcode', () => {
    expect(normalisePostcode('garbage')).toBeNull();
    expect(normalisePostcode('')).toBeNull();
    expect(normalisePostcode(null)).toBeNull();
    expect(normalisePostcode('TOOLONG123')).toBeNull();
  });
});

describe('splitAddress', () => {
  it('pulls a trailing postcode off and splits a 3-part body (town, no county)', () => {
    // Body after postcode = "12 High Street, Chelsea, London" → 3 parts.
    const r = splitAddress('12 High Street, Chelsea, London, SW1A 1AA');
    expect(r.postcode).toBe('SW1A 1AA');
    expect(r.addressLine1).toBe('12 High Street');
    expect(r.addressLine2).toBe('Chelsea');
    expect(r.town).toBe('London');
    expect(r.county).toBeNull();
  });

  it('assigns county when there are four or more body parts', () => {
    const r = splitAddress('12 High Street, Chelsea, Manchester, Greater Manchester, M1 1AE');
    expect(r.postcode).toBe('M1 1AE');
    expect(r.addressLine1).toBe('12 High Street');
    expect(r.addressLine2).toBe('Chelsea');
    expect(r.town).toBe('Manchester');
    expect(r.county).toBe('Greater Manchester');
  });

  it('handles a bare single-line address', () => {
    const r = splitAddress('42 Mill Road');
    expect(r.addressLine1).toBe('42 Mill Road');
    expect(r.town).toBeNull();
    expect(r.postcode).toBeNull();
  });

  it('returns all-null for empty input', () => {
    expect(splitAddress('')).toEqual({
      addressLine1: null,
      addressLine2: null,
      town: null,
      county: null,
      postcode: null,
    });
  });
});

describe('detectSource', () => {
  it('identifies CleanerPlanner from cust ref + round + job ref', () => {
    expect(detectSource(['Cust Ref', 'Name', 'Round', 'Job Ref'])).toBe('cleaner-planner');
  });

  it('identifies QuickBooks from bill-to + customer', () => {
    expect(detectSource(['Customer', 'Bill to', 'Main Phone', 'Open Balance'])).toBe('quickbooks');
  });

  it('identifies Squeegee and Housecall Pro', () => {
    expect(detectSource(['Round Name', 'Next Due', 'Balance'])).toBe('squeegee');
    expect(detectSource(['Customer First Name', 'Customer Last Name'])).toBe('housecall-pro');
  });

  it('returns null when nothing matches', () => {
    expect(detectSource(['Foo', 'Bar'])).toBeNull();
    expect(detectSource([])).toBeNull();
  });
});
