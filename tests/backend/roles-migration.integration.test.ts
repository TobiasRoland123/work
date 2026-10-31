import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Client } from 'pg';
import { describe, expect, it } from 'vitest';

describe.runIf(process.env.SLACK_TEST_DATABASE === '1')('application role migration', () => {
  it('preserves stats access, bootstraps only the verified admin and defaults everyone else to employee', async () => {
    if (process.env.PGHOST !== '127.0.0.1' || process.env.PGDATABASE !== 'work_slack_test')
      throw new Error('Dedicated local test database required');
    const config = {
      host: process.env.PGHOST,
      port: Number(process.env.PGPORT),
      user: process.env.PGUSER,
      password: process.env.PGPASSWORD,
    };
    const control = new Client({ ...config, database: 'postgres' });
    const database = `work_roles_${randomUUID().replaceAll('-', '')}`;
    const publicRole = `role_test_${randomUUID().replaceAll('-', '')}`;
    await control.connect();
    let client: Client | undefined;
    try {
      await control.query(`CREATE ROLE "${publicRole}" NOLOGIN`);
      await control.query(`CREATE DATABASE "${database}"`);
      client = new Client({ ...config, database });
      await client.connect();
      await client.query(`
        CREATE TYPE public.system_role AS ENUM ('ADMIN', 'USER', 'GUEST');
        CREATE TABLE users (user_id text PRIMARY KEY, slack_team_id text, slack_user_id text, can_review_messages boolean DEFAULT false, system_role public.system_role NOT NULL DEFAULT 'USER');
        CREATE TABLE employee_stats_access (user_id text PRIMARY KEY REFERENCES users(user_id));
        INSERT INTO users (user_id, slack_team_id, slack_user_id, system_role, can_review_messages) VALUES
          ('samuel', 'T02HKL21R', 'U05NP1NF3QB', 'USER', false),
          ('legacy-admin', 'T02HKL21R', 'U_OTHER', 'ADMIN', true),
          ('viewer', 'T02HKL21R', 'U_VIEWER', 'GUEST', false),
          ('employee', 'T02HKL21R', 'U_EMPLOYEE', 'USER', false),
          ('copycat', 'OTHER_TEAM', 'U05NP1NF3QB', 'ADMIN', false);
        INSERT INTO employee_stats_access VALUES ('viewer');
      `);
      await client.query('BEGIN');
      await client.query(await readFile('db/0048_application_roles.sql', 'utf8'));
      await client.query('COMMIT');
      const result = await client.query('SELECT user_id, system_role FROM users ORDER BY user_id');
      expect(Object.fromEntries(result.rows.map((row) => [row.user_id, row.system_role]))).toEqual({
        samuel: 'ADMIN',
        'legacy-admin': 'EMPLOYEE',
        viewer: 'MANAGER',
        employee: 'EMPLOYEE',
        copycat: 'EMPLOYEE',
      });
      await client.query("INSERT INTO users (user_id) VALUES ('new-employee')");
      expect(
        (await client.query("SELECT system_role FROM users WHERE user_id='new-employee'")).rows[0]
          .system_role
      ).toBe('EMPLOYEE');
      await expect(
        client.query("UPDATE users SET system_role='USER' WHERE user_id='new-employee'")
      ).rejects.toThrow();
      expect((await client.query('SELECT * FROM employee_stats_access')).rows).toHaveLength(1);
      // Even a public API role with explicit table privileges cannot bypass the admin action.
      await client.query(`GRANT USAGE ON SCHEMA public TO "${publicRole}"`);
      await client.query(`GRANT SELECT, INSERT, UPDATE ON users TO "${publicRole}"`);
      await client.query(`SET ROLE "${publicRole}"`);
      const promoted = await client.query(
        "UPDATE users SET system_role='ADMIN' WHERE user_id='new-employee'"
      );
      expect(promoted.rowCount).toBe(0);
      expect((await client.query('SELECT * FROM users')).rows).toEqual([]);
      await expect(
        client.query("INSERT INTO users (user_id,system_role) VALUES ('attacker','ADMIN')")
      ).rejects.toThrow('row-level security');
      await client.query('RESET ROLE');
      expect(
        (await client.query("SELECT system_role FROM users WHERE user_id='new-employee'")).rows[0]
          .system_role
      ).toBe('EMPLOYEE');
    } finally {
      await client?.end();
      await control.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
      await control.query(`DROP ROLE IF EXISTS "${publicRole}"`);
      await control.end();
    }
  });
});
