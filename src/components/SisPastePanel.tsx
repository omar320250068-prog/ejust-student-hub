"use client";

import { useMemo, useState } from "react";
import { ClipboardPaste, RefreshCw } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { applySisPasteToStorage } from "@/lib/sis-paste-client";
import { parseSisPaste, type SisPasteParseResult } from "@/lib/sis-paste-parser";
import type { StorageUser } from "@/lib/user-scoped-storage";

function PreviewList({ result }: { result: SisPasteParseResult }) {
  const { t } = useLanguage();
  if (
    result.courses.length === 0 &&
    result.classes.length === 0 &&
    result.exams.length === 0
  ) {
    return (
      <p className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-xs text-slate-500 dark:border-slate-700">
        {t("sisPaste.empty")}
      </p>
    );
  }

  return (
    <div className="grid max-h-56 gap-3 overflow-y-auto sm:grid-cols-3">
      {result.courses.length > 0 && (
        <section>
          <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-cyan-700 dark:text-cyan-300">
            {t("sisPaste.courses")} ({result.courses.length})
          </p>
          <ul className="space-y-1">
            {result.courses.map((course) => (
              <li
                key={course.courseCode}
                className="rounded-md bg-slate-50 px-2 py-1 text-[11px] text-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <span className="font-mono font-semibold">{course.courseCode}</span>
                {course.courseName && <span className="block truncate opacity-80">{course.courseName}</span>}
                <span className="opacity-70">
                  {course.creditHours ?? "–"} {t("sisPaste.credits")} · {t("sisPaste.grade")}{" "}
                  {course.grade ?? "–"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {result.classes.length > 0 && (
        <section>
          <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-cyan-700 dark:text-cyan-300">
            {t("sisPaste.classes")} ({result.classes.length})
          </p>
          <ul className="space-y-1">
            {result.classes.map((slot, index) => (
              <li
                key={`${slot.courseCode}-${slot.day}-${slot.start}-${index}`}
                className="rounded-md bg-slate-50 px-2 py-1 text-[11px] text-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <span className="font-mono font-semibold">{slot.courseCode}</span>
                <span className="block opacity-80">
                  {t("sisPaste.slot")}: {slot.day} {slot.start}–{slot.end}
                  {slot.room ? ` · ${slot.room}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {result.exams.length > 0 && (
        <section>
          <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-cyan-700 dark:text-cyan-300">
            {t("sisPaste.exams")} ({result.exams.length})
          </p>
          <ul className="space-y-1">
            {result.exams.map((exam, index) => (
              <li
                key={`${exam.courseCode}-${exam.date}-${index}`}
                className="rounded-md bg-slate-50 px-2 py-1 text-[11px] text-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <span className="font-mono font-semibold">{exam.courseCode}</span>
                <span className="block opacity-80">
                  {exam.type} · {t("sisPaste.date")}: {exam.date}
                  {exam.time ? ` ${exam.time}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/** Local, offline Smart Paste tab: parse first, preview, then merge on click. */
export default function SisPastePanel({
  user,
  signedIn,
}: {
  user: StorageUser | null;
  signedIn: boolean;
}) {
  const { t } = useLanguage();
  const [raw, setRaw] = useState("");
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const result = useMemo(() => parseSisPaste(raw), [raw]);
  const total = result.courses.length + result.classes.length + result.exams.length;

  async function importPaste() {
    if (total === 0) return;
    setBusy(true);
    setMessage(null);
    try {
      const applied = applySisPasteToStorage(window.localStorage, raw, user);
      if (signedIn) {
        // GPA is the only snapshot mirrored to the API; keep server and device in sync.
        await fetch("/api/user-data", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ feature: "gpa", data: applied.gpa }),
        }).catch(() => undefined);
      }
      setMessage({
        text: t("sisPaste.imported").replace("{n}", String(total)),
        ok: true,
      });
      // Reload so every study page re-reads the four updated scoped snapshots.
      window.setTimeout(() => window.location.reload(), 600);
    } catch {
      setBusy(false);
      setMessage({ text: t("sis.error"), ok: false });
    }
  }

  return (
    <div>
      <h3 className="text-sm font-bold text-slate-900 dark:text-white">{t("sisPaste.title")}</h3>
      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{t("sisPaste.hint")}</p>

      <textarea
        value={raw}
        onChange={(event) => {
          setRaw(event.target.value);
          setMessage(null);
        }}
        placeholder={t("sisPaste.placeholder")}
        rows={6}
        dir="auto"
        className="mt-3 w-full rounded-lg border border-slate-200 bg-white p-2.5 font-mono text-xs text-slate-900 outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
      />

      <div className="mt-3">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
            {t("sisPaste.preview")}
          </p>
          {total > 0 && (
            <p className="text-[11px] text-slate-500">
              {t("sisPaste.found")
                .replace("{c}", String(result.courses.length))
                .replace("{cl}", String(result.classes.length))
                .replace("{e}", String(result.exams.length))}
            </p>
          )}
        </div>
        {raw.trim() === "" ? (
          <p className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-xs text-slate-500 dark:border-slate-700">
            {t("sisPaste.noData")}
          </p>
        ) : (
          <PreviewList result={result} />
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={importPaste}
          disabled={busy || total === 0}
          className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-cyan-700 disabled:opacity-50"
        >
          {busy ? <RefreshCw size={14} className="animate-spin" /> : <ClipboardPaste size={14} />}
          {t("sisPaste.import").replace("{n}", String(total))}
        </button>
        <p className="text-[11px] text-slate-500">{t("sisPaste.hint")}</p>
      </div>

      {message && (
        <p
          className={`mt-3 rounded-lg px-3 py-2 text-xs ${
            message.ok
              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
              : "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
          }`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
