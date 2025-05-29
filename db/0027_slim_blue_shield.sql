ALTER TABLE "users" RENAME COLUMN "organisation_id" TO "organisation";--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_organisation_id_organisations_id_fk";
