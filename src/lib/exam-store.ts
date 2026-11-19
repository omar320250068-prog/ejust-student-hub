/**
 * Persistence for crowd-sourced exam imports.
 *
 * The `exam` table is owned by the E-JUST Hub MCP server, so this module uses
 * the same schema and idempotency key as `mcp/ejust-hub-server.mjs`. Keeping the
 * raw SQL here lets the API route stay a thin HTTP adapter.
 */
import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import type { ImportedExamRow } from "./exam-import";

type NeonSql = ReturnType<typeof neon>;

function getSql(): NeonSql {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is missing.");
  return neon(url);
}

let schemaReady: Promise<void> | null = null;

async function ensureExamSchema(sql: NeonSql): Promise<void> {
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
      await sql`CREATE INDEX IF NOT EXISTS exam_date_idx ON exam (exam_date)`;
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

export interface SavedExam {
  id: string;
  courseCode: string;
  examType: string;
  examDate: string;
  startTime: string;
  endTime: string;
}

/** Insert imported exams idempotently; repeated imports update location only. */
export async function saveImportedExams(rows: readonly ImportedExamRow[]): Promise<SavedExam[]> {
  if (rows.length === 0) return [];
  const sql = getSql();
  await ensureExamSchema(sql);

  const saved: SavedExam[] = [];
  for (const row of rows) {
    const courseId = await findCourseId(sql, row.courseCode);
    const [exam] = (await sql`
      INSERT INTO exam (
        id, course_id, course_code, exam_type, exam_date,
        start_time, end_time, building, room, notes
      ) VALUES (
        ${randomUUID()}, ${courseId}, ${row.courseCode}, ${row.examType}, ${row.examDate},
        ${row.startTime}, ${row.endTime}, ${row.building}, ${row.room}, ${null}
      )
      ON CONFLICT (course_code, exam_type, exam_date, start_time, end_time)
      DO UPDATE SET
        course_id = EXCLUDED.course_id,
        building = EXCLUDED.building,
        room = EXCLUDED.room,
        updated_at = now()
      RETURNING id, course_code AS "courseCode", exam_type AS "examType",
        exam_date AS "examDate", start_time AS "startTime", end_time AS "endTime"
    `) as SavedExam[];
    saved.push(exam);
  }
  return saved;
}
