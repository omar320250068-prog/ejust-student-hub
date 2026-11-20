import { NextResponse } from "next/server";
import { authErrorMessage, type AuthErrorCode } from "@/lib/auth-messages";
import { validateEjustEmail } from "@/lib/email-otp";
import { sendPasswordResetEmail } from "@/lib/mailer";
import { isPasswordResetEligible, issuePasswordResetOtp } from "@/lib/password-reset-store";
import { enforceRateLimit } from "@/lib/rate-limit-api";

function fail(code: AuthErrorCode, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json(
    { error: code, message: authErrorMessage(code), ...extra },
    { status }
  );
}

export async function POST(request: Request) {
  const limited = await enforceRateLimit(request, "resetRequest");
  if (limited) return limited;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return fail("invalid_request", 400);
  }

  const { email } = (payload ?? {}) as Record<string, unknown>;
  if (typeof email !== "string" || email.trim().length === 0) {
    return fail("email_required", 400);
  }
  const emailCheck = validateEjustEmail(email);
  if (emailCheck === "not-ejust") return fail("email_not_ejust", 400);
  if (emailCheck !== "ok") return fail("invalid_email", 400);

  const normalizedEmail = email.trim().toLowerCase();

  try {
    // Always answer the same way so the endpoint cannot enumerate accounts.
    // Only a verified, password-based account actually receives a code.
    const eligible = await isPasswordResetEligible(normalizedEmail);
    if (eligible) {
      const issued = await issuePasswordResetOtp(normalizedEmail);
      if (issued.ok) {
        const delivered = await sendPasswordResetEmail(normalizedEmail, issued.code);
        if (!delivered.ok) {
          console.error("[forgot-password] no email provider succeeded");
        }
      }
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[forgot-password]", error);
    return NextResponse.json({ ok: true });
  }
}
