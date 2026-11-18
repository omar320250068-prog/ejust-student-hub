import {
  boolean,
  date,
  index,
  integer,
  json,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  vector,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { customType } from "drizzle-orm/pg-core";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";

const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

export const userRole = pgEnum("user_role", ["STUDENT", "ADMIN", "TA"]);

export const taStatus = pgEnum("ta_status", [
  "NONE",
  "PENDING",
  "APPROVED",
  "REJECTED",
]);

export const meritTier = pgEnum("merit_tier", [
  "EXPLORER",
  "PEER_HELPER",
  "CAMPUS_AMBASSADOR",
  "EJUST_MENTOR",
]);

export const users = pgTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
  passwordHash: text("passwordHash"),
  role: userRole("role").notNull().default("STUDENT"),
  meritPoints: integer("meritPoints").notNull().default(0),
  meritTierOverride: meritTier("meritTierOverride"),
  taStatus: taStatus("taStatus").notNull().default("NONE"),
  taAppliedAt: timestamp("taAppliedAt", { mode: "date" }),
  taReviewedAt: timestamp("taReviewedAt", { mode: "date" }),
  taReviewedBy: text("taReviewedBy").references((): AnyPgColumn => users.id, {
    onDelete: "set null",
  }),
  taNote: text("taNote"),
  autoApproveRevokedAt: timestamp("autoApproveRevokedAt", { mode: "date" }),
  autoApproveRevokedBy: text("autoApproveRevokedBy").references(
    (): AnyPgColumn => users.id,
    { onDelete: "set null" }
  ),
  createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
}, (t) => [index("user_ta_status_idx").on(t.taStatus, t.createdAt)]);

export const studentProfiles = pgTable(
  "student_profile",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    studentId: text("studentId").notNull(),
    age: integer("age").notNull(),
    gender: text("gender").notNull(),
    faculty: text("faculty").notNull(),
    academicYear: text("academicYear").notNull(),
    group: text("group").notNull(),
    section: text("section").notNull(),
  },
  (profile) => [
    unique("student_profile_userId_unique").on(profile.userId),
    unique("student_profile_studentId_unique").on(profile.studentId),
  ],
);

export const accounts = pgTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => ({
    compoundKey: primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  })
);

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => ({
    compoundKey: primaryKey({ columns: [vt.identifier, vt.token] }),
  })
);

export const userData = pgTable("user_data", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  feature: text("feature").notNull(),
  data: json("data").$type<Record<string, unknown> | unknown>().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" })
    .notNull()
    .$defaultFn(() => new Date()),
  createdAt: timestamp("createdAt", { mode: "date" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const contributions = pgTable("contribution", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  category: text("category").notNull(),
  title: text("title").notNull(),
  data: json("data").$type<Record<string, unknown> | unknown>().notNull(),
  status: text("status").notNull().default("pending"),
  notes: text("notes"),
  meritPoints: integer("meritPoints").notNull().default(0),
  reviewedBy: text("reviewedBy").references(() => users.id, {
    onDelete: "set null",
  }),
  reviewedAt: timestamp("reviewedAt", { mode: "date" }),
  createdAt: timestamp("createdAt", { mode: "date" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: timestamp("updatedAt", { mode: "date" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const program = pgEnum("program", ["CSC", "AID", "CNC", "BIF", "GENERAL"]);

export const weekday = pgEnum("weekday", [
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "SATURDAY",
]);

export const meetingType = pgEnum("meeting_type", [
  "LECTURE",
  "LAB",
  "SECTION",
  "TUTORIAL",
]);

export const courses = pgTable(
  "course",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    code: text("code").notNull(),
    name: text("name").notNull(),
    nameAr: text("nameAr"),
    program: program("program").notNull().default("GENERAL"),
    level: integer("level"),
    creditHours: integer("creditHours").notNull().default(3),
    isElective: boolean("isElective").notNull().default(false),
    description: text("description"),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    unique("course_code_program_unique").on(t.code, t.program),
    index("course_program_level_idx").on(t.program, t.level),
  ]
);

/** Courses a student imported from the SIS, one row per course per semester. */
export const studentAcademicRecords = pgTable(
  "student_academic_record",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    courseCode: text("courseCode").notNull(),
    courseName: text("courseName").notNull(),
    creditHours: integer("creditHours").notNull().default(3),
    grade: text("grade"),
    semester: text("semester").notNull(),
    status: text("status", { enum: ["registered", "completed"] })
      .notNull()
      .default("registered"),
    updatedAt: timestamp("updatedAt", { mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("student_academic_record_user_course_semester_unique").on(
      t.userId,
      t.courseCode,
      t.semester
    ),
    index("student_academic_record_user_idx").on(t.userId),
  ]
);

export const courseMeetings = pgTable(
  "course_meeting",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    courseId: text("courseId")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    academicYear: text("academicYear").notNull(),
    semester: text("semester").notNull(),
    day: weekday("day").notNull(),
    startTime: text("startTime").notNull(),
    endTime: text("endTime").notNull(),
    building: text("building"),
    room: text("room"),
    group: text("group"),
    instructor: text("instructor"),
    meetingType: meetingType("meetingType").notNull().default("LECTURE"),
    taId: text("taId").references(() => users.id, { onDelete: "set null" }),
  },
  (t) => [
    uniqueIndex("course_meeting_slot_unique").on(
      t.courseId,
      t.academicYear,
      t.semester,
      t.day,
      t.startTime,
      t.group
    ),
    index("course_meeting_day_time_idx").on(t.day, t.startTime),
    index("course_meeting_room_idx").on(t.building, t.room),
    index("course_meeting_ta_idx").on(t.taId),
  ]
);

export const facultyOffices = pgTable(
  "faculty_office",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text("name").notNull(),
    nameAr: text("nameAr"),
    title: text("title"),
    department: text("department").notNull(),
    email: text("email"),
    building: text("building").notNull(),
    officeNumber: text("officeNumber").notNull(),
    officeHours: json("officeHours")
      .$type<{ day: string; start: string; end: string }[]>()
      .notNull()
      .default([]),
    officeHoursNote: text("officeHoursNote"),
    userId: text("userId").references(() => users.id, {
      onDelete: "set null",
    }),
    isInOffice: boolean("isInOffice").notNull().default(false),
    statusUpdatedAt: timestamp("statusUpdatedAt", { mode: "date" }),
    statusNote: text("statusNote"),
    updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("faculty_office_unique").on(t.name, t.department),
    uniqueIndex("faculty_office_user_unique").on(t.userId),
    index("faculty_office_dept_idx").on(t.department),
    index("faculty_office_live_idx").on(t.isInOffice),
  ]
);

export const scholarships = pgTable(
  "scholarship",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    title: text("title").notNull(),
    titleAr: text("titleAr"),
    provider: text("provider"),
    description: text("description"),
    coverageType: text("coverageType").notNull(),
    coverageValue: numeric("coverageValue", { precision: 10, scale: 2 }),
    currency: text("currency").default("EGP"),
    minCgpa: numeric("minCgpa", { precision: 3, scale: 2 }),
    minCredits: integer("minCredits"),
    eligiblePrograms: json("eligiblePrograms")
      .$type<string[]>()
      .notNull()
      .default([]),
    eligibleLevels: json("eligibleLevels").$type<number[]>().notNull().default([]),
    eligibilityRules: json("eligibilityRules")
      .$type<{ field: string; op: string; value: string | number }[]>()
      .notNull()
      .default([]),
    requiresNoDisciplinaryRecord: boolean("requiresNoDisciplinaryRecord")
      .notNull()
      .default(true),
    applicationDeadline: date("applicationDeadline"),
    isActive: boolean("isActive").notNull().default(true),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("scholarship_active_cgpa_idx").on(t.isActive, t.minCgpa)]
);

export const handbooks = pgTable(
  "handbook",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    academicYear: text("academicYear").notNull(),
    program: program("program").notNull().default("GENERAL"),
    title: text("title").notNull(),
    sourceUrl: text("sourceUrl"),
    version: text("version"),
    checksum: text("checksum"),
    pageCount: integer("pageCount"),
    uploadedAt: timestamp("uploadedAt", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    unique("handbook_year_program_unique").on(
      t.academicYear,
      t.program,
      t.version
    ),
  ]
);

export const handbookChunks = pgTable(
  "handbook_chunk",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    handbookId: text("handbookId").references(() => handbooks.id, {
      onDelete: "cascade",
    }),
    chunkIndex: integer("chunkIndex").notNull(),
    section: text("section"),
    pageFrom: integer("pageFrom"),
    pageTo: integer("pageTo"),
    content: text("content").notNull(),
    contentAr: text("contentAr"),
    language: text("language").notNull().default("MIXED"),
    contentHash: text("contentHash"),
    tokenCount: integer("tokenCount"),
    keywords: json("keywords").$type<string[]>().notNull().default([]),
    embedding: vector("embedding", { dimensions: 1536 }),
    embeddingAr: vector("embeddingAr", { dimensions: 1536 }),
    embeddingModel: text("embeddingModel"),
    sourceType: text("sourceType").notNull().default("HANDBOOK"),
    sourceId: text("sourceId"),
    tsv: tsvector("tsv").generatedAlwaysAs(
      sql`to_tsvector('simple', coalesce("content", '') || ' ' || coalesce("contentAr", ''))`
    ),
  },
  (t) => [
    uniqueIndex("handbook_chunk_unique")
      .on(t.handbookId, t.chunkIndex)
      .where(sql`${t.handbookId} is not null`),
    uniqueIndex("handbook_chunk_source_unique")
      .on(t.sourceType, t.sourceId, t.chunkIndex)
      .where(sql`${t.sourceId} is not null`),
    index("handbook_chunk_handbook_idx").on(t.handbookId),
    index("handbook_chunk_source_idx").on(t.sourceType, t.sourceId),
    index("handbook_chunk_tsv_idx").using("gin", t.tsv),
  ]
);

export const announcementKind = pgEnum("announcement_kind", [
  "LAB_CHANGE",
  "ROOM_CHANGE",
  "CANCELLATION",
  "RESCHEDULE",
  "GENERAL",
]);

export const courseAnnouncements = pgTable(
  "course_announcement",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    courseId: text("courseId")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    meetingId: text("meetingId").references(() => courseMeetings.id, {
      onDelete: "cascade",
    }),
    authorId: text("authorId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: announcementKind("kind").notNull().default("GENERAL"),
    title: text("title").notNull(),
    body: text("body").notNull(),
    bodyAr: text("bodyAr"),
    building: text("building"),
    room: text("room"),
    effectiveFrom: timestamp("effectiveFrom", { mode: "date" }),
    expiresAt: timestamp("expiresAt", { mode: "date" }),
    isPinned: boolean("isPinned").notNull().default(false),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    index("course_announcement_feed_idx").on(
      t.courseId,
      t.isPinned,
      t.createdAt
    ),
    index("course_announcement_author_idx").on(t.authorId),
  ]
);

export const qaStatus = pgEnum("qa_status", [
  "OPEN",
  "ESCALATED",
  "ASSIGNED",
  "PEER_ANSWERED",
  "TA_ANSWERED",
  "VERIFIED",
  "REJECTED",
  "CLOSED",
]);

export const qaThreads = pgTable(
  "qa_thread",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("userId").references(() => users.id, {
      onDelete: "set null",
    }),
    courseId: text("courseId").references(() => courses.id, {
      onDelete: "set null",
    }),
    assignedTaId: text("assignedTaId").references(() => users.id, {
      onDelete: "set null",
    }),
    status: qaStatus("status").notNull().default("OPEN"),
    language: text("language").notNull().default("EN"),
    question: text("question").notNull(),
    questionAr: text("questionAr"),
    ragAnswer: text("ragAnswer"),
    ragConfidence: numeric("ragConfidence", { precision: 4, scale: 3 }),
    ragDocIds: json("ragDocIds").$type<string[]>().notNull().default([]),
    peerAnswer: text("peerAnswer"),
    peerAnswerAr: text("peerAnswerAr"),
    peerAnsweredBy: text("peerAnsweredBy").references(() => users.id, {
      onDelete: "set null",
    }),
    peerAnsweredAt: timestamp("peerAnsweredAt", { mode: "date" }),
    taAnswer: text("taAnswer"),
    taAnswerAr: text("taAnswerAr"),
    taAnsweredBy: text("taAnsweredBy").references(() => users.id, {
      onDelete: "set null",
    }),
    taAnsweredAt: timestamp("taAnsweredAt", { mode: "date" }),
    verifiedBy: text("verifiedBy").references(() => users.id, {
      onDelete: "set null",
    }),
    verifiedAt: timestamp("verifiedAt", { mode: "date" }),
    promotedChunkId: text("promotedChunkId").references(
      () => handbookChunks.id,
      { onDelete: "set null" }
    ),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    index("qa_thread_queue_idx").on(t.status, t.assignedTaId, t.createdAt),
    index("qa_thread_course_idx").on(t.courseId, t.status),
    index("qa_thread_user_idx").on(t.userId),
    index("qa_thread_promoted_idx").on(t.promotedChunkId),
  ]
);

export const meritEvents = pgTable(
  "merit_event",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    delta: integer("delta").notNull(),
    reason: text("reason").notNull(),
    sourceType: text("sourceType").notNull(),
    sourceId: text("sourceId"),
    actorId: text("actorId").references(() => users.id, {
      onDelete: "set null",
    }),
    tierBefore: meritTier("tierBefore"),
    tierAfter: meritTier("tierAfter"),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("merit_event_source_unique")
      .on(t.sourceType, t.sourceId, t.reason)
      .where(sql`${t.sourceId} is not null`),
    index("merit_event_user_idx").on(t.userId, t.createdAt),
  ]
);

export const aiQueryLog = pgTable(
  "ai_query_log",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tier: meritTier("tier").notNull(),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("ai_query_log_user_idx").on(t.userId, t.createdAt)]
);
