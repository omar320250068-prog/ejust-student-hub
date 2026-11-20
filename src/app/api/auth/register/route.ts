import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { parseAccountType, registrationRoleFields } from "@/lib/account-type";
import { authErrorMessage, type AuthErrorCode } from "@/lib/auth-messages";
import { validateEjustEmail } from "@/lib/email-otp";
import { ensureGrandfathered, issueOtp } from "@/lib/email-otp-store";
import { sendVerificationEmail } from "@/lib/mailer";
import { enforceRateLimit } from "@/lib/rate-limit-api";
import { isPasswordValid } from "@/lib/password-policy";

function fail(code: AuthErrorCode, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json(
    { error: code, message: authErrorMessage(code), ...extra },
    { status }
  );
}

export async function POST(request: Request) {
  const limited = await enforceRateLimit(request, "register");
  if (limited) return limited;

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return fail("invalid_request", 400);
  }

  const { name, email, password, accountType } = (payload ?? {}) as Record<string, unknown>;

  if (typeof name !== "string" || name.trim().length < 2 || name.trim().length > 80) {
    return fail("invalid_name", 400);
  }

  if (typeof email !== "string" || email.trim().length === 0) {
    return fail("email_required", 400);
  }

  const emailCheck = validateEjustEmail(email);
  if (emailCheck === "not-ejust") return fail("email_not_ejust", 400);
  if (emailCheck !== "ok") return fail("invalid_email", 400);

  if (!isPasswordValid(password)) return fail("invalid_password", 400);

  const selectedAccountType = parseAccountType(accountType);
  if (!selectedAccountType) return fail("invalid_request", 400);

  const normalizedEmail = email.trim().toLowerCase();
  const otpLimited = await enforceRateLimit(request, "otpSend", { email: normalizedEmail });
  if (otpLimited) return otpLimited;

  const roleFields = registrationRoleFields(selectedAccountType);

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
    // Self-selected TAs are queued for admin review; staff tools stay gated
    // until an admin sets taStatus to APPROVED.
    const [created] = await db
      .insert(users)
      .values({
        name: name.trim(),
        email: normalizedEmail,
        passwordHash,
        ...roleFields,
      })
      .returning({ id: users.id, email: users.email, role: users.role, taStatus: users.taStatus });

    return NextResponse.json(
      {
        ok: true,
        email: created.email,
        userId: created.id,
        role: created.role,
        taStatus: created.taStatus,
      },
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
