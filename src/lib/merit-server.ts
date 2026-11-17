import "server-only";
import { connection } from "next/server";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { aiQueryLog, meritEvents, users } from "@/db/schema";
import {
  MERIT_AWARDS,
  resolveMeritTier,
  tierForPoints,
  type MeritAwardReason,
  type MeritTier,
} from "./merit";

export type UserRoleName = "STUDENT" | "ADMIN" | "TA";
export type TaStatusName = "NONE" | "PENDING" | "APPROVED" | "REJECTED";

export interface StudentTier {
  userId: string;
  role: UserRoleName;
  taStatus: TaStatusName;
  points: number;
  override: MeritTier | null;
  tier: MeritTier;
  /** Tier used for permission checks; staff carry staff privileges. */
  effectiveTier: MeritTier;
  isStaff: boolean;
  autoApproveRevoked: boolean;
}

function rowsOf(result: unknown): Record<string, unknown>[] {
  if (Array.isArray(result)) return result as Record<string, unknown>[];
  const maybe = result as { rows?: unknown };
  if (maybe && Array.isArray(maybe.rows)) {
    return maybe.rows as Record<string, unknown>[];
  }
  return [];
}

export function isStaffRole(
  role: UserRoleName,
  taStatus: TaStatusName
): boolean {
  if (role === "ADMIN") return true;
  return role === "TA" && taStatus === "APPROVED";
}

export function toStudentTier(row: {
  id: string;
  role: string;
  taStatus: string;
  meritPoints: number;
  meritTierOverride: string | null;
  autoApproveRevokedAt: Date | null;
}): StudentTier {
  const role = row.role as UserRoleName;
  const taStatus = row.taStatus as TaStatusName;
  const override = (row.meritTierOverride as MeritTier | null) ?? null;
  const tier = resolveMeritTier(row.meritPoints, override);
  const isStaff = isStaffRole(role, taStatus);

  return {
    userId: row.id,
    role,
    taStatus,
    points: row.meritPoints,
    override,
    tier,
    effectiveTier: isStaff ? "EJUST_MENTOR" : tier,
    isStaff,
    autoApproveRevoked: row.autoApproveRevokedAt != null,
  };
}

/**
 * Read a user's tier straight from the database.
 *
 * Never trust the JWT copy: points change when an admin approves work, and the
 * point of a tier gate is that a stale token cannot open it.
 */
export async function getStudentTier(userId: string): Promise<StudentTier | null> {
  await connection();

  const [row] = await db
    .select({
      id: users.id,
      role: users.role,
      taStatus: users.taStatus,
      meritPoints: users.meritPoints,
      meritTierOverride: users.meritTierOverride,
      autoApproveRevokedAt: users.autoApproveRevokedAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return row ? toStudentTier(row) : null;
}

export interface CreditResult {
  credited: boolean;
  points: number | null;
  tierBefore: MeritTier;
  tierAfter: MeritTier;
}

/**
 * Award merit points exactly once per `(sourceType, sourceId, reason)`.
 *
 * The insert into the ledger and the point increment happen inside one CTE, so
 * a retried approval cannot double-credit: the second run's `on conflict do
 * nothing` returns no row, and the guarded `update` sees no `ins` row and
 * touches nothing. This replaces the interactive transaction the neon-http
 * driver cannot give us.
 */
export async function creditMerit(input: {
  userId: string;
  reason: string;
  sourceType: string;
  sourceId?: string | null;
  actorId?: string | null;
  delta?: number;
}): Promise<CreditResult> {
  await connection();

  const delta =
    input.delta ??
    MERIT_AWARDS[input.reason as MeritAwardReason] ??
    0;
  const sourceId = input.sourceId ?? null;

  const [current] = await db
    .select({
      meritPoints: users.meritPoints,
      meritTierOverride: users.meritTierOverride,
    })
    .from(users)
    .where(eq(users.id, input.userId))
    .limit(1);

  const tierBefore = current
    ? resolveMeritTier(current.meritPoints, current.meritTierOverride as MeritTier | null)
    : "EXPLORER";

  const override = (current?.meritTierOverride as MeritTier | null) ?? null;

  const result = await db.execute(sql`
    with ins as (
      insert into "merit_event" ("id", "userId", "delta", "reason", "sourceType", "sourceId", "actorId", "tierBefore")
      values (
        gen_random_uuid()::text,
        ${input.userId},
        ${delta},
        ${input.reason},
        ${input.sourceType},
        ${sourceId},
        ${input.actorId ?? null},
        ${tierBefore}::merit_tier
      )
      on conflict do nothing
      returning "id"
    ), upd as (
      update "user" u
         set "meritPoints" = u."meritPoints" + ${delta}
       where u."id" = ${input.userId}
         and exists (select 1 from ins)
      returning u."meritPoints"
    ), tr as (
      update "merit_event" e
         set "tierAfter" = coalesce(
               ${override}::merit_tier,
               case
                 when (select "meritPoints" from upd) >= 250 then 'EJUST_MENTOR'::merit_tier
                 when (select "meritPoints" from upd) >= 100 then 'CAMPUS_AMBASSADOR'::merit_tier
                 when (select "meritPoints" from upd) >= 30 then 'PEER_HELPER'::merit_tier
                 else 'EXPLORER'::merit_tier
               end
             )
       where e."id" in (select "id" from ins)
    )
    select
      (select "id" from ins) as "eventId",
      (select "meritPoints" from upd) as "points"
  `);

  const row = rowsOf(result)[0];
  const credited = Boolean(row?.eventId);
  const points = credited ? Number(row?.points) : (current?.meritPoints ?? null);
  const tierAfter = credited
    ? resolveMeritTier(points ?? 0, override)
    : tierBefore;

  return { credited, points, tierBefore, tierAfter };
}

export async function getMeritHistory(userId: string, limit = 20) {
  await connection();

  return db
    .select({
      id: meritEvents.id,
      delta: meritEvents.delta,
      reason: meritEvents.reason,
      sourceType: meritEvents.sourceType,
      sourceId: meritEvents.sourceId,
      tierAfter: meritEvents.tierAfter,
      createdAt: meritEvents.createdAt,
    })
    .from(meritEvents)
    .where(eq(meritEvents.userId, userId))
    .orderBy(desc(meritEvents.createdAt))
    .limit(limit);
}

export interface QuotaResult {
  allowed: boolean;
  used: number;
  quota: number;
  entryId: string | null;
}

/**
 * Enforce the per-tier daily assistant quota.
 *
 * Counting and logging are one statement so two parallel requests cannot both
 * see `used = quota - 1` and slip through.
 */
export async function consumeAiQuota(
  userId: string,
  tier: MeritTier,
  quota: number
): Promise<QuotaResult> {
  await connection();

  const result = await db.execute(sql`
    with cnt as (
      select count(*)::int as "used"
        from "ai_query_log"
       where "userId" = ${userId}
         and "createdAt" >= date_trunc('day', now())
    ), ins as (
      insert into "ai_query_log" ("id", "userId", "tier")
      select gen_random_uuid()::text, ${userId}, ${tier}::merit_tier
       where (select "used" from cnt) < ${quota}
      returning "id"
    )
    select
      (select "used" from cnt) as "used",
      (select "id" from ins) as "entryId",
      (select "id" from ins) is not null as "allowed"
  `);

  const row = rowsOf(result)[0];
  const used = Number(row?.used ?? 0);

  return {
    allowed: Boolean(row?.allowed),
    used,
    quota,
    entryId: (row?.entryId as string | null) ?? null,
  };
}

/** Give a quota slot back when the request it paid for failed. */
export async function refundAiQuota(entryId: string | null): Promise<void> {
  if (!entryId) return;
  await connection();
  await db.delete(aiQueryLog).where(eq(aiQueryLog.id, entryId));
}

export async function setMeritTierOverride(
  userId: string,
  tier: MeritTier | null,
  actorId: string
): Promise<void> {
  await connection();
  await db
    .update(users)
    .set({ meritTierOverride: tier, updatedAt: new Date() })
    .where(eq(users.id, userId));
  void actorId;
}

export async function setAutoApproveRevoked(
  userId: string,
  revoked: boolean,
  actorId: string
): Promise<void> {
  await connection();
  await db
    .update(users)
    .set({
      autoApproveRevokedAt: revoked ? new Date() : null,
      autoApproveRevokedBy: revoked ? actorId : null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
}

export async function setTaReview(
  userId: string,
  decision: "APPROVED" | "REJECTED",
  actorId: string,
  note?: string | null
): Promise<void> {
  await connection();
  await db
    .update(users)
    .set({
      role: decision === "APPROVED" ? "TA" : "STUDENT",
      taStatus: decision,
      taReviewedAt: new Date(),
      taReviewedBy: actorId,
      taNote: note ?? null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
}

export function tierPointsFor(points: number): MeritTier {
  return tierForPoints(points);
}
