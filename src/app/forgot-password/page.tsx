"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2 } from "lucide-react";
import CampusBackground from "@/components/CampusBackground";
import { AUTH_ERROR_TRANSLATION_KEY, isAuthErrorCode } from "@/lib/auth-messages";
import { isOtpFormat, validateEjustEmail } from "@/lib/email-otp";
import { useLanguage, type TranslationKey } from "@/lib/i18n";
import { MIN_PASSWORD_LENGTH } from "@/lib/password-policy";

export default function ForgotPasswordPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const [step, setStep] = useState<"email" | "reset">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function messageFor(payload: { error?: string }): string {
    return isAuthErrorCode(payload.error)
      ? t(AUTH_ERROR_TRANSLATION_KEY[payload.error] as TranslationKey)
      : t("auth.verifyFailed");
  }

  async function requestCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);

    const normalized = email.trim().toLowerCase();
    const emailResult = validateEjustEmail(normalized);
    if (emailResult === "not-ejust") return setError(t("auth.emailNotEjust"));
    if (emailResult !== "ok") return setError(t("auth.emailInvalid"));

    setEmail(normalized);
    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: normalized }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) return setError(messageFor(payload));

      setNotice(t("auth.resetEmailSent"));
      setStep("reset");
    } catch {
      setError(t("auth.network"));
    } finally {
      setSubmitting(false);
    }
  }

  async function submitReset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!isOtpFormat(code)) return setError(t("auth.verifyInvalidCode"));
    if (password.length < MIN_PASSWORD_LENGTH) return setError(t("auth.invalidPassword"));

    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, code, password }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) return setError(messageFor(payload));

      router.push("/login");
      router.refresh();
    } catch {
      setError(t("auth.network"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-glass-page relative flex min-h-[calc(100vh-3rem)] items-center justify-center overflow-hidden bg-slate-50/60 px-4 py-10 text-slate-900 dark:bg-slate-950/60 dark:text-white">
      <CampusBackground image="/images/campus/main-gate.jpg.png" />
      <div className="relative w-full max-w-md rounded-[2rem] border border-slate-200/80 bg-white/80 p-7 shadow-2xl backdrop-blur-xl dark:border-white/20 dark:bg-slate-900/50 dark:text-white sm:p-9">
        <div className="mb-8 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-300 text-slate-950">
            <KeyRound size={22} />
          </span>
          <div>
            <h1 className="text-xl font-semibold">{t("auth.resetTitle")}</h1>
            <p className="text-sm text-slate-300">{t("auth.resetSubtitle")}</p>
          </div>
        </div>

        {step === "email" ? (
          <form onSubmit={requestCode} className="space-y-4" noValidate>
            <label className="block text-sm font-medium">
              <span>{t("auth.email")}</span>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@ejust.edu.eg"
                className="mt-2 w-full rounded-xl border border-white/15 bg-white/10 px-3 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-300 focus:ring-2 focus:ring-cyan-950"
              />
            </label>
            {error && (
              <p role="alert" className="rounded-xl border border-rose-300/30 bg-rose-400/10 px-3 py-2 text-xs text-rose-200">
                {error}
              </p>
            )}
            <button
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:opacity-60"
            >
              {submitting && <Loader2 size={15} className="animate-spin" />}
              {submitting ? t("auth.resetSending") : t("auth.resetSendCode")}
            </button>
          </form>
        ) : (
          <form onSubmit={submitReset} className="space-y-4" noValidate>
            {notice && (
              <p role="status" className="rounded-xl border border-emerald-300/30 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-200">
                {notice}
              </p>
            )}
            <p className="text-xs text-slate-400">{email}</p>
            <label className="block text-sm font-medium">
              <span>{t("auth.resetCode")}</span>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                className="mt-2 w-full rounded-xl border border-white/15 bg-white/10 px-3 py-3 text-sm tracking-[0.4em] text-white outline-none placeholder:text-slate-500 focus:border-cyan-300 focus:ring-2 focus:ring-cyan-950"
              />
            </label>
            <label className="block text-sm font-medium">
              <span>{t("auth.resetNewPassword")}</span>
              <input
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-2 w-full rounded-xl border border-white/15 bg-white/10 px-3 py-3 text-sm text-white outline-none focus:border-cyan-300 focus:ring-2 focus:ring-cyan-950"
              />
              <span className="mt-1 block text-xs font-normal text-slate-400">{t("auth.resetHint")}</span>
            </label>
            {error && (
              <p role="alert" className="rounded-xl border border-rose-300/30 bg-rose-400/10 px-3 py-2 text-xs text-rose-200">
                {error}
              </p>
            )}
            <button
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:opacity-60"
            >
              {submitting && <Loader2 size={15} className="animate-spin" />}
              {submitting ? t("auth.resetSubmitting") : t("auth.resetSubmit")}
            </button>
          </form>
        )}

        <p className="mt-5 text-center text-xs text-slate-400">
          <Link href="/login" className="font-semibold text-cyan-200 hover:text-white">
            {t("auth.resetBack")}
          </Link>
        </p>
      </div>
    </main>
  );
}
