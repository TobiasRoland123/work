CREATE TYPE "public"."declaration_origin" AS ENUM('MANUAL', 'SHORTHAND', 'AI');--> statement-breakpoint
ALTER TABLE "status" ADD COLUMN "origin" "declaration_origin";--> statement-breakpoint
-- Only Slack intake sets a source message, so every other row was entered by hand.
UPDATE "status"
SET "origin" = 'MANUAL'
WHERE "source_message_key" IS NULL;
--> statement-breakpoint
-- Shorthand never calls the model, so a completed model request for the exact revision that
-- wrote a row records AI interpretation. Rows without such a record keep an unknown origin.
UPDATE "status" AS declaration
SET "origin" = 'AI'
WHERE declaration."source_message_key" IS NOT NULL
	AND EXISTS (
		SELECT 1
		FROM "slack_ai_usage" AS attempt
		WHERE attempt."message_key" = declaration."source_message_key"
			AND attempt."state" = 'completed'
			AND declaration."announced_at" = date_trunc('milliseconds', to_timestamp(attempt."revision"::double precision))
	);
