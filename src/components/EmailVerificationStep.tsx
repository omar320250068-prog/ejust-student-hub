"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, MailCheck } from "lucide-react";
import {
  AUTH_ERROR_TRANSLATION_KEY,
  isAuthErrorCode,
} from "@/lib/auth-messages";
import { isOtpFormat, OTP_RESEND_COOLDOWN_MS } from "@/lib/email-otp";
import { useLanguage, type TranslationKey } from "@/lib/i18n";
import { clearOnboardingDismissed } from "@/lib/onboarding";

interface Props {
  email: string;
  userId?: string | null;
  /** Show a "back to sign in" link instead of calling onBack. */
  backToLogin?: boolean;
  onBack?: () => void;
}

export default function EmailVerificationStep({
  email,
  userId,
  backToLogin = false,
  onBack,
}: Props) {
  const router = useRouter();
  const { t, locale } = useLanguage();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(OTP_RESEND_COOLDOWN_MS / 1000);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = window.setTimeout(() => setSecondsLeft((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [secondsLeft]);

  const messageFor = useCallback(
    (raw: unknown, fallback: TranslationKey): string => {
      if (isAuthErrorCode(raw)) return t(AUTH_ERROR_TRANSLATION_KEY[raw] as TranslationKey);
      if (raw === "verify_failed") return t("auth.verifyFailed");
      void locale;
      return t(fallback);
    },
    [t, locale]
  );

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);

    if (!isOtpFormat(code)) {
      setError(t("auth.verifyInvalidCode"));
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        userId?: string;
      };

      if (!response.ok) {
        setError(messageFor(payload.error, "auth.verifyFailed"));
        return;
      }

      // A recycled browser profile must not keep a previous student's
      // "skip onboarding" choice for this newly verified account.
      const verifiedUserId = payload.userId ?? userId;
      if (verifiedUserId) clearOnboardingDismissed(verifiedUserId);

      router.push("/today?welcome=1");
      router.refresh();
    } catch {
      setError(t("auth.verifyFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  async function resend() {
    if (secondsLeft > 0 || resending) return;
    setError(null);
    setNotice(null);
    setResending(true);
    try {
      const response = await fetch("/api/auth/resend-otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        retryAfterMs?: number;
      };
      if (!response.ok) {
        setError(messageFor(payload.error, "auth.verifyFailed"));
        if (typeof payload.retryAfterMs === "number") {
          setSecondsLeft(Math.ceil(payload.retryAfterMs / 1000));
        }
        return;
      }
      setNotice(t("auth.verifySent"));
      setCode("");
      setSecondsLeft(
        typeof payload.retryAfterMs === "number"
          ? Math.ceil(payload.retryAfterMs / 1000)
          : OTP_RESEND_COOLDOWN_MS / 1000
      );
    } catch {
      setError(t("auth.verifyFailed"));
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-300 text-slate-950">
          <MailCheck size={22} />
        </span>
        <div>
          <h1 className="text-xl font-semibold">{t("auth.verifyTitle")}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-300">
            {t("auth.verifySubtitle", { email })}
          </p>
        </div>
      </div>

      <form onSubmit={submit} className="space-y-4" noValidate>
        <label className="block text-sm font-medium">
          <span>{t("auth.verifyCode")}</span>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder={t("auth.verifyPlaceholder")}
            className="mt-2 w-full rounded-xl border border-white/15 bg-white/10 px-3 py-3 text-center text-2xl font-semibold tracking-[0.5em] text-slate-900 outline-none placeholder:tracking-normal placeholder:text-slate-400 focus:border-cyan-300 focus:ring-2 focus:ring-cyan-950 dark:text-white"
          />
        </label>

        <p className="text-xs text-slate-500 dark:text-slate-400">
          {t("auth.verifyCheckInbox")}
        </p>

        {error && (
          <p role="alert" className="rounded-xl border border-rose-300/30 bg-rose-400/10 px-3 py-2 text-xs text-rose-600 dark:text-rose-200">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="rounded-xl border border-emerald-300/30 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-200">
            {notice}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:opacity-60"
        >
          {submitting && <Loader2 size={15} className="animate-spin" />}
          {submitting ? t("auth.verifyVerifying") : t("auth.verifySubmit")}
        </button>
      </form>

      <div className="flex items-center justify-between gap-3 text-xs">
        <button
          type="button"
          onClick={resend}
          disabled={secondsLeft > 0 || resending}
          className="font-semibold text-cyan-600 hover:underline disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline dark:text-cyan-200"
        >
          {resending
            ? t("auth.verifyVerifying")
            : secondsLeft > 0
              ? t("auth.verifyResendIn", { n: secondsLeft })
              : t("auth.verifyResend")}
        </button>

        {backToLogin ? (
          <Link href="/login" className="text-slate-500 hover:underline dark:text-slate-400">
            {t("auth.verifyBack")}
          </Link>
        ) : onBack ? (
          <button type="button" onClick={onBack} className="text-slate-500 hover:underline dark:text-slate-400">
            {t("auth.verifyChangeEmail")}
          </button>
        ) : null}
      </div>
    </div>
  );
}
