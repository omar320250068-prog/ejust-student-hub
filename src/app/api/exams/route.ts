import { NextResponse } from "next/server";
import { normalizeImportedRows, type ImportedExamRow } from "@/lib/exam-import";
import { examRowToUi, normalizeCode, parseCodeList } from "@/lib/hub-feed";
import { findUpcomingExams } from "@/lib/rag/db-retriever";
import { saveImportedExams } from "@/lib/exam-store";

const MAX_ROWS_PER_REQUEST = 100;

/** Upcoming exams from the MCP-owned `exam` table, joined with `course`. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get("limit") ?? 50);
  const codes = parseCodeList(searchParams.get("codes"));

  try {
    const rows = await findUpcomingExams(Number.isFinite(limit) ? limit : 50);
    const exams = rows.map(examRowToUi);
    const syncedCourseCodes = [...new Set(
      exams
        .map((exam) => normalizeCode(exam.courseCode))
        .filter((code) => codes.includes(code))
    )];

    return NextResponse.json(
      { exams, syncedCourseCodes, available: true },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json(
      { exams: [], syncedCourseCodes: [], available: false },
      { headers: { "Cache-Control": "no-store" } }
    );
  }
}

/** Crowd-sourced exam import; idempotent on the database's exam intent key. */
export async function POST(request: Request) {
  let body: { exams?: unknown; rows?: unknown };
  try {
    body = (await request.json()) as { exams?: unknown; rows?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const raw = Array.isArray(body.exams)
    ? body.exams
    : Array.isArray(body.rows)
      ? body.rows
      : null;
  if (!raw || raw.length === 0) {
    return NextResponse.json({ error: "Provide a non-empty 'exams' array." }, { status: 400 });
  }
  if (raw.length > MAX_ROWS_PER_REQUEST) {
    return NextResponse.json({ error: "Too many exams in one import." }, { status: 413 });
  }

  const rows: ImportedExamRow[] = normalizeImportedRows(raw as Record<string, unknown>[]);
  if (rows.length === 0) {
    return NextResponse.json({ error: "No valid exam rows found." }, { status: 400 });
  }

  try {
    const saved = await saveImportedExams(rows);
    return NextResponse.json({ saved: saved.length, exams: saved }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Could not save exams right now." }, { status: 503 });
  }
}
