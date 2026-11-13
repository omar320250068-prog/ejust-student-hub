import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL);
await sql`create extension if not exists vector`;
const r = await sql`select extname, extversion from pg_extension where extname = 'vector'`;
console.log("vector extension:", r);