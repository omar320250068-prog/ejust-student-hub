import { neon } from "@neondatabase/serverless";

const q = neon(process.env.DATABASE_URL);
const total = await q`select count(*)::int as c from "user"`;
const dups = await q`select email, count(*)::int as c from "user" group by email having count(*) > 1`;
const cols = await q`select column_name, data_type, is_nullable from information_schema.columns where table_name = 'user' order by ordinal_position`;
console.log("rows:", total[0].c, "duplicate emails:", dups.length);
console.log("columns:", cols.map((c) => c.column_name).join(", "));
