/**
 * Pure helpers for student-owned local state.
 *
 * Every student key is scoped to the authenticated account so switching
 * accounts never exposes another student's timetable, exams, GPA, or
 * preferences. Guests keep the historical unscoped keys. The helpers accept a
 * minimal Storage-like interface so they can be unit-tested without a DOM.
 */

import { sanitizeGpaData, type GpaData } from "./gpa.ts";
import type { Exam } from "./exams.ts";
import { DAYS, type ClassBlock } from "./timetable.ts";
import {
  scopedStorageKey,
  storageScopeForUser,
  type StorageUser,
} from "./user-scoped-storage.ts";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  keys?(): string[];
  length?: number;
  key?(index: number): string | null;
}

export interface TimetableSnapshot {
  version: 1;
  schedules: Record<string, ClassBlock[]>;
}

export interface ExamsSnapshot {
  exams: Exam[];
  dailyHours: number;
}

export interface SeatInfo {
  hall: string;
  seat: string;
}

export const DEADLINE_TYPES = ["assignment", "quiz", "lab", "project"] as const;
export type DeadlineType = (typeof DEADLINE_TYPES)[number];

export interface Deadline {
  id: string;
  title: string;
  courseCode: string;
  type: DeadlineType;
  dueAt: string;
  completed: boolean;
}

export interface CafeteriaData {
  trays: Record<string, string[]>;
  budget: number;
}

export interface FeedbackEntry {
  at: string;
  text: string;
}

export interface TodaySnapshot {
  timetable: ClassBlock[];
  gpa: GpaData | null;
  exams: ExamsSnapshot | null;
  deadlines: Deadline[];
  cafeteria: CafeteriaData | null;
  saved: string[];
  faculty: string | null;
}

export const DEFAULT_DAILY_HOURS = 3;
export const EMPTY_TIMETABLE_SNAPSHOT: TimetableSnapshot = { version: 1, schedules: {} };
export const EMPTY_EXAMS_SNAPSHOT: ExamsSnapshot = {
  exams: [],
  dailyHours: DEFAULT_DAILY_HOURS,
};

type Feature =
  | "timetable"
  | "exams"
  | "exam-seat"
  | "deadlines"
  | "gpa"
  | "academic-profile"
  | "ta-profile"
  | "faculty"
  | "cafeteria"
  | "cafeteria-feedback"
  | "scholarships-saved";

/** Legacy keys that a signed-in student must never inherit. */
export function legacyStudentStorageKeys(): string[] {
  return [
    "student_custom_timetable",
    "ejust:timetable",
    "ejust-timetable-v1",
    "ejust-exams-v1",
    "ejust-exam-seat-v1",
    "ejust:gpa",
    "ejust-gpa-v1",
    "ejust:academic-profile",
    "ejust:ta-profile",
    "ejust:faculty",
    "ejust-cafeteria-v1",
    "ejust-cafeteria-feedback-v1",
    "ejust-scholarships-saved-v1",
  ];
}

const LEGACY_KEY_SET = new Set(legacyStudentStorageKeys());

/** Namespaced key for signed-in users; the legacy key for guests. */
export function studentStorageKey(
  feature: Feature | string,
  user?: StorageUser | null,
  legacyKey?: string,
): string {
  if (storageScopeForUser(user)) return scopedStorageKey(feature, user);
  return legacyKey ?? scopedStorageKey(feature, user);
}

export function timetableStorageKey(user?: StorageUser | null): string {
  return studentStorageKey("timetable", user, "student_custom_timetable");
}

export function examsStorageKey(user?: StorageUser | null): string {
  return studentStorageKey("exams", user, "ejust-exams-v1");
}

export function examSeatStorageKey(user?: StorageUser | null): string {
  return studentStorageKey("exam-seat", user, "ejust-exam-seat-v1");
}

export function deadlineStorageKey(user?: StorageUser | null): string {
  return studentStorageKey("deadlines", user, "ejust:deadlines");
}

export function facultyStorageKey(user?: StorageUser | null): string {
  return studentStorageKey("faculty", user, "ejust:faculty");
}

export function gpaStorageKey(user?: StorageUser | null): string {
  return studentStorageKey("gpa", user, "ejust:gpa");
}

export function legacyGpaStorageKey(): string {
  return "ejust-gpa-v1";
}

export function cafeteriaStorageKey(user?: StorageUser | null): string {
  return studentStorageKey("cafeteria", user, "ejust-cafeteria-v1");
}

export function cafeteriaFeedbackStorageKey(user?: StorageUser | null): string {
  return studentStorageKey("cafeteria-feedback", user, "ejust-cafeteria-feedback-v1");
}

export function savedScholarshipsStorageKey(user?: StorageUser | null): string {
  return studentStorageKey("scholarships-saved", user, "ejust-scholarships-saved-v1");
}

function storageKeys(store: StorageLike): string[] {
  if (typeof store.keys === "function") return store.keys();
  if (typeof store.length === "number" && typeof store.key === "function") {
    const keys: string[] = [];
    for (let index = 0; index < store.length; index += 1) {
      const key = store.key(index);
      if (key) keys.push(key);
    }
    return keys;
  }
  return [];
}

/** Purse old unscoped demo keys once a signed-in scope is available. */
export function purgeLegacyStudentKeys(store: StorageLike, user?: StorageUser | null): void {
  if (!storageScopeForUser(user)) return;
  for (const key of storageKeys(store)) {
    if (!LEGACY_KEY_SET.has(key)) continue;
    try {
      store.removeItem(key);
    } catch {
      // best-effort cleanup
    }
  }
}

function parseJson(raw: string | null): unknown {
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asTimetableSnapshot(value: unknown): TimetableSnapshot {
  if (!isRecord(value) || value.version !== 1 || !isRecord(value.schedules)) {
    return EMPTY_TIMETABLE_SNAPSHOT;
  }
  const schedules: Record<string, ClassBlock[]> = {};
  for (const [key, blocks] of Object.entries(value.schedules)) {
    if (Array.isArray(blocks)) {
      schedules[key] = blocks.filter(
        (block): block is ClassBlock => isRecord(block) && typeof block.id === "string",
      );
    }
  }
  return { version: 1, schedules };
}

function asExamsSnapshot(value: unknown): ExamsSnapshot {
  if (!isRecord(value)) return EMPTY_EXAMS_SNAPSHOT;
  const exams = Array.isArray(value.exams)
    ? (value.exams.filter(
        (exam): exam is Exam => isRecord(exam) && typeof exam.id === "string",
      ) as Exam[])
    : [];
  const dailyHours =
    typeof value.dailyHours === "number" &&
    Number.isFinite(value.dailyHours) &&
    value.dailyHours > 0
      ? value.dailyHours
      : DEFAULT_DAILY_HOURS;
  return { exams, dailyHours };
}

function asSeatInfo(value: unknown): SeatInfo | null {
  if (!isRecord(value)) return null;
  if (typeof value.hall !== "string" || typeof value.seat !== "string") return null;
  return { hall: value.hall, seat: value.seat };
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function asCafeteriaData(value: unknown): CafeteriaData | null {
  if (!isRecord(value)) return null;
  const rawTrays = isRecord(value.trays) ? value.trays : {};
  const trays: Record<string, string[]> = {};
  for (const [day, items] of Object.entries(rawTrays)) {
    trays[day] = asStringArray(items);
  }
  return {
    trays,
    budget: typeof value.budget === "number" && Number.isFinite(value.budget) ? value.budget : 0,
  };
}

function asFeedback(value: unknown): FeedbackEntry[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (entry): entry is FeedbackEntry => isRecord(entry) && typeof entry.text === "string",
  );
}

function asDeadline(value: unknown): Deadline | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.id !== "string" ||
    typeof value.title !== "string" ||
    typeof value.courseCode !== "string" ||
    typeof value.dueAt !== "string" ||
    typeof value.completed !== "boolean" ||
    !DEADLINE_TYPES.includes(value.type as DeadlineType)
  ) {
    return null;
  }
  if (Number.isNaN(Date.parse(value.dueAt))) return null;
  return {
    id: value.id,
    title: value.title,
    courseCode: value.courseCode,
    type: value.type as DeadlineType,
    dueAt: value.dueAt,
    completed: value.completed,
  };
}

function readJson(store: StorageLike, key: string): unknown {
  return parseJson(store.getItem(key));
}

function writeJson(store: StorageLike, key: string, value: unknown): void {
  store.setItem(key, JSON.stringify(value));
}

// ---------------------------------------------------------------------------
// Timetable
// ---------------------------------------------------------------------------

export function readTimetableSnapshot(
  store: StorageLike,
  user?: StorageUser | null,
): TimetableSnapshot {
  purgeLegacyStudentKeys(store, user);
  return asTimetableSnapshot(readJson(store, timetableStorageKey(user)));
}

export function writeTimetableSnapshot(
  store: StorageLike,
  user: StorageUser | null,
  snapshot: TimetableSnapshot,
): void {
  purgeLegacyStudentKeys(store, user);
  writeJson(store, timetableStorageKey(user), snapshot);
}

// ---------------------------------------------------------------------------
// Exams, seat and faculty
// ---------------------------------------------------------------------------

export function readExamsSnapshot(store: StorageLike, user?: StorageUser | null): ExamsSnapshot {
  purgeLegacyStudentKeys(store, user);
  return asExamsSnapshot(readJson(store, examsStorageKey(user)));
}

export function writeExamsSnapshot(
  store: StorageLike,
  user: StorageUser | null,
  snapshot: ExamsSnapshot,
): void {
  purgeLegacyStudentKeys(store, user);
  writeJson(store, examsStorageKey(user), snapshot);
}

export function readExamSeat(store: StorageLike, user?: StorageUser | null): SeatInfo | null {
  purgeLegacyStudentKeys(store, user);
  return asSeatInfo(readJson(store, examSeatStorageKey(user)));
}

export function writeExamSeat(
  store: StorageLike,
  user: StorageUser | null,
  seat: SeatInfo | null,
): void {
  purgeLegacyStudentKeys(store, user);
  const key = examSeatStorageKey(user);
  if (seat) writeJson(store, key, seat);
  else store.removeItem(key);
}

export function readFaculty(store: StorageLike, user?: StorageUser | null): string | null {
  purgeLegacyStudentKeys(store, user);
  const raw = store.getItem(facultyStorageKey(user));
  if (!raw || !raw.trim()) return null;
  const parsed = parseJson(raw);
  if (typeof parsed === "string") return parsed;
  // Backward compatibility with the old raw-string value on guest devices.
  return raw;
}

export function writeFaculty(
  store: StorageLike,
  user: StorageUser | null,
  faculty: string | null,
): void {
  purgeLegacyStudentKeys(store, user);
  const key = facultyStorageKey(user);
  if (faculty) writeJson(store, key, faculty);
  else store.removeItem(key);
}

// ---------------------------------------------------------------------------
// GPA, cafeteria and saved scholarships
// ---------------------------------------------------------------------------

export function readGpa(store: StorageLike, user?: StorageUser | null): GpaData | null {
  purgeLegacyStudentKeys(store, user);
  const primary = sanitizeGpaData(readJson(store, gpaStorageKey(user)));
  if (primary) return primary;
  if (user?.id || user?.email) return null;
  return sanitizeGpaData(readJson(store, legacyGpaStorageKey()));
}

export function writeGpa(
  store: StorageLike,
  user: StorageUser | null,
  gpa: GpaData,
): void {
  purgeLegacyStudentKeys(store, user);
  writeJson(store, gpaStorageKey(user), gpa);
}

export function readCafeteria(store: StorageLike, user?: StorageUser | null): CafeteriaData | null {
  purgeLegacyStudentKeys(store, user);
  return asCafeteriaData(readJson(store, cafeteriaStorageKey(user)));
}

export function writeCafeteria(
  store: StorageLike,
  user: StorageUser | null,
  data: CafeteriaData,
): void {
  purgeLegacyStudentKeys(store, user);
  writeJson(store, cafeteriaStorageKey(user), data);
}

export function readCafeteriaFeedback(
  store: StorageLike,
  user?: StorageUser | null,
): FeedbackEntry[] {
  purgeLegacyStudentKeys(store, user);
  return asFeedback(readJson(store, cafeteriaFeedbackStorageKey(user)));
}

export function writeCafeteriaFeedback(
  store: StorageLike,
  user: StorageUser | null,
  entries: FeedbackEntry[],
): void {
  purgeLegacyStudentKeys(store, user);
  writeJson(store, cafeteriaFeedbackStorageKey(user), entries);
}

export function readSavedScholarships(
  store: StorageLike,
  user?: StorageUser | null,
): string[] {
  purgeLegacyStudentKeys(store, user);
  return asStringArray(readJson(store, savedScholarshipsStorageKey(user)));
}

export function writeSavedScholarships(
  store: StorageLike,
  user: StorageUser | null,
  ids: string[],
): void {
  purgeLegacyStudentKeys(store, user);
  writeJson(store, savedScholarshipsStorageKey(user), ids);
}

// ---------------------------------------------------------------------------
// Deadlines and quizzes
// ---------------------------------------------------------------------------

/** Drop malformed entries so corrupt local storage can never poison the tracker. */
export function sanitizeDeadlines(value: unknown): Deadline[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(asDeadline)
    .filter((deadline): deadline is Deadline => deadline !== null);
}

export function readDeadlines(store: StorageLike, user?: StorageUser | null): Deadline[] {
  purgeLegacyStudentKeys(store, user);
  return sanitizeDeadlines(readJson(store, deadlineStorageKey(user)));
}

export function writeDeadlines(
  store: StorageLike,
  user: StorageUser | null,
  deadlines: Deadline[],
): void {
  purgeLegacyStudentKeys(store, user);
  writeJson(store, deadlineStorageKey(user), sanitizeDeadlines(deadlines));
}

/** Earliest due date first; completed items are kept for the archived list. */
export function sortDeadlines(deadlines: Deadline[]): Deadline[] {
  return [...deadlines].toSorted(
    (a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt) || a.id.localeCompare(b.id),
  );
}

export function deadlineHoursLeft(deadline: Deadline, now: Date): number {
  return (Date.parse(deadline.dueAt) - now.getTime()) / 3_600_000;
}

/** Anything due in less than 48 hours (including overdue work) is urgent. */
export function isUrgentDeadline(deadline: Deadline, now: Date): boolean {
  return deadlineHoursLeft(deadline, now) < 48;
}

// ---------------------------------------------------------------------------
// Today snapshot and class selection
// ---------------------------------------------------------------------------

/** Read only the signed-in student's own data from localStorage. */
export function readTodaySnapshot(store: StorageLike, user?: StorageUser | null): TodaySnapshot {
  purgeLegacyStudentKeys(store, user);

  const schedules = readTimetableSnapshot(store, user).schedules;
  const timetable = Object.values(schedules).flat();

  const gpaRaw = store.getItem(gpaStorageKey(user));
  const gpa = gpaRaw === null ? null : sanitizeGpaData(parseJson(gpaRaw));

  const examsRaw = store.getItem(examsStorageKey(user));
  const exams = examsRaw === null ? null : asExamsSnapshot(parseJson(examsRaw));

  const cafeteriaRaw = store.getItem(cafeteriaStorageKey(user));
  const cafeteria = cafeteriaRaw === null ? null : asCafeteriaData(parseJson(cafeteriaRaw));

  return {
    timetable,
    gpa,
    exams,
    deadlines: sanitizeDeadlines(parseJson(store.getItem(deadlineStorageKey(user)))),
    cafeteria,
    saved: readSavedScholarships(store, user),
    faculty: readFaculty(store, user),
  };
}

function toTimeValue(value: string): number {
  const [hours = "0", minutes = "0"] = value.split(":");
  return Number(hours) * 60 + Number(minutes);
}

export function selectTodaysClasses(
  timetable: ClassBlock[],
  now: Date,
): ClassBlock[] {
  const day = DAYS[now.getDay()] ?? "";
  return timetable
    .filter((block) => block.day === day)
    .toSorted((a, b) => toTimeValue(a.start) - toTimeValue(b.start));
}

export function selectNextClass(classes: ClassBlock[], now: Date): ClassBlock | null {
  const minutes = now.getHours() * 60 + now.getMinutes();
  return classes.find((block) => toTimeValue(block.start) >= minutes) ?? null;
}
