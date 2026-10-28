import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_BYTES = 72;

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return fail("Invalid request body.", 400);
  }

  const { name, email, password } = (payload ?? {}) as Record<string, unknown>;

  if (typeof name !== "string" || name.trim().length < 2 || name.trim().length > 80) {
    return fail("Name must be between 2 and 80 characters.", 400);
  }

  if (
    typeof email !== "string" ||
    email.trim().length > 254 ||
    !EMAIL_PATTERN.test(email.trim())
  ) {
    return fail("Enter a valid email address.", 400);
  }

  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    return fail(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`, 400);
  }

  if (Buffer.byteLength(password, "utf8") > MAX_PASSWORD_BYTES) {
    return fail("Password is too long (max 72 bytes).", 400);
  }

  const normalizedEmail = email.trim().toLowerCase();

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);

  if (existing.length > 0) {
    return fail("An account with this email already exists.", 409);
  }

  const passwordHash = await bcrypt.hash(password, 10);

  try {
    const [created] = await db
      .insert(users)
      .values({
        name: name.trim(),
        email: normalizedEmail,
        passwordHash,
      })
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
      });

    return NextResponse.json({ ok: true, user: created }, { status: 201 });
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      return fail("An account with this email already exists.", 409);
    }

    console.error("[register]", error);
    return fail("Could not create the account. Please try again.", 500);
  }
}
