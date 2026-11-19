"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  ArrowLeft, ArrowRight, Check, ClipboardPaste, ExternalLink, GraduationCap, Loader2, Sparkles, X,
} from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import {
  persistSisSyncState,
  SIS_SYNC_STORAGE_KEY,
  useSyncedCourses,
  type SisSyncState,
} from "@/components/SisSyncGuide";
import {
  ACADEMIC_YEARS,
  ONBOARDING_FACULTIES,
  ONBOARDING_TRACKS,
  SECTIONS,
  isOnboardingDismissed,
  markOnboardingDismissed,
  readAcademicProfile,
  saveAcademicProfile,
  shouldShowOnboarding,
  type AcademicProfile,
  type OnboardingFaculty,
  type OnboardingTrack,
} from "@/lib/onboarding";

const PROFILE_FEATURE = "academic-profile";
const EXTENSION_URL = "/downloads/ejust-hub-sync-extension.zip";
const SIS_URL = "https://sis.ejust.edu.eg";

const DEFAULT_PROFILE: AcademicProfile = {
  faculty: "CSIT",
  year: 1,
  group: "1",
  track: "CSC",
  section: "1",
};

const FACULTY_LABEL: Record<
  OnboardingFaculty,
  "onboarding.csit" | "onboarding.foe" | "onboarding.fibh"
> = {
  CSIT: "onboarding.csit",
  FOE: "onboarding.foe",
  FIBH: "onboarding.fibh",
};

const selectClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white";

/** Read SIS state directly so the gate never opens before the hook re-renders. */
function storedSyncedCourseCount(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.localStorage.getItem(SIS_SYNC_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as { courses?: unknown }) : null;
    return Array.isArray(parsed?.courses) ? parsed.courses.length : 0;
  } catch {
    return 0;
  }
}

/**
 * Two-step first-visit wizard. It opens only for authenticated students with
 * no academic profile, no synced SIS courses and no prior dismissal.
 */
export default function OnboardingWizard() {
  const { locale, t } = useLanguage();
  const { data: session, status } = useSession();
  const synced = useSyncedCourses();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<0 | 1>(0);
  const [draft, setDraft] = useState<AcademicProfile>(DEFAULT_PROFILE);
  const [paste, setPaste] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const userId = session?.user?.id;
  const isRtl = locale === "ar";
  const NextIcon = isRtl ? ArrowLeft : ArrowRight;
  const BackIcon = isRtl ? ArrowRight : ArrowLeft;

  useEffect(() => {
    if (status !== "authenticated" || !userId) return;
    // Defer the gate to the next tick so synced SIS state has settled and the
    // modal never flashes for students who have already imported courses.
    const timer = window.setTimeout(() => {
      const show = shouldShowOnboarding({
        authenticated: true,
        profile: readAcademicProfile(),
        syncedCourseCount: storedSyncedCourseCount(),
        dismissed: isOnboardingDismissed(userId),
      });
      if (show) setOpen(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [status, userId]);

  const dismiss = useCallback(() => {
    if (userId) markOnboardingDismissed(userId);
    setOpen(false);
  }, [userId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, dismiss]);

  /** Step 1 is committed before the student can move on, not at the end. */
  const commitProfile = useCallback(() => {
    const saved = saveAcademicProfile(draft);
    if (status === "authenticated") {
      void fetch("/api/user-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feature: PROFILE_FEATURE, data: saved }),
      }).catch(() => {
        // The mirror is best-effort; localStorage remains authoritative here.
      });
    }
  }, [draft, status]);

  async function importCourses() {
    if (paste.trim().length < 20) {
      setMessage({ text: t("onboarding.error"), ok: false });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/student/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText: paste }),
      });
      const data = (await response.json()) as Partial<SisSyncState> & { error?: string };
      if (!response.ok || !Array.isArray(data.courses)) {
        throw new Error(data.error ?? "Sync failed");
      }
      persistSisSyncState({
        courses: data.courses,
        summary: data.summary ?? {
          cgpa: 0,
          completedCredits: 0,
          remainingCredits: 134,
          progressPercent: 0,
          courseCount: data.courses.length,
        },
        syncToken: data.syncToken,
        syncedAt: data.syncedAt,
      });
      setMessage({ text: t("onboarding.imported"), ok: true });
    } catch {
      setMessage({ text: t("onboarding.error"), ok: false });
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
      dir={isRtl ? "rtl" : "ltr"}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-white/20 bg-white shadow-2xl dark:bg-slate-900"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 p-5 dark:border-slate-700">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-cyan-600 text-white">
              <GraduationCap size={20} />
            </span>
            <div>
              <h2 id="onboarding-title" className="text-lg font-semibold text-slate-900 dark:text-white">
                {t("onboarding.welcome")}
              </h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t("onboarding.subtitle")}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label={t("onboarding.skip")}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-5">
          <div className="mb-5 flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-cyan-700 dark:text-cyan-300">
            <span className={`grid size-5 place-items-center rounded-full ${step === 0 ? "bg-cyan-600 text-white" : "bg-cyan-100 dark:bg-cyan-900"}`}>
              1
            </span>
            {t("onboarding.stepProfile")}
            <span className="mx-1 h-px min-w-6 flex-1 bg-slate-200 dark:bg-slate-700" />
            <span className={`grid size-5 place-items-center rounded-full ${step === 1 ? "bg-cyan-600 text-white" : "bg-cyan-100 dark:bg-cyan-900"}`}>
              2
            </span>
            {t("onboarding.stepImport")}
          </div>

          {step === 0 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  {t("onboarding.faculty")}
                </span>
                <select
                  value={draft.faculty}
                  onChange={(event) => {
                    const faculty = event.target.value as OnboardingFaculty;
                    setDraft((current) => ({
                      ...current,
                      faculty,
                      track: faculty === "CSIT" ? current.track : "General",
                    }));
                  }}
                  className={selectClass}
                >
                  {ONBOARDING_FACULTIES.map((faculty) => (
                    <option key={faculty} value={faculty}>
                      {faculty} — {t(FACULTY_LABEL[faculty])}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  {t("onboarding.year")}
                </span>
                <select
                  value={draft.year}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      year: Number(event.target.value) as AcademicProfile["year"],
                    }))
                  }
                  className={selectClass}
                >
                  {ACADEMIC_YEARS.map((year) => (
                    <option key={year} value={year}>
                      {t("onboarding.year")} {year}
                    </option>
                  ))}
                </select>
              </label>

              {draft.faculty === "CSIT" && (
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                    {t("onboarding.track")}
                  </span>
                  <select
                    value={draft.track}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        track: event.target.value as OnboardingTrack,
                      }))
                    }
                    className={selectClass}
                  >
                    {ONBOARDING_TRACKS.map((track) => (
                      <option key={track} value={track}>
                        {track === "General" ? t("onboarding.general") : track}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  {t("onboarding.section")}
                </span>
                <select
                  value={draft.section}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, section: event.target.value }))
                  }
                  className={selectClass}
                >
                  {SECTIONS.map((section) => (
                    <option key={section} value={section}>
                      {section}
                    </option>
                  ))}
                </select>
              </label>

              <p className="sm:col-span-2 rounded-xl bg-cyan-50 p-3 text-xs text-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-200">
                {t("onboarding.profileHint")}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                  <Sparkles size={15} className="text-cyan-500" />
                  {t("onboarding.pasteTitle")}
                </h3>
                <p className="mt-1.5 text-xs leading-5 text-slate-500 dark:text-slate-400">
                  {t("onboarding.pasteHint")}{" "}
                  <a href={SIS_URL} target="_blank" rel="noreferrer" className="font-semibold text-cyan-600 hover:underline">
                    sis.ejust.edu.eg
                  </a>
                </p>
              </div>
              <textarea
                value={paste}
                onChange={(event) => setPaste(event.target.value)}
                rows={6}
                placeholder={t("onboarding.pastePlaceholder")}
                className={`${selectClass} resize-y font-mono text-xs`}
              />
              {message && (
                <p
                  role="status"
                  className={`rounded-xl p-3 text-xs ${message.ok ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"}`}
                >
                  {message.text}
                </p>
              )}
              <a
                href={EXTENSION_URL}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-700 hover:underline dark:text-cyan-300"
              >
                {t("onboarding.autoSync")}
                <ExternalLink size={13} />
              </a>
              <p className="text-xs text-slate-400">{t("onboarding.maybeLater")}</p>
              {synced.courses.length > 0 && (
                <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  ✓ {synced.courses.length}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-4 dark:border-slate-700">
          <button
            type="button"
            onClick={step === 0 ? dismiss : () => setStep(0)}
            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            {step === 0 ? <X size={14} /> : <BackIcon size={14} />}
            {step === 0 ? t("onboarding.skip") : t("onboarding.back")}
          </button>

          {step === 0 ? (
            <button
              type="button"
              onClick={() => {
                commitProfile();
                setMessage(null);
                setStep(1);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-600 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-cyan-700"
            >
              {t("onboarding.next")}
              <NextIcon size={14} />
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={importCourses}
                disabled={busy || paste.trim().length < 20}
                className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-200 px-3 py-2.5 text-xs font-semibold text-cyan-700 transition hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-cyan-800 dark:text-cyan-300 dark:hover:bg-cyan-950/40"
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : <ClipboardPaste size={14} />}
                {busy ? t("onboarding.importing") : t("onboarding.import")}
              </button>
              <button
                type="button"
                onClick={dismiss}
                className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-600 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-cyan-700"
              >
                <Check size={14} />
                {t("onboarding.finish")}
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
