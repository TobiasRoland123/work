CREATE TABLE "slack_message_feedback" (
	"message_key" text NOT NULL,
	"revision" text NOT NULL,
	"preferred_status" "user_status" NOT NULL,
	"note" varchar(2000),
	"reviewer_user_id" varchar(36),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "slack_message_feedback_revision_unique" UNIQUE("message_key","revision")
);
--> statement-breakpoint
ALTER TABLE "slack_message_feedback" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "slack_message_feedback" ADD CONSTRAINT "slack_message_feedback_message_key_slack_messages_message_key_fk" FOREIGN KEY ("message_key") REFERENCES "public"."slack_messages"("message_key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slack_message_feedback" ADD CONSTRAINT "slack_message_feedback_reviewer_user_id_users_user_id_fk" FOREIGN KEY ("reviewer_user_id") REFERENCES "public"."users"("user_id") ON DELETE set null ON UPDATE no action;