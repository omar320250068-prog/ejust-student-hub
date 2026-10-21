import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { userData } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const feature = searchParams.get("feature");

  if (!feature) {
    return NextResponse.json({ error: "Missing feature" }, { status: 400 });
  }

  const row = await db.query.userData.findFirst({
    where: and(eq(userData.userId, session.user.id), eq(userData.feature, feature)),
  });

  return NextResponse.json({ data: row?.data ?? null });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { feature, data } = body;

  if (!feature || data === undefined) {
    return NextResponse.json({ error: "Missing feature or data" }, { status: 400 });
  }

  const existing = await db.query.userData.findFirst({
    where: and(eq(userData.userId, session.user.id), eq(userData.feature, feature)),
  });

  if (existing) {
    await db
      .update(userData)
      .set({ data, updatedAt: new Date() })
      .where(eq(userData.id, existing.id));

    return NextResponse.json({ ok: true, updated: true });
  }

  await db.insert(userData).values({
    userId: session.user.id,
    feature,
    data,
    updatedAt: new Date(),
    createdAt: new Date(),
  });

  return NextResponse.json({ ok: true, created: true });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const feature = searchParams.get("feature");

  if (!feature) {
    return NextResponse.json({ error: "Missing feature" }, { status: 400 });
  }

  await db
    .delete(userData)
    .where(and(eq(userData.userId, session.user.id), eq(userData.feature, feature)));

  return NextResponse.json({ ok: true });
}
