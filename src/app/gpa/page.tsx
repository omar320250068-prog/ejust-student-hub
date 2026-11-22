"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { ClipboardPaste, Plus, Trash2, Target, BookOpen, TrendingUp, Award } from "lucide-react";
import PrintButton from "@/components/PrintButton";
import AttendanceTracker from "@/components/AttendanceTracker";
import FinalTargetCalculator from "@/components/FinalTargetCalculator";
import {
  computeStats,
  EMPTY_GPA_DATA,
  formatGpa,
  isDemoCourseId,
  sanitizeGpaData,
  semesterSeries,
  GRADE_OPTIONS,
  GRADE_POINTS,
  type Course,
  type CourseStatus,
  type GpaData,
  type LetterGrade,
} from "@/lib/gpa";
import { useUserData } from "@/hooks/useUserData";
import { useLanguage } from "@/lib/i18n";
import { StudyShell } from "@/components/ExperienceShells";
import SisSyncGuide, { useSyncedCourses } from "@/components/SisSyncGuide";

const GPA_GRADE_MAP: Record<string, LetterGrade> = {
  "A+": "A+", A: "A", "A-": "A", "B+": "B+", B: "B", "B-": "B",
  "C+": "C+", C: "C", "C-": "C", "D+": "D+", D: "D", F: "F",
};

export default function GpaPage() {
  const { t } = useLanguage();
  const { data: saved, setData: saveData, loading } = useUserData<GpaData>(
    "gpa",
    EMPTY_GPA_DATA,
    { sanitize: sanitizeGpaData },
  );
  const courses = saved.courses;
  const targetGpa = saved.targetGpa;
  const degreeCredits = saved.degreeCredits;
  const setCourses = (updater: Course[] | ((prev: Course[]) => Course[])) => {
    const next = typeof updater === "function" ? updater(courses) : updater;
    saveData({ ...saved, courses: next });
  };
  const setTargetGpa = (v: number | ((p: number) => number)) => {
    const next = typeof v === "function" ? v(targetGpa) : v;
    saveData({ ...saved, targetGpa: next });
  };
  const setDegreeCredits = (v: number | ((p: number) => number)) => {
    const next = typeof v === "function" ? v(degreeCredits) : v;
    saveData({ ...saved, degreeCredits: next });
  };
  const [statusFilter, setStatusFilter] = useState<CourseStatus | "all">("all");
  const synced = useSyncedCourses();
  const [useSynced, setUseSynced] = useState(false);
  const [sisOpen, setSisOpen] = useState(false);
  const [sisTab, setSisTab] = useState<"guide" | "paste">("guide");

  // Retired sample courses lived under unscoped keys. Strip them on upgrade so
  // they never reappear for guests or for a newly signed-in account.
  useEffect(() => {
    if (typeof window === "undefined") return;
    for (const legacyKey of ["ejust:gpa", "ejust-gpa-v1"]) {
      const raw = window.localStorage.getItem(legacyKey);
      if (!raw) continue;
      try {
        const parsed: unknown = JSON.parse(raw);
        const candidates =
          parsed && typeof parsed === "object" && "courses" in parsed && Array.isArray(parsed.courses)
            ? parsed.courses
            : [];
        const hasDemo = candidates.some(
          (candidate) =>
            candidate &&
            typeof candidate === "object" &&
            "id" in candidate &&
            typeof candidate.id === "string" &&
            isDemoCourseId(candidate.id),
        );
        if (!hasDemo) continue;
        const cleaned = sanitizeGpaData(parsed);
        if (cleaned) window.localStorage.setItem(legacyKey, JSON.stringify(cleaned));
        else window.localStorage.removeItem(legacyKey);
      } catch {
        // Malformed legacy values are ignored; useUserData repairs valid ones.
      }
    }
  }, []);

  // The local calculator uses a simplified grade scale; map E-JUST grades onto
  // its valid options and show the authoritative CGPA from the sync result.
  const syncedCourses = useMemo<Course[]>(
    () =>
      synced.courses.map((course) => ({
        id: `sis-${course.courseCode}-${course.semester}`.replace(/\s+/g, "-"),
        code: course.courseCode,
        title: course.courseName || course.courseCode,
        credits: course.creditHours ?? 3,
        semester: course.semester || "Unassigned",
        status: course.status === "completed" ? "completed" : "in-progress",
        grade:
          course.status === "completed" && course.grade
            ? GPA_GRADE_MAP[course.grade.toUpperCase()]
            : undefined,
      })),
    [synced.courses]
  );
  const showingSynced = useSynced && syncedCourses.length > 0;
  const activeCourses = showingSynced ? syncedCourses : courses;

  const [form, setForm] = useState({
    code: "",
    title: "",
    credits: 3,
    semester: "Y2S2",
    status: "planned" as CourseStatus,
    grade: "" as LetterGrade | "",
    expectedGrade: "" as LetterGrade | "",
  });

  const stats = useMemo(
    () => computeStats(activeCourses, targetGpa, degreeCredits),
    [activeCourses, targetGpa, degreeCredits]
  );
  const neededSub = !stats.achievable
    ? t("study.neededNotAchievable")
    : stats.remainingCredits > 0
      ? t("study.neededRemaining", { n: stats.remainingCredits })
      : t("study.noRemaining");
  const neededValue =
    stats.remainingCredits > 0 || !stats.achievable
      ? stats.requiredAverage !== null
        ? stats.requiredAverage.toFixed(2)
        : "—"
      : "Done";
  const series = useMemo(() => semesterSeries(activeCourses), [activeCourses]);
  const degreeProgress = Math.min(
    100,
    degreeCredits > 0 ? (stats.completedCredits / degreeCredits) * 100 : 0
  );

  function addCourse(e: React.FormEvent) {
    e.preventDefault();
    if (!form.code.trim() || !form.title.trim() || form.credits <= 0) return;
    setCourses((prev) => [
      ...prev,
      {
        id: `c-${Date.now()}`,
        code: form.code.trim().toUpperCase(),
        title: form.title.trim(),
        credits: form.credits,
        semester: form.semester.trim() || "Unassigned",
        status: form.status,
        grade: form.status === "completed" ? (form.grade || "A") : undefined,
        expectedGrade:
          form.status !== "completed"
            ? form.expectedGrade || undefined
            : undefined,
      },
    ]);
    setForm((f) => ({ ...f, code: "", title: "", grade: "", expectedGrade: "" }));
  }

  function removeCourse(id: string) {
    setCourses((prev) => prev.filter((c) => c.id !== id));
  }

  function setGrade(id: string, grade: LetterGrade) {
    setCourses((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, status: "completed", grade } : c
      )
    );
  }

  const visibleCourses =
    statusFilter === "all"
      ? activeCourses
      : activeCourses.filter((c) => c.status === statusFilter);

  return (
    <StudyShell icon={<TrendingUp size={19} />} title={t("study.gpa")} description="Simulate target grades, track cumulative performance, and see how your degree is progressing." action={<PrintButton />}>
      <SisSyncGuide open={sisOpen} onOpenChange={setSisOpen} initialTab={sisTab} />
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="sr-only">GPA Predictor &amp; Degree Tracker</h1>
          <p className="mt-1 text-sm text-gray-500">
            Forecast the grades you need to hit your target GPA and track degree
            progress. Scale: {Object.entries(GRADE_POINTS).map(([k, v]) => `${k}=${v.toFixed(1)}`).join(" · ")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setSisTab("paste");
            setSisOpen(true);
          }}
          className="print:hidden inline-flex items-center gap-2 rounded-xl border border-cyan-300 bg-white px-3 py-2 text-xs font-semibold text-cyan-700 transition hover:bg-cyan-50 dark:border-cyan-700 dark:bg-slate-900 dark:text-cyan-300"
        >
          <ClipboardPaste size={14} />
          {t("sisPaste.tab")}
        </button>
      </div>

      {!loading && activeCourses.length === 0 && (
        <div className="mt-6 rounded-2xl border border-dashed border-cyan-300 bg-cyan-50/60 p-6 text-center dark:border-cyan-800 dark:bg-cyan-950/20">
          <span className="mx-auto grid size-10 place-items-center rounded-full bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300">
            <BookOpen size={20} />
          </span>
          <h2 className="mt-3 text-base font-semibold text-gray-900 dark:text-white">
            {t("study.emptyGpaTitle")}
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-gray-600 dark:text-slate-300">
            {t("study.emptyGpaBody")}
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => {
                setSisTab("paste");
                setSisOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-cyan-700"
            >
              <ClipboardPaste size={14} />
              {t("sisPaste.tab")}
            </button>
            <button
              type="button"
              onClick={() => {
                const form = document.getElementById("gpa-add-course");
                form?.scrollIntoView({ behavior: "smooth", block: "center" });
                form?.querySelector<HTMLInputElement>("input")?.focus();
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              <Plus size={14} />
              {t("study.addCourse")}
            </button>
          </div>
        </div>
      )}

      <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={<Award size={16} />} label="Current GPA (completed)" value={formatGpa(stats.currentGpa)} sub={`${stats.completedCredits} credits graded`} />
        <StatCard icon={<TrendingUp size={16} />} label="Forecast GPA (with expected)" value={formatGpa(stats.forecastGpa)} sub={`${stats.inProgressCredits} credits in progress`} />
        <StatCard icon={<Target size={16} />} label={`Needed for ${targetGpa.toFixed(2)}`} value={neededValue} sub={neededSub} accent={stats.achievable ? "blue" : "red"} />
        <StatCard icon={<BookOpen size={16} />} label="Degree Progress" value={`${Math.round(degreeProgress)}%`} sub={`${stats.completedCredits} / ${degreeCredits} credits`} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm dark:border-slate-800 dark:bg-slate-900">
        <label className="flex items-center gap-2">
          <span className="text-gray-600">Target GPA</span>
          <input
            type="number"
            min={0}
            max={4}
            step={0.1}
            value={targetGpa}
            onChange={(e) => setTargetGpa(Math.min(4, Math.max(0, Number(e.target.value) || 0)))}
            className="w-20 rounded-lg border border-gray-200 px-2 py-1 outline-none focus:border-blue-400"
          />
        </label>
        <label className="flex items-center gap-2">
          <span className="text-gray-600">Degree credits</span>
          <input
            type="number"
            min={1}
            value={degreeCredits}
            onChange={(e) => setDegreeCredits(Math.max(1, Number(e.target.value) || 1))}
            className="w-24 rounded-lg border border-gray-200 px-2 py-1 outline-none focus:border-blue-400"
          />
        </label>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100" title={`${Math.round(degreeProgress)}% complete`}>
          <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${degreeProgress}%` }} />
        </div>
      </div>

      <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-semibold text-gray-900">GPA Progress by Semester</h2>
        <div className="mt-3 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={series} margin={{ top: 5, right: 10, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="semester" tick={{ fontSize: 12 }} />
              <YAxis domain={[0, 4]} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value) => (typeof value === "number" ? value.toFixed(2) : value)} />
              <Legend />
              <Bar dataKey="semesterGpa" name="Semester GPA" fill="#93c5fd" radius={[6, 6, 0, 0]} />
              <Line dataKey="cumulativeGpa" name="Cumulative GPA" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 4 }} connectNulls={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>

      <FinalTargetCalculator className="mt-4" />

      <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-gray-900">Courses ({activeCourses.length})</h2>
          <div className="flex flex-wrap items-center gap-2">
            {synced.courses.length > 0 && (
              <label className="flex cursor-pointer items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-medium text-cyan-800 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-200">
                <input
                  type="checkbox"
                  checked={useSynced}
                  onChange={(e) => setUseSynced(e.target.checked)}
                  className="accent-cyan-600"
                />
                {t("sis.mySynced")}
                <span className="font-mono">CGPA {synced.summary.cgpa.toFixed(2)}</span>
              </label>
            )}
          </div>
          <div className="flex gap-1">
            {(["all", "completed", "in-progress", "planned"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize transition ${
                  statusFilter === s ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-400">
                <th className="py-2 pr-3">Code</th>
                <th className="py-2 pr-3">Title</th>
                <th className="py-2 pr-3">Cr.</th>
                <th className="py-2 pr-3">Semester</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Grade</th>
                <th className="py-2 pr-3">{t("attendance.title")}</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {visibleCourses.map((c) => (
                <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-2 pr-3 font-mono text-xs font-semibold text-gray-900">{c.code}</td>
                  <td className="py-2 pr-3 text-gray-700">{c.title}</td>
                  <td className="py-2 pr-3 text-gray-600">{c.credits}</td>
                  <td className="py-2 pr-3 text-gray-600">{c.semester}</td>
                  <td className="py-2 pr-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        c.status === "completed"
                          ? "bg-green-50 text-green-700"
                          : c.status === "in-progress"
                            ? "bg-amber-50 text-amber-700"
                            : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {c.status}
                    </span>
                  </td>
                  <td className="py-2 pr-3">
                    {c.status === "completed" ? (
                      <select
                        value={c.grade ?? ""}
                        onChange={(e) => setGrade(c.id, e.target.value as LetterGrade)}
                        className="rounded-md border border-gray-200 bg-white px-1.5 py-1 text-xs outline-none focus:border-blue-400"
                      >
                        {GRADE_OPTIONS.map((g) => (
                          <option key={g} value={g}>{g}</option>
                        ))}
                      </select>
                    ) : c.status === "in-progress" ? (
                      <span className="text-xs text-amber-700">
                        expected {c.expectedGrade ?? "?"}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                  <td className="py-2 pr-3">
                    <AttendanceTracker courseCode={c.code} className="min-w-[210px]" />
                  </td>
                  <td className="py-2">
                    <button
                      onClick={() => removeCourse(c.id)}
                      disabled={showingSynced}
                      className="rounded p-1 text-gray-300 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                      aria-label={`Remove ${c.code}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {visibleCourses.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-sm text-gray-400">
                    No courses in this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {!showingSynced && (
        <form id="gpa-add-course" onSubmit={addCourse} className="mt-4 flex flex-wrap items-end gap-2 rounded-lg bg-gray-50 p-3">
          <Field label="Code">
            <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="EECE210" className="w-28 rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-blue-400" />
          </Field>
          <Field label="Title" className="min-w-40 flex-1">
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Signals & Systems" className="w-full rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-blue-400" />
          </Field>
          <Field label="Credits">
            <input type="number" min={1} max={9} value={form.credits} onChange={(e) => setForm({ ...form, credits: Number(e.target.value) || 1 })} className="w-16 rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-blue-400" />
          </Field>
          <Field label="Semester">
            <input value={form.semester} onChange={(e) => setForm({ ...form, semester: e.target.value })} placeholder="Y2S2" className="w-20 rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-blue-400" />
          </Field>
          <Field label="Status">
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as CourseStatus })} className="rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-blue-400">
              <option value="planned">planned</option>
              <option value="in-progress">in-progress</option>
              <option value="completed">completed</option>
            </select>
          </Field>
          {form.status === "completed" ? (
            <Field label="Grade">
              <select value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value as LetterGrade })} className="rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-blue-400">
                <option value="">—</option>
                {GRADE_OPTIONS.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </Field>
          ) : (
            <Field label="Expected grade">
              <select value={form.expectedGrade} onChange={(e) => setForm({ ...form, expectedGrade: e.target.value as LetterGrade })} className="rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-blue-400">
                <option value="">—</option>
                {GRADE_OPTIONS.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </Field>
          )}
          <button type="submit" className="flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
            <Plus size={14} />
            Add
          </button>
        </form>
        )}
      </section>
    </StudyShell>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  accent = "default",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  accent?: "default" | "blue" | "red";
}) {
  return (
    <div
      className={`rounded-xl border bg-white p-3 ${
        accent === "red" ? "border-red-200" : "border-gray-200"
      }`}
    >
      <p className="flex items-center gap-1.5 text-xs text-gray-500">
        <span className={accent === "red" ? "text-red-500" : "text-blue-600"}>{icon}</span>
        {label}
      </p>
      <p className={`mt-1 text-2xl font-bold ${accent === "red" ? "text-red-600" : "text-gray-900"}`}>
        {value}
      </p>
      <p className="mt-0.5 text-xs text-gray-400">{sub}</p>
    </div>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-0.5 text-xs text-gray-500 ${className}`}>
      {label}
      {children}
    </label>
  );
}
