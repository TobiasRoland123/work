import { readFileSync } from 'node:fs';
import { afterAll, describe, expect, it } from 'vitest';
import { pool } from '@/db';

describe.runIf(process.env.SLACK_TEST_DATABASE === '1')('message quality migration', () => {
  afterAll(() => pool.end());

  it('recovers only original text from the exact latest description and grants the approved identity', async () => {
    if (process.env.PGHOST !== '127.0.0.1' || process.env.PGDATABASE !== 'work_slack_test')
      throw new Error('Dedicated local test database required');
    const connection = await pool.connect();
    try {
      await connection.query('BEGIN');
      // Temporary tables shadow public tables so the real migration runs against an old schema.
      await connection.query(`
        CREATE TEMP TABLE slack_messages (message_key text, state text, outcome jsonb, revision text, text text) ON COMMIT DROP;
        CREATE TEMP TABLE users (slack_team_id text, slack_user_id text) ON COMMIT DROP;
        CREATE TEMP TABLE status (source_message_key text, status text, details text, announced_at timestamptz) ON COMMIT DROP;
        INSERT INTO slack_messages VALUES
          ('description', 'applied', '{"reason":"uncertain_status"}', '1790460477.521001', null),
          ('stale', 'applied', '{"reason":"uncertain_status"}', '1790460477.521001', null),
          ('converted', 'applied', '{"reason":"clear"}', '1790460477.521001', null),
          ('pending', 'pending', null, '1790460477.521001', repeat('a', 12001)),
          ('unknown', 'applied', null, '1790460477.521001', null),
          ('deleted', 'deleted', null, '1790460477.521001', null);
        INSERT INTO status VALUES
          ('description', null, 'not feeling well', to_timestamp(1790460477.521)),
          ('stale', null, 'earlier wording', to_timestamp(1790460400)),
          ('converted', 'SICK', 'short comment', to_timestamp(1790460477.521));
        INSERT INTO users VALUES ('T02HKL21R', 'U05NP1NF3QB'), ('T_OTHER', 'U05NP1NF3QB'), ('T02HKL21R', 'U_OTHER');
      `);
      await connection.query(readFileSync('db/0038_message_quality.sql', 'utf8'));
      const { rows } = await connection.query('SELECT * FROM slack_messages ORDER BY message_key');
      const byKey = new Map(rows.map((row) => [row.message_key, row]));
      expect(byKey.get('description')).toMatchObject({
        review_text: 'not feeling well',
        converted_to_status: false,
        processed_at: null,
      });
      expect(byKey.get('stale').review_text).toBeNull();
      expect(byKey.get('converted')).toMatchObject({
        review_text: null,
        converted_to_status: true,
      });
      expect(byKey.get('pending').review_text).toHaveLength(12000);
      expect(byKey.get('pending').converted_to_status).toBeNull();
      expect(byKey.get('unknown').converted_to_status).toBeNull();
      expect(byKey.get('deleted')).toMatchObject({ review_text: null, converted_to_status: null });
      const grants = await connection.query('SELECT * FROM users WHERE can_review_messages');
      expect(grants.rows).toEqual([
        { slack_team_id: 'T02HKL21R', slack_user_id: 'U05NP1NF3QB', can_review_messages: true },
      ]);
    } finally {
      await connection.query('ROLLBACK');
      connection.release();
    }
  });
});
