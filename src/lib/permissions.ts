import "server-only";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  atLeast,
  canAttachResources,
  canAutoApprove,
  canPeerAnswer,
  canSubmitScholarship,
  dailyAiQuota,
  type MeritTier,
} from "./merit";
import { getStudentTier, type StudentTier } from "./merit-server";

export interface Viewer extends StudentTier {
  name: string | null;
  email: string | null;
  isAdmin: boolean;
  isApprovedTa: boolean;
  privileges: {
    peerAnswer: boolean;
    submitScholarship: boolean;
    attachResources: boolean;
    autoApprove: boolean;
    aiQuota: number;
  };
}

function privilegesFor(state: StudentTier) {
  const tier = state.effectiveTier;
  return {
    peerAnswer: canPeerAnswer(tier),
    submitScholarship: canSubmitScholarship(tier),
    attachResources: canAttachResources(tier),
    autoApprove: canAutoApprove(tier) && !state.autoApproveRevoked,
    aiQuota: state.isStaff ? 500 : dailyAiQuota(tier),
  };
}

/**
 * Session user plus live tier state.
 *
 * The tier is re-read per request; the session copy is only a cache for
 * rendering. Authorization decisions always use this result.
 */
export async function getViewer(): Promise<Viewer | null> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  const state = await getStudentTier(userId);
  if (!state) return null;

  return {
    ...state,
    name: session.user.name ?? null,
    email: session.user.email ?? null,
    isAdmin: state.role === "ADMIN",
    isApprovedTa: state.role === "TA" && state.taStatus === "APPROVED",
    privileges: privilegesFor(state),
  };
}

export type GuardResult =
  | { ok: true; viewer: Viewer }
  | { ok: false; response: NextResponse };

export function deny(status: number, error: string): NextResponse {
  return NextResponse.json({ error }, { status });
}

/** Require a signed-in viewer, optionally at or above a merit tier. */
export async function requireTier(min: MeritTier | null): Promise<GuardResult> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, response: deny(401, "Unauthorized") };

  if (min && !atLeast(viewer.effectiveTier, min)) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "Merit tier too low",
          required: min,
          current: viewer.effectiveTier,
          points: viewer.points,
        },
        { status: 403 }
      ),
    };
  }

  return { ok: true, viewer };
}

export async function requireStaff(): Promise<GuardResult> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, response: deny(401, "Unauthorized") };
  if (!viewer.isStaff) return { ok: false, response: deny(403, "Staff only") };
  return { ok: true, viewer };
}

export async function requireAdmin(): Promise<GuardResult> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, response: deny(401, "Unauthorized") };
  if (!viewer.isAdmin) return { ok: false, response: deny(403, "Admin only") };
  return { ok: true, viewer };
}
