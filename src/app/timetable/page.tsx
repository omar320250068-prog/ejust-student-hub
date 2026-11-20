"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useSession } from "next-auth/react";
import { AlertTriangle, Download, Plus, Trash2, X } from "lucide-react";
import {
  type ClassBlock,
  type Day,
  downloadIcs,
  findConflicts,
  isValidTimeRange,
  toMinutes,
} from "@/lib/timetable";
import { useLanguage, type TranslationKey } from "@/lib/i18n";
import PrintButton from "@/components/PrintButton";
import RoomBadge from "@/components/RoomBadge";
import SisSyncGuide, { useSyncedCourses } from "@/components/SisSyncGuide";
import {
  ACADEMIC_PROFILE_EVENT,
  readAcademicProfile,
  toTimetableFaculty,
  toTimetableGroup,
  toTimetableTrack,
} from "@/lib/onboarding";
import {
  readTimetableSnapshot,
  writeTimetableSnapshot,
  type TimetableSnapshot,
} from "@/lib/student-data";

type Faculty = "CSIT" | "Engineering" | "Business" | "FOP" | "BAS" | "FAD";
type AcademicYear = 1 | 2 | 3 | 4 | 5;
type Group = "Group 1" | "Group 2" | "Group 3" | "Group 4";
type Track = "CNC" | "AID" | "CSC" | "BIF";
type MeetingType = "LECTURE" | "LAB" | "SECTION" | "TUTORIAL";

interface Profile {
  faculty: Faculty;
  year: AcademicYear;
  group: Group;
  track: Track;
  section: string;
}

interface ApiMeeting {
  meetingId: string;
  courseCode: string;
  courseName: string;
  courseNameAr: string | null;
  day: "SATURDAY" | "SUNDAY" | "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY";
  startTime: string;
  endTime: string;
  building: string | null;
  room: string | null;
  group: string | null;
  meetingType: MeetingType;
  instructor: string | null;
  academicYear: string;
  semester: string;
}

interface OfficialState {
  key: string;
  meetings: ApiMeeting[];
  loading: boolean;
  error: boolean;
}

const GRID_START = 9 * 60;
const GRID_END = 16 * 60;
const HOUR_PX = 68;
const FACULTIES: Faculty[] = ["CSIT", "Engineering", "Business", "FOP", "BAS", "FAD"];
const YEARS: AcademicYear[] = [1, 2, 3, 4, 5];
const TRACKS: Track[] = ["CNC", "AID", "CSC", "BIF"];
const SCHEDULE_DAYS: Day[] = ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu"];
const COLORS = ["#2563eb", "#059669", "#d97706", "#7c3aed", "#0891b2"];

const DEFAULT_PROFILE: Profile = {
  faculty: "CSIT",
  year: 1,
  group: "Group 1",
  track: "CSC",
  section: "1",
};

const EMPTY_FORM = {
  title: "",
  courseCode: "",
  day: "Sat" as Day,
  start: "09:00",
  end: "10:00",
  location: "",
  instructor: "",
};

const YEAR_LABEL: Record<AcademicYear, TranslationKey> = {
  1: "timetable.firstYear",
  2: "timetable.secondYear",
  3: "timetable.thirdYear",
  4: "timetable.fourthYear",
  5: "timetable.fifthYear",
};

const GROUP_LABEL: Record<Group, TranslationKey> = {
  "Group 1": "timetable.group1",
  "Group 2": "timetable.group2",
  "Group 3": "timetable.group3",
  "Group 4": "timetable.group4",
};

const DAY_FROM_DB: Record<ApiMeeting["day"], Day> = {
  SATURDAY: "Sat",
  SUNDAY: "Sun",
  MONDAY: "Mon",
  TUESDAY: "Tue",
  WEDNESDAY: "Wed",
  THURSDAY: "Thu",
};

const TYPE_FROM_DB: Record<MeetingType, NonNullable<ClassBlock["type"]>> = {
  LECTURE: "Lecture",
  LAB: "Lab",
  SECTION: "Tutorial",
  TUTORIAL: "Tutorial",
};

function sectionOptions(profile: Profile): string[] {
  const groupNumber = Number(profile.group.replace(/\D/g, ""));
  if (profile.year === 1) return groupNumber === 1 ? ["1", "2", "3"] : ["4", "5"];
  if (profile.year === 2) {
    return Array.from({ length: 3 }, (_, index) => String((groupNumber - 1) * 3 + index + 1));
  }
  const count = profile.track === "AID" ? 4 : profile.track === "CNC" ? 3 : 1;
  return Array.from({ length: count }, (_, index) => String(index + 1));
}

function columnKeyFor(profile: Profile): string {
  const section = profile.section || sectionOptions(profile)[0];
  if (profile.year <= 2) return `Y${profile.year}G${Number(profile.group.replace(/\D/g, ""))}S${section}`;
  return `Y${profile.year}${profile.track}S${section}`;
}

function profileKey(profile: Profile): string {
  return [
    profile.faculty,
    profile.year,
    profile.group.replace(" ", ""),
    profile.track,
    profile.section,
  ].join("-");
}

function legacyProfileKey(profile: Profile): string {
  return `${profile.faculty}-${profile.year}-${profile.group.replace(" ", "")}`;
}

function facultyKey(faculty: Faculty): TranslationKey {
  switch (faculty) {
    case "CSIT":
      return "timetable.csit";
    case "Engineering":
      return "timetable.engineering";
    case "Business":
      return "timetable.business";
    case "FOP":
      return "onboarding.fop";
    case "BAS":
      return "onboarding.bas";
    case "FAD":
      return "onboarding.fad";
  }
}

function normalizeCode(code: string): string {
  return code.replace(/[^A-Z0-9]/gi, "").toUpperCase();
}

function colorFor(code: string): string {
  let hash = 0;
  for (const char of code) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return COLORS[Math.abs(hash) % COLORS.length];
}

function meetingToBlock(meeting: ApiMeeting, profile: Profile, locale: string): ClassBlock {
  const location = [meeting.building, meeting.room].filter(Boolean).join(" · ") || "TBA";
  const title = locale === "ar" && meeting.courseNameAr
    ? meeting.courseNameAr
    : meeting.courseName || meeting.courseCode;

  return {
    id: `db-${meeting.meetingId}`,
    courseCode: meeting.courseCode,
    title,
    day: DAY_FROM_DB[meeting.day] ?? "Sat",
    start: meeting.startTime,
    end: meeting.endTime,
    location,
    color: colorFor(meeting.courseCode),
    instructor: meeting.instructor ?? undefined,
    type: TYPE_FROM_DB[meeting.meetingType] ?? "Lecture",
    faculty: profile.faculty,
    year: profile.year,
    group: profile.year <= 2 ? profile.group : undefined,
    track: profile.year >= 3 ? profile.track : null,
    section: profile.section,
    columnKey: columnKeyFor(profile),
    source: "db",
  };
}

function isCustomBlock(block: ClassBlock): boolean {
  return block.source === "custom" || block.type === "Custom";
}

export default function TimetablePage() {
  const { t, locale } = useLanguage();
  const { data: session, status } = useSession();
  const studentUser = status === "authenticated" ? session?.user : null;
  const userScope = studentUser?.id ?? studentUser?.email ?? null;
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  // No official column is loaded until the student has a profile or picks filters.
  const [profileReady, setProfileReady] = useState(false);
  // Keyed by column so a profile change shows loading without an effect-time setState.
  const [officialState, setOfficialState] = useState<OfficialState>({
    key: columnKeyFor(DEFAULT_PROFILE),
    meetings: [],
    loading: false,
    error: false,
  });
  const [customBlocks, setCustomBlocks] = useState<ClassBlock[]>([]);
  // Persisted snapshots live in a ref: they mirror localStorage, never drive renders.
  const savedRef = useRef<TimetableSnapshot>({ version: 1, schedules: {} });
  const [ready, setReady] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [sisOpen, setSisOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState("");
  const synced = useSyncedCourses();
  const [onlySynced, setOnlySynced] = useState(false);

  // The onboarding wizard writes the account profile; adopt it here so the
  // timetable column and section filters are personalized immediately.
  useEffect(() => {
    const applyProfile = () => {
      const shared = readAcademicProfile(studentUser);
      if (!shared) return;
      setProfile((current) => ({
        ...current,
        faculty: toTimetableFaculty(shared.faculty),
        year: shared.year,
        group: toTimetableGroup(shared.group),
        track: toTimetableTrack(shared.track),
        section: shared.section,
      }));
      setProfileReady(true);
    };
    applyProfile();
    window.addEventListener(ACADEMIC_PROFILE_EVENT, applyProfile);
    return () => window.removeEventListener(ACADEMIC_PROFILE_EVENT, applyProfile);
  }, [studentUser]);

  const columnKey = useMemo(() => columnKeyFor(profile), [profile]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const snapshot = readTimetableSnapshot(window.localStorage, studentUser);
        savedRef.current = snapshot;
        const shared = readAcademicProfile(studentUser);
        const current: Profile = shared
          ? {
              ...DEFAULT_PROFILE,
              faculty: toTimetableFaculty(shared.faculty),
              year: shared.year,
              group: toTimetableGroup(shared.group),
              track: toTimetableTrack(shared.track),
              section: shared.section,
            }
          : DEFAULT_PROFILE;
        const loaded =
          snapshot.schedules[profileKey(current)] ??
          snapshot.schedules[legacyProfileKey(current)] ??
          [];
        setCustomBlocks(
          loaded.filter(isCustomBlock).map((block) => ({ ...block, source: "custom" as const })),
        );
      } catch {
        setCustomBlocks([]);
      } finally {
        setReady(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [studentUser, userScope]);

  useEffect(() => {
    if (!ready) return;
    const next: TimetableSnapshot = {
      ...savedRef.current,
      schedules: { ...savedRef.current.schedules, [profileKey(profile)]: customBlocks },
    };
    savedRef.current = next;
    writeTimetableSnapshot(window.localStorage, studentUser, next);
  }, [customBlocks, profile, ready, studentUser, userScope]);

  useEffect(() => {
    // Fresh accounts have no profile yet: keep the empty timetable instead of
    // loading the shared official column.
    if (!profileReady) return;
    const controller = new AbortController();
    const params = new URLSearchParams({
      columnKey,
      academicYear: "2026/2027",
      semester: "Fall",
      limit: "500",
    });
    fetch(`/api/timetable/meetings?${params.toString()}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("failed");
        return response.json() as Promise<{ meetings: ApiMeeting[] }>;
      })
      .then((data) => {
        if (controller.signal.aborted) return;
        setOfficialState({
          key: columnKey,
          meetings: Array.isArray(data.meetings) ? data.meetings : [],
          loading: false,
          error: false,
        });
      })
      .catch((fetchError: unknown) => {
        if (controller.signal.aborted || (fetchError instanceof Error && fetchError.name === "AbortError")) return;
        setOfficialState({ key: columnKey, meetings: [], loading: false, error: true });
      });
    return () => controller.abort();
  }, [columnKey, profileReady]);

  const loading = officialState.key !== columnKey || officialState.loading;
  const loadError = officialState.key === columnKey && officialState.error;

  const syncedCodes = useMemo(
    () => new Set(synced.courses.map((course) => normalizeCode(course.courseCode))),
    [synced.courses]
  );
  const showingSynced = onlySynced && syncedCodes.size > 0;

  const officialBlocks = useMemo(
    () => officialState.meetings.map((meeting) => meetingToBlock(meeting, profile, locale)),
    [officialState.meetings, profile, locale]
  );

  const visibleBlocks = useMemo(() => {
    const merged = [...officialBlocks, ...customBlocks];
    return showingSynced
      ? merged.filter((block) => syncedCodes.has(normalizeCode(block.courseCode)))
      : merged;
  }, [officialBlocks, customBlocks, showingSynced, syncedCodes]);

  const conflicts = useMemo(() => findConflicts(visibleBlocks), [visibleBlocks]);
  const conflictIds = useMemo(
    () => new Set(conflicts.flatMap((conflict) => [conflict.a.id, conflict.b.id])),
    [conflicts]
  );
  const customCount = customBlocks.length;
  const gridHeight = ((GRID_END - GRID_START) / 60) * HOUR_PX;
  const sections = sectionOptions(profile);
  const groupOptions = profile.year === 1 ? (["Group 1", "Group 2"] as Group[]) : (["Group 1", "Group 2", "Group 3", "Group 4"] as Group[]);

  function changeProfile<K extends keyof Profile>(key: K, value: Profile[K]) {
    const next = { ...profile, [key]: value } as Profile;
    const nextSections = sectionOptions(next);
    if (!nextSections.includes(next.section)) next.section = nextSections[0];
    setProfile(next);
    setProfileReady(true);
    setCustomBlocks(
      (savedRef.current.schedules[profileKey(next)] ??
        savedRef.current.schedules[legacyProfileKey(next)] ??
        []).filter(isCustomBlock),
    );
  }

  function removeBlock(id: string) {
    const block = customBlocks.find((item) => item.id === id);
    if (block && window.confirm(t("timetable.confirmRemove"))) {
      setCustomBlocks((current) => current.filter((item) => item.id !== id));
    }
  }

  function resetSchedule() {
    if (!window.confirm(t("timetable.resetConfirm"))) return;
    setCustomBlocks([]);
  }

  function addCustomCourse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.title.trim() || !form.courseCode.trim()) {
      setError(t("timetable.required"));
      return;
    }
    if (
      !isValidTimeRange(form.start, form.end) ||
      toMinutes(form.start) < GRID_START ||
      toMinutes(form.end) > GRID_END
    ) {
      setError(t("timetable.invalidTime"));
      return;
    }
    setCustomBlocks((current) => [
      ...current,
      {
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
        group: profile.year <= 2 ? profile.group : undefined,
        track: profile.year >= 3 ? profile.track : null,
        section: profile.section,
        columnKey,
        source: "custom",
      },
    ]);
    setForm(EMPTY_FORM);
    setError("");
    setModalOpen(false);
  }

  return (
    <main className="min-h-[calc(100vh-3rem)] bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <SisSyncGuide open={sisOpen} onOpenChange={setSisOpen} />
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-600 dark:text-cyan-300">{t("timetable.fall")}</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{t("timetable.title")}</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-400">{t("timetable.subtitle")}</p>
          </div>
          <div className="flex flex-wrap gap-2 print:hidden">
            <PrintButton />
            <button
              type="button"
              onClick={() => downloadIcs(visibleBlocks)}
              disabled={!visibleBlocks.length}
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download size={15} />
              {t("timetable.exportCalendar")}
            </button>
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-cyan-100"
            >
              <Plus size={15} />
              {t("timetable.addCourse")}
            </button>
          </div>
        </header>

        <section className="mt-6 grid gap-3 rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/70 sm:grid-cols-2 lg:grid-cols-4">
          <Filter label={t("timetable.faculty")} value={profile.faculty} onChange={(value) => changeProfile("faculty", value as Faculty)}>
            {FACULTIES.map((faculty) => <option key={faculty} value={faculty}>{t(facultyKey(faculty))}</option>)}
          </Filter>
          <Filter label={t("timetable.academicYear")} value={profile.year} onChange={(value) => changeProfile("year", Number(value) as AcademicYear)}>
            {YEARS.map((year) => <option key={year} value={year}>{t(YEAR_LABEL[year])}</option>)}
          </Filter>
          {profile.year <= 2 ? (
            <Filter label={t("timetable.group")} value={profile.group} onChange={(value) => changeProfile("group", value as Group)}>
              {groupOptions.map((group) => <option key={group} value={group}>{t(GROUP_LABEL[group])}</option>)}
            </Filter>
          ) : (
            <Filter label={t("timetable.track")} value={profile.track} onChange={(value) => changeProfile("track", value as Track)}>
              {TRACKS.map((track) => <option key={track} value={track}>{track}</option>)}
            </Filter>
          )}
          <Filter label={t("timetable.section")} value={profile.section} onChange={(value) => changeProfile("section", value)}>
            {sections.map((section) => <option key={section} value={section}>{section}</option>)}
          </Filter>
        </section>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
          <span>
            {t(facultyKey(profile.faculty))} · {t(YEAR_LABEL[profile.year])} ·{" "}
            {profile.year <= 2 ? t(GROUP_LABEL[profile.group]) : profile.track} · {t("timetable.section")} {profile.section}
          </span>
          <div className="flex flex-wrap items-center gap-3">
            {synced.courses.length > 0 && (
              <label className="flex cursor-pointer items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 font-semibold text-cyan-800 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-200">
                <input
                  type="checkbox"
                  checked={onlySynced}
                  onChange={(event) => setOnlySynced(event.target.checked)}
                  className="accent-cyan-600"
                />
                {t("sis.mySynced")}
              </label>
            )}
            <span>{customCount} {t("timetable.customCourses")}</span>
            <button type="button" onClick={resetSchedule} className="font-semibold text-rose-600 hover:text-rose-700 dark:text-rose-300">{t("timetable.reset")}</button>
          </div>
        </div>

        {loading && <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">{t("timetable.loading")}</p>}
        {loadError && <p className="mt-4 text-xs font-medium text-rose-600 dark:text-rose-300">{t("timetable.error")}</p>}

        {ready && !loading && visibleBlocks.length === 0 && (
          <section className="mt-4 rounded-2xl border border-dashed border-cyan-300 bg-cyan-50/60 p-6 text-center dark:border-cyan-800 dark:bg-cyan-950/20">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{t("empty.timetableTitle")}</h2>
            <p className="mx-auto mt-1 max-w-lg text-sm text-slate-600 dark:text-slate-400">{t("empty.timetableBody")}</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={() => setSisOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-700"
              >
                {t("empty.importSis")}
              </button>
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-cyan-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                <Plus size={15} />
                {t("empty.addClass")}
              </button>
            </div>
          </section>
        )}

        {conflicts.length > 0 && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-400/30 dark:bg-amber-950/30 dark:text-amber-200">
            <AlertTriangle size={17} className="mt-0.5 shrink-0" />
            <span>{conflicts.length} {t("timetable.conflicts")}</span>
          </div>
        )}

        <section className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white/90 p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
          <div className="flex min-w-[980px]">
            <div className="w-14 shrink-0 pt-9">
              {Array.from({ length: 7 }, (_, index) => (
                <div key={index} className="relative text-right text-[10px] text-slate-400" style={{ height: HOUR_PX }}>
                  <span className="absolute -top-2 right-2">{String(9 + index).padStart(2, "0")}:00</span>
                </div>
              ))}
            </div>
            {SCHEDULE_DAYS.map((day) => {
              const dayBlocks = visibleBlocks.filter((block) => block.day === day);
              return (
                <div key={day} className="min-w-0 flex-1 border-l border-slate-200 dark:border-slate-800">
                  <div className="h-9 text-center text-xs font-bold text-slate-700 dark:text-slate-200">{day}</div>
                  <div className="relative" style={{ height: gridHeight }}>
                    {Array.from({ length: 8 }, (_, index) => (
                      <div key={index} className="absolute inset-x-0 border-t border-dashed border-slate-200 dark:border-slate-800" style={{ top: index * HOUR_PX }} />
                    ))}
                    {dayBlocks.map((block) => {
                      const top = ((toMinutes(block.start) - GRID_START) / 60) * HOUR_PX;
                      const height = Math.max(34, ((toMinutes(block.end) - toMinutes(block.start)) / 60) * HOUR_PX - 4);
                      return (
                        <article
                          key={block.id}
                          className="group absolute left-1 right-1 overflow-hidden rounded-xl p-2 text-white shadow-sm"
                          style={{ top, height, background: block.color, outline: conflictIds.has(block.id) ? "2px solid #f59e0b" : undefined }}
                          title={`${block.courseCode} ${block.title}`}
                        >
                          <div className="flex flex-wrap items-center gap-1">
                            <span className="rounded-full bg-black/20 px-1.5 py-0.5 text-[9px] font-semibold">
                              {t(`timetable.${(block.type ?? "Custom").toLowerCase()}` as never)}
                            </span>
                            {block.source === "db" && (
                              <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[9px] font-semibold">
                                {t("timetable.official")}
                              </span>
                            )}
                          </div>
                          <p className="mt-1 truncate text-[11px] font-bold">{block.courseCode}</p>
                          <p className="truncate text-[10px] opacity-90">{block.start}–{block.end}</p>
                          <RoomBadge location={block.location} tone="solid" className="mt-1 opacity-90" />
                          {block.source === "custom" && (
                            <button
                              type="button"
                              onClick={() => removeBlock(block.id)}
                              className="absolute right-1 top-1 hidden rounded-md bg-black/25 p-1 group-hover:block"
                              aria-label={`${t("timetable.remove")} ${block.courseCode}`}
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </article>
                      );
                    })}
                    {dayBlocks.length === 0 && !loading && (
                      <p className="absolute inset-x-0 top-5 text-center text-[10px] text-slate-400">{t("timetable.empty")}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
          {(["Lecture", "Lab", "Tutorial", "Custom"] as const).map((type, index) => (
            <span key={type} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1.5 dark:border-slate-800 dark:bg-slate-900">
              <i className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[index] }} />
              {t(`timetable.${type.toLowerCase()}` as never)}
            </span>
          ))}
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="custom-course-title">
          <form onSubmit={addCustomCourse} className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-600 dark:text-cyan-300">{t("timetable.custom")}</p>
                <h2 id="custom-course-title" className="mt-1 text-xl font-semibold">{t("timetable.addCourse")}</h2>
              </div>
              <button type="button" onClick={() => setModalOpen(false)} aria-label={t("timetable.cancel")} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><X size={18} /></button>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Field label={t("timetable.courseName")} value={form.title} onChange={(value) => setForm({ ...form, title: value })} placeholder="Human Computer Interaction" />
              <Field label={t("timetable.code")} value={form.courseCode} onChange={(value) => setForm({ ...form, courseCode: value })} placeholder="CSC 301" />
              <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-400">
                <span>{t("timetable.day")}</span>
                <select value={form.day} onChange={(event) => setForm({ ...form, day: event.target.value as Day })} className={inputClass}>
                  {SCHEDULE_DAYS.map((day) => <option key={day}>{day}</option>)}
                </select>
              </label>
              <Field label={t("timetable.location")} value={form.location} onChange={(value) => setForm({ ...form, location: value })} placeholder="Building 5 · Room 204" />
              <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-400">
                <span>{t("timetable.start")}</span>
                <input type="time" min="09:00" max="16:00" value={form.start} onChange={(event) => setForm({ ...form, start: event.target.value })} className={inputClass} />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-400">
                <span>{t("timetable.end")}</span>
                <input type="time" min="09:00" max="16:00" value={form.end} onChange={(event) => setForm({ ...form, end: event.target.value })} className={inputClass} />
              </label>
              <div className="sm:col-span-2"><Field label={t("timetable.instructor")} value={form.instructor} onChange={(value) => setForm({ ...form, instructor: value })} placeholder="Dr. Aiko Tanaka" /></div>
            </div>
            {error && <p className="mt-3 text-sm font-medium text-rose-600 dark:text-rose-300">{error}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setModalOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300">{t("timetable.cancel")}</button>
              <button type="submit" className="rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700">{t("timetable.add")}</button>
            </div>
          </form>
        </div>
      )}
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
