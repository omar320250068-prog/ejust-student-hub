import { neon } from "@neondatabase/serverless";

const email = process.argv[2]?.trim().toLowerCase();
const role = (process.argv[3] ?? "ADMIN").trim().toUpperCase();

if (!email) {
  console.error("Usage: node --env-file=.env.local scripts/promote-admin.mjs <email> [ADMIN|STUDENT]");
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Run with: node --env-file=.env.local scripts/promote-admin.mjs <email>");
  process.exit(1);
}

if (role !== "ADMIN" && role !== "STUDENT") {
  console.error(`Unknown role: ${role}`);
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);
const rows = await sql`
  UPDATE "user"
  SET role = ${role}::"user_role", "updatedAt" = now()
  WHERE lower(email) = ${email}
  RETURNING id, name, email, role
`;

if (rows.length === 0) {
  console.error(`No user found for ${email}`);
  process.exit(1);
}

const [u] = rows;
console.log(`OK ${u.email} -> ${u.role} (${u.id})`);
