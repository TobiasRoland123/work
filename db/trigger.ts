import { db } from './index';

export async function up() {
  await db.execute(`
    CREATE OR REPLACE FUNCTION notify_status_update() RETURNS trigger AS $$
    DECLARE
      payload JSON;
    BEGIN
      IF (TG_OP = 'DELETE') THEN
        payload = row_to_json(OLD);
      ELSE
        payload = row_to_json(NEW);
      END IF;
      IF payload IS NOT NULL THEN
        PERFORM pg_notify(
          'status_update',
          json_build_object(
            'type', 'STATUS_UPDATE',
            'operation', TG_OP,
            'payload', payload
          )::text
        );
      END IF;
      RETURN NULL;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS status_update_trigger ON status;
    CREATE TRIGGER status_update_trigger
    AFTER INSERT OR UPDATE OR DELETE ON status
    FOR EACH ROW EXECUTE FUNCTION notify_status_update();
  `);
}

if (require.main === module) {
  up()
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}
