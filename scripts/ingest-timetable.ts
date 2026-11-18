/**
 * Idempotently ingest the parsed Fall 2026 timetable into Neon.
 *
 * Run with: npx tsx scripts/ingest-timetable.ts
 *
 * Courses are resolved by normalized code first, so official catalog names are
 * never overwritten. Meeting conflicts use the schema's slot uniqueness key;
 * `group` carries the grid column plus meeting type to keep LEC/TUT/LAB apart.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import dotenv from "dotenv";
import { neon } from "@neondatabase/serverless";

dotenv.config({ path: ".env.local" });
dotenv.config();

const sql = neon(process.env.DATABASE_URL!);

type Program = "CSC" | "AID" | "CNC" | "BIF" | "GENERAL";
type MeetingType = "LECTURE" | "LAB" | "TUTORIAL";
type Day = "SATURDAY" | "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY";

interface ParsedMeeting {
  columnKey: string;
  courseCode: string;
  title: string;
  meetingType: MeetingType;
  day: Day;
  startTime: string;
  endTime: string;
  building: string | null;
  room: string | null;
  instructor: string | null;
  academicYear: string;
  semester: string;
}

interface CourseRow {
  id: string;
  code: string;
  program: Program;
  name: string;
}

interface MeetingRow {
  id: string;
  courseId: string;
  academicYear: string;
  semester: string;
  day: Day;
  startTime: string;
  endTime: string;
  building: string | null;
  room: string | null;
  group: string;
  instructor: string | null;
  meetingType: MeetingType;
}

const TRACK_PROGRAMS = new Set(["CSC", "AID", "CNC", "BIF"]);

/** Names for codes absent from the existing catalog; parsed titles are noisy. */
const NEW_COURSE_NAMES: Record<string, string> = {
  "ACM 215": "Ordinary Differential Equations",
  "CSE 214": "Computer Organization",
  "ECE 111": "Digital Logic Design",
  "ECE 324": "Digital Signal Processing",
  "MTH 111": "Mathematics 1",
  "MTH 212": "Probability and Statistics",
  "PHY 113": "Physics 1",
};

function normalizeCode(code: string): string {
  return code.replace(/\s+/g, " ").trim().toUpperCase();
}

function programFor(code: string): Program {
  const prefix = code.split(" ")[0];
  return TRACK_PROGRAMS.has(prefix) ? (prefix as Program) : "GENERAL";
}

function stableId(prefix: string, value: string): string {
  return `${prefix}-${createHash("sha256").update(value).digest("hex").slice(0, 32)}`;
}

function nullable(value: string | null | undefined): string | null {
  const clean = String(value ?? "").replace(/\s+/g, " ").trim();
  return clean.length > 0 ? clean : null;
}

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

async function main() {
  const payload = JSON.parse(
    readFileSync("src/data/timetable-fall-2026.json", "utf8")
  ) as { meetings: ParsedMeeting[] };

  const before = (await sql`select count(*)::int as count from course_meeting`) as { count: number }[];
  const meetings = payload.meetings.map((meeting) => ({
    ...meeting,
    courseCode: normalizeCode(meeting.courseCode),
  }));

  const existingRows = (await sql`select id, code, program, name from course`) as CourseRow[];
  const coursesByCode = new Map<string, CourseRow>();
  for (const row of existingRows) {
    const code = normalizeCode(row.code);
    if (!coursesByCode.has(code)) coursesByCode.set(code, row);
  }

  const parsedTitles = new Map<string, string>();
  for (const meeting of meetings) {
    if (!parsedTitles.has(meeting.courseCode) && nullable(meeting.title)) {
      parsedTitles.set(meeting.courseCode, nullable(meeting.title)!);
    }
  }

  const codes = [...new Set(meetings.map((meeting) => meeting.courseCode))].sort();
  let coursesCreated = 0;

  for (const code of codes) {
    if (coursesByCode.has(code)) continue;
    const program = programFor(code);
    const name = NEW_COURSE_NAMES[code] ?? parsedTitles.get(code) ?? code;
    const id = stableId("course", `${code}|${program}`);
    const inserted = (await sql`
      insert into course (id, code, name, program, level, "creditHours", "isElective")
      values (${id}, ${code}, ${name}, ${program}, null, 3, false)
      on conflict ("code", program) do update set
        name = coalesce(course.name, excluded.name)
      returning id, code, program, name
    `) as CourseRow[];
    coursesByCode.set(code, inserted[0] ?? { id, code, program, name });
    coursesCreated += 1;
  }

  const meetingRows: MeetingRow[] = meetings.map((meeting) => {
    const course = coursesByCode.get(meeting.courseCode);
    if (!course) throw new Error(`Missing course row for ${meeting.courseCode}`);

    const group = `${meeting.columnKey}:${meeting.meetingType}`;
    const uniqueKey = [
      course.id,
      meeting.academicYear,
      meeting.semester,
      meeting.day,
      meeting.startTime,
      group,
    ].join("|");

    return {
      id: stableId("meeting", uniqueKey),
      courseId: course.id,
      academicYear: meeting.academicYear,
      semester: meeting.semester,
      day: meeting.day,
      startTime: meeting.startTime,
      endTime: meeting.endTime,
      building: nullable(meeting.building),
      room: nullable(meeting.room),
      group,
      instructor: nullable(meeting.instructor),
      meetingType: meeting.meetingType,
    };
  });

  for (const batch of chunk(meetingRows, 40)) {
    await Promise.all(
      batch.map((row) =>
        sql`
          insert into course_meeting (
            id, "courseId", "academicYear", semester, day, "startTime", "endTime",
            building, room, "group", instructor, "meetingType"
          )
          values (
            ${row.id}, ${row.courseId}, ${row.academicYear}, ${row.semester}, ${row.day},
            ${row.startTime}, ${row.endTime}, ${row.building}, ${row.room}, ${row.group},
            ${row.instructor}, ${row.meetingType}
          )
          on conflict ("courseId", "academicYear", semester, day, "startTime", "group") do update set
            "endTime" = excluded."endTime",
            building = excluded.building,
            room = excluded.room,
            instructor = excluded.instructor,
            "meetingType" = excluded."meetingType"
        `
      )
    );
  }

  const after = (await sql`select count(*)::int as count from course_meeting`) as { count: number }[];
  const byType = (await sql`
    select "meetingType", count(*)::int as count
    from course_meeting
    group by "meetingType"
    order by "meetingType"
  `) as { meetingType: MeetingType; count: number }[];

  console.log(
    `courses: checked ${codes.length}, created ${coursesCreated}; ` +
      `meetings: before ${before[0]?.count ?? 0}, after ${after[0]?.count ?? 0}`
  );
  console.log("byType", byType);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
