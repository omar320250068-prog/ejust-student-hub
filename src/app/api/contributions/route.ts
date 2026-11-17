import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { contributions } from "@/db/schema";
import { meritForCategory } from "@/lib/contribution-scan";
import { MERIT_AWARDS } from "@/lib/merit";
import { creditMerit } from "@/lib/merit-server";
import { getViewer, requireTier } from "@/lib/permissions";
import { desc, eq } from "drizzle-orm";

const STUDY_RESOURCE_CATEGORIES = new Set([
  "lecture-notes",
  "past-papers",
  "courseware",
  "study-resources",
]);

const SCHOLARSHIP_CATEGORIES = new Set(["scholarship", "scholarships"]);

const FAQ_SCHEDULE_CATEGORIES = new Set([
  "campus-update",
  "faq",
  "schedule",
  "schedule-update",
]);

export async function GET() {
  const guard = await requireTier(null);
  if (!guard.ok) return guard.response;

  const rows = await db
    .select()
    .from(contributions)
    .where(eq(contributions.userId, guard.viewer.userId))
    .orderBy(desc(contributions.createdAt));

  return NextResponse.json({ contributions: rows });
}

export async function POST(req: NextRequest) {
  const viewer = await getViewer();
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { category, title, data } = body;

    if (!category || !title || data === undefined) {
      return NextResponse.json(
        { error: "Missing category, title, or data" },
        { status: 400 }
      );
    }

    const key = String(category);

    if (SCHOLARSHIP_CATEGORIES.has(key) && !viewer.privileges.submitScholarship) {
      return NextResponse.json(
        {
          error: "Campus Ambassador tier or higher required to submit scholarships",
          required: "CAMPUS_AMBASSADOR",
          current: viewer.effectiveTier,
          points: viewer.points,
        },
        { status: 403 }
      );
    }

    if (STUDY_RESOURCE_CATEGORIES.has(key) && !viewer.privileges.attachResources) {
      return NextResponse.json(
        {
          error: "Campus Ambassador tier or higher required to attach study resources",
          required: "CAMPUS_AMBASSADOR",
          current: viewer.effectiveTier,
          points: viewer.points,
        },
        { status: 403 }
      );
    }

    const autoApprove =
      FAQ_SCHEDULE_CATEGORIES.has(key) && viewer.privileges.autoApprove;

    const [row] = await db
      .insert(contributions)
      .values({
        userId: viewer.userId,
        category: key,
        title,
        data,
        status: autoApprove ? "approved" : "pending",
        meritPoints: meritForCategory(key),
        reviewedBy: autoApprove ? viewer.userId : null,
        reviewedAt: autoApprove ? new Date() : null,
        updatedAt: new Date(),
        createdAt: new Date(),
      })
      .returning({ id: contributions.id });

    let awarded = 0;

    if (autoApprove && row?.id) {
      const credit = await creditMerit({
        userId: viewer.userId,
        reason: "faqApproved",
        sourceType: "contribution",
        sourceId: row.id,
        actorId: viewer.userId,
        delta: MERIT_AWARDS.faqApproved,
      });
      awarded = credit.credited ? MERIT_AWARDS.faqApproved : 0;
    }

    return NextResponse.json({
      ok: true,
      id: row?.id ?? null,
      status: autoApprove ? "approved" : "pending",
      autoApproved: autoApprove,
      awarded,
      tier: viewer.effectiveTier,
    });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
