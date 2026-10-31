-- Do not backfill: previous deterministic/learned handling was not recorded reliably.
CREATE TABLE "slack_message_processing" (
  "message_key" text PRIMARY KEY NOT NULL,
  "team_id" text NOT NULL,
  "channel_id" text NOT NULL,
  "handled_at" timestamp with time zone DEFAULT now() NOT NULL,
  "used_ai" boolean NOT NULL
);
--> statement-breakpoint
ALTER TABLE "slack_message_processing" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE INDEX "slack_message_processing_team_channel_handled_idx" ON "slack_message_processing" USING btree ("team_id", "channel_id", "handled_at");
--> statement-breakpoint
CREATE INDEX "slack_ai_usage_message_key_idx" ON "slack_ai_usage" USING btree ("message_key");
