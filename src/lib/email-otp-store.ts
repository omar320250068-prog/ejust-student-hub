/**
 * Neon persistence for E-JUST email verification. Server-only.
 *
 * Schema is created lazily (same pattern as auth-error-store / gmail-store), so
 * deployment does not need a separate migration step. Existing Neon accounts
 * are grandfathered as verified exactly once, keyed by a persisted timestamp:
 * any account created after that timestamp stays unverified.
 */
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
} from "./email-otp.ts";

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
        CREATE TABLE IF NOT EXISTS email_verification_otp (
          email text PRIMARY KEY,
          code_hash text NOT NULL,
          expires_at timestamptz NOT NULL,
          attempts integer NOT NULL DEFAULT 0,
          sent_at timestamptz NOT NULL DEFAULT now(),
          created_at timestamptz NOT NULL DEFAULT now()
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS email_verification_migration (
          id integer PRIMARY KEY,
          ran_at timestamptz NOT NULL DEFAULT now()
        )
      `;
    })().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  return schemaReady;
}

let grandfatherReady: Promise<void> | null = null;

/** Mark only pre-migration accounts verified; newer accounts must use OTP. */
export function ensureGrandfathered(): Promise<void> {
  if (!grandfatherReady) {
    grandfatherReady = (async () => {
      await ensureSchema();
      const sql = getSql();
      await sql`
        INSERT INTO email_verification_migration (id, ran_at)
        VALUES (1, now())
        ON CONFLICT (id) DO NOTHING
      `;
      await sql`
        UPDATE "user"
        SET "emailVerified" = now()
        WHERE "emailVerified" IS NULL
          AND "createdAt" <= (SELECT ran_at FROM email_verification_migration WHERE id = 1)
      `;
    })().catch((error) => {
      grandfatherReady = null;
      throw error;
    });
  }
  return grandfatherReady;
}

export type IssueResult =
  | { ok: true; code: string }
  | { ok: false; retryAfterMs: number };

/** Create (or refresh) a code, respecting the 60-second resend cooldown. */
export async function issueOtp(emailInput: string): Promise<IssueResult> {
  const email = normalizeEjustEmail(emailInput);
  if (validateEjustEmail(email) !== "ok") throw new Error("Not an E-JUST email address.");
  await ensureSchema();

  const sql = getSql();
  const rows = (await sql`
    SELECT sent_at FROM email_verification_otp WHERE email = ${email} LIMIT 1
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
    INSERT INTO email_verification_otp (email, code_hash, expires_at, attempts, sent_at)
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

/** Verify a submitted code; successful or expired codes are consumed. */
export async function verifyOtp(emailInput: string, code: string): Promise<VerifyResult> {
  const email = normalizeEjustEmail(emailInput);
  await ensureSchema();
  const sql = getSql();

  const rows = (await sql`
    SELECT code_hash, expires_at, attempts
    FROM email_verification_otp WHERE email = ${email} LIMIT 1
  `) as { code_hash: string; expires_at: string; attempts: number }[];
  const row = rows[0];
  if (!row) return "invalid";
  if (!canSubmitOtpAttempt(Number(row.attempts))) return "too_many_attempts";
  if (isOtpExpired(new Date(row.expires_at))) {
    await sql`DELETE FROM email_verification_otp WHERE email = ${email}`;
    return "expired";
  }

  const submittedHash = await hashOtpCode(code);
  const matches = constantTimeEqual(String(row.code_hash), submittedHash);

  if (matches) {
    await sql`DELETE FROM email_verification_otp WHERE email = ${email}`;
    return "ok";
  }

  await sql`
    UPDATE email_verification_otp SET attempts = attempts + 1 WHERE email = ${email}
  `;
  return "invalid";
}

/** True / false for an existing user, null when the email is unknown. */
export async function isUserVerified(emailInput: string): Promise<boolean | null> {
  const email = normalizeEjustEmail(emailInput);
  await ensureGrandfathered();
  const sql = getSql();
  const rows = (await sql`
    SELECT "emailVerified" FROM "user" WHERE "email" = ${email} LIMIT 1
  `) as { emailVerified: string | null }[];
  const row = rows[0];
  if (!row) return null;
  return row.emailVerified !== null && row.emailVerified !== undefined;
}

/** Mark the account verified and return its id for the onboarding dismissal key. */
export async function markEmailVerified(emailInput: string): Promise<string | null> {
  const email = normalizeEjustEmail(emailInput);
  await ensureGrandfathered();
  const sql = getSql();
  const rows = (await sql`
    UPDATE "user" SET "emailVerified" = now()
    WHERE "email" = ${email}
    RETURNING id
  `) as { id: string }[];
  const row = rows[0];
  return row?.id ? String(row.id) : null;
}
