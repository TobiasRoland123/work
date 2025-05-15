ALTER TABLE "status" DROP CONSTRAINT "status_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "users_business_phone_numbers" DROP CONSTRAINT "users_business_phone_numbers_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "users_organisation_roles" DROP CONSTRAINT "users_organisation_roles_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "status" ADD CONSTRAINT "status_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users_business_phone_numbers" ADD CONSTRAINT "users_business_phone_numbers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users_organisation_roles" ADD CONSTRAINT "users_organisation_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;