CREATE TABLE "status_corrections" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"original_status_id" integer,
	"correction_status_id" integer,
	"source_message_key" text NOT NULL,
	"source_revision" text,
	"original_status" "user_status",
	"original_details" text,
	"corrected_status" "user_status" NOT NULL,
	"from_date" date NOT NULL,
	"to_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "status_corrections_correction_unique" UNIQUE NULLS NOT DISTINCT("user_id","source_message_key","source_revision","corrected_status","from_date","to_date")
);
--> statement-breakpoint
ALTER TABLE "status_corrections" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "status_corrections" ADD CONSTRAINT "status_corrections_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status_corrections" ADD CONSTRAINT "status_corrections_original_status_id_status_id_fk" FOREIGN KEY ("original_status_id") REFERENCES "public"."status"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status_corrections" ADD CONSTRAINT "status_corrections_correction_status_id_status_id_fk" FOREIGN KEY ("correction_status_id") REFERENCES "public"."status"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "status_corrections_created_idx" ON "status_corrections" USING btree ("created_at");