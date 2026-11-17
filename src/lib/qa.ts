import "server-only";
import { connection } from "next/server";
import { and, count, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { handbookChunks, qaThreads } from "@/db/schema";
import { answer } from "./rag/answer";
import { hybridRetrieve } from "./rag/knowledge";
import { creditMerit, getStudentTier } from "./merit-server";
import { MERIT_AWARDS } from "./merit";

export type AnswerKind = "peer" | "ta";

const CONFIDENCE_SCORE: Record<string, string> = {
  high: "0.900",
  medium: "0.600",
  low: "0.300",
  none: "0.000",
};

const PEER_ANSWERABLE: ("OPEN" | "ESCALATED" | "ASSIGNED" | "PEER_ANSWERED")[] = [
  "OPEN",
  "ESCALATED",
  "ASSIGNED",
  "PEER_ANSWERED",
];

export interface AskInput {
  userId: string;
  question: string;
  questionAr?: string | null;
  courseId?: string | null;
  language?: "EN" | "AR" | "MIXED";
}

/**
 * Create a question and attach a first-pass assistant answer.
 *
 * The assistant answer is stored on the thread so an admin verifier can see
 * what the student was told before the answer was escalated, and so a verified
 * correction replaces a wrong one rather than silently competing with it.
 */
export async function askQuestion(input: AskInput) {
  await connection();

  const retrievalAnswer = answer(input.question);
  const [row] = await db
    .insert(qaThreads)
    .values({
      userId: input.userId,
      courseId: input.courseId ?? null,
      question: input.question,
      questionAr: input.questionAr ?? null,
      language: input.language ?? "EN",
      status: "OPEN",
      ragAnswer: retrievalAnswer.text,
      ragConfidence: CONFIDENCE_SCORE[retrievalAnswer.confidence],
      ragDocIds: retrievalAnswer.sources.map((source) => source.doc.id),
      updatedAt: new Date(),
    })
    .returning();

  return row;
}

export async function listThreads(options: {
  userId?: string;
  statuses?: ("OPEN" | "ASSIGNED" | "ESCALATED" | "PEER_ANSWERED" | "TA_ANSWERED" | "VERIFIED" | "REJECTED")[];
  limit?: number;
} = {}) {
  await connection();

  const where = [
    options.userId ? eq(qaThreads.userId, options.userId) : undefined,
    options.statuses?.length
      ? inArray(qaThreads.status, options.statuses)
      : undefined,
  ].filter((clause): clause is NonNullable<typeof clause> => Boolean(clause));

  return db
    .select()
    .from(qaThreads)
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(qaThreads.createdAt))
    .limit(options.limit ?? 50);
}

export type AnswerOutcome =
  | { ok: true; thread: typeof qaThreads.$inferSelect }
  | { ok: false; error: string; status: number };

/**
 * Write a peer or TA answer onto a thread.
 *
 * Peer answers stay unverified until an admin promotes them into the handbook;
 * only then do they earn merit. TA answers carry staff authority, so they count
 * as authoritative for verification but earn no contributor points.
 */
export async function answerThread(input: {
  threadId: string;
  userId: string;
  body: string;
  bodyAr?: string | null;
  kind: AnswerKind;
}): Promise<AnswerOutcome> {
  await connection();

  const [thread] = await db
    .select()
    .from(qaThreads)
    .where(eq(qaThreads.id, input.threadId))
    .limit(1);

  if (!thread) return { ok: false, error: "Thread not found", status: 404 };
  if (thread.status === "VERIFIED" || thread.status === "REJECTED") {
    return { ok: false, error: "Thread is closed", status: 409 };
  }

  const tier = await getStudentTier(input.userId);
  if (!tier) return { ok: false, error: "Unauthorized", status: 401 };

  if (input.kind === "ta") {
    if (!tier.isStaff) return { ok: false, error: "Staff only", status: 403 };
  } else if (!tier.isStaff && tier.effectiveTier === "EXPLORER") {
    return {
      ok: false,
      error: "Peer Helper tier or higher required",
      status: 403,
    };
  }

  if (input.kind === "ta" && thread.taAnswer) {
    return { ok: false, error: "TA answer already exists", status: 409 };
  }
  if (input.kind === "peer" && thread.peerAnswer) {
    return { ok: false, error: "Peer answer already exists", status: 409 };
  }

  const [updated] = await db
    .update(qaThreads)
    .set(
      input.kind === "ta"
        ? {
            taAnswer: input.body,
            taAnswerAr: input.bodyAr ?? null,
            taAnsweredBy: input.userId,
            taAnsweredAt: new Date(),
            status: "TA_ANSWERED",
            updatedAt: new Date(),
          }
        : {
            peerAnswer: input.body,
            peerAnswerAr: input.bodyAr ?? null,
            peerAnsweredBy: input.userId,
            peerAnsweredAt: new Date(),
            status: "PEER_ANSWERED",
            updatedAt: new Date(),
          }
    )
    .where(
      input.kind === "peer"
        ? and(eq(qaThreads.id, input.threadId), inArray(qaThreads.status, PEER_ANSWERABLE))
        : eq(qaThreads.id, input.threadId)
    )
    .returning();

  if (!updated) {
    return { ok: false, error: "Thread changed while answering", status: 409 };
  }

  return { ok: true, thread: updated };
}

/**
 * Promote a verified answer into the handbook corpus and award the author.
 *
 * Promotion writes a `sourceType='QA'` chunk (no handbook row), so verified
 * student answers become retrievable without polluting the official handbook.
 */
export async function verifyThread(input: {
  threadId: string;
  actorId: string;
}): Promise<AnswerOutcome> {
  await connection();

  const [thread] = await db
    .select()
    .from(qaThreads)
    .where(eq(qaThreads.id, input.threadId))
    .limit(1);

  if (!thread) return { ok: false, error: "Thread not found", status: 404 };
  if (thread.status === "VERIFIED") {
    return { ok: false, error: "Already verified", status: 409 };
  }

  const body = thread.taAnswer ?? thread.peerAnswer;
  const bodyAr = thread.taAnswer ? thread.taAnswerAr : thread.peerAnswerAr;
  if (!body) {
    return { ok: false, error: "No answer to verify", status: 409 };
  }

  const content = `Q: ${thread.question}\nA: ${body}`;

  let chunkId: string | null = null;
  try {
    const [chunk] = await db
      .insert(handbookChunks)
      .values({
        handbookId: null,
        chunkIndex: 0,
        section: "Student Q&A",
        content,
        contentAr: bodyAr ?? null,
        language: thread.language,
        sourceType: "QA",
        sourceId: thread.id,
        keywords: [],
      })
      .returning({ id: handbookChunks.id });
    chunkId = chunk?.id ?? null;
  } catch {
    chunkId = null;
  }

  const [updated] = await db
    .update(qaThreads)
    .set({
      status: "VERIFIED",
      verifiedBy: input.actorId,
      verifiedAt: new Date(),
      promotedChunkId: chunkId,
      updatedAt: new Date(),
    })
    .where(eq(qaThreads.id, input.threadId))
    .returning();

  if (thread.peerAnsweredBy && !thread.taAnswer) {
    await creditMerit({
      userId: thread.peerAnsweredBy,
      reason: "peerAnswerVerified",
      sourceType: "qa_thread",
      sourceId: thread.id,
      actorId: input.actorId,
      delta: MERIT_AWARDS.peerAnswerVerified,
    });
  }

  return updated
    ? { ok: true, thread: updated }
    : { ok: false, error: "Could not verify thread", status: 500 };
}

export async function rejectThread(input: {
  threadId: string;
  actorId: string;
  note?: string | null;
}): Promise<AnswerOutcome> {
  await connection();

  const [updated] = await db
    .update(qaThreads)
    .set({
      status: "REJECTED",
      verifiedBy: input.actorId,
      verifiedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(qaThreads.id, input.threadId))
    .returning();

  return updated
    ? { ok: true, thread: updated }
    : { ok: false, error: "Thread not found", status: 404 };
}

/** Threads still waiting on an answer or a verification. */
export async function countActiveThreads(): Promise<number> {
  await connection();

  const [row] = await db
    .select({ value: count() })
    .from(qaThreads)
    .where(
      inArray(qaThreads.status, [
        "OPEN",
        "ESCALATED",
        "ASSIGNED",
        "PEER_ANSWERED",
        "TA_ANSWERED",
      ])
    );

  return row?.value ?? 0;
}

/** Ranked passages the assistant would use, exposed for the ask flow. */
export async function suggestSources(question: string, k = 4) {
  return hybridRetrieve(question, k);
}
