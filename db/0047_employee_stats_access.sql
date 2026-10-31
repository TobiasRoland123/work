CREATE TABLE "employee_stats_access" (
	"user_id" varchar(36) PRIMARY KEY NOT NULL,
	"granted_by_user_id" varchar(36),
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "employee_stats_access" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "employee_stats_access" ADD CONSTRAINT "employee_stats_access_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_stats_access" ADD CONSTRAINT "employee_stats_access_granted_by_user_id_users_user_id_fk" FOREIGN KEY ("granted_by_user_id") REFERENCES "public"."users"("user_id") ON DELETE set null ON UPDATE no action;