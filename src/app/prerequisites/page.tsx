"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { useSession } from "next-auth/react";
import {
  AlertTriangle,
  CheckCircle2,
  GitBranch,
  Info,
  Lock,
  Network,
  RotateCcw,
  Sparkles,
  Unlock,
} from "lucide-react";
import { StudyShell, SearchBar } from "@/components/ExperienceShells";
import PrintButton from "@/components/PrintButton";
import { SEMESTERS, getCurriculum, type CourseNode } from "@/data/prerequisites";
import { useLanguage, type Locale } from "@/lib/i18n";
import { prereqStorageKey, readGpa, writePrereqState } from "@/lib/student-data";
import {
  DEFAULT_PREREQ_STATE,
  analyzeCourse,
  criticalPathCodes,
  evaluateCurriculum,
  normalizeCourseCode,
  sanitizePrereqState,
  summarizeCurriculum,
  syncPassedCoursesFromGpa,
  upstreamCourses,
  type NodeEvaluation,
  type PrereqState,
} from "@/lib/prerequisite-tree";

type Filter = "all" | "unlocked" | "locked" | "completed" | "critical";

const FILTERS: Filter[] = ["all", "unlocked", "locked", "completed", "critical"];

const FILTER_KEY: Record<Filter, "filterAll" | "filterUnlocked" | "filterLocked" | "filterCompleted" | "filterCritical"> = {
  all: "filterAll",
  unlocked: "filterUnlocked",
  locked: "filterLocked",
  completed: "filterCompleted",
  critical: "filterCritical",
};

const STATUS_KEY: Record<NodeEvaluation["status"], "filterCompleted" | "filterUnlocked" | "filterLocked"> = {
  completed: "filterCompleted",
  unlocked: "filterUnlocked",
  locked: "filterLocked",
};

function semesterNumber(semester: string): number {
  return Number.parseInt(semester.replace(/\D/g, ""), 10) || 1;
}

const DEFAULT_SNAPSHOT = JSON.stringify(DEFAULT_PREREQ_STATE);
const PREREQ_CHANGE_EVENT = "ejust:prereqs-changed";

function parseSnapshot(snapshot: string): PrereqState {
  try {
    return (
      sanitizePrereqState(JSON.parse(snapshot), { requireValidDepartment: true }) ??
      DEFAULT_PREREQ_STATE
    );
  } catch {
    return DEFAULT_PREREQ_STATE;
  }
}

function getServerSnapshot() {
  return DEFAULT_SNAPSHOT;
}

export default function PrerequisitesPage() {
  const { t, locale } = useLanguage();
  const { data: session, status } = useSession();
  const storageUser = useMemo(
    () => (status === "authenticated" ? session?.user ?? null : null),
    [session?.user, status],
  );

  const storageKey = useMemo(() => prereqStorageKey(storageUser), [storageUser]);
  const subscribe = useCallback(
    (notify: () => void) => {
      if (typeof window === "undefined") return () => {};
      const onChange = (event?: Event) => {
        if (event instanceof StorageEvent && event.key && event.key !== storageKey) return;
        notify();
      };
      window.addEventListener(PREREQ_CHANGE_EVENT, onChange);
      window.addEventListener("ejust:data-restored", onChange);
      window.addEventListener("storage", onChange);
      return () => {
        window.removeEventListener(PREREQ_CHANGE_EVENT, onChange);
        window.removeEventListener("ejust:data-restored", onChange);
        window.removeEventListener("storage", onChange);
      };
    },
    [storageKey],
  );
  const getSnapshot = useCallback(() => {
    if (typeof window === "undefined") return DEFAULT_SNAPSHOT;
    try {
      return window.localStorage.getItem(storageKey) ?? DEFAULT_SNAPSHOT;
    } catch {
      return DEFAULT_SNAPSHOT;
    }
  }, [storageKey]);
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const state = useMemo(() => parseSnapshot(snapshot), [snapshot]);

  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const program = useMemo(() => getCurriculum(state.department), [state.department]);
  const completedCodes = useMemo(
    () => new Set(state.completedCourseCodes.map(normalizeCourseCode)),
    [state.completedCourseCodes],
  );
  const evaluations = useMemo(
    () => evaluateCurriculum(program.courses, completedCodes),
    [program.courses, completedCodes],
  );
  const summary = useMemo(
    () => summarizeCurriculum(program.courses, completedCodes),
    [program.courses, completedCodes],
  );
  const critical = useMemo(
    () => new Set(criticalPathCodes(program.courses)),
    [program.courses],
  );
  const impact = useMemo(
    () => (selectedCode ? analyzeCourse(program.courses, selectedCode) : null),
    [program.courses, selectedCode],
  );
  const upstream = useMemo(
    () => new Set(
      selectedCode
        ? upstreamCourses(program.courses, selectedCode).map((course) => normalizeCourseCode(course.code))
        : [],
    ),
    [program.courses, selectedCode],
  );
  const downstream = useMemo(
    () => new Set(
      impact?.downstreamChain.map((course) => normalizeCourseCode(course.code)) ?? [],
    ),
    [impact],
  );

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return evaluations.filter((node) => {
      const code = normalizeCourseCode(node.code);
      const matchesFilter =
        filter === "all" ? true : filter === "critical" ? critical.has(code) : node.status === filter;
      const matchesTerm =
        !term || node.code.toLowerCase().includes(term) || node.title.toLowerCase().includes(term);
      return matchesFilter && matchesTerm;
    });
  }, [evaluations, filter, critical, query]);

  const grouped = useMemo(
    () =>
      SEMESTERS.map((semester) => ({
        semester,
        nodes: visible.filter((node) => node.semester === semester),
      })).filter((group) => group.nodes.length > 0),
    [visible],
  );

  function commit(next: PrereqState) {
    if (typeof window === "undefined") return;
    writePrereqState(window.localStorage, storageUser, next);
    window.dispatchEvent(new Event(PREREQ_CHANGE_EVENT));
  }

  function toggleCourse(code: string) {
    const normalized = normalizeCourseCode(code);
    commit({
      ...state,
      completedCourseCodes: state.completedCourseCodes.includes(normalized)
        ? state.completedCourseCodes.filter((entry) => entry !== normalized)
        : [...state.completedCourseCodes, normalized],
    });
    setSelectedCode(normalized);
    setNotice(null);
  }

  function syncFromGpa() {
    if (typeof window === "undefined") return;
    const codes = syncPassedCoursesFromGpa(readGpa(window.localStorage, storageUser));
    commit({ ...state, completedCourseCodes: codes });
    setNotice(t(codes.length > 0 ? "prereqs.synced" : "prereqs.syncEmpty", { n: codes.length }));
  }

  function resetSimulation() {
    commit({ ...state, completedCourseCodes: [] });
    setSelectedCode(null);
    setNotice(t("prereqs.resetDone"));
  }

  function cardClass(node: NodeEvaluation): string {
    const statusClass =
      node.status === "completed"
        ? "border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/35 dark:text-emerald-100"
        : node.status === "unlocked"
          ? "border-cyan-300 bg-cyan-50 text-cyan-950 dark:border-cyan-800 dark:bg-cyan-950/30 dark:text-cyan-100"
          : "border-slate-200 bg-white text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400";
    const focusClass = selectedCode === normalizeCourseCode(node.code)
      ? "ring-2 ring-blue-500"
      : downstream.has(normalizeCourseCode(node.code))
        ? "ring-2 ring-rose-400"
        : upstream.has(normalizeCourseCode(node.code))
          ? "ring-2 ring-amber-400"
          : "";
    return `w-full rounded-xl border p-3 text-start transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${statusClass} ${focusClass}`;
  }

  function renderCourse(node: NodeEvaluation) {
    const StatusIcon = node.status === "completed" ? CheckCircle2 : node.status === "unlocked" ? Unlock : Lock;
    return (
      <button
        key={node.code}
        type="button"
        onClick={() => toggleCourse(node.code)}
        aria-pressed={node.status === "completed"}
        aria-label={`${node.code} — ${node.title} — ${t(`prereqs.${STATUS_KEY[node.status]}`)}`}
        className={cardClass(node)}
      >
        <span className="flex items-start justify-between gap-2">
          <span className="min-w-0">
            <span className="block font-mono text-xs font-bold">{normalizeCourseCode(node.code)}</span>
            <span className="mt-0.5 block text-sm font-semibold leading-snug">{node.title}</span>
          </span>
          <StatusIcon size={16} className="shrink-0 opacity-80" />
        </span>
        <span className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-medium opacity-80">
          <span>{t("prereqs.credits")}: {node.credits}</span>
          <span aria-hidden="true">·</span>
          <span>{t(`prereqs.${STATUS_KEY[node.status]}`)}</span>
          {critical.has(normalizeCourseCode(node.code)) && (
            <>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300">
                <Network size={11} />
                {t("prereqs.criticalPath")}
              </span>
            </>
          )}
        </span>
        {node.status === "locked" && node.missingPrerequisites.length > 0 && (
          <span className="mt-1 block text-[11px] text-rose-700 dark:text-rose-300">
            {t("prereqs.missing", { list: node.missingPrerequisites.map(normalizeCourseCode).join(", ") })}
          </span>
        )}
        {node.corequisites && node.corequisites.length > 0 && (
          <span className="mt-1 block text-[11px] opacity-70">
            {t("prereqs.corequisites", { list: node.corequisites.map(normalizeCourseCode).join(", ") })}
          </span>
        )}
      </button>
    );
  }

  function renderChipList(courses: CourseNode[], emptyLabel?: string) {
    if (courses.length === 0) return emptyLabel ? <p className="text-xs opacity-70">{emptyLabel}</p> : null;
    return (
      <div className="mt-2 flex flex-wrap gap-1.5">
        {courses.map((course) => (
          <span
            key={course.code}
            className="rounded-full border border-current/20 bg-white/60 px-2 py-1 font-mono text-[11px] font-semibold dark:bg-slate-950/50"
          >
            {normalizeCourseCode(course.code)}
          </span>
        ))}
      </div>
    );
  }

  return (
    <StudyShell
      icon={<GitBranch size={19} />}
      title={t("prereqs.title")}
      description={t("prereqs.description")}
      action={<PrintButton />}
    >
      <aside className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/25 dark:text-amber-100">
        <Info size={18} className="mt-0.5 shrink-0" />
        <div>
          <p className="text-xs font-bold uppercase tracking-wide">{t("prereqs.advisoryLabel")}</p>
          <p className="mt-1 leading-6">{program.advisory[locale as Locale]}</p>
        </div>
      </aside>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-44 flex-1">
            <span className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-400">
              {t("prereqs.department")}
            </span>
            <select
              value={state.department}
              onChange={(event) =>
                commit({
                  ...state,
                  department: event.target.value as PrereqState["department"],
                })
              }
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
              {(
                [
                  ["CSE", " Computer Science & Engineering"],
                  ["ECE", " Electronics & Communications"],
                  ["MTR", " Mechatronics & Robotics"],
                  ["IEM", " Industrial & Manufacturing"],
                  ["BME", " Biomedical Engineering"],
                ] as const
              ).map(([id, label]) => (
                <option key={id} value={id}>
                  {id} — {label}
                </option>
              ))}
            </select>
          </label>
          <SearchBar value={query} onChange={setQuery} placeholder={t("prereqs.search")} />
          <button
            type="button"
            onClick={syncFromGpa}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-cyan-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-cyan-700"
          >
            <Sparkles size={14} />
            {t("prereqs.syncGpa")}
          </button>
          <button
            type="button"
            onClick={resetSimulation}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <RotateCcw size={14} />
            {t("prereqs.reset")}
          </button>
        </div>
        {notice && (
          <p role="status" className="mt-3 text-xs font-medium text-cyan-700 dark:text-cyan-300">
            {notice}
          </p>
        )}
      </section>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: t("prereqs.completedCredits"), value: String(summary.completedCredits), tone: "text-emerald-600 dark:text-emerald-300" },
          { label: t("prereqs.unlockedReady"), value: String(summary.unlockedCount), tone: "text-cyan-600 dark:text-cyan-300" },
          { label: t("prereqs.lockedCourses"), value: String(summary.lockedCount), tone: "text-slate-700 dark:text-slate-200" },
          { label: t("prereqs.criticalPath"), value: String(critical.size), tone: "text-amber-600 dark:text-amber-300" },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs text-slate-500 dark:text-slate-400">{kpi.label}</p>
            <p className={`mt-1 text-2xl font-bold ${kpi.tone}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("prereqs.title")}>
            {FILTERS.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={filter === option}
                onClick={() => setFilter(option)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  filter === option
                    ? "bg-slate-900 text-white dark:bg-cyan-300 dark:text-slate-950"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                }`}
              >
                {t(`prereqs.${FILTER_KEY[option]}`)}
              </button>
            ))}
          </div>

          <div className="mt-4 space-y-6">
            {grouped.map((group) => (
              <section key={group.semester}>
                <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
                  <span className="rounded-lg bg-slate-900 px-2 py-1 text-[11px] font-mono text-white dark:bg-cyan-300 dark:text-slate-950">
                    {t("prereqs.semester", { n: semesterNumber(group.semester) })}
                  </span>
                  <span className="text-xs font-normal text-slate-400">{group.nodes.length} courses</span>
                </h2>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {group.nodes.map(renderCourse)}
                </div>
              </section>
            ))}
            {grouped.length === 0 && (
              <p className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                {t("prereqs.noResults")}
              </p>
            )}
          </div>
        </div>

        <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:sticky lg:top-4 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
            <Network size={16} className="text-cyan-600 dark:text-cyan-300" />
            {t("prereqs.impactTitle")}
          </h2>
          {!impact ? (
            <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">{t("prereqs.impactHint")}</p>
          ) : (
            <>
              <p className="mt-3 font-mono text-xs font-bold text-cyan-700 dark:text-cyan-300">
                {normalizeCourseCode(impact.code)}
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">{impact.title}</p>

              {impact.transitiveBlockedCount > 0 ? (
                <div className="mt-3 flex gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs leading-5 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                  <p>
                    {t("prereqs.impactWarning", {
                      code: normalizeCourseCode(impact.code),
                      n: impact.transitiveBlockedCount,
                      s: impact.affectedSemesters.length,
                    })}
                  </p>
                </div>
              ) : (
                <p className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400">
                  {t("prereqs.impactNone")}
                </p>
              )}

              <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
                {[
                  [t("prereqs.directUnlocks"), impact.directUnlocks.length],
                  [t("prereqs.downstreamChain"), impact.transitiveBlockedCount],
                  [t("prereqs.criticalDepth"), impact.criticalDepth],
                  [t("prereqs.semester", { n: semesterNumber(impact.semester) }), impact.credits],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-lg bg-slate-50 p-2 dark:bg-slate-950">
                    <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
                    <dd className="mt-0.5 text-base font-bold text-slate-800 dark:text-slate-100">{value}</dd>
                  </div>
                ))}
              </dl>

              <div className="mt-4">
                <h3 className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  {t("prereqs.upstreamPrerequisites")}
                </h3>
                {renderChipList(upstreamCourses(program.courses, impact.code), t("prereqs.impactNone"))}
              </div>
              <div className="mt-4">
                <h3 className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  {t("prereqs.directUnlocks")}
                </h3>
                {renderChipList(impact.directUnlocks)}
              </div>
              <div className="mt-4">
                <h3 className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  {t("prereqs.downstreamChain")}
                </h3>
                {renderChipList(impact.downstreamChain)}
              </div>
              <div className="mt-4">
                <h3 className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  {t("prereqs.criticalPath")}
                </h3>
                <p className="mt-2 break-words font-mono text-[11px] leading-5 text-slate-500 dark:text-slate-400">
                  {impact.criticalChain.map(normalizeCourseCode).join(" → ")}
                </p>
              </div>
            </>
          )}
        </aside>
      </div>
    </StudyShell>
  );
}
