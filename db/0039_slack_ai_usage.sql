CREATE TABLE "slack_ai_usage" (
	"id" text PRIMARY KEY NOT NULL,
	"message_key" text NOT NULL,
	"revision" text NOT NULL,
	"team_id" text NOT NULL,
	"channel_id" text NOT NULL,
	"model" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"cost_usd" numeric(20, 12),
	"input_tokens" integer,
	"output_tokens" integer,
	"response_id" text,
	"state" text DEFAULT 'started' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "slack_ai_usage" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "slack_ai_usage_team_channel_started_idx" ON "slack_ai_usage" USING btree ("team_id","channel_id","started_at");