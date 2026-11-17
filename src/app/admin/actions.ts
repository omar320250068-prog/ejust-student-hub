"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { contributions } from "@/db/schema";
import { meritForCategory } from "@/lib/contribution-scan";
import { creditMerit } from "@/lib/merit-server";

export type ReviewResult =
  | { ok: true; decision: "approved" | "rejected"; awarded: number }
  | { ok: false; error: string };

export async function reviewSubmission(
  id: string,
  decision: "approved" | "rejected",
): Promise<ReviewResult> {
  const session = await auth();

  if (session?.user?.role !== "ADMIN") {
    return { ok: false, error: "You are not authorised to review submissions." };
  }

  if (decision !== "approved" && decision !== "rejected") {
    return { ok: false, error: "Unknown decision." };
  }

  const [claimed] = await db
    .update(contributions)
    .set({
      status: decision,
      reviewedBy: session.user.id,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(contributions.id, id), eq(contributions.status, "pending")))
    .returning({
      userId: contributions.userId,
      category: contributions.category,
      meritPoints: contributions.meritPoints,
    });

  if (!claimed) {
    return { ok: false, error: "This submission was already reviewed." };
  }

  let awarded = 0;

  if (decision === "approved") {
    awarded = claimed.meritPoints > 0 ? claimed.meritPoints : meritForCategory(claimed.category);

    if (awarded > 0 && claimed.userId) {
      await creditMerit({
        userId: claimed.userId,
        reason: `contribution:${claimed.category}`,
        sourceType: "contribution",
        sourceId: id,
        actorId: session.user.id,
        delta: awarded,
      });
    }
  }

  revalidatePath("/admin");

  return { ok: true, decision, awarded };
}
