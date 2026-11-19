import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { authErrorMessage, type AuthErrorCode } from "@/lib/auth-messages";
import { validateEjustEmail } from "@/lib/email-otp";
import { ensureGrandfathered, issueOtp } from "@/lib/email-otp-store";
import { sendVerificationEmail } from "@/lib/mailer";

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_BYTES = 72;

function fail(code: AuthErrorCode, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json(
    { error: code, message: authErrorMessage(code), ...extra },
    { status }
  );
}

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return fail("invalid_request", 400);
  }

  const { name, email, password } = (payload ?? {}) as Record<string, unknown>;

  if (typeof name !== "string" || name.trim().length < 2 || name.trim().length > 80) {
    return fail("invalid_name", 400);
  }

  if (typeof email !== "string" || email.trim().length === 0) {
    return fail("email_required", 400);
  }

  const emailCheck = validateEjustEmail(email);
  if (emailCheck === "not-ejust") return fail("email_not_ejust", 400);
  if (emailCheck !== "ok") return fail("invalid_email", 400);

  if (
    typeof password !== "string" ||
    password.length < MIN_PASSWORD_LENGTH ||
    Buffer.byteLength(password, "utf8") > MAX_PASSWORD_BYTES
  ) {
    return fail("invalid_password", 400);
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    // Accounts created before this one-time migration are already verified.
    await ensureGrandfathered();

    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);
    if (existing.length > 0) return fail("account_exists", 409);

    const issued = await issueOtp(normalizedEmail);
    if (!issued.ok) {
      return fail("resend_too_soon", 429, { retryAfterMs: issued.retryAfterMs });
    }

    const delivered = await sendVerificationEmail(normalizedEmail, issued.code);
    if (!delivered.ok) return fail("mail_unavailable", 503);

    const passwordHash = await bcrypt.hash(password, 10);
    // No emailVerified value: the account stays unverified until OTP success.
    const [created] = await db
      .insert(users)
      .values({ name: name.trim(), email: normalizedEmail, passwordHash })
      .returning({ id: users.id, email: users.email });

    return NextResponse.json(
      { ok: true, email: created.email, userId: created.id },
      { status: 201 }
    );
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      return fail("account_exists", 409);
    }
    console.error("[register]", error);
    return fail("invalid_request", 500);
  }
}
