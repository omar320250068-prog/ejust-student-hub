"use client";

import { useEffect, useState } from "react";
import { FileText, Trash2, X } from "lucide-react";
import {
  IMPORT_EXAM_TYPES,
  normalizeImportedRows,
  type ImportedExamRow,
  type ImportedExamType,
} from "@/lib/exam-import";
import { useLanguage, type TranslationKey } from "@/lib/i18n";

interface ExamImportModalProps {
  open: boolean;
  onClose: () => void;
  onImported?: () => void;
}

type BusyState = "parse" | "save" | null;

const COLUMN_KEYS: { key: keyof ImportedExamRow; label: TranslationKey }[] = [
  { key: "courseCode", label: "study.colCourse" },
  { key: "examType", label: "study.colType" },
  { key: "examDate", label: "study.colDate" },
  { key: "startTime", label: "study.colStart" },
  { key: "endTime", label: "study.colEnd" },
  { key: "building", label: "study.colBuilding" },
  { key: "room", label: "study.colRoom" },
];

const INPUT_TYPE: Partial<Record<keyof ImportedExamRow, string>> = {
  examDate: "date",
  startTime: "time",
  endTime: "time",
};

export default function ExamImportModal({ open, onClose, onImported }: ExamImportModalProps) {
  const { locale, t } = useLanguage();
  const [text, setText] = useState("");
  const [rows, setRows] = useState<ImportedExamRow[]>([]);
  const [busy, setBusy] = useState<BusyState>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  function updateRow(index: number, patch: Partial<ImportedExamRow>) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  async function parseText() {
    setBusy("parse");
    setError("");
    setStatus("");
    try {
      const response = await fetch("/api/exams/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!response.ok) throw new Error("parse failed");
      const payload = (await response.json()) as { rows?: unknown; method?: string };
      const parsed = normalizeImportedRows(
        Array.isArray(payload.rows) ? (payload.rows as Record<string, unknown>[]) : []
      );
      setRows(parsed);
      setStatus(
        parsed.length === 0
          ? t("study.importNoRows")
          : `${t("study.importRows")} ${parsed.length} · ${
              payload.method === "ai" ? t("study.importSourceAi") : t("study.importSourceRegex")
            }`
      );
    } catch {
      setError(t("study.importError"));
    } finally {
      setBusy(null);
    }
  }

  async function saveRows() {
    setBusy("save");
    setError("");
    try {
      const response = await fetch("/api/exams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exams: rows }),
      });
      if (!response.ok) throw new Error("save failed");
      onImported?.();
      onClose();
    } catch {
      setError(t("study.importError"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div
      className="print:hidden fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="exam-import-title"
        dir={locale === "ar" ? "rtl" : "ltr"}
        className="my-8 w-full max-w-4xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="exam-import-title" className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
              <FileText size={18} className="text-cyan-600" />
              {t("study.importTitle")}
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t("study.importHint")}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("study.importClose")}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
          >
            <X size={18} />
          </button>
        </div>

        <label className="mt-4 block text-xs font-semibold text-slate-600 dark:text-slate-300" htmlFor="exam-import-text">
          {t("study.importPaste")}
        </label>
        <textarea
          id="exam-import-text"
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={5}
          placeholder="CSC341 - Midterm - 13 Dec 2026, 10:00-12:00, Building B, Room B4"
          className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 font-mono text-xs outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-950"
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={parseText}
            disabled={busy !== null || text.trim().length === 0}
            className="rounded-lg bg-cyan-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-40"
          >
            {busy === "parse" ? t("study.importParsing") : t("study.importParse")}
          </button>
          {status && <p className="text-xs text-slate-500 dark:text-slate-400" aria-live="polite">{status}</p>}
        </div>

        {rows.length > 0 && (
          <section className="mt-5">
            <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-200">{t("study.importPreview")}</h3>
            <div className="mt-2 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
              <table className="w-full min-w-[720px] text-left text-xs">
                <thead className="bg-slate-50 text-[11px] text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                  <tr>
                    {COLUMN_KEYS.map((column) => (
                      <th key={column.key} className="px-2 py-2 font-semibold">{t(column.label)}</th>
                    ))}
                    <th className="px-2 py-2"><span className="sr-only">{t("study.importRemove")}</span></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={`${row.courseCode}-${index}`} className="border-t border-slate-100 dark:border-slate-800">
                      {COLUMN_KEYS.map((column) => (
                        <td key={column.key} className="px-1 py-1.5">
                          {column.key === "examType" ? (
                            <select
                              aria-label={t(column.label)}
                              value={row.examType}
                              onChange={(event) =>
                                updateRow(index, { examType: event.target.value as ImportedExamType })
                              }
                              className="w-full rounded-md border border-slate-200 bg-white px-1.5 py-1 dark:border-slate-700 dark:bg-slate-950"
                            >
                              {IMPORT_EXAM_TYPES.map((type) => (
                                <option key={type} value={type}>{type}</option>
                              ))}
                            </select>
                          ) : (
                            <input
                              aria-label={t(column.label)}
                              type={INPUT_TYPE[column.key] ?? "text"}
                              value={row[column.key]}
                              onChange={(event) => updateRow(index, { [column.key]: event.target.value })}
                              className="w-full rounded-md border border-slate-200 bg-white px-1.5 py-1 dark:border-slate-700 dark:bg-slate-950"
                            />
                          )}
                        </td>
                      ))}
                      <td className="px-1 py-1.5">
                        <button
                          type="button"
                          onClick={() => setRows((prev) => prev.filter((_, i) => i !== index))}
                          aria-label={t("study.importRemove")}
                          className="rounded-md p-1 text-slate-400 hover:text-red-600"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {error && <p className="mt-3 text-xs text-red-600" aria-live="assertive">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300"
          >
            {t("study.importCancel")}
          </button>
          <button
            type="button"
            onClick={saveRows}
            disabled={busy !== null || rows.length === 0}
            className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white disabled:opacity-40 dark:bg-cyan-300 dark:text-slate-950"
          >
            {busy === "save" ? t("study.importSaving") : `${t("study.importSave")} ${rows.length}`}
          </button>
        </div>
      </div>
    </div>
  );
}
