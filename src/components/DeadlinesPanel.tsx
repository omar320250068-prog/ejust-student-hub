"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Check, Clock3, Plus, Trash2 } from "lucide-react";
import { useLanguage, type TranslationKey } from "@/lib/i18n";
import {
  DEADLINE_TYPES,
  deadlineHoursLeft,
  isUrgentDeadline,
  readDeadlines,
  sortDeadlines,
  writeDeadlines,
  type Deadline,
  type DeadlineType,
} from "@/lib/student-data";
import type { StorageUser } from "@/lib/user-scoped-storage";

const TYPE_LABEL: Record<DeadlineType, TranslationKey> = {
  assignment: "deadlines.typeAssignment",
  quiz: "deadlines.typeQuiz",
  lab: "deadlines.typeLab",
  project: "deadlines.typeProject",
};

const CUSTOM_COURSE = "__custom";

export interface DeadlinesPanelProps {
  user: StorageUser | null;
  courseCodes: string[];
}

/** Inline tracker for assignments, quizzes, labs and projects on /today. */
export default function DeadlinesPanel({ user, courseCodes }: DeadlinesPanelProps) {
  const { locale, t } = useLanguage();
  const userScope = user?.id ?? user?.email ?? null;
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [now, setNow] = useState<Date | null>(null);
  const [title, setTitle] = useState("");
  const [courseCode, setCourseCode] = useState(CUSTOM_COURSE);
  const [customCode, setCustomCode] = useState("");
  const [type, setType] = useState<DeadlineType>("assignment");
  const [dueAt, setDueAt] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        setDeadlines(readDeadlines(window.localStorage, user));
      } catch {
        setDeadlines([]);
      }
      setNow(new Date());
    }, 0);
    return () => window.clearTimeout(timer);
  }, [user, userScope]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const open = useMemo(
    () => sortDeadlines(deadlines.filter((deadline) => !deadline.completed)),
    [deadlines],
  );
  const completed = useMemo(
    () => sortDeadlines(deadlines.filter((deadline) => deadline.completed)),
    [deadlines],
  );

  function persist(next: Deadline[]) {
    setDeadlines(next);
    try {
      writeDeadlines(window.localStorage, user, next);
    } catch {
      // Keep the in-memory list usable if storage is unavailable.
    }
  }

  function addDeadline(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = (courseCode === CUSTOM_COURSE ? customCode : courseCode).trim().toUpperCase();
    const parsedDueAt = new Date(dueAt);
    if (!title.trim() || !code || !dueAt || Number.isNaN(parsedDueAt.getTime())) return;

    const deadline: Deadline = {
      id: globalThis.crypto?.randomUUID?.() ?? `deadline-${Date.now()}`,
      title: title.trim(),
      courseCode: code,
      type,
      dueAt: parsedDueAt.toISOString(),
      completed: false,
    };
    persist([...deadlines, deadline]);
    setTitle("");
    setCourseCode("");
    setCustomCode("");
    setType("assignment");
    setDueAt("");
  }

  function toggle(deadline: Deadline) {
    persist(
      deadlines.map((item) =>
        item.id === deadline.id ? { ...item, completed: !item.completed } : item,
      ),
    );
  }

  function remove(deadline: Deadline) {
    persist(deadlines.filter((item) => item.id !== deadline.id));
  }

  function countdown(deadline: Deadline): string {
    if (!now) return "";
    const hours = deadlineHoursLeft(deadline, now);
    if (hours < 0) return t("deadlines.overdue");
    if (hours < 24) return t("deadlines.hoursLeft", { n: Math.max(1, Math.ceil(hours)) });
    return t("deadlines.daysLeft", { n: Math.floor(hours / 24) });
  }

  function formatDue(deadline: Deadline): string {
    return new Date(deadline.dueAt).toLocaleString(
      locale === "ar" ? "ar-EG" : locale === "ja" ? "ja-JP" : "en-GB",
      { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" },
    );
  }

  return (
    <section
      id="deadlines"
      aria-labelledby="deadlines-title"
      className="rounded-[1.5rem] border border-white/20 bg-white/10 p-5 backdrop-blur-md sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="deadlines-title" className="flex items-center gap-2 text-xl font-semibold text-white">
            <Clock3 size={19} className="text-amber-300" />
            {t("deadlines.title")}
          </h2>
          <p className="mt-1 text-sm text-slate-300">{t("deadlines.subtitle")}</p>
        </div>
        <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] text-slate-200">
          {t("deadlines.saved")}
        </span>
      </div>

      <form onSubmit={addDeadline} className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-300">
          {t("deadlines.titleField")}
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="rounded-xl border border-white/15 bg-slate-950/40 px-3 py-2 text-sm font-normal text-white outline-none focus:border-cyan-300"
          />
        </label>
        <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-300">
          {t("deadlines.course")}
          <select
            value={courseCode}
            onChange={(event) => setCourseCode(event.target.value)}
            className="rounded-xl border border-white/15 bg-slate-950 px-3 py-2 text-sm font-normal text-white outline-none focus:border-cyan-300"
          >
            <option value="">{t("deadlines.chooseCourse")}</option>
            <option value={CUSTOM_COURSE}>{t("deadlines.customCode")}</option>
            {courseCodes.map((code) => <option key={code} value={code}>{code}</option>)}
          </select>
        </label>
        {courseCode === CUSTOM_COURSE && (
          <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-300">
            {t("deadlines.customCode")}
            <input
              value={customCode}
              onChange={(event) => setCustomCode(event.target.value)}
              placeholder="CSC 111"
              className="rounded-xl border border-white/15 bg-slate-950/40 px-3 py-2 text-sm font-normal text-white outline-none focus:border-cyan-300"
            />
          </label>
        )}
        <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-300">
          {t("deadlines.type")}
          <select
            value={type}
            onChange={(event) => setType(event.target.value as DeadlineType)}
            className="rounded-xl border border-white/15 bg-slate-950 px-3 py-2 text-sm font-normal text-white outline-none focus:border-cyan-300"
          >
            {DEADLINE_TYPES.map((option) => (
              <option key={option} value={option}>{t(TYPE_LABEL[option])}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-300">
          {t("deadlines.dueAt")}
          <input
            type="datetime-local"
            value={dueAt}
            onChange={(event) => setDueAt(event.target.value)}
            className="rounded-xl border border-white/15 bg-slate-950/40 px-3 py-2 text-sm font-normal text-white outline-none focus:border-cyan-300"
          />
        </label>
        <button
          type="submit"
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 sm:col-span-2 lg:col-span-1"
        >
          <Plus size={15} />
          {t("deadlines.add")}
        </button>
      </form>

      <div className="mt-6 space-y-2">
        {open.length === 0 ? (
          <p className="rounded-xl border border-dashed border-white/20 p-5 text-center text-sm text-slate-300">
            {t("deadlines.empty")}
          </p>
        ) : (
          open.map((deadline) => {
            const urgent = now ? isUrgentDeadline(deadline, now) : false;
            return (
              <article
                key={deadline.id}
                className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 ${
                  urgent
                    ? "border-amber-300/50 bg-amber-300/10"
                    : "border-white/15 bg-slate-950/30"
                }`}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-semibold text-white">{deadline.title}</span>
                    <span className="rounded-full border border-cyan-200/30 bg-cyan-300/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-cyan-100">
                      {deadline.courseCode} · {t(TYPE_LABEL[deadline.type])}
                    </span>
                    {urgent && (
                      <span className="rounded-full bg-amber-300 px-2 py-0.5 text-[10px] font-bold text-amber-950">
                        {t("deadlines.urgent")}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-slate-300">
                    {formatDue(deadline)} · {countdown(deadline)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggle(deadline)}
                    aria-label={t("deadlines.markComplete")}
                    title={t("deadlines.markComplete")}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-300/40 text-emerald-200 transition hover:bg-emerald-300/15"
                  >
                    <Check size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(deadline)}
                    aria-label={t("deadlines.delete")}
                    title={t("deadlines.delete")}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-300/40 text-rose-200 transition hover:bg-rose-300/15"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </article>
            );
          })
        )}
      </div>

      {completed.length > 0 && (
        <details className="mt-4 rounded-xl border border-white/15 bg-slate-950/20 p-3">
          <summary className="cursor-pointer text-sm font-semibold text-slate-200">
            {t("deadlines.completed")} · {completed.length}
          </summary>
          <div className="mt-3 space-y-2">
            {completed.map((deadline) => (
              <div
                key={deadline.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2"
              >
                <span className="truncate text-xs text-slate-300">
                  {deadline.courseCode} · {deadline.title}
                </span>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggle(deadline)}
                    aria-label={t("deadlines.markComplete")}
                    className="text-[11px] font-semibold text-cyan-200 hover:text-white"
                  >
                    {t("deadlines.markComplete")}
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(deadline)}
                    aria-label={t("deadlines.delete")}
                    className="text-rose-200 hover:text-rose-100"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}
