import { NextResponse } from "next/server";
import {
  findCourseMeetings,
  type CourseMeetingQuery,
} from "@/lib/rag/db-retriever";

const DAYS = new Set(["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "SATURDAY"]);
const MEETING_TYPES = new Set(["LECTURE", "LAB", "SECTION", "TUTORIAL"]);
const COLUMN_KEY = /^Y[1-4](?:G[1-4]S\d+|(?:CNC|AID|CSC|BIF)S\d+)$/;
const COURSE_CODE = /^[A-Z]{2,5}\s*-?\s*\d{3}$/i;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const courseCode = searchParams.get("courseCode")?.trim().toUpperCase();
  if (courseCode && !COURSE_CODE.test(courseCode)) {
    return NextResponse.json({ error: "invalid courseCode" }, { status: 400 });
  }

  const columnKey = searchParams.get("columnKey")?.trim().toUpperCase();
  if (columnKey && !COLUMN_KEY.test(columnKey)) {
    return NextResponse.json({ error: "invalid columnKey" }, { status: 400 });
  }

  const day = searchParams.get("day")?.trim().toUpperCase();
  if (day && !DAYS.has(day)) {
    return NextResponse.json({ error: "invalid day" }, { status: 400 });
  }

  const meetingType = searchParams.get("meetingType")?.trim().toUpperCase();
  if (meetingType && !MEETING_TYPES.has(meetingType)) {
    return NextResponse.json({ error: "invalid meetingType" }, { status: 400 });
  }

  const rawLimit = searchParams.get("limit");
  const limit = rawLimit ? Number(rawLimit) : undefined;
  if (limit !== undefined && (!Number.isFinite(limit) || limit < 1)) {
    return NextResponse.json({ error: "invalid limit" }, { status: 400 });
  }

  const query: CourseMeetingQuery = {
    courseCode: courseCode?.replace(/\s*-?\s*/, " "),
    columnKey,
    day: day as CourseMeetingQuery["day"],
    meetingType: meetingType as CourseMeetingQuery["meetingType"],
    building: searchParams.get("building") ?? undefined,
    room: searchParams.get("room") ?? undefined,
    academicYear: searchParams.get("academicYear") ?? undefined,
    semester: searchParams.get("semester") ?? undefined,
    limit,
  };

  const meetings = await findCourseMeetings(query);
  return NextResponse.json({ meetings, count: meetings.length });
}
