CREATE TABLE "pinned_colleagues" (
	"user_id" varchar(36) NOT NULL,
	"colleague_user_id" varchar(36) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pinned_colleagues_user_id_colleague_user_id_pk" PRIMARY KEY("user_id","colleague_user_id"),
	CONSTRAINT "pinned_colleagues_not_self" CHECK ("pinned_colleagues"."user_id" <> "pinned_colleagues"."colleague_user_id")
);
--> statement-breakpoint
ALTER TABLE "pinned_colleagues" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "pinned_colleagues" ADD CONSTRAINT "pinned_colleagues_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pinned_colleagues" ADD CONSTRAINT "pinned_colleagues_colleague_user_id_users_user_id_fk" FOREIGN KEY ("colleague_user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;