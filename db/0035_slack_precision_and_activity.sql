ALTER TABLE "status" ADD COLUMN "starts_at_approximate" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "status" ADD COLUMN "ends_at_approximate" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "slack_deactivated" boolean DEFAULT false NOT NULL;