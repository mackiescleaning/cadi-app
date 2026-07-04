// GDPR export scrubber — this runs on every row of a user-downloadable data export.
// A miss here leaks OAuth tokens / signing keys / password hashes to whoever
// requests their data. The redaction is exhaustively asserted per field shape.

import { describe, it, expect } from 'vitest';
import { scrub } from '../../supabase/functions/_shared/scrub.ts';

const REDACTED = '[REDACTED for security]';

describe('scrub — sensitive field names', () => {
  const sensitiveKeys = [
    'access_token',
    'refresh_token',
    'id_token',
    'bearer_token',
    'consent_id',
    'consent_token',
    'stripe_secret',
    'api_key',
    'signing_key',
    'webhook_secret',
    'password',
    'password_hash',
    'salt',
    'session_cookie',
    'csrf_token',
    'login_nonce',
    'otp',
    'verification_code',
  ];

  for (const key of sensitiveKeys) {
    it(`redacts "${key}"`, () => {
      const out = scrub({ [key]: 'super-secret-value' });
      expect(out[key]).toBe(REDACTED);
    });
  }

  it('is case-insensitive on field names', () => {
    const out = scrub({ ACCESS_TOKEN: 'x', Refresh_Token: 'y' });
    expect(out.ACCESS_TOKEN).toBe(REDACTED);
    expect(out.Refresh_Token).toBe(REDACTED);
  });
});

describe('scrub — encrypted values (defence in depth)', () => {
  it('redacts an enc:v1: blob even under an innocuous key name', () => {
    const out = scrub({ note: 'enc:v1:AbCdEf==' });
    expect(out.note).toBe('[REDACTED encrypted value]');
  });

  it('leaves ordinary strings that merely contain "enc" alone', () => {
    const out = scrub({ note: 'fence painting' });
    expect(out.note).toBe('fence painting');
  });
});

describe('scrub — preserves non-sensitive data', () => {
  it('keeps ordinary customer fields untouched', () => {
    const row = { name: 'Britannia', email: 'a@b.com', amount: 4200, active: true };
    expect(scrub(row)).toEqual(row);
  });

  it('does not mutate the original row', () => {
    const row = { access_token: 'keep-me-safe' };
    const out = scrub(row);
    expect(out).not.toBe(row);
    expect(row.access_token).toBe('keep-me-safe');
    expect(out.access_token).toBe(REDACTED);
  });

  it('handles a mixed row, redacting only the sensitive keys', () => {
    const out = scrub({
      id: 'cust_1',
      email: 'ap@britannia.example',
      gocardless_access_token: 'act_live_xxx',
      balance: -50,
    });
    expect(out.id).toBe('cust_1');
    expect(out.email).toBe('ap@britannia.example');
    expect(out.balance).toBe(-50);
    expect(out.gocardless_access_token).toBe(REDACTED);
  });
});
