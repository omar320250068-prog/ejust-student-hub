"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Minus, Plus, ShieldAlert } from "lucide-react";
import {
  DEFAULT_MAX_ALLOWED,
  attendanceRisk,
  normalizeAttendanceCode,
  shiftAbsences,
  updateAttendance,
  type AttendanceMap,
  type AttendanceRecord,
} from "@/lib/attendance";
import { useLanguage } from "@/lib/i18n";
import { readAttendance, writeAttendance } from "@/lib/student-data";

const ATTENDANCE_EVENT = "ejust:attendance-changed";

const BAR_COLOR = {
  safe: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-red-500",
} as const;

const TEXT_COLOR = {
  safe: "text-emerald-700 dark:text-emerald-300",
  warning: "text-amber-700 dark:text-amber-300",
  danger: "text-red-700 dark:text-red-300",
} as const;

/** Compact per-course absence counter with a DN warning, usable on any study page. */
export default function AttendanceTracker({
  courseCode,
  className = "",
}: {
  courseCode: string;
  className?: string;
}) {
  const { t } = useLanguage();
  const { data: session, status } = useSession();
  const user = status === "authenticated" ? session?.user : null;
  const code = normalizeAttendanceCode(courseCode);
  const [map, setMap] = useState<AttendanceMap>({});

  useEffect(() => {
    if (!code) return;
    const read = () => setMap(readAttendance(window.localStorage, user));
    read();
    window.addEventListener(ATTENDANCE_EVENT, read);
    return () => window.removeEventListener(ATTENDANCE_EVENT, read);
  }, [code, user]);

  const commit = useCallback(
    (next: AttendanceMap) => {
      writeAttendance(window.localStorage, user, next);
      setMap(next);
      window.dispatchEvent(new Event(ATTENDANCE_EVENT));
    },
    [user],
  );

  if (!code) return null;
  const record: AttendanceRecord = map[code] ?? {
    absences: 0,
    maxAllowed: DEFAULT_MAX_ALLOWED,
  };
  const risk = attendanceRisk(record);
  const percent = Math.min(100, Math.round((record.absences / record.maxAllowed) * 100));

  return (
    <div
      className={`rounded-lg border border-slate-200 bg-white/90 p-2 text-slate-700 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200 ${className}`}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] font-semibold">{t("attendance.title")}</span>
        <span className={`flex items-center gap-1 text-[11px] font-bold ${TEXT_COLOR[risk]}`}>
          {risk === "danger" && <ShieldAlert size={12} />}
          {risk === "danger" ? t("attendance.dnRisk") : risk === "warning" ? t("attendance.warning") : t("attendance.safe")}
        </span>
      </div>

      <div className="mt-1 flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => commit(shiftAbsences(map, code, -1))}
          disabled={record.absences === 0}
          aria-label={t("attendance.remove")}
          className="grid size-6 place-items-center rounded-md border border-slate-300 text-slate-600 transition hover:bg-slate-100 disabled:opacity-40 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <Minus size={12} />
        </button>
        <span className={`min-w-12 text-center font-mono text-xs font-bold ${TEXT_COLOR[risk]}`}>
          {t("attendance.count")
            .replace("{a}", String(record.absences))
            .replace("{m}", String(record.maxAllowed))}
        </span>
        <button
          type="button"
          onClick={() => commit(shiftAbsences(map, code, 1))}
          aria-label={t("attendance.add")}
          className="grid size-6 place-items-center rounded-md border border-slate-300 text-slate-600 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <Plus size={12} />
        </button>
        <label className="ml-auto flex items-center gap-1 text-[10px] text-slate-500">
          {t("attendance.limit")}
          <input
            type="number"
            min={1}
            max={30}
            value={record.maxAllowed}
            onChange={(event) => {
              const value = Number(event.target.value);
              if (Number.isInteger(value) && value >= 1 && value <= 30) {
                commit(updateAttendance(map, code, { maxAllowed: value }));
              }
            }}
            className="w-12 rounded border border-slate-300 bg-white px-1 py-0.5 text-center text-[11px] text-slate-800 outline-none focus:border-cyan-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          />
        </label>
      </div>

      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
        <div
          className={`h-full rounded-full transition-all ${BAR_COLOR[risk]}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
