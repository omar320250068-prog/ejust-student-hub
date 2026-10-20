export interface IcsEvent {
  id: string;
  start: Date;
  end: Date;
  summary: string;
  description?: string;
  location?: string;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Floating local time (no Z / TZID) so calendar apps treat it as the user's local time. */
function formatLocal(d: Date): string {
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(
    d.getHours()
  )}${pad(d.getMinutes())}00`;
}

function formatUtc(d: Date): string {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(
    d.getUTCHours()
  )}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

function escapeIcs(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

export function buildIcs(events: IcsEvent[], calendarName = "EJUST Student Hub"): string {
  const stamp = formatUtc(new Date());
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//EJUST Student Hub//Events//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcs(calendarName)}`,
  ];

  for (const event of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${escapeIcs(event.id)}@ejust-student-hub`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${formatLocal(event.start)}`,
      `DTEND:${formatLocal(event.end)}`,
      `SUMMARY:${escapeIcs(event.summary)}`
    );
    if (event.description) lines.push(`DESCRIPTION:${escapeIcs(event.description)}`);
    if (event.location) lines.push(`LOCATION:${escapeIcs(event.location)}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export function downloadEventIcs(
  events: IcsEvent[],
  filename: string,
  calendarName?: string
): void {
  const blob = new Blob([buildIcs(events, calendarName)], {
    type: "text/calendar;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const HOUR_MS = 3_600_000;

export function examEvent(exam: {
  id: string;
  courseCode: string;
  title: string;
  type: string;
  date: string;
  weight: number;
  difficulty: number;
}): IcsEvent {
  const start = new Date(exam.date);
  return {
    id: `exam-${exam.id}`,
    start,
    end: new Date(start.getTime() + 1.5 * HOUR_MS),
    summary: `${exam.courseCode} ${exam.type}: ${exam.title}`,
    description: `Grade weight: ${exam.weight}% · Difficulty: ${exam.difficulty}/4\nAdded from EJUST Student Hub`,
  };
}

export function scholarshipDeadlineEvent(s: {
  id: string;
  name: string;
  country: string;
  deadline: string;
  fundingDetails: string;
  link: string;
}): IcsEvent {
  const start = new Date(`${s.deadline}T09:00:00`);
  return {
    id: `scholarship-${s.id}`,
    start,
    end: new Date(start.getTime() + HOUR_MS),
    summary: `Deadline: ${s.name}`,
    description: `${s.fundingDetails}\nOfficial page: ${s.link}\nTiming is a reminder — verify the exact cutoff on the official page.`,
    location: s.country,
  };
}
