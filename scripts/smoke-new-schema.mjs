import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);
const mark = `smoke-${Date.now()}`;
const vec = Array.from({ length: 1536 }, (_, i) => (i % 7) / 10);

const [course] = await sql`
  insert into course (id, code, name, program, level, "creditHours")
  values (${crypto.randomUUID()}, ${"TST 000"}, ${mark}, 'CSC', 3, 3)
  returning id, code
`;
const [meeting] = await sql`
  insert into "course_meeting" (id, "courseId", "academicYear", semester, day, "startTime", "endTime", building, room)
  values (${crypto.randomUUID()}, ${course.id}, '2025-2026', 'FALL', 'SUNDAY', '08:30', '10:00', 'Building 7', 'F1.20')
  returning id, day, "startTime"
`;
const [office] = await sql`
  insert into "faculty_office" (id, name, department, building, "officeNumber", "officeHours")
  values (${crypto.randomUUID()}, ${mark}, 'CSIT', 'Building 7', 'F2.16', ${JSON.stringify([{ day: "MONDAY", start: "13:00", end: "15:00" }])}::json)
  returning id, "officeNumber"
`;
const [sch] = await sql`
  insert into scholarship (id, title, "coverageType", "coverageValue", "minCgpa", "eligiblePrograms", "eligibilityRules")
  values (${crypto.randomUUID()}, ${mark}, 'PERCENT', 25.00, 3.20, ${JSON.stringify(["CSC"])}::json, ${JSON.stringify([{ field: "cgpa", op: ">=", value: 3.2 }])}::json)
  returning id, title, "minCgpa", "coverageValue"
`;
const [hb] = await sql`
  insert into handbook (id, "academicYear", program, title, version)
  values (${crypto.randomUUID()}, '2025-2026', 'CSC', ${mark}, 'v1')
  returning id
`;
const [chunk] = await sql`
  insert into "handbook_chunk" (id, "handbookId", "chunkIndex", section, content, "contentAr", "tokenCount", keywords, embedding, "embeddingModel")
  values (${crypto.randomUUID()}, ${hb.id}, 0, '4.2 Academic Probation', 'A student whose CGPA falls below 2.0 is placed on probation.', 'الطالب الذي يقل معدله التراكمي عن 2.0 يوضع تحت الملاحظة.', 18, ${JSON.stringify(["probation", "cgpa"])}::json, ${JSON.stringify(vec)}::vector, 'text-embedding-3-small')
  returning id, tsv::text as tsv, vector_dims(embedding) as dims
`;

console.log("course:", course.code);
console.log("meeting:", meeting.day, meeting.startTime);
console.log("office:", office.officeNumber);
console.log("scholarship:", sch.minCgpa, sch.coverageValue);
console.log("chunk dims:", chunk.dims);
console.log("tsv contains probation:", /probation/.test(chunk.tsv), "| arabic indexed:", chunk.tsv.length > 40);

const [ranked] = await sql`
  select "handbookId", round((1 - (embedding <=> ${JSON.stringify(vec)}::vector))::numeric, 4) as cosine_sim
  from "handbook_chunk"
  where "handbookId" = ${hb.id}
  order by embedding <=> ${JSON.stringify(vec)}::vector
  limit 1
`;
console.log("vector search sim:", ranked.cosine_sim);

const [fts] = await sql`
  select count(*)::int as n from "handbook_chunk"
  where tsv @@ plainto_tsquery('simple', 'probation')
`;
console.log("fts matches:", fts.n);

await sql`delete from "course_meeting" where "courseId" = ${course.id}`;
await sql`delete from course where id = ${course.id}`;
await sql`delete from "faculty_office" where id = ${office.id}`;
await sql`delete from scholarship where id = ${sch.id}`;
await sql`delete from "handbook_chunk" where "handbookId" = ${hb.id}`;
await sql`delete from handbook where id = ${hb.id}`;

const left = await sql`
  select
    (select count(*)::int from course) as courses,
    (select count(*)::int from "course_meeting") as meetings,
    (select count(*)::int from "faculty_office") as offices,
    (select count(*)::int from scholarship) as scholarships,
    (select count(*)::int from handbook) as handbooks,
    (select count(*)::int from "handbook_chunk") as chunks
`;
console.log("after cleanup:", left[0]);
