ALTER TABLE "users" RENAME COLUMN "organisation" TO "organisation_id";--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_organisation_organisations_id_fk";
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE no action ON UPDATE no action;