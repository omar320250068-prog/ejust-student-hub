import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { contributions } from "@/db/schema";
import { meritForCategory } from "@/lib/contribution-scan";
import { desc, eq } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db
    .select()
    .from(contributions)
    .where(eq(contributions.userId, session.user.id))
    .orderBy(desc(contributions.createdAt));

  return NextResponse.json({ contributions: rows });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
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

    await db.insert(contributions).values({
      userId: session.user.id,
      category,
      title,
      data,
      status: "pending",
      meritPoints: meritForCategory(String(category)),
      updatedAt: new Date(),
      createdAt: new Date(),
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
