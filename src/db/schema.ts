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
import type { AdapterAccountType } from "next-auth/adapters";

const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

export const userRole = pgEnum("user_role", ["STUDENT", "ADMIN"]);

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
  createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
});

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
    updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("faculty_office_unique").on(t.name, t.department),
    index("faculty_office_dept_idx").on(t.department),
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
    handbookId: text("handbookId")
      .notNull()
      .references(() => handbooks.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunkIndex").notNull(),
    section: text("section"),
    pageFrom: integer("pageFrom"),
    pageTo: integer("pageTo"),
    content: text("content").notNull(),
    contentAr: text("contentAr"),
    tokenCount: integer("tokenCount"),
    keywords: json("keywords").$type<string[]>().notNull().default([]),
    embedding: vector("embedding", { dimensions: 1536 }),
    embeddingModel: text("embeddingModel"),
    tsv: tsvector("tsv").generatedAlwaysAs(
      sql`to_tsvector('simple', coalesce("content", '') || ' ' || coalesce("contentAr", ''))`
    ),
  },
  (t) => [
    unique("handbook_chunk_unique").on(t.handbookId, t.chunkIndex),
    index("handbook_chunk_handbook_idx").on(t.handbookId),
    index("handbook_chunk_tsv_idx").using("gin", t.tsv),
  ]
);
