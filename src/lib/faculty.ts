/**
 * E-JUST faculty taxonomy for exams and announcements.
 *
 * The MCP-owned `exam` and `hub_announcement` tables have no faculty column, so
 * faculty is inferred from the course code when a row is mapped into the UI.
 */

export const FACULTIES = ["CSIT", "FOE", "FIBH", "SHARED"] as const;
export type Faculty = (typeof FACULTIES)[number];

const PREFIX_FACULTY: Record<string, Faculty> = {
  // Computer Science & Information Technology
  CSC: "CSIT",
  AID: "CSIT",
  CNC: "CSIT",
  BIF: "CSIT",
  // Faculty of Engineering
  ECE: "FOE",
  MEC: "FOE",
  EEE: "FOE",
  MSE: "FOE",
  ENV: "FOE",
  CBE: "FOE",
  IPE: "FOE",
  ARC: "FOE",
  // Faculty of Business & Humanities
  ACC: "FIBH",
  FIN: "FIBH",
  MGT: "FIBH",
  MKT: "FIBH",
  ECO: "FIBH",
  BUS: "FIBH",
  HRM: "FIBH",
  // Shared / service departments
  MTH: "SHARED",
  PHY: "SHARED",
  CHM: "SHARED",
  LRA: "SHARED",
  HUM: "SHARED",
  ENG: "SHARED",
};

function normalized(value: string | null | undefined): string {
  return (value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Infer the owning faculty from a course code prefix; unknown codes are SHARED. */
export function inferFacultyFromCourseCode(code: string | null | undefined): Faculty {
  const value = normalized(code);
  if (value.length < 3) return "SHARED";
  return PREFIX_FACULTY[value.slice(0, 3)] ?? "SHARED";
}

/** Stable short label used by faculty badges and selectors. */
export function facultyLabel(faculty: Faculty): string {
  return faculty;
}

/** True when `value` is one of the four supported faculty codes. */
export function isFaculty(value: unknown): value is Faculty {
  return FACULTIES.includes(normalized(value as string | null | undefined) as Faculty);
}

/** Tag exam-shaped rows with the faculty inferred from each course code. */
export function tagExamsWithFaculty<T>(
  exams: readonly T[],
  courseCodeOf: (exam: T) => string
): (T & { faculty: Faculty })[] {
  return exams.map((exam) => ({
    ...exam,
    faculty: inferFacultyFromCourseCode(courseCodeOf(exam)),
  }));
}

/**
 * Tag notice-shaped rows: an explicit target faculty wins, otherwise the
 * faculty is inferred from the notice's course code.
 */
export function tagNoticesWithFaculty<
  T extends { readonly targetFaculty: string; readonly courseCode: string },
>(notices: readonly T[]): (T & { faculty: Faculty })[] {
  return notices.map((notice) => ({
    ...notice,
    faculty: isFaculty(notice.targetFaculty)
      ? (normalized(notice.targetFaculty) as Faculty)
      : inferFacultyFromCourseCode(notice.courseCode),
  }));
}
