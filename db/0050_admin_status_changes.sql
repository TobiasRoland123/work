CREATE TABLE "admin_status_changes" (
	"id" serial PRIMARY KEY NOT NULL,
	"admin_user_id" varchar(36),
	"user_id" varchar(36) NOT NULL,
	"status_id" integer,
	"status" "user_status" NOT NULL,
	"details" text,
	"time" timestamp,
	"from_date" date NOT NULL,
	"to_date" date NOT NULL,
	"replaced" jsonb NOT NULL,
	"overrides_import" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admin_status_changes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "admin_status_changes" ADD CONSTRAINT "admin_status_changes_admin_user_id_users_user_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."users"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_status_changes" ADD CONSTRAINT "admin_status_changes_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_status_changes" ADD CONSTRAINT "admin_status_changes_status_id_status_id_fk" FOREIGN KEY ("status_id") REFERENCES "public"."status"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_status_changes_created_idx" ON "admin_status_changes" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "admin_status_changes_user_idx" ON "admin_status_changes" USING btree ("user_id");