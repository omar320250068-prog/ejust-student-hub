"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { AlertTriangle, Download, Plus, Trash2, X } from "lucide-react";
import {
  DAYS,
  type ClassBlock,
  type Day,
  downloadIcs,
  findConflicts,
  isValidTimeRange,
  toMinutes,
} from "@/lib/timetable";
import { useLanguage } from "@/lib/i18n";
import PrintButton from "@/components/PrintButton";

type Faculty = "CSIT" | "Engineering" | "Business";
type AcademicYear = 1 | 2 | 3 | 4;
type Group = "Group 1" | "Group 2";

interface Profile {
  faculty: Faculty;
  year: AcademicYear;
  group: Group;
}

interface SavedTimetable {
  version: 1;
  schedules: Record<string, ClassBlock[]>;
}

const STORAGE_KEY = "student_custom_timetable";
const LEGACY_KEYS = ["ejust:timetable", "ejust-timetable-v1"];
const GRID_START = 9 * 60;
const GRID_END = 16 * 60;
const HOUR_PX = 68;
const FACULTIES: Faculty[] = ["CSIT", "Engineering", "Business"];
const YEARS: AcademicYear[] = [1, 2, 3, 4];
const GROUPS: Group[] = ["Group 1", "Group 2"];
const WEEKDAYS = DAYS.slice(0, 5);
const COLORS = ["#2563eb", "#059669", "#d97706", "#7c3aed", "#0891b2"];

const DEFAULT_PROFILE: Profile = { faculty: "CSIT", year: 1, group: "Group 1" };

const DEFAULT_CSIT_FALL_2026: ClassBlock[] = [
  { id: "csit-111", courseCode: "CSC 111", title: "Introduction to Computing", day: "Sun", start: "09:00", end: "10:30", location: "Lecture Hall A1", instructor: "Dr. Hassan", color: COLORS[0], type: "Lecture", faculty: "CSIT", year: 1, group: "Group 1" },
  { id: "math-111", courseCode: "MTH 111", title: "Calculus I", day: "Sun", start: "11:00", end: "12:30", location: "Lecture Hall B2", instructor: "Dr. Salma", color: COLORS[1], type: "Lecture", faculty: "CSIT", year: 1, group: "Group 1" },
  { id: "ece-111", courseCode: "ECE 111", title: "Digital Logic", day: "Mon", start: "09:00", end: "10:30", location: "Building 8 · Lab 2", instructor: "Dr. Omar", color: COLORS[2], type: "Lab", faculty: "CSIT", year: 1, group: "Group 1" },
  { id: "phy-113", courseCode: "PHY 113", title: "Physics for Engineers", day: "Mon", start: "11:00", end: "12:30", location: "Science Hall 1", instructor: "Dr. Yuki", color: COLORS[3], type: "Lecture", faculty: "CSIT", year: 1, group: "Group 1" },
  { id: "lra-401", courseCode: "LRA 401", title: "Language & Report Writing", day: "Tue", start: "09:30", end: "11:00", location: "Humanities H2", instructor: "Ms. Aya", color: COLORS[4], type: "Tutorial", faculty: "CSIT", year: 1, group: "Group 1" },
  { id: "csit-112", courseCode: "CSC 112", title: "Programming Fundamentals", day: "Wed", start: "09:00", end: "10:30", location: "Computer Lab 1", instructor: "Dr. Hassan", color: COLORS[0], type: "Lab", faculty: "CSIT", year: 1, group: "Group 1" },
  { id: "mth-112", courseCode: "MTH 112", title: "Linear Algebra", day: "Wed", start: "11:00", end: "12:30", location: "Lecture Hall B2", instructor: "Dr. Salma", color: COLORS[1], type: "Lecture", faculty: "CSIT", year: 1, group: "Group 1" },
  { id: "phy-114", courseCode: "PHY 114", title: "Physics Laboratory", day: "Thu", start: "13:00", end: "15:00", location: "Physics Lab 3", instructor: "Dr. Yuki", color: COLORS[3], type: "Lab", faculty: "CSIT", year: 1, group: "Group 1" },
];

const EMPTY_FORM = {
  title: "",
  courseCode: "",
  day: "Sun" as Day,
  start: "09:00",
  end: "10:00",
  location: "",
  instructor: "",
};

function profileKey(profile: Profile) {
  return `${profile.faculty}-${profile.year}-${profile.group.replace(" ", "")}`;
}

function defaultScheduleFor(profile: Profile): ClassBlock[] {
  if (profile.faculty === "CSIT" && profile.year === 1) {
    return DEFAULT_CSIT_FALL_2026.map((course) => ({ ...course, group: profile.group }));
  }
  return [];
}

function facultyKey(faculty: Faculty) {
  return `timetable.${faculty === "CSIT" ? "csit" : faculty === "Engineering" ? "engineering" : "business"}` as const;
}

export default function TimetablePage() {
  const { t } = useLanguage();
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const [blocks, setBlocks] = useState<ClassBlock[]>(DEFAULT_CSIT_FALL_2026);
  // Persisted snapshots live in a ref: they mirror localStorage, never drive renders.
  const savedRef = useRef<SavedTimetable>({ version: 1, schedules: {} });
  const [ready, setReady] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const legacy = LEGACY_KEYS.map((key) => localStorage.getItem(key)).find(Boolean);
        if (raw) {
          const parsed = JSON.parse(raw) as SavedTimetable;
          if (parsed?.version === 1 && parsed.schedules) {
            savedRef.current = parsed;
            setBlocks(parsed.schedules[profileKey(DEFAULT_PROFILE)] ?? defaultScheduleFor(DEFAULT_PROFILE));
          }
        } else if (legacy) {
          const legacyBlocks = JSON.parse(legacy) as ClassBlock[];
          if (Array.isArray(legacyBlocks)) {
            const migrated = { version: 1 as const, schedules: { [profileKey(DEFAULT_PROFILE)]: legacyBlocks } };
            savedRef.current = migrated;
            setBlocks(legacyBlocks);
          }
        }
      } catch {
        setBlocks(defaultScheduleFor(DEFAULT_PROFILE));
      } finally {
        setReady(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const next = {
      ...savedRef.current,
      schedules: { ...savedRef.current.schedules, [profileKey(profile)]: blocks },
    };
    savedRef.current = next;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    localStorage.setItem("ejust:timetable", JSON.stringify(blocks));
    localStorage.setItem("ejust-timetable-v1", JSON.stringify(blocks));
  }, [blocks, profile, ready]);

  const conflicts = useMemo(() => findConflicts(blocks), [blocks]);
  const conflictIds = useMemo(() => new Set(conflicts.flatMap((conflict) => [conflict.a.id, conflict.b.id])), [conflicts]);
  const customCount = blocks.filter((block) => block.type === "Custom").length;
  const gridHeight = ((GRID_END - GRID_START) / 60) * HOUR_PX;

  function changeProfile<K extends keyof Profile>(key: K, value: Profile[K]) {
    const nextProfile = { ...profile, [key]: value } as Profile;
    setProfile(nextProfile);
    setBlocks(savedRef.current.schedules[profileKey(nextProfile)] ?? defaultScheduleFor(nextProfile));
  }

  function removeBlock(id: string) {
    const block = blocks.find((item) => item.id === id);
    if (block && window.confirm(t("timetable.confirmRemove"))) {
      setBlocks((current) => current.filter((item) => item.id !== id));
    }
  }

  function resetSchedule() {
    if (!window.confirm(t("timetable.resetConfirm"))) return;
    setBlocks(defaultScheduleFor(profile));
  }

  function addCustomCourse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.title.trim() || !form.courseCode.trim()) {
      setError(t("timetable.required"));
      return;
    }
    if (!isValidTimeRange(form.start, form.end) || toMinutes(form.start) < GRID_START || toMinutes(form.end) > GRID_END) {
      setError(t("timetable.invalidTime"));
      return;
    }
    setBlocks((current) => [...current, {
      id: `custom-${Date.now()}`,
      title: form.title.trim(),
      courseCode: form.courseCode.trim().toUpperCase(),
      day: form.day,
      start: form.start,
      end: form.end,
      location: form.location.trim() || "TBA",
      instructor: form.instructor.trim() || "TBA",
      color: COLORS[current.length % COLORS.length],
      type: "Custom",
      faculty: profile.faculty,
      year: profile.year,
      group: profile.group,
    }]);
    setForm(EMPTY_FORM);
    setError("");
    setModalOpen(false);
  }

  return (
    <main className="min-h-[calc(100vh-3rem)] bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-600 dark:text-cyan-300">{t("timetable.fall")}</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{t("timetable.title")}</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-400">{t("timetable.subtitle")}</p>
          </div>
          <div className="flex flex-wrap gap-2 print:hidden">
            <PrintButton />
            <button type="button" onClick={() => downloadIcs(blocks)} disabled={!blocks.length} className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"><Download size={15} />{t("timetable.export")}</button>
            <button type="button" onClick={() => setModalOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-cyan-100"><Plus size={15} />{t("timetable.addCourse")}</button>
          </div>
        </header>

        <section className="mt-6 grid gap-3 rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/70 sm:grid-cols-3">
          <Filter label={t("timetable.faculty")} value={profile.faculty} onChange={(value) => changeProfile("faculty", value as Faculty)}>
            {FACULTIES.map((faculty) => <option key={faculty} value={faculty}>{t(facultyKey(faculty))}</option>)}
          </Filter>
          <Filter label={t("timetable.academicYear")} value={profile.year} onChange={(value) => changeProfile("year", Number(value) as AcademicYear)}>
            {YEARS.map((year) => <option key={year} value={year}>{t(`timetable.${["", "firstYear", "secondYear", "thirdYear", "fourthYear"][year]}` as never)}</option>)}
          </Filter>
          <Filter label={t("timetable.group")} value={profile.group} onChange={(value) => changeProfile("group", value as Group)}>
            {GROUPS.map((group) => <option key={group} value={group}>{t(`timetable.${group === "Group 1" ? "group1" : "group2"}` as never)}</option>)}
          </Filter>
        </section>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
          <span>{t(facultyKey(profile.faculty))} · {t(`timetable.${["", "firstYear", "secondYear", "thirdYear", "fourthYear"][profile.year]}` as never)} · {profile.group}</span>
          <div className="flex items-center gap-3">
            <span>{customCount} {t("timetable.customCourses")}</span>
            <button type="button" onClick={resetSchedule} className="font-semibold text-rose-600 hover:text-rose-700 dark:text-rose-300">{t("timetable.reset")}</button>
          </div>
        </div>

        {conflicts.length > 0 && <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-400/30 dark:bg-amber-950/30 dark:text-amber-200"><AlertTriangle size={17} className="mt-0.5 shrink-0" /><span>{conflicts.length} {t("timetable.conflicts")}</span></div>}

        <section className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white/90 p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
          <div className="flex min-w-[820px]">
            <div className="w-14 shrink-0 pt-9">{Array.from({ length: 7 }, (_, index) => <div key={index} className="relative text-right text-[10px] text-slate-400" style={{ height: HOUR_PX }}><span className="absolute -top-2 right-2">{String(9 + index).padStart(2, "0")}:00</span></div>)}</div>
            {WEEKDAYS.map((day) => {
              const dayBlocks = blocks.filter((block) => block.day === day);
              return <div key={day} className="min-w-0 flex-1 border-l border-slate-200 dark:border-slate-800">
                <div className="h-9 text-center text-xs font-bold text-slate-700 dark:text-slate-200">{day}</div>
                <div className="relative" style={{ height: gridHeight }}>
                  {Array.from({ length: 8 }, (_, index) => <div key={index} className="absolute inset-x-0 border-t border-dashed border-slate-200 dark:border-slate-800" style={{ top: index * HOUR_PX }} />)}
                  {dayBlocks.map((block) => {
                    const top = ((toMinutes(block.start) - GRID_START) / 60) * HOUR_PX;
                    const height = Math.max(34, ((toMinutes(block.end) - toMinutes(block.start)) / 60) * HOUR_PX - 4);
                    return <article key={block.id} className="group absolute left-1 right-1 overflow-hidden rounded-xl p-2 text-white shadow-sm" style={{ top, height, background: block.color, outline: conflictIds.has(block.id) ? "2px solid #f59e0b" : undefined }} title={`${block.courseCode} ${block.title}`}>
                      <span className="rounded-full bg-black/20 px-1.5 py-0.5 text-[9px] font-semibold">{t(`timetable.${(block.type ?? "Custom").toLowerCase()}` as never)}</span>
                      <p className="mt-1 truncate text-[11px] font-bold">{block.courseCode}</p>
                      <p className="truncate text-[10px] opacity-90">{block.start}–{block.end}</p>
                      <button type="button" onClick={() => removeBlock(block.id)} className="absolute right-1 top-1 hidden rounded-md bg-black/25 p-1 group-hover:block" aria-label={`${t("timetable.remove")} ${block.courseCode}`}><Trash2 size={12} /></button>
                    </article>;
                  })}
                  {dayBlocks.length === 0 && <p className="absolute inset-x-0 top-5 text-center text-[10px] text-slate-400">{t("timetable.empty")}</p>}
                </div>
              </div>;
            })}
          </div>
        </section>

        <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
          {(["Lecture", "Lab", "Tutorial", "Custom"] as const).map((type, index) => <span key={type} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1.5 dark:border-slate-800 dark:bg-slate-900"><i className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[index] }} />{t(`timetable.${type.toLowerCase()}` as never)}</span>)}
        </div>
      </div>

      {modalOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="custom-course-title">
        <form onSubmit={addCustomCourse} className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-600 dark:text-cyan-300">{t("timetable.custom")}</p><h2 id="custom-course-title" className="mt-1 text-xl font-semibold">{t("timetable.addCourse")}</h2></div><button type="button" onClick={() => setModalOpen(false)} aria-label={t("timetable.cancel")} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><X size={18} /></button></div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Field label={t("timetable.courseName")} value={form.title} onChange={(value) => setForm({ ...form, title: value })} placeholder="Human Computer Interaction" />
            <Field label={t("timetable.code")} value={form.courseCode} onChange={(value) => setForm({ ...form, courseCode: value })} placeholder="CSC 301" />
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-400"><span>{t("timetable.day")}</span><select value={form.day} onChange={(event) => setForm({ ...form, day: event.target.value as Day })} className={inputClass}>{WEEKDAYS.map((day) => <option key={day}>{day}</option>)}</select></label>
            <Field label={t("timetable.location")} value={form.location} onChange={(value) => setForm({ ...form, location: value })} placeholder="Building 5 · Room 204" />
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-400"><span>{t("timetable.start")}</span><input type="time" min="09:00" max="16:00" value={form.start} onChange={(event) => setForm({ ...form, start: event.target.value })} className={inputClass} /></label>
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-400"><span>{t("timetable.end")}</span><input type="time" min="09:00" max="16:00" value={form.end} onChange={(event) => setForm({ ...form, end: event.target.value })} className={inputClass} /></label>
            <div className="sm:col-span-2"><Field label={t("timetable.instructor")} value={form.instructor} onChange={(value) => setForm({ ...form, instructor: value })} placeholder="Dr. Aiko Tanaka" /></div>
          </div>
          {error && <p className="mt-3 text-sm font-medium text-rose-600 dark:text-rose-300">{error}</p>}
          <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setModalOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300">{t("timetable.cancel")}</button><button type="submit" className="rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700">{t("timetable.add")}</button></div>
        </form>
      </div>}
    </main>
  );
}

const inputClass = "rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-cyan-950";

function Filter({ label, value, onChange, children }: { label: string; value: string | number; onChange: (value: string) => void; children: React.ReactNode }) {
  return <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600 dark:text-slate-400"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className={inputClass}>{children}</select></label>;
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-400"><span>{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className={inputClass} /></label>;
}
