import { NextResponse } from "next/server";
import { hybridRetrieve, knowledgeBase } from "@/lib/rag/knowledge";
import {
  countDbSources,
  findCourseMeetings,
  findCourses,
  findFacultyOffice,
} from "@/lib/rag/db-retriever";
import { consumeAiQuota } from "@/lib/merit-server";
import { getViewer } from "@/lib/permissions";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") ?? "").trim().slice(0, 500);
  const lookup = searchParams.get("lookup");

  if (lookup) {
    const limit = Number(searchParams.get("limit") ?? 10);

    if (lookup === "schedule") {
      const meetings = await findCourseMeetings({
        courseCode: searchParams.get("code") ?? undefined,
        day: (searchParams.get("day") as never) ?? undefined,
        building: searchParams.get("building") ?? undefined,
        room: searchParams.get("room") ?? undefined,
        limit,
      });
      return NextResponse.json({ lookup, meetings });
    }

    if (lookup === "office") {
      const offices = await findFacultyOffice({
        name: searchParams.get("name") ?? undefined,
        department: searchParams.get("department") ?? undefined,
        onlyInOffice: searchParams.get("inOffice") === "1",
        limit,
      });
      return NextResponse.json({ lookup, offices });
    }

    if (lookup === "courses") {
      const rows = await findCourses({
        query: searchParams.get("code") ?? searchParams.get("name") ?? undefined,
        program: (searchParams.get("program") as never) ?? undefined,
        level: searchParams.get("level") ? Number(searchParams.get("level")) : undefined,
        limit,
      });
      return NextResponse.json({ lookup, courses: rows });
    }

    return NextResponse.json({ error: "unknown lookup" }, { status: 400 });
  }

  if (!query) {
    const docs = knowledgeBase();
    const byCategory: Record<string, number> = {};
    for (const doc of docs) {
      byCategory[doc.category] = (byCategory[doc.category] ?? 0) + 1;
    }

    const dbCounts = await countDbSources().catch(() => null);

    return NextResponse.json({
      documents: docs.length,
      byCategory,
      retriever: "bm25-local+db-fts-rrf",
      db: dbCounts,
    });
  }

  let quota: { used: number; limit: number } | null = null;
  const viewer = await getViewer();

  if (viewer) {
    const usage = await consumeAiQuota(
      viewer.userId,
      viewer.effectiveTier,
      viewer.privileges.aiQuota
    );

    if (!usage.allowed) {
      return NextResponse.json(
        {
          error: "Daily assistant limit reached",
          tier: viewer.effectiveTier,
          used: usage.used,
          quota: usage.quota,
        },
        { status: 429 }
      );
    }

    quota = { used: usage.used + 1, limit: usage.quota };
  }

  const fused = await hybridRetrieve(query, 8);
  return NextResponse.json({
    query,
    quota,
    results: fused
      .filter((entry) => !entry.doc.category.startsWith("db:"))
      .map((entry) => ({
        id: entry.doc.id,
        title: entry.doc.title,
        category: entry.doc.category,
        score: Number(entry.score.toFixed(3)),
        matched: entry.matched,
      })),
    dbResults: fused
      .filter((entry) => entry.doc.category.startsWith("db:"))
      .map((entry) => ({
        id: entry.doc.id,
        title: entry.doc.title,
        sourceType: entry.doc.category.slice(3),
        score: Number(entry.score.toFixed(3)),
      })),
    fused: fused.map((entry) => ({
      id: entry.doc.id,
      title: entry.doc.title,
      category: entry.doc.category,
      rrf: Number(entry.score.toFixed(3)),
    })),
  });
}
