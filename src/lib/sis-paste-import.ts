/**
 * Merge helper for the Smart Paste flow. It never replaces existing student
 * data: matching records are enriched and unmatched records are appended.
 */

import type { Exam } from "./exams.ts";
import type { Course } from "./gpa.ts";
import type { SisPasteParseResult } from "./sis-paste-parser.ts";
import type { SyncedCourse } from "./sis-sync.ts";
import type { ClassBlock } from "./timetable.ts";

export interface SisPasteImportTarget {
  courses: SyncedCourse[];
  classes: ClassBlock[];
  exams: Exam[];
}

const PASTE_COLORS = ["#0891b2", "#7c3aed", "#db2777", "#059669", "#d97706"];

const EXAM_WEIGHTS: Record<string, number> = {
  Final: 40,
  Midterm: 30,
  Quiz: 15,
  Project: 20,
  Exam: 30,
};

const EXAM_DIFFICULTY: Record<string, number> = {
  Final: 4,
  Midterm: 3,
  Quiz: 2,
  Project: 2,
  Exam: 3,
};

function codeOf(value: string): string {
  return value.replace(/[^A-Z0-9]/gi, "").toUpperCase();
}

function mergedCourse(
  existing: SyncedCourse | undefined,
  parsed: SisPasteParseResult["courses"][number],
  updatedAt: string,
): SyncedCourse {
  // Fresh SIS values win; existing values only fill fields SIS left blank.
  const grade = parsed.grade ?? existing?.grade ?? null;
  return {
    ...(existing ?? {}),
    id: existing?.id ?? `paste-${parsed.courseCode}`,
    courseCode: parsed.courseCode,
    courseName: parsed.courseName ?? existing?.courseName ?? null,
    creditHours: parsed.creditHours ?? existing?.creditHours ?? null,
    grade,
    semester: parsed.semester ?? existing?.semester ?? null,
    status: grade && grade !== "in-progress" ? "completed" : "registered",
    updatedAt,
  };
}

/** Produce a new target with parsed records merged into scoped student data. */
export function mergeSisPaste(
  target: SisPasteImportTarget,
  parsed: SisPasteParseResult,
  now = new Date(),
): SisPasteImportTarget {
  const updatedAt = now.toISOString();

  const courses = new Map<string, SyncedCourse>();
  for (const course of target.courses) {
    const code = codeOf(course.courseCode);
    if (code) courses.set(code, course);
  }
  for (const course of parsed.courses) {
    courses.set(course.courseCode, mergedCourse(courses.get(course.courseCode), course, updatedAt));
  }

  const names = new Map<string, string>();
  for (const course of courses.values()) {
    if (course.courseName) names.set(codeOf(course.courseCode), course.courseName);
  }

  const classes = new Map<string, ClassBlock>();
  for (const block of target.classes) {
    classes.set(`${codeOf(block.courseCode)}|${block.day}|${block.start}`, block);
  }
  parsed.classes.forEach((slot) => {
    const key = `${slot.courseCode}|${slot.day}|${slot.start}`;
    if (classes.has(key)) return;
    const code = codeOf(slot.courseCode);
    classes.set(key, {
      id: `paste-${code}-${slot.day}-${slot.start.replace(":", "")}`,
      courseCode: code,
      title: names.get(code) ?? code,
      day: slot.day,
      start: slot.start,
      end: slot.end,
      location: slot.room ?? "TBA",
      color: PASTE_COLORS[classes.size % PASTE_COLORS.length],
      type: "Lecture",
      source: "custom",
    });
  });

  const exams = new Map<string, Exam>();
  for (const exam of target.exams) {
    const date = String(exam.date).slice(0, 10);
    exams.set(`${codeOf(exam.courseCode)}|${date}|${exam.type}`, exam);
  }
  for (const exam of parsed.exams) {
    const type = exam.type;
    const key = `${exam.courseCode}|${exam.date}|${type}`;
    if (exams.has(key)) continue;
    exams.set(key, {
      id: `paste-${exam.courseCode}-${type}-${exam.date}`,
      courseCode: exam.courseCode,
      title: exam.title,
      type: type === "Exam" ? "Final" : type,
      date: `${exam.date}T${exam.time ?? "09:00"}`,
      weight: EXAM_WEIGHTS[type] ?? 30,
      difficulty: EXAM_DIFFICULTY[type] ?? 3,
    });
  }

  return {
    courses: [...courses.values()],
    classes: [...classes.values()],
    exams: [...exams.values()],
  };
}

/** Convert synced courses into GPA rows without duplicating existing codes. */
export function mergeCoursesIntoGpa(courses: Course[], synced: SyncedCourse[]): Course[] {
  const rows = new Map<string, Course>();
  for (const course of courses) rows.set(codeOf(course.code), course);
  for (const course of synced) {
    const code = codeOf(course.courseCode);
    if (!code || rows.has(code)) continue;
    const credits = course.creditHours ?? 3;
    const grade = course.grade && course.grade !== "in-progress" ? course.grade : null;
    rows.set(code, {
      id: `paste-${code}`,
      code,
      title: course.courseName ?? code,
      credits,
      semester: course.semester ?? "—",
      status: grade ? "completed" : "in-progress",
      ...(grade ? { grade: grade as Course["grade"] } : {}),
    });
  }
  return [...rows.values()];
}
