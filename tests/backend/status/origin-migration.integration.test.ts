import { readFileSync } from 'node:fs';
import { afterAll, describe, expect, it } from 'vitest';
import { pool } from '@/db';

describe.runIf(process.env.SLACK_TEST_DATABASE === '1')('status origin migration', () => {
  afterAll(() => pool.end());

  it('marks manual rows and rows from a completed model request, leaving unproven Slack rows unknown', async () => {
    if (process.env.PGHOST !== '127.0.0.1' || process.env.PGDATABASE !== 'work_slack_test')
      throw new Error('Dedicated local test database required');
    const connection = await pool.connect();
    try {
      await connection.query('BEGIN');
      // Temporary tables shadow public tables so the real migration runs against an old schema.
      await connection.query(`
        CREATE TEMP TABLE status (id int, source_message_key text, announced_at timestamptz) ON COMMIT DROP;
        CREATE TEMP TABLE slack_ai_usage (message_key text, revision text, state text) ON COMMIT DROP;
        INSERT INTO status VALUES
          (1, null, now()),
          (2, 'model', to_timestamp(1790460477.521)),
          (3, 'model', to_timestamp(1790460400)),
          (4, 'failed', to_timestamp(1790460477.521)),
          (5, 'shorthand', to_timestamp(1790460477.521));
        INSERT INTO slack_ai_usage VALUES
          ('model', '1790460477.521001', 'completed'),
          ('failed', '1790460477.521001', 'failed');
      `);
      // The enum already exists in the pushed test schema, so skip only its creation.
      const [, ...statements] = readFileSync('db/0041_status_origin.sql', 'utf8').split(
        '--> statement-breakpoint'
      );
      for (const statement of statements) await connection.query(statement);
      const { rows } = await connection.query('SELECT id, origin FROM status ORDER BY id');
      expect(rows).toEqual([
        { id: 1, origin: 'MANUAL' },
        { id: 2, origin: 'AI' },
        { id: 3, origin: null },
        { id: 4, origin: null },
        { id: 5, origin: null },
      ]);
    } finally {
      await connection.query('ROLLBACK');
      connection.release();
    }
  });
});
