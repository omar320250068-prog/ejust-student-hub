-- Custom SQL migration file, put your code below! --
DO $$ BEGIN
  CREATE TYPE "public"."user_role" AS ENUM('STUDENT', 'ADMIN');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "user"
  ADD COLUMN IF NOT EXISTS "passwordHash" text,
  ADD COLUMN IF NOT EXISTS "role" "user_role" DEFAULT 'STUDENT' NOT NULL,
  ADD COLUMN IF NOT EXISTS "createdAt" timestamp DEFAULT now() NOT NULL,
  ADD COLUMN IF NOT EXISTS "updatedAt" timestamp DEFAULT now() NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "student_profile" (
  "id" text PRIMARY KEY NOT NULL,
  "userId" text NOT NULL,
  "studentId" text NOT NULL,
  "age" integer NOT NULL,
  "gender" text NOT NULL,
  "faculty" text NOT NULL,
  "academicYear" text NOT NULL,
  "group" text NOT NULL,
  "section" text NOT NULL,
  CONSTRAINT "student_profile_userId_unique" UNIQUE("userId"),
  CONSTRAINT "student_profile_studentId_unique" UNIQUE("studentId")
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "student_profile"
    ADD CONSTRAINT "student_profile_userId_user_id_fk"
    FOREIGN KEY ("userId") REFERENCES "public"."user"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;