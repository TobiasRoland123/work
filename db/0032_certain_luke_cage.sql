DROP ROLE "service_role";--> statement-breakpoint
ALTER POLICY "allow_service_role_select" ON "status" TO serviceRole USING (true);