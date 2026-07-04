// Constant-time signature comparison used by the GoCardless and Resend webhook
// receivers. Getting the *result* wrong lets forged webhooks through; the
// constant-time property itself can't be unit-tested, but the equality contract can.

import { describe, it, expect } from 'vitest';
import { timingSafeEqualStr } from '../../supabase/functions/_shared/timingSafeEqual.ts';

describe('timingSafeEqualStr', () => {
  it('is true for identical strings', () => {
    expect(timingSafeEqualStr('abc123', 'abc123')).toBe(true);
    expect(timingSafeEqualStr('', '')).toBe(true);
  });

  it('is false for same-length strings that differ', () => {
    expect(timingSafeEqualStr('abc123', 'abc124')).toBe(false);
    // differ only in the first char — must still reject
    expect(timingSafeEqualStr('Xbc123', 'abc123')).toBe(false);
  });

  it('is false for different-length strings', () => {
    expect(timingSafeEqualStr('abc', 'abcd')).toBe(false);
    expect(timingSafeEqualStr('abcd', 'abc')).toBe(false);
    expect(timingSafeEqualStr('', 'a')).toBe(false);
  });

  it('is false (never throws) for non-string inputs', () => {
    expect(timingSafeEqualStr(null, 'a')).toBe(false);
    expect(timingSafeEqualStr('a', undefined)).toBe(false);
    expect(timingSafeEqualStr(123, 123)).toBe(false);
  });

  it('distinguishes realistic hex signatures', () => {
    const good = 'd2f1a9c8b7e6f5a4d3c2b1a09f8e7d6c5b4a3928';
    expect(timingSafeEqualStr(good, good)).toBe(true);
    expect(timingSafeEqualStr(good, good.slice(0, -1) + '0')).toBe(false);
  });
});
