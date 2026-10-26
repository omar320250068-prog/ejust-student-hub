import { neon } from "@neondatabase/serverless";

let ready: Promise<void> | null = null;

function sql() {
  return neon(process.env.DATABASE_URL!);
}

function ensureTable() {
  if (!ready) {
    ready = (async () => {
      const q = sql();
      await q`CREATE TABLE IF NOT EXISTS auth_diag (
        id serial primary key,
        created_at timestamptz default now(),
        name text,
        message text,
        cause text,
        extra jsonb
      )`;
    })().catch((err) => {
      ready = null;
      throw err;
    });
  }
  return ready;
}

function describe(value: unknown) {
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }
  try {
    return { raw: JSON.stringify(value, Object.getOwnPropertyNames(value ?? {})) };
  } catch {
    return { raw: String(value) };
  }
}

export async function recordAuthError(error: unknown) {
  try {
    await ensureTable();
    const q = sql();
    const e = error as { name?: string; message?: string; type?: string; stack?: string; cause?: unknown };
    const cause = describe(e?.cause);
    const extra = {
      type: e?.type ?? null,
      cause,
      stack: e?.stack ?? null,
    };
    await q`INSERT INTO auth_diag (name, message, cause, extra)
      VALUES (${String(e?.name)}, ${String(e?.message)}, ${cause.message ?? cause.raw ?? null}, ${JSON.stringify(extra)}::jsonb)`;
  } catch (err) {
    console.error("[auth-diag] failed to persist", err);
  }
}

export async function latestAuthErrors(limit = 10) {
  await ensureTable();
  const q = sql();
  return await q`SELECT id, created_at, name, message, cause, extra
    FROM auth_diag ORDER BY id DESC LIMIT ${limit}`;
}
