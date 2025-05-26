CREATE TABLE "business_phone_numbers" (
	"id" serial PRIMARY KEY NOT NULL,
	"business_phone_numbers" varchar(11)
);
--> statement-breakpoint
CREATE TABLE "users_business_phone_numbers" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"business_phone_numbers_id" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "mobile_phone" varchar(11);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "profile_picture" text;--> statement-breakpoint
ALTER TABLE "users_business_phone_numbers" ADD CONSTRAINT "users_business_phone_numbers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users_business_phone_numbers" ADD CONSTRAINT "users_business_phone_numbers_business_phone_numbers_id_business_phone_numbers_id_fk" FOREIGN KEY ("business_phone_numbers_id") REFERENCES "public"."business_phone_numbers"("id") ON DELETE no action ON UPDATE no action;