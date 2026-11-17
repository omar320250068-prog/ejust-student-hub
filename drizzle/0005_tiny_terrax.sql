CREATE TABLE "ai_query_log" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"tier" "merit_tier" NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "merit_event" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"delta" integer NOT NULL,
	"reason" text NOT NULL,
	"sourceType" text NOT NULL,
	"sourceId" text,
	"actorId" text,
	"tierBefore" "merit_tier",
	"tierAfter" "merit_tier",
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "autoApproveRevokedAt" timestamp;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "autoApproveRevokedBy" text;--> statement-breakpoint
ALTER TABLE "ai_query_log" ADD CONSTRAINT "ai_query_log_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merit_event" ADD CONSTRAINT "merit_event_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merit_event" ADD CONSTRAINT "merit_event_actorId_user_id_fk" FOREIGN KEY ("actorId") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_query_log_user_idx" ON "ai_query_log" USING btree ("userId","createdAt");--> statement-breakpoint
CREATE UNIQUE INDEX "merit_event_source_unique" ON "merit_event" USING btree ("sourceType","sourceId","reason") WHERE "merit_event"."sourceId" is not null;--> statement-breakpoint
CREATE INDEX "merit_event_user_idx" ON "merit_event" USING btree ("userId","createdAt");--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_autoApproveRevokedBy_user_id_fk" FOREIGN KEY ("autoApproveRevokedBy") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;