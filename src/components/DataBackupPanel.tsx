"use client";

import { useRef, useState } from "react";
import { Download, HardDriveDownload, Upload } from "lucide-react";
import {
  applyBackup,
  backupFilename,
  collectBackup,
  validateBackup,
} from "@/lib/data-backup";
import { useLanguage } from "@/lib/i18n";

/** Export/restore the student's local GPA, timetable, exam-seat and profile data. */
export default function DataBackupPanel({ className = "" }: { className?: string }) {
  const { t } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);

  function exportData() {
    setMessage(null);
    try {
      const store = window.localStorage;
      const backup = collectBackup({
        getItem: (key) => store.getItem(key),
        setItem: (key, value) => store.setItem(key, value),
        keys: () => Object.keys(store),
      });
      if (Object.keys(backup.data).length === 0) {
        setMessage(t("data.empty"));
        return;
      }
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = backupFilename();
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setMessage(t("data.exported"));
    } catch {
      setMessage(t("data.failed"));
    }
  }

  async function importData(file: File | undefined) {
    if (!file) return;
    setMessage(null);
    try {
      const parsed: unknown = JSON.parse(await file.text());
      const result = validateBackup(parsed);
      if (!result.ok) {
        setMessage(t(result.error === "invalid_format" || result.error === "invalid_data" || result.error === "unsupported_version" || result.error === "too_large" ? "data.invalid" : "data.failed"));
        return;
      }
      const restored = applyBackup(window.localStorage, result.backup);
      setMessage(t("data.imported", { n: restored }));
      // Feature pages that cache localStorage state can re-read it immediately.
      window.dispatchEvent(new Event("ejust:data-restored"));
    } catch {
      setMessage(t("data.failed"));
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <section className={`rounded-2xl border border-white/20 bg-white/10 p-5 backdrop-blur-md ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
            <HardDriveDownload size={17} className="text-cyan-300" />
            {t("data.title")}
          </h2>
          <p className="mt-1 text-xs leading-5 text-slate-300">{t("data.hint")}</p>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <button
            type="button"
            onClick={exportData}
            className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/20 sm:flex-none"
          >
            <Download size={14} />
            {t("data.export")}
          </button>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-cyan-300 px-3 py-2 text-xs font-semibold text-slate-950 transition hover:bg-cyan-200 sm:flex-none"
          >
            <Upload size={14} />
            {t("data.import")}
          </button>
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(event) => void importData(event.target.files?.[0])}
      />
      {message && (
        <p role="status" className="mt-3 break-words text-xs text-cyan-200">
          {message}
        </p>
      )}
    </section>
  );
}
