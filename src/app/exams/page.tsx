"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { AlarmClock, ClipboardPaste, Plus, Trash2, Brain, CalendarDays, FileText } from "lucide-react";
import {
  EXAM_TYPES,
  allocateStudy,
  daysLeft,
  formatExamDate,
  type Exam,
  type ExamType,
} from "@/lib/exams";
import { buildExamsIcs, downloadIcsFile } from "@/lib/ics-export";
import { useLanguage, type TranslationKey } from "@/lib/i18n";
import { normalizeCode, type LiveExam } from "@/lib/hub-feed";
import { FACULTIES, inferFacultyFromCourseCode, isFaculty, type Faculty } from "@/lib/faculty";
import { StudyShell } from "@/components/ExperienceShells";
import SisSyncGuide, { useSyncedCourses } from "@/components/SisSyncGuide";
import ExamImportModal from "@/components/ExamImportModal";
import FinalTargetCalculator from "@/components/FinalTargetCalculator";
import RoomBadge from "@/components/RoomBadge";
import {
  ACADEMIC_PROFILE_EVENT,
  FACULTY_LABEL_KEY,
  readAcademicProfile,
  toHubFaculty,
} from "@/lib/onboarding";
import {
  readExamSeat,
  readExamsSnapshot,
  readFaculty,
  writeExamSeat,
  writeExamsSnapshot,
  writeFaculty,
} from "@/lib/student-data";

interface SeatInfo {
  hall: string;
  seat: string;
}

type ExamFilterMode = "my" | "faculty" | "all";
type FilterSelection = ExamFilterMode | "auto";

const EXAM_LABEL: Record<ExamType, TranslationKey> = {
  Quiz: "study.examQuiz",
  Midterm: "study.examMidterm",
  Final: "study.examFinal",
  Project: "study.examProject",
};

function daysLabel(days: number, t: (key: TranslationKey) => string): string {
  if (days === 0) return t("study.today");
  if (days === 1) return t("study.oneDay");
  return t("study.daysLeft").replace("{n}", String(days));
}

function examKey(exam: Exam): string {
  return `${normalizeCode(exam.courseCode)}|${exam.type}|${new Date(exam.date).toDateString()}`;
}

function filterChipClass(active: boolean): string {
  return `rounded-full border px-3 py-1 text-xs font-semibold transition ${
    active
      ? "border-cyan-400 bg-cyan-100 text-cyan-800 dark:border-cyan-600 dark:bg-cyan-950/50 dark:text-cyan-200"
      : "border-slate-200 bg-white text-slate-500 hover:border-cyan-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400"
  }`;
}

export default function ExamsPage() {
  const { locale, t } = useLanguage();
  const { data: session, status } = useSession();
  const studentUser = status === "authenticated" ? session?.user : null;
  const userScope = studentUser?.id ?? studentUser?.email ?? null;
  const [exams, setExams] = useState<Exam[]>([]);
  const [hubExams, setHubExams] = useState<LiveExam[]>([]);
  const [hubAvailable, setHubAvailable] = useState(true);
  const [hubLoading, setHubLoading] = useState(true);
  const [dailyHours, setDailyHours] = useState(3);
  const [mounted, setMounted] = useState(false);
  const [nowMs, setNowMs] = useState<number | null>(null);
  const [seatInfo, setSeatInfo] = useState<SeatInfo | null>(null);
  const [hallInput, setHallInput] = useState("");
  const [seatInput, setSeatInput] = useState("");
  const [editingSeat, setEditingSeat] = useState(false);
  const synced = useSyncedCourses();
  const [highlightSynced, setHighlightSynced] = useState(true);
  const [filterMode, setFilterMode] = useState<FilterSelection>("auto");
  const [faculty, setFaculty] = useState<Faculty>("CSIT");
  const [facultyChosen, setFacultyChosen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [sisOpen, setSisOpen] = useState(false);
  const [sisTab, setSisTab] = useState<"guide" | "paste">("guide");
  const [refreshKey, setRefreshKey] = useState(0);
  const syncedCodes = useMemo(
    () => new Set(synced.courses.map((course) => course.courseCode.replace(/[^A-Z0-9]/gi, "").toUpperCase())),
    [synced.courses]
  );
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
        const savedFaculty = readFaculty(window.localStorage, studentUser);
        if (isFaculty(savedFaculty)) {
          setFaculty(savedFaculty);
          setFacultyChosen(true);
        }
        const shared = readAcademicProfile(studentUser);
        if (shared) {
          setFaculty(toHubFaculty(shared.faculty));
          setFacultyChosen(true);
        }
        const saved = readExamsSnapshot(window.localStorage, studentUser);
        setExams(saved.exams);
        setDailyHours(saved.dailyHours);
        setSeatInfo(readExamSeat(window.localStorage, studentUser));
      } catch {
        // corrupt storage — keep the local planner empty
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [studentUser, userScope]);

  useEffect(() => {
    const applyProfile = () => {
      const shared = readAcademicProfile(studentUser);
      if (shared) {
        setFaculty(toHubFaculty(shared.faculty));
        setFacultyChosen(true);
      }
    };
    window.addEventListener(ACADEMIC_PROFILE_EVENT, applyProfile);
    return () => window.removeEventListener(ACADEMIC_PROFILE_EVENT, applyProfile);
  }, [studentUser, userScope]);

  // Live exams are the source of truth; local exams are the student's own additions.
  useEffect(() => {
    if (!mounted) return;
    const controller = new AbortController();
    const codes = [...syncedCodes].join(",");
    fetch(`/api/exams?codes=${encodeURIComponent(codes)}`, { signal: controller.signal })
      .then((response) => response.json())
      .then((payload: { exams?: LiveExam[]; available?: boolean }) => {
        if (controller.signal.aborted) return;
        setHubExams(Array.isArray(payload.exams) ? payload.exams : []);
        setHubAvailable(payload.available !== false);
      })
      .catch(() => {
        if (!controller.signal.aborted) setHubAvailable(false);
      })
      .finally(() => {
        if (!controller.signal.aborted) setHubLoading(false);
      });
    return () => controller.abort();
  }, [mounted, syncedCodes, refreshKey]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    try {
      writeExamsSnapshot(window.localStorage, studentUser, { exams, dailyHours });
    } catch {
      // storage unavailable
    }
  }, [exams, dailyHours, mounted, studentUser, userScope]);

  useEffect(() => {
    if (!mounted || !facultyChosen) return;
    try {
      writeFaculty(window.localStorage, studentUser, faculty);
    } catch {
      // storage unavailable
    }
  }, [faculty, facultyChosen, mounted, studentUser, userScope]);

  useEffect(() => {
    if (!mounted) return;
    try {
      writeExamSeat(window.localStorage, studentUser, seatInfo);
    } catch {
      // storage unavailable
    }
  }, [mounted, seatInfo, studentUser, userScope]);

  function saveSeat() {
    const hall = hallInput.trim();
    const seat = seatInput.trim();
    if (!hall && !seat) return;
    setSeatInfo({ hall, seat });
    setEditingSeat(false);
  }

  const allExams = useMemo(() => {
    const localKeys = new Set(hubExams.map(examKey));
    return [
      ...hubExams,
      ...exams.filter((exam) => !localKeys.has(examKey(exam))),
    ];
  }, [exams, hubExams]);

  const effectiveMode: ExamFilterMode =
    filterMode === "auto" ? (syncedCodes.size > 0 ? "my" : "faculty") : filterMode;

  const visibleExams = useMemo(() => {
    if (effectiveMode === "all") return allExams;
    if (effectiveMode === "my") {
      return allExams.filter((exam) => syncedCodes.has(normalizeCode(exam.courseCode)));
    }
    return allExams.filter((exam) => {
      const examFaculty = "faculty" in exam ? exam.faculty : inferFacultyFromCourseCode(exam.courseCode);
      return examFaculty === faculty;
    });
  }, [allExams, effectiveMode, faculty, syncedCodes]);

  const allocations = useMemo(
    () => (nowMs === null ? [] : allocateStudy(visibleExams, dailyHours, new Date(nowMs))),
    [visibleExams, dailyHours, nowMs]
  );

  const upcoming = useMemo(() => {
    if (nowMs === null) return [];
    const now = new Date(nowMs);
    return [...visibleExams]
      .map((exam) => ({ exam, days: daysLeft(exam.date, now) }))
      .filter((x) => x.days >= 0)
      .sort((a, b) => a.days - b.days);
  }, [visibleExams, nowMs]);

  const past = useMemo(() => {
    if (nowMs === null) return 0;
    const now = new Date(nowMs);
    return visibleExams.filter((e) => daysLeft(e.date, now) < 0).length;
  }, [visibleExams, nowMs]);
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
    <StudyShell icon={<AlarmClock size={19} />} title={t("study.exams")} description="Keep every deadline visible, turn urgency into a study split, and find your exam seat quickly." action={<button onClick={() => downloadIcsFile(buildExamsIcs(upcoming.map(({ exam }) => exam), { seat: seatInfo }), "ejust-exams.ics")} disabled={!upcoming.length} className="print:hidden rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">{t("study.exportExams")}</button>}>
      <SisSyncGuide open={sisOpen} onOpenChange={setSisOpen} initialTab={sisTab} />
      {visibleExams.length === 0 && (
        <p className="rounded-xl border border-dashed border-cyan-300 bg-cyan-50/60 p-3 text-sm text-cyan-800 dark:border-cyan-700 dark:bg-cyan-950/30 dark:text-cyan-200">
          {t("study.exportEmpty")}
        </p>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="sr-only">Exam Countdown &amp; Study Planner</h1>
          <p className="mt-1 text-sm text-gray-500">
            Track deadlines and get a suggested daily study split based on urgency, weight, and
            difficulty.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setSisTab("paste");
              setSisOpen(true);
            }}
            className="print:hidden inline-flex items-center gap-1.5 rounded-full border border-cyan-300 bg-white px-3 py-1 text-xs font-semibold text-cyan-700 hover:bg-cyan-50 dark:border-cyan-700 dark:bg-slate-900 dark:text-cyan-300"
          >
            <ClipboardPaste size={13} />
            {t("sisPaste.tab")}
          </button>
          <button
            type="button"
            onClick={() => document.getElementById("add-exam-form")?.scrollIntoView({ behavior: "smooth" })}
            className="print:hidden inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:border-cyan-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <Plus size={13} />
            {t("empty.addExam")}
          </button>
          {synced.courses.length > 0 && (
            <label className="flex cursor-pointer items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-800 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-200">
              <input
                type="checkbox"
                checked={highlightSynced}
                onChange={(event) => setHighlightSynced(event.target.checked)}
                className="accent-cyan-600"
              />
              {t("sis.mySynced")}
            </label>
          )}
          <label className="flex items-center gap-2 text-sm text-gray-600">
            {t("study.hours")}
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

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setFilterMode("my")}
          className={filterChipClass(effectiveMode === "my")}
          aria-pressed={effectiveMode === "my"}
        >
          {t("study.filterMyCourses")}
        </button>
        <button
          type="button"
          onClick={() => setFilterMode("faculty")}
          className={filterChipClass(effectiveMode === "faculty")}
          aria-pressed={effectiveMode === "faculty"}
        >
          {t("study.filterMyFaculty")}
        </button>
        <button
          type="button"
          onClick={() => setFilterMode("all")}
          className={filterChipClass(effectiveMode === "all")}
          aria-pressed={effectiveMode === "all"}
        >
          {t("study.filterAllFaculties")}
        </button>
        {effectiveMode === "faculty" && (
          <label className="flex items-center gap-1.5 text-xs text-slate-500">
            {t("study.faculty")}
            <select
              value={faculty}
              onChange={(event) => {
                setFaculty(event.target.value as Faculty);
                setFacultyChosen(true);
              }}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold outline-none focus:border-cyan-400 dark:border-slate-700 dark:bg-slate-900"
            >
              {FACULTIES.map((option) => (
                <option key={option} value={option}>
                  {option} — {t(FACULTY_LABEL_KEY[option])}
                </option>
              ))}
            </select>
          </label>
        )}
        <button
          type="button"
          onClick={() => setImportOpen(true)}
          className="ms-auto flex items-center gap-1.5 rounded-full border border-cyan-300 bg-white px-3 py-1 text-xs font-semibold text-cyan-700 hover:bg-cyan-50 dark:border-cyan-700 dark:bg-slate-900 dark:text-cyan-300"
        >
          <FileText size={13} />
          {t("study.importOpen")}
        </button>
      </div>

      <FinalTargetCalculator className="mt-4" />

      <section className="mt-8 grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-5 dark:border-cyan-900 dark:bg-cyan-950/30"><p className="text-xs font-semibold text-cyan-700 dark:text-cyan-300">{t("study.countdown")}</p><p className="mt-2 font-mono text-3xl font-semibold text-slate-900 dark:text-white">{countdownLabel}</p><p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{nextExam?.exam.title ?? t("empty.examsBody")}</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 md:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-500">{t("study.hall")} · {t("study.seat")}</p>
              {seatInfo && !editingSeat ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {seatInfo.hall && <span className="rounded-full bg-cyan-100 px-3 py-1 text-xs font-semibold text-cyan-800 dark:bg-cyan-950/50 dark:text-cyan-200">{seatInfo.hall}</span>}
                  {seatInfo.seat && <span className="rounded-full bg-slate-100 px-3 py-1 text-xs dark:bg-slate-800">{t("study.seat")}: {seatInfo.seat}</span>}
                  <span className="text-[11px] text-slate-400">{t("study.seatSaved")}</span>
                </div>
              ) : (
                <p className="mt-2 text-xs leading-5 text-slate-500">{t("study.seatEmpty")}</p>
              )}
            </div>
            {seatInfo && !editingSeat && (
              <div className="flex gap-2">
                <button type="button" onClick={() => { setHallInput(seatInfo.hall); setSeatInput(seatInfo.seat); setEditingSeat(true); }} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-cyan-300 dark:border-slate-700 dark:text-slate-300">{t("study.seatEdit")}</button>
                <button type="button" onClick={() => { setSeatInfo(null); setHallInput(""); setSeatInput(""); setEditingSeat(false); }} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-rose-300 dark:border-slate-700 dark:text-slate-300">{t("study.seatClear")}</button>
              </div>
            )}
          </div>
          {(editingSeat || !seatInfo) && (
            <div className="mt-4 flex flex-wrap gap-2">
              <input value={hallInput} onChange={(event) => setHallInput(event.target.value)} placeholder={t("study.seatHallPlaceholder")} className="min-w-0 flex-1 basis-32 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" />
              <input value={seatInput} onChange={(event) => setSeatInput(event.target.value)} placeholder={t("study.seatSeatPlaceholder")} className="min-w-0 flex-1 basis-32 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" />
              <button type="button" onClick={saveSeat} className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white dark:bg-cyan-300 dark:text-slate-950">{t("study.seatSave")}</button>
            </div>
          )}
        </div>
      </section>
      <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {upcoming.map(({ exam, days }) => {
          const hub = "source" in exam ? (exam as LiveExam) : null;
          const subtitle = hub
            ? locale === "ar" && hub.courseNameAr
              ? hub.courseNameAr
              : hub.courseName
            : null;
          const isSynced = syncedCodes.has(normalizeCode(exam.courseCode));
          const examFaculty: Faculty =
            "faculty" in exam && isFaculty(exam.faculty)
              ? exam.faculty
              : inferFacultyFromCourseCode(exam.courseCode);
          const emphasized = highlightSynced && isSynced;
          const dimmed = highlightSynced && syncedCodes.size > 0 && !isSynced;
          return (
          <article
            key={exam.id}
            className={`rounded-xl border bg-white p-3 ${
              emphasized
                ? "border-cyan-300 ring-2 ring-cyan-400 dark:bg-slate-900"
                : days <= 3 ? "border-red-200" : days <= 7 ? "border-amber-200" : "border-gray-200"
            } ${dimmed ? "opacity-60" : ""}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-mono text-[11px] font-bold text-gray-400">
                  {exam.courseCode}
                  {emphasized && <span className="ms-2 rounded-full bg-cyan-100 px-1.5 py-0.5 text-[9px] font-bold text-cyan-700">{t("sis.mySynced")}</span>}
                </p>
                <h2 className="truncate text-sm font-semibold text-gray-900">{exam.title}</h2>
                {subtitle && <p className="truncate text-[11px] text-gray-500">{subtitle}</p>}
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
                {daysLabel(days, t)}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1 text-[11px]">
              <span className="rounded-full bg-gray-100 px-2 py-0.5 font-medium text-gray-600">
                {t(EXAM_LABEL[exam.type])}
              </span>
              <span className="rounded-full bg-indigo-50 px-2 py-0.5 font-medium text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
                {examFaculty}
              </span>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 font-medium text-gray-600">
                {t("study.ofGrade").replace("{n}", String(exam.weight))}
              </span>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 font-medium text-gray-600">
                {"●".repeat(exam.difficulty)}
                {"○".repeat(4 - exam.difficulty)}
              </span>
              {hub && (
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                  {t("study.hubExam")}
                </span>
              )}
            </div>
            <p className="mt-2 flex items-center gap-1 text-xs text-gray-500">
              <CalendarDays size={12} />
              {formatExamDate(exam.date)}
              {hub && hub.location !== "TBA" && (
                <>
                  <span aria-hidden>·</span>
                  <RoomBadge location={hub.location} />
                </>
              )}
            </p>
            {!hub && (
              <button
                onClick={() => setExams((prev) => prev.filter((e) => e.id !== exam.id))}
                className="mt-2 flex items-center gap-1 text-[11px] text-gray-400 hover:text-red-600"
              >
                <Trash2 size={11} />
                {t("study.remove")}
              </button>
            )}
          </article>
          );
        })}
        {hubLoading && (
          <p className="col-span-full text-center text-xs text-gray-400">…</p>
        )}
        {!hubAvailable && (
          <p className="col-span-full rounded-xl border border-amber-200 bg-amber-50 p-3 text-center text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            {t("study.hubUnavailable")}
          </p>
        )}
        {upcoming.length === 0 && !hubLoading && (
          <section className="col-span-full rounded-xl border border-dashed border-cyan-300 bg-cyan-50/50 p-6 text-center dark:border-cyan-800 dark:bg-cyan-950/20">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{t("empty.examsTitle")}</h2>
            <p className="mx-auto mt-1 max-w-lg text-sm text-slate-600 dark:text-slate-400">{t("empty.examsBody")}</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={() => setSisOpen(true)}
                className="rounded-lg bg-cyan-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-cyan-700"
              >
                {t("empty.importSis")}
              </button>
              <button
                type="button"
                onClick={() => document.getElementById("add-exam-form")?.scrollIntoView({ behavior: "smooth" })}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:border-cyan-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                <Plus size={13} />
                {t("empty.addExam")}
              </button>
            </div>
          </section>
        )}
        {past > 0 && (
          <p className="col-span-full text-[11px] text-gray-400">
            {t("study.pastHidden", { n: past })}
          </p>
        )}
      </div>

      <section className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
            <Brain size={15} className="text-blue-600" />
            {t("study.studySplit")}
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
                    {t("empty.examsBody")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-gray-900">{t("study.studyHours")}</h2>
          <div className="mt-2 h-56">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 5, right: 8, left: -22, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => [`${v} h`, t("study.studyTime")]} />
                  <Bar dataKey="hours" fill="#60a5fa" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="flex h-full items-center justify-center text-sm text-gray-400">
                {t("study.noPlan")}
              </p>
            )}
          </div>
        </div>
      </section>

      <section id="add-exam-form" className="mt-5 rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-gray-900">{t("study.addExam")}</h2>
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
      {importOpen && (
        <ExamImportModal
          open
          onClose={() => setImportOpen(false)}
          onImported={() => setRefreshKey((key) => key + 1)}
        />
      )}
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
