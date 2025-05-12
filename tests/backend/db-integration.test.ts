import { afterAll, describe, expect, test } from 'vitest';
import { Pool } from 'pg';

const pool = new Pool({
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  host: process.env.POSTGRES_HOST,
  port: Number(process.env.POSTGRES_PORT),
  database: process.env.POSTGRES_DB,
});

describe('Database Integration Tests', () => {
  afterAll(async () => {
    await pool.end();
  });

  test('Should connect to the database locally', async () => {
    const client = await pool.connect();
    expect(client).toBeDefined();
    client.release();
  });

  test('Should be able to query a table', async () => {
    const result = await pool.query('SELECT * FROM users LIMIT 1');
    expect(result.rows.length).toBeGreaterThan(0);
  });

  test('Should handle transactions correctly', async () => {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      const result = await client.query('SELECT 1 as test');
      await client.query('COMMIT');

      expect(result.rows[0].test).toBe(1);
    } catch (e) {
      console.error('Error starting transaction', e);
      throw e;
    } finally {
      client.release();
    }
  });
});
