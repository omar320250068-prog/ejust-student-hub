CREATE TABLE "student_academic_record" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"courseCode" text NOT NULL,
	"courseName" text NOT NULL,
	"creditHours" integer DEFAULT 3 NOT NULL,
	"grade" text,
	"semester" text NOT NULL,
	"status" text DEFAULT 'registered' NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "student_academic_record_user_course_semester_unique" UNIQUE("userId","courseCode","semester")
);
--> statement-breakpoint
ALTER TABLE "student_academic_record" ADD CONSTRAINT "student_academic_record_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "student_academic_record_user_idx" ON "student_academic_record" USING btree ("userId");