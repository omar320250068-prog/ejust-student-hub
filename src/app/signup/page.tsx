"use client";

import { useState } from "react";
import Link from "next/link";
import { GraduationCap, Loader2 } from "lucide-react";
import EmailVerificationStep from "@/components/EmailVerificationStep";
import {
  AUTH_ERROR_TRANSLATION_KEY,
  isAuthErrorCode,
} from "@/lib/auth-messages";
import { validateEjustEmail } from "@/lib/email-otp";
import { useLanguage, type TranslationKey } from "@/lib/i18n";

export default function SignUpPage() {
  const { t } = useLanguage();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirm: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [verification, setVerification] = useState<{
    email: string;
    userId: string | null;
  } | null>(null);

  const update = (field: keyof typeof form) => (value: string) =>
    setForm((current) => ({ ...current, [field]: value }));

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const name = form.name.trim();
    const email = form.email.trim().toLowerCase();

    if (name.length < 2) return setError(t("auth.invalidName"));
    if (!email) return setError(t("auth.emailRequired"));
    const emailResult = validateEjustEmail(email);
    if (emailResult === "not-ejust") return setError(t("auth.emailNotEjust"));
    if (emailResult !== "ok") return setError(t("auth.emailInvalid"));
    if (form.password.length < 8) return setError(t("auth.invalidPassword"));
    if (form.password !== form.confirm) return setError(t("auth.invalidPassword"));

    setSubmitting(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, email, password: form.password }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        email?: string;
        userId?: string;
      };

      if (!response.ok) {
        setError(
          isAuthErrorCode(payload.error)
            ? t(AUTH_ERROR_TRANSLATION_KEY[payload.error] as TranslationKey)
            : t("auth.verifyFailed")
        );
        return;
      }

      // No session is created here: the inline OTP step must succeed first.
      setVerification({ email: payload.email ?? email, userId: payload.userId ?? null });
    } catch {
      setError(t("auth.network"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        {verification ? (
          <EmailVerificationStep
            email={verification.email}
            userId={verification.userId}
            onBack={() => setVerification(null)}
          />
        ) : (
          <>
            <div className="mb-6 flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600">
                <GraduationCap size={18} className="text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900">Create your account</h1>
                <p className="text-xs text-gray-500">
                  Save your GPA, timetable and data across devices
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-3" noValidate>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-gray-600">{t("auth.name")}</span>
                <input
                  type="text"
                  autoComplete="name"
                  value={form.name}
                  onChange={(event) => update("name")(event.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder={t("auth.namePlaceholder")}
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-gray-600">{t("auth.email")}</span>
                <input
                  type="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={(event) => update("email")(event.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="you@student.ejust.edu.eg"
                />
                <span className="text-[11px] text-gray-400">
                  @ejust.edu.eg or @student.ejust.edu.eg
                </span>
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-gray-600">{t("auth.password")}</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(event) => update("password")(event.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="At least 8 characters"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-gray-600">
                  Confirm password
                </span>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={form.confirm}
                  onChange={(event) => update("confirm")(event.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="Repeat your password"
                />
              </label>

              {error && (
                <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="mt-1 flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting && <Loader2 size={15} className="animate-spin" />}
                {submitting ? "Creating account…" : "Create account"}
              </button>
            </form>

            <p className="mt-4 text-center text-xs text-gray-500">
              Already have an account?{" "}
              <Link href="/login" className="font-medium text-blue-700 hover:underline">
                Sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </main>
  );
}
