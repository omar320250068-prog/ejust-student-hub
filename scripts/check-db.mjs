import { neon } from "@neondatabase/serverless";

const q = neon(process.env.DATABASE_URL);

const userCols = await q`
  select column_name from information_schema.columns
  where table_name = 'user' order by ordinal_position`;
const contribCols = await q`
  select column_name from information_schema.columns
  where table_name = 'contribution' order by ordinal_position`;
const tables = await q`
  select table_name from information_schema.tables
  where table_schema = 'public' order by table_name`;
const roleEnum = await q`
  select e.enumlabel from pg_enum e
  join pg_type t on t.oid = e.enumtypid where t.typname = 'user_role'`;

console.log("tables:", tables.map((r) => r.table_name).join(", "));
console.log("user:", userCols.map((r) => r.column_name).join(", "));
console.log("contribution:", contribCols.map((r) => r.column_name).join(", "));
console.log("user_role enum:", roleEnum.map((r) => r.enumlabel).join(", ") || "MISSING");
