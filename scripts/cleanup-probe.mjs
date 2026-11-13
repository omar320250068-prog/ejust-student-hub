import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);
const email = "probe.creds@ejust.edu.eg";

const del = await sql.query(
  `delete from contribution where "userId" in (select id from "user" where lower(email) = $1) returning title`,
  [email]
);
console.log("contributions removed:", del.map((r) => r.title));

await sql.query(`delete from user_data where "userId" in (select id from "user" where lower(email) = $1)`, [email]);
await sql.query(`delete from student_profile where "userId" in (select id from "user" where lower(email) = $1)`, [email]);
await sql.query(`delete from session where "userId" in (select id from "user" where lower(email) = $1)`, [email]);
await sql.query(`delete from account where "userId" in (select id from "user" where lower(email) = $1)`, [email]);

const gone = await sql.query(`delete from "user" where lower(email) = $1 returning id, email`, [email]);
console.log("users removed:", gone);

const left = await sql.query(`select email, role, "meritPoints" from "user" order by email`);
console.log("remaining users:", left);
