/**
 * supabase/functions/_shared/staffJwt.ts
 *
 * HS256 JWT for staff (kiosk-PIN) sessions. Replaces the legacy pattern of
 * passing the staff UUID as a permanent bearer in URL query strings, which
 * leaked via referrers/CDN logs and never expired.
 *
 * Claims:
 *   sub  — team_members.id  (staff member uuid)
 *   biz  — owner_id (the business this session belongs to)
 *   role — 'cleaner' | 'manager' | …
 *   aud  — 'cadi-staff'
 *   iss  — 'cadi'
 *   iat, exp  — standard
 *
 * Default TTL is 8 hours — long enough for a full shift, short enough that a
 * leaked token has limited window. sessionStorage on the client means the
 * token vanishes on tab close.
 */

const SECRET_HEX = Deno.env.get("STAFF_JWT_SECRET") ?? "";
const AUD        = "cadi-staff";
const ISS        = "cadi";
const TTL_SECONDS = 8 * 60 * 60;

function assertSecret(): Uint8Array {
  if (!SECRET_HEX) throw new Error("STAFF_JWT_SECRET is unset");
  if (SECRET_HEX.length !== 64 || !/^[0-9a-fA-F]+$/.test(SECRET_HEX)) {
    throw new Error("STAFF_JWT_SECRET must be 64 hex chars");
  }
  return new Uint8Array(SECRET_HEX.match(/.{2}/g)!.map(b => parseInt(b, 16)));
}

let _key: CryptoKey | null = null;
async function getKey(): Promise<CryptoKey> {
  if (_key) return _key;
  _key = await crypto.subtle.importKey(
    "raw", assertSecret(),
    { name: "HMAC", hash: "SHA-256" },
    false, ["sign", "verify"],
  );
  return _key;
}

function b64urlEncode(input: ArrayBuffer | Uint8Array | string): string {
  const bytes = typeof input === "string"
    ? new TextEncoder().encode(input)
    : input instanceof ArrayBuffer ? new Uint8Array(input) : input;
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function b64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 ? "=".repeat(4 - (s.length % 4)) : "";
  const norm = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(norm);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export interface StaffClaims {
  sub:  string;
  biz:  string;
  role: string;
  aud:  string;
  iss:  string;
  iat:  number;
  exp:  number;
}

export async function signStaffToken(
  member: { id: string; owner_id: string; role: string },
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header  = { alg: "HS256", typ: "JWT" };
  const payload: StaffClaims = {
    sub:  member.id,
    biz:  member.owner_id,
    role: member.role,
    aud:  AUD,
    iss:  ISS,
    iat:  now,
    exp:  now + TTL_SECONDS,
  };
  const h  = b64urlEncode(JSON.stringify(header));
  const p  = b64urlEncode(JSON.stringify(payload));
  const sig = await crypto.subtle.sign(
    "HMAC", await getKey(),
    new TextEncoder().encode(`${h}.${p}`),
  );
  return `${h}.${p}.${b64urlEncode(new Uint8Array(sig))}`;
}

/**
 * Verifies signature, audience, issuer, and expiry. Throws on any failure.
 * Returns the validated claims so callers can use sub/biz/role.
 */
export async function verifyStaffToken(token: string): Promise<StaffClaims> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Malformed JWT");
  const [h, p, s] = parts;

  const sig = b64urlDecode(s);
  const ok = await crypto.subtle.verify(
    "HMAC", await getKey(), sig,
    new TextEncoder().encode(`${h}.${p}`),
  );
  if (!ok) throw new Error("Bad JWT signature");

  const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(p))) as StaffClaims;
  const now = Math.floor(Date.now() / 1000);
  if (!payload.exp || payload.exp < now)            throw new Error("JWT expired");
  if (payload.aud !== AUD)                          throw new Error("Wrong audience");
  if (payload.iss !== ISS)                          throw new Error("Wrong issuer");
  if (!payload.sub || !payload.biz || !payload.role) throw new Error("Missing required claims");

  return payload;
}

/**
 * Pull the Authorization: Bearer <jwt> header off the request, verify, return
 * claims. Throws on missing/invalid — caller maps to 401.
 */
export async function requireStaffAuth(req: Request): Promise<StaffClaims> {
  const auth = req.headers.get("Authorization") ?? req.headers.get("authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("Missing staff token");
  return await verifyStaffToken(token);
}
