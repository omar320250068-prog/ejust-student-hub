import { NextResponse } from "next/server";
import { hybridRetrieve, knowledgeBase } from "@/lib/rag/knowledge";
import {
  countDbSources,
  facultyQueryTokens,
  findCourseMeetings,
  findCourses,
  findFacultyOffice,
} from "@/lib/rag/db-retriever";
import { consumeAiQuota } from "@/lib/merit-server";
import { getViewer } from "@/lib/permissions";

const OFFICE_INTENT = /office|room|\bdr\.?\b|\bdoctor\b|\bprof(?:essor)?\b|مكتب|دكتور|د\./i;
const COURSE_INTENT = /\b(CSC|AID|CNC|BIF|LRA|MTH|PHY|FR)\b\s*\d{0,3}\b/i;

type OfficeRow = Awaited<ReturnType<typeof findFacultyOffice>>[number];
type CourseRow = Awaited<ReturnType<typeof findCourses>>[number];
type LiveFieldKey = "name" | "title" | "department" | "location" | "email" | "officeHours" | "status" | "program" | "level" | "credits" | "description";
type LiveField = { key: LiveFieldKey; value: string };

interface FusedEntry {
  id: string;
  title: string;
  category: string;
  sourceType: string;
  snippet: string;
  rrf: number;
  fields?: LiveField[];
}

function officeFields(row: OfficeRow): LiveField[] {
  const hours = row.officeHours
    .map((slot) => `${slot.day} ${slot.start}-${slot.end}`)
    .join(", ");
  const fields: LiveField[] = [
    { key: "name", value: row.nameAr ? `${row.name} / ${row.nameAr}` : row.name },
    ...(row.title ? [{ key: "title" as const, value: row.title }] : []),
    { key: "department", value: row.department },
    { key: "location", value: `${row.building}, ${row.officeNumber}` },
    ...(row.email ? [{ key: "email" as const, value: row.email }] : []),
    { key: "officeHours", value: hours || row.officeHoursNote || "—" },
    { key: "status", value: row.isInOffice ? "yes" : "no" },
    ...(row.statusNote ? [{ key: "status" as const, value: row.statusNote }] : []),
  ];
  return fields.filter((field) => field.value.trim().length > 0);
}

function courseFields(row: CourseRow): LiveField[] {
  const fields: LiveField[] = [
    ...(row.name ? [{ key: "name" as const, value: row.name }] : []),
    ...(row.nameAr ? [{ key: "name" as const, value: row.nameAr }] : []),
    { key: "program", value: row.program },
    ...(row.level !== null ? [{ key: "level" as const, value: String(row.level) }] : []),
    ...(row.creditHours !== null ? [{ key: "credits" as const, value: String(row.creditHours) }] : []),
    ...(row.description ? [{ key: "description" as const, value: row.description }] : []),
  ];
  return fields.filter((field) => field.value.trim().length > 0);
}

function cleanSnippet(text: string): string {
  return text
    .replace(/^\s*(?:Q|Question|A|Answer|السؤال|الإجابة)\s*[:\-]\s*/gim, "")
    .replace(/\s+/g, " ")
    .trim();
}

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
      // The pill sends `name`, while direct/API callers send `q`; accept both.
      const officeQuery = searchParams.get("name") || query;
      const tokens = facultyQueryTokens(officeQuery);
      const offices = await findFacultyOffice({
        name: tokens.length > 0 ? tokens.join(" ") : undefined,
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

  const officeName = OFFICE_INTENT.test(query) ? facultyQueryTokens(query).join(" ") : "";
  const courseCode = query.match(COURSE_INTENT)?.[0] ?? "";

  const [fused, officeHits, courseHits] = await Promise.all([
    hybridRetrieve(query, 8),
    officeName
      ? findFacultyOffice({ name: officeName, limit: 5 }).catch(() => [])
      : Promise.resolve([]),
    courseCode
      ? findCourses({ query: courseCode, limit: 5 }).catch(() => [])
      : Promise.resolve([]),
  ]);

  const live: FusedEntry[] = [
    ...officeHits.map((row, index) => ({
      id: `office:${row.id}`,
      title: row.nameAr ? `${row.name} / ${row.nameAr}` : row.name,
      category: "live-db",
      sourceType: "live-db",
      snippet: [row.department, `${row.building}, ${row.officeNumber}`].join(" · "),
      rrf: 100 - index,
      fields: officeFields(row),
    })),
    ...courseHits.map((row, index) => ({
      id: `course:${row.id}`,
      title: row.code,
      category: "live-db",
      sourceType: "live-db",
      snippet: row.name ?? row.nameAr ?? "",
      rrf: 90 - index,
      fields: courseFields(row),
    })),
  ];

  const ranked: FusedEntry[] = fused.map((entry) => ({
    id: entry.doc.id,
    title: entry.doc.title,
    category: entry.doc.category,
    sourceType: entry.doc.category.startsWith("db:")
      ? entry.doc.category.slice(3)
      : "static",
    snippet: cleanSnippet(entry.doc.text).slice(0, 2000),
    rrf: Number(entry.score.toFixed(3)),
  }));

  const seen = new Set(live.map((entry) => entry.id));
  const combined = [
    ...live,
    ...ranked.filter((entry) => !seen.has(entry.id)),
  ];

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
    fused: combined,
  });
}
