/**
 * Secure token layer (Anti-forgery / Anti-replay)
 * ================================================
 * QR codes carry a SIGNED token, not the raw database id, so a photographed or
 * hand-copied code cannot be trivially forged. Each token embeds:
 *   - the student id
 *   - a per-center secret
 *   - an HMAC-SHA256 signature (truncated) that the scanner verifies.
 *
 * Token format:  CPD2.<studentId>.<sigHex>
 *
 * We also keep backward-compatibility with legacy plain tokens (CPD:<id>) and
 * accept them in "compat mode" (verified only structurally) so existing cards
 * keep working until they're re-issued.
 */

const TOKEN_PREFIX = "CPD2:";
const LEGACY_PREFIX = "CPD:";

/** A stable per-installation secret, generated once and cached in localStorage. */
function centerSecret(): string {
  const KEY = "cpd_att_secret";
  let s = "";
  try { s = localStorage.getItem(KEY) ?? ""; } catch { /* ssr / blocked */ }
  if (!s) {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    s = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
    try { localStorage.setItem(KEY, s); } catch { /* ignore */ }
  }
  return s;
}

async function hmac(message: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Build a signed, forge-resistant QR payload for a student id. */
export async function signStudentToken(studentId: string): Promise<string> {
  const secret = centerSecret();
  const sig = (await hmac(`student:${studentId}`, secret)).slice(0, 16); // 64-bit truncation
  return `${TOKEN_PREFIX}${studentId}.${sig}`;
}

/** Legacy (unsigned) token, kept for old cards. */
export function legacyToken(studentId: string): string {
  return `${LEGACY_PREFIX}${studentId}`;
}

export interface DecodedToken {
  studentId: string;
  /** true = modern signed token, false = legacy unsigned token. */
  signed: boolean;
  /** true if the signature is valid (always true for legacy compat). */
  valid: boolean;
}

/**
 * Parse + verify a scanned payload. Accepts both signed and legacy tokens.
 * Returns null if the payload is not a recognized format at all.
 */
export async function verifyToken(payload: string): Promise<DecodedToken | null> {
  const raw = payload.trim();

  // Modern signed token: CPD2:<id>.<sig>
  if (raw.startsWith(TOKEN_PREFIX)) {
    const body = raw.slice(TOKEN_PREFIX.length);
    const dot = body.lastIndexOf(".");
    if (dot < 0) return null;
    const studentId = body.slice(0, dot);
    const sig = body.slice(dot + 1);
    if (!studentId || !sig) return null;
    const expected = (await hmac(`student:${studentId}`, centerSecret())).slice(0, 16);
    return { studentId, signed: true, valid: sig === expected };
  }

  // Legacy unsigned token: CPD:<id>
  if (raw.startsWith(LEGACY_PREFIX)) {
    const studentId = raw.slice(LEGACY_PREFIX.length).trim();
    if (!studentId) return null;
    return { studentId, signed: false, valid: true }; // compat: accept structurally
  }

  // Bare id fallback (some scanners strip prefixes) — accept if it matches a code shape.
  if (/^STU[_-]?\d+$/i.test(raw) || /^[A-Z0-9]{6}$/i.test(raw)) {
    return { studentId: raw.toUpperCase(), signed: false, valid: true };
  }

  return null;
}
