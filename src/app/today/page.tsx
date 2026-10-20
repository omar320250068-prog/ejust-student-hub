"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Map,
  MapPin,
  GraduationCap,
  CalendarDays,
  AlarmClock,
  Award,
  UtensilsCrossed,
  ArrowRight,
  Sun,
  BookOpen,
  Wallet,
  Coffee,
} from "lucide-react";
import { DAYS as TT_DAYS, toMinutes, type ClassBlock } from "@/lib/timetable";
import { computeStats, formatGpa, type Course } from "@/lib/gpa";
import { allocateStudy, formatExamDate, type Exam } from "@/lib/exams";
import { SCHOLARSHIPS, daysUntil, formatDeadline } from "@/data/scholarships";
import { DAYS as CAF_DAYS, formatEgp, itemById, type DayName } from "@/data/cafeteria";

const KEYS = {
  timetable: "ejust-timetable-v1",
  gpa: "ejust-gpa-v1",
  exams: "ejust-exams-v1",
  cafeteria: "ejust-cafeteria-v1",
  savedScholarships: "ejust-scholarships-saved-v1",
};

interface GpaData {
  courses: Course[];
  targetGpa: number;
  degreeCredits: number;
}
interface ExamsData {
  exams: Exam[];
  dailyHours: number;
}
interface CafeteriaData {
  trays: Partial<Record<DayName, string[]>>;
  budget: number;
}

interface Snapshot {
  timetable: ClassBlock[];
  gpa: GpaData | null;
  exams: ExamsData | null;
  cafeteria: CafeteriaData | null;
  saved: string[];
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
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [nowMs, setNowMs] = useState<number | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setNowMs(Date.now());
      setSnap({
        timetable: readJson<ClassBlock[]>(KEYS.timetable) ?? [],
        gpa: readJson<GpaData>(KEYS.gpa),
        exams: readJson<ExamsData>(KEYS.exams),
        cafeteria: readJson<CafeteriaData>(KEYS.cafeteria),
        saved: readJson<string[]>(KEYS.savedScholarships) ?? [],
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const model = useMemo(() => {
    if (nowMs === null || snap === null) return null;
    const now = new Date(nowMs);
    const dayIndex = now.getDay();
    const ttDay = TT_DAYS[dayIndex];
    const cafDay = CAF_DAYS[dayIndex];
    const nowMin = now.getHours() * 60 + now.getMinutes();

    const classes = snap.timetable
      .filter((b) => b.day === ttDay)
      .sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
    const nextClass = classes.find((b) => toMinutes(b.start) >= nowMin) ?? null;
    const minutesToNext = nextClass ? toMinutes(nextClass.start) - nowMin : null;

    const exams = snap.exams?.exams ?? [];
    const dailyHours = snap.exams?.dailyHours ?? 3;
    const plan = allocateStudy(exams, dailyHours, now);
    const nextExam = plan[0] ?? null;

    const gpa = snap.gpa
      ? computeStats(snap.gpa.courses, snap.gpa.targetGpa ?? 3.5)
      : null;

    const savedSet = new Set(snap.saved);
    const openScholarships = SCHOLARSHIPS.map((s) => ({
      s,
      days: daysUntil(s.deadline, now),
    })).filter((x) => x.days >= 0);
    const savedOpen = openScholarships
      .filter((x) => savedSet.has(x.s.id))
      .sort((a, b) => a.days - b.days);
    const allOpen = [...openScholarships].sort((a, b) => a.days - b.days);
    const scholarship = (savedOpen[0] ?? allOpen[0]) ?? null;

    const tray = snap.cafeteria?.trays?.[cafDay] ?? [];
    const trayTotal = tray.reduce((sum, id) => sum + (itemById(id)?.price ?? 0), 0);
    const dayBudget = snap.cafeteria?.budget ?? null;

    return {
      greeting:
        now.getHours() < 12 ? "Good morning" : now.getHours() < 18 ? "Good afternoon" : "Good evening",
      dateLabel: now.toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
      classes,
      nextClass,
      minutesToNext,
      nextExam,
      gpa,
      targetGpa: snap.gpa?.targetGpa ?? null,
      scholarship,
      trayTotal,
      trayCount: tray.length,
      dayBudget,
      cafDay,
    };
  }, [snap, nowMs]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <div className="flex items-center gap-2">
        <Sun size={20} className="text-amber-500" />
        <h1 className="text-xl font-bold text-gray-900">
          {model ? `${model.greeting}` : "Today"}
        </h1>
      </div>
      <p className="mt-1 text-sm text-gray-500">
        {model ? model.dateLabel : "Loading your day…"}
      </p>

      {!model ? (
        <p className="mt-6 text-sm text-gray-400">Loading your saved plans…</p>
      ) : (
        <>
          <section className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <Card
              icon={<CalendarDays size={15} className="text-blue-600" />}
              title="Today's classes"
              href="/timetable"
              linkLabel="Open timetable"
            >
              {model.classes.length === 0 ? (
                <Empty text="No classes saved for today." href="/timetable" cta="Build timetable" />
              ) : (
                <ul className="space-y-1.5">
                  {model.classes.slice(0, 4).map((c) => (
                    <li key={c.id} className="flex items-center gap-2 text-xs">
                      <span
                        className="w-1 shrink-0 self-stretch rounded-full bg-blue-400"
                        style={{ minHeight: 18, backgroundColor: c.color || undefined }}
                      />
                      <span className="w-20 shrink-0 font-mono text-[11px] text-gray-500">
                        {c.start}–{c.end}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-gray-800">
                        {c.courseCode} {c.title}
                      </span>
                    </li>
                  ))}
                  {model.classes.length > 4 && (
                    <li className="text-[11px] text-gray-400">+{model.classes.length - 4} more</li>
                  )}
                </ul>
              )}
              {model.nextClass && model.minutesToNext !== null && (
                <p className="mt-2 flex items-center gap-1 rounded-lg bg-blue-50 px-2 py-1 text-[11px] text-blue-700">
                  <AlarmClock size={12} />
                  Next: {model.nextClass.courseCode} in{" "}
                  {model.minutesToNext < 60
                    ? `${model.minutesToNext} min`
                    : `${Math.floor(model.minutesToNext / 60)}h ${model.minutesToNext % 60}m`}
                </p>
              )}
            </Card>

            <Card
              icon={<AlarmClock size={15} className="text-red-500" />}
              title="Next exam"
              href="/exams"
              linkLabel="Study plan"
            >
              {!model.nextExam ? (
                <Empty text="No upcoming exams tracked." href="/exams" cta="Add an exam" />
              ) : (
                <div>
                  <p className="text-xs text-gray-500">{model.nextExam.exam.courseCode}</p>
                  <p className="truncate text-sm font-semibold text-gray-900">
                    {model.nextExam.exam.title}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    {formatExamDate(model.nextExam.exam.date)}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                        model.nextExam.days <= 3
                          ? "bg-red-600 text-white"
                          : model.nextExam.days <= 7
                            ? "bg-amber-500 text-white"
                            : "bg-blue-50 text-blue-700"
                      }`}
                    >
                      {model.nextExam.days === 0 ? "today" : `${model.nextExam.days} days`}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] text-gray-500">
                      <BookOpen size={11} />
                      {model.nextExam.perDayMin} min/day suggested
                    </span>
                  </div>
                </div>
              )}
            </Card>

            <Card
              icon={<GraduationCap size={15} className="text-violet-600" />}
              title="GPA snapshot"
              href="/gpa"
              linkLabel="Degree tracker"
            >
              {!model.gpa || model.gpa.currentGpa === null ? (
                <Empty text="No graded courses yet." href="/gpa" cta="Set up GPA" />
              ) : (
                <div className="flex items-end justify-between gap-2">
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{formatGpa(model.gpa.currentGpa)}</p>
                    <p className="text-[11px] text-gray-500">
                      {model.gpa.completedCredits} credits · target {formatGpa(model.targetGpa)}
                    </p>
                  </div>
                  {model.gpa.remainingCredits > 0 && model.gpa.requiredAverage !== null && (
                    <p className="text-right text-[11px] text-gray-500">
                      need{" "}
                      <span
                        className={`font-semibold ${
                          model.gpa.achievable ? "text-emerald-600" : "text-red-600"
                        }`}
                      >
                        {formatGpa(model.gpa.requiredAverage)}
                      </span>
                      <br />
                      avg in {model.gpa.remainingCredits} left
                    </p>
                  )}
                </div>
              )}
            </Card>

            <Card
              icon={<Award size={15} className="text-amber-600" />}
              title="Scholarship deadline"
              href="/scholarships"
              linkLabel="All scholarships"
            >
              {!model.scholarship ? (
                <Empty text="No open deadlines." href="/scholarships" cta="Browse" />
              ) : (
                <div>
                  <p className="truncate text-sm font-semibold text-gray-900">
                    {model.scholarship.s.name}
                  </p>
                  <p className="text-[11px] text-gray-500">
                    {model.scholarship.s.country} · {formatDeadline(model.scholarship.s.deadline)}
                  </p>
                  <span
                    className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${
                      model.scholarship.days <= 30
                        ? "bg-amber-100 text-amber-800"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {model.scholarship.days} days left
                  </span>
                </div>
              )}
            </Card>

            <Card
              icon={<UtensilsCrossed size={15} className="text-emerald-600" />}
              title="Food today"
              href="/cafeteria"
              linkLabel="Meal planner"
            >
              {model.dayBudget === null ? (
                <Empty text="No tray or budget yet." href="/cafeteria" cta="Plan meals" />
              ) : model.trayCount === 0 ? (
                <Empty text={`Nothing planned for ${model.cafDay}.`} href="/cafeteria" cta="Plan today's tray" />
              ) : (
                <div>
                  <p className="text-2xl font-bold text-gray-900">{formatEgp(model.trayTotal)}</p>
                  <p className="text-[11px] text-gray-500">
                    {model.trayCount} item{model.trayCount > 1 ? "s" : ""} ·{" "}
                    {model.trayTotal > model.dayBudget
                      ? `${formatEgp(model.trayTotal - model.dayBudget)} over budget`
                      : `${formatEgp(model.dayBudget - model.trayTotal)} left of ${formatEgp(model.dayBudget)}`}
                  </p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className={`h-full rounded-full ${
                        model.trayTotal > model.dayBudget ? "bg-red-500" : "bg-emerald-500"
                      }`}
                      style={{
                        width: `${Math.min(100, (model.trayTotal / model.dayBudget) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </Card>

            <Card
              icon={<Wallet size={15} className="text-gray-600" />}
              title="Campus quick access"
              href="/"
              linkLabel="Master plan"
            >
              <div className="grid grid-cols-2 gap-1.5">
                <QuickLink href="/" icon={<Map size={13} />} label="Master Plan" />
                <QuickLink href="/map" icon={<MapPin size={13} />} label="GPS Map" />
                <QuickLink href="/timetable" icon={<CalendarDays size={13} />} label="Timetable" />
                <QuickLink href="/exams" icon={<AlarmClock size={13} />} label="Exams" />
                <QuickLink href="/scholarships" icon={<Award size={13} />} label="Scholarships" />
                <QuickLink href="/cafeteria" icon={<Coffee size={13} />} label="Cafeteria" />
              </div>
            </Card>
          </section>

          <p className="mt-4 flex items-center gap-1 text-[11px] text-gray-400">
            Everything here reads from the plans you saved — nothing leaves this device.
          </p>
        </>
      )}
    </main>
  );
}

function Card({
  icon,
  title,
  href,
  linkLabel,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  href: string;
  linkLabel: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center gap-1.5">
        {icon}
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
      </div>
      <div className="mt-2 flex-1">{children}</div>
      <Link
        href={href}
        className="mt-3 flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-700"
      >
        {linkLabel}
        <ArrowRight size={11} />
      </Link>
    </section>
  );
}

function Empty({ text, href, cta }: { text: string; href: string; cta: string }) {
  return (
    <div className="text-xs text-gray-400">
      <p>{text}</p>
      <Link href={href} className="mt-1 inline-block text-[11px] font-medium text-blue-600">
        {cta} →
      </Link>
    </div>
  );
}

function QuickLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-1.5 rounded-lg border border-gray-100 px-2 py-1.5 text-[11px] font-medium text-gray-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
    >
      {icon}
      {label}
    </Link>
  );
}
