"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession, signIn } from "next-auth/react";
import Link from "next/link";
import { FileUp, Loader2, Lock, Send, Sparkles } from "lucide-react";
import { MotionSection, ServicePageShell } from "@/components/ServicePageShell";
import { useLanguage, type TranslationKey } from "@/lib/i18n";

type Category = {
  slug: string;
  key: TranslationKey;
  /** Which privilege unlocks this category; `null` is open to everyone. */
  gate: "attachResources" | "submitScholarship" | null;
};

const CATEGORIES: Category[] = [
  { slug: "campus-update", key: "contribute.catCampus", gate: null },
  { slug: "lecture-notes", key: "contribute.catNotes", gate: "attachResources" },
  { slug: "past-papers", key: "contribute.catPastPapers", gate: "attachResources" },
  { slug: "courseware", key: "contribute.catCourseware", gate: "attachResources" },
  { slug: "study-resources", key: "contribute.catStudy", gate: "attachResources" },
  { slug: "scholarship", key: "contribute.catScholarship", gate: "submitScholarship" },
];

interface MeritSnapshot {
  viewer: { points: number; tier: string; effectiveTier: string; isStaff: boolean };
  privileges: { attachResources: boolean; submitScholarship: boolean };
  next: { tier: string; min: number; pointsAway: number } | null;
}

const TIER_KEY: Record<string, TranslationKey> = {
  EXPLORER: "merit.tierExplorer",
  PEER_HELPER: "merit.tierPeerHelper",
  CAMPUS_AMBASSADOR: "merit.tierCampusAmbassador",
  EJUST_MENTOR: "merit.tierEjustMentor",
};

export default function ContributePage() {
  const { status } = useSession();
  const { t } = useLanguage();
  const [category, setCategory] = useState("campus-update");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [merit, setMerit] = useState<MeritSnapshot | null>(null);

  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;

    fetch("/api/merit")
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: MeritSnapshot | null) => {
        if (!cancelled && payload) setMerit(payload);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [status]);

  const selected = useMemo(
    () => CATEGORIES.find((entry) => entry.slug === category) ?? CATEGORIES[0],
    [category]
  );

  const isLocked = (entry: Category) =>
    entry.gate !== null && !merit?.privileges[entry.gate];

  const locked = isLocked(selected);
  const livePoints = merit?.viewer.points ?? null;

  function acceptFile(nextFile: File | undefined) {
    if (!nextFile) return;
    if (nextFile.size > 10 * 1024 * 1024) {
      setMessage(t("contribute.tooBig"));
      return;
    }
    setFile(nextFile);
    setMessage(null);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (status !== "authenticated") {
      await signIn("google");
      return;
    }
    if (!title.trim() || !file) {
      setMessage(t("contribute.needFile"));
      return;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      const response = await fetch("/api/contributions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: selected.slug,
          title: title.trim(),
          data: { fileName: file.name, size: file.size, type: file.type },
        }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "Submission failed");
      }
      setTitle("");
      setFile(null);
      setMessage(t("contribute.submitted"));
    } catch (cause) {
      setMessage(cause instanceof Error && cause.message ? cause.message : t("contribute.failed"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ServicePageShell
      eyebrow={t("contribute.eyebrow")}
      title={t("contribute.headline")}
      description={t("contribute.description")}
    >
      <MotionSection className="mt-8 grid gap-4 lg:grid-cols-[1fr_0.75fr]" delay={0.14}>
        {locked ? (
          <div className="rounded-2xl border border-dashed border-amber-300 bg-amber-50/70 p-6 dark:border-amber-500/40 dark:bg-amber-500/5">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
              <Lock size={18} />
            </span>
            <h2 className="mt-4 text-lg font-semibold text-amber-900 dark:text-amber-100">
              {t("contribute.lockedTitle")}
            </h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-amber-800/80 dark:text-amber-200/80">
              {t("contribute.lockedBody")}
            </p>
            {livePoints !== null && (
              <p className="mt-3 text-sm font-semibold text-amber-900 dark:text-amber-100">
                {livePoints} {t("contribute.livePoints")}
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href="/today"
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-amber-700"
              >
                {t("contribute.lockedCta")}
              </Link>
              <button
                type="button"
                onClick={() => setCategory("campus-update")}
                className="rounded-xl border border-amber-300 px-3.5 py-2 text-sm font-semibold text-amber-800 transition hover:bg-amber-100 dark:border-amber-500/40 dark:text-amber-200 dark:hover:bg-amber-500/10"
              >
                {t("contribute.catCampus")}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700 sm:col-span-2 dark:text-slate-200">
                {t("contribute.resourceTitle")}
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder={t("contribute.titlePlaceholder")}
                  className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-normal outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700 dark:text-slate-200">
                {t("contribute.categories")}
                <select
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-blue-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                >
                  {CATEGORIES.map((entry) => (
                    <option key={entry.slug} value={entry.slug} disabled={isLocked(entry)}>
                      {t(entry.key)}
                      {isLocked(entry) ? " 🔒" : ""}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label
              onDragEnter={() => setDragging(true)}
              onDragLeave={() => setDragging(false)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                acceptFile(event.dataTransfer.files[0]);
              }}
              className={`mt-4 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-5 py-10 text-center transition ${
                dragging
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-500/10"
                  : "border-gray-200 bg-gray-50 hover:border-blue-300 dark:border-slate-700 dark:bg-slate-950/50 dark:hover:border-blue-500/60"
              }`}
            >
              <FileUp size={24} className="text-blue-600 dark:text-blue-400" />
              <span className="mt-3 text-sm font-semibold text-gray-800 dark:text-slate-100">
                {file ? file.name : t("contribute.drop")}
              </span>
              <span className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                {t("contribute.dropHint")}
              </span>
              <input
                type="file"
                accept=".pdf,.doc,.docx,.ppt,.pptx,.png,.jpg,.jpeg"
                onChange={(event) => acceptFile(event.target.files?.[0])}
                className="sr-only"
              />
            </label>
            <button
              type="submit"
              disabled={submitting}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              {submitting ? t("contribute.submitting") : t("contribute.submit")}
            </button>
            {message && (
              <p role="status" className="mt-3 text-sm text-gray-600 dark:text-slate-300">
                {message}
              </p>
            )}
          </form>
        )}

        <aside className="rounded-2xl bg-blue-950 p-6 text-white">
          <Sparkles size={20} className="text-blue-300" />
          <h2 className="mt-5 text-xl font-semibold">{t("contribute.balance")}</h2>
          <p className="mt-2 text-sm leading-6 text-blue-100/70">{t("contribute.balanceHint")}</p>
          <p className="mt-8 text-5xl font-bold">{livePoints ?? "—"}</p>
          <p className="mt-1 text-sm text-blue-200">
            {livePoints === null ? t("merit.signIn") : t("contribute.livePoints")}
          </p>
          {merit && (
            <p className="mt-4 inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-blue-100">
              {t("contribute.tierLabel")}:{" "}
              {t(TIER_KEY[merit.viewer.tier] ?? "merit.tierExplorer")}
            </p>
          )}
          <div className="mt-7 border-t border-white/10 pt-4 text-xs text-blue-100/70">
            <p>{t("contribute.perUpload")}</p>
            <p className="mt-2">{t("contribute.reviewTime")}</p>
          </div>
        </aside>
      </MotionSection>
    </ServicePageShell>
  );
}
