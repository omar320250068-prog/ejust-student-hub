import { NextRequest, NextResponse } from "next/server";
import { consumeAiQuota, refundAiQuota } from "@/lib/merit-server";
import { requireTier } from "@/lib/permissions";
import { askQuestion, listThreads } from "@/lib/qa";

export async function GET() {
  const guard = await requireTier(null);
  if (!guard.ok) return guard.response;

  const { viewer } = guard;
  const statuses = viewer.privileges.peerAnswer
    ? (["OPEN", "ESCALATED", "ASSIGNED", "PEER_ANSWERED", "TA_ANSWERED"] as const)
    : (["OPEN"] as const);

  const threads = await listThreads({
    userId: viewer.privileges.peerAnswer ? undefined : viewer.userId,
    statuses: [...statuses],
  });

  return NextResponse.json({
    viewer: {
      tier: viewer.effectiveTier,
      points: viewer.points,
      isStaff: viewer.isStaff,
      taStatus: viewer.taStatus,
      privileges: viewer.privileges,
    },
    threads,
  });
}

export async function POST(req: NextRequest) {
  const guard = await requireTier(null);
  if (!guard.ok) return guard.response;

  const { viewer } = guard;

  let body: {
    question?: unknown;
    questionAr?: unknown;
    courseId?: unknown;
    language?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (question.length < 8) {
    return NextResponse.json(
      { error: "Question must be at least 8 characters" },
      { status: 400 }
    );
  }

  const quota = await consumeAiQuota(
    viewer.userId,
    viewer.effectiveTier,
    viewer.privileges.aiQuota
  );

  if (!quota.allowed) {
    return NextResponse.json(
      {
        error: "Daily question limit reached",
        tier: viewer.effectiveTier,
        used: quota.used,
        quota: quota.quota,
      },
      { status: 429 }
    );
  }

  const language =
    body.language === "AR" || body.language === "MIXED" ? body.language : "EN";

  let thread;
  try {
    thread = await askQuestion({
      userId: viewer.userId,
      question,
      questionAr: typeof body.questionAr === "string" ? body.questionAr : null,
      courseId: typeof body.courseId === "string" ? body.courseId : null,
      language,
    });
  } catch {
    await refundAiQuota(quota.entryId);
    return NextResponse.json(
      { error: "Could not create the question" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    thread,
    quota: { used: quota.used + 1, limit: quota.quota },
  });
}
