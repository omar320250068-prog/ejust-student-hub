import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL, { prepare: false });

const enums = await sql`
  select t.typname as name,
         array_agg(x.enumlabel order by x.enumsortorder) as labels
  from pg_type t
  join pg_enum x on x.enumtypid = t.oid
  where t.typname in ('user_role','ta_status','merit_tier','qa_status','meeting_type','announcement_kind')
  group by 1
  order by 1
`;
console.log("enums:", enums);

const cols = await sql`
  select table_name, column_name, data_type, column_default, is_nullable
  from information_schema.columns
  where table_schema = 'public'
    and (
      (table_name = 'user' and column_name in ('role','taStatus','meritTierOverride','taReviewedBy','meritPoints'))
      or (table_name = 'handbook_chunk' and column_name in ('handbookId','embeddingAr','language','sourceType','sourceId'))
      or (table_name = 'course_meeting' and column_name in ('meetingType','taId'))
      or (table_name = 'faculty_office' and column_name in ('userId','isInOffice'))
      or table_name in ('qa_thread','course_announcement')
    )
  order by table_name, column_name
`;
console.log("columns:", cols.length);
for (const c of cols) {
  console.log(` ${c.table_name}.${c.column_name} :: ${c.data_type} null=${c.is_nullable} default=${c.column_default}`);
}

const idx = await sql`
  select indexname, indexdef
  from pg_indexes
  where schemaname = 'public'
    and indexname in ('handbook_chunk_unique','handbook_chunk_source_unique','faculty_office_user_unique','user_ta_status_idx','qa_thread_queue_idx')
  order by indexname
`;
for (const i of idx) console.log(" idx:", i.indexname, "|", i.indexdef.replace(/^.*USING /, ""));

const checks = await sql`
  select
    (select count(*) from role_roster) filter (where true) as noop
  from (select 1) x
`.catch(() => null);
void checks;

const [probe] = await sql`
  select
    ('TA'::user_role)::text as ta_value,
    ('APPROVED'::ta_status)::text as ta_status_value,
    ('EJUST_MENTOR'::merit_tier)::text as tier_value,
    ('TA_ANSWERED'::qa_status)::text as qa_value
`;
console.log("enum casts:", probe);

const [flex] = await sql`
  insert into handbook_chunk ("id", "handbookId", "chunkIndex", "content", "sourceType", "sourceId")
  values ('smoke-qa-1', null, 0, 'What is the probation rule?', 'QA', 'smoke-thread-1')
  returning "id", "handbookId", "sourceType", "sourceId", length(tsv::text) > 0 as has_tsv
`;
console.log("qa chunk insert:", flex);

const [match] = await sql`
  select "id" from handbook_chunk
  where tsv @@ websearch_to_tsquery('simple', 'probation')
  limit 1
`;
console.log("fts match:", match ?? "none");

await sql`delete from handbook_chunk where "id" = 'smoke-qa-1'`;

const [counts] = await sql`
  select
    (select count(*) from handbook_chunk) as chunks,
    (select count(*) from qa_thread) as threads,
    (select count(*) from course_announcement) as announcements
`;
console.log("counts after cleanup:", counts);

await sql.end();
