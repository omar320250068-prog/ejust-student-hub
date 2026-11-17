import postgres from "postgres";
const sql = postgres(process.env.DATABASE_URL, { prepare: false });
const tables = await sql`select table_name from information_schema.tables where table_schema='public' and table_name in ('merit_event','ai_query_log') order by 1`;
const cols = await sql`select column_name from information_schema.columns where table_name='user' and column_name like 'autoApprove%' order by 1`;
const idx = await sql`select indexname from pg_indexes where tablename in ('merit_event','ai_query_log') order by 1`;
const applied = await sql`select count(*)::int c from drizzle.__drizzle_migrations`;
console.log({ tables: tables.map(t=>t.table_name), cols: cols.map(c=>c.column_name), idx: idx.map(i=>i.indexname), applied: applied[0].c });
await sql.end();
