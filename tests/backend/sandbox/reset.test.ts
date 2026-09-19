import { describe, expect, it } from 'vitest';
import { sandboxResetStatements } from '@/lib/sandbox/service';

// Built against the real query builder without a connection: asserts the SQL, not the data.
describe('sandbox reset', () => {
  it('deletes status rows only for profiles of the sandbox workspace', () => {
    const { sql, params } = sandboxResetStatements().status.toSQL();
    expect(sql).toMatch(/^delete from "status" where "status"\."user_id" in \(select/);
    expect(sql).toContain('"users"."slack_team_id" = $1');
    expect(params).toEqual(['T_LOCAL']);
  });
  it('deletes inbox rows only for the sandbox workspace', () => {
    const { sql, params } = sandboxResetStatements().slackMessages.toSQL();
    expect(sql).toBe('delete from "slack_messages" where "slack_messages"."team_id" = $1');
    expect(params).toEqual(['T_LOCAL']);
  });
});
