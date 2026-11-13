import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { neon } from "@neondatabase/serverless";

const DIR = "drizzle";
const journal = JSON.parse(readFileSync(`${DIR}/meta/_journal.json`, "utf8"));
const sql = neon(process.env.DATABASE_URL);

const cols = await sql`
  select column_name, data_type from information_schema.columns
  where table_schema = 'drizzle' and table_name = '__drizzle_migrations'
  order by ordinal_position
`;
console.log("migrations table columns:", cols.map((c) => `${c.column_name}:${c.data_type}`).join(", "));

const existing = await sql`select hash from drizzle.__drizzle_migrations`;
const known = new Set(existing.map((r) => r.hash));

for (const entry of journal.entries) {
  if (entry.idx >= 3) continue;
  const query = readFileSync(`${DIR}/${entry.tag}.sql`, "utf8");
  const hash = createHash("sha256").update(query).digest("hex");
  if (known.has(hash)) {
    console.log(`skip idx ${entry.idx} ${entry.tag} (already recorded)`);
    continue;
  }
  await sql`insert into drizzle.__drizzle_migrations (hash, created_at) values (${hash}, ${entry.when})`;
  console.log(`baselined idx ${entry.idx} ${entry.tag}`);
}

const final = await sql`select count(*)::int as n from drizzle.__drizzle_migrations`;
console.log("recorded migrations:", final[0].n);
