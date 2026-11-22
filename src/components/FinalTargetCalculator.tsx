"use client";

import { useMemo, useState } from "react";
import { Calculator, CheckCircle2, XCircle } from "lucide-react";
import {
  DEFAULT_COURSEWORK_MAX,
  DEFAULT_FINAL_MAX,
  FINAL_TARGET_GRADES,
  computeFinalTarget,
  type FinalTargetGrade,
} from "@/lib/final-grade-calc";
import { useLanguage } from "@/lib/i18n";

const inputClass =
  "w-20 rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 outline-none focus:border-cyan-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100";

/** Pure-math driven widget: what must the student score in the final exam? */
export default function FinalTargetCalculator({
  initialScore = "",
  compact = false,
  className = "",
}: {
  initialScore?: number | string;
  compact?: boolean;
  className?: string;
}) {
  const { t } = useLanguage();
  const [currentScore, setCurrentScore] = useState(String(initialScore));
  const [courseworkMax, setCourseworkMax] = useState(String(DEFAULT_COURSEWORK_MAX));
  const [finalMax, setFinalMax] = useState(String(DEFAULT_FINAL_MAX));
  const [targetGrade, setTargetGrade] = useState<FinalTargetGrade>("A");

  const result = useMemo(
    () =>
      computeFinalTarget({
        currentScore: Number(currentScore) || 0,
        courseworkMax: Number(courseworkMax),
        finalMax: Number(finalMax),
        targetGrade,
      }),
    [currentScore, courseworkMax, finalMax, targetGrade],
  );

  return (
    <section
      className={`print:hidden rounded-2xl border border-cyan-200 bg-white p-4 shadow-sm dark:border-cyan-900 dark:bg-slate-900 ${className}`}
    >
      <div className="flex items-center gap-2">
        <Calculator size={16} className="text-cyan-600 dark:text-cyan-300" />
        <h2 className="text-sm font-bold text-slate-900 dark:text-white">{t("finalCalc.title")}</h2>
      </div>
      <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{t("finalCalc.hint")}</p>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
          {t("finalCalc.current")}
          <input
            type="number"
            min={0}
            step={0.5}
            value={currentScore}
            onChange={(event) => setCurrentScore(event.target.value)}
            placeholder="0"
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
          {t("finalCalc.courseworkMax")}
          <input
            type="number"
            min={1}
            value={courseworkMax}
            onChange={(event) => setCourseworkMax(event.target.value)}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
          {t("finalCalc.finalMax")}
          <input
            type="number"
            min={1}
            value={finalMax}
            onChange={(event) => setFinalMax(event.target.value)}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
          {t("finalCalc.target")}
          <select
            value={targetGrade}
            onChange={(event) => setTargetGrade(event.target.value as FinalTargetGrade)}
            className={`${inputClass} w-full`}
          >
            {FINAL_TARGET_GRADES.map((grade) => (
              <option key={grade} value={grade}>
                {grade}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div
        className={`mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl px-3 py-2 ${
          result.achievable
            ? "bg-emerald-50 dark:bg-emerald-950/30"
            : "bg-red-50 dark:bg-red-950/30"
        }`}
      >
        <div>
          <p className="text-[10px] uppercase tracking-wide text-slate-500">{t("finalCalc.required")}</p>
          <p className={`text-lg font-bold ${result.achievable ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"}`}>
            {t("finalCalc.ofMax")
              .replace("{n}", String(result.requiredRaw))
              .replace("{m}", String(Number(finalMax) > 0 ? finalMax : DEFAULT_FINAL_MAX))}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-slate-500">{t("finalCalc.percent")}</p>
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            {result.requiredPercent}%
          </p>
        </div>
        <span
          className={`ml-auto inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${
            result.achievable
              ? "bg-emerald-600 text-white"
              : "bg-red-600 text-white"
          }`}
        >
          {result.achievable ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
          {result.achievable ? t("finalCalc.achievable") : t("finalCalc.notAchievable")}
        </span>
      </div>
      {compact && (
        <p className="mt-2 text-[10px] text-slate-400">
          {t("finalCalc.target")}: {targetGrade} · {result.targetMark}/100
        </p>
      )}
    </section>
  );
}
