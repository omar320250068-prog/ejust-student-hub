import { createHmac, timingSafeEqual } from "node:crypto";
import { sql } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { courses, studentAcademicRecords } from "@/db/schema";
import {
  parseSisDocument,
  type SisCourseStatus,
  type SisSummaryMetadata,
  type SisTableType,
} from "@/lib/sis-parser";
import {
  GPA_POINTS,
  GRADUATION_CREDITS,
  type SyncedCourse,
  type SyncSummary,
} from "@/lib/sis-sync";

/**
 * SIS Course & GPA sync endpoint.
 *
 * Authentication is either the active hub session (in-app guide) or a signed
 * bearer token derived from AUTH_SECRET (browser extension). The token carries
 * the user id and an HMAC signature, so no extra user column is needed.
 */

function syncSecret(): string {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not configured");
  return secret;
}

function createSyncToken(userId: string): string {
  const signature = createHmac("sha256", syncSecret())
    .update(userId)
    .digest("base64url");
  return `${userId}.${signature}`;
}

function verifySyncToken(token: string): string | null {
  const separator = token.indexOf(".");
  if (separator < 1) return null;
  const userId = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  const expected = createHmac("sha256", syncSecret())
    .update(userId)
    .digest("base64url");

  const receivedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    receivedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(receivedBuffer, expectedBuffer)
  ) {
    return null;
  }
  return userId;
}

async function resolveUserId(request: NextRequest): Promise<string | null> {
  const header = request.headers.get("authorization");
  if (header?.toLowerCase().startsWith("bearer ")) {
    // An explicit token always defines the identity; an invalid one must not
    // silently fall back to a different session.
    return verifySyncToken(header.slice(7).trim());
  }
  const session = await auth();
  return session?.user?.id ?? null;
}

function normalizeCode(code: string): string {
  return code.replace(/[^A-Z0-9]/gi, "").toUpperCase();
}

function normalizeGrade(grade: unknown): string | null {
  if (typeof grade !== "string") return null;
  const value = grade.trim().toUpperCase();
  return value.length > 0 ? value : null;
}

interface IncomingCourse {
  courseCode: string;
  courseName?: string | null;
  creditHours?: number | null;
  grade?: string | null;
  semester?: string | null;
  status?: SisCourseStatus;
  sections?: string[];
}

function normalizeCourses(input: IncomingCourse[]): IncomingCourse[] {
  const result: IncomingCourse[] = [];
  for (const course of input) {
    const courseCode = String(course.courseCode ?? "")
      .replace(/\s+/g, " ")
      .trim()
      .toUpperCase();
    if (!/[A-Z]{2,4}\s*-?\s*\d{3}/.test(courseCode)) continue;

    const grade = normalizeGrade(course.grade);
    const credits = Number(course.creditHours);
    const semester = String(course.semester ?? "").trim() || "Unspecified";
    result.push({
      courseCode,
      courseName: typeof course.courseName === "string" ? course.courseName.trim() : "",
      creditHours: Number.isFinite(credits) && credits >= 1 && credits <= 6 ? credits : null,
      grade,
      semester,
      status: grade ? "completed" : (course.status ?? "registered"),
      sections: Array.isArray(course.sections)
        ? course.sections.filter((section) => typeof section === "string")
        : undefined,
    });
  }
  return result;
}

async function enrichFromCatalog(
  input: IncomingCourse[],
  preferOfficial: boolean
): Promise<IncomingCourse[]> {
  if (input.length === 0) return input;

  const catalogRows = await db
    .select({
      code: courses.code,
      name: courses.name,
      creditHours: courses.creditHours,
    })
    .from(courses);

  const catalog = new Map<string, { name: string; creditHours: number }>();
  for (const row of catalogRows) {
    const key = normalizeCode(row.code);
    if (!key || catalog.has(key)) continue;
    catalog.set(key, { name: row.name, creditHours: row.creditHours });
  }

  return input.map((course) => {
    const official = catalog.get(normalizeCode(course.courseCode));
    if (!official) return { ...course, courseName: course.courseName || null };
    return {
      ...course,
      // The catalog is authoritative in the preview; on save we only fill
      // blanks so edits made in the preview table are preserved.
      courseName: preferOfficial || !course.courseName ? official.name : course.courseName,
      creditHours: preferOfficial || course.creditHours === null ? official.creditHours : course.creditHours,
    };
  });
}

function computeSummary(allCourses: SyncedCourse[]): SyncSummary {
  let weightedPoints = 0;
  let gradedCredits = 0;
  let earnedCredits = 0;

  for (const course of allCourses) {
    if (course.status !== "completed") continue;
    const credits = Number(course.creditHours) || 0;
    if (credits <= 0) continue;

    const points = GPA_POINTS[normalizeGrade(course.grade) ?? ""];
    if (points === undefined) continue;

    // F counts in the CGPA denominator (0 points) but is not earned credit.
    weightedPoints += points * credits;
    gradedCredits += credits;
    if (normalizeGrade(course.grade) !== "F") earnedCredits += credits;
  }

  const cgpa =
    gradedCredits > 0 ? Math.round((weightedPoints / gradedCredits) * 100) / 100 : 0;
  const remainingCredits = Math.max(0, GRADUATION_CREDITS - earnedCredits);
  const progressPercent = Math.min(
    100,
    Math.round((earnedCredits / GRADUATION_CREDITS) * 100)
  );

  return {
    cgpa,
    completedCredits: earnedCredits,
    remainingCredits,
    progressPercent,
    courseCount: allCourses.length,
  };
}

function toSyncedCourse(
  row: typeof studentAcademicRecords.$inferSelect
): SyncedCourse {
  return {
    id: row.id,
    courseCode: row.courseCode,
    courseName: row.courseName,
    creditHours: row.creditHours,
    grade: row.grade,
    semester: row.semester,
    status: row.status,
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function loadCourses(userId: string): Promise<SyncedCourse[]> {
  const rows = await db
    .select()
    .from(studentAcademicRecords)
    .where(sql`${studentAcademicRecords.userId} = ${userId}`)
    .orderBy(studentAcademicRecords.courseCode);
  return rows.map(toSyncedCourse);
}

export async function GET(request: NextRequest) {
  let userId: string | null;
  try {
    userId = await resolveUserId(request);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Authentication error" },
      { status: 500 }
    );
  }
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const allCourses = await loadCourses(userId);
    const summary = computeSummary(allCourses);
    return NextResponse.json({
      courses: allCourses,
      summary,
      // Flat aliases keep the lightweight extension contract simple.
      cgpa: summary.cgpa,
      completedCredits: summary.completedCredits,
      syncToken: createSyncToken(userId),
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("student sync GET failed", error);
    return NextResponse.json({ error: "Could not load synced courses" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  let userId: string | null;
  try {
    userId = await resolveUserId(request);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Authentication error" },
      { status: 500 }
    );
  }
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    rawText?: unknown;
    courses?: unknown;
    dryRun?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const dryRun = body.dryRun === true;
  let incoming: IncomingCourse[];
  let metadata: SisSummaryMetadata | null = null;
  let tableType: SisTableType = "unknown";

  if (Array.isArray(body.courses)) {
    incoming = normalizeCourses(body.courses as IncomingCourse[]);
  } else if (typeof body.rawText === "string") {
    const parsed = parseSisDocument(body.rawText);
    incoming = normalizeCourses(parsed.courses);
    metadata = parsed.metadata;
    tableType = parsed.tableType;
  } else {
    return NextResponse.json(
      { error: "Provide rawText or courses" },
      { status: 400 }
    );
  }

  if (incoming.length === 0) {
    return NextResponse.json(
      { error: "No valid E-JUST courses were found in the pasted text" },
      { status: 400 }
    );
  }

  try {
    // Raw-text imports (extension and preview) get authoritative catalog data;
    // an explicit edited course list keeps the student's changes.
    const preferOfficial = dryRun || !Array.isArray(body.courses);
    const enriched = await enrichFromCatalog(incoming, preferOfficial);

    if (dryRun) {
      return NextResponse.json({ courses: enriched, metadata, tableType });
    }

    const now = new Date();
    await db
      .insert(studentAcademicRecords)
      .values(
        enriched.map((course) => ({
          userId,
          courseCode: course.courseCode,
          courseName: course.courseName || course.courseCode,
          creditHours: course.creditHours ?? 3,
          grade: course.grade,
          semester: course.semester || "Unspecified",
          status: course.status ?? "registered",
          updatedAt: now,
        }))
      )
      .onConflictDoUpdate({
        target: [
          studentAcademicRecords.userId,
          studentAcademicRecords.courseCode,
          studentAcademicRecords.semester,
        ],
        set: {
          courseName: sql`excluded."courseName"`,
          creditHours: sql`excluded."creditHours"`,
          grade: sql`excluded."grade"`,
          status: sql`excluded."status"`,
          updatedAt: now,
        },
      });

    const allCourses = await loadCourses(userId);
    const summary = computeSummary(allCourses);
    return NextResponse.json({
      courses: allCourses,
      summary,
      cgpa: summary.cgpa,
      completedCredits: summary.completedCredits,
      syncToken: createSyncToken(userId),
      syncedAt: now.toISOString(),
      metadata,
      tableType,
    });
  } catch (error) {
    console.error("student sync POST failed", error);
    return NextResponse.json({ error: "Could not save synced courses" }, { status: 500 });
  }
}
