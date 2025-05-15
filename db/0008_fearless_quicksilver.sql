ALTER TABLE "business_phone_numbers" ALTER COLUMN "business_phone_numbers" SET DATA TYPE varchar(11);--> statement-breakpoint
ALTER TABLE "organisation_roles" ALTER COLUMN "role_name" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "organisations" ALTER COLUMN "organisation_name" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "user_id" SET DATA TYPE varchar(36);--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "last_name" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "email" SET DATA TYPE varchar(20);--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "mobile_phone" SET DATA TYPE varchar(11);