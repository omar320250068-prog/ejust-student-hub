import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { courseAnnouncements, courses, facultyOffices } from "@/db/schema";
import { getViewer } from "@/lib/permissions";
import { listThreads } from "@/lib/qa";
import TaConsole, { type TaAnnouncement, type TaQuestion } from "./TaConsole";

async function loadPortal(userId: string) {
  const [officeRows, courseRows, announcementRows, threadRows] = await Promise.all([
    db
      .select()
      .from(facultyOffices)
      .where(eq(facultyOffices.userId, userId))
      .limit(1),
    db
      .select({ id: courses.id, code: courses.code, name: courses.name })
      .from(courses)
      .orderBy(courses.code)
      .limit(300),
    db
      .select({
        id: courseAnnouncements.id,
        courseCode: courses.code,
        kind: courseAnnouncements.kind,
        title: courseAnnouncements.title,
        body: courseAnnouncements.body,
        building: courseAnnouncements.building,
        room: courseAnnouncements.room,
        createdAt: courseAnnouncements.createdAt,
      })
      .from(courseAnnouncements)
      .leftJoin(courses, eq(courseAnnouncements.courseId, courses.id))
      .orderBy(desc(courseAnnouncements.createdAt))
      .limit(12),
    listThreads({
      statuses: ["OPEN", "ESCALATED", "ASSIGNED", "PEER_ANSWERED"],
      limit: 20,
    }),
  ]);

  const office = officeRows[0]
    ? {
        id: officeRows[0].id,
        name: officeRows[0].name,
        department: officeRows[0].department,
        building: officeRows[0].building,
        officeNumber: officeRows[0].officeNumber,
        officeHours: officeRows[0].officeHours,
        statusNote: officeRows[0].statusNote,
        isInOffice: officeRows[0].isInOffice,
      }
    : null;

  const announcements: TaAnnouncement[] = announcementRows.map((row) => ({
    id: row.id,
    courseCode: row.courseCode ?? "—",
    kind: row.kind,
    title: row.title,
    body: row.body,
    location: [row.building, row.room].filter(Boolean).join(" · "),
    createdAt: row.createdAt.toISOString(),
  }));

  const questions: TaQuestion[] = threadRows.map((thread) => ({
    id: thread.id,
    question: thread.question,
    questionAr: thread.questionAr,
    status: thread.status,
    peerAnswer: thread.peerAnswer,
    createdAt: thread.createdAt.toISOString(),
  }));

  return { office, courses: courseRows, announcements, questions };
}

export default function TaPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 dark:bg-slate-950" />}>
      <TaData />
    </Suspense>
  );
}

async function TaData() {
  await connection();

  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (!viewer.isStaff) redirect("/today");

  const data = await loadPortal(viewer.userId);

  return (
    <TaConsole
      staffName={viewer.name ?? viewer.email ?? "Teaching assistant"}
      tier={viewer.effectiveTier}
      office={data.office}
      courses={data.courses}
      announcements={data.announcements}
      questions={data.questions}
    />
  );
}
