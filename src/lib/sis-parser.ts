/**
 * Resilient parser for text copied from sis.ejust.edu.eg.
 *
 * E-JUST renders two very different tables:
 *  - "Registered Courses" (Status = A means Approved, not a letter grade)
 *  - "Academic Transcript" (Grade cells are real letter grades)
 * The page text may contain header summaries and component rows (LEC/TUT/LAB)
 * for the same course, so parsing is line-by-line and deduplicates by code.
 */

export type SisCourseStatus = "registered" | "completed";
export type SisTableType = "registered" | "transcript" | "unknown";

export interface ParsedSisCourse {
  courseCode: string;
  courseName: string | null;
  creditHours: number | null;
  grade: string | null;
  semester: string | null;
  status: SisCourseStatus;
  /** Component/group labels such as `LEC`, `TUT`, `LAB S1 2-3`. */
  sections?: string[];
}

export interface SisSummaryMetadata {
  cgpa: number | null;
  passedCredits: number | null;
  registeredCredits: number | null;
  semester: string | null;
}

export interface SisParseResult {
  courses: ParsedSisCourse[];
  metadata: SisSummaryMetadata;
  tableType: SisTableType;
}

const COURSE_CODE_RE = /[A-Z]{2,4}\s*-?\s*\d{3}/g;
const GRADE_RE = /(?<![A-Z])(A\+|A-|A|B\+|B-|B|C\+|C-|C|D\+|D-|D|F|PASS|FAIL|CREDIT|ABSENT|INCOMPLETE)(?![A-Z])/i;
const CREDIT_RE = /\b([1-6](?:\.\d+)?)\s*(?:\(?\s*(?:cr|credits?|hrs?|hours?|ch)\s*\)?)?\b/i;
const SECTION_RE = /^(LEC|TUT|LAB|LECTURE|TUTORIAL|LABORATORY)\b\s*(.*)$/i;
const ACADEMIC_YEAR_TERM_RE = /\b(20\d{2})\s*\/\s*(20\d{2})\s*[-–—]?\s*(Fall|Spring|Summer)\b/i;
const SEMESTER_RE = /\b(Fall|Spring|Summer)\s*[-/]?\s*(20\d{2})\b/i;
const AR_SEMESTER_RE = /\(?(?:الفصل)\s*(الخريفي|الربيعي|الصيفي)\s*[-/]?\s*(20\d{2})\)?/;

const AR_TERM: Record<string, string> = {
  الخريفي: "Fall",
  الربيعي: "Spring",
  الصيفي: "Summer",
};

function titleCase(value: string): string {
  return `${value[0].toUpperCase()}${value.slice(1).toLowerCase()}`;
}

function normalizeCode(code: string): string {
  return code.replace(/[^A-Z0-9]/gi, "").toUpperCase();
}

/** Best-effort semester label shared by every row parsed from one page. */
export function detectSisSemester(raw: string): string | null {
  const academicYear = raw.match(ACADEMIC_YEAR_TERM_RE);
  if (academicYear) {
    return `${titleCase(academicYear[3])} ${academicYear[1]}/${academicYear[2]}`;
  }

  const latin = raw.match(SEMESTER_RE);
  if (latin) return `${titleCase(latin[1])} ${latin[2]}`;

  const arabic = raw.match(AR_SEMESTER_RE);
  if (arabic) return `${AR_TERM[arabic[1]]} ${arabic[2]}`;

  return null;
}

/**
 * Header-based table classification. Registration-specific headers win over a
 * generic "Grades" navigation label that may also be present on the page.
 */
export function detectSisTableType(raw: string): SisTableType {
  const text = raw.toLowerCase();
  const registered =
    /teaching\s+method/.test(text) ||
    /delete\s+section/.test(text) ||
    /reg\.?\s*approved/.test(text) ||
    (/status/.test(text) && (/payment/.test(text) || /fee\s*amount/.test(text)));
  if (registered) return "registered";

  if (/academic\s+transcript/.test(text) || /\btranscript\b/.test(text) || /\bgrades?\b/.test(text)) {
    return "transcript";
  }
  return "unknown";
}

function numericAfter(pattern: RegExp, raw: string): number | null {
  const match = raw.match(pattern);
  return match ? Number(match[1]) : null;
}

/** Official SIS header values, available before transcript rows are pasted. */
export function parseSisMetadata(raw: string): SisSummaryMetadata {
  return {
    cgpa: numericAfter(/\b(?:cgpa|gpa)\s*[:=]?\s*(\d+(?:\.\d+)?)/i, raw),
    passedCredits: numericAfter(/\btotal\s+passed\s+ch\s*[:=]?\s*(\d+(?:\.\d+)?)/i, raw),
    registeredCredits: numericAfter(/\bregistered\s+ch\s*[:=]?\s*(\d+(?:\.\d+)?)/i, raw),
    semester: detectSisSemester(raw),
  };
}

function normalizeGrade(value: string | undefined): string | null {
  if (!value) return null;
  const upper = value.toUpperCase();
  if (/^[A-F][+-]?$/.test(upper)) return upper;
  if (upper === "PASS" || upper === "CREDIT") return "P";
  if (upper === "FAIL" || upper === "ABSENT") return "F";
  return null;
}

/** Copied tables are usually tab- or pipe-delimited; space-only text stays one cell. */
function splitCells(value: string): string[] {
  return value
    .split(/\s*[|\t]\s*|\s{2,}/)
    .map((cell) => cell.trim())
    .filter(Boolean);
}

function cleanCourseName(value: string, code: string, stripGrade: boolean): string | null {
  const name = value.replace(code, " ").replace(/\s+/g, " ").trim();
  if (!name) return null;
  // Navigation labels and table headers are not course titles.
  if (/^(course|code|credit|hours|grade|term|semester|registered|transcript)\b/i.test(name)) return null;
  if (!stripGrade) return name.length > 120 ? name.slice(0, 120) : name;

  // Transcript tables sometimes append the grade to the title cell.
  const withoutGrade = name
    .replace(/\s+(A\+|A-|A|B\+|B-|B|C\+|C-|C|D\+|D-|D|F|PASS|FAIL|CREDIT|ABSENT|INCOMPLETE)\s*$/i, "")
    .trim();
  return withoutGrade.length > 120 ? withoutGrade.slice(0, 120) : withoutGrade;
}

function parseCredit(cells: string[], segment: string): number | null {
  // A copied CH cell is authoritative, including decimals such as `3.00`.
  const direct = cells.find(
    (cell) => /^\d{1,2}(?:\.\d+)?$/.test(cell) && Number(cell) >= 1 && Number(cell) <= 6
  );
  if (direct) return Number(direct);

  const decimal = segment.match(/\b([1-6]\.\d+)\b/);
  if (decimal && Number(decimal[1]) >= 1 && Number(decimal[1]) <= 6) return Number(decimal[1]);

  const explicit = segment.match(/\b([1-6])\s*(?:cr|credits?|hrs?|hours?|ch)\b/i)?.[1];
  return explicit ? Number(explicit) : Number(segment.match(CREDIT_RE)?.[1] ?? 0) || null;
}

function parseSections(cells: string[], segment: string): string[] {
  const candidates = cells.length > 0 ? cells : segment.trim().split(/\s+/);
  const sections: string[] = [];
  for (const candidate of candidates) {
    const match = candidate.trim().match(SECTION_RE);
    if (!match) continue;
    const section = `${match[1].toUpperCase()}${match[2] ? ` ${match[2].trim()}` : ""}`;
    if (!sections.includes(section)) sections.push(section);
  }
  return sections;
}

/** Headerless registration rows still end in a teaching method or payment flag. */
function rowLooksRegistered(cells: string[], segment: string): boolean {
  const candidates = cells.length > 0 ? cells : segment.trim().split(/\s+/);
  if (candidates.some((cell) => SECTION_RE.test(cell.trim()))) return true;
  const joined = candidates.join(" ");
  return /\b(yes|no)\b/i.test(joined) && /\b\d+(?:\.\d+)?\b/.test(joined);
}

function parseRow(row: string, semester: string | null, tableType: SisTableType): ParsedSisCourse[] {
  const matches = [...row.matchAll(COURSE_CODE_RE)];
  if (matches.length === 0) return [];

  const parsed: ParsedSisCourse[] = [];
  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const rawCode = match[0];
    const courseCode = normalizeCode(rawCode).replace(/^([A-Z]+)(\d{3})$/, "$1 $2");
    const nextIndex = matches[index + 1]?.index ?? row.length;
    const segment = row.slice((match.index ?? 0) + rawCode.length, nextIndex);
    const cells = splitCells(segment);
    const registered = tableType === "registered" || rowLooksRegistered(cells, segment);

    // Never turn a registration Status cell into a grade.
    const grade = registered ? null : normalizeGrade(segment.match(GRADE_RE)?.[1]);
    const sections = registered ? parseSections(cells, segment) : [];

    parsed.push({
      courseCode,
      courseName: cleanCourseName(cells[0] ?? segment, rawCode, !registered),
      creditHours: parseCredit(cells, segment),
      grade,
      semester,
      status: grade ? "completed" : "registered",
      ...(sections.length > 0 ? { sections } : {}),
    });
  }
  return parsed;
}

function mergeDuplicate(existing: ParsedSisCourse, incoming: ParsedSisCourse): ParsedSisCourse {
  const sections = [...(existing.sections ?? [])];
  for (const section of incoming.sections ?? []) {
    if (!sections.includes(section)) sections.push(section);
  }
  return {
    courseCode: existing.courseCode,
    courseName: existing.courseName ?? incoming.courseName,
    creditHours: existing.creditHours ?? incoming.creditHours,
    grade: existing.grade ?? incoming.grade,
    semester: existing.semester ?? incoming.semester,
    status: existing.grade || incoming.grade ? "completed" : "registered",
    ...(sections.length > 0 ? { sections } : {}),
  };
}

/**
 * Parse SIS page text into deduplicated courses, table classification and any
 * official header summary values.
 */
export function parseSisDocument(raw: string): SisParseResult {
  const tableType = detectSisTableType(raw);
  const metadata = parseSisMetadata(raw);
  const semester = metadata.semester;
  const seen = new Map<string, ParsedSisCourse>();

  for (const line of raw.split(/\r?\n/)) {
    const row = line.trim();
    if (!row) continue;
    for (const course of parseRow(row, semester, tableType)) {
      const key = `${normalizeCode(course.courseCode)}|${course.semester ?? ""}`;
      const existing = seen.get(key);
      seen.set(key, existing ? mergeDuplicate(existing, course) : course);
    }
  }

  return {
    courses: [...seen.values()].sort((a, b) => a.courseCode.localeCompare(b.courseCode)),
    metadata,
    tableType,
  };
}

/** Backwards-compatible helper for callers that only need course rows. */
export function parseSisText(raw: string): ParsedSisCourse[] {
  return parseSisDocument(raw).courses;
}
