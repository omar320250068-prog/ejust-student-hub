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

export interface GpaStats {
  completedCredits: number;
  completedPoints: number;
  currentGpa: number | null;
  inProgressCredits: number;
  plannedCredits: number;
  remainingCredits: number;
  totalCredits: number;
  forecastGpa: number | null;
  /** Average needed across remaining (in-progress + planned) credits to hit target */
  requiredAverage: number | null;
  achievable: boolean;
}

export function computeStats(courses: Course[], targetGpa: number): GpaStats {
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

  const remainingCredits = inProgressCredits + plannedCredits;
  const totalCredits = completedCredits + remainingCredits;

  const currentGpa = completedCredits > 0 ? completedPoints / completedCredits : null;
  const forecastGpa = forecastCredits > 0 ? forecastPoints / forecastCredits : null;

  let requiredAverage: number | null = null;
  let achievable = true;
  if (remainingCredits > 0) {
    requiredAverage =
      (targetGpa * totalCredits - completedPoints) / remainingCredits;
    achievable = requiredAverage <= 4.0;
    if (requiredAverage < 0) requiredAverage = 0;
  }

  return {
    completedCredits,
    completedPoints,
    currentGpa,
    inProgressCredits,
    plannedCredits,
    remainingCredits,
    totalCredits,
    forecastGpa,
    requiredAverage,
    achievable,
  };
}

export interface SemesterPoint {
  semester: string;
  semesterGpa: number | null;
  cumulativeGpa: number;
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
    return {
      semester,
      semesterGpa: semCredits > 0 ? semPoints / semCredits : null,
      cumulativeGpa: credits > 0 ? points / credits : 0,
    };
  });
}

export function formatGpa(value: number | null): string {
  return value === null ? "—" : value.toFixed(2);
}
