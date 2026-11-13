import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

const rows = await sql.query(
  `select c.title, c.status, c."meritPoints" as "rowMerit", c."reviewedBy" is not null as reviewed,
          c."reviewedAt" is not null as "reviewedAt", u.email, u."meritPoints" as "userMerit", u.role
   from contribution c join "user" u on u.id = c."userId"
   order by c."createdAt" desc limit 5`
);

console.log(JSON.stringify(rows, null, 2));
