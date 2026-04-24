/**
 * src/lib/hmrcFraudHeaders.js
 * Cadi — HMRC MTD Fraud Prevention Header collection (client side).
 *
 * HMRC requires ~14 Gov-Client-* / Gov-Vendor-* headers on every MTD call as part of
 * their Transaction Monitoring requirements. Without them, sandbox calls fail (404
 * on Obligations is a classic symptom) and HMRC won't grant MTD-recognised status.
 *
 * Connection method: WEB_APP_VIA_SERVER — our React app in the browser calls the
 * Supabase Edge Function, which in turn calls HMRC. This module collects everything
 * we need from the browser. The edge function adds vendor + server-side fields.
 *
 * See: https://developer.service.hmrc.gov.uk/guides/fraud-prevention/
 */

const DEVICE_ID_KEY = 'cadi_hmrc_device_id';
const PUBLIC_IP_CACHE_KEY = 'cadi_hmrc_public_ip';
const PUBLIC_IP_TTL_MS = 10 * 60 * 1000; // 10 min — HMRC wants a "recent" IP

/**
 * Stable per-browser device ID. Generated once, persisted in localStorage.
 * Format: UUID v4.
 */
export function getDeviceId() {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = (crypto.randomUUID?.() ?? fallbackUuid());
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return fallbackUuid(); // storage disabled — at least give HMRC *something*
  }
}

function fallbackUuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** UTC offset in HMRC's required format: "UTC+01:00" / "UTC-05:00" */
function formatTimezoneOffset() {
  const offsetMin = -new Date().getTimezoneOffset(); // JS returns inverted sign
  const sign = offsetMin >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMin);
  const hh = String(Math.floor(abs / 60)).padStart(2, '0');
  const mm = String(abs % 60).padStart(2, '0');
  return `UTC${sign}${hh}:${mm}`;
}

/** "width=1920&height=1080&scaling-factor=2&colour-depth=24" */
function formatScreens() {
  const s = window.screen || {};
  return [
    `width=${s.width ?? 0}`,
    `height=${s.height ?? 0}`,
    `scaling-factor=${window.devicePixelRatio ?? 1}`,
    `colour-depth=${s.colorDepth ?? 24}`,
  ].join('&');
}

/** "width=1280&height=720" (inner window) */
function formatWindowSize() {
  return `width=${window.innerWidth ?? 0}&height=${window.innerHeight ?? 0}`;
}

/** URL-encoded comma-separated list of installed browser plugins */
function formatBrowserPlugins() {
  try {
    const plugins = Array.from(navigator.plugins || []).map(p => p.name);
    if (plugins.length === 0) return encodeURIComponent('none');
    return plugins.map(encodeURIComponent).join(',');
  } catch {
    return encodeURIComponent('none');
  }
}

/** DoNotTrack as the literal string "true" or "false" (HMRC spec) */
function formatDnt() {
  const dnt = navigator.doNotTrack ?? window.doNotTrack ?? navigator.msDoNotTrack;
  return dnt === '1' || dnt === 'yes' ? 'true' : 'false';
}

/**
 * Fetch the user's public IP via ipify. Cached for 10 minutes in sessionStorage
 * so we're not hitting a third-party service on every HMRC call.
 */
async function getPublicIp() {
  try {
    const cached = sessionStorage.getItem(PUBLIC_IP_CACHE_KEY);
    if (cached) {
      const { ip, ts } = JSON.parse(cached);
      if (ip && Date.now() - ts < PUBLIC_IP_TTL_MS) {
        return { ip, timestamp: new Date(ts).toISOString() };
      }
    }
  } catch { /* fall through to fetch */ }

  try {
    const res = await fetch('https://api.ipify.org?format=json');
    const { ip } = await res.json();
    const now = Date.now();
    try {
      sessionStorage.setItem(PUBLIC_IP_CACHE_KEY, JSON.stringify({ ip, ts: now }));
    } catch { /* storage disabled — skip cache */ }
    return { ip, timestamp: new Date(now).toISOString() };
  } catch {
    return { ip: null, timestamp: new Date().toISOString() };
  }
}

/**
 * Collect every client-side fraud-prevention field HMRC needs.
 * Returns a plain object the edge function can consume — the edge function is
 * responsible for turning this into actual Gov-Client-* HTTP headers.
 *
 * @param {object} opts
 * @param {string} opts.userId — Supabase user id, surfaced as Gov-Client-User-IDs
 */
export async function collectDeviceInfo({ userId } = {}) {
  const { ip, timestamp } = await getPublicIp();
  return {
    deviceId:        getDeviceId(),
    userAgent:       navigator.userAgent ?? '',
    browserPlugins:  formatBrowserPlugins(),
    doNotTrack:      formatDnt(),
    screens:         formatScreens(),
    windowSize:      formatWindowSize(),
    timezone:        formatTimezoneOffset(),
    publicIp:        ip,
    publicIpTimestamp: timestamp,
    userId:          userId ?? null,
  };
}
