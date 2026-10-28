import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { studentProfiles } from "@/db/schema";

const TEXT_FIELDS = [
  "studentId",
  "gender",
  "faculty",
  "academicYear",
  "group",
  "section",
] as const;

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return errorResponse("Unauthorized", 401);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return errorResponse("Invalid request body.", 400);
  }

  const body = (payload ?? {}) as Record<string, unknown>;
  const values = {} as Record<(typeof TEXT_FIELDS)[number], string>;

  for (const field of TEXT_FIELDS) {
    const value = body[field];
    if (
      typeof value !== "string" ||
      value.trim().length === 0 ||
      value.trim().length > 120
    ) {
      return errorResponse(`${field} is required.`, 400);
    }

    values[field] = value.trim();
  }

  if (
    typeof body.age !== "number" ||
    !Number.isInteger(body.age) ||
    body.age < 10 ||
    body.age > 120
  ) {
    return errorResponse("Age must be a valid whole number.", 400);
  }

  const age = body.age;
  const profileValues = {
    studentId: values.studentId.trim(),
    age,
    gender: values.gender.trim(),
    faculty: values.faculty.trim(),
    academicYear: values.academicYear.trim(),
    group: values.group.trim(),
    section: values.section.trim(),
  };

  try {
    const [profile] = await db
      .insert(studentProfiles)
      .values({ userId, ...profileValues })
      .onConflictDoUpdate({
        target: studentProfiles.userId,
        set: profileValues,
      })
      .returning({
        id: studentProfiles.id,
        studentId: studentProfiles.studentId,
        age: studentProfiles.age,
        gender: studentProfiles.gender,
        faculty: studentProfiles.faculty,
        academicYear: studentProfiles.academicYear,
        group: studentProfiles.group,
        section: studentProfiles.section,
      });

    return NextResponse.json({ ok: true, profile });
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      return errorResponse("That student ID is already in use.", 409);
    }

    console.error("[profile]", error);
    return errorResponse("Could not save your profile. Please try again.", 500);
  }
}
