/**
 * src/hooks/useHmrc.js
 * Cadi — React hook for HMRC MTD ITSA integration
 *
 * Provides:
 *   connected        — bool: is the user's HMRC account linked?
 *   connecting       — bool: OAuth flow or API call in progress
 *   status           — full status object from hmrc-auth 'status'
 *   nino             — string | null
 *   obligations      — array of quarterly obligation objects (or [])
 *   lastCalculation  — most recent HMRC tax estimate (or null)
 *   error            — last error message (or null)
 *
 *   connectHmrc()        — open HMRC OAuth in same tab (or new tab)
 *   disconnectHmrc()     — revoke + clear
 *   saveNino(nino)       — save/update NINO
 *   fetchObligations()   — load obligations from HMRC
 *   submitQuarter(p)     — submit quarterly figures
 *   triggerCalculation(taxYear) — ask HMRC for an estimate
 *   getCalculation(taxYear, calcId) — fetch a specific calculation
 *   submitAndCalculate(p)  — combo helper: submit + calculate
 *
 * Usage:
 *   const { connected, connectHmrc, obligations } = useHmrc();
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  getHmrcStatus,
  getHmrcOAuthUrl,
  disconnectHmrc      as _disconnect,
  saveNino            as _saveNino,
  getHmrcBusinesses,
  getObligations,
  submitQuarter       as _submitQuarter,
  triggerCalculation  as _triggerCalc,
  getCalculation      as _getCalc,
  submitQuarterAndCalculate as _submitAndCalc,
  getCurrentTaxYearObligations,
} from '../lib/db/hmrcDb';

// ─── Status polling interval (ms) when a connection is active ────────────────
const STATUS_POLL_MS = 5 * 60 * 1000; // 5 minutes

export function useHmrc() {
  const { user } = useAuth();
  // Demo mode has no real Supabase session — every HMRC call would 401. Short-
  // circuit so we don't poll, don't error, and the UI can render a demo state.
  const isDemo = user?.id === 'demo-user';

  const [status,          setStatus]          = useState(null);   // raw status object
  const [obligations,     setObligations]     = useState([]);
  const [businessId,      setBusinessId]      = useState(null);
  const [lastCalculation, setLastCalculation] = useState(null);
  const [connecting,      setConnecting]      = useState(false);
  const [loading,         setLoading]         = useState(!isDemo); // no load in demo
  const [error,           setError]           = useState(null);

  const pollRef = useRef(null);

  // ── Derived ──────────────────────────────────────────────────────────────────
  const connected = Boolean(status?.connected);
  const nino      = status?.nino ?? null;

  // ── Load status on mount + poll ───────────────────────────────────────────────
  const refreshStatus = useCallback(async () => {
    if (isDemo) return;
    try {
      const s = await getHmrcStatus();
      setStatus(s);
      setError(null);
    } catch (e) {
      // Not connected, or user not logged in — both are fine
      if (!e.message?.includes('Unauthorized')) {
        setError(e.message);
      }
    } finally {
      setLoading(false);
    }
  }, [isDemo]);

  useEffect(() => {
    if (isDemo) return undefined;
    refreshStatus();
    pollRef.current = setInterval(refreshStatus, STATUS_POLL_MS);
    return () => clearInterval(pollRef.current);
  }, [refreshStatus, isDemo]);

  // ── Auto-load obligations when connected + has NINO ──────────────────────────
  useEffect(() => {
    if (connected && nino && obligations.length === 0) {
      fetchObligations();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, nino]);

  // ── Actions ──────────────────────────────────────────────────────────────────

  /** Redirect the user to HMRC's OAuth consent screen */
  const connectHmrc = useCallback(async () => {
    if (isDemo) { setError('Sign in to connect HMRC'); return; }
    setConnecting(true);
    setError(null);
    try {
      const { url } = await getHmrcOAuthUrl();
      // Use same-tab redirect so the callback page can pick up the code
      window.location.href = url;
    } catch (e) {
      setError(e.message);
      setConnecting(false);
    }
    // Note: setConnecting(false) is NOT called here — the page will navigate away.
    // If the user cancels and comes back, refreshStatus() will reset the UI.
  }, [isDemo]);

  /** Revoke HMRC connection and clear stored tokens */
  const disconnectHmrc = useCallback(async () => {
    setConnecting(true);
    setError(null);
    try {
      await _disconnect();
      setStatus(s => ({ ...s, connected: false, nino: null }));
      setObligations([]);
      setBusinessId(null);
      setLastCalculation(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setConnecting(false);
    }
  }, []);

  /** Save the user's National Insurance Number */
  const saveNino = useCallback(async (ninoValue) => {
    setConnecting(true);
    setError(null);
    try {
      const result = await _saveNino(ninoValue);
      setStatus(s => ({ ...s, nino: result.nino }));
      return result;
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      setConnecting(false);
    }
  }, []);

  /** Load obligations for the current tax year from HMRC */
  const fetchObligations = useCallback(async (bizId) => {
    setConnecting(true);
    setError(null);
    try {
      // If we don't already have the businessId, fetch it first
      let biz = bizId ?? businessId;
      if (!biz) {
        const bizData = await getHmrcBusinesses();
        const businesses = bizData?.listOfBusinessDetails ?? bizData?.list ?? bizData?.businesses ?? [];
        biz = businesses[0]?.businessId ?? businesses[0]?.id ?? null;
        if (biz) setBusinessId(biz);
      }

      const data = await getCurrentTaxYearObligations(biz ?? undefined);
      // HMRC returns { obligations: [{ obligationDetails: [...] }] }
      const details = data?.obligations?.[0]?.obligationDetails ?? [];
      setObligations(details);
      return details;
    } catch (e) {
      setError(e.message);
      return [];
    } finally {
      setConnecting(false);
    }
  }, [businessId]);

  /** Resolve businessId, fetching from HMRC if not yet cached */
  const resolveBizId = useCallback(async (override) => {
    if (override) return override;
    if (businessId) return businessId;
    const bizData = await getHmrcBusinesses();
    console.log('[resolveBizId] raw response:', JSON.stringify(bizData));
    const businesses = bizData?.listOfBusinessDetails ?? bizData?.list ?? bizData?.businesses ?? [];
    const biz = businesses[0]?.businessId ?? businesses[0]?.id ?? null;
    if (biz) setBusinessId(biz);
    if (!biz) throw new Error(`No HMRC business found. Keys: ${Object.keys(bizData ?? {}).join(', ')} | raw: ${JSON.stringify(bizData)}`);
    return biz;
  }, [businessId]);

  /** Submit a quarterly period to HMRC */
  const submitQuarter = useCallback(async (params) => {
    setConnecting(true);
    setError(null);
    try {
      const biz = await resolveBizId(params.businessId);
      const result = await _submitQuarter({ ...params, businessId: biz });
      // Refresh obligations so the submitted period shows as "Fulfilled"
      await fetchObligations(biz);
      return result;
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      setConnecting(false);
    }
  }, [resolveBizId, fetchObligations]);

  /** Ask HMRC to produce an in-year tax estimate */
  const triggerCalculation = useCallback(async (taxYear) => {
    setConnecting(true);
    setError(null);
    try {
      return await _triggerCalc(taxYear);
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      setConnecting(false);
    }
  }, []);

  /** Fetch a specific tax calculation */
  const getCalculation = useCallback(async (taxYear, calculationId) => {
    setConnecting(true);
    setError(null);
    try {
      const calc = await _getCalc(taxYear, calculationId);
      setLastCalculation(calc);
      return calc;
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      setConnecting(false);
    }
  }, []);

  /** Submit a quarter and immediately trigger + fetch a calculation */
  const submitAndCalculate = useCallback(async (params) => {
    setConnecting(true);
    setError(null);
    try {
      const biz = await resolveBizId(params.businessId);
      const result = await _submitAndCalc({ ...params, businessId: biz });
      setLastCalculation(result.calculation);
      await fetchObligations(biz);
      return result;
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      setConnecting(false);
    }
  }, [resolveBizId, fetchObligations]);

  return {
    // State
    status,
    connected,
    connecting,
    loading,
    nino,
    obligations,
    businessId,
    lastCalculation,
    error,

    // Actions
    connectHmrc,
    disconnectHmrc,
    saveNino,
    fetchObligations,
    submitQuarter,
    triggerCalculation,
    getCalculation,
    submitAndCalculate,

    // Refresh
    refreshStatus,
  };
}
