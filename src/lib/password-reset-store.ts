/**
 * Neon persistence for password-reset OTPs. Server-only.
 *
 * This is deliberately a separate table from `email_verification_otp`: that
 * table is keyed by email alone, so reusing it would overwrite a pending
 * signup verification code and would let a reset code verify an email.
 */
import "server-only";
import { neon } from "@neondatabase/serverless";
import {
  canSubmitOtpAttempt,
  constantTimeEqual,
  generateOtpCode,
  hashOtpCode,
  isOtpExpired,
  normalizeEjustEmail,
  otpExpiryDate,
  resendCooldownMs,
  validateEjustEmail,
} from "./email-otp";

type NeonSql = ReturnType<typeof neon>;

function getSql(): NeonSql {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is missing.");
  return neon(url);
}

let schemaReady: Promise<void> | null = null;

function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      const sql = getSql();
      await sql`
        CREATE TABLE IF NOT EXISTS password_reset_otp (
          email text PRIMARY KEY,
          code_hash text NOT NULL,
          expires_at timestamptz NOT NULL,
          attempts integer NOT NULL DEFAULT 0,
          sent_at timestamptz NOT NULL DEFAULT now(),
          created_at timestamptz NOT NULL DEFAULT now()
        )
      `;
    })().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  return schemaReady;
}

export type IssueResult =
  | { ok: true; code: string }
  | { ok: false; retryAfterMs: number };

/** Create (or refresh) a reset code, respecting the 60-second resend cooldown. */
export async function issuePasswordResetOtp(emailInput: string): Promise<IssueResult> {
  const email = normalizeEjustEmail(emailInput);
  if (validateEjustEmail(email) !== "ok") throw new Error("Not an E-JUST email address.");
  await ensureSchema();

  const sql = getSql();
  const rows = (await sql`
    SELECT sent_at FROM password_reset_otp WHERE email = ${email} LIMIT 1
  `) as { sent_at: string | null }[];
  const existing = rows[0];
  if (existing?.sent_at) {
    const retryAfterMs = resendCooldownMs(new Date(existing.sent_at));
    if (retryAfterMs > 0) return { ok: false, retryAfterMs };
  }

  const code = generateOtpCode();
  const codeHash = await hashOtpCode(code);
  const expiresAt = otpExpiryDate();
  await sql`
    INSERT INTO password_reset_otp (email, code_hash, expires_at, attempts, sent_at)
    VALUES (${email}, ${codeHash}, ${expiresAt}, 0, now())
    ON CONFLICT (email) DO UPDATE SET
      code_hash = EXCLUDED.code_hash,
      expires_at = EXCLUDED.expires_at,
      attempts = 0,
      sent_at = now()
  `;
  return { ok: true, code };
}

export type VerifyResult = "ok" | "invalid" | "expired" | "too_many_attempts";

/** Verify a submitted reset code; successful or expired codes are consumed. */
export async function verifyPasswordResetOtp(
  emailInput: string,
  code: string
): Promise<VerifyResult> {
  const email = normalizeEjustEmail(emailInput);
  await ensureSchema();
  const sql = getSql();

  const rows = (await sql`
    SELECT code_hash, expires_at, attempts
    FROM password_reset_otp WHERE email = ${email} LIMIT 1
  `) as { code_hash: string; expires_at: string; attempts: number }[];
  const row = rows[0];
  if (!row) return "invalid";
  if (!canSubmitOtpAttempt(Number(row.attempts))) return "too_many_attempts";
  if (isOtpExpired(new Date(row.expires_at))) {
    await sql`DELETE FROM password_reset_otp WHERE email = ${email}`;
    return "expired";
  }

  const submittedHash = await hashOtpCode(code);
  const matches = constantTimeEqual(String(row.code_hash), submittedHash);

  if (matches) {
    await sql`DELETE FROM password_reset_otp WHERE email = ${email}`;
    return "ok";
  }

  await sql`
    UPDATE password_reset_otp SET attempts = attempts + 1 WHERE email = ${email}
  `;
  return "invalid";
}

/**
 * Only verified accounts with a password hash can reset via this flow. Google
 * accounts (no password) and unknown emails return false so the endpoint can
 * stay non-enumerating.
 */
export async function isPasswordResetEligible(emailInput: string): Promise<boolean> {
  const email = normalizeEjustEmail(emailInput);
  const sql = getSql();
  const rows = (await sql`
    SELECT id FROM "user"
    WHERE "email" = ${email}
      AND "emailVerified" IS NOT NULL
      AND "passwordHash" IS NOT NULL
    LIMIT 1
  `) as { id: string }[];
  return rows.length > 0;
}
