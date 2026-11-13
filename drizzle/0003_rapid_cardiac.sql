CREATE TYPE "public"."program" AS ENUM('CSC', 'AID', 'CNC', 'BIF', 'GENERAL');--> statement-breakpoint
CREATE TYPE "public"."weekday" AS ENUM('SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'SATURDAY');--> statement-breakpoint
CREATE TABLE "course_meeting" (
	"id" text PRIMARY KEY NOT NULL,
	"courseId" text NOT NULL,
	"academicYear" text NOT NULL,
	"semester" text NOT NULL,
	"day" "weekday" NOT NULL,
	"startTime" text NOT NULL,
	"endTime" text NOT NULL,
	"building" text,
	"room" text,
	"group" text,
	"instructor" text
);
--> statement-breakpoint
CREATE TABLE "course" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"nameAr" text,
	"program" "program" DEFAULT 'GENERAL' NOT NULL,
	"level" integer,
	"creditHours" integer DEFAULT 3 NOT NULL,
	"isElective" boolean DEFAULT false NOT NULL,
	"description" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "course_code_program_unique" UNIQUE("code","program")
);
--> statement-breakpoint
CREATE TABLE "faculty_office" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"nameAr" text,
	"title" text,
	"department" text NOT NULL,
	"email" text,
	"building" text NOT NULL,
	"officeNumber" text NOT NULL,
	"officeHours" json DEFAULT '[]'::json NOT NULL,
	"officeHoursNote" text,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "handbook_chunk" (
	"id" text PRIMARY KEY NOT NULL,
	"handbookId" text NOT NULL,
	"chunkIndex" integer NOT NULL,
	"section" text,
	"pageFrom" integer,
	"pageTo" integer,
	"content" text NOT NULL,
	"contentAr" text,
	"tokenCount" integer,
	"keywords" json DEFAULT '[]'::json NOT NULL,
	"embedding" vector(1536),
	"embeddingModel" text,
	"tsv" "tsvector" GENERATED ALWAYS AS (to_tsvector('simple', coalesce("content", '') || ' ' || coalesce("contentAr", ''))) STORED,
	CONSTRAINT "handbook_chunk_unique" UNIQUE("handbookId","chunkIndex")
);
--> statement-breakpoint
CREATE TABLE "handbook" (
	"id" text PRIMARY KEY NOT NULL,
	"academicYear" text NOT NULL,
	"program" "program" DEFAULT 'GENERAL' NOT NULL,
	"title" text NOT NULL,
	"sourceUrl" text,
	"version" text,
	"checksum" text,
	"pageCount" integer,
	"uploadedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "handbook_year_program_unique" UNIQUE("academicYear","program","version")
);
--> statement-breakpoint
CREATE TABLE "scholarship" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"titleAr" text,
	"provider" text,
	"description" text,
	"coverageType" text NOT NULL,
	"coverageValue" numeric(10, 2),
	"currency" text DEFAULT 'EGP',
	"minCgpa" numeric(3, 2),
	"minCredits" integer,
	"eligiblePrograms" json DEFAULT '[]'::json NOT NULL,
	"eligibleLevels" json DEFAULT '[]'::json NOT NULL,
	"eligibilityRules" json DEFAULT '[]'::json NOT NULL,
	"requiresNoDisciplinaryRecord" boolean DEFAULT true NOT NULL,
	"applicationDeadline" date,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "course_meeting" ADD CONSTRAINT "course_meeting_courseId_course_id_fk" FOREIGN KEY ("courseId") REFERENCES "public"."course"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handbook_chunk" ADD CONSTRAINT "handbook_chunk_handbookId_handbook_id_fk" FOREIGN KEY ("handbookId") REFERENCES "public"."handbook"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "course_meeting_slot_unique" ON "course_meeting" USING btree ("courseId","academicYear","semester","day","startTime","group");--> statement-breakpoint
CREATE INDEX "course_meeting_day_time_idx" ON "course_meeting" USING btree ("day","startTime");--> statement-breakpoint
CREATE INDEX "course_meeting_room_idx" ON "course_meeting" USING btree ("building","room");--> statement-breakpoint
CREATE INDEX "course_program_level_idx" ON "course" USING btree ("program","level");--> statement-breakpoint
CREATE UNIQUE INDEX "faculty_office_unique" ON "faculty_office" USING btree ("name","department");--> statement-breakpoint
CREATE INDEX "faculty_office_dept_idx" ON "faculty_office" USING btree ("department");--> statement-breakpoint
CREATE INDEX "handbook_chunk_handbook_idx" ON "handbook_chunk" USING btree ("handbookId");--> statement-breakpoint
CREATE INDEX "handbook_chunk_tsv_idx" ON "handbook_chunk" USING gin ("tsv");--> statement-breakpoint
CREATE INDEX "scholarship_active_cgpa_idx" ON "scholarship" USING btree ("isActive","minCgpa");