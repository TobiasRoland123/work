CREATE TABLE "learned_shorthands" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" text NOT NULL,
	"channel_id" text NOT NULL,
	"phrase" text NOT NULL,
	"template" jsonb NOT NULL,
	"state" text NOT NULL,
	"occurrences" integer NOT NULL,
	"promoted_at" timestamp with time zone,
	"blocked_at" timestamp with time zone,
	"blocked_reason" text,
	"blocked_by_correction_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "learned_shorthands_phrase_unique" UNIQUE("team_id","channel_id","phrase")
);
--> statement-breakpoint
ALTER TABLE "learned_shorthands" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "shorthand_observations" (
	"message_key" text PRIMARY KEY NOT NULL,
	"revision" text NOT NULL,
	"team_id" text NOT NULL,
	"channel_id" text NOT NULL,
	"phrase" text NOT NULL,
	"template" jsonb NOT NULL,
	"source" text NOT NULL,
	"learned_shorthand_id" integer,
	"corrected_at" timestamp with time zone,
	"correction_id" integer,
	"observed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "shorthand_observations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "learned_shorthands" ADD CONSTRAINT "learned_shorthands_blocked_by_correction_id_status_corrections_id_fk" FOREIGN KEY ("blocked_by_correction_id") REFERENCES "public"."status_corrections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shorthand_observations" ADD CONSTRAINT "shorthand_observations_message_key_slack_messages_message_key_fk" FOREIGN KEY ("message_key") REFERENCES "public"."slack_messages"("message_key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shorthand_observations" ADD CONSTRAINT "shorthand_observations_learned_shorthand_id_learned_shorthands_id_fk" FOREIGN KEY ("learned_shorthand_id") REFERENCES "public"."learned_shorthands"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shorthand_observations" ADD CONSTRAINT "shorthand_observations_correction_id_status_corrections_id_fk" FOREIGN KEY ("correction_id") REFERENCES "public"."status_corrections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "shorthand_observations_phrase_idx" ON "shorthand_observations" USING btree ("team_id","channel_id","phrase");