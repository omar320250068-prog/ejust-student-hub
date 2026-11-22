/**
 * Student local-data backup. Pure helpers backed by a minimal Storage-like
 * interface so they can be unit-tested without a DOM and reused by the UI.
 * Only known keys are exported/imported: arbitrary keys are never restored.
 */

import {
  baseStorageKey,
  isScopedStorageKey,
} from "./user-scoped-storage.ts";

export const BACKUP_FORMAT = "ejust-student-hub-backup";
export const BACKUP_VERSION = 1;
export const MAX_BACKUP_BYTES = 5_000_000;

/** Keys that belong to the student's local state (dismissal flags included). */
export const BACKUP_KEYS = [
  "ejust:gpa",
  "ejust-gpa-v1",
  "student_custom_timetable",
  "ejust:timetable",
  "ejust-timetable-v1",
  "ejust-exams-v1",
  "ejust-exam-seat-v1",
  "ejust:deadlines",
  "ejust:attendance",
  "ejust:academic-profile",
  "ejust:ta-profile",
  "ejust:sis-sync",
  "ejust-cafeteria-v1",
  "ejust-cafeteria-feedback-v1",
  "ejust-scholarships-saved-v1",
  "ejust-locale",
] as const;

export type BackupKey =
  | (typeof BACKUP_KEYS)[number]
  | `ejust:${string}:u:${string}`;

const KNOWN_KEYS = new Set<string>(BACKUP_KEYS);

function isKnownKey(key: string): boolean {
  return KNOWN_KEYS.has(key) || isScopedStorageKey(key);
}

/** Scoped keys reuse the validation rules of their unscoped counterpart. */
function validationKey(key: string): string {
  return isScopedStorageKey(key) ? baseStorageKey(key) : key;
}

export interface StudentDataBackup {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  data: Partial<Record<BackupKey, unknown>>;
}

export type BackupValidation =
  | { ok: true; backup: StudentDataBackup }
  | { ok: false; error: "invalid_format" | "unsupported_version" | "invalid_data" | "too_large" };

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  /** Optional so tests and minimal storage shims can omit key discovery. */
  keys?(): string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function validCourse(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.code === "string" &&
    typeof value.title === "string" &&
    typeof value.credits === "number"
  );
}

function validClassBlock(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.day === "string" &&
    typeof value.start === "string" &&
    typeof value.end === "string"
  );
}

const DEADLINE_TYPES = new Set(["assignment", "quiz", "lab", "project"]);

function validDeadline(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.courseCode === "string" &&
    DEADLINE_TYPES.has(String(value.type)) &&
    typeof value.dueAt === "string" &&
    !Number.isNaN(Date.parse(value.dueAt)) &&
    typeof value.completed === "boolean"
  );
}

function validAttendance(value: unknown): boolean {
  return (
    isRecord(value) &&
    Object.values(value).every(
      (entry) =>
        isRecord(entry) &&
        Number.isInteger(entry.absences) &&
        (entry.absences as number) >= 0 &&
        Number.isInteger(entry.maxAllowed) &&
        (entry.maxAllowed as number) > 0,
    )
  );
}

/** Legacy timetables were bare arrays; scoped student data uses a schedules map. */
function validTimetableValue(value: unknown): boolean {
  if (Array.isArray(value)) return value.every(validClassBlock);
  return (
    isRecord(value) &&
    value.version === 1 &&
    isRecord(value.schedules) &&
    Object.values(value.schedules).every(
      (blocks) => Array.isArray(blocks) && blocks.every(validClassBlock),
    )
  );
}

/** Reject obviously malformed or hostile values before touching storage. */
function validValue(key: string, value: unknown): boolean {
  switch (validationKey(key)) {
    case "ejust:gpa":
    case "ejust-gpa-v1": {
      if (!isRecord(value)) return false;
      if (validationKey(key) === "ejust:gpa") {
        return (
          Array.isArray(value.courses) &&
          value.courses.every(validCourse) &&
          typeof value.targetGpa === "number" &&
          typeof value.degreeCredits === "number"
        );
      }
      return Array.isArray(value.courses) && value.courses.every(validCourse);
    }
    case "student_custom_timetable":
    case "ejust:timetable":
    case "ejust-timetable-v1":
      return validTimetableValue(value);
    case "ejust:exams":
    case "ejust-exams-v1":
      return isRecord(value) && Array.isArray(value.exams) && typeof value.dailyHours === "number";
    case "ejust:exam-seat":
    case "ejust-exam-seat-v1":
      return isRecord(value) && typeof value.hall === "string" && typeof value.seat === "string";
    case "ejust:deadlines":
      return Array.isArray(value) && value.every(validDeadline);
    case "ejust:attendance":
      return validAttendance(value);
    case "ejust:faculty":
      return typeof value === "string";
    case "ejust:academic-profile":
    case "ejust:ta-profile":
    case "ejust:sis-sync":
    case "ejust-cafeteria-v1":
    case "ejust:cafeteria":
      return isRecord(value);
    case "ejust-cafeteria-feedback-v1":
    case "ejust:cafeteria-feedback":
      return Array.isArray(value);
    case "ejust-scholarships-saved-v1":
    case "ejust:scholarships-saved":
      return isStringArray(value);
    case "ejust-locale":
      return value === "en" || value === "ar" || value === "ja";
    default:
      return false;
  }
}

/** Read every known key from storage into a versioned, JSON-safe object. */
export function collectBackup(storage: StorageLike, now = new Date()): StudentDataBackup {
  const data: Partial<Record<BackupKey, unknown>> = {};
  const keys = new Set<BackupKey>(BACKUP_KEYS);
  if (storage.keys) {
    for (const key of storage.keys()) {
      if (isKnownKey(key)) keys.add(key as BackupKey);
    }
  }

  for (const key of keys) {
    try {
      const raw = storage.getItem(key);
      if (raw === null) continue;
      const parsed: unknown = JSON.parse(raw);
      if (validValue(key, parsed)) data[key] = parsed;
    } catch {
      // A malformed local value must not break the whole export.
    }
  }
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    data,
  };
}

/** Validate a parsed import before any value is written to localStorage. */
export function validateBackup(value: unknown): BackupValidation {
  if (!isRecord(value)) return { ok: false, error: "invalid_format" };
  if (value.format !== BACKUP_FORMAT) return { ok: false, error: "invalid_format" };
  if (value.version !== BACKUP_VERSION) return { ok: false, error: "unsupported_version" };
  if (
    typeof value.exportedAt !== "string" ||
    Number.isNaN(Date.parse(value.exportedAt)) ||
    !isRecord(value.data)
  ) {
    return { ok: false, error: "invalid_data" };
  }

  let serialized: string;
  try {
    serialized = JSON.stringify(value);
  } catch {
    return { ok: false, error: "invalid_data" };
  }
  if (serialized.length > MAX_BACKUP_BYTES) return { ok: false, error: "too_large" };

  for (const [key, entry] of Object.entries(value.data)) {
    if (!isKnownKey(key) || !validValue(key, entry)) {
      return { ok: false, error: "invalid_data" };
    }
  }

  return {
    ok: true,
    backup: value as unknown as StudentDataBackup,
  };
}

/** Write a validated backup. Returns the number of restored keys. */
export function applyBackup(storage: StorageLike, backup: StudentDataBackup): number {
  let restored = 0;
  for (const [key, entry] of Object.entries(backup.data)) {
    if (!isKnownKey(key) || !validValue(key, entry)) continue;
    try {
      storage.setItem(key, JSON.stringify(entry));
      restored += 1;
    } catch {
      // Keep restoring the remaining keys; storage may be full or disabled.
    }
  }
  return restored;
}

export function backupFilename(now = new Date()): string {
  return `ejust-hub-backup-${now.toISOString().slice(0, 10)}.json`;
}
