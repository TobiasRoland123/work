ALTER TABLE status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_service_role_select"
  ON status
  AS PERMISSIVE
  FOR SELECT
  TO service_role
  USING (true);