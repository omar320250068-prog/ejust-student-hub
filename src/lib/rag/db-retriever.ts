import { and, desc, eq, ilike, isNotNull, or, sql, type SQL } from "drizzle-orm";
import { connection } from "next/server";
import { db } from "@/db";
import {
  courseMeetings,
  courses,
  facultyOffices,
  handbooks,
  handbookChunks,
  qaThreads,
  scholarships,
} from "@/db/schema";
import type { KnowledgeDoc } from "./knowledge";
import type { RetrievedDoc } from "./retriever";
import { tokenize } from "./tokenize";

export type DbSourceType = "handbook" | "qa" | "scholarship";

export interface DbHit {
  id: string;
  title: string;
  text: string;
  textAr: string | null;
  sourceType: DbSourceType;
  /** Reciprocal-rank-fusion score across the individual retrievers. */
  score: number;
  metadata: Record<string, string | number | null>;
}

const RRF_K = 60;
const MAX_LIMIT = 20;

function clampLimit(limit: number | undefined, fallback: number): number {
  if (!limit || !Number.isFinite(limit)) return fallback;
  return Math.min(Math.max(Math.trunc(limit), 1), MAX_LIMIT);
}

/**
 * Postgres full-text search over handbook + promoted Q&A chunks.
 *
 * `websearch_to_tsquery` is used instead of `plainto_tsquery` because it accepts
 * quoted phrases and `or`, and never throws on stray operator characters — the
 * assistant's input is free text typed by students.
 */
async function searchChunks(query: string, limit: number) {
  const trimmed = query.trim();
  if (trimmed.length === 0) return [];

  return db
    .select({
      id: handbookChunks.id,
      content: handbookChunks.content,
      contentAr: handbookChunks.contentAr,
      section: handbookChunks.section,
      sourceType: handbookChunks.sourceType,
      sourceId: handbookChunks.sourceId,
      chunkIndex: handbookChunks.chunkIndex,
      handbookTitle: handbooks.title,
      handbookYear: handbooks.academicYear,
      rank: sql<number>`ts_rank_cd(${handbookChunks.tsv}, websearch_to_tsquery('simple', ${trimmed}))`.as(
        "rank"
      ),
    })
    .from(handbookChunks)
    .leftJoin(handbooks, eq(handbooks.id, handbookChunks.handbookId))
    .where(sql`${handbookChunks.tsv} @@ websearch_to_tsquery('simple', ${trimmed})`)
    .orderBy(desc(sql`rank`))
    .limit(limit);
}

/** Verified Q&A answers, matched on both question and answer text. */
async function searchVerifiedQa(query: string, limit: number) {
  const terms = tokenize(query).slice(0, 8);
  if (terms.length === 0) return [];

  const haystack = or(
    ...terms.flatMap((term) => [
      ilike(qaThreads.question, `%${term}%`),
      ilike(qaThreads.taAnswer, `%${term}%`),
      ilike(qaThreads.peerAnswer, `%${term}%`),
    ])
  );

  return db
    .select({
      id: qaThreads.id,
      question: qaThreads.question,
      questionAr: qaThreads.questionAr,
      taAnswer: qaThreads.taAnswer,
      taAnswerAr: qaThreads.taAnswerAr,
      peerAnswer: qaThreads.peerAnswer,
      courseId: qaThreads.courseId,
      verifiedAt: qaThreads.verifiedAt,
    })
    .from(qaThreads)
    .where(and(eq(qaThreads.status, "VERIFIED"), haystack))
    .orderBy(desc(qaThreads.verifiedAt))
    .limit(limit);
}

/** Active scholarships, matched lexically on title/description in either language. */
async function searchScholarships(query: string, limit: number) {
  const terms = tokenize(query).slice(0, 8);
  if (terms.length === 0) return [];

  const haystack = or(
    ...terms.flatMap((term) => [
      ilike(scholarships.title, `%${term}%`),
      ilike(scholarships.titleAr, `%${term}%`),
      ilike(scholarships.description, `%${term}%`),
      ilike(scholarships.provider, `%${term}%`),
    ])
  );

  return db
    .select({
      id: scholarships.id,
      title: scholarships.title,
      titleAr: scholarships.titleAr,
      description: scholarships.description,
      coverageType: scholarships.coverageType,
      coverageValue: scholarships.coverageValue,
      currency: scholarships.currency,
      minCgpa: scholarships.minCgpa,
      applicationDeadline: scholarships.applicationDeadline,
    })
    .from(scholarships)
    .where(and(eq(scholarships.isActive, true), haystack))
    .limit(limit);
}

/**
 * Hybrid retrieval: three independent lexical searches (Postgres FTS over
 * handbook chunks, verified Q&A, and scholarships) fused with reciprocal rank
 * fusion, so no single source's raw score scale can dominate.
 *
 * Embeddings are not populated yet (no `OPENAI_API_KEY`), so `embedding` /
 * `embeddingAr` are deliberately unused — when vectors exist, add a cosine
 * ranking list here and RRF will fold it in without touching callers.
 */
export async function retrieveFromDb(
  query: string,
  options: { limit?: number } = {}
): Promise<DbHit[]> {
  await connection();

  const perSource = clampLimit(options.limit, 6);

  const [chunks, qa, scholarshipRows] = await Promise.all([
    searchChunks(query, perSource),
    searchVerifiedQa(query, perSource),
    searchScholarships(query, perSource),
  ]);

  const fused = new Map<string, DbHit>();

  const addEntry = (hit: Omit<DbHit, "score">, rank: number) => {
    const current = fused.get(hit.id);
    const increment = 1 / (RRF_K + rank);
    if (current) {
      current.score += increment;
      return;
    }
    fused.set(hit.id, { ...hit, score: increment });
  };

  chunks.forEach((chunk, index) => {
    const isQa = chunk.sourceType === "QA";
    addEntry(
      {
        id: chunk.id,
        title: isQa
          ? "Verified student question"
          : (chunk.handbookTitle ?? chunk.section ?? "Handbook passage"),
        text: chunk.content,
        textAr: chunk.contentAr,
        sourceType: "handbook",
        metadata: {
          source: isQa ? "qa" : "handbook",
          section: chunk.section,
          academicYear: chunk.handbookYear,
          chunkIndex: chunk.chunkIndex,
        },
      },
      index + 1
    );
  });

  qa.forEach((thread, index) => {
    const answer = thread.taAnswer ?? thread.peerAnswer ?? "";
    addEntry(
      {
        id: thread.id,
        title: thread.question,
        text: `Q: ${thread.question}\nA: ${answer}`,
        textAr: thread.taAnswerAr,
        sourceType: "qa",
        metadata: {
          source: "qa",
          verifiedAt: thread.verifiedAt ? thread.verifiedAt.toISOString() : null,
        },
      },
      index + 1
    );
  });

  scholarshipRows.forEach((row, index) => {
    addEntry(
      {
        id: row.id,
        title: row.title,
        text: row.description ?? "",
        textAr: row.titleAr,
        sourceType: "scholarship",
        metadata: {
          coverageType: row.coverageType,
          coverageValue: row.coverageValue,
          currency: row.currency,
          minCgpa: row.minCgpa,
          deadline: row.applicationDeadline ?? null,
        },
      },
      index + 1
    );
  });

  const maxScore = Math.max(...[...fused.values()].map((hit) => hit.score), 1e-9);

  return [...fused.values()]
    .map((hit) => ({
      ...hit,
      score: Math.round((hit.score / maxScore) * 400) / 100,
    }))
    .sort((a, b) => b.score - a.score);
}

/** Adapter so DB hits can be ranked alongside the static lexical corpus. */
export function dbHitsToRetrievedDocs(hits: DbHit[]): RetrievedDoc[] {
  return hits.map((hit) => {
    const doc: KnowledgeDoc = {
      id: hit.id,
      title: hit.title,
      category: `db:${hit.sourceType}`,
      text: [hit.text, hit.textAr].filter(Boolean).join("\n"),
      keywords: Object.values(hit.metadata)
        .filter((value): value is string => typeof value === "string")
        .slice(0, 6),
    };
    return { doc, score: hit.score, matched: [] };
  });
}

export interface CourseMeetingQuery {
  courseCode?: string;
  day?: "SUNDAY" | "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "SATURDAY";
  building?: string;
  room?: string;
  academicYear?: string;
  semester?: string;
  limit?: number;
}

/** Direct schedule lookup — deterministic, no ranking. */
export async function findCourseMeetings(query: CourseMeetingQuery = {}) {
  await connection();

  const filters: SQL[] = [];
  if (query.courseCode) filters.push(ilike(courses.code, query.courseCode));
  if (query.day) filters.push(eq(courseMeetings.day, query.day));
  if (query.building) filters.push(ilike(courseMeetings.building, `%${query.building}%`));
  if (query.room) filters.push(ilike(courseMeetings.room, `%${query.room}%`));
  if (query.academicYear) filters.push(eq(courseMeetings.academicYear, query.academicYear));
  if (query.semester) filters.push(eq(courseMeetings.semester, query.semester));

  return db
    .select({
      meetingId: courseMeetings.id,
      courseCode: courses.code,
      courseName: courses.name,
      courseNameAr: courses.nameAr,
      day: courseMeetings.day,
      startTime: courseMeetings.startTime,
      endTime: courseMeetings.endTime,
      building: courseMeetings.building,
      room: courseMeetings.room,
      group: courseMeetings.group,
      meetingType: courseMeetings.meetingType,
      instructor: courseMeetings.instructor,
      taId: courseMeetings.taId,
      academicYear: courseMeetings.academicYear,
      semester: courseMeetings.semester,
    })
    .from(courseMeetings)
    .innerJoin(courses, eq(courses.id, courseMeetings.courseId))
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(courseMeetings.day, courseMeetings.startTime)
    .limit(clampLimit(query.limit, 20));
}

export interface FacultyOfficeQuery {
  name?: string;
  department?: string;
  onlyInOffice?: boolean;
  limit?: number;
}

/** Direct office lookup, including live "is the professor in right now" status. */
export async function findFacultyOffice(query: FacultyOfficeQuery = {}) {
  await connection();

  const filters: SQL[] = [];
  if (query.name) filters.push(ilike(facultyOffices.name, `%${query.name}%`));
  if (query.department) {
    filters.push(ilike(facultyOffices.department, `%${query.department}%`));
  }
  if (query.onlyInOffice) filters.push(eq(facultyOffices.isInOffice, true));

  return db
    .select({
      id: facultyOffices.id,
      name: facultyOffices.name,
      nameAr: facultyOffices.nameAr,
      title: facultyOffices.title,
      department: facultyOffices.department,
      email: facultyOffices.email,
      building: facultyOffices.building,
      officeNumber: facultyOffices.officeNumber,
      officeHours: facultyOffices.officeHours,
      officeHoursNote: facultyOffices.officeHoursNote,
      isInOffice: facultyOffices.isInOffice,
      statusNote: facultyOffices.statusNote,
      statusUpdatedAt: facultyOffices.statusUpdatedAt,
    })
    .from(facultyOffices)
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(desc(facultyOffices.isInOffice), facultyOffices.name)
    .limit(clampLimit(query.limit, 20));
}

export interface CourseQuery {
  query?: string;
  program?: "CSC" | "AID" | "CNC" | "BIF" | "GENERAL";
  level?: number;
  limit?: number;
}

/** Direct course lookup by code, name, or program/level. */
export async function findCourses(query: CourseQuery = {}) {
  await connection();

  const filters: SQL[] = [];
  if (query.query) {
    const term = `%${query.query}%`;
    const match = or(ilike(courses.code, term), ilike(courses.name, term), ilike(courses.nameAr, term));
    if (match) filters.push(match);
  }
  if (query.program) filters.push(eq(courses.program, query.program));
  if (typeof query.level === "number") filters.push(eq(courses.level, query.level));

  return db
    .select({
      id: courses.id,
      code: courses.code,
      name: courses.name,
      nameAr: courses.nameAr,
      program: courses.program,
      level: courses.level,
      creditHours: courses.creditHours,
      isElective: courses.isElective,
      description: courses.description,
    })
    .from(courses)
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(courses.code)
    .limit(clampLimit(query.limit, 20));
}

/** Q&A queue helpers shared by the TA console and the admin verifier. */
export async function listQaQueue(options: {
  status?: "OPEN" | "ESCALATED" | "ASSIGNED" | "PEER_ANSWERED" | "TA_ANSWERED";
  assignedTaId?: string;
  courseId?: string;
  limit?: number;
} = {}) {
  await connection();

  const filters: SQL[] = [];
  if (options.status) filters.push(eq(qaThreads.status, options.status));
  if (options.assignedTaId) filters.push(eq(qaThreads.assignedTaId, options.assignedTaId));
  if (options.courseId) filters.push(eq(qaThreads.courseId, options.courseId));

  return db
    .select()
    .from(qaThreads)
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(desc(qaThreads.createdAt))
    .limit(clampLimit(options.limit, 20));
}

/** Approved, verified answers only — what the assistant is allowed to cite. */
export async function listVerifiedAnswers(limit = 20) {
  await connection();

  return db
    .select({
      id: qaThreads.id,
      question: qaThreads.question,
      answer: sql<string>`coalesce(${qaThreads.taAnswer}, ${qaThreads.peerAnswer})`,
      verifiedAt: qaThreads.verifiedAt,
      promotedChunkId: qaThreads.promotedChunkId,
    })
    .from(qaThreads)
    .where(and(eq(qaThreads.status, "VERIFIED"), isNotNull(qaThreads.verifiedAt)))
    .orderBy(desc(qaThreads.verifiedAt))
    .limit(clampLimit(limit, 20));
}

/** Cheap inventory so callers can confirm the DB is actually wired up. */
export async function countDbSources() {
  await connection();

  const [row] = await db
    .select({
      courses: sql<number>`(select count(*) from ${courses})`.mapWith(Number),
      meetings: sql<number>`(select count(*) from ${courseMeetings})`.mapWith(Number),
      offices: sql<number>`(select count(*) from ${facultyOffices})`.mapWith(Number),
      scholarships: sql<number>`(select count(*) from ${scholarships})`.mapWith(Number),
      chunks: sql<number>`(select count(*) from ${handbookChunks})`.mapWith(Number),
      verifiedAnswers: sql<number>`(select count(*) from ${qaThreads} where ${qaThreads.status} = 'VERIFIED')`.mapWith(
        Number
      ),
      announcements: sql<number>`(select count(*) from course_announcement)`.mapWith(Number),
    })
    .from(sql`(select 1) as probe`);

  return row;
}
