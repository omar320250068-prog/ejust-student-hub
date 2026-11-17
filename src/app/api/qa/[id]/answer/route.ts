import { NextRequest, NextResponse } from "next/server";
import { requireTier } from "@/lib/permissions";
import { answerThread } from "@/lib/qa";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireTier(null);
  if (!guard.ok) return guard.response;

  const { viewer } = guard;
  const { id } = await params;

  let body: { body?: unknown; bodyAr?: unknown; kind?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const text = typeof body.body === "string" ? body.body.trim() : "";
  if (text.length < 10) {
    return NextResponse.json(
      { error: "Answer must be at least 10 characters" },
      { status: 400 }
    );
  }

  const kind =
    body.kind === "ta" ? "ta" : body.kind === "peer" ? "peer" : null;

  if (!kind) {
    return NextResponse.json(
      { error: "kind must be 'peer' or 'ta'" },
      { status: 400 }
    );
  }

  if (kind === "peer" && !viewer.privileges.peerAnswer) {
    return NextResponse.json(
      {
        error: "Peer Helper tier or higher required",
        current: viewer.effectiveTier,
        points: viewer.points,
      },
      { status: 403 }
    );
  }

  if (kind === "ta" && !viewer.isStaff) {
    return NextResponse.json({ error: "Staff only" }, { status: 403 });
  }

  const outcome = await answerThread({
    threadId: id,
    userId: viewer.userId,
    body: text,
    bodyAr: typeof body.bodyAr === "string" ? body.bodyAr : null,
    kind,
  });

  if (!outcome.ok) {
    return NextResponse.json({ error: outcome.error }, { status: outcome.status });
  }

  return NextResponse.json({ thread: outcome.thread });
}
