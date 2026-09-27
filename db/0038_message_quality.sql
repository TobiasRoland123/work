ALTER TABLE "slack_messages" ADD COLUMN "review_text" text;--> statement-breakpoint
ALTER TABLE "slack_messages" ADD COLUMN "converted_to_status" boolean;--> statement-breakpoint
ALTER TABLE "slack_messages" ADD COLUMN "processed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "can_review_messages" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "slack_messages"
SET "converted_to_status" = ("state" = 'applied' AND "outcome" ->> 'reason' = 'clear')
WHERE "state" IN ('applied', 'review', 'ignored')
	AND "outcome" ->> 'reason' IS NOT NULL;--> statement-breakpoint
UPDATE "users"
SET "can_review_messages" = true
WHERE "slack_team_id" = 'T02HKL21R'
	AND "slack_user_id" = 'U05NP1NF3QB';
--> statement-breakpoint
UPDATE "slack_messages" AS message
SET "review_text" = left(message."text", 12000)
WHERE message."state" = 'pending'
	AND message."text" IS NOT NULL;
--> statement-breakpoint
UPDATE "slack_messages" AS message
SET "review_text" = left(status."details", 12000)
FROM "status"
WHERE message."state" = 'applied'
	AND message."converted_to_status" = false
	AND message."outcome" ->> 'reason' IN ('uncertain_status', 'not_attendance')
	AND status."source_message_key" = message."message_key"
	AND status."status" IS NULL
	AND status."announced_at" = date_trunc('milliseconds', to_timestamp(message."revision"::double precision))
	AND status."details" IS NOT NULL;
