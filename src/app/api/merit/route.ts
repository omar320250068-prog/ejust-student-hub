import { NextResponse } from "next/server";
import { MERIT_TIERS, type MeritTier } from "@/lib/merit";
import { getAiQuotaUsage, getMeritHistory } from "@/lib/merit-server";
import { getViewer } from "@/lib/permissions";
import { countActiveThreads } from "@/lib/qa";

/**
 * Everything the dashboard needs to render merit progression honestly.
 *
 * Points and tier are read live: the JWT copy goes stale the moment an admin
 * approves work, and a progress bar that lies is worse than no progress bar.
 */
export async function GET() {
  const viewer = await getViewer();
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const index = MERIT_TIERS.findIndex((entry) => entry.tier === viewer.tier);
  const current = MERIT_TIERS[index] ?? MERIT_TIERS[0];
  const next = MERIT_TIERS[index + 1] ?? null;

  const span = next ? next.min - current.min : 0;
  const earned = Math.max(0, viewer.points - current.min);
  const progress = next ? Math.min(1, Math.max(0, earned / span)) : 1;

  const [history, used, activeThreads] = await Promise.all([
    getMeritHistory(viewer.userId, 8),
    getAiQuotaUsage(viewer.userId),
    countActiveThreads(),
  ]);

  return NextResponse.json({
    viewer: {
      name: viewer.name,
      email: viewer.email,
      role: viewer.role,
      taStatus: viewer.taStatus,
      points: viewer.points,
      tier: viewer.tier,
      effectiveTier: viewer.effectiveTier as MeritTier,
      override: viewer.override,
      isStaff: viewer.isStaff,
      isAdmin: viewer.isAdmin,
      isApprovedTa: viewer.isApprovedTa,
      autoApproveRevoked: viewer.autoApproveRevoked,
    },
    privileges: viewer.privileges,
    tiers: MERIT_TIERS,
    next: next
      ? {
          tier: next.tier,
          label: next.label,
          labelAr: next.labelAr,
          min: next.min,
          pointsAway: Math.max(0, next.min - viewer.points),
        }
      : null,
    progress,
    history: history.map((event) => ({
      id: event.id,
      delta: event.delta,
      reason: event.reason,
      sourceType: event.sourceType,
      tierAfter: event.tierAfter,
      createdAt: event.createdAt.toISOString(),
    })),
    quota: {
      used,
      limit: viewer.privileges.aiQuota,
      remaining: Math.max(0, viewer.privileges.aiQuota - used),
    },
    qa: { activeThreads },
  });
}
