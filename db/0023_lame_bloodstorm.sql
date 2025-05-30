ALTER TABLE "users" RENAME COLUMN "organisation_id" TO "organisation";--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_organisation_id_organisations_id_fk";
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_organisation_organisations_organisation_name_fk" FOREIGN KEY ("organisation") REFERENCES "public"."organisations"("organisation_name") ON DELETE no action ON UPDATE no action;