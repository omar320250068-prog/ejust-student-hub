/**
 * Pure RFC 5545 calendar exports for student timetables and exams.
 *
 * Dates are Cairo wall-clock values so exports match the campus schedule even
 * when a student's device is in another time zone. The helper is intentionally
 * free of browser APIs; `downloadIcsFile` is the only side-effecting export.
 */

import type { Exam } from "./exams.ts";
import { DAYS, type ClassBlock, type Day } from "./timetable.ts";

const CRLF = "\r\n";
const TIME_ZONE = "Africa/Cairo";

export interface TimetableIcsOptions {
  now?: Date;
  calendarName?: string;
  occurrenceCount?: number;
}

export interface ExamSeatInfo {
  hall?: string;
  seat?: string;
}

export interface ExamsIcsOptions {
  now?: Date;
  seat?: ExamSeatInfo | null;
  calendarName?: string;
  durationMinutes?: number;
}

/** Escape the four RFC 5545 text delimiters in the required order. */
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** Keep generated lines under the 75 octet RFC limit (ASCII-safe folding). */
function foldLine(line: string): string {
  const parts: string[] = [];
  let current = "";
  for (const character of line) {
    if (current.length >= 73) {
      parts.push(current);
      current = " ";
    }
    current += character;
  }
  parts.push(current);
  return parts.join(CRLF);
}

interface CairoParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: Day;
}

function cairoParts(date: Date): CairoParts {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? "";
  const weekday = DAYS.find((day) => day.toLowerCase() === read("weekday").toLowerCase()) ?? "Sun";

  return {
    year: Number(read("year")),
    month: Number(read("month")),
    day: Number(read("day")),
    hour: Number(read("hour")),
    minute: Number(read("minute")),
    weekday,
  };
}

function wallClock(value: Date | CairoParts): CairoParts {
  return value instanceof Date ? cairoParts(value) : value;
}

function formatIcsDate(parts: CairoParts, dayOffset = 0): string {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + dayOffset));
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}`;
}

function formatIcsTime(hour: number, minute: number): string {
  return `T${pad(hour)}${pad(minute)}00`;
}

function parseLocalDateTime(iso: string): CairoParts | null {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    weekday: "Sun",
  };
}

function dateTimeFromIso(iso: string): { date: string; time: string } {
  const local = parseLocalDateTime(iso);
  if (local) return { date: formatIcsDate(local), time: formatIcsTime(local.hour, local.minute) };
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return { date: "19700101", time: "T000000" };
  const parts = cairoParts(parsed);
  return { date: formatIcsDate(parts), time: formatIcsTime(parts.hour, parts.minute) };
}

function addTime(hour: number, minute: number, durationMinutes: number): [number, number] {
  const total = hour * 60 + minute + durationMinutes;
  const clamped = Math.min(total, 24 * 60);
  return [Math.floor(clamped / 60), clamped % 60];
}

function normalizeDay(value: string): Day {
  const day = DAYS.find((item) => item.toLowerCase() === value.slice(0, 3).toLowerCase());
  return day ?? "Sun";
}

function alarmLines(summary: string): string[] {
  return [
    "BEGIN:VALARM",
    "TRIGGER:-PT15M",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeIcsText(summary)}`,
    "END:VALARM",
  ];
}

function calendarHeader(calendarName: string): string[] {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//EJUST Student Hub//Student Productivity//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcsText(calendarName)}`,
    `X-WR-TIMEZONE:${TIME_ZONE}`,
    "BEGIN:VTIMEZONE",
    `TZID:${TIME_ZONE}`,
    `X-LIC-LOCATION:${TIME_ZONE}`,
    "BEGIN:STANDARD",
    "DTSTART:19701030T040000",
    "TZOFFSETFROM:+0300",
    "TZOFFSETTO:+0200",
    "TZNAME:EET",
    "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1TH",
    "END:STANDARD",
    "BEGIN:DAYLIGHT",
    "DTSTART:19700424T000000",
    "TZOFFSETFROM:+0200",
    "TZOFFSETTO:+0300",
    "TZNAME:EEST",
    "RRULE:FREQ=YEARLY;BYMONTH=4;BYDAY=-1FR",
    "END:DAYLIGHT",
    "END:VTIMEZONE",
  ];
}

function utcStamp(now: Date): string {
  return `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(
    now.getUTCHours(),
  )}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;
}

function serialize(lines: string[]): string {
  return lines.map(foldLine).join(CRLF) + CRLF;
}

/** Build a weekly recurring calendar for the student's current timetable. */
export function buildTimetableIcs(
  classes: ClassBlock[],
  options: TimetableIcsOptions = {},
): string {
  const now = options.now ?? new Date();
  const base = wallClock(now);
  const stamp = utcStamp(now);
  const occurrenceCount = Math.max(1, Math.floor(options.occurrenceCount ?? 15));
  const lines = calendarHeader(options.calendarName ?? "EJUST Timetable");

  for (const block of classes) {
    if (!/^\d{1,2}:\d{2}$/.test(block.start) || !/^\d{1,2}:\d{2}$/.test(block.end)) continue;
    const weekday = normalizeDay(block.day);
    const offset = (DAYS.indexOf(weekday) - DAYS.indexOf(base.weekday) + 7) % 7;
    const [startHour, startMinute] = block.start.split(":").map(Number);
    const [endHour, endMinute] = block.end.split(":").map(Number);
    const date = formatIcsDate(base, offset);
    const summary = `${block.courseCode} ${block.title}`.trim();
    const description = [
      `${block.type ?? "Class"} · ${block.courseCode}`,
      block.instructor ? `Instructor: ${block.instructor}` : null,
      "Added from EJUST Student Hub",
    ]
      .filter(Boolean)
      .join("\n");

    lines.push(
      "BEGIN:VEVENT",
      `UID:${encodeURIComponent(`class-${block.id}-${date}`)}@ejust-student-hub`,
      `DTSTAMP:${stamp}`,
      `DTSTART;TZID=${TIME_ZONE}:${date}${formatIcsTime(startHour, startMinute)}`,
      `DTEND;TZID=${TIME_ZONE}:${date}${formatIcsTime(endHour, endMinute)}`,
      `SUMMARY:${escapeIcsText(summary)}`,
      `LOCATION:${escapeIcsText(block.location || "TBA")}`,
      `DESCRIPTION:${escapeIcsText(description)}`,
      `RRULE:FREQ=WEEKLY;COUNT=${occurrenceCount};BYDAY=${weekday.toUpperCase().slice(0, 2)}`,
      ...alarmLines(summary),
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");
  return serialize(lines);
}

/** Build one timed event per scheduled exam, including the saved seat details. */
export function buildExamsIcs(exams: Exam[], options: ExamsIcsOptions = {}): string {
  const now = options.now ?? new Date();
  const stamp = utcStamp(now);
  const duration = Math.max(15, Math.floor(options.durationMinutes ?? 90));
  const lines = calendarHeader(options.calendarName ?? "EJUST Exams");

  for (const exam of exams) {
    const start = dateTimeFromIso(exam.date);
    const startHour = Number(start.time.slice(1, 3));
    const startMinute = Number(start.time.slice(3, 5));
    const [endHour, endMinute] = addTime(startHour, startMinute, duration);
    const summary = `${exam.courseCode} ${exam.type}: ${exam.title}`.trim();
    const location = options.seat?.hall?.trim() || "TBA";
    const description = [
      `Seat: ${options.seat?.seat?.trim() || "TBA"}`,
      `Room: ${location}`,
      `Exam type: ${exam.type}`,
      `Grade weight: ${exam.weight}% · Difficulty: ${exam.difficulty}/4`,
      exam.notes ? `Notes: ${exam.notes}` : null,
      "Added from EJUST Student Hub",
    ]
      .filter(Boolean)
      .join("\n");

    lines.push(
      "BEGIN:VEVENT",
      `UID:${encodeURIComponent(`exam-${exam.id}`)}@ejust-student-hub`,
      `DTSTAMP:${stamp}`,
      `DTSTART;TZID=${TIME_ZONE}:${start.date}${start.time}`,
      `DTEND;TZID=${TIME_ZONE}:${start.date}${formatIcsTime(endHour, endMinute)}`,
      `SUMMARY:${escapeIcsText(summary)}`,
      `LOCATION:${escapeIcsText(location)}`,
      `DESCRIPTION:${escapeIcsText(description)}`,
      ...alarmLines(summary),
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");
  return serialize(lines);
}

/** Trigger a browser download for an already-built calendar. */
export function downloadIcsFile(content: string, filename: string): void {
  if (typeof document === "undefined") return;
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
