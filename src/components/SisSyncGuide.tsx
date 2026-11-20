"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  Check,
  ClipboardPaste,
  Copy,
  Download,
  ExternalLink,
  GraduationCap,
  Info,
  Loader2,
  RefreshCw,
  Smartphone,
  Sparkles,
  X,
} from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { scopedStorageKey, type StorageUser } from "@/lib/user-scoped-storage";
import type { ParsedSisCourse, SisSummaryMetadata, SisTableType } from "@/lib/sis-parser";
import type { SyncedCourse, SyncSummary } from "@/lib/sis-sync";

export const SIS_SYNC_STORAGE_KEY = "ejust:sis-sync";
const SYNC_EVENT = "ejust:sis-synced";

function syncStorageKey(user?: StorageUser | null): string {
  return scopedStorageKey("sis-sync", user);
}
const SYNC_TOKEN_MESSAGE = "EJUST_HUB_SYNC_TOKEN";
const API_URL = "/api/student/sync";
const EXTENSION_ZIP = "/downloads/ejust-hub-sync-extension.zip";

/** Pair the extension without a copy/paste step. Target origin is always the hub itself. */
function broadcastSyncToken(token: string | undefined | null) {
  if (!token || typeof window === "undefined") return;
  window.postMessage({ type: SYNC_TOKEN_MESSAGE, token }, window.location.origin);
}

export interface SisSyncState {
  courses: SyncedCourse[];
  summary: SyncSummary;
  syncToken?: string;
  syncedAt?: string;
}

const EMPTY_SUMMARY: SyncSummary = {
  cgpa: 0,
  completedCredits: 0,
  remainingCredits: 134,
  progressPercent: 0,
  courseCount: 0,
};

const EMPTY_STATE: SisSyncState = { courses: [], summary: EMPTY_SUMMARY };

/** Shared read access to the synced course list for the hub pages. */
export function useSyncedCourses(): SisSyncState {
  const { data: session, status } = useSession();
  const [state, setState] = useState<SisSyncState>(EMPTY_STATE);
  const storageKey = syncStorageKey(
    status === "authenticated" ? session?.user : null,
  );

  useEffect(() => {
    const read = () => {
      try {
        const raw = window.localStorage.getItem(storageKey);
        if (!raw) {
          setState(EMPTY_STATE);
          return;
        }
        const parsed = JSON.parse(raw) as SisSyncState;
        setState(Array.isArray(parsed.courses) ? parsed : EMPTY_STATE);
      } catch {
        setState(EMPTY_STATE);
      }
    };
    read();
    window.addEventListener(SYNC_EVENT, read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener(SYNC_EVENT, read);
      window.removeEventListener("storage", read);
    };
  }, [storageKey]);

  // A restored or newly issued token is broadcast on every hub page that uses
  // this hook, so opening the hub is enough to pair the extension.
  useEffect(() => {
    broadcastSyncToken(state.syncToken);
  }, [state.syncToken]);

  return state;
}

/** Shared write access so the onboarding wizard can persist Smart Paste imports. */
export function persistSisSyncState(state: SisSyncState, user?: StorageUser | null) {
  window.localStorage.setItem(syncStorageKey(user), JSON.stringify(state));
  window.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail: state }));
  broadcastSyncToken(state.syncToken);
}

function readStoredSync(user?: StorageUser | null): SisSyncState {
  if (typeof window === "undefined") return EMPTY_STATE;
  try {
    const raw = window.localStorage.getItem(syncStorageKey(user));
    if (!raw) return EMPTY_STATE;
    const parsed = JSON.parse(raw) as SisSyncState;
    if (Array.isArray(parsed.courses)) return parsed;
  } catch {
    // Ignore corrupt local state.
  }
  return EMPTY_STATE;
}

interface EditableRow {
  courseCode: string;
  courseName: string;
  creditHours: string;
  grade: string;
  semester: string;
  sections?: string[];
}

function toEditableRow(course: ParsedSisCourse | SyncedCourse): EditableRow {
  return {
    courseCode: course.courseCode,
    courseName: course.courseName ?? "",
    creditHours: String(course.creditHours ?? 3),
    grade: course.grade ?? "",
    semester: course.semester ?? "",
    sections: course.sections,
  };
}

const GRADE_CHOICES = ["", "A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D+", "D", "F"];

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";

/** Compact invitation shown near the top of each study page. */
export function SisGuideBanner({ onOpen }: { onOpen: () => void }) {
  const { t } = useLanguage();
  const { courses } = useSyncedCourses();

  return (
    <div className="print:hidden mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-cyan-200 bg-cyan-50 p-3 text-sm text-cyan-900 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-100">
      <div className="flex items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-cyan-600 text-white">
          <GraduationCap size={18} />
        </span>
        <div>
          <p className="font-semibold">{t("sis.banner")}</p>
          <p className="text-xs opacity-80">
            {courses.length > 0
              ? `${t("sis.mySynced")}: ${courses.length}`
              : t("sis.bannerHint")}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onOpen}
        className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-cyan-700"
      >
        <Sparkles size={14} />
        {t("sis.open")}
      </button>
    </div>
  );
}

/** Full guided import dialog with the three numbered steps. */
export function SisSyncModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t, locale } = useLanguage();
  const { data: session, status } = useSession();
  const storageUser = status === "authenticated" ? session?.user : null;
  const [rawText, setRawText] = useState("");
  const [rows, setRows] = useState<EditableRow[]>(() => readStoredSync(storageUser).courses.map(toEditableRow));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [state, setState] = useState<SisSyncState>(() => readStoredSync(storageUser));
  const [copied, setCopied] = useState(false);
  const [metadata, setMetadata] = useState<SisSummaryMetadata | null>(null);
  const [tableType, setTableType] = useState<SisTableType>("unknown");

  const isArabic = locale === "ar";

  useEffect(() => {
    if (!open || status !== "authenticated") return;
    let cancelled = false;
    fetch(API_URL)
      .then((response) => (response.ok ? response.json() : null))
      .then((data: SisSyncState | null) => {
        if (cancelled || !data || !Array.isArray(data.courses)) return;
        setState(data);
        persistSisSyncState(data, storageUser);
        setRows((current) => (current.length > 0 ? current : data.courses.map(toEditableRow)));
      })
      .catch(() => {
        // Keep any previously persisted state.
      });
    return () => {
      cancelled = true;
    };
  }, [open, status, storageUser]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const updateRow = useCallback((index: number, field: keyof EditableRow, value: string) => {
    setRows((current) =>
      current.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  }, []);

  const removeRow = useCallback((index: number) => {
    setRows((current) => current.filter((_, i) => i !== index));
  }, []);

  async function detect() {
    setBusy(true);
    setMessage(null);
    setMetadata(null);
    setTableType("unknown");
    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText, dryRun: true }),
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage({ text: data.error || t("sis.error"), ok: false });
        return;
      }
      const detected: ParsedSisCourse[] = data.courses ?? [];
      setMetadata(data.metadata ?? null);
      setTableType(data.tableType ?? "unknown");
      if (detected.length === 0) {
        setMessage({ text: t("sis.noCourses"), ok: false });
        setRows([]);
        return;
      }
      setRows(detected.map(toEditableRow));
      setMessage({ text: t("sis.previewHint"), ok: true });
    } catch {
      setMessage({ text: t("sis.error"), ok: false });
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (rows.length === 0) {
      setMessage({ text: t("sis.noCourses"), ok: false });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courses: rows.map((row) => ({
            courseCode: row.courseCode,
            courseName: row.courseName,
            creditHours: Number(row.creditHours),
            grade: row.grade || null,
            semester: row.semester,
          })),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage({ text: data.error || t("sis.error"), ok: false });
        return;
      }
      const next: SisSyncState = {
        courses: data.courses ?? [],
        summary: data.summary,
        syncToken: data.syncToken,
        syncedAt: data.syncedAt,
      };
      setState(next);
      persistSisSyncState(next, storageUser);
      setRows(next.courses.map(toEditableRow));
      setMessage({ text: t("sis.success"), ok: true });
    } catch {
      setMessage({ text: t("sis.error"), ok: false });
    } finally {
      setBusy(false);
    }
  }

  async function copyToken() {
    if (!state.syncToken) return;
    try {
      await navigator.clipboard.writeText(state.syncToken);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  if (!open) return null;

  const steps = [
    {
      number: 1,
      title: t("sis.step1"),
      detail: t("sis.step1Detail"),
      icon: <ExternalLink size={16} />,
    },
    {
      number: 2,
      title: t("sis.step2"),
      detail: t("sis.step2Detail"),
      icon: <ClipboardPaste size={16} />,
    },
    {
      number: 3,
      title: t("sis.step3"),
      detail: t("sis.step3Detail"),
      icon: <Check size={16} />,
    },
  ];

  const installSteps = [
    { number: 1, detail: t("sis.install1"), icon: <Download size={16} /> },
    { number: 2, detail: t("sis.install2"), icon: <ExternalLink size={16} /> },
    { number: 3, detail: t("sis.install3"), icon: <RefreshCw size={16} /> },
  ];

  return (
    <div
      className="print:hidden fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sis-sync-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="my-4 w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900" dir={isArabic ? "rtl" : "ltr"}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id="sis-sync-title" className="text-lg font-bold text-slate-900 dark:text-white">
              {t("sis.title")}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{t("sis.subtitle")}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("sis.close")}
            className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X size={18} />
          </button>
        </div>

        {status !== "authenticated" && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            {t("sis.signInRequired")}
          </div>
        )}

        {/* Three visual numbered steps */}
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          {steps.map((step) => (
            <div
              key={step.number}
              className="relative rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60"
            >
              <div className="mb-2 flex items-center gap-2">
                <span className="grid size-7 place-items-center rounded-full bg-cyan-600 text-xs font-bold text-white">
                  {step.number}
                </span>
                <span className="text-cyan-700 dark:text-cyan-300">{step.icon}</span>
              </div>
              <p className="text-xs font-semibold text-slate-900 dark:text-white">{step.title}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
                {step.detail}
              </p>
            </div>
          ))}
        </div>

        {/* Paste box */}
        <div className="mb-3">
          <label htmlFor="sis-raw" className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-200">
            {t("sis.pasteLabel")}
          </label>
          <textarea
            id="sis-raw"
            value={rawText}
            onChange={(event) => setRawText(event.target.value)}
            placeholder={t("sis.pastePlaceholder")}
            rows={4}
            dir="auto"
            className="w-full rounded-lg border border-slate-200 bg-white p-2.5 font-mono text-xs text-slate-900 outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
          <button
            type="button"
            onClick={detect}
            disabled={busy || !rawText.trim()}
            className="mt-2 inline-flex items-center gap-2 rounded-lg border border-cyan-300 px-3 py-1.5 text-xs font-semibold text-cyan-700 transition hover:bg-cyan-50 disabled:opacity-50 dark:border-cyan-700 dark:text-cyan-300 dark:hover:bg-cyan-950/40"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            {t("sis.detect")}
          </button>
        </div>

        {/* Official SIS header values, available before full transcript rows */}
        {metadata && (
          <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-cyan-200 bg-cyan-50/70 px-3 py-2 text-xs text-cyan-900 dark:border-cyan-800 dark:bg-cyan-950/30 dark:text-cyan-100">
            {metadata.semester && <span className="font-semibold">{metadata.semester}</span>}
            {metadata.cgpa !== null && (
              <span>{t("sis.officialCgpa")}: <strong>{metadata.cgpa.toFixed(2)}</strong></span>
            )}
            {metadata.passedCredits !== null && (
              <span>{t("sis.officialPassed")}: <strong>{metadata.passedCredits}</strong></span>
            )}
            {metadata.registeredCredits !== null && (
              <span>{t("sis.officialRegistered")}: <strong>{metadata.registeredCredits}</strong></span>
            )}
          </div>
        )}
        {tableType === "registered" && (
          <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            {t("sis.registeredHint")}
          </p>
        )}

        {/* Editable preview */}
        <div className="mb-3">
          <div className="mb-1 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{t("sis.preview")}</p>
            {rows.length > 0 && <p className="text-[11px] text-slate-500">{rows.length}</p>}
          </div>
          {rows.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-xs text-slate-500 dark:border-slate-700">
              {t("sis.previewEmpty")}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
              <table className="w-full min-w-[560px] text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  <tr>
                    <th className="px-2 py-2">{t("sis.colCourse")}</th>
                    <th className="px-2 py-2">{t("sis.colTitle")}</th>
                    <th className="w-16 px-2 py-2">{t("sis.colCredits")}</th>
                    <th className="w-20 px-2 py-2">{t("sis.colGrade")}</th>
                    <th className="w-28 px-2 py-2">{t("sis.colSemester")}</th>
                    <th className="w-8 px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={`${row.courseCode}-${index}`} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="px-2 py-1.5 font-mono font-semibold text-slate-800 dark:text-slate-100">
                        {row.courseCode}
                        {row.sections && row.sections.length > 0 && (
                          <span className="mt-0.5 block text-[10px] font-normal text-slate-400">
                            {row.sections.join(", ")}
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          aria-label={t("sis.colTitle")}
                          className={inputClass}
                          value={row.courseName}
                          onChange={(event) => updateRow(index, "courseName", event.target.value)}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          aria-label={t("sis.colCredits")}
                          type="number"
                          min={1}
                          max={6}
                          className={inputClass}
                          value={row.creditHours}
                          onChange={(event) => updateRow(index, "creditHours", event.target.value)}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <select
                          aria-label={t("sis.colGrade")}
                          className={inputClass}
                          value={row.grade}
                          onChange={(event) => updateRow(index, "grade", event.target.value)}
                        >
                          {GRADE_CHOICES.map((grade) => (
                            <option key={grade} value={grade}>
                              {grade || "—"}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          aria-label={t("sis.colSemester")}
                          className={inputClass}
                          value={row.semester}
                          onChange={(event) => updateRow(index, "semester", event.target.value)}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <button
                          type="button"
                          onClick={() => removeRow(index)}
                          aria-label={t("sis.remove")}
                          className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                        >
                          <X size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Summary + save */}
        <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
          <div>
            <p className="text-[11px] text-slate-500">{t("sis.cgpa")}</p>
            <p className="text-lg font-bold text-cyan-700 dark:text-cyan-300">
              {(state.summary?.cgpa ?? 0).toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-slate-500">{t("sis.earned")}</p>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              {state.summary?.completedCredits ?? 0} / 134
            </p>
          </div>
          <div className="min-w-[140px] flex-1">
            <div className="mb-1 flex justify-between text-[11px] text-slate-500">
              <span>{t("sis.progress")}</span>
              <span>{state.summary?.progressPercent ?? 0}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
              <div
                className="h-full rounded-full bg-cyan-600 transition-all"
                style={{ width: `${state.summary?.progressPercent ?? 0}%` }}
              />
            </div>
          </div>
          <button
            type="button"
            onClick={save}
            disabled={busy || rows.length === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-cyan-700 disabled:opacity-50"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            {busy ? t("sis.saving") : t("sis.save")}
          </button>
        </div>

        {message && (
          <p
            className={`mb-3 rounded-lg px-3 py-2 text-xs ${
              message.ok
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                : "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
            }`}
          >
            {message.text}
          </p>
        )}

        {/* Extension install + sync guide */}
        <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Info size={15} className="text-cyan-600 dark:text-cyan-300" />
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">{t("sis.install")}</p>
            </div>
            <a
              href={EXTENSION_ZIP}
              download
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Download size={13} />
              {t("sis.download")}
            </a>
          </div>
          <p className="mb-3 text-[11px] text-slate-500">{t("sis.extensionDetail")}</p>

          <ol className="mb-3 grid gap-2 sm:grid-cols-3">
            {installSteps.map((step) => (
              <li
                key={step.number}
                className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 dark:border-slate-700 dark:bg-slate-800/60"
              >
                <div className="mb-1.5 flex items-center gap-2 text-cyan-700 dark:text-cyan-300">
                  <span className="grid size-6 place-items-center rounded-full bg-cyan-600 text-[11px] font-bold text-white">
                    {step.number}
                  </span>
                  {step.icon}
                </div>
                <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">{step.detail}</p>
              </li>
            ))}
          </ol>

          <div className="mb-3 rounded-lg border border-dashed border-cyan-200 bg-cyan-50/60 p-2.5 text-[11px] text-cyan-900 dark:border-cyan-800 dark:bg-cyan-950/30 dark:text-cyan-100">
            <p className="flex items-center gap-1.5 font-semibold">
              <Smartphone size={13} />
              {t("sis.mobileFallback")}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Link
                href="/timetable"
                className="rounded-lg bg-white px-2.5 py-1 font-semibold text-cyan-700 ring-1 ring-cyan-200 hover:bg-cyan-50 dark:bg-slate-900 dark:text-cyan-200 dark:ring-cyan-800"
              >
                {t("sis.mobileTimetable")}
              </Link>
              <Link
                href="/gpa"
                className="rounded-lg bg-white px-2.5 py-1 font-semibold text-cyan-700 ring-1 ring-cyan-200 hover:bg-cyan-50 dark:bg-slate-900 dark:text-cyan-200 dark:ring-cyan-800"
              >
                {t("sis.mobileGpa")}
              </Link>
            </div>
          </div>

          {state.syncToken && (
            <div>
              <p className="mb-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300">{t("sis.token")}</p>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={state.syncToken}
                  dir="ltr"
                  className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 font-mono text-[11px] text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                />
                <button
                  type="button"
                  onClick={copyToken}
                  className="inline-flex items-center gap-1 rounded-lg bg-slate-800 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-slate-700 dark:bg-slate-700"
                >
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                  {copied ? t("sis.copied") : t("sis.copyToken")}
                </button>
              </div>
              <p className="mt-1 text-[10px] text-slate-400">{t("sis.tokenHint")}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Convenience wrapper: banner + modal with optional external open control. */
export default function SisSyncGuide({
  open: controlledOpen,
  onOpenChange,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
} = {}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (next: boolean) => {
    if (controlledOpen === undefined) setInternalOpen(next);
    onOpenChange?.(next);
  };

  return (
    <>
      <SisGuideBanner onOpen={() => setOpen(true)} />
      <SisSyncModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
