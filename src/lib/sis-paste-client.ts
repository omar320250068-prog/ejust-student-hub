/**
 * Client glue for the Smart Paste import. The pure parser/merge helpers are
 * storage-agnostic; this module reads the scoped student snapshots, applies the
 * merge and writes every affected snapshot back using the same helpers the
 * pages use. Existing records are never replaced.
 */

import { EMPTY_GPA_DATA, type GpaData } from "./gpa.ts";
import {
  toTimetableFaculty,
  toTimetableGroup,
  toTimetableTrack,
  readAcademicProfile,
} from "./onboarding.ts";
import { mergeCoursesIntoGpa, mergeSisPaste } from "./sis-paste-import.ts";
import { parseSisPaste } from "./sis-paste-parser.ts";
import type { SyncSummary, SyncedCourse } from "./sis-sync.ts";
import {
  readExamsSnapshot,
  readGpa,
  readTimetableSnapshot,
  writeExamsSnapshot,
  writeGpa,
  writeTimetableSnapshot,
  type ExamsSnapshot,
  type StorageLike,
  type TimetableSnapshot,
} from "./student-data.ts";
import { scopedStorageKey, type StorageUser } from "./user-scoped-storage.ts";

export interface SisPasteApplyResult {
  courses: SyncedCourse[];
  summary: SyncSummary;
  gpa: GpaData;
  exams: ExamsSnapshot;
  timetable: TimetableSnapshot;
  counts: {
    courses: number;
    classes: number;
    exams: number;
  };
}

const EMPTY_SUMMARY: SyncSummary = {
  cgpa: 0,
  completedCredits: 0,
  remainingCredits: 134,
  progressPercent: 0,
  courseCount: 0,
};

/** Mirror of the timetable page's profile key so pasted classes land in the active schedule. */
function activeScheduleKey(store: StorageLike, user: StorageUser | null, schedules: Record<string, unknown>): string {
  const profile = readAcademicProfile(user);
  if (profile) {
    return [
      toTimetableFaculty(profile.faculty),
      profile.year,
      toTimetableGroup(profile.group).replace(" ", ""),
      toTimetableTrack(profile.track),
      profile.section,
    ].join("-");
  }
  const existing = Object.keys(schedules);
  return existing[0] ?? "CSIT-1-Group1-CSC-1";
}

/** Parse, merge into every scoped snapshot and persist. Nothing is deleted. */
export function applySisPasteToStorage(
  store: StorageLike,
  raw: string,
  user: StorageUser | null,
): SisPasteApplyResult {
  const parsed = parseSisPaste(raw);
  const counts = {
    courses: parsed.courses.length,
    classes: parsed.classes.length,
    exams: parsed.exams.length,
  };

  let previous: { courses: SyncedCourse[]; summary: SyncSummary } = {
    courses: [],
    summary: EMPTY_SUMMARY,
  };
  try {
    const saved = store.getItem(scopedStorageKey("sis-sync", user));
    if (saved) {
      const value = JSON.parse(saved) as { courses?: SyncedCourse[]; summary?: SyncSummary };
      if (Array.isArray(value.courses)) {
        previous = {
          courses: value.courses,
          summary: value.summary ?? EMPTY_SUMMARY,
        };
      }
    }
  } catch {
    // Corrupt sync state is replaced by the parsed records only.
  }

  const timetable = readTimetableSnapshot(store, user);
  const exams = readExamsSnapshot(store, user);
  const scheduleKey = activeScheduleKey(store, user, timetable.schedules);
  const activeClasses = timetable.schedules[scheduleKey] ?? [];

  const merged = mergeSisPaste(
    { courses: previous.courses, classes: activeClasses, exams: exams.exams },
    parsed,
  );

  const courses = merged.courses;
  const summary: SyncSummary = {
    ...previous.summary,
    courseCount: courses.length,
  };

  store.setItem(
    scopedStorageKey("sis-sync", user),
    JSON.stringify({ courses, summary }),
  );

  const nextTimetable: TimetableSnapshot = {
    version: 1,
    schedules: { ...timetable.schedules, [scheduleKey]: merged.classes },
  };
  writeTimetableSnapshot(store, user, nextTimetable);

  const nextExams: ExamsSnapshot = { ...exams, exams: merged.exams };
  writeExamsSnapshot(store, user, nextExams);

  const currentGpa = readGpa(store, user) ?? EMPTY_GPA_DATA;
  const gpa = mergeCoursesIntoGpa(currentGpa.courses, courses);
  const nextGpa: GpaData = { ...currentGpa, courses: gpa };
  writeGpa(store, user, nextGpa);

  return {
    courses,
    summary,
    gpa: nextGpa,
    exams: nextExams,
    timetable: nextTimetable,
    counts,
  };
}
