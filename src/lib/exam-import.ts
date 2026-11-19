/**
 * Exam text importer helpers.
 *
 * `parseExamText` is the deterministic CODE + Date + Time + Room fallback used
 * when AI extraction is unavailable. `normalizeImportedRows` sanitizes and
 * validates rows from either the AI parser or the regex fallback. The identity
 * used by `importedExamKey` mirrors `exam_intent_unique` in the MCP-owned exam
 * table so repeated imports are idempotent.
 */

export const IMPORT_EXAM_TYPES = ["MIDTERM", "FINAL", "QUIZ"] as const;
export type ImportedExamType = (typeof IMPORT_EXAM_TYPES)[number];

export interface ImportedExamRow {
  courseCode: string;
  examType: ImportedExamType;
  examDate: string;
  startTime: string;
  endTime: string;
  building: string;
  room: string;
}

type RawImportedRow = Record<string, unknown> | null | undefined;

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9,
  september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

function clean(value: unknown, max = 80): string {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function normalizeCode(value: unknown): string {
  return clean(value, 32).toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function normalizeTime(value: unknown, fallback: string): string {
  const match = clean(value, 20).match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return fallback;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return fallback;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function addOneHour(time: string): string {
  const [hours, minutes] = time.split(":").map(Number);
  return `${String((hours + 1) % 24).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function normalizeDate(value: unknown): string | null {
  const raw = clean(value, 40);
  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) return formatDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const numeric = raw.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/);
  if (numeric) return formatDate(Number(numeric[3]), Number(numeric[2]), Number(numeric[1]));
  const named = raw.match(/^(\d{1,2})\s+([A-Za-z]+)\.?\s+(\d{4})$/);
  if (named && MONTHS[named[2].toLowerCase()]) {
    return formatDate(Number(named[3]), MONTHS[named[2].toLowerCase()], Number(named[1]));
  }
  return null;
}

function formatDate(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date.toISOString().slice(0, 10);
}

function normalizeExamType(value: unknown): ImportedExamType {
  const text = clean(value, 30).toLowerCase().replace(/[^a-z]/g, "");
  if (text.includes("final")) return "FINAL";
  if (text.includes("quiz")) return "QUIZ";
  return "MIDTERM";
}

const COURSE_RE = /\b([A-Za-z]{3})\s*[-.]?\s*(\d{2,4})\b/;
// The word boundary stops "ECE201 Quiz 2026-12-15" from being read as the
// named date "01 Quiz 2026" before the ISO date is reached.
const DATE_RE = /(\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{4}|\b\d{1,2}\s+[A-Za-z]+\.?\s+\d{4})/;
const TIME_RE = /(\d{1,2}:\d{2}(?::\d{2})?)\s*(?:-|–|to)\s*(\d{1,2}:\d{2}(?::\d{2})?)|(\d{1,2}:\d{2}(?::\d{2})?)/i;

/** Deterministic fallback parser for schedule text pasted from email or LMS. */
export function parseExamText(text: string | null | undefined): ImportedExamRow[] {
  if (typeof text !== "string" || text.trim().length === 0) return [];

  const rows: ImportedExamRow[] = [];
  const seen = new Set<string>();

  for (const line of text.split(/\r?\n/)) {
    const course = line.match(COURSE_RE);
    const date = line.match(DATE_RE);
    const time = line.match(TIME_RE);
    if (!course || !date || !time) continue;

    const examDate = normalizeDate(date[1]);
    if (!examDate) continue;

    const startTime = normalizeTime(time[1] ?? time[4], "09:00");
    const endTime = normalizeTime(time[2], addOneHour(startTime));
    const buildingMatch = line.match(/\b(?:building|bldg)\s*[:#]?\s*([A-Za-z0-9]{1,8})\b/i);
    const roomMatch = line.match(/\b(?:room|hall)\s*[:#]?\s*([A-Za-z0-9]{1,12})\b/i);
    // Pipe-delimited tables often omit the "Building"/"Room" labels, so take
    // the last two cells as building/room when the row has enough columns.
    const cells = line.includes("|")
      ? line.split("|").map((cell) => clean(cell)).filter(Boolean)
      : [];
    const building = buildingMatch?.[1] ?? (cells.length >= 5 ? cells[4] : "TBA");
    const room = roomMatch?.[1] ?? (cells.length >= 6 ? cells[5] : "TBA");

    const row: ImportedExamRow = {
      courseCode: `${course[1].toUpperCase()}${course[2]}`,
      examType: normalizeExamType(line),
      examDate,
      startTime,
      endTime,
      building: clean(building, 40) || "TBA",
      room: clean(room, 40) || "TBA",
    };
    const key = importedExamKey(row);
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push(row);
  }

  return rows;
}

/** Sanitize and validate raw rows from an AI parser before showing or saving. */
export function normalizeImportedRows(rows: readonly RawImportedRow[]): ImportedExamRow[] {
  if (!Array.isArray(rows)) return [];
  const result: ImportedExamRow[] = [];
  const seen = new Set<string>();

  for (const value of rows) {
    if (!value || typeof value !== "object") continue;
    const courseCode = normalizeCode(value.courseCode);
    const examDate = normalizeDate(value.examDate);
    if (!courseCode || !examDate) continue;

    const startTime = normalizeTime(value.startTime, "09:00");
    const row: ImportedExamRow = {
      courseCode,
      examType: normalizeExamType(value.examType),
      examDate,
      startTime,
      endTime: normalizeTime(value.endTime, addOneHour(startTime)),
      building: clean(value.building, 80) || "TBA",
      room: clean(value.room, 80) || "TBA",
    };
    const key = importedExamKey(row);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(row);
  }

  return result;
}

/** Mirrors `exam_intent_unique`: building and room are not part of identity. */
export function importedExamKey(row: ImportedExamRow): string {
  return [row.courseCode, row.examType, row.examDate, row.startTime, row.endTime].join("|");
}
