export const GRADE_POINTS = {
  "A+": 4.0,
  A: 3.7,
  "B+": 3.3,
  B: 3.0,
  "C+": 2.7,
  C: 2.3,
  "D+": 2.0,
  D: 1.7,
  F: 0.0,
} as const;

export type LetterGrade = keyof typeof GRADE_POINTS;
export const GRADE_OPTIONS = Object.keys(GRADE_POINTS) as LetterGrade[];

export type CourseStatus = "completed" | "in-progress" | "planned";

export interface Course {
  id: string;
  code: string;
  title: string;
  credits: number;
  semester: string;
  status: CourseStatus;
  grade?: LetterGrade;
  expectedGrade?: LetterGrade;
}

export interface GpaData {
  courses: Course[];
  targetGpa: number;
  degreeCredits: number;
}

/** A fresh student starts with no courses until they sync or add one. */
export const EMPTY_GPA_DATA: GpaData = {
  courses: [],
  targetGpa: 3.5,
  degreeCredits: 160,
};

const DEMO_COURSE_ID = /^s([1-9]|1[0-6])$/;
const COURSE_STATUSES: CourseStatus[] = ["completed", "in-progress", "planned"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCourse(value: unknown): value is Course {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.code === "string" &&
    typeof value.title === "string" &&
    typeof value.credits === "number" &&
    Number.isFinite(value.credits) &&
    typeof value.semester === "string" &&
    COURSE_STATUSES.includes(value.status as CourseStatus)
  );
}

export function isDemoCourseId(id: string): boolean {
  return DEMO_COURSE_ID.test(id);
}

/** Drop the retired demo courses and repair malformed persisted GPA data. */
export function sanitizeGpaData(value: unknown): GpaData | null {
  if (!isRecord(value)) return null;

  const courses = Array.isArray(value.courses)
    ? value.courses.filter(isCourse).filter((course) => !isDemoCourseId(course.id))
    : [];
  const targetGpa =
    typeof value.targetGpa === "number" && Number.isFinite(value.targetGpa)
      ? Math.min(4, Math.max(0, value.targetGpa))
      : EMPTY_GPA_DATA.targetGpa;
  const degreeCredits =
    typeof value.degreeCredits === "number" &&
    Number.isFinite(value.degreeCredits) &&
    value.degreeCredits > 0
      ? value.degreeCredits
      : EMPTY_GPA_DATA.degreeCredits;

  return { courses, targetGpa, degreeCredits };
}

export interface NeededGpaResult {
  neededGpa: number | null;
  remainingCredits: number;
  achievable: boolean;
}

/**
 * Average needed over the rest of the degree, not only the courses already
 * scheduled: ((target × degree) − (current × completed)) / remaining.
 */
export function computeNeededGpa(
  currentGpa: number | null,
  completedCredits: number,
  degreeCredits: number,
  targetGpa: number,
): NeededGpaResult {
  const remainingCredits = Math.max(0, degreeCredits - completedCredits);

  if (remainingCredits <= 0) {
    return {
      neededGpa: null,
      remainingCredits: 0,
      achievable: (currentGpa ?? 0) >= targetGpa,
    };
  }

  const rawNeeded =
    (targetGpa * degreeCredits - (currentGpa ?? 0) * completedCredits) /
    remainingCredits;

  return {
    neededGpa: Math.max(0, rawNeeded),
    remainingCredits,
    achievable: rawNeeded <= 4.0,
  };
}

export interface GpaStats {
  completedCredits: number;
  completedPoints: number;
  currentGpa: number | null;
  inProgressCredits: number;
  plannedCredits: number;
  /** Credits still needed to complete the degree. */
  remainingCredits: number;
  totalCredits: number;
  forecastGpa: number | null;
  /** Average needed across all remaining degree credits to hit target */
  requiredAverage: number | null;
  achievable: boolean;
}

export function computeStats(
  courses: Course[],
  targetGpa: number,
  degreeCredits = EMPTY_GPA_DATA.degreeCredits,
): GpaStats {
  let completedCredits = 0;
  let completedPoints = 0;
  let inProgressCredits = 0;
  let plannedCredits = 0;
  let forecastPoints = 0;
  let forecastCredits = 0;

  for (const c of courses) {
    const credits = Math.max(0, c.credits);
    if (c.status === "completed" && c.grade) {
      completedCredits += credits;
      completedPoints += GRADE_POINTS[c.grade] * credits;
      forecastPoints += GRADE_POINTS[c.grade] * credits;
      forecastCredits += credits;
    } else if (c.status === "in-progress") {
      inProgressCredits += credits;
      if (c.expectedGrade) {
        forecastPoints += GRADE_POINTS[c.expectedGrade] * credits;
        forecastCredits += credits;
      }
    } else if (c.status === "planned") {
      plannedCredits += credits;
    }
  }

  const currentGpa = completedCredits > 0 ? completedPoints / completedCredits : null;
  const forecastGpa = forecastCredits > 0 ? forecastPoints / forecastCredits : null;
  const needed = computeNeededGpa(
    currentGpa,
    completedCredits,
    degreeCredits,
    targetGpa,
  );

  return {
    completedCredits,
    completedPoints,
    currentGpa,
    inProgressCredits,
    plannedCredits,
    remainingCredits: needed.remainingCredits,
    totalCredits: degreeCredits,
    forecastGpa,
    requiredAverage: needed.neededGpa,
    achievable: needed.achievable,
  };
}

export interface SemesterPoint {
  semester: string;
  semesterGpa: number | null;
  /** Null for semesters without a graded/expected course, so the chart skips the point. */
  cumulativeGpa: number | null;
}

/** Per-semester GPA (graded + expected) and running cumulative GPA, ordered by first appearance. */
export function semesterSeries(courses: Course[]): SemesterPoint[] {
  const order: string[] = [];
  const bySemester = new Map<string, Course[]>();
  for (const c of courses) {
    if (!bySemester.has(c.semester)) {
      bySemester.set(c.semester, []);
      order.push(c.semester);
    }
    bySemester.get(c.semester)!.push(c);
  }

  let points = 0;
  let credits = 0;
  return order.map((semester) => {
    let semPoints = 0;
    let semCredits = 0;
    for (const c of bySemester.get(semester)!) {
      const grade =
        c.status === "completed" ? c.grade : c.status === "in-progress" ? c.expectedGrade : undefined;
      if (!grade) continue;
      const cr = Math.max(0, c.credits);
      semPoints += GRADE_POINTS[grade] * cr;
      semCredits += cr;
    }
    points += semPoints;
    credits += semCredits;
    const hasGrades = semCredits > 0 && credits > 0;
    return {
      semester,
      semesterGpa: semCredits > 0 ? semPoints / semCredits : null,
      cumulativeGpa: hasGrades ? points / credits : null,
    };
  });
}

export function formatGpa(value: number | null): string {
  return value === null ? "—" : value.toFixed(2);
}
