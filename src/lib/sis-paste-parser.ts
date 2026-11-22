/**
 * Resilient, dependency-free parser for plain text copied from E-JUST SIS
 * pages. It is intentionally conservative: a row is only consumed when it has
 * a course code plus an unambiguous signal (credit, grade, time slot or exam
 * date). Ambiguous fields are left null rather than guessed.
 */

export type SisPasteGrade =
  | "A+"
  | "A"
  | "B+"
  | "B"
  | "C+"
  | "C"
  | "D+"
  | "D"
  | "F"
  | "in-progress";

export type SisPasteDay = "Sun" | "Mon" | "Tue" | "Wed" | "Thu";
export type SisPasteExamType = "Final" | "Midterm" | "Quiz" | "Project" | "Exam";

export interface ParsedPasteCourse {
  courseCode: string;
  courseName: string | null;
  creditHours: number | null;
  grade: SisPasteGrade | null;
  semester: string | null;
}

export interface ParsedPasteClass {
  courseCode: string;
  day: SisPasteDay;
  start: string;
  end: string;
  room: string | null;
}

export interface ParsedPasteExam {
  courseCode: string;
  title: string;
  type: SisPasteExamType;
  date: string;
  time: string | null;
  room: string | null;
}

export interface SisPasteParseResult {
  courses: ParsedPasteCourse[];
  classes: ParsedPasteClass[];
  exams: ParsedPasteExam[];
}

const EMPTY_RESULT: SisPasteParseResult = { courses: [], classes: [], exams: [] };

const COURSE_CODE_RE = /\b([A-Z]{2,5})\s*-?\s*(\d{3})([A-Z]?)\b/gi;
const CREDIT_RE = /\b([1-6](?:\.\d+)?)\b/g;
const LETTER_GRADE_RE = /(?<![A-Za-z0-9+])(A\+|B\+|C\+|D\+|A|B|C|D|F)(?![A-Za-z0-9+-])/g;
const IN_PROGRESS_RE = /\b(?:in[\s-]*progress|registered|ongoing|ip)\b/i;
const TIME_RE = /(?<![0-9])(\d{1,2}):([0-5]\d)\s*(AM|PM)?/gi;
const ROOM_RE = /\b(?:room|hall|lab|rm)\s*[:#]?\s*([A-Za-z0-9][A-Za-z0-9\-/]*)/i;
const SEMESTER_RE = /\b(Fall|Spring|Summer)\s*[-/]?\s*(20\d{2})\b/i;
const ISO_DATE_RE = /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/;
const DMY_DATE_RE = /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/;
const EXAM_WORD_RE = /\b(?:final|midterm|quiz|project|exam)\b/i;

const DAY_ALIASES: Array<[string, SisPasteDay]> = [
  ["sunday", "Sun"],
  ["sun", "Sun"],
  ["الأحد", "Sun"],
  ["أحد", "Sun"],
  ["monday", "Mon"],
  ["mon", "Mon"],
  ["الاثنين", "Mon"],
  ["الأثنين", "Mon"],
  ["tuesday", "Tue"],
  ["tues", "Tue"],
  ["tue", "Tue"],
  ["الثلاثاء", "Tue"],
  ["wednesday", "Wed"],
  ["wed", "Wed"],
  ["الأربعاء", "Wed"],
  ["thursday", "Thu"],
  ["thurs", "Thu"],
  ["thur", "Thu"],
  ["thu", "Thu"],
  ["الخميس", "Thu"],
];

const DAY_RE = new RegExp(
  `(?:^|[^\\p{L}])(?<day>${DAY_ALIASES.map(([alias]) => alias).join("|")})(?=$|[^\\p{L}])`,
  "iu",
);

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function normalizeCode(code: string): string {
  return code.replace(/[^A-Z0-9]/gi, "").toUpperCase();
}

function findCodes(line: string): string[] {
  const codes = new Set<string>();
  for (const match of line.matchAll(COURSE_CODE_RE)) {
    const code = normalizeCode(`${match[1]}${match[2]}${match[3] ?? ""}`);
    if (code) codes.add(code);
  }
  return [...codes];
}

function findDay(line: string): SisPasteDay | null {
  const match = DAY_RE.exec(line);
  if (!match?.groups?.day) return null;
  const key = match.groups.day.toLowerCase();
  return DAY_ALIASES.find(([alias]) => alias === key)?.[1] ?? null;
}

function normalizeTime(
  hourText: string,
  minuteText: string,
  meridiem: string | undefined,
): string | null {
  let hours = Number(hourText);
  const minutes = Number(minuteText);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
  const suffix = meridiem?.toUpperCase();
  if (suffix === "PM" && hours < 12) hours += 12;
  if (suffix === "AM" && hours === 12) hours = 0;
  if (hours < 0 || hours > 23) return null;
  return `${pad2(hours)}:${pad2(minutes)}`;
}

interface TimeToken {
  value: string;
  meridiem: string | undefined;
}

function findTimes(line: string): TimeToken[] {
  const matches = [...line.matchAll(TIME_RE)];
  const tokens: TimeToken[] = [];
  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    let meridiem = match[3];
    // "8:00 - 9:00 AM": the final suffix also qualifies the first time.
    if (!meridiem && index + 1 < matches.length) meridiem = matches[index + 1][3];
    const value = normalizeTime(match[1], match[2], meridiem);
    if (value) tokens.push({ value, meridiem });
    if (tokens.length >= 2) break;
  }
  return tokens;
}

function findRoom(line: string): string | null {
  return ROOM_RE.exec(line)?.[1] ?? null;
}

function findDate(line: string): string | null {
  const iso = ISO_DATE_RE.exec(line);
  if (iso) {
    const [, year, month, day] = iso;
    if (Number(month) >= 1 && Number(month) <= 12 && Number(day) >= 1 && Number(day) <= 31) {
      return `${year}-${pad2(Number(month))}-${pad2(Number(day))}`;
    }
  }
  const dmy = DMY_DATE_RE.exec(line);
  if (dmy) {
    const [, day, month, year] = dmy;
    if (Number(month) >= 1 && Number(month) <= 12 && Number(day) >= 1 && Number(day) <= 31) {
      return `${year}-${pad2(Number(month))}-${pad2(Number(day))}`;
    }
  }
  return null;
}

function findExamType(line: string): SisPasteExamType {
  if (/\bfinal\b/i.test(line)) return "Final";
  if (/\bmidterm\b/i.test(line)) return "Midterm";
  if (/\bquiz\b/i.test(line)) return "Quiz";
  if (/\bproject\b/i.test(line)) return "Project";
  return "Exam";
}

function findGrade(lineWithoutCodes: string): SisPasteGrade | null {
  const grades = new Set<string>();
  for (const match of lineWithoutCodes.matchAll(LETTER_GRADE_RE)) {
    grades.add(match[1].toUpperCase());
  }
  if (grades.size > 1) return null; // Ambiguous: refuse to guess.
  if (grades.size === 1) return grades.values().next().value as SisPasteGrade;
  if (IN_PROGRESS_RE.test(lineWithoutCodes)) return "in-progress";
  return null;
}

function findCredits(lineWithoutCodes: string): number | null {
  const credits = [...lineWithoutCodes.matchAll(CREDIT_RE)]
    .map((match) => Number(match[1]))
    .filter((value) => Number.isFinite(value) && value > 0 && value <= 6);
  return credits.length === 1 ? credits[0] : null;
}

function findCourseName(lineWithoutCodes: string): string | null {
  const credit = [...lineWithoutCodes.matchAll(CREDIT_RE)][0];
  const grade = [...lineWithoutCodes.matchAll(LETTER_GRADE_RE)][0];
  const markers = [credit?.index, grade?.index, IN_PROGRESS_RE.exec(lineWithoutCodes)?.index]
    .filter((index): index is number => typeof index === "number" && index >= 0);
  const end = markers.length > 0 ? Math.min(...markers) : lineWithoutCodes.length;
  const name = lineWithoutCodes
    .slice(0, end)
    .replace(/[-–—:,|]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return name || null;
}

function mergeCourse(existing: ParsedPasteCourse, incoming: ParsedPasteCourse): ParsedPasteCourse {
  return {
    courseCode: existing.courseCode,
    courseName: existing.courseName ?? incoming.courseName,
    creditHours: existing.creditHours ?? incoming.creditHours,
    grade: existing.grade ?? incoming.grade,
    semester: existing.semester ?? incoming.semester,
  };
}

/** Parse a whole copied SIS page. Empty or unrecognisable input is safe. */
export function parseSisPaste(raw: unknown): SisPasteParseResult {
  if (typeof raw !== "string" || !raw.trim()) return EMPTY_RESULT;

  const semester = SEMESTER_RE.exec(raw)?.[0]?.replace(/\s+/g, " ") ?? null;
  const courses = new Map<string, ParsedPasteCourse>();
  const classes = new Map<string, ParsedPasteClass>();
  const exams = new Map<string, ParsedPasteExam>();

  for (const sourceLine of raw.replace(/\r\n?/g, "\n").split("\n")) {
    const line = sourceLine.replace(/\s+/g, " ").trim();
    const codes = findCodes(line);
    if (codes.length === 0) continue;

    const date = findDate(line);
    if (date && EXAM_WORD_RE.test(line)) {
      const type = findExamType(line);
      const times = findTimes(line);
      for (const courseCode of codes) {
        const key = `${courseCode}|${date}|${type}`;
        if (exams.has(key)) continue;
        exams.set(key, {
          courseCode,
          title: `${type} Exam`,
          type,
          date,
          time: times[0]?.value ?? null,
          room: findRoom(line),
        });
      }
      continue;
    }

    const day = findDay(line);
    const times = findTimes(line);
    if (day && times.length >= 2) {
      for (const courseCode of codes) {
        const key = `${courseCode}|${day}|${times[0].value}`;
        if (classes.has(key)) continue;
        classes.set(key, {
          courseCode,
          day,
          start: times[0].value,
          end: times[1].value,
          room: findRoom(line),
        });
      }
      continue;
    }

    const withoutCodes = line.replace(COURSE_CODE_RE, " ").replace(/\s+/g, " ").trim();
    const grade = findGrade(withoutCodes);
    const creditHours = findCredits(withoutCodes);
    if (!grade && creditHours === null) continue;
    for (const courseCode of codes) {
      const incoming: ParsedPasteCourse = {
        courseCode,
        courseName: findCourseName(withoutCodes),
        creditHours,
        grade,
        semester,
      };
      const existing = courses.get(courseCode);
      courses.set(courseCode, existing ? mergeCourse(existing, incoming) : incoming);
    }
  }

  return {
    courses: [...courses.values()],
    classes: [...classes.values()],
    exams: [...exams.values()],
  };
}
