import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { query, pushSchema, apply } = vi.hoisted(() => ({
  query: vi.fn(),
  pushSchema: vi.fn(),
  apply: vi.fn(),
}));

vi.mock('@/db', () => ({ db: {}, pool: { query, end: vi.fn() } }));
vi.mock('drizzle-kit/api', () => ({ pushSchema }));

import { prepareTestDatabase } from '../../scripts/prepare-test-database';

beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'test');
  query.mockReset().mockResolvedValue({ rows: [{ present: true }] });
  apply.mockReset().mockResolvedValue(undefined);
  pushSchema.mockReset().mockResolvedValue({ apply });
});

afterEach(() => vi.unstubAllEnvs());

describe('test database setup', () => {
  it('creates the missing policy role before applying the schema', async () => {
    query.mockResolvedValueOnce({ rows: [{ present: false }] });
    query.mockImplementationOnce(async () => {
      expect(pushSchema).not.toHaveBeenCalled();
      return { rows: [] };
    });

    await prepareTestDatabase();

    expect(query).toHaveBeenCalledWith('CREATE ROLE service_role NOLOGIN');
    expect(apply).toHaveBeenCalledOnce();
  });

  it('can prepare a database where the role already exists', async () => {
    await prepareTestDatabase();

    expect(query).not.toHaveBeenCalledWith('CREATE ROLE service_role NOLOGIN');
    expect(apply).toHaveBeenCalledOnce();
  });

  it('propagates connection and introspection errors', async () => {
    pushSchema.mockRejectedValueOnce(new Error('The server does not support SSL connections'));

    await expect(prepareTestDatabase()).rejects.toThrow(
      'The server does not support SSL connections'
    );
    expect(apply).not.toHaveBeenCalled();
  });

  it('propagates SQL failures instead of reporting a partially applied schema as ready', async () => {
    apply.mockRejectedValueOnce(new Error('permission denied for schema public'));

    await expect(prepareTestDatabase()).rejects.toThrow('permission denied for schema public');
  });

  it('stops when the required role cannot be created', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ present: false }] })
      .mockRejectedValueOnce(new Error('permission denied to create role'));

    await expect(prepareTestDatabase()).rejects.toThrow('permission denied to create role');
    expect(pushSchema).not.toHaveBeenCalled();
  });

  it.each(['production', 'development', undefined])(
    'refuses to modify a database with NODE_ENV=%s',
    async (nodeEnv) => {
      vi.stubEnv('NODE_ENV', nodeEnv);

      await expect(prepareTestDatabase()).rejects.toThrow('NODE_ENV=test');
      expect(query).not.toHaveBeenCalled();
      expect(pushSchema).not.toHaveBeenCalled();
    }
  );
});
