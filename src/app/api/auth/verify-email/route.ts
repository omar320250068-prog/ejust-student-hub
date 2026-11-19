import { NextResponse } from "next/server";
import { signIn } from "@/auth";
import { authErrorMessage, type AuthErrorCode } from "@/lib/auth-messages";
import { isOtpFormat, validateEjustEmail } from "@/lib/email-otp";
import { createOtpGrant } from "@/lib/email-otp-grant";
import { markEmailVerified, verifyOtp } from "@/lib/email-otp-store";

function fail(code: AuthErrorCode, status: number) {
  return NextResponse.json({ error: code, message: authErrorMessage(code) }, { status });
}

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return fail("invalid_request", 400);
  }

  const { email, code } = (payload ?? {}) as Record<string, unknown>;

  if (typeof email !== "string" || validateEjustEmail(email) !== "ok") {
    return fail("email_not_ejust", 400);
  }
  if (!isOtpFormat(code)) return fail("invalid_code", 400);

  const normalizedEmail = email.trim().toLowerCase();

  let result: Awaited<ReturnType<typeof verifyOtp>>;
  try {
    result = await verifyOtp(normalizedEmail, code);
  } catch (error) {
    console.error("[verify-email]", error);
    return fail("verify_failed", 500);
  }

  if (result === "too_many_attempts") return fail("too_many_attempts", 429);
  if (result === "expired") return fail("otp_expired", 400);
  if (result === "invalid") return fail("invalid_code", 400);

  let userId: string | null;
  try {
    userId = await markEmailVerified(normalizedEmail);
  } catch (error) {
    console.error("[verify-email] mark verified", error);
    return fail("verify_failed", 500);
  }
  if (!userId) return fail("verify_failed", 500);

  // The grant never reaches the browser: it is exchanged for an Auth.js session
  // cookie by the dedicated credentials provider.
  try {
    const grant = await createOtpGrant(normalizedEmail);
    const signInResult = await signIn("email-otp", {
      grant,
      redirect: false,
      redirectTo: "/today?welcome=1",
    });
    if (typeof signInResult === "string") {
      const callback = new URL(signInResult, request.url);
      if (callback.searchParams.has("error")) {
        console.error("[verify-email] signIn rejected", callback.searchParams.get("error"));
        return fail("verify_failed", 500);
      }
    }
  } catch (error) {
    console.error("[verify-email] signIn", error);
    return fail("verify_failed", 500);
  }

  return NextResponse.json({ ok: true, userId });
}
