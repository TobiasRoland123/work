-- Replace the unused legacy roles with the application's actual permission hierarchy.
-- Migration runners must apply this migration in one transaction.
ALTER TABLE "users" ALTER COLUMN "system_role" DROP DEFAULT;
--> statement-breakpoint
ALTER TYPE "public"."system_role" RENAME TO "system_role_legacy";
--> statement-breakpoint
CREATE TYPE "public"."system_role" AS ENUM('ADMIN', 'MANAGER', 'EMPLOYEE');
--> statement-breakpoint
-- Never trust a legacy ADMIN value. Bootstrap only the verified initial admin identity.
ALTER TABLE "users" ALTER COLUMN "system_role" TYPE "public"."system_role" USING (
  CASE
    WHEN "slack_team_id" = 'T02HKL21R' AND "slack_user_id" = 'U05NP1NF3QB' THEN 'ADMIN'
    ELSE 'EMPLOYEE'
  END
)::"public"."system_role";
--> statement-breakpoint
-- Existing stats viewers keep stats access as managers. Old reviewer flags do not grant roles.
UPDATE "users" SET "system_role" = 'MANAGER'
WHERE "system_role" <> 'ADMIN'
  AND EXISTS (SELECT 1 FROM "employee_stats_access" WHERE "employee_stats_access"."user_id" = "users"."user_id");
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "system_role" SET DEFAULT 'EMPLOYEE'::"public"."system_role";
--> statement-breakpoint
DROP TYPE "public"."system_role_legacy";

--> statement-breakpoint
-- Roles are server-managed. No public Data API policy may allow self-promotion.
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
