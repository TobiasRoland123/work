import { describe, expect, it, vi } from 'vitest';

const { assertDockerSocketAccess, bootstrapDatabase, validateDatabaseEnv } = await import(
  '../../scripts/local-database.mjs'
);

const env = {
  PGHOST: '127.0.0.1',
  PGPORT: '5432',
  PGUSER: 'postgres',
  PGPASSWORD: 'secret',
  PGDATABASE: 'work_dev',
};

const currentSchema = [
  { table_name: 'users', column_name: 'slack_user_id' },
  { table_name: 'users', column_name: 'slack_team_id' },
  { table_name: 'users', column_name: 'slack_deactivated' },
  { table_name: 'status', column_name: 'id' },
  { table_name: 'slack_messages', column_name: 'message_key' },
];

describe('local database bootstrap', () => {
  it('rejects incomplete or invalid database settings', () => {
    expect(() => validateDatabaseEnv({ ...env, PGPASSWORD: '' })).toThrow('PGPASSWORD');
    expect(() => validateDatabaseEnv({ ...env, PGPORT: 'not-a-port' })).toThrow('PGPORT');
  });

  it('starts Compose and synchronizes a fresh database', async () => {
    const pool = {
      query: vi
        .fn()
        .mockResolvedValueOnce({ rows: [{ present: false }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: currentSchema }),
      end: vi.fn(),
    };
    const connect = vi.fn().mockResolvedValue(pool);
    const runCommand = vi.fn().mockResolvedValue(undefined);
    const checkDockerAccess = vi.fn().mockResolvedValue(undefined);

    await expect(
      bootstrapDatabase({
        env,
        connect,
        runCommand,
        checkDockerAccess,
        retries: 1,
        retryDelayMs: 0,
      })
    ).resolves.toEqual({ startedDocker: true, synchronized: true });

    expect(checkDockerAccess).toHaveBeenCalledOnce();
    expect(runCommand).toHaveBeenNthCalledWith(
      1,
      'docker',
      ['compose', '--env-file', '.env.local', 'up', '-d', '--wait', '--wait-timeout', '30'],
      expect.anything()
    );
    expect(runCommand).toHaveBeenNthCalledWith(
      2,
      'pnpm',
      ['exec', 'drizzle-kit', 'push'],
      expect.objectContaining({ env: expect.objectContaining(env) })
    );
    expect(pool.query).toHaveBeenCalledWith('CREATE ROLE service_role NOLOGIN');
  });

  it('reports invalid Docker database credentials without retrying', async () => {
    const authenticationError = Object.assign(new Error('password authentication failed'), {
      code: '28P01',
    });
    const runCommand = vi.fn().mockResolvedValue(undefined);
    const connect = vi.fn().mockRejectedValue(authenticationError);

    await expect(
      bootstrapDatabase({
        env,
        connect,
        runCommand,
        checkDockerAccess: vi.fn().mockResolvedValue(undefined),
      })
    ).rejects.toThrow('password authentication failed');
    expect(runCommand).toHaveBeenCalledWith(
      'docker',
      expect.arrayContaining(['compose', 'up', '--wait']),
      expect.anything()
    );
    expect(connect).toHaveBeenCalledOnce();
  });

  it('checks Compose and Drizzle even when the database is already current', async () => {
    const pool = {
      query: vi
        .fn()
        .mockResolvedValueOnce({ rows: [{ present: true }] })
        .mockResolvedValueOnce({ rows: currentSchema }),
      end: vi.fn(),
    };
    const runCommand = vi.fn().mockResolvedValue(undefined);
    const checkDockerAccess = vi.fn().mockResolvedValue(undefined);

    await expect(
      bootstrapDatabase({
        env,
        connect: vi.fn().mockResolvedValue(pool),
        runCommand,
        checkDockerAccess,
      })
    ).resolves.toEqual({ startedDocker: true, synchronized: true });
    expect(runCommand).toHaveBeenNthCalledWith(
      1,
      'docker',
      expect.arrayContaining(['compose', 'up', '--wait']),
      expect.anything()
    );
    expect(runCommand).toHaveBeenNthCalledWith(
      2,
      'pnpm',
      ['exec', 'drizzle-kit', 'push'],
      expect.anything()
    );
    expect(pool.end).toHaveBeenCalled();
  });

  it('resets only through the explicit reset option', async () => {
    const pool = {
      query: vi
        .fn()
        .mockResolvedValueOnce({ rows: [{ present: true }] })
        .mockResolvedValueOnce({ rows: currentSchema }),
      end: vi.fn(),
    };
    const runCommand = vi.fn().mockResolvedValue(undefined);
    const checkDockerAccess = vi.fn().mockResolvedValue(undefined);

    await bootstrapDatabase({
      env,
      connect: vi.fn().mockResolvedValue(pool),
      runCommand,
      checkDockerAccess,
      reset: true,
      retries: 1,
      retryDelayMs: 0,
    });

    expect(runCommand).toHaveBeenNthCalledWith(
      1,
      'docker',
      ['compose', '--env-file', '.env.local', 'down', '--volumes'],
      expect.anything()
    );
    expect(runCommand).toHaveBeenNthCalledWith(
      2,
      'docker',
      expect.arrayContaining(['compose', 'up', '--wait']),
      expect.anything()
    );
    expect(runCommand).toHaveBeenNthCalledWith(
      3,
      'pnpm',
      ['exec', 'drizzle-kit', 'push'],
      expect.anything()
    );
    expect(checkDockerAccess).toHaveBeenCalledOnce();
  });

  it('explains how to refresh stale Docker group membership', async () => {
    await expect(
      assertDockerSocketAccess({
        env: { NODE_ENV: 'test' },
        platform: 'linux',
        stat: vi.fn().mockResolvedValue({}),
        access: vi.fn().mockRejectedValue(Object.assign(new Error('denied'), { code: 'EACCES' })),
      })
    ).rejects.toThrow('newgrp docker');
  });
});
