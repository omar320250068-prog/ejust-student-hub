import { NextRequest, NextResponse } from "next/server";
import { getStudentTier } from "@/lib/merit-server";
import { requireStaff } from "@/lib/permissions";
import { rejectThread, verifyThread } from "@/lib/qa";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireStaff();
  if (!guard.ok) return guard.response;

  const { viewer } = guard;
  const { id } = await params;

  let body: { action?: unknown; note?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.action === "verify") {
    const outcome = await verifyThread({ threadId: id, actorId: viewer.userId });
    if (!outcome.ok) {
      return NextResponse.json(
        { error: outcome.error },
        { status: outcome.status }
      );
    }

    const tier = outcome.thread.peerAnsweredBy
      ? await getStudentTier(outcome.thread.peerAnsweredBy)
      : null;

    return NextResponse.json({
      thread: outcome.thread,
      awarded: tier ? { userId: tier.userId, points: tier.points, tier: tier.tier } : null,
    });
  }

  if (body.action === "reject") {
    const outcome = await rejectThread({
      threadId: id,
      actorId: viewer.userId,
      note: typeof body.note === "string" ? body.note : null,
    });
    if (!outcome.ok) {
      return NextResponse.json(
        { error: outcome.error },
        { status: outcome.status }
      );
    }
    return NextResponse.json({ thread: outcome.thread });
  }

  return NextResponse.json(
    { error: "action must be 'verify' or 'reject'" },
    { status: 400 }
  );
}
