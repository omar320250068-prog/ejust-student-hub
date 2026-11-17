import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { asc, count, eq, inArray, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { contributions, qaThreads, users } from "@/db/schema";
import { meritForCategory, scanContribution } from "@/lib/contribution-scan";
import { toStudentTier } from "@/lib/merit-server";
import RegistrarOversightConsole, {
  type AdminMetrics,
  type AdminSubmission,
} from "./RegistrarOversightConsole";
import type { QaQueueRow, TaApplicationRow } from "./TierPanels";

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "submission"
  );
}

async function loadConsole() {
  await connection();

  const session = await auth();

  if (session?.user?.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const [rows, studentRows, approvedRows, meritRows, taRows, qaRows] = await Promise.all([
    db
      .select({
        id: contributions.id,
        category: contributions.category,
        title: contributions.title,
        data: contributions.data,
        notes: contributions.notes,
        status: contributions.status,
        meritPoints: contributions.meritPoints,
        createdAt: contributions.createdAt,
        studentName: users.name,
        studentEmail: users.email,
      })
      .from(contributions)
      .leftJoin(users, eq(contributions.userId, users.id))
      .where(eq(contributions.status, "pending"))
      .orderBy(asc(contributions.createdAt))
      .limit(200),
    db.select({ value: count() }).from(users).where(eq(users.role, "STUDENT")),
    db
      .select({ value: count() })
      .from(contributions)
      .where(eq(contributions.status, "approved")),
    db
      .select({ value: sql<number>`coalesce(sum(${contributions.meritPoints}), 0)::int` })
      .from(contributions)
      .where(eq(contributions.status, "approved")),
    db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        note: users.taNote,
        role: users.role,
        taStatus: users.taStatus,
        meritPoints: users.meritPoints,
        meritTierOverride: users.meritTierOverride,
        autoApproveRevokedAt: users.autoApproveRevokedAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.taStatus, "PENDING"))
      .orderBy(asc(users.updatedAt))
      .limit(100),
    db
      .select({
        id: qaThreads.id,
        question: qaThreads.question,
        questionAr: qaThreads.questionAr,
        peerAnswer: qaThreads.peerAnswer,
        taAnswer: qaThreads.taAnswer,
        status: qaThreads.status,
        createdAt: qaThreads.createdAt,
      })
      .from(qaThreads)
      .where(inArray(qaThreads.status, ["PEER_ANSWERED", "TA_ANSWERED"]))
      .orderBy(asc(qaThreads.createdAt))
      .limit(100),
  ]);

  const submissions: AdminSubmission[] = rows.map((row) => {
    const data =
      row.data && typeof row.data === "object"
        ? (row.data as Record<string, unknown>)
        : {};

    const rawName = typeof data.fileName === "string" ? data.fileName.trim() : "";
    const fileName = rawName || `${slugify(row.title)}.json`;
    const fileSize =
      typeof data.size === "number" && Number.isFinite(data.size)
        ? data.size
        : Buffer.byteLength(JSON.stringify(row.data ?? {}), "utf8");
    const fileType =
      typeof data.type === "string" && data.type.trim() ? data.type : "application/json";

    const status =
      row.status === "approved" || row.status === "rejected" ? row.status : "pending";

    return {
      id: row.id,
      studentName: row.studentName ?? "Unknown student",
      studentEmail: row.studentEmail ?? "unknown",
      category: row.category,
      title: row.title,
      fileName,
      fileSize,
      fileType,
      meritPoints: row.meritPoints > 0 ? row.meritPoints : meritForCategory(row.category),
      submittedAt: row.createdAt.toISOString(),
      status,
      verdict: scanContribution({
        category: row.category,
        title: row.title,
        data: row.data,
        notes: row.notes,
      }),
    };
  });

  const metrics: AdminMetrics = {
    totalStudents: studentRows[0]?.value ?? 0,
    pending: submissions.length,
    approved: approvedRows[0]?.value ?? 0,
    meritAwarded: meritRows[0]?.value ?? 0,
  };

  const taApplications: TaApplicationRow[] = taRows.map((row) => ({
    id: row.id,
    name: row.name ?? "Unnamed student",
    email: row.email ?? "unknown",
    note: row.note,
    points: row.meritPoints,
    tier: toStudentTier(row).tier,
    appliedAt: row.updatedAt.toISOString(),
  }));

  const qaQueue: QaQueueRow[] = qaRows.map((row) => ({
    id: row.id,
    question: row.question,
    questionAr: row.questionAr,
    peerAnswer: row.peerAnswer,
    taAnswer: row.taAnswer,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  }));

  return {
    submissions,
    metrics,
    adminName: session.user.name ?? session.user.email ?? "admin",
    generatedAt: new Date().toISOString(),
    taApplications,
    qaQueue,
  };
}

async function AdminData() {
  const data = await loadConsole();

  return (
    <RegistrarOversightConsole
      submissions={data.submissions}
      metrics={data.metrics}
      adminName={data.adminName}
      generatedAt={data.generatedAt}
      taApplications={data.taApplications}
      qaQueue={data.qaQueue}
    />
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#050a18]" />}>
      <AdminData />
    </Suspense>
  );
}
