/**
 * Short-lived, HMAC-signed grants exchanged for an Auth.js session after OTP
 * verification. Uses Web Crypto only, so it is safe to import from `auth.ts`,
 * which is also pulled into the Edge middleware graph. The grant is passed
 * directly from the verify route to the credentials provider and never reaches
 * the browser — the session cookie is issued instead.
 */
import {
  constantTimeEqual,
  normalizeEjustEmail,
  validateEjustEmail,
} from "./email-otp.ts";

const GRANT_TTL_MS = 2 * 60 * 1000;
const GRANT_PURPOSE = "email-otp";

function grantSecret(): string {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is missing.");
  return secret;
}

function base64urlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlDecode(value: string): Uint8Array {
  const padded =
    value.replace(/-/g, "+").replace(/_/g, "/") +
    "=".repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function signGrant(payload: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    encoder.encode(grantSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await globalThis.crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(payload)
  );
  return base64urlEncode(new Uint8Array(signature));
}

/** Sign a 2-minute grant for a verified E-JUST email address. */
export async function createOtpGrant(emailInput: string): Promise<string> {
  const email = normalizeEjustEmail(emailInput);
  const payload = base64urlEncode(
    new TextEncoder().encode(
      JSON.stringify({
        email,
        exp: Date.now() + GRANT_TTL_MS,
        purpose: GRANT_PURPOSE,
      })
    )
  );
  return `${payload}.${await signGrant(payload)}`;
}

/** Validate the signature, expiry, purpose and email scope of a grant. */
export async function verifyOtpGrant(token: unknown): Promise<string | null> {
  if (typeof token !== "string") return null;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return null;

  const expected = await signGrant(payload);
  if (!constantTimeEqual(expected, signature)) return null;

  try {
    const parsed = JSON.parse(
      new TextDecoder().decode(base64urlDecode(payload))
    ) as { email?: unknown; exp?: unknown; purpose?: unknown };
    if (parsed.purpose !== GRANT_PURPOSE) return null;
    if (typeof parsed.exp !== "number" || parsed.exp <= Date.now()) return null;
    if (validateEjustEmail(parsed.email) !== "ok") return null;
    return normalizeEjustEmail(parsed.email as string);
  } catch {
    return null;
  }
}
