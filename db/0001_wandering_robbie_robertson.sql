CREATE TYPE "public"."user_status" AS ENUM('IN_OFFICE', 'FROM_HOME', 'AT_CLIENT', 'SICK', 'IN_LATE', 'LEAVING_EARLY', 'VACATION', 'CHILD_SICK', 'ON_LEAVE');--> statement-breakpoint
CREATE TABLE "organisation_roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"role_name" text
);
--> statement-breakpoint
CREATE TABLE "organisations" (
	"id" serial PRIMARY KEY NOT NULL,
	"organisation_name" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "status" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"status" "user_status" DEFAULT 'IN_OFFICE' NOT NULL,
	"details" text,
	"time" timestamp,
	"from_date" date,
	"to_date" date
);
--> statement-breakpoint
CREATE TABLE "users_organisation_roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"organisation_role_id" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "organisation_id" integer;--> statement-breakpoint
ALTER TABLE "status" ADD CONSTRAINT "status_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users_organisation_roles" ADD CONSTRAINT "users_organisation_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users_organisation_roles" ADD CONSTRAINT "users_organisation_roles_organisation_role_id_organisation_roles_id_fk" FOREIGN KEY ("organisation_role_id") REFERENCES "public"."organisation_roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE no action ON UPDATE no action;