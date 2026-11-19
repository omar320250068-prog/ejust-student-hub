import { NextResponse } from "next/server";
import { authErrorMessage, type AuthErrorCode } from "@/lib/auth-messages";
import { OTP_RESEND_COOLDOWN_MS, validateEjustEmail } from "@/lib/email-otp";
import { isUserVerified, issueOtp } from "@/lib/email-otp-store";
import { sendVerificationEmail } from "@/lib/mailer";

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

  const { email } = (payload ?? {}) as Record<string, unknown>;
  if (typeof email !== "string" || validateEjustEmail(email) !== "ok") {
    return fail("email_not_ejust", 400);
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    // Already-verified or unknown accounts return success without sending, so
    // this endpoint cannot be used to enumerate registered students.
    const verified = await isUserVerified(normalizedEmail);
    if (verified !== false) {
      return NextResponse.json({ ok: true, retryAfterMs: OTP_RESEND_COOLDOWN_MS });
    }

    const issued = await issueOtp(normalizedEmail);
    if (!issued.ok) {
      return fail("resend_too_soon", 429, { retryAfterMs: issued.retryAfterMs });
    }

    const delivered = await sendVerificationEmail(normalizedEmail, issued.code);
    if (!delivered.ok) return fail("mail_unavailable", 503);

    return NextResponse.json({ ok: true, retryAfterMs: OTP_RESEND_COOLDOWN_MS });
  } catch (error) {
    console.error("[resend-otp]", error);
    return fail("verify_failed", 500);
  }
}
