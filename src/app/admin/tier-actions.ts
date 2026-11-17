"use server";

import { revalidatePath } from "next/cache";
import { getStudentTier, setAutoApproveRevoked, setMeritTierOverride, setTaReview } from "@/lib/merit-server";
import { requireAdmin } from "@/lib/permissions";
import type { MeritTier } from "@/lib/merit";

export type TierActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

const TIERS: MeritTier[] = [
  "EXPLORER",
  "PEER_HELPER",
  "CAMPUS_AMBASSADOR",
  "EJUST_MENTOR",
];

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

  await setTaReview(userId, decision, guard.viewer.userId, note ?? null);
  revalidatePath("/admin");

  return { ok: true, message: `TA application ${decision.toLowerCase()}.` };
}
