"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { AlarmClock, Plus, Trash2, Brain, CalendarDays } from "lucide-react";
import {
  EXAM_TYPES,
  allocateStudy,
  daysLeft,
  formatExamDate,
  type Exam,
  type ExamType,
} from "@/lib/exams";
import { downloadEventIcs, examEvent } from "@/lib/ics";
import { useLanguage } from "@/lib/i18n";
import { StudyShell } from "@/components/ExperienceShells";

const STORAGE_KEY = "ejust-exams-v1";

function buildSeed(now: Date): Exam[] {
  const at = (days: number, hour: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() + days);
    d.setHours(hour, 0, 0, 0);
    return d.toISOString();
  };
  return [
    { id: "x1", courseCode: "MATH201", title: "Differential Equations", type: "Quiz", date: at(4, 10), weight: 15, difficulty: 3 },
    { id: "x2", courseCode: "CSE201", title: "Data Structures", type: "Midterm", date: at(8, 9), weight: 30, difficulty: 4 },
    { id: "x3", courseCode: "EECE201", title: "Circuit Analysis", type: "Midterm", date: at(13, 9), weight: 30, difficulty: 3 },
    { id: "x4", courseCode: "STAT201", title: "Probability & Statistics", type: "Final", date: at(21, 11), weight: 40, difficulty: 4 },
    { id: "x5", courseCode: "EECE201", title: "Circuits Lab Report", type: "Project", date: at(18, 23), weight: 10, difficulty: 2 },
  ];
}

export default function ExamsPage() {
  const { t } = useLanguage();
  const [exams, setExams] = useState<Exam[]>([]);
  const [dailyHours, setDailyHours] = useState(3);
  const [mounted, setMounted] = useState(false);
  const [nowMs, setNowMs] = useState<number | null>(null);
  const [seatCode, setSeatCode] = useState("");
  const [seatResult, setSeatResult] = useState<string | null>(null);
  const [form, setForm] = useState({
    courseCode: "",
    title: "",
    type: "Midterm" as ExamType,
    date: "",
    weight: 30,
    difficulty: 3,
  });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setMounted(true);
      setNowMs(Date.now());
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const saved = JSON.parse(raw) as { exams?: Exam[]; dailyHours?: number };
          if (Array.isArray(saved.exams)) setExams(saved.exams);
          if (typeof saved.dailyHours === "number") setDailyHours(saved.dailyHours);
          return;
        }
      } catch {
        // corrupt storage — fall through to seed
      }
      setExams(buildSeed(new Date()));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ exams, dailyHours }));
    } catch {
      // storage unavailable
    }
  }, [exams, dailyHours, mounted]);

  const allocations = useMemo(
    () => (nowMs === null ? [] : allocateStudy(exams, dailyHours, new Date(nowMs))),
    [exams, dailyHours, nowMs]
  );

  const upcoming = useMemo(() => {
    if (nowMs === null) return [];
    const now = new Date(nowMs);
    return [...exams]
      .map((exam) => ({ exam, days: daysLeft(exam.date, now) }))
      .filter((x) => x.days >= 0)
      .sort((a, b) => a.days - b.days);
  }, [exams, nowMs]);

  const past = useMemo(() => {
    if (nowMs === null) return 0;
    const now = new Date(nowMs);
    return exams.filter((e) => daysLeft(e.date, now) < 0).length;
  }, [exams, nowMs]);
  const chartData = allocations.map((a) => ({
    name: a.exam.courseCode,
    hours: a.totalHours,
  }));

  function addExam(e: React.FormEvent) {
    e.preventDefault();
    if (!form.courseCode.trim() || !form.title.trim() || !form.date) return;
    setExams((prev) => [
      ...prev,
      {
        id: `x-${Date.now()}`,
        courseCode: form.courseCode.trim().toUpperCase(),
        title: form.title.trim(),
        type: form.type,
        date: form.date,
        weight: Math.max(0, Math.min(100, form.weight)),
        difficulty: Math.max(1, Math.min(4, form.difficulty)),
      },
    ]);
    setForm((f) => ({ ...f, courseCode: "", title: "", date: "" }));
  }

  const nextExam = upcoming[0];
  // `upcoming` is empty until `nowMs` is hydrated, so there is no safe fallback clock.
  const countdown =
    nextExam && nowMs !== null
      ? Math.max(0, new Date(nextExam.exam.date).getTime() - nowMs)
      : 0;
  const countdownLabel = `${Math.floor(countdown / 86_400_000)}d ${String(Math.floor(countdown / 3_600_000) % 24).padStart(2, "0")}h ${String(Math.floor(countdown / 60_000) % 60).padStart(2, "0")}m`;

  return (
    <StudyShell icon={<AlarmClock size={19} />} title={t("study.exams")} description="Keep every deadline visible, turn urgency into a study split, and find your exam seat quickly." action={<button onClick={() => downloadEventIcs(upcoming.map(({ exam }) => examEvent(exam)), "ejust-exams.ics", "EJUST Exams")} disabled={!upcoming.length} className="print:hidden rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">{t("study.export")}</button>}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="sr-only">Exam Countdown &amp; Study Planner</h1>
          <p className="mt-1 text-sm text-gray-500">
            Track deadlines and get a suggested daily study split based on urgency, weight, and
            difficulty.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-gray-600">
            Daily study hours
            <input
              type="number"
              min={1}
              max={12}
              step={0.5}
              value={dailyHours}
              onChange={(e) => setDailyHours(Math.max(1, Math.min(12, Number(e.target.value) || 1)))}
              className="w-20 rounded-lg border border-gray-200 px-2 py-1 text-sm outline-none focus:border-blue-400"
            />
          </label>
        </div>
      </div>

      <section className="mt-8 grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-5 dark:border-cyan-900 dark:bg-cyan-950/30"><p className="text-xs font-semibold text-cyan-700 dark:text-cyan-300">{t("study.countdown")}</p><p className="mt-2 font-mono text-3xl font-semibold text-slate-900 dark:text-white">{countdownLabel}</p><p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{nextExam?.exam.title ?? "Add an exam to start the clock."}</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"><p className="text-xs font-semibold text-slate-500">{t("study.hall")}</p><div className="mt-3 flex flex-wrap gap-2"><span className="rounded-full bg-slate-100 px-3 py-1 text-xs dark:bg-slate-800">Hall A2</span><span className="rounded-full bg-slate-100 px-3 py-1 text-xs dark:bg-slate-800">Building E</span><span className="rounded-full bg-slate-100 px-3 py-1 text-xs dark:bg-slate-800">Floor 2</span></div></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"><p className="text-xs font-semibold text-slate-500">{t("study.seat")}</p><div className="mt-3 flex gap-2"><input value={seatCode} onChange={(event) => setSeatCode(event.target.value)} placeholder="Student ID" className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" /><button onClick={() => setSeatResult(seatCode ? "Hall A2 · Row 4 · Seat 18" : "Enter your student ID")} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white dark:bg-cyan-300 dark:text-slate-950">{t("study.lookup")}</button></div>{seatResult && <p className="mt-2 text-xs text-cyan-700 dark:text-cyan-300">{seatResult}</p>}</div>
      </section>
      <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {upcoming.map(({ exam, days }) => (
          <article
            key={exam.id}
            className={`rounded-xl border bg-white p-3 ${
              days <= 3 ? "border-red-200" : days <= 7 ? "border-amber-200" : "border-gray-200"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-mono text-[11px] font-bold text-gray-400">{exam.courseCode}</p>
                <h2 className="truncate text-sm font-semibold text-gray-900">{exam.title}</h2>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                  days <= 3
                    ? "bg-red-600 text-white"
                    : days <= 7
                      ? "bg-amber-500 text-white"
                      : "bg-blue-50 text-blue-700"
                }`}
              >
                {days === 0 ? "today" : days === 1 ? "1 day" : `${days} days`}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1 text-[11px]">
              <span className="rounded-full bg-gray-100 px-2 py-0.5 font-medium text-gray-600">
                {exam.type}
              </span>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 font-medium text-gray-600">
                {exam.weight}% of grade
              </span>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 font-medium text-gray-600">
                {"●".repeat(exam.difficulty)}
                {"○".repeat(4 - exam.difficulty)}
              </span>
            </div>
            <p className="mt-2 flex items-center gap-1 text-xs text-gray-500">
              <CalendarDays size={12} />
              {formatExamDate(exam.date)}
            </p>
            <button
              onClick={() => setExams((prev) => prev.filter((e) => e.id !== exam.id))}
              className="mt-2 flex items-center gap-1 text-[11px] text-gray-400 hover:text-red-600"
            >
              <Trash2 size={11} />
              Remove
            </button>
          </article>
        ))}
        {upcoming.length === 0 && (
          <p className="col-span-full rounded-xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-400">
            No upcoming exams. Add one below to start planning.
          </p>
        )}
        {past > 0 && (
          <p className="col-span-full text-[11px] text-gray-400">
            {past} past exam{past > 1 ? "s" : ""} hidden from the countdown.
          </p>
        )}
      </div>

      <section className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
            <Brain size={15} className="text-blue-600" />
            Suggested study split
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            Priorities balance difficulty, grade weight, and time left — not a guarantee, adjust as
            needed.
          </p>
          <table className="mt-3 w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-100 text-[11px] text-gray-400">
                <th className="py-1.5 pr-2">Course</th>
                <th className="py-1.5 pr-2">Days</th>
                <th className="py-1.5 pr-2">Per day</th>
                <th className="py-1.5">Total</th>
              </tr>
            </thead>
            <tbody>
              {allocations.map((a) => (
                <tr key={a.exam.id} className="border-b border-gray-50 last:border-0">
                  <td className="py-1.5 pr-2">
                    <span className="font-mono text-[11px] font-semibold text-gray-800">
                      {a.exam.courseCode}
                    </span>
                    <span className="ml-1 text-gray-500">{a.exam.type}</span>
                  </td>
                  <td className="py-1.5 pr-2 text-gray-600">{a.days}</td>
                  <td className="py-1.5 pr-2 font-medium text-gray-800">
                    {a.perDayMin >= 60
                      ? `${Math.floor(a.perDayMin / 60)}h ${a.perDayMin % 60}m`
                      : `${a.perDayMin}m`}
                  </td>
                  <td className="py-1.5 text-gray-600">{a.totalHours}h</td>
                </tr>
              ))}
              {allocations.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-gray-400">
                    Add an exam to generate a plan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-gray-900">Total study hours before each exam</h2>
          <div className="mt-2 h-56">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 5, right: 8, left: -22, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => [`${v} h`, "Study time"]} />
                  <Bar dataKey="hours" fill="#60a5fa" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="flex h-full items-center justify-center text-sm text-gray-400">
                No plan yet.
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="mt-5 rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-gray-900">Add exam</h2>
        <form onSubmit={addExam} className="mt-3 flex flex-wrap items-end gap-2 rounded-lg bg-gray-50 p-3">
          <Field label="Code">
            <input value={form.courseCode} onChange={(e) => setForm({ ...form, courseCode: e.target.value })} placeholder="MATH201" className="w-28 rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-blue-400" />
          </Field>
          <Field label="Title" className="min-w-40 flex-1">
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Differential Equations" className="w-full rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-blue-400" />
          </Field>
          <Field label="Type">
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as ExamType })} className="rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-blue-400">
              {EXAM_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </Field>
          <Field label="Date & time">
            <input type="datetime-local" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-blue-400" />
          </Field>
          <Field label="Weight %">
            <input type="number" min={0} max={100} value={form.weight} onChange={(e) => setForm({ ...form, weight: Number(e.target.value) || 0 })} className="w-20 rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-blue-400" />
          </Field>
          <Field label="Difficulty">
            <select value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: Number(e.target.value) })} className="rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-blue-400">
              <option value={1}>1 — easy</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
              <option value={4}>4 — hard</option>
            </select>
          </Field>
          <button type="submit" className="flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
            <Plus size={14} />
            Add
          </button>
        </form>
      </section>
    </StudyShell>
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
