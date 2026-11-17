ALTER TYPE "public"."user_role" ADD VALUE 'TA';--> statement-breakpoint
CREATE TYPE "public"."announcement_kind" AS ENUM('LAB_CHANGE', 'ROOM_CHANGE', 'CANCELLATION', 'RESCHEDULE', 'GENERAL');--> statement-breakpoint
CREATE TYPE "public"."meeting_type" AS ENUM('LECTURE', 'LAB', 'SECTION', 'TUTORIAL');--> statement-breakpoint
CREATE TYPE "public"."merit_tier" AS ENUM('EXPLORER', 'PEER_HELPER', 'CAMPUS_AMBASSADOR', 'EJUST_MENTOR');--> statement-breakpoint
CREATE TYPE "public"."qa_status" AS ENUM('OPEN', 'ESCALATED', 'ASSIGNED', 'PEER_ANSWERED', 'TA_ANSWERED', 'VERIFIED', 'REJECTED', 'CLOSED');--> statement-breakpoint
CREATE TYPE "public"."ta_status" AS ENUM('NONE', 'PENDING', 'APPROVED', 'REJECTED');--> statement-breakpoint
CREATE TABLE "course_announcement" (
	"id" text PRIMARY KEY NOT NULL,
	"courseId" text NOT NULL,
	"meetingId" text,
	"authorId" text NOT NULL,
	"kind" "announcement_kind" DEFAULT 'GENERAL' NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"bodyAr" text,
	"building" text,
	"room" text,
	"effectiveFrom" timestamp,
	"expiresAt" timestamp,
	"isPinned" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "qa_thread" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text,
	"courseId" text,
	"assignedTaId" text,
	"status" "qa_status" DEFAULT 'OPEN' NOT NULL,
	"language" text DEFAULT 'EN' NOT NULL,
	"question" text NOT NULL,
	"questionAr" text,
	"ragAnswer" text,
	"ragConfidence" numeric(4, 3),
	"ragDocIds" json DEFAULT '[]'::json NOT NULL,
	"peerAnswer" text,
	"peerAnswerAr" text,
	"peerAnsweredBy" text,
	"peerAnsweredAt" timestamp,
	"taAnswer" text,
	"taAnswerAr" text,
	"taAnsweredBy" text,
	"taAnsweredAt" timestamp,
	"verifiedBy" text,
	"verifiedAt" timestamp,
	"promotedChunkId" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "handbook_chunk" DROP CONSTRAINT "handbook_chunk_unique";--> statement-breakpoint
ALTER TABLE "handbook_chunk" ALTER COLUMN "handbookId" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "course_meeting" ADD COLUMN "meetingType" "meeting_type" DEFAULT 'LECTURE' NOT NULL;--> statement-breakpoint
ALTER TABLE "course_meeting" ADD COLUMN "taId" text;--> statement-breakpoint
ALTER TABLE "faculty_office" ADD COLUMN "userId" text;--> statement-breakpoint
ALTER TABLE "faculty_office" ADD COLUMN "isInOffice" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "faculty_office" ADD COLUMN "statusUpdatedAt" timestamp;--> statement-breakpoint
ALTER TABLE "faculty_office" ADD COLUMN "statusNote" text;--> statement-breakpoint
ALTER TABLE "handbook_chunk" ADD COLUMN "language" text DEFAULT 'MIXED' NOT NULL;--> statement-breakpoint
ALTER TABLE "handbook_chunk" ADD COLUMN "contentHash" text;--> statement-breakpoint
ALTER TABLE "handbook_chunk" ADD COLUMN "embeddingAr" vector(1536);--> statement-breakpoint
ALTER TABLE "handbook_chunk" ADD COLUMN "sourceType" text DEFAULT 'HANDBOOK' NOT NULL;--> statement-breakpoint
ALTER TABLE "handbook_chunk" ADD COLUMN "sourceId" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "meritTierOverride" "merit_tier";--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "taStatus" "ta_status" DEFAULT 'NONE' NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "taAppliedAt" timestamp;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "taReviewedAt" timestamp;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "taReviewedBy" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "taNote" text;--> statement-breakpoint
ALTER TABLE "course_announcement" ADD CONSTRAINT "course_announcement_courseId_course_id_fk" FOREIGN KEY ("courseId") REFERENCES "public"."course"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_announcement" ADD CONSTRAINT "course_announcement_meetingId_course_meeting_id_fk" FOREIGN KEY ("meetingId") REFERENCES "public"."course_meeting"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_announcement" ADD CONSTRAINT "course_announcement_authorId_user_id_fk" FOREIGN KEY ("authorId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qa_thread" ADD CONSTRAINT "qa_thread_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qa_thread" ADD CONSTRAINT "qa_thread_courseId_course_id_fk" FOREIGN KEY ("courseId") REFERENCES "public"."course"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qa_thread" ADD CONSTRAINT "qa_thread_assignedTaId_user_id_fk" FOREIGN KEY ("assignedTaId") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qa_thread" ADD CONSTRAINT "qa_thread_peerAnsweredBy_user_id_fk" FOREIGN KEY ("peerAnsweredBy") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qa_thread" ADD CONSTRAINT "qa_thread_taAnsweredBy_user_id_fk" FOREIGN KEY ("taAnsweredBy") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qa_thread" ADD CONSTRAINT "qa_thread_verifiedBy_user_id_fk" FOREIGN KEY ("verifiedBy") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qa_thread" ADD CONSTRAINT "qa_thread_promotedChunkId_handbook_chunk_id_fk" FOREIGN KEY ("promotedChunkId") REFERENCES "public"."handbook_chunk"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "course_announcement_feed_idx" ON "course_announcement" USING btree ("courseId","isPinned","createdAt");--> statement-breakpoint
CREATE INDEX "course_announcement_author_idx" ON "course_announcement" USING btree ("authorId");--> statement-breakpoint
CREATE INDEX "qa_thread_queue_idx" ON "qa_thread" USING btree ("status","assignedTaId","createdAt");--> statement-breakpoint
CREATE INDEX "qa_thread_course_idx" ON "qa_thread" USING btree ("courseId","status");--> statement-breakpoint
CREATE INDEX "qa_thread_user_idx" ON "qa_thread" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "qa_thread_promoted_idx" ON "qa_thread" USING btree ("promotedChunkId");--> statement-breakpoint
ALTER TABLE "course_meeting" ADD CONSTRAINT "course_meeting_taId_user_id_fk" FOREIGN KEY ("taId") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faculty_office" ADD CONSTRAINT "faculty_office_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_taReviewedBy_user_id_fk" FOREIGN KEY ("taReviewedBy") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "course_meeting_ta_idx" ON "course_meeting" USING btree ("taId");--> statement-breakpoint
CREATE UNIQUE INDEX "faculty_office_user_unique" ON "faculty_office" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "faculty_office_live_idx" ON "faculty_office" USING btree ("isInOffice");--> statement-breakpoint
CREATE UNIQUE INDEX "handbook_chunk_unique" ON "handbook_chunk" USING btree ("handbookId","chunkIndex") WHERE "handbook_chunk"."handbookId" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "handbook_chunk_source_unique" ON "handbook_chunk" USING btree ("sourceType","sourceId","chunkIndex") WHERE "handbook_chunk"."sourceId" is not null;--> statement-breakpoint
CREATE INDEX "handbook_chunk_source_idx" ON "handbook_chunk" USING btree ("sourceType","sourceId");--> statement-breakpoint
CREATE INDEX "user_ta_status_idx" ON "user" USING btree ("taStatus","createdAt");