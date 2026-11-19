/**
 * E-JUST faculty taxonomy for exams and announcements.
 *
 * The MCP-owned `exam` and `hub_announcement` tables have no faculty column, so
 * faculty is inferred from the course code when a row is mapped into the UI.
 */

export const FACULTIES = [
  "FOE",
  "CSIT",
  "FIBH",
  "FOP",
  "BAS",
  "FAD",
  "SHARED",
] as const;
export type Faculty = (typeof FACULTIES)[number];

/** Course-code prefixes owned by each faculty (three uppercase letters). */
export const FACULTY_PREFIXES: Record<Faculty, readonly string[]> = {
  FOE: ["ECE", "MEC", "MTR", "EEE", "MSE", "ENV", "ERE", "CBE", "CPE", "IPE", "IME", "BME", "ARC"],
  CSIT: ["CSC", "AID", "CNC", "BIF"],
  FIBH: ["ACC", "FIN", "MGT", "MKT", "ECO", "BUS", "HRM"],
  FOP: ["PHM", "PHC", "PCL", "PCE", "PHA", "BIO"],
  BAS: ["NAN", "BTC", "ACM", "EMT", "SPC", "SCI"],
  FAD: ["ART", "DES", "VIS", "GRD", "IND"],
  SHARED: ["MTH", "PHY", "CHM", "LRA", "HUM", "ENG", "JPN"],
};

const PREFIX_FACULTY: Record<string, Faculty> = Object.fromEntries(
  FACULTIES.flatMap((faculty) => FACULTY_PREFIXES[faculty].map((prefix) => [prefix, faculty]))
);

function normalized(value: string | null | undefined): string {
  return (value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Infer the owning faculty from a course code prefix; unknown codes are SHARED. */
export function inferFacultyFromCourseCode(code: string | null | undefined): Faculty {
  const value = normalized(code);
  if (value.length < 3) return "SHARED";
  return PREFIX_FACULTY[value.slice(0, 3)] ?? "SHARED";
}

/** True when the code starts with a recognized E-JUST department prefix. */
export function isKnownCoursePrefix(code: string | null | undefined): boolean {
  const value = normalized(code);
  return value.length >= 3 && PREFIX_FACULTY[value.slice(0, 3)] !== undefined;
}

/** Stable short label used by faculty badges and selectors. */
export function facultyLabel(faculty: Faculty): string {
  return faculty;
}

/** True when `value` is a supported E-JUST faculty code. */
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
