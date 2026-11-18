"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  AlarmClock, ArrowUpRight, Award, BookOpen, CalendarDays, Coffee,
  GraduationCap, LayoutGrid, Map, Megaphone, MessageCircleQuestion, ShieldCheck, Sparkles, Sun,
  Wallet,
} from "lucide-react";
import { useLanguage, type TranslationKey } from "@/lib/i18n";
import type { HubNoticeCategory, LiveNotice } from "@/lib/hub-feed";
import { DAYS as TT_DAYS, toMinutes, type ClassBlock } from "@/lib/timetable";
import { computeStats, formatGpa, type Course } from "@/lib/gpa";
import { allocateStudy, formatExamDate, type Exam } from "@/lib/exams";
import { SCHOLARSHIPS, daysUntil, formatDeadline } from "@/data/scholarships";
import { DAYS as CAF_DAYS, formatEgp, itemById, type DayName } from "@/data/cafeteria";
import CampusBackground from "@/components/CampusBackground";
import MeritPanel from "@/components/MeritPanel";
import SisSyncGuide, { useSyncedCourses } from "@/components/SisSyncGuide";

const KEYS = {
  timetable: "ejust-timetable-v1", gpa: "ejust-gpa-v1", exams: "ejust-exams-v1",
  cafeteria: "ejust-cafeteria-v1", savedScholarships: "ejust-scholarships-saved-v1",
};

const CATEGORY_LABEL: Record<HubNoticeCategory, TranslationKey> = {
  ACADEMIC: "dashboard.categoryAcademic",
  EXAM: "dashboard.categoryExam",
  SCHEDULE_CHANGE: "dashboard.categoryScheduleChange",
  EVENT: "dashboard.categoryEvent",
};

interface GpaData { courses: Course[]; targetGpa: number; degreeCredits: number }
interface ExamsData { exams: Exam[]; dailyHours: number }
interface CafeteriaData { trays: Partial<Record<DayName, string[]>>; budget: number }
interface Snapshot {
  timetable: ClassBlock[]; gpa: GpaData | null; exams: ExamsData | null;
  cafeteria: CafeteriaData | null; saved: string[];
}

function readJson<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export default function TodayPage() {
  const { locale, t } = useLanguage();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [nowMs, setNowMs] = useState<number | null>(null);
  const [notices, setNotices] = useState<LiveNotice[]>([]);
  const [noticesAvailable, setNoticesAvailable] = useState(true);
  const [noticesLoading, setNoticesLoading] = useState(true);
  const synced = useSyncedCourses();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setNowMs(Date.now());
      setSnapshot({
        timetable: readJson<ClassBlock[]>(KEYS.timetable) ?? [],
        gpa: readJson<GpaData>(KEYS.gpa),
        exams: readJson<ExamsData>(KEYS.exams),
        cafeteria: readJson<CafeteriaData>(KEYS.cafeteria),
        saved: readJson<string[]>(KEYS.savedScholarships) ?? [],
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const faculty = useMemo(
    () => snapshot?.timetable.find((block) => block.faculty)?.faculty ?? "CSIT",
    [snapshot]
  );

  // Active notices are scoped to the viewer's faculty and synced courses by the API.
  useEffect(() => {
    if (!snapshot) return;
    const controller = new AbortController();
    const codes = [...new Set(
      synced.courses.map((course) => course.courseCode.replace(/[^A-Z0-9]/gi, "").toUpperCase())
    )].join(",");
    fetch(`/api/notices?faculty=${encodeURIComponent(faculty)}&codes=${encodeURIComponent(codes)}`, {
      signal: controller.signal,
    })
      .then((response) => response.json())
      .then((payload: { notices?: LiveNotice[]; available?: boolean }) => {
        if (controller.signal.aborted) return;
        setNotices(Array.isArray(payload.notices) ? payload.notices : []);
        setNoticesAvailable(payload.available !== false);
      })
      .catch(() => {
        if (!controller.signal.aborted) setNoticesAvailable(false);
      })
      .finally(() => {
        if (!controller.signal.aborted) setNoticesLoading(false);
      });
    return () => controller.abort();
  }, [snapshot, faculty, synced.courses]);

  const model = useMemo(() => {
    if (nowMs === null || snapshot === null) return null;
    const now = new Date(nowMs);
    const classes = snapshot.timetable
      .filter((item) => item.day === TT_DAYS[now.getDay()])
      .toSorted((a, b) => toMinutes(a.start) - toMinutes(b.start));
    const nextClass = classes.find((item) => toMinutes(item.start) >= now.getHours() * 60 + now.getMinutes()) ?? null;
    const nextExam = allocateStudy(snapshot.exams?.exams ?? [], snapshot.exams?.dailyHours ?? 3, now)[0] ?? null;
    const gpa = snapshot.gpa ? computeStats(snapshot.gpa.courses, snapshot.gpa.targetGpa ?? 3.5) : null;
    const saved = new Set(snapshot.saved);
    const open = SCHOLARSHIPS.map((scholarship) => ({ scholarship, days: daysUntil(scholarship.deadline, now) }))
      .filter((item) => item.days >= 0)
      .sort((a, b) => (saved.has(a.scholarship.id) ? -1 : 0) - (saved.has(b.scholarship.id) ? -1 : 0) || a.days - b.days);
    const cafDay = CAF_DAYS[now.getDay()];
    const tray = snapshot.cafeteria?.trays?.[cafDay] ?? [];
    const trayTotal = tray.reduce((sum, id) => sum + (itemById(id)?.price ?? 0), 0);
    const hour = now.getHours();
    const greetingKey = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
    return {
      greeting: t(`dashboard.${greetingKey}`),
      date: now.toLocaleDateString(locale === "ar" ? "ar-EG" : locale === "ja" ? "ja-JP" : "en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
      classes, nextClass, nextExam, gpa, targetGpa: snapshot.gpa?.targetGpa ?? null,
      scholarship: open[0] ?? null, cafDay, trayCount: tray.length, trayTotal,
      budget: snapshot.cafeteria?.budget ?? null,
    };
  }, [locale, nowMs, snapshot, t]);

  const launches = [
    { href: "/map", key: "map" as const, icon: Map, color: "from-cyan-400 to-blue-500" },
    { href: "/gpa", key: "gpa" as const, icon: GraduationCap, color: "from-violet-400 to-fuchsia-500" },
    { href: "/services/notes", key: "notes" as const, icon: BookOpen, color: "from-amber-300 to-orange-500" },
    { href: "/exams", key: "exams" as const, icon: CalendarDays, color: "from-rose-400 to-red-500" },
    { href: "/cafeteria", key: "cafeteria" as const, icon: Coffee, color: "from-emerald-300 to-teal-500" },
    { href: "/qa", key: "qa" as const, icon: MessageCircleQuestion, color: "from-cyan-300 to-sky-500" },
    { href: "/admin", key: "admin" as const, icon: ShieldCheck, color: "from-slate-300 to-slate-500" },
  ];

  return (
    <main className="campus-life-page relative min-h-[calc(100vh-3rem)] overflow-hidden bg-slate-50/75 text-slate-900 dark:bg-slate-950/75 dark:text-white">
      <CampusBackground image="/images/campus/hero-sunset.jpg.png" />
      <div className="relative mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }} className="relative overflow-hidden rounded-[2rem] border border-white/25 bg-white/10 p-6 shadow-2xl shadow-slate-950/20 backdrop-blur-md sm:p-9">
          <div className="pointer-events-none absolute -right-20 -top-32 h-72 w-72 rounded-full bg-cyan-300/20 blur-3xl" />
          <div className="relative max-w-3xl">
            <div className="flex items-center gap-2 text-sm text-cyan-100"><Sun size={17} className="text-amber-300" /><span>{model?.date ?? "Loading your day…"}</span></div>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight text-white sm:text-6xl">{model?.greeting ?? t("dashboard.title")}</h1>
            <p className="mt-4 max-w-xl text-lg leading-8 text-slate-200">{t("dashboard.welcome")}</p>
            <p className="mt-2 text-sm text-slate-300">{t("dashboard.date")}</p>
          </div>
          <div className="relative mt-8 grid max-w-2xl grid-cols-2 gap-2 sm:grid-cols-4">
            <Metric label={t("dashboard.classes")} value={model ? String(model.classes.length) : "—"} />
            <Metric label={t("dashboard.nextExam")} value={model?.nextExam ? `${model.nextExam.days}d` : "—"} />
            <Metric label={t("dashboard.gpa")} value={synced.courses.length > 0 ? formatGpa(synced.summary.cgpa) : model?.gpa?.currentGpa ? formatGpa(model.gpa.currentGpa) : "—"} />
            <Metric label={t("dashboard.food")} value={model?.budget !== null && model?.budget !== undefined ? formatEgp(model.trayTotal) : "—"} />
          </div>
        </motion.section>

        <SisSyncGuide />

        <MeritPanel className="mt-6" />

        <section className="mt-6" aria-labelledby="hub-notices-title">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <h2 id="hub-notices-title" className="flex items-center gap-2 text-xl font-semibold text-white">
                <Megaphone size={18} className="text-cyan-300" />
                {t("dashboard.notices")}
              </h2>
              <p className="mt-1 text-sm text-slate-300">{t("dashboard.date")}</p>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {notices.map((notice) => (
              <article key={notice.id} className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-md">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold text-white">{notice.title}</h3>
                  <span className="shrink-0 rounded-full border border-cyan-200/40 bg-cyan-300/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-cyan-100">
                    {t(CATEGORY_LABEL[notice.category])}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-300">{notice.body}</p>
                <p className="mt-3 text-[11px] text-cyan-200">
                  {notice.courseCode
                    ? t("dashboard.forFaculty")
                        .replace("{faculty}", notice.targetFaculty || faculty)
                        .replace(
                          "{course}",
                          `${notice.courseCode}${notice.courseName ? ` · ${notice.courseName}` : ""}`
                        )
                    : notice.targetFaculty || faculty}
                </p>
                {notice.expiresAt && (
                  <p className="mt-1 text-[11px] text-slate-400">
                    {t("dashboard.expires").replace(
                      "{date}",
                      new Date(notice.expiresAt).toLocaleDateString(
                        locale === "ar" ? "ar-EG" : locale === "ja" ? "ja-JP" : "en-GB",
                        { day: "numeric", month: "short", year: "numeric" }
                      )
                    )}
                  </p>
                )}
              </article>
            ))}
            {notices.length === 0 && !noticesLoading && (
              <p className="rounded-2xl border border-dashed border-white/20 p-5 text-center text-sm text-slate-300">
                {t("dashboard.noNotices")}
              </p>
            )}
            {!noticesAvailable && (
              <p className="rounded-2xl border border-amber-300/40 bg-amber-300/10 p-5 text-center text-sm text-amber-100">
                {t("dashboard.noticesUnavailable")}
              </p>
            )}
          </div>
        </section>

        <section className="mt-6">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div><h2 className="flex items-center gap-2 text-xl font-semibold text-white"><Sparkles size={18} className="text-cyan-300" />{t("dashboard.launch")}</h2><p className="mt-1 text-sm text-slate-300">{t("dashboard.launchHint")}</p></div>
            <LayoutGrid size={18} className="text-slate-400" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {launches.map(({ href, key, icon: Icon, color }, index) => (
              <motion.div key={key} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.06, duration: 0.35 }}>
                <Link href={href} className="group flex min-h-32 items-end justify-between rounded-2xl border border-white/20 bg-white/10 p-5 backdrop-blur-md transition duration-300 hover:-translate-y-1 hover:border-white/40 hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-cyan-300">
                  <div><span className={`mb-7 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${color} text-slate-950 shadow-lg`}><Icon size={20} /></span><h3 className="font-semibold text-white">{t(`dashboard.${key}`)}</h3><p className="mt-1 text-xs text-slate-300">{t(`dashboard.${key}Desc`)}</p></div>
                  <ArrowUpRight size={19} className="text-slate-400 transition group-hover:-translate-y-1 group-hover:translate-x-1 group-hover:text-white" />
                </Link>
              </motion.div>
            ))}
          </div>
        </section>

        {model && (
          <section className="mt-6 grid gap-3 lg:grid-cols-3">
            <Insight icon={<CalendarDays size={16} />} title={t("dashboard.classes")}>
              {model.classes.length ? <div className="space-y-2">{model.classes.slice(0, 3).map((item) => <div key={item.id} className="flex gap-3 text-sm"><span className="font-mono text-xs text-cyan-200">{item.start}</span><span className="truncate text-slate-200">{item.courseCode} {item.title}</span></div>)}</div> : <Empty href="/timetable" text={t("dashboard.empty")} cta={t("dashboard.plan")} />}
            </Insight>
            <Insight icon={<AlarmClock size={16} />} title={t("dashboard.nextExam")}>
              {model.nextExam ? <><p className="text-lg font-semibold text-white">{model.nextExam.exam.courseCode}</p><p className="mt-1 truncate text-sm text-slate-300">{model.nextExam.exam.title}</p><p className="mt-3 text-xs text-amber-200">{formatExamDate(model.nextExam.exam.date)} · {model.nextExam.perDayMin} min/day</p></> : <Empty href="/exams" text={t("dashboard.empty")} cta={t("dashboard.plan")} />}
            </Insight>
            <Insight icon={<Award size={16} />} title={t("dashboard.scholarship")}>
              {model.scholarship ? <><p className="truncate text-lg font-semibold text-white">{model.scholarship.scholarship.name}</p><p className="mt-1 text-sm text-slate-300">{model.scholarship.scholarship.country} · {formatDeadline(model.scholarship.scholarship.deadline)}</p><p className="mt-3 text-xs text-amber-200">{model.scholarship.days} days left</p></> : <Empty href="/scholarships" text={t("dashboard.empty")} cta={t("dashboard.plan")} />}
            </Insight>
          </section>
        )}
        <p className="mt-5 flex items-center gap-2 text-xs text-slate-300"><Wallet size={14} /> {t("dashboard.saved")}</p>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-white/15 bg-black/10 px-3 py-2.5"><p className="text-[11px] text-slate-300">{label}</p><p className="mt-1 text-xl font-semibold text-white">{value}</p></div>;
}

function Insight({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return <article className="min-h-36 rounded-2xl border border-white/20 bg-slate-950/40 p-5 shadow-xl backdrop-blur-md"><h2 className="flex items-center gap-2 text-sm font-semibold text-slate-100">{icon}<span>{title}</span></h2><div className="mt-4">{children}</div></article>;
}

function Empty({ href, text, cta }: { href: string; text: string; cta: string }) {
  return <div className="text-sm text-slate-400"><p>{text}</p><Link href={href} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-cyan-300 hover:text-white">{cta}<ArrowUpRight size={13} /></Link></div>;
}
