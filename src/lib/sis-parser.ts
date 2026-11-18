/**
 * Resilient parser for text copied from sis.ejust.edu.eg.
 *
 * E-JUST pages render course tables in different shapes depending on the
 * browser and on whether you are on "Registered Courses" or the "Academic
 * Transcript". This parser therefore works line-by-line, tolerates tab- and
 * space-separated cells, and never assumes a fixed column count.
 */

export type SisCourseStatus = "registered" | "completed";

export interface ParsedSisCourse {
  courseCode: string;
  courseName: string | null;
  creditHours: number | null;
  grade: string | null;
  semester: string | null;
  status: SisCourseStatus;
}

const COURSE_CODE_RE = /[A-Z]{2,4}\s*-?\s*\d{3}/g;
const GRADE_RE = /(?<![A-Z])(A\+|A-|A|B\+|B-|B|C\+|C-|C|D\+|D-|D|F|PASS|FAIL|CREDIT|ABSENT|INCOMPLETE)(?![A-Z])/i;
const CREDIT_RE = /\b([1-4])\s*(?:\(?\s*(?:cr|credits?|hrs?|hours?)\s*\)?)?\b/i;
const SEMESTER_RE = /\b(Fall|Spring|Summer)\s*[-/]?\s*(20\d{2})\b/i;
const AR_SEMESTER_RE = /\(?(?:الفصل|الفصل)\s*(الخريفي|الربيعي|الصيفي)\s*[-/]?\s*(20\d{2})\)?/;

const AR_TERM: Record<string, string> = {
  الخريفي: "Fall",
  الربيعي: "Spring",
  الصيفي: "Summer",
};

/** Best-effort semester label shared by every row parsed from one page. */
export function detectSisSemester(raw: string): string | null {
  const latin = raw.match(SEMESTER_RE);
  if (latin) return `${latin[1][0].toUpperCase()}${latin[1].slice(1).toLowerCase()} ${latin[2]}`;

  const arabic = raw.match(AR_SEMESTER_RE);
  if (arabic) return `${AR_TERM[arabic[1]]} ${arabic[2]}`;

  return null;
}

function normalizeGrade(value: string | undefined): string | null {
  if (!value) return null;
  const upper = value.toUpperCase();
  if (/^[A-F][+-]?$/.test(upper)) return upper;
  if (upper === "PASS" || upper === "CREDIT") return "P";
  if (upper === "FAIL" || upper === "ABSENT") return "F";
  return null;
}

function cleanCourseName(value: string, code: string): string | null {
  let name = value
    .replace(code, " ")
    .replace(/[\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!name) return null;
  // Navigation labels and table headers are not course titles.
  if (/^(course|code|credit|hours|grade|term|semester|registered|transcript)\b/i.test(name)) return null;
  // Tables often append the grade and credit cells to the title cell.
  name = name
    .replace(/\s+(A\+|A-|A|B\+|B-|B|C\+|C-|C|D\+|D-|D|F|PASS|FAIL|CREDIT|ABSENT|INCOMPLETE)\s*$/i, "")
    .replace(/\s+[1-4]\s*$/, "")
    .trim();
  return name.length > 120 ? name.slice(0, 120) : name;
}

function parseRow(row: string, semester: string | null): ParsedSisCourse[] {
  const matches = [...row.matchAll(COURSE_CODE_RE)];
  if (matches.length === 0) return [];

  const parsed: ParsedSisCourse[] = [];
  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const rawCode = match[0];
    const courseCode = rawCode.replace(/\s+/g, " ").replace(/\s*-\s*/, " ").toUpperCase();
    const nextIndex = matches[index + 1]?.index ?? row.length;
    const cell = row.slice((match.index ?? 0) + rawCode.length, nextIndex);

    const grade = normalizeGrade(cell.match(GRADE_RE)?.[1]);
    // Prefer an explicit credit label; otherwise accept a small standalone
    // integer in the row (the three-digit course number is already consumed).
    const explicitCredit = cell.match(/\b([1-4])\s*(?:cr|credits?|hrs?|hours?)\b/i)?.[1];
    const looseCredit = cell.match(CREDIT_RE)?.[1];
    const creditHours = explicitCredit ?? looseCredit;

    parsed.push({
      courseCode,
      courseName: cleanCourseName(cell, rawCode),
      creditHours: creditHours ? Number(creditHours) : null,
      grade,
      semester,
      status: grade ? "completed" : "registered",
    });
  }
  return parsed;
}

function mergeDuplicate(existing: ParsedSisCourse, incoming: ParsedSisCourse): ParsedSisCourse {
  return {
    courseCode: existing.courseCode,
    courseName: existing.courseName ?? incoming.courseName,
    creditHours: existing.creditHours ?? incoming.creditHours,
    grade: existing.grade ?? incoming.grade,
    semester: existing.semester ?? incoming.semester,
    status: existing.grade || incoming.grade ? "completed" : "registered",
  };
}

/**
 * Extract deduplicated course rows from raw text copied from the SIS.
 * Navigation labels, headers, and lines without an E-JUST course code are
 * ignored. A row with a grade is `completed`; one without is `registered`.
 */
export function parseSisText(raw: string): ParsedSisCourse[] {
  const semester = detectSisSemester(raw);
  const seen = new Map<string, ParsedSisCourse>();

  for (const line of raw.split(/\r?\n/)) {
    const row = line.trim();
    if (!row) continue;
    for (const course of parseRow(row, semester)) {
      const key = `${course.courseCode}|${course.semester ?? ""}`;
      const existing = seen.get(key);
      seen.set(key, existing ? mergeDuplicate(existing, course) : course);
    }
  }

  return [...seen.values()].sort((a, b) => a.courseCode.localeCompare(b.courseCode));
}
