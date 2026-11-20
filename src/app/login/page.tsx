"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { GraduationCap, Loader2, LogIn } from "lucide-react";
import CampusBackground from "@/components/CampusBackground";
import EmailVerificationStep from "@/components/EmailVerificationStep";
import { safeNextPath } from "@/lib/auth-gate";
import { AUTH_ERROR_TRANSLATION_KEY, isAuthErrorCode } from "@/lib/auth-messages";
import { validateEjustEmail } from "@/lib/email-otp";
import { useLanguage, type TranslationKey } from "@/lib/i18n";

export default function LoginPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);

  // Read the query string at interaction time: `useSearchParams` would force a
  // Suspense boundary on this statically rendered page under cacheComponents.
  function currentNextPath() {
    return safeNextPath(new URLSearchParams(window.location.search).get("next"));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const normalized = email.trim().toLowerCase();
    const emailResult = validateEjustEmail(normalized);
    if (emailResult === "not-ejust") return setError(t("auth.emailNotEjust"));
    if (emailResult !== "ok") return setError(t("auth.emailInvalid"));
    if (!password) return setError(t("auth.invalidPassword"));

    setSubmitting(true);
    try {
      const result = await signIn("credentials", {
        email: normalized,
        password,
        redirect: false,
      });

      if (result?.code === "email_not_verified") {
        // Never sign in here: re-trigger the code and verify inline instead.
        const resend = await fetch("/api/auth/resend-otp", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email: normalized }),
        });
        const payload = (await resend.json().catch(() => ({}))) as { error?: string };
        if (!resend.ok && payload.error !== "resend_too_soon") {
          setError(
            isAuthErrorCode(payload.error)
              ? t(AUTH_ERROR_TRANSLATION_KEY[payload.error] as TranslationKey)
              : t("auth.verifyFailed")
          );
          return;
        }
        setNeedsVerification(true);
        return;
      }

      if (result?.error) {
        setError(t("auth.invalidCredentials"));
        return;
      }

      router.push(currentNextPath());
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
        {needsVerification ? (
          <EmailVerificationStep email={email.trim().toLowerCase()} backToLogin />
        ) : (
          <>
            <div className="mb-8 flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-300 text-slate-950">
                <GraduationCap size={22} />
              </span>
              <div>
                <h1 className="text-xl font-semibold">{t("auth.welcome")}</h1>
                <p className="text-sm text-slate-300">{t("auth.subtitle")}</p>
              </div>
            </div>

            <form onSubmit={submit} className="space-y-4" noValidate>
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
              <label className="block text-sm font-medium">
                <span>{t("auth.password")}</span>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-white/15 bg-white/10 px-3 py-3 text-sm text-white outline-none focus:border-cyan-300 focus:ring-2 focus:ring-cyan-950"
                />
              </label>
              <div className="flex justify-end">
                <Link
                  href="/forgot-password"
                  className="text-xs font-medium text-cyan-200 hover:text-white"
                >
                  {t("auth.forgotPassword")}
                </Link>
              </div>
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
                {submitting ? t("auth.signingIn") : t("auth.signIn")}
              </button>
            </form>

            <div className="my-5 flex items-center gap-3 text-xs text-slate-500">
              <span className="h-px flex-1 bg-white/10" />or<span className="h-px flex-1 bg-white/10" />
            </div>
            <button
              type="button"
              onClick={() => signIn("google", { callbackUrl: currentNextPath() })}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-medium text-slate-200 hover:bg-white/10"
            >
              <LogIn size={15} />
              {t("auth.google")}
            </button>
            <p className="mt-5 text-center text-xs text-slate-400">
              {t("auth.newHere")}{" "}
              <Link href="/signup" className="font-semibold text-cyan-200 hover:text-white">
                {t("auth.create")}
              </Link>
            </p>
          </>
        )}
      </div>
    </main>
  );
}
