ALTER TABLE "users" ADD COLUMN "can_use_sandbox" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
UPDATE "users"
SET "can_use_sandbox" = true
WHERE "slack_team_id" = 'T02HKL21R'
  AND "slack_user_id" = 'U05NP1NF3QB';
