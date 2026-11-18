import { NextResponse } from "next/server";
import { filterActiveNotices, parseCodeList } from "@/lib/hub-feed";
import { findActiveAnnouncements } from "@/lib/rag/db-retriever";

/** Active notices from `hub_announcement`, scoped to faculty and synced courses. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const faculty = (searchParams.get("faculty") ?? "CSIT").toUpperCase();
  const codes = parseCodeList(searchParams.get("codes"));
  const limit = Number(searchParams.get("limit") ?? 50);

  try {
    const rows = await findActiveAnnouncements({
      faculty,
      limit: Number.isFinite(limit) ? limit : 50,
    });
    const notices = filterActiveNotices(rows, { faculty, codes });

    return NextResponse.json(
      { notices, available: true },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json(
      { notices: [], available: false },
      { headers: { "Cache-Control": "no-store" } }
    );
  }
}
