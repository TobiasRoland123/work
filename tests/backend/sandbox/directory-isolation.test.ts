import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import { sql, type SQL } from 'drizzle-orm';
import { users } from '@/db/schema';

const { select } = vi.hoisted(() => ({ select: vi.fn() }));

vi.mock('@/db', () => ({ db: { select } }));
vi.mock('@/lib/supabaseClient', () => ({ supabase: null }));

import { userService } from '@/lib/services/userService';
import { statusService } from '@/lib/services/statusService';

function query(result: unknown[] = []) {
  const builder = {
    condition: sql``,
    from: () => builder,
    where: (condition: SQL) => {
      builder.condition = condition;
      return builder;
    },
    orderBy: () => builder,
    then: (resolve: (value: unknown[]) => unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
    getSQL: (): SQL => sql``,
  };
  return builder;
}

describe('directory list isolation', () => {
  beforeEach(() => {
    select.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('scopes user listing to the configured Slack team and fails closed without one', async () => {
    const dialect = new PgDialect();
    const userQuery = query();
    select.mockReturnValue(userQuery);

    vi.stubEnv('SLACK_TEAM_ID', 'T_WORKSPACE');
    await userService.getAllUsers(false);
    const configured = dialect.sqlToQuery(userQuery.condition);
    expect(configured.sql).toContain('slack_team_id');
    expect(configured.params).toContain('T_WORKSPACE');

    userQuery.condition = sql``;
    vi.stubEnv('SLACK_TEAM_ID', '');
    await userService.getAllUsers(false);
    const missing = dialect.sqlToQuery(userQuery.condition);
    expect(missing.sql).toContain('slack_team_id');
    expect(missing.params).toContain('');
  });

  it('scopes status listing through users in the configured Slack team', async () => {
    const dialect = new PgDialect();
    const inner = query();
    const outer = query();
    select.mockReturnValueOnce(outer).mockReturnValueOnce(inner);
    inner.getSQL = () => sql`(select ${users.userId} from ${users} where ${inner.condition})`;

    // Use captured real predicates directly; the team parameter must constrain the subquery.
    vi.stubEnv('SLACK_TEAM_ID', 'T_WORKSPACE');
    await statusService.getAllStatuses();
    const compiled = dialect.sqlToQuery(outer.condition);
    expect(compiled.sql).toContain('slack_team_id');
    expect(compiled.params).toContain('T_WORKSPACE');
  });
});
