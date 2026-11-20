import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { authErrorMessage, type AuthErrorCode } from "@/lib/auth-messages";
import { isOtpFormat, validateEjustEmail } from "@/lib/email-otp";
import { isPasswordValid } from "@/lib/password-policy";
import { verifyPasswordResetOtp } from "@/lib/password-reset-store";
import { enforceRateLimit } from "@/lib/rate-limit-api";

function fail(code: AuthErrorCode, status: number) {
  return NextResponse.json({ error: code, message: authErrorMessage(code) }, { status });
}

const OTP_ERROR_CODE = {
  invalid: "invalid_code",
  expired: "otp_expired",
  too_many_attempts: "too_many_attempts",
} as const;

export async function POST(request: Request) {
  const limited = await enforceRateLimit(request, "resetVerify");
  if (limited) return limited;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return fail("invalid_request", 400);
  }

  const { email, code, password } = (payload ?? {}) as Record<string, unknown>;

  if (typeof email !== "string" || email.trim().length === 0) {
    return fail("email_required", 400);
  }
  const emailCheck = validateEjustEmail(email);
  if (emailCheck === "not-ejust") return fail("email_not_ejust", 400);
  if (emailCheck !== "ok") return fail("invalid_email", 400);
  if (!isOtpFormat(code)) return fail("invalid_code", 400);
  if (!isPasswordValid(password)) return fail("invalid_password", 400);

  const normalizedEmail = email.trim().toLowerCase();
  const otpLimited = await enforceRateLimit(request, "resetVerify", { email: normalizedEmail });
  if (otpLimited) return otpLimited;

  try {
    const result = await verifyPasswordResetOtp(normalizedEmail, code);
    if (result !== "ok") return fail(OTP_ERROR_CODE[result], 400);

    const passwordHash = await bcrypt.hash(password, 10);
    const updated = await db
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.email, normalizedEmail))
      .returning({ id: users.id });
    if (updated.length === 0) return fail("invalid_request", 400);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[reset-password]", error);
    return fail("invalid_request", 500);
  }
}
