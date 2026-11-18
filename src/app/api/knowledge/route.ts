import { NextResponse } from "next/server";
import { hybridRetrieve, knowledgeBase } from "@/lib/rag/knowledge";
import { examRowToUi, filterActiveNotices, normalizeCode } from "@/lib/hub-feed";
import {
  countDbSources,
  facultyQueryTokens,
  findActiveAnnouncements,
  findCourseMeetings,
  findCourses,
  findFacultyOffice,
  findUpcomingExams,
  type CourseMeetingQuery,
} from "@/lib/rag/db-retriever";
import { consumeAiQuota } from "@/lib/merit-server";
import { getViewer } from "@/lib/permissions";

const OFFICE_INTENT = /office|room|\bdr\.?\b|\bdoctor\b|\bprof(?:essor)?\b|مكتب|دكتور|د\./i;
const COURSE_INTENT = /\b(CSC|AID|CNC|BIF|LRA|MTH|PHY|FR|ECE|CSE|ACM)\b\s*\d{0,3}\b/i;
const COURSE_CODE = /\b([A-Z]{2,5})\s*-?\s*(\d{3})\b/i;
const SCHEDULE_INTENT = /schedule|timetable|\bclass(?:es)?\b|\blec(?:ture)?s?\b|\blab\b|\btutorial\b|\bwhen\b|\bday\b|جدول|محاضرة|معمل|شعبة|時間割|授業/i;
const EXAM_INTENT = /\bexams?\b|\bexamination\b|\bmidterms?\b|\bquizzes\b|\bquiz\b|\bfinal exam\b|امتحان|اختبار|نصف العام|試験|テスト/i;
const ANNOUNCEMENT_INTENT = /\bannouncements?\b|\bnotices?\b|\bnews\b|\bupdates?\b|إعلان|إعلانات|تنبيه|أخبار|お知らせ|告知/i;

type ScheduleDay = NonNullable<CourseMeetingQuery["day"]>;

const DAY_PATTERNS: [RegExp, ScheduleDay][] = [
  [/\b(sat(?:urday)?)\b|السبت|土曜/i, "SATURDAY"],
  [/\b(sun(?:day)?)\b|الأحد|الاحد|日曜/i, "SUNDAY"],
  [/\b(mon(?:day)?)\b|الاثنين|الإثنين|月曜/i, "MONDAY"],
  [/\b(tue(?:s|sday)?)\b|الثلاثاء|火曜/i, "TUESDAY"],
  [/\b(wed(?:nesday)?)\b|الأربعاء|الاربعاء|水曜/i, "WEDNESDAY"],
  [/\b(thu(?:r(?:s|rsday)?|rsday)?)\b|الخميس|木曜/i, "THURSDAY"],
];

function scheduleQuery(query: string): { courseCode?: string; day?: ScheduleDay } | null {
  if (!SCHEDULE_INTENT.test(query)) return null;
  const codeMatch = query.match(COURSE_CODE);
  const day = DAY_PATTERNS.find(([pattern]) => pattern.test(query))?.[1];
  const courseCode = codeMatch ? `${codeMatch[1].toUpperCase()} ${codeMatch[2]}` : undefined;
  if (!courseCode && !day) return null;
  return { courseCode, day };
}

type OfficeRow = Awaited<ReturnType<typeof findFacultyOffice>>[number];
type CourseRow = Awaited<ReturnType<typeof findCourses>>[number];
type LiveFieldKey = "name" | "title" | "department" | "location" | "email" | "officeHours" | "status" | "program" | "level" | "credits" | "prerequisites" | "description" | "date" | "type" | "category" | "expires";
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
    { key: "department", value: row.department },
    ...(row.email ? [{ key: "email" as const, value: row.email }] : []),
    { key: "officeHours", value: hours || row.officeHoursNote || "—" },
    { key: "status", value: row.isInOffice ? "yes" : "no" },
    ...(row.statusNote ? [{ key: "status" as const, value: row.statusNote }] : []),
  ];
  return fields.filter((field) => field.value.trim().length > 0);
}

function courseFields(row: CourseRow): LiveField[] {
  // The curriculum ingest stores prerequisites inside `description`; surface
  // just that detail instead of repeating the whole generated paragraph.
  const prerequisites = row.description?.match(/Prerequisites:\s*([^.]+)/i)?.[1]?.trim();
  const fields: LiveField[] = [
    { key: "program", value: row.program },
    ...(row.creditHours !== null ? [{ key: "credits" as const, value: String(row.creditHours) }] : []),
    ...(prerequisites ? [{ key: "prerequisites" as const, value: prerequisites }] : []),
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

    if (lookup === "exams") {
      const rows = await findUpcomingExams(limit);
      return NextResponse.json({ lookup, exams: rows.map(examRowToUi) });
    }

    if (lookup === "notices") {
      const rows = await findActiveAnnouncements({ limit });
      return NextResponse.json({ lookup, notices: filterActiveNotices(rows) });
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
  const schedule = scheduleQuery(query);
  const wantsExams = EXAM_INTENT.test(query);
  const wantsNotices = ANNOUNCEMENT_INTENT.test(query);

  const [fused, officeHits, courseHits, scheduleMeetings, examRows, noticeRows] = await Promise.all([
    hybridRetrieve(query, 8),
    officeName
      ? findFacultyOffice({ name: officeName, limit: 5 }).catch(() => [])
      : Promise.resolve([]),
    courseCode
      ? findCourses({ query: courseCode, limit: 5 }).catch(() => [])
      : Promise.resolve([]),
    schedule
      ? findCourseMeetings({
          ...schedule,
          academicYear: "2026/2027",
          semester: "Fall",
          limit: 12,
        }).catch(() => [])
      : Promise.resolve([]),
    wantsExams
      ? findUpcomingExams(20).catch(() => [])
      : Promise.resolve([]),
    wantsNotices
      ? findActiveAnnouncements({ limit: 20 }).catch(() => [])
      : Promise.resolve([]),
  ]);

  const examHits = courseCode
    ? examRows.filter((row) => normalizeCode(row.courseCode) === normalizeCode(courseCode))
    : examRows;
  const noticeHits = courseCode
    ? noticeRows.filter(
        (row) => !row.courseCode || normalizeCode(row.courseCode) === normalizeCode(courseCode)
      )
    : noticeRows;

  const live: FusedEntry[] = [
    ...officeHits.map((row, index) => ({
      id: `office:${row.id}`,
      title: row.nameAr ? `${row.name} / ${row.nameAr}` : row.name,
      category: "live-db",
      sourceType: "live-db",
      // Name is the card title and location is the subtitle; the body only
      // adds details that are not already visible.
      snippet: `${row.building}, ${row.officeNumber}`,
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
    ...examHits.map((row, index) => {
      const exam = examRowToUi(row);
      return {
        id: `exam:${row.id}`,
        title: `${exam.courseCode} — ${row.courseName ?? exam.title}`,
        category: "live-db",
        sourceType: "exam",
        snippet: [exam.location !== "TBA" ? exam.location : "", exam.notes ?? ""]
          .filter(Boolean)
          .join(" · "),
        rrf: 80 - index,
        fields: [
          {
            key: "date" as const,
            value: new Date(exam.date).toLocaleString("en-GB", {
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            }),
          },
          { key: "type" as const, value: exam.type },
          { key: "location" as const, value: exam.location },
        ],
      };
    }),
    ...noticeHits.map((row, index) => ({
      id: `notice:${row.id}`,
      title: row.title,
      category: "live-db",
      sourceType: "announcement",
      snippet: row.body,
      rrf: 70 - index,
      fields: [
        { key: "category" as const, value: row.category.replace(/_/g, " ") },
        ...(row.courseCode
          ? [
              {
                key: "title" as const,
                value: `${row.courseCode}${row.courseName ? ` · ${row.courseName}` : ""}`,
              },
            ]
          : []),
        ...(row.expiresAt
          ? [
              {
                key: "expires" as const,
                value: new Date(row.expiresAt).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                }),
              },
            ]
          : []),
      ],
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

  // A direct faculty/course hit answers the question precisely: suppress the
  // hybrid handbook/FAQ results, which only matched generic words such as
  // "مكتب" or "office". When intent produced no entity hit (or this was a
  // general question), keep the full Hybrid RAG ranking as the fallback.
  const combined = live.length > 0 ? live : ranked;

  return NextResponse.json({
    query,
    quota,
    lookup: scheduleMeetings.length > 0 ? "schedule" : null,
    meetings: scheduleMeetings,
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
