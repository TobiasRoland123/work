ALTER TYPE "public"."user_status" ADD VALUE 'AWAY';--> statement-breakpoint
CREATE TABLE "slack_messages" (
	"message_key" text PRIMARY KEY NOT NULL,
	"team_id" text NOT NULL,
	"channel_id" text NOT NULL,
	"message_ts" text NOT NULL,
	"revision" text NOT NULL,
	"slack_user_id" text,
	"text" text,
	"state" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"outcome" jsonb
);
--> statement-breakpoint
ALTER TABLE "slack_messages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "status" ADD COLUMN "source_message_key" text;--> statement-breakpoint
ALTER TABLE "status" ADD COLUMN "starts_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "status" ADD COLUMN "ends_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "slack_user_id" varchar(32);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "slack_team_id" varchar(32);--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_slack_identity_unique" UNIQUE("slack_team_id","slack_user_id");