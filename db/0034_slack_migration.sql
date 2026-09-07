CREATE TABLE "slack_identities" (
	"team_id" text NOT NULL,
	"slack_user_id" text NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "slack_identities_team_id_slack_user_id_pk" PRIMARY KEY("team_id","slack_user_id"),
	CONSTRAINT "slack_identity_user_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "slack_messages" (
	"key" text PRIMARY KEY NOT NULL,
	"channel_id" text NOT NULL,
	"message_ts" text NOT NULL,
	"content_hash" text NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "slack_sync_state" (
	"channel_id" text PRIMARY KEY NOT NULL,
	"completed_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "status" ADD COLUMN "slack_message_key" text;--> statement-breakpoint
ALTER TABLE "status" ADD COLUMN "source_index" integer;--> statement-breakpoint
ALTER TABLE "status" ADD COLUMN "starts_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "status" ADD COLUMN "ends_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "status" ADD COLUMN "time_precision" text;--> statement-breakpoint
ALTER TABLE "status" ADD COLUMN "time_label" text;--> statement-breakpoint
ALTER TABLE "slack_identities" ADD CONSTRAINT "slack_identities_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status" ADD CONSTRAINT "status_slack_message_key_slack_messages_key_fk" FOREIGN KEY ("slack_message_key") REFERENCES "public"."slack_messages"("key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status" ADD CONSTRAINT "status_slack_source_unique" UNIQUE("slack_message_key","source_index");