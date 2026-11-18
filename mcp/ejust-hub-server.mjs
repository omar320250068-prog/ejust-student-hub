/**
 * E-JUST Student Hub MCP server (stdio, zero-dependency JSON-RPC 2.0).
 *
 * Tools write to Neon PostgreSQL using @neondatabase/serverless, which is
 * already a project dependency. `DATABASE_URL` is read from the environment or
 * from `.env` / `.env.local` at runtime; no secrets live in this file or in
 * opencode.json.
 *
 * The app has no exam or global-notice table, so this server manages two
 * dedicated tables (`exam`, `hub_announcement`) with idempotency keys. It uses
 * the existing `course` and `course_meeting` tables unchanged.
 */

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, "..");
const SERVER_INFO = { name: "ejust-hub", version: "1.0.0" };
const EXAM_TYPES = ["MIDTERM", "FINAL", "QUIZ"];
const ANNOUNCEMENT_CATEGORIES = ["ACADEMIC", "EXAM", "SCHEDULE_CHANGE", "EVENT"];
const DAYS = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "SATURDAY"];
const MEETING_TYPES = ["LECTURE", "LAB", "SECTION", "TUTORIAL"];

function loadEnvFile(path) {
  let contents;
  try {
    contents = readFileSync(path, "utf8");
  } catch {
    return;
  }
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim().replace(/^export\s+/, "");
    if (process.env[key] !== undefined) continue;
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadEnvFile(join(ROOT, ".env"));
loadEnvFile(join(ROOT, ".env.local"));

const databaseUrl = process.env.DATABASE_URL;
const sql = databaseUrl ? neon(databaseUrl) : null;

class ToolError extends Error {
  constructor(code, message, details) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

function invalid(message, details) {
  throw new ToolError("VALIDATION_ERROR", message, details);
}

function requireObject(value, name) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    invalid(`${name} must be an object`);
  }
  return value;
}

function requireString(value, name, options = {}) {
  if (typeof value !== "string" || !value.trim()) {
    invalid(`${name} must be a non-empty string`);
  }
  const result = value.trim();
  if (options.maxLength && result.length > options.maxLength) {
    invalid(`${name} is too long`, { maxLength: options.maxLength });
  }
  return result;
}

function optionalString(value, name, options = {}) {
  if (value === undefined || value === null || value === "") return options.fallback ?? null;
  return requireString(value, name, options);
}

function normalizeCode(value) {
  return requireString(value, "courseCode").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function enumValue(value, name, allowed) {
  const normalized = requireString(value, name).toUpperCase().replace(/[\s-]+/g, "_");
  const aliases = { MID: "MIDTERM", MIDTERM: "MIDTERM", FINAL: "FINAL", QUIZ: "QUIZ" };
  const result = aliases[normalized] ?? normalized;
  if (!allowed.includes(result)) {
    invalid(`${name} must be one of: ${allowed.join(", ")}`, { received: value });
  }
  return result;
}

function dayValue(value) {
  const raw = requireString(value, "dayOfWeek").toUpperCase();
  const short = { SUN: "SUNDAY", MON: "MONDAY", TUE: "TUESDAY", WED: "WEDNESDAY", THU: "THURSDAY", SAT: "SATURDAY" };
  const result = short[raw] ?? raw;
  if (!DAYS.includes(result)) {
    invalid(`dayOfWeek must be one of: ${DAYS.join(", ")}`, { received: value });
  }
  return result;
}

function timeValue(value, name) {
  const result = requireString(value, name);
  if (!/^\d{1,2}:\d{2}(?::\d{2})?$/.test(result)) {
    invalid(`${name} must use HH:MM`, { received: value });
  }
  return result;
}

function endTimeOr(startTime, value) {
  if (value === undefined || value === null || value === "") {
    const [hours, minutes] = startTime.split(":").map(Number);
    return `${String((hours + 1) % 24).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }
  return timeValue(value, "endTime");
}

function dateValue(value) {
  const parsed = new Date(requireString(value, "examDate"));
  if (Number.isNaN(parsed.getTime())) invalid("examDate must be a valid date", { received: value });
  return parsed.toISOString().slice(0, 10);
}

function timestampOrNull(value, name) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = new Date(requireString(value, name));
  if (Number.isNaN(parsed.getTime())) invalid(`${name} must be a valid timestamp`, { received: value });
  return parsed.toISOString();
}

async function findCourseId(code) {
  const rows = await sql`
    select id from course
    where regexp_replace(upper(code), '[^A-Z0-9]', '', 'g') = ${code}
    limit 1
  `;
  return rows.length > 0 ? rows[0].id : null;
}

function ensureDatabase() {
  if (!sql) {
    throw new ToolError(
      "DATABASE_NOT_CONFIGURED",
      "DATABASE_URL is missing. Set it in the environment or .env.local."
    );
  }
}

let schemaReady = null;
async function ensureSchema() {
  ensureDatabase();
  if (!schemaReady) {
    schemaReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS exam (
          id text PRIMARY KEY,
          course_id text REFERENCES course(id) ON DELETE SET NULL,
          course_code text NOT NULL,
          exam_type text NOT NULL CHECK (exam_type IN ('MIDTERM', 'FINAL', 'QUIZ')),
          exam_date date NOT NULL,
          start_time text NOT NULL DEFAULT '',
          end_time text NOT NULL DEFAULT '',
          building text,
          room text,
          notes text,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now(),
          CONSTRAINT exam_intent_unique UNIQUE (course_code, exam_type, exam_date, start_time, end_time)
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS hub_announcement (
          id text PRIMARY KEY,
          title text NOT NULL,
          body text NOT NULL,
          category text NOT NULL CHECK (category IN ('ACADEMIC', 'EXAM', 'SCHEDULE_CHANGE', 'EVENT')),
          course_code text NOT NULL DEFAULT '',
          course_id text REFERENCES course(id) ON DELETE SET NULL,
          target_faculty text NOT NULL DEFAULT '',
          expires_at timestamptz,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now(),
          CONSTRAINT hub_announcement_intent_unique
            UNIQUE (title, category, course_code, target_faculty)
        )
      `;
      await sql`CREATE INDEX IF NOT EXISTS exam_date_idx ON exam (exam_date)`;
      await sql`CREATE INDEX IF NOT EXISTS hub_announcement_feed_idx ON hub_announcement (created_at DESC)`;
    })().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  return schemaReady;
}

async function upsertExams(args) {
  requireObject(args, "arguments");
  const items = args.items;
  if (!Array.isArray(items) || items.length === 0) {
    invalid("items must be a non-empty array");
  }
  await ensureSchema();

  const written = [];
  for (const item of items) {
    requireObject(item, "exam item");
    const code = normalizeCode(item.courseCode);
    const examType = enumValue(item.examType, "examType", EXAM_TYPES);
    const examDate = dateValue(item.examDate);
    const startTime = optionalString(item.startTime, "startTime", { fallback: "" }) ?? "";
    const endTime = optionalString(item.endTime, "endTime", { fallback: "" }) ?? "";
    const building = optionalString(item.building, "building", { maxLength: 200 });
    const room = optionalString(item.room, "room", { maxLength: 200 });
    const notes = optionalString(item.notes, "notes", { maxLength: 4000 });
    const courseId = await findCourseId(code);

    const [row] = await sql`
      INSERT INTO exam (
        id, course_id, course_code, exam_type, exam_date,
        start_time, end_time, building, room, notes
      ) VALUES (
        ${randomUUID()}, ${courseId}, ${code}, ${examType}, ${examDate},
        ${startTime}, ${endTime}, ${building}, ${room}, ${notes}
      )
      ON CONFLICT (course_code, exam_type, exam_date, start_time, end_time)
      DO UPDATE SET
        course_id = EXCLUDED.course_id,
        building = EXCLUDED.building,
        room = EXCLUDED.room,
        notes = EXCLUDED.notes,
        updated_at = now()
      RETURNING id, course_code, exam_type, exam_date
    `;
    written.push(row);
  }
  return { upserted: written.length, exams: written };
}

async function publishAnnouncement(args) {
  requireObject(args, "arguments");
  const title = requireString(args.title, "title", { maxLength: 300 });
  const body = requireString(args.body, "body", { maxLength: 8000 });
  const category = enumValue(args.category, "category", ANNOUNCEMENT_CATEGORIES);
  const courseCode = args.courseCode ? normalizeCode(args.courseCode) : "";
  const targetFaculty = args.targetFaculty
    ? requireString(args.targetFaculty, "targetFaculty", { maxLength: 40 }).toUpperCase()
    : "";
  const expiresAt = timestampOrNull(args.expiresAt, "expiresAt");
  await ensureSchema();
  const courseId = courseCode ? await findCourseId(courseCode) : null;

  const [row] = await sql`
    INSERT INTO hub_announcement (
      id, title, body, category, course_code, course_id, target_faculty, expires_at
    ) VALUES (
      ${randomUUID()}, ${title}, ${body}, ${category}, ${courseCode},
      ${courseId}, ${targetFaculty}, ${expiresAt}
    )
    ON CONFLICT (title, category, course_code, target_faculty)
    DO UPDATE SET
      body = EXCLUDED.body,
      course_id = EXCLUDED.course_id,
      expires_at = EXCLUDED.expires_at,
      updated_at = now()
    RETURNING id, title, category, course_code, target_faculty
  `;
  return { upserted: 1, announcement: row };
}

async function updateCourseMeeting(args) {
  requireObject(args, "arguments");
  const code = normalizeCode(args.courseCode);
  const section = requireString(args.section, "section", { maxLength: 40 }).toUpperCase();
  const day = dayValue(args.dayOfWeek);
  const startTime = timeValue(args.startTime, "startTime");
  const endTime = endTimeOr(startTime, args.endTime);
  const academicYear = optionalString(args.academicYear, "academicYear", {
    fallback: "2026/2027",
    maxLength: 20,
  });
  const semester = optionalString(args.semester, "semester", { fallback: "Fall", maxLength: 20 });
  const meetingType = args.meetingType
    ? enumValue(args.meetingType, "meetingType", MEETING_TYPES)
    : "LECTURE";
  const building = optionalString(args.building, "building", { maxLength: 200 });
  const room = optionalString(args.room, "room", { maxLength: 200 });
  const instructor = optionalString(args.instructor, "instructor", { maxLength: 200 });
  ensureDatabase();

  const courseId = await findCourseId(code);
  if (!courseId) {
    throw new ToolError(
      "UNKNOWN_COURSE",
      `No course row matches ${code}. Seed the course before scheduling a meeting.`,
      { courseCode: code }
    );
  }

  const [row] = await sql`
    INSERT INTO course_meeting (
      id, "courseId", "academicYear", semester, day,
      "startTime", "endTime", building, room, "group", instructor, "meetingType"
    ) VALUES (
      ${randomUUID()}, ${courseId}, ${academicYear}, ${semester}, ${day},
      ${startTime}, ${endTime}, ${building}, ${room}, ${section}, ${instructor}, ${meetingType}
    )
    ON CONFLICT ("courseId", "academicYear", "semester", day, "startTime", "group")
    DO UPDATE SET
      "endTime" = EXCLUDED."endTime",
      building = EXCLUDED.building,
      room = EXCLUDED.room,
      instructor = EXCLUDED.instructor,
      "meetingType" = EXCLUDED."meetingType"
    RETURNING id, "courseId", day, "startTime", "endTime", "group", building, room
  `;
  return { upserted: 1, meeting: row };
}

async function getHubStats() {
  await ensureSchema();
  const [row] = await sql`
    SELECT
      (SELECT count(*) FROM course)::int AS courses,
      (SELECT count(*) FROM faculty_office)::int AS faculty,
      (SELECT count(*) FROM course_meeting)::int AS course_meetings,
      (SELECT count(*) FROM exam)::int AS exams,
      (SELECT count(*) FROM hub_announcement)::int AS announcements
  `;
  return row;
}

const stringProp = { type: "string" };
const optionalDate = { type: "string", description: "ISO date or YYYY-MM-DD" };

const TOOLS = [
  {
    name: "upsert_exams",
    description:
      "Idempotently insert or update exam schedule items. courseCode is normalized (spaces/punctuation stripped, uppercased) and linked to the course table when a match exists. Re-sending the same course/type/date/time updates the row instead of duplicating it.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["items"],
      properties: {
        items: {
          type: "array",
          minItems: 1,
          maxItems: 200,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["courseCode", "examType", "examDate"],
            properties: {
              courseCode: stringProp,
              examType: { type: "string", enum: EXAM_TYPES },
              examDate: optionalDate,
              startTime: { type: "string", description: "HH:MM" },
              endTime: { type: "string", description: "HH:MM" },
              building: stringProp,
              room: stringProp,
              notes: stringProp,
            },
          },
        },
      },
    },
  },
  {
    name: "publish_announcement",
    description:
      "Idempotently publish a university notice. The same title/category/course/faculty combination updates the existing row rather than creating a duplicate.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["title", "body", "category"],
      properties: {
        title: stringProp,
        body: stringProp,
        category: { type: "string", enum: ANNOUNCEMENT_CATEGORIES },
        courseCode: stringProp,
        targetFaculty: { type: "string", description: "e.g. CSIT" },
        expiresAt: { type: "string", description: "ISO timestamp" },
      },
    },
  },
  {
    name: "update_course_meeting",
    description:
      "Add or update a course meeting (including a rescheduled/makeup session or room change) in the existing course_meeting table. section maps to the `group` column and dayOfWeek maps to `day`. The slot key is course/year/semester/day/startTime/section.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["courseCode", "section", "dayOfWeek", "startTime"],
      properties: {
        courseCode: stringProp,
        section: stringProp,
        dayOfWeek: { type: "string", enum: DAYS },
        startTime: { type: "string", description: "HH:MM" },
        endTime: { type: "string", description: "HH:MM; defaults to startTime + 1 hour" },
        building: stringProp,
        room: stringProp,
        instructor: stringProp,
        academicYear: { type: "string", description: "Defaults to 2026/2027" },
        semester: { type: "string", description: "Defaults to Fall" },
        meetingType: { type: "string", enum: MEETING_TYPES },
      },
    },
  },
  {
    name: "get_hub_stats",
    description:
      "Return live Neon row counts for courses, faculty, course meetings, exams, and announcements.",
    inputSchema: { type: "object", additionalProperties: false, properties: {} },
  },
];

const HANDLERS = {
  upsert_exams: upsertExams,
  publish_announcement: publishAnnouncement,
  update_course_meeting: updateCourseMeeting,
  get_hub_stats: getHubStats,
};

function toolResult(value, isError = false) {
  return {
    content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
    ...(isError ? { isError: true } : {}),
  };
}

async function dispatch(message) {
  const { method, params } = message;
  if (method === "initialize") {
    return {
      protocolVersion: params?.protocolVersion ?? "2025-06-18",
      capabilities: { tools: { listChanged: false } },
      serverInfo: SERVER_INFO,
      instructions:
        "Use upsert_exams, publish_announcement, update_course_meeting and get_hub_stats to ingest E-JUST updates into Neon. All writes are idempotent.",
    };
  }
  if (method === "ping") return {};
  if (method === "tools/list") return { tools: TOOLS };
  if (method === "tools/call") {
    const name = params?.name;
    if (!Object.prototype.hasOwnProperty.call(HANDLERS, name)) {
      throw new ToolError("UNKNOWN_TOOL", `Unknown tool: ${name}`, { name });
    }
    try {
      return toolResult(await HANDLERS[name](params?.arguments ?? {}));
    } catch (error) {
      const code = error instanceof ToolError ? error.code : "DATABASE_ERROR";
      return toolResult(
        {
          error: {
            code,
            message: error instanceof Error ? error.message : String(error),
            ...(error instanceof ToolError && error.details ? { details: error.details } : {}),
          },
        },
        true
      );
    }
  }
  const error = new Error(`Method not found: ${method}`);
  error.jsonRpcCode = -32601;
  throw error;
}

function write(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

async function handleLine(line) {
  let message;
  try {
    message = JSON.parse(line);
  } catch {
    write({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } });
    return;
  }
  if (!message || message.jsonrpc !== "2.0" || typeof message.method !== "string") {
    write({
      jsonrpc: "2.0",
      id: message?.id ?? null,
      error: { code: -32600, message: "Invalid request" },
    });
    return;
  }
  if (message.id === undefined) return; // notifications have no response
  try {
    write({ jsonrpc: "2.0", id: message.id, result: await dispatch(message) });
  } catch (error) {
    write({
      jsonrpc: "2.0",
      id: message.id,
      error: {
        code: error.jsonRpcCode ?? -32603,
        message: error instanceof Error ? error.message : String(error),
      },
    });
  }
}

let buffer = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  let newline;
  while ((newline = buffer.indexOf("\n")) !== -1) {
    const line = buffer.slice(0, newline).trim();
    buffer = buffer.slice(newline + 1);
    if (line) void handleLine(line);
  }
});
process.stdin.on("end", () => {
  if (buffer.trim()) void handleLine(buffer.trim());
});
