"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { courseAnnouncements, facultyOffices } from "@/db/schema";
import { requireStaff } from "@/lib/permissions";
import { answerThread } from "@/lib/qa";

export type TaActionResult = { ok: true; message: string } | { ok: false; error: string };

const ANNOUNCEMENT_KINDS = [
  "LAB_CHANGE",
  "ROOM_CHANGE",
  "CANCELLATION",
  "RESCHEDULE",
  "GENERAL",
] as const;

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export interface OfficeHourSlot {
  day: string;
  start: string;
  end: string;
}

function cleanText(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function cleanHours(value: unknown): OfficeHourSlot[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((slot) => {
      const record = (slot ?? {}) as Record<string, unknown>;
      const day = cleanText(record.day, 12);
      const start = cleanText(record.start, 5);
      const end = cleanText(record.end, 5);
      if (!DAYS.includes(day) || !/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) {
        return null;
      }
      return start < end ? { day, start, end } : null;
    })
    .filter((slot): slot is OfficeHourSlot => slot !== null)
    .slice(0, 14);
}

/** Update the office record linked to the signed-in TA. */
export async function saveFacultyOffice(input: {
  building: string;
  officeNumber: string;
  officeHours: unknown;
  statusNote?: string;
}): Promise<TaActionResult> {
  const guard = await requireStaff();
  if (!guard.ok) return { ok: false, error: "Staff only." };

  const building = cleanText(input.building, 80);
  const officeNumber = cleanText(input.officeNumber, 40);
  if (!building || !officeNumber) {
    return { ok: false, error: "Building and room are required." };
  }

  const [office] = await db
    .select({ id: facultyOffices.id })
    .from(facultyOffices)
    .where(eq(facultyOffices.userId, guard.viewer.userId))
    .limit(1);

  if (!office) {
    return {
      ok: false,
      error: "No faculty office is linked to your account yet.",
    };
  }

  await db
    .update(facultyOffices)
    .set({
      building,
      officeNumber,
      officeHours: cleanHours(input.officeHours),
      statusNote: cleanText(input.statusNote, 160) || null,
      updatedAt: new Date(),
    })
    .where(eq(facultyOffices.id, office.id));

  revalidatePath("/ta");
  revalidatePath("/faculty");

  return { ok: true, message: "Office hours saved." };
}

/** Toggle the live "in office now" flag students see. */
export async function setOfficePresence(input: {
  isInOffice: boolean;
  statusNote?: string;
}): Promise<TaActionResult> {
  const guard = await requireStaff();
  if (!guard.ok) return { ok: false, error: "Staff only." };

  const [office] = await db
    .select({ id: facultyOffices.id })
    .from(facultyOffices)
    .where(eq(facultyOffices.userId, guard.viewer.userId))
    .limit(1);

  if (!office) {
    return { ok: false, error: "No faculty office is linked to your account yet." };
  }

  await db
    .update(facultyOffices)
    .set({
      isInOffice: Boolean(input.isInOffice),
      statusNote: cleanText(input.statusNote, 160) || null,
      statusUpdatedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(facultyOffices.id, office.id));

  revalidatePath("/ta");
  revalidatePath("/faculty");

  return {
    ok: true,
    message: input.isInOffice ? "Students now see you in office." : "Marked as away.",
  };
}

/** Post a lab/section update on a course feed. */
export async function postCourseAnnouncement(input: {
  courseId: string;
  kind: string;
  title: string;
  body: string;
  bodyAr?: string;
  building?: string;
  room?: string;
}): Promise<TaActionResult> {
  const guard = await requireStaff();
  if (!guard.ok) return { ok: false, error: "Staff only." };

  const courseId = cleanText(input.courseId, 60);
  const title = cleanText(input.title, 140);
  const body = cleanText(input.body, 2000);
  const kind = ANNOUNCEMENT_KINDS.includes(
    input.kind as (typeof ANNOUNCEMENT_KINDS)[number]
  )
    ? (input.kind as (typeof ANNOUNCEMENT_KINDS)[number])
    : "GENERAL";

  if (!courseId) return { ok: false, error: "Choose a course." };
  if (title.length < 4) return { ok: false, error: "Give the announcement a title." };
  if (body.length < 8) return { ok: false, error: "Write a short announcement body." };

  await db.insert(courseAnnouncements).values({
    courseId,
    authorId: guard.viewer.userId,
    kind,
    title,
    body,
    bodyAr: cleanText(input.bodyAr, 2000) || null,
    building: cleanText(input.building, 80) || null,
    room: cleanText(input.room, 40) || null,
  });

  revalidatePath("/ta");
  revalidatePath("/today");

  return { ok: true, message: "Announcement posted." };
}

/** Post the official TA answer on an open question. */
export async function answerQaThread(input: {
  threadId: string;
  body: string;
  bodyAr?: string;
}): Promise<TaActionResult> {
  const guard = await requireStaff();
  if (!guard.ok) return { ok: false, error: "Staff only." };

  const text = cleanText(input.body, 4000);
  if (text.length < 10) {
    return { ok: false, error: "Answers must be at least 10 characters." };
  }

  const outcome = await answerThread({
    threadId: cleanText(input.threadId, 60),
    userId: guard.viewer.userId,
    body: text,
    bodyAr: cleanText(input.bodyAr, 4000) || null,
    kind: "ta",
  });

  if (!outcome.ok) return { ok: false, error: outcome.error };

  revalidatePath("/ta");
  revalidatePath("/qa");
  revalidatePath("/admin");

  return { ok: true, message: "Official answer posted." };
}
