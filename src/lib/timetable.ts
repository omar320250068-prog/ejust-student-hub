export const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
export type Day = (typeof DAYS)[number];

export const ICS_BYDAY: Record<Day, string> = {
  Sun: "SU",
  Mon: "MO",
  Tue: "TU",
  Wed: "WE",
  Thu: "TH",
  Fri: "FR",
  Sat: "SA",
};

export interface ClassBlock {
  id: string;
  courseCode: string;
  title: string;
  day: Day;
  start: string; // "HH:MM" 24h
  end: string; // "HH:MM" 24h
  location: string;
  color: string;
  instructor?: string;
  type?: "Lecture" | "Lab" | "Tutorial" | "Custom";
  faculty?: "CSIT" | "Engineering" | "Business" | "FOP" | "BAS" | "FAD";
  year?: 1 | 2 | 3 | 4 | 5;
  group?: string;
  track?: "CNC" | "AID" | "CSC" | "BIF" | null;
  section?: string;
  columnKey?: string;
  source?: "db" | "custom";
}

export interface Conflict {
  a: ClassBlock;
  b: ClassBlock;
}

export function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function isValidTimeRange(start: string, end: string): boolean {
  return /^\d{2}:\d{2}$/.test(start) && /^\d{2}:\d{2}$/.test(end) && toMinutes(end) > toMinutes(start);
}

export function findConflicts(blocks: ClassBlock[]): Conflict[] {
  const conflicts: Conflict[] = [];
  for (let i = 0; i < blocks.length; i++) {
    for (let j = i + 1; j < blocks.length; j++) {
      const a = blocks[i];
      const b = blocks[j];
      if (a.day !== b.day) continue;
      if (toMinutes(a.start) < toMinutes(b.end) && toMinutes(b.start) < toMinutes(a.end)) {
        conflicts.push({ a, b });
      }
    }
  }
  return conflicts;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Next Sunday (or today if Sunday) — reference week for recurring events. */
function referenceSunday(): Date {
  const d = new Date();
  const delta = (7 - d.getDay()) % 7; // getDay: 0 = Sunday
  d.setDate(d.getDate() + delta);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function generateIcs(blocks: ClassBlock[]): string {
  const ref = referenceSunday();
  const dayIndex = Object.fromEntries(DAYS.map((d, i) => [d, i])) as Record<Day, number>;
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//EJUST Student Hub//Timetable//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  for (const b of blocks) {
    const eventDate = new Date(ref);
    eventDate.setDate(ref.getDate() + dayIndex[b.day]);
    const [sh, sm] = b.start.split(":").map(Number);
    const [eh, em] = b.end.split(":").map(Number);
    const dtStart = `${eventDate.getFullYear()}${pad(eventDate.getMonth() + 1)}${pad(eventDate.getDate())}T${pad(sh)}${pad(sm)}00`;
    const dtEnd = `${eventDate.getFullYear()}${pad(eventDate.getMonth() + 1)}${pad(eventDate.getDate())}T${pad(eh)}${pad(em)}00`;

    lines.push(
      "BEGIN:VEVENT",
      `UID:${b.id}@ejust-student-hub`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `RRULE:FREQ=WEEKLY;BYDAY=${ICS_BYDAY[b.day]}`,
      `SUMMARY:${escapeIcs(`${b.courseCode} ${b.title}`.trim())}`,
      `LOCATION:${escapeIcs(b.location)}`,
      "END:VEVENT"
    );
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

function escapeIcs(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export function downloadIcs(blocks: ClassBlock[]): void {
  const blob = new Blob([generateIcs(blocks)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "ejust-timetable.ics";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
