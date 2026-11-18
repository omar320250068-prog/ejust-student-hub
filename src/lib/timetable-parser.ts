/**
 * Deterministic parser for the coordinate-tagged Fall 2026 timetable grid.
 *
 * PDF geometry is extracted by `scripts/extract_timetable_cells.py`; this
 * module owns the interpretation: which column/slot a rectangle belongs to,
 * how merged cells fan out across sections, and how cell text becomes meetings.
 */

export type MeetingType = "LECTURE" | "LAB" | "TUTORIAL";
export type ScheduleDay = "SATURDAY" | "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY";

export interface RawWord {
  text: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface RawCell {
  rect: { x0: number; y0: number; x1: number; y1: number };
  words: RawWord[];
  lines: string[];
}

export interface Column {
  key: string;
  year: 1 | 2 | 3 | 4;
  group: string | null;
  track: "CNC" | "AID" | "CSC" | "BIF" | null;
  section: string;
  x0: number;
  x1: number;
}

export interface ParsedMeeting {
  /** Stable column identity, used as the dedupe and upsert group key. */
  columnKey: string;
  courseCode: string;
  title: string;
  meetingType: MeetingType;
  year: 1 | 2 | 3 | 4;
  group: string | null;
  track: "CNC" | "AID" | "CSC" | "BIF" | null;
  section: string;
  sectionLabel: string;
  day: ScheduleDay;
  startTime: string;
  endTime: string;
  building: string | null;
  room: string | null;
  instructor: string | null;
  academicYear: string;
  semester: string;
}

export interface ParsedSegment {
  courseCode: string;
  title: string;
  meetingType: MeetingType;
  building: string | null;
  room: string | null;
  instructor: string | null;
}

const YEAR_LABEL: Record<Column["year"], string> = {
  1: "1st Year",
  2: "2nd Year",
  3: "3rd Year",
  4: "4th Year",
};

const SLOT_TIMES = [
  ["09:00", "09:45"],
  ["09:45", "10:30"],
  ["10:45", "11:30"],
  ["11:30", "12:15"],
  ["12:30", "13:15"],
  ["13:15", "14:00"],
  ["14:15", "15:00"],
  ["15:00", "15:45"],
] as const;

// The PDF labels the first band "Sunday"; the published schedule is Sat-Thu.
const DAY_BANDS: { day: ScheduleDay; boundaries: number[] }[] = [
  { day: "SATURDAY", boundaries: [603.3, 740.8, 868.4, 979.7, 1090.9, 1202.2, 1313.5, 1424.8, 1536.0] },
  { day: "MONDAY", boundaries: [1646.2, 1807.7, 1974.6, 2085.8, 2259.3, 2448.0, 2589.8, 2701.1, 2812.4] },
  { day: "TUESDAY", boundaries: [2922.6, 3106.9, 3249.8, 3405.8, 3579.3, 3690.6, 3801.8, 3913.1, 4024.4] },
  { day: "WEDNESDAY", boundaries: [4134.6, 4358.2, 4541.5, 4729.1, 4872.0, 5062.9, 5174.2, 5308.4, 5419.7] },
  { day: "THURSDAY", boundaries: [5529.8, 5642.2, 5753.5, 5864.8, 5976.0, 6087.3, 6198.6, 6309.8, 6421.1] },
];

function columns(bounds: number[], make: (index: number) => Omit<Column, "x0" | "x1">): Column[] {
  return bounds.slice(0, -1).map((x0, index) => ({ ...make(index), x0, x1: bounds[index + 1] }));
}

const TRACK_ORDER: ("CNC" | "AID" | "CSC" | "BIF")[] = [
  "CNC", "CNC", "CNC",
  "AID", "AID", "AID", "AID",
  "CSC", "BIF",
];
const TRACK_SECTIONS = [1, 2, 3, 1, 2, 3, 4, 1, 1];

function trackColumn(year: 3 | 4, index: number): Omit<Column, "x0" | "x1"> {
  const track = TRACK_ORDER[index];
  const section = String(TRACK_SECTIONS[index]);
  return { key: `Y${year}${track}S${section}`, year, group: null, track, section };
}

export const TIMETABLE_COLUMNS: Column[] = [
  ...columns([274.9, 441.8, 607.6, 773.5, 961.1, 1157.5], (index) => ({
    key: `Y1G${index < 3 ? 1 : 2}S${index + 1}`,
    year: 1,
    group: index < 3 ? "Group 1" : "Group 2",
    track: null,
    section: String(index + 1),
  })),
  ...columns(
    [1294.9, 1461.8, 1627.6, 1793.5, 1981.1, 2146.9, 2312.7, 2478.5, 2644.4, 2810.2, 2976.0, 3141.8, 3307.6],
    (index) => ({
      key: `Y2G${Math.floor(index / 3) + 1}S${index + 1}`,
      year: 2,
      group: `Group ${Math.floor(index / 3) + 1}`,
      track: null,
      section: String(index + 1),
    })
  ),
  ...columns([3450.5, 3615.3, 3778.9, 3942.5, 4084.4, 4226.2, 4368.0, 4509.8, 4660.4, 4778.2], (index) =>
    trackColumn(3, index)
  ),
  ...columns([4921.1, 5079.3, 5236.4, 5393.5, 5576.7, 5733.8, 5890.9, 6048.0, 6242.2, 6399.3], (index) =>
    trackColumn(4, index)
  ),
];

export function describeColumn(column: Column): string {
  const axis = column.track ?? column.group ?? "General";
  return `${YEAR_LABEL[column.year]} · ${axis} · Section ${column.section}`;
}

function wordCenterY(word: RawWord): number {
  return (word.y0 + word.y1) / 2;
}

function columnsForCell(rect: RawCell["rect"]): Column[] {
  const found = TIMETABLE_COLUMNS.filter((column) => {
    const center = (column.x0 + column.x1) / 2;
    return center >= rect.x0 && center <= rect.x1;
  });
  if (found.length > 0) return found;
  const cellCenter = (rect.x0 + rect.x1) / 2;
  return TIMETABLE_COLUMNS.filter((column) => cellCenter >= column.x0 && cellCenter <= column.x1);
}

interface SlotRef {
  day: ScheduleDay;
  index: number;
}

function slotsForCell(rect: RawCell["rect"]): SlotRef[] {
  const slots: SlotRef[] = [];
  for (const band of DAY_BANDS) {
    for (let index = 0; index < SLOT_TIMES.length; index += 1) {
      const middle = (band.boundaries[index] + band.boundaries[index + 1]) / 2;
      if (middle >= rect.y0 && middle <= rect.y1) slots.push({ day: band.day, index });
    }
  }
  return slots;
}

function slotAtY(y: number): SlotRef | null {
  for (const band of DAY_BANDS) {
    for (let index = 0; index < SLOT_TIMES.length; index += 1) {
      if (y >= band.boundaries[index] - 3 && y <= band.boundaries[index + 1] + 3) {
        return { day: band.day, index };
      }
    }
  }
  return null;
}

interface CellLine {
  text: string;
  y: number;
}

function cellLines(cell: RawCell): CellLine[] {
  const groups = new Map<number, RawWord[]>();
  for (const word of [...cell.words].sort((a, b) => wordCenterY(a) - wordCenterY(b) || a.x0 - b.x0)) {
    const key = Math.round(wordCenterY(word) / 12) * 12;
    const group = groups.get(key) ?? [];
    group.push(word);
    groups.set(key, group);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a - b)
    .map(([y, words]) => ({
      y,
      text: [...words]
        .sort((a, b) => a.x0 - b.x0)
        .map((word) => word.text)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim(),
    }))
    .filter((line) => line.text.length > 0);
}

const CODE_RE = /\b([A-Z]{2,5})\s*-?\s*(\d{3})(?![0-9])/g;
const TYPE_RE = /\b(LEC|LAB|TUT)\b/i;
const INSTRUCTOR_RE = /\b(?:Eng|Dr|Prof|Mr|Ms)\.?\s*([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,2})/g;
const PARENTHESIZED_INSTRUCTOR_RE = /\((?:Dr|Prof|Mr|Ms|Eng)\.?\s*([^)]+)\)/i;
const ROOM_RE = /\b([A-Z]\d{1,2})[.\s]+([A-Z]?\.?\d{1,2}[A-Z]?\.?\d{0,2}|Theater)\b/g;
const ELECTIVE_RE = /\b(?:[A-Z]{2,5}\s+)?Elective\s*\(\d+\)/gi;

function meetingType(text: string): MeetingType {
  const match = text.match(TYPE_RE);
  if (!match) return "LECTURE";
  const value = match[1].toUpperCase();
  if (value === "LAB") return "LAB";
  if (value === "TUT") return "TUTORIAL";
  return "LECTURE";
}

function dedupeRepeatedText(text: string): string {
  let tokens = text.split(/\s+/).filter(Boolean);
  for (let size = Math.min(12, Math.floor(tokens.length / 2)); size >= 1; size -= 1) {
    const next: string[] = [];
    for (let index = 0; index < tokens.length; ) {
      const first = tokens.slice(index, index + size).join(" ").toLowerCase();
      const second = tokens.slice(index + size, index + size * 2).join(" ").toLowerCase();
      if (first === second && first.length > 0) {
        index += size * 2;
      } else {
        next.push(tokens[index]);
        index += 1;
      }
    }
    tokens = next;
  }
  return tokens.join(" ");
}

function cleanTitle(text: string): string {
  return dedupeRepeatedText(
    text
      .replace(CODE_RE, " ")
      .replace(TYPE_RE, " ")
      .replace(/\((?:Dr|Prof|Mr|Ms|Eng)\.?[^)]*\)/gi, " ")
      .replace(INSTRUCTOR_RE, " ")
      .replace(ROOM_RE, " ")
      .replace(ELECTIVE_RE, " ")
      .replace(/[()\/]/g, " ")
      .replace(/\b(?:Dr|Prof|Mr|Ms|Eng)\b\.?/gi, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function firstMatch(text: string, pattern: RegExp): string | null {
  pattern.lastIndex = 0;
  return text.match(pattern)?.[0]?.trim() ?? null;
}

function parseInstructor(text: string): string | null {
  const parenthesized = text.match(PARENTHESIZED_INSTRUCTOR_RE);
  if (parenthesized) return parenthesized[1].trim();
  const value = firstMatch(text, INSTRUCTOR_RE);
  if (!value) return null;
  return value.replace(/^(?:Eng|Dr|Prof|Mr|Ms)\.?\s*/i, "").trim() || null;
}

function parseRoom(text: string): { building: string | null; room: string | null } {
  const match = [...text.matchAll(ROOM_RE)][0];
  if (!match) {
    if (/\bBlue\s+Hall\b/i.test(text)) return { building: null, room: "Blue Hall" };
    return { building: null, room: null };
  }
  return { building: match[1], room: match[2] };
}

function parseSegment(text: string, inherited: ParsedSegment | null = null): ParsedSegment[] {
  const normalized = dedupeRepeatedText(text.replace(/\s+/g, " ").trim());
  const codes = [...normalized.matchAll(CODE_RE)];
  const type = meetingType(normalized);
  const { building, room } = parseRoom(normalized);
  const instructor = parseInstructor(normalized);

  if (codes.length === 0) {
    if (!inherited) return [];
    const fragment = cleanTitle(normalized);
    const title = !fragment || inherited.title.toLowerCase().includes(fragment.toLowerCase())
      ? inherited.title
      : [inherited.title, fragment].filter(Boolean).join(" ");
    return [{ ...inherited, meetingType: type, building, room, instructor, title }];
  }

  return codes.map((match, index) => {
    const start = (match.index ?? 0) + match[0].length;
    const end = index + 1 < codes.length ? codes[index + 1].index ?? normalized.length : normalized.length;
    const cleaned = cleanTitle(normalized.slice(start, end));
    const fallback = inherited?.courseCode === `${match[1]} ${match[2]}` ? inherited.title : "";
    return {
      courseCode: `${match[1]} ${match[2]}`,
      title: cleaned || fallback,
      meetingType: type,
      building,
      room,
      instructor,
    };
  });
}

interface TextEntry {
  code: string;
  text: string;
  y: number;
}

function textEntriesFromLines(lines: CellLine[]): TextEntry[] {
  let fullText = "";
  const lineOffsets: number[] = [];
  for (const line of lines) {
    lineOffsets.push(fullText.length);
    fullText += `${line.text} `;
  }

  const codes = [...fullText.matchAll(CODE_RE)];
  const entries: TextEntry[] = [];
  const seen = new Set<string>();
  codes.forEach((match, index) => {
    const code = `${match[1]} ${match[2]}`;
    const matchIndex = match.index ?? 0;
    let lineIndex = lineOffsets.length - 1;
    for (let offsetIndex = 0; offsetIndex < lineOffsets.length; offsetIndex += 1) {
      if (lineOffsets[offsetIndex] <= matchIndex) lineIndex = offsetIndex;
    }
    const key = `${code}|${lineIndex}`;
    if (seen.has(key)) return;
    seen.add(key);
    const start = matchIndex + match[0].length;
    const end = index + 1 < codes.length ? codes[index + 1].index ?? fullText.length : fullText.length;
    entries.push({ code, text: `${match[0]} ${fullText.slice(start, end)}`, y: lines[lineIndex].y });
  });
  return entries;
}

function meetingKey(meeting: ParsedMeeting): string {
  return [
    meeting.columnKey,
    meeting.courseCode,
    meeting.day,
    meeting.startTime,
    meeting.endTime,
    meeting.meetingType,
  ].join("|");
}

function makeMeeting(
  column: Column,
  slot: SlotRef,
  segment: ParsedSegment
): ParsedMeeting {
  const [startTime, endTime] = SLOT_TIMES[slot.index];
  return {
    columnKey: column.key,
    courseCode: segment.courseCode,
    title: segment.title,
    meetingType: segment.meetingType,
    year: column.year,
    group: column.group,
    track: column.track,
    section: column.section,
    sectionLabel: describeColumn(column),
    day: slot.day,
    startTime,
    endTime,
    building: segment.building,
    room: segment.room,
    instructor: segment.instructor,
    academicYear: "2026/2027",
    semester: "Fall",
  };
}

/** Parse all extracted cells into a deduplicated, chronological meeting list. */
export function parseTimetableCells(cells: RawCell[]): ParsedMeeting[] {
  const meetings = new Map<string, ParsedMeeting>();
  const lastCoded = new Map<string, Map<number, ParsedSegment[]>>();
  const noCodeCells: RawCell[] = [];

  const sorted = [...cells].sort((a, b) => a.rect.y0 - b.rect.y0 || a.rect.x0 - b.rect.x0);

  for (const cell of sorted) {
    if (cell.words.length === 0) continue;
    const columns = columnsForCell(cell.rect);
    const slots = slotsForCell(cell.rect);
    if (columns.length === 0 || slots.length === 0) continue;

    const lines = cellLines(cell);
    if (lines.length === 0) continue;

    const entries = textEntriesFromLines(lines);

    if (entries.length === 0) {
      noCodeCells.push(cell);
      continue;
    }

    for (const column of columns) {
      const bySlot = lastCoded.get(column.key) ?? new Map<number, ParsedSegment[]>();
      for (const entry of entries) {
        const codeSlot = slotAtY(entry.y) ?? slots[0];
        const segments = parseSegment(entry.text, null);
        for (const segment of segments) {
          if (segment.courseCode !== entry.code) continue;
          const meeting = makeMeeting(column, codeSlot, segment);
          meetings.set(meetingKey(meeting), meeting);
          const existing = bySlot.get(codeSlot.index) ?? [];
          if (!existing.some((item) => item.courseCode === segment.courseCode)) {
            existing.push(segment);
          }
          bySlot.set(codeSlot.index, existing);
        }
      }
      lastCoded.set(column.key, bySlot);
    }
  }

  for (const cell of noCodeCells) {
    const columns = columnsForCell(cell.rect);
    const slots = slotsForCell(cell.rect);
    if (columns.length === 0 || slots.length === 0) continue;
    const lines = cellLines(cell);
    const text = dedupeRepeatedText(lines.map((line) => line.text).join(" "));
    if (!TYPE_RE.test(text) && !ROOM_RE.test(text) && !PARENTHESIZED_INSTRUCTOR_RE.test(text)) continue;

    for (const column of columns) {
      for (const slot of slots) {
        const previous = lastCoded.get(column.key)?.get(slot.index - 1) ?? [];
        if (previous.length !== 1) continue;
        const segments = parseSegment(text, previous[0]);
        for (const segment of segments) {
          const meeting = makeMeeting(column, slot, segment);
          meetings.set(meetingKey(meeting), meeting);
        }
      }
    }
  }

  const order: Record<ScheduleDay, number> = {
    SATURDAY: 0, MONDAY: 1, TUESDAY: 2, WEDNESDAY: 3, THURSDAY: 4,
  };
  return [...meetings.values()].sort(
    (a, b) =>
      order[a.day] - order[b.day] ||
      a.startTime.localeCompare(b.startTime) ||
      a.year - b.year ||
      a.sectionLabel.localeCompare(b.sectionLabel) ||
      a.courseCode.localeCompare(b.courseCode)
  );
}

export function parseTimetableText(text: string): ParsedSegment[] {
  return parseSegment(text, null);
}
