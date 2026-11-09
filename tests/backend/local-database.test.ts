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
  { table_name: 'users', column_name: 'can_review_messages' },
  { table_name: 'status', column_name: 'id' },
  { table_name: 'slack_messages', column_name: 'message_key' },
  { table_name: 'slack_messages', column_name: 'review_text' },
  { table_name: 'slack_messages', column_name: 'converted_to_status' },
  { table_name: 'slack_messages', column_name: 'processed_at' },
  { table_name: 'slack_ai_usage', column_name: 'cost_usd' },
  { table_name: 'slack_message_feedback', column_name: 'preferred_status' },
  { table_name: 'slack_message_feedback', column_name: 'revision' },
  { table_name: 'slack_message_feedback', column_name: 'note' },
  { table_name: 'employee_stats_access', column_name: 'user_id' },
  { table_name: 'employee_stats_access', column_name: 'granted_by_user_id' },
  { table_name: 'employee_stats_access', column_name: 'granted_at' },
];

describe('local database bootstrap', () => {
  it.each(['PGHOST', 'PGPORT', 'PGUSER', 'PGPASSWORD', 'PGDATABASE'])(
    'rejects blank %s settings',
    (setting) => {
      expect(() => validateDatabaseEnv({ ...env, [setting]: '  ' })).toThrow(setting);
    }
  );

  it.each(['not-a-port', '0', '65536', '5432.5'])('rejects invalid port %s', (port) => {
    expect(() => validateDatabaseEnv({ ...env, PGPORT: port })).toThrow('PGPORT');
  });

  it.each(['1', '65535'])('accepts valid port boundary %s', (port) => {
    expect(validateDatabaseEnv({ ...env, PGPORT: port })).toEqual({ ...env, PGPORT: port });
  });

  it('refuses a remote database before checking or starting Docker', async () => {
    const runCommand = vi.fn();
    const connect = vi.fn();
    const checkDockerAccess = vi.fn();
    await expect(
      bootstrapDatabase({
        env: { ...env, PGHOST: 'remote-db' },
        runCommand,
        connect,
        checkDockerAccess,
      })
    ).rejects.toThrow('PGHOST=127.0.0.1');
    expect(runCommand).not.toHaveBeenCalled();
    expect(connect).not.toHaveBeenCalled();
    expect(checkDockerAccess).not.toHaveBeenCalled();
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
    expect(runCommand).toHaveBeenCalledTimes(2);
    expect(connect).toHaveBeenCalledWith(env);
    expect(pool.end).toHaveBeenCalledOnce();
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
    expect(runCommand).toHaveBeenCalledOnce();
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
    expect(pool.query).not.toHaveBeenCalledWith('CREATE ROLE service_role NOLOGIN');
    expect(runCommand).toHaveBeenCalledTimes(2);
    expect(pool.end).toHaveBeenCalledOnce();
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
    expect(runCommand).toHaveBeenCalledTimes(3);
  });

  it('retries a starting server and synchronizes after it becomes available', async () => {
    const pool = {
      query: vi
        .fn()
        .mockResolvedValueOnce({ rows: [{ present: true }] })
        .mockResolvedValueOnce({ rows: currentSchema }),
      end: vi.fn(),
    };
    const connect = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error('not ready'), { code: 'ECONNREFUSED' }))
      .mockResolvedValueOnce(pool);
    const runCommand = vi.fn();

    await expect(
      bootstrapDatabase({
        env,
        connect,
        runCommand,
        checkDockerAccess: vi.fn(),
        retries: 2,
        retryDelayMs: 0,
      })
    ).resolves.toEqual({ startedDocker: true, synchronized: true });
    expect(connect).toHaveBeenCalledTimes(2);
    expect(runCommand).toHaveBeenCalledTimes(2);
    expect(pool.end).toHaveBeenCalledOnce();
  });

  it('stops after the retry budget without attempting a schema push', async () => {
    const connect = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error('not ready'), { code: 'ECONNREFUSED' }));
    const runCommand = vi.fn();

    await expect(
      bootstrapDatabase({
        env,
        connect,
        runCommand,
        checkDockerAccess: vi.fn(),
        retries: 2,
        retryDelayMs: 0,
      })
    ).rejects.toThrow('PostgreSQL did not become ready at 127.0.0.1:5432');
    expect(connect).toHaveBeenCalledTimes(2);
    expect(runCommand).toHaveBeenCalledOnce();
  });

  it('closes the connection and reports a failed schema push', async () => {
    const pool = { query: vi.fn().mockResolvedValue({ rows: [{ present: true }] }), end: vi.fn() };
    const runCommand = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('schema push failed'));

    await expect(
      bootstrapDatabase({
        env,
        connect: vi.fn().mockResolvedValue(pool),
        runCommand,
        checkDockerAccess: vi.fn(),
      })
    ).rejects.toThrow('schema push failed');
    expect(pool.end).toHaveBeenCalledOnce();
    expect(pool.query).toHaveBeenCalledOnce();
  });

  it('reports an incomplete schema even if the schema push exits successfully', async () => {
    const pool = {
      query: vi
        .fn()
        .mockResolvedValueOnce({ rows: [{ present: true }] })
        .mockResolvedValueOnce({
          rows: currentSchema.filter(
            ({ table_name, column_name }) =>
              !(table_name === 'slack_messages' && column_name === 'review_text')
          ),
        }),
      end: vi.fn(),
    };

    await expect(
      bootstrapDatabase({
        env,
        connect: vi.fn().mockResolvedValue(pool),
        runCommand: vi.fn(),
        checkDockerAccess: vi.fn(),
      })
    ).rejects.toThrow('column slack_messages.review_text');
    expect(pool.end).toHaveBeenCalledOnce();
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
