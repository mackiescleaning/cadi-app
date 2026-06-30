/**
 * supabase/functions/_shared/tokenCrypto.ts
 *
 * AES-GCM-256 token encryption used across edge functions to protect tokens at
 * rest in `profiles` (HMRC) and `bank_connections` (Yapily).
 *
 * Ciphertext format: "enc:v1:<iv_hex>:<ciphertext_b64>"
 * - 12-byte IV per encryption (fresh, random)
 * - 32-byte key supplied as hex via env var
 *
 * Fails CLOSED — if the key is missing or malformed, both encrypt and decrypt
 * throw. Never persists plaintext silently.
 *
 * Each caller supplies its own env var name so token classes are isolated:
 *   - `BANK_TOKEN_ENC_KEY`  for Yapily consent tokens (existing)
 *   - `HMRC_TOKEN_ENC_KEY`  for HMRC access/refresh tokens and NINO (new)
 */

const keyCache = new Map<string, CryptoKey>();

function validateHex(name: string, hex: string): void {
  if (!hex)                      throw new Error(`${name} is unset`);
  if (hex.length !== 64)         throw new Error(`${name} must be 64 hex chars (got ${hex.length})`);
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) throw new Error(`${name} must be hex`);
}

async function getKey(envName: string): Promise<CryptoKey> {
  const cached = keyCache.get(envName);
  if (cached) return cached;
  const hex = Deno.env.get(envName) ?? "";
  validateHex(envName, hex);
  const raw = new Uint8Array(hex.match(/.{2}/g)!.map(b => parseInt(b, 16)));
  const key = await crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
  keyCache.set(envName, key);
  return key;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}
function fromHex(s: string): Uint8Array {
  return new Uint8Array(s.match(/.{2}/g)!.map(b => parseInt(b, 16)));
}
function toB64(bytes: Uint8Array): string {
  let s = ""; for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
function fromB64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function encryptWith(envName: string, plaintext: string): Promise<string> {
  const key = await getKey(envName);
  const iv  = crypto.getRandomValues(new Uint8Array(12));
  const ct  = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plaintext));
  return `enc:v1:${toHex(iv)}:${toB64(new Uint8Array(ct))}`;
}

/**
 * Decrypt an `enc:v1:…` string. If `stored` is null/empty, returns "".
 * Pass `allowLegacyPlaintext` to accept plaintext (for one-time migration
 * windows when a legacy plaintext row hasn't been re-encrypted yet).
 */
export async function decryptWith(envName: string, stored: string | null | undefined, allowLegacyPlaintext = false): Promise<string> {
  if (!stored) return "";
  if (!stored.startsWith("enc:v1:")) {
    if (!allowLegacyPlaintext) {
      throw new Error("Refusing to use unencrypted legacy token");
    }
    return stored;
  }
  const key = await getKey(envName);
  const [, , ivHex, ctB64] = stored.split(":");
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromHex(ivHex) }, key, fromB64(ctB64));
  return new TextDecoder().decode(pt);
}
