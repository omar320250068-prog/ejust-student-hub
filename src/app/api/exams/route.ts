import { NextResponse } from "next/server";
import { examRowToUi, normalizeCode, parseCodeList } from "@/lib/hub-feed";
import { findUpcomingExams } from "@/lib/rag/db-retriever";

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
