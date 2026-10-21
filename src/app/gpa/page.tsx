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
import { Plus, Trash2, Target, BookOpen, TrendingUp, Award } from "lucide-react";
import PrintButton from "@/components/PrintButton";
import {
  computeStats,
  formatGpa,
  semesterSeries,
  GRADE_OPTIONS,
  GRADE_POINTS,
  type Course,
  type CourseStatus,
  type LetterGrade,
} from "@/lib/gpa";
import { useUserData } from "@/hooks/useUserData";

const SEED_COURSES: Course[] = [
  { id: "s1", code: "MATH101", title: "Calculus I", credits: 4, semester: "Y1S1", status: "completed", grade: "A" },
  { id: "s2", code: "PHYS101", title: "Physics I", credits: 4, semester: "Y1S1", status: "completed", grade: "B+" },
  { id: "s3", code: "CSE101", title: "Introduction to Computing", credits: 3, semester: "Y1S1", status: "completed", grade: "A" },
  { id: "s4", code: "JPN101", title: "Japanese Language I", credits: 2, semester: "Y1S1", status: "completed", grade: "A+" },
  { id: "s5", code: "HUM101", title: "Liberal Arts & Culture", credits: 2, semester: "Y1S1", status: "completed", grade: "B" },
  { id: "s6", code: "MATH102", title: "Calculus II", credits: 4, semester: "Y1S2", status: "completed", grade: "B+" },
  { id: "s7", code: "PHYS102", title: "Physics II", credits: 4, semester: "Y1S2", status: "completed", grade: "B" },
  { id: "s8", code: "CHEM101", title: "Chemistry I", credits: 3, semester: "Y1S2", status: "completed", grade: "C+" },
  { id: "s9", code: "ENG101", title: "Academic English", credits: 2, semester: "Y1S2", status: "completed", grade: "A" },
  { id: "s10", code: "MATH201", title: "Differential Equations", credits: 3, semester: "Y2S1", status: "in-progress", expectedGrade: "B+" },
  { id: "s11", code: "EECE201", title: "Circuit Analysis", credits: 3, semester: "Y2S1", status: "in-progress", expectedGrade: "B" },
  { id: "s12", code: "CSE201", title: "Data Structures & Algorithms", credits: 3, semester: "Y2S1", status: "in-progress", expectedGrade: "A" },
  { id: "s13", code: "STAT201", title: "Probability & Statistics", credits: 3, semester: "Y2S1", status: "in-progress", expectedGrade: "B+" },
  { id: "s14", code: "EECE210", title: "Electromagnetics I", credits: 3, semester: "Y2S2", status: "planned" },
  { id: "s15", code: "IDE201", title: "Engineering Design I", credits: 3, semester: "Y2S2", status: "planned" },
  { id: "s16", code: "MATH202", title: "Linear Algebra", credits: 3, semester: "Y2S2", status: "planned" },
];

export default function GpaPage() {
  const { data: saved, setData: saveData } = useUserData<{
    courses: Course[];
    targetGpa: number;
    degreeCredits: number;
  }>("gpa", {
    courses: SEED_COURSES,
    targetGpa: 3.5,
    degreeCredits: 160,
  });
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
    () => computeStats(courses, targetGpa),
    [courses, targetGpa]
  );
  const series = useMemo(() => semesterSeries(courses), [courses]);
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
      ? courses
      : courses.filter((c) => c.status === statusFilter);

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-gray-900">GPA Predictor &amp; Degree Tracker</h1>
          <p className="mt-1 text-sm text-gray-500">
            Forecast the grades you need to hit your target GPA and track degree
            progress. Scale: {Object.entries(GRADE_POINTS).map(([k, v]) => `${k}=${v.toFixed(1)}`).join(" · ")}
          </p>
        </div>
        <PrintButton />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={<Award size={16} />} label="Current GPA (completed)" value={formatGpa(stats.currentGpa)} sub={`${stats.completedCredits} credits graded`} />
        <StatCard icon={<TrendingUp size={16} />} label="Forecast GPA (with expected)" value={formatGpa(stats.forecastGpa)} sub={`${stats.inProgressCredits} credits in progress`} />
        <StatCard icon={<Target size={16} />} label={`Needed for ${targetGpa.toFixed(2)}`} value={stats.remainingCredits > 0 ? (stats.requiredAverage !== null ? stats.requiredAverage.toFixed(2) : "—") : "Done"} sub={stats.remainingCredits > 0 ? (stats.achievable ? `across ${stats.remainingCredits} remaining credits` : "target not achievable") : "no remaining credits"} accent={!stats.achievable && stats.remainingCredits > 0 ? "red" : "blue"} />
        <StatCard icon={<BookOpen size={16} />} label="Degree Progress" value={`${Math.round(degreeProgress)}%`} sub={`${stats.completedCredits} / ${degreeCredits} credits`} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-4 rounded-xl border border-gray-200 bg-white p-3 text-sm">
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

      <section className="mt-4 rounded-xl border border-gray-200 bg-white p-4">
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
              <Line dataKey="cumulativeGpa" name="Cumulative GPA" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 4 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="mt-4 rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-gray-900">Courses ({courses.length})</h2>
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
                  <td className="py-2">
                    <button
                      onClick={() => removeCourse(c.id)}
                      className="rounded p-1 text-gray-300 transition hover:bg-red-50 hover:text-red-600"
                      aria-label={`Remove ${c.code}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {visibleCourses.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-sm text-gray-400">
                    No courses in this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <form onSubmit={addCourse} className="mt-4 flex flex-wrap items-end gap-2 rounded-lg bg-gray-50 p-3">
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
      </section>
    </main>
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
