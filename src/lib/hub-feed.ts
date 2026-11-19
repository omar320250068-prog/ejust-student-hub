import type { Exam, ExamType } from "./exams";
import { inferFacultyFromCourseCode, tagNoticesWithFaculty, type Faculty } from "./faculty.ts";

/** Values stored by the E-JUST Hub MCP server in Neon. */
export type HubExamType = "MIDTERM" | "FINAL" | "QUIZ";
export type HubNoticeCategory = "ACADEMIC" | "EXAM" | "SCHEDULE_CHANGE" | "EVENT";

export interface HubExamRow {
  id: string;
  courseCode: string;
  courseName: string | null;
  courseNameAr: string | null;
  examType: string;
  examDate: string;
  startTime: string | null;
  endTime: string | null;
  building: string | null;
  room: string | null;
  notes: string | null;
}

export interface HubNoticeRow {
  id: string;
  title: string;
  body: string;
  category: string;
  courseCode: string;
  courseName: string | null;
  targetFaculty: string;
  expiresAt: string | null;
  createdAt: string;
}

export interface LiveExam extends Exam {
  courseName: string | null;
  courseNameAr: string | null;
  location: string;
  faculty: Faculty;
  source: "hub";
}

export interface LiveNotice {
  id: string;
  title: string;
  body: string;
  category: HubNoticeCategory;
  courseCode: string;
  courseName: string | null;
  targetFaculty: string;
  faculty: Faculty;
  expiresAt: string | null;
  createdAt: string;
}

const EXAM_DEFAULTS: Record<HubExamType, { type: ExamType; weight: number; difficulty: number }> = {
  QUIZ: { type: "Quiz", weight: 15, difficulty: 2 },
  MIDTERM: { type: "Midterm", weight: 30, difficulty: 3 },
  FINAL: { type: "Final", weight: 40, difficulty: 4 },
};

/** Match the MCP server's course-code normalization (uppercase, alphanumerics only). */
export function normalizeCode(value: string | null | undefined): string {
  return (value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Accept `?codes=CSC341,MATH-201`, including spaced codes such as `Math 201`. */
export function parseCodeList(value: string | null | undefined): string[] {
  if (!value) return [];
  const codes: string[] = [];
  for (const part of value.split(/[,;|\r?\n]+/)) {
    let buffer = "";
    for (const token of part.trim().split(/\s+/)) {
      const normalized = normalizeCode(token);
      if (!normalized) continue;
      // "CSC 341" arrives as two tokens; rejoin the digits with the prefix.
      if (/^\d+$/.test(normalized) && /^[A-Z]+$/.test(buffer)) {
        buffer += normalized;
      } else {
        if (buffer) codes.push(buffer);
        buffer = normalized;
      }
    }
    if (buffer) codes.push(buffer);
  }
  return [...new Set(codes)];
}

function examType(type: string): ExamType {
  const key = type.toUpperCase().replace(/[\s-]+/g, "") as HubExamType;
  return EXAM_DEFAULTS[key]?.type ?? "Midterm";
}

function examDefaults(type: string) {
  const key = type.toUpperCase().replace(/[\s-]+/g, "") as HubExamType;
  return EXAM_DEFAULTS[key] ?? EXAM_DEFAULTS.MIDTERM;
}

function examTimestamp(row: HubExamRow): string {
  const raw = row.startTime?.trim() || "09:00";
  const time = /^\d{1,2}:\d{2}$/.test(raw) ? `${raw}:00` : raw;
  return new Date(`${row.examDate}T${time}`).toISOString();
}

/** Convert a raw `exam` row (already joined with `course`) into planner data. */
export function examRowToUi(row: HubExamRow): LiveExam {
  const defaults = examDefaults(row.examType);
  const location = [row.building, row.room].map((part) => part?.trim()).filter(Boolean).join(" · ");
  return {
    id: `hub:${row.id}`,
    courseCode: normalizeCode(row.courseCode),
    title: row.courseName || row.courseCode,
    type: examType(row.examType),
    date: examTimestamp(row),
    weight: defaults.weight,
    difficulty: defaults.difficulty,
    notes: row.notes ?? undefined,
    courseName: row.courseName,
    courseNameAr: row.courseNameAr,
    location: location || "TBA",
    faculty: inferFacultyFromCourseCode(row.courseCode),
    source: "hub",
  };
}

export function isNoticeActive(row: HubNoticeRow, nowMs = Date.now()): boolean {
  if (!row.expiresAt) return true;
  const expires = Date.parse(row.expiresAt);
  return Number.isNaN(expires) || expires > nowMs;
}

/**
 * A notice is relevant when it is aimed at the viewer's faculty (or nobody in
 * particular) and, if it names a course, that course is one of their synced
 * courses. Passing `codes: undefined` skips the course check (assistant use).
 */
export function noticeMatchesAudience(
  row: HubNoticeRow,
  faculty: string,
  codes?: string[]
): boolean {
  const target = normalizeCode(row.targetFaculty);
  if (target && target !== normalizeCode(faculty)) return false;
  const course = normalizeCode(row.courseCode);
  if (course && codes !== undefined && !codes.includes(course)) return false;
  return true;
}

export interface NoticeFilter {
  nowMs?: number;
  faculty?: string;
  codes?: string[];
}

/** Filter and normalize hub notices for the Today feed. */
export function filterActiveNotices(
  rows: HubNoticeRow[],
  { nowMs = Date.now(), faculty = "CSIT", codes = [] }: NoticeFilter = {}
): LiveNotice[] {
  const mapped = rows
    .filter((row) => isNoticeActive(row, nowMs) && noticeMatchesAudience(row, faculty, codes))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .map((row) => ({
      id: row.id,
      title: row.title,
      body: row.body,
      category: (row.category.toUpperCase().replace(/[\s-]+/g, "_") ||
        "ACADEMIC") as HubNoticeCategory,
      courseCode: normalizeCode(row.courseCode),
      courseName: row.courseName,
      targetFaculty: row.targetFaculty,
      expiresAt: row.expiresAt,
      createdAt: row.createdAt,
    }));
  return tagNoticesWithFaculty(mapped);
}
