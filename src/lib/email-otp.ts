/**
 * Client-safe primitives for E-JUST email verification.
 *
 * This module deliberately uses Web Crypto only, so both the signup/login UI
 * and the Node route handlers can import the same validation and hashing code.
 * Database access and secret-bearing grant tokens live in `email-otp-store.ts`.
 */

export const EMAIL_VERIFICATION_TTL_MS = 10 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
export const OTP_LENGTH = 6;

export const EJUST_EMAIL_DOMAINS = [
  "ejust.edu.eg",
  "student.ejust.edu.eg",
] as const;

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const OTP_SHAPE = /^\d{6}$/;

export type EjustEmailResult = "ok" | "not-ejust" | "invalid";

/** Distinguish malformed addresses from well-formed non-E-JUST addresses. */
export function validateEjustEmail(value: unknown): EjustEmailResult {
  if (typeof value !== "string") return "invalid";
  const email = value.trim().toLowerCase();
  if (!email || email.length > 254 || !EMAIL_SHAPE.test(email)) return "invalid";
  const domain = email.slice(email.lastIndexOf("@") + 1);
  return EJUST_EMAIL_DOMAINS.some((allowed) => allowed === domain)
    ? "ok"
    : "not-ejust";
}

/** Normalize an E-JUST address for storage and lookup. */
export function normalizeEjustEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isOtpFormat(value: unknown): value is string {
  return typeof value === "string" && OTP_SHAPE.test(value);
}

/** Uniform 6-digit numeric code. */
export function generateOtpCode(): string {
  const value = new Uint32Array(1);
  globalThis.crypto.getRandomValues(value);
  return String(value[0] % 1_000_000).padStart(OTP_LENGTH, "0");
}

/** SHA-256 (hex) of a code, domain-separated so raw OTPs are never stored. */
export async function hashOtpCode(code: string): Promise<string> {
  const payload = new TextEncoder().encode(`ejust-otp:${code}`);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", payload);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function timestampOf(value: number | Date | string): number {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

export function otpExpiryDate(now = Date.now()): Date {
  return new Date(now + EMAIL_VERIFICATION_TTL_MS);
}

export function isOtpExpired(expiresAt: number | Date | string, now = Date.now()): boolean {
  const expires = timestampOf(expiresAt);
  return !Number.isFinite(expires) || expires <= now;
}

/** Attempts are only accepted while strictly below the configured maximum. */
export function canSubmitOtpAttempt(attempts: number): boolean {
  return Number.isFinite(attempts) && attempts >= 0 && attempts < OTP_MAX_ATTEMPTS;
}

/**
 * Constant-time string comparison (no early exit on the first differing byte).
 * Pure JavaScript so it is safe in both the browser and the Edge runtime.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i += 1) {
    difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return difference === 0;
}

/** Milliseconds remaining before another code may be sent (0 when allowed). */
export function resendCooldownMs(
  sentAt: number | Date | string,
  now = Date.now()
): number {
  const sent = timestampOf(sentAt);
  if (!Number.isFinite(sent)) return 0;
  return Math.max(0, sent + OTP_RESEND_COOLDOWN_MS - now);
}
