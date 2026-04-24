/**
 * src/lib/db/hmrcDb.js
 * Cadi — HMRC Edge Function wrappers
 *
 * All HMRC calls go through Supabase Edge Functions (not directly to HMRC).
 * The Edge Functions handle:
 *   - CORS (HMRC API has none)
 *   - OAuth token refresh
 *   - Storing tokens server-side with the service-role key
 *
 * Usage:
 *   import { hmrcAuth, hmrcApi } from '../lib/db/hmrcDb';
 *
 *   const { data } = await hmrcAuth('status');
 *   const { data } = await hmrcApi('obligations', { fromDate: '...', toDate: '...' });
 */

import { supabase } from '../supabase';
import { collectDeviceInfo } from '../hmrcFraudHeaders';

// ─── Low-level invoke helpers ─────────────────────────────────────────────────

/**
 * Call the hmrc-auth Edge Function.
 * @param {string} action  — "url" | "callback" | "status" | "disconnect"
 * @param {object} payload — extra fields to merge with { action }
 */
export async function hmrcAuth(action, payload = {}) {
  const { data, error } = await supabase.functions.invoke('hmrc-auth', {
    body: { action, ...payload },
  });
  if (error) throw new Error(error.message ?? 'hmrc-auth error');
  if (data?.error) throw new Error(data.error);
  return data;
}

/**
 * Actions that hit HMRC (vs. actions that only touch our DB). We attach fraud
 * prevention headers only for these — no point paying the ipify round-trip on
 * save_nino, which never leaves Supabase.
 */
const HMRC_NETWORK_ACTIONS = new Set([
  'businesses',
  'obligations',
  'submit_quarter',
  'trigger_calculation',
  'get_calculation',
]);

/**
 * Call the hmrc-api Edge Function.
 *
 * For actions that actually hit HMRC, we collect device info client-side and
 * pass it through so the edge function can build the Gov-Client-* headers
 * HMRC mandates for MTD fraud prevention.
 *
 * @param {string} action  — see hmrc-api/index.ts for all actions
 * @param {object} payload — action-specific fields
 */
export async function hmrcApi(action, payload = {}) {
  const body = { action, ...payload };

  if (HMRC_NETWORK_ACTIONS.has(action)) {
    const { data: { user } } = await supabase.auth.getUser();
    body.deviceInfo = await collectDeviceInfo({ userId: user?.id });
  }

  const { data, error } = await supabase.functions.invoke('hmrc-api', { body });
  if (error) throw new Error(error.message ?? 'hmrc-api error');
  if (data?.error) {
    const detail = data.hmrcBody
      ? ' | ' + (typeof data.hmrcBody === 'object' ? JSON.stringify(data.hmrcBody) : String(data.hmrcBody))
      : '';
    const e = new Error(data.error + detail);
    e.hmrcStatus = data.hmrcStatus;
    e.hmrcBody   = data.hmrcBody;
    e.path       = data.path;
    console.error('[hmrc-api]', data.error, { hmrcStatus: data.hmrcStatus, hmrcBody: data.hmrcBody, path: data.path });
    throw e;
  }
  return data;
}

// ─── Auth helpers ─────────────────────────────────────────────────────────────

/** Returns the user's HMRC connection status */
export const getHmrcStatus = () => hmrcAuth('status');

/** Get the HMRC OAuth URL to redirect the user to */
export const getHmrcOAuthUrl = () => hmrcAuth('url');

/**
 * Exchange the OAuth callback code for tokens (call from /hmrc/callback page).
 * @param {string} code  — the ?code= from HMRC redirect
 * @param {string} state — the ?state= from HMRC redirect (CSRF check)
 */
export const exchangeHmrcCode = (code, state) =>
  hmrcAuth('callback', { code, state });

/** Revoke tokens and clear the HMRC connection */
export const disconnectHmrc = () => hmrcAuth('disconnect');

// ─── API helpers ──────────────────────────────────────────────────────────────

/**
 * Save the user's NINO (National Insurance Number).
 * Must be called at least once before any HMRC API calls.
 * @param {string} nino — e.g. "QQ123456C"
 */
export const saveNino = (nino) => hmrcApi('save_nino', { nino });

/**
 * Get the user's self-employment business ID from HMRC.
 * Returns array of business objects — you want businessId from the first one.
 */
export const getHmrcBusinesses = () => hmrcApi('businesses');

/**
 * Get MTD ITSA obligations (quarterly deadlines).
 * @param {string} fromDate  — "2025-04-06"
 * @param {string} toDate    — "2026-04-05"
 * @param {string} businessId — optional filter
 */
export const getObligations = (fromDate, toDate, businessId) =>
  hmrcApi('obligations', {
    fromDate,
    toDate,
    ...(businessId ? { businessId } : {}),
  });

/**
 * Submit a quarterly income + expense summary to HMRC.
 * @param {object} params
 * @param {string} params.businessId   — from getHmrcBusinesses()
 * @param {string} params.periodStart  — "2025-04-06"
 * @param {string} params.periodEnd    — "2025-07-05"
 * @param {object} params.income       — { turnover: number, other?: number }
 * @param {object} params.expenses     — { travelCosts?, adminCosts?, ... }
 */
export const submitQuarter = (params) => hmrcApi('submit_quarter', params);

/**
 * Ask HMRC to produce an in-year tax estimate after submitting a quarter.
 * @param {string} taxYear — "2025-26"
 * Returns { calculationId }
 */
export const triggerCalculation = (taxYear) =>
  hmrcApi('trigger_calculation', { taxYear });

/**
 * Fetch a specific tax calculation from HMRC.
 * @param {string} taxYear       — "2025-26"
 * @param {string} calculationId — from triggerCalculation()
 */
export const getCalculation = (taxYear, calculationId) =>
  hmrcApi('get_calculation', { taxYear, calculationId });

// ─── Compound helpers ─────────────────────────────────────────────────────────

/**
 * Convenience: submit a quarter then immediately trigger a calculation.
 * Returns { submission, calculationId, calculation }.
 */
export async function submitQuarterAndCalculate({
  businessId,
  periodStart,
  periodEnd,
  income,
  expenses,
  taxYear,
}) {
  const submission = await submitQuarter({
    businessId,
    periodStart,
    periodEnd,
    income,
    expenses,
    taxYear,
  });

  const { calculationId } = await triggerCalculation(taxYear);
  const calculation = await getCalculation(taxYear, calculationId);

  return { submission, calculationId, calculation };
}

/**
 * Get obligations for the current UK tax year.
 * Tax year runs Apr 6 → Apr 5.
 */
export function getCurrentTaxYearObligations(businessId) {
  const now = new Date();
  const year = now.getMonth() >= 3 && now.getDate() >= 6
    ? now.getFullYear()
    : now.getFullYear() - 1;

  const fromDate = `${year}-04-06`;
  const toDate   = `${year + 1}-04-05`;

  return getObligations(fromDate, toDate, businessId);
}

/**
 * Format a tax year string for HMRC API from a start year number.
 * e.g. 2025 → "2025-26"
 */
export function formatTaxYear(startYear) {
  const short = String(startYear + 1).slice(2);
  return `${startYear}-${short}`;
}
