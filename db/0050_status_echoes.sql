-- Echoes: the bot's announcements of app Declarations in the attendance channel (ADR 0003).
-- No public RLS policies: only the server database role may access this table.
CREATE TABLE "status_echoes" (
	"id" serial PRIMARY KEY NOT NULL,
	"status_id" integer,
	"user_id" varchar(36) NOT NULL,
	"post_on" date NOT NULL,
	"status" "user_status" NOT NULL,
	"emoji" text,
	"details" text,
	"from_date" date NOT NULL,
	"to_date" date NOT NULL,
	"time_note" text,
	"state" text DEFAULT 'scheduled' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_error" text,
	"channel_id" text,
	"ts" text,
	"posted_text" text,
	"posted_at" timestamp with time zone,
	"deleted_in_slack_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "status_echoes_status_unique" UNIQUE("status_id"),
	CONSTRAINT "status_echoes_message_unique" UNIQUE("channel_id","ts")
);
--> statement-breakpoint
ALTER TABLE "status_echoes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "status_echoes" ADD CONSTRAINT "status_echoes_status_id_status_id_fk" FOREIGN KEY ("status_id") REFERENCES "public"."status"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status_echoes" ADD CONSTRAINT "status_echoes_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "status_echoes_state_post_on_idx" ON "status_echoes" USING btree ("state","post_on");--> statement-breakpoint
CREATE INDEX "status_echoes_user_idx" ON "status_echoes" USING btree ("user_id");
