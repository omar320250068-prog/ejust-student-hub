/**
 * Stable, localizable error codes shared by the auth route handlers and the
 * signup/login UI. The API returns codes (never raw provider errors); the UI
 * maps them to i18n keys via `AUTH_ERROR_TRANSLATION_KEY`.
 */
import type { Locale } from "./i18n";

export const AUTH_ERROR_CODES = [
  "invalid_email",
  "email_not_ejust",
  "email_required",
  "invalid_code",
  "otp_expired",
  "too_many_attempts",
  "resend_too_soon",
  "mail_unavailable",
  "account_exists",
  "invalid_credentials",
  "email_not_verified",
  "invalid_name",
  "invalid_password",
  "invalid_request",
  "verify_failed",
] as const;

export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[number];

const TEXT: Record<AuthErrorCode, Record<Locale, string>> = {
  invalid_email: {
    en: "Enter a valid email address.",
    ar: "أدخل بريداً إلكترونياً صحيحاً.",
    ja: "有効なメールアドレスを入力してください。",
  },
  email_not_ejust: {
    en: "Use your E-JUST email (@ejust.edu.eg or @student.ejust.edu.eg).",
    ar: "استخدم بريدك الجامعي (@ejust.edu.eg أو @student.ejust.edu.eg).",
    ja: "E-JUST のメールアドレス（@ejust.edu.eg または @student.ejust.edu.eg）を使用してください。",
  },
  email_required: {
    en: "Enter your university email.",
    ar: "أدخل بريدك الجامعي.",
    ja: "大学のメールアドレスを入力してください。",
  },
  invalid_code: {
    en: "That code is invalid or has expired.",
    ar: "الرمز غير صحيح أو منتهي الصلاحية.",
    ja: "コードが正しくないか、有効期限が切れています。",
  },
  otp_expired: {
    en: "That code has expired. Request a new one.",
    ar: "انتهت صلاحية الرمز. اطلب رمزاً جديداً.",
    ja: "コードの有効期限が切れました。新しいコードを請求してください。",
  },
  too_many_attempts: {
    en: "Too many attempts. Request a new code.",
    ar: "محاولات كثيرة. اطلب رمزاً جديداً.",
    ja: "試行回数が多すぎます。新しいコードを請求してください。",
  },
  resend_too_soon: {
    en: "Please wait a moment before requesting another code.",
    ar: "انتظر قليلاً قبل طلب رمز آخر.",
    ja: "新しいコードを請求するまで少しお待ちください。",
  },
  mail_unavailable: {
    en: "We could not send the email right now. Please try again shortly.",
    ar: "تعذر إرسال البريد حالياً. حاول مرة أخرى قريباً.",
    ja: "現在メールを送信できません。しばらくしてからお試しください。",
  },
  account_exists: {
    en: "An account with this email already exists.",
    ar: "يوجد حساب بهذا البريد بالفعل.",
    ja: "このメールアドレスのアカウントは既に存在します。",
  },
  invalid_credentials: {
    en: "Invalid email or password.",
    ar: "البريد أو كلمة المرور غير صحيحة.",
    ja: "メールまたはパスワードが違います。",
  },
  email_not_verified: {
    en: "Verify your university email before signing in.",
    ar: "تحقق من بريدك الجامعي قبل تسجيل الدخول.",
    ja: "ログイン前に大学メールを確認してください。",
  },
  invalid_name: {
    en: "Name must be between 2 and 80 characters.",
    ar: "الاسم يجب أن يكون بين 2 و 80 حرفاً.",
    ja: "名前は2〜80文字で入力してください。",
  },
  invalid_password: {
    en: "Password must be at least 8 characters.",
    ar: "كلمة المرور يجب أن تكون 8 أحرف على الأقل.",
    ja: "パスワードは8文字以上で入力してください。",
  },
  invalid_request: {
    en: "Invalid request. Please try again.",
    ar: "طلب غير صحيح. حاول مرة أخرى.",
    ja: "リクエストが正しくありません。もう一度お試しください。",
  },
  verify_failed: {
    en: "Could not verify the code. Please try again.",
    ar: "تعذر التحقق من الرمز. حاول مرة أخرى.",
    ja: "コードを確認できませんでした。もう一度お試しください。",
  },
};

/** String keys (typed in the UI as `TranslationKey`) for each error code. */
export const AUTH_ERROR_TRANSLATION_KEY: Record<AuthErrorCode, string> = {
  invalid_email: "auth.emailInvalid",
  email_not_ejust: "auth.emailNotEjust",
  email_required: "auth.emailRequired",
  invalid_code: "auth.verifyInvalidCode",
  otp_expired: "auth.verifyInvalidCode",
  too_many_attempts: "auth.verifyTooMany",
  resend_too_soon: "auth.verifyFailed",
  mail_unavailable: "auth.verifyFailed",
  account_exists: "auth.invalidCredentials",
  invalid_credentials: "auth.invalidCredentials",
  email_not_verified: "auth.emailNotVerified",
  invalid_name: "auth.name",
  invalid_password: "auth.invalidPassword",
  invalid_request: "auth.verifyFailed",
  verify_failed: "auth.verifyFailed",
};

export function isAuthErrorCode(value: unknown): value is AuthErrorCode {
  return typeof value === "string" && AUTH_ERROR_CODES.includes(value as AuthErrorCode);
}

export function authErrorMessage(code: AuthErrorCode, locale: Locale = "en"): string {
  return TEXT[code][locale] ?? TEXT[code].en;
}
