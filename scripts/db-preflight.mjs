import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

const ext = await sql`
  select name, default_version, installed_version
  from pg_available_extensions
  where name in ('vector', 'pg_trgm')
  order by name
`;
console.log("extensions:", ext);

const tables = await sql`
  select table_name from information_schema.tables
  where table_schema = 'public' order by table_name
`;
console.log("tables:", tables.map((r) => r.table_name).join(", "));

const mig = await sql`
  select count(*)::int as n from drizzle.__drizzle_migrations
`.catch(() => [{ n: "missing" }]);
console.log("applied migrations:", mig[0]?.n);
