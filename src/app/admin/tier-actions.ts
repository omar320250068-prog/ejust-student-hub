"use server";

import { revalidatePath } from "next/cache";
import { desc, ilike, or } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import {
  getStudentTier,
  setAutoApproveRevoked,
  setMeritTierOverride,
  setTaReview,
  toStudentTier,
} from "@/lib/merit-server";
import { requireAdmin } from "@/lib/permissions";
import type { MeritTier } from "@/lib/merit";

export type TierActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

export interface StudentRow {
  id: string;
  name: string | null;
  email: string | null;
  role: "STUDENT" | "ADMIN" | "TA";
  taStatus: string;
  points: number;
  tier: MeritTier;
  effectiveTier: MeritTier;
  override: MeritTier | null;
  autoApproveRevoked: boolean;
}

const TIERS: MeritTier[] = [
  "EXPLORER",
  "PEER_HELPER",
  "CAMPUS_AMBASSADOR",
  "EJUST_MENTOR",
];

/**
 * Find students by name or email for the merit/override panel.
 *
 * An empty query returns the highest-point accounts, which is the list an admin
 * actually wants when they open the tab.
 */
export async function searchStudents(query: string): Promise<StudentRow[]> {
  const guard = await requireAdmin();
  if (!guard.ok) return [];

  const needle = query.trim();
  const filter = needle
    ? or(ilike(users.name, `%${needle}%`), ilike(users.email, `%${needle}%`))
    : undefined;

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      taStatus: users.taStatus,
      meritPoints: users.meritPoints,
      meritTierOverride: users.meritTierOverride,
      autoApproveRevokedAt: users.autoApproveRevokedAt,
    })
    .from(users)
    .where(filter)
    .orderBy(desc(users.meritPoints))
    .limit(20);

  return rows.map((row) => {
    const state = toStudentTier(row);
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      taStatus: row.taStatus,
      points: state.points,
      tier: state.tier,
      effectiveTier: state.effectiveTier,
      override: state.override,
      autoApproveRevoked: state.autoApproveRevoked,
    };
  });
}

/**
 * Pin a student's tier regardless of points.
 *
 * Overrides exist because merit points cannot express trust: a new TA or a
 * student who has done verifiable work off-platform still deserves the perks.
 * Passing `null` returns the account to points-driven tiering.
 */
export async function setStudentTierOverride(
  userId: string,
  tier: MeritTier | null
): Promise<TierActionResult> {
  const guard = await requireAdmin();
  if (!guard.ok) return { ok: false, error: "Admin only." };

  if (tier !== null && !TIERS.includes(tier)) {
    return { ok: false, error: "Unknown tier." };
  }

  const target = await getStudentTier(userId);
  if (!target) return { ok: false, error: "Student not found." };

  await setMeritTierOverride(userId, tier, guard.viewer.userId);
  revalidatePath("/admin");

  return {
    ok: true,
    message: tier
      ? `Tier pinned to ${tier} for ${userId}.`
      : `Tier override cleared for ${userId}.`,
  };
}

/** Stop a mentor account from auto-approving FAQ and schedule updates. */
export async function revokeAutoApprove(userId: string): Promise<TierActionResult> {
  const guard = await requireAdmin();
  if (!guard.ok) return { ok: false, error: "Admin only." };

  await setAutoApproveRevoked(userId, true, guard.viewer.userId);
  revalidatePath("/admin");

  return { ok: true, message: "Auto-approval revoked." };
}

/** Restore auto-approval after a manual review. */
export async function restoreAutoApprove(userId: string): Promise<TierActionResult> {
  const guard = await requireAdmin();
  if (!guard.ok) return { ok: false, error: "Admin only." };

  await setAutoApproveRevoked(userId, false, guard.viewer.userId);
  revalidatePath("/admin");

  return { ok: true, message: "Auto-approval restored." };
}

/**
 * Approve or reject a TA application.
 *
 * `role` and `taStatus` move together: nothing in the app trusts `role='TA'`
 * alone, so an approval that sets one without the other would be inert.
 */
export async function reviewTaApplication(
  userId: string,
  decision: "APPROVED" | "REJECTED",
  note?: string
): Promise<TierActionResult> {
  const guard = await requireAdmin();
  if (!guard.ok) return { ok: false, error: "Admin only." };

  if (decision !== "APPROVED" && decision !== "REJECTED") {
    return { ok: false, error: "Unknown decision." };
  }

  const target = await getStudentTier(userId);
  if (!target) return { ok: false, error: "Applicant not found." };
  if (target.role === "ADMIN") {
    return { ok: false, error: "Admins are not TA applicants." };
  }
  if (target.taStatus !== "PENDING") {
    return { ok: false, error: "This application is no longer pending." };
  }

  await setTaReview(userId, decision, guard.viewer.userId, note ?? null);
  revalidatePath("/admin");

  return { ok: true, message: `TA application ${decision.toLowerCase()}.` };
}
