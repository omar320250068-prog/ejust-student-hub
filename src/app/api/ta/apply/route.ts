import { NextRequest, NextResponse } from "next/server";
import { applyForTa } from "@/lib/merit-server";
import { requireTier } from "@/lib/permissions";

const MAX_NOTE = 500;

/** Submit a TA application: `NONE` or `REJECTED` becomes `PENDING`. */
export async function POST(req: NextRequest) {
  const guard = await requireTier(null);
  if (!guard.ok) return guard.response;

  const { viewer } = guard;

  if (viewer.isStaff) {
    return NextResponse.json(
      { error: "You are already a teaching assistant." },
      { status: 409 }
    );
  }

  if (viewer.taStatus === "PENDING") {
    return NextResponse.json(
      { error: "Your application is already under review." },
      { status: 409 }
    );
  }

  let note: string | null = null;
  try {
    const body = (await req.json()) as { note?: unknown };
    if (typeof body.note === "string" && body.note.trim()) {
      note = body.note.trim().slice(0, MAX_NOTE);
    }
  } catch {
    note = null;
  }

  const applied = await applyForTa(viewer.userId, note);
  if (!applied) {
    return NextResponse.json(
      { error: "This account cannot apply as a teaching assistant." },
      { status: 409 }
    );
  }

  return NextResponse.json({ ok: true, taStatus: "PENDING" });
}
