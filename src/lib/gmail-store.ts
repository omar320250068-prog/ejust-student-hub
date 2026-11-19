/**
 * Neon persistence for the Gmail digest cron.
 *
 * The exam, announcement and meeting tables are owned by the E-JUST Hub MCP
 * server, so this module mirrors its schema and idempotency keys verbatim. A
 * small `processed_gmail_message` ledger is created lazily at runtime; it only
 * records messages whose contents were successfully written, and the database
 * uniqueness constraints remain the final guard against duplicate rows.
 */
import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { saveImportedExams } from "./exam-store";
import type { GmailDigest } from "./gmail-digest";

type NeonSql = ReturnType<typeof neon>;

function getSql(): NeonSql {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is missing.");
  return neon(url);
}

let schemaReady: Promise<void> | null = null;

async function ensureLedgerSchema(sql: NeonSql): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS processed_gmail_message (
          message_id text PRIMARY KEY,
          processed_at timestamptz NOT NULL DEFAULT now()
        )
      `;
    })().catch((error: unknown) => {
      schemaReady = null;
      throw error;
    });
  }
  await schemaReady;
}

async function findCourseId(sql: NeonSql, code: string): Promise<string | null> {
  const rows = (await sql`
    SELECT id FROM course
    WHERE regexp_replace(upper(code), '[^A-Z0-9]', '', 'g') = ${code}
    LIMIT 1
  `) as { id: string }[];
  return rows.length > 0 ? rows[0].id : null;
}

/** Message IDs that were already written to the hub. */
export async function getProcessedGmailIds(ids: readonly string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const sql = getSql();
  await ensureLedgerSchema(sql);
  const rows = (await sql`
    SELECT message_id FROM processed_gmail_message
    WHERE message_id = ANY(${[...ids]})
  `) as { message_id: string }[];
  return rows.map((row) => row.message_id);
}

export interface GmailStoreSummary {
  exams: number;
  announcements: number;
  meetings: number;
  skippedMeetings: number;
}

/** Idempotently write one merged digest to the shared hub tables. */
export async function saveGmailDigest(digest: GmailDigest): Promise<GmailStoreSummary> {
  const sql = getSql();
  const summary: GmailStoreSummary = {
    exams: 0,
    announcements: 0,
    meetings: 0,
    skippedMeetings: 0,
  };

  const savedExams = await saveImportedExams(digest.exams ?? []);
  summary.exams = savedExams.length;

  for (const item of digest.announcements ?? []) {
    const courseId = item.courseCode ? await findCourseId(sql, item.courseCode) : null;
    await sql`
      INSERT INTO hub_announcement (
        id, title, body, category, course_code, course_id, target_faculty, expires_at
      ) VALUES (
        ${randomUUID()}, ${item.title}, ${item.body}, ${item.category}, ${item.courseCode},
        ${courseId}, ${item.targetFaculty}, ${item.expiresAt}
      )
      ON CONFLICT (title, category, course_code, target_faculty)
      DO UPDATE SET
        body = EXCLUDED.body,
        course_id = EXCLUDED.course_id,
        expires_at = EXCLUDED.expires_at,
        updated_at = now()
    `;
    summary.announcements += 1;
  }

  for (const item of digest.scheduleChanges ?? []) {
    const courseId = await findCourseId(sql, item.courseCode);
    if (!courseId) {
      // The MCP server requires a seeded course; skip unknown codes instead of
      // failing the whole digest.
      summary.skippedMeetings += 1;
      continue;
    }
    await sql`
      INSERT INTO course_meeting (
        id, "courseId", "academicYear", semester, day,
        "startTime", "endTime", building, room, "group", instructor, "meetingType"
      ) VALUES (
        ${randomUUID()}, ${courseId}, ${item.academicYear}, ${item.semester}, ${item.day},
        ${item.startTime}, ${item.endTime}, ${item.building}, ${item.room},
        ${item.section}, ${""}, ${item.meetingType}
      )
      ON CONFLICT ("courseId", "academicYear", "semester", day, "startTime", "group")
      DO UPDATE SET
        "endTime" = EXCLUDED."endTime",
        building = EXCLUDED.building,
        room = EXCLUDED.room,
        "meetingType" = EXCLUDED."meetingType"
    `;
    summary.meetings += 1;
  }

  return summary;
}

/** Claim message IDs only after their digest has been persisted. */
export async function markGmailMessagesProcessed(ids: readonly string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const sql = getSql();
  await ensureLedgerSchema(sql);
  for (const id of ids) {
    await sql`
      INSERT INTO processed_gmail_message (message_id) VALUES (${id})
      ON CONFLICT (message_id) DO NOTHING
    `;
  }
  return ids.length;
}
