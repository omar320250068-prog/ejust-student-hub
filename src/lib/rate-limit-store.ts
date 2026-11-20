/**
 * Shared sliding-window rate-limit store. Neon PostgreSQL is used when
 * DATABASE_URL is configured; otherwise an in-memory fallback keeps local
 * development and single-instance deployments working. The fallback is
 * per-process only — a multi-instance serverless deployment always needs the
 * shared Neon store to keep aggregate limits correct. Server-only.
 */
import "server-only";
import { neon } from "@neondatabase/serverless";
import { decideFromAttempts, type RateLimitDecision, type RateLimitPolicy } from "./rate-limit";

type NeonSql = ReturnType<typeof neon>;

function getSql(): NeonSql {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is missing.");
  return neon(url);
}

let schemaReady: Promise<void> | null = null;

function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      const sql = getSql();
      await sql`
        CREATE TABLE IF NOT EXISTS rate_limit_event (
          id bigserial PRIMARY KEY,
          bucket text NOT NULL,
          occurred_at timestamptz NOT NULL DEFAULT now()
        )
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS rate_limit_event_bucket_time_idx
        ON rate_limit_event (bucket, occurred_at)
      `;
    })().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  return schemaReady;
}

const MAX_MEMORY_BUCKETS = 10_000;
const memoryBuckets = new Map<string, number[]>();
let lastSweep = 0;

function sweepMemory(now: number, windowMs: number): void {
  if (now - lastSweep < windowMs) return;
  lastSweep = now;
  for (const [bucket, attempts] of memoryBuckets) {
    const surviving = attempts.filter((at) => at > now - windowMs);
    if (surviving.length === 0) memoryBuckets.delete(bucket);
    else memoryBuckets.set(bucket, surviving);
  }
}

function consumeInMemory(key: string, policy: RateLimitPolicy, now: number): RateLimitDecision {
  sweepMemory(now, policy.windowMs);
  const attempts = memoryBuckets.get(key) ?? [];
  const decision = decideFromAttempts(attempts, now, policy);
  if (decision.allowed) {
    attempts.push(now);
    if (memoryBuckets.size >= MAX_MEMORY_BUCKETS && !memoryBuckets.has(key)) {
      memoryBuckets.clear();
    }
    memoryBuckets.set(key, attempts);
  }
  return decision;
}

/**
 * Record one attempt for `key` and report whether it was within the limit.
 * A database failure degrades to the in-memory fallback rather than taking
 * the protected endpoint down.
 */
export async function consumeRateLimit(
  key: string,
  policy: RateLimitPolicy
): Promise<RateLimitDecision> {
  const now = Date.now();
  if (!process.env.DATABASE_URL?.trim()) return consumeInMemory(key, policy, now);

  try {
    await ensureSchema();
    const sql = getSql();
    const cutoff = new Date(now - policy.windowMs);
    const recordedAt = new Date(now);

    // All CTEs share one snapshot: `recent` describes the state before this
    // request, and `inserted` adds the attempt only when it was allowed.
    const rows = (await sql`
      WITH pruned AS (
        DELETE FROM rate_limit_event
         WHERE bucket = ${key} AND occurred_at < ${cutoff}
        RETURNING 1
      ),
      recent AS (
        SELECT occurred_at FROM rate_limit_event
         WHERE bucket = ${key} AND occurred_at >= ${cutoff}
         ORDER BY occurred_at ASC
      ),
      inserted AS (
        INSERT INTO rate_limit_event (bucket, occurred_at)
        SELECT ${key}, ${recordedAt}
         WHERE (SELECT count(*) FROM recent) < ${policy.limit}
        RETURNING 1
      )
      SELECT occurred_at FROM recent
    `) as { occurred_at: string | Date }[];

    return decideFromAttempts(
      rows.map((row) => new Date(row.occurred_at).getTime()),
      now,
      policy
    );
  } catch (error) {
    console.warn("[rate-limit] shared store unavailable, using in-memory fallback", error);
    return consumeInMemory(key, policy, now);
  }
}
