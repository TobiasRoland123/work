CREATE ROLE "service_role";--> statement-breakpoint
CREATE POLICY "allow_service_role_select" ON "status" AS PERMISSIVE FOR SELECT TO "service_role" USING (true);