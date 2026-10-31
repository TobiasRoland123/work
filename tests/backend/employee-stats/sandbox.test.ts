import { describe, expect, it, vi } from 'vitest';

vi.mock('@/db', () => ({ db: {} }));
vi.mock('next/navigation', () => ({ notFound: vi.fn() }));
vi.mock('@/lib/auth/require-user', () => ({ requireUserId: vi.fn() }));

import { SANDBOX_ADMIN_SLACK_USER_ID, adminSlackUserId } from '@/lib/auth/employee-stats';
import { SANDBOX_FIXTURES } from '@/lib/sandbox/profiles';
import { ADMIN_SLACK_IDENTITY } from '@/lib/auth/admin-identity';

describe('employee stats admin by workspace', () => {
  it('uses an active sandbox profile as the sandbox admin', () => {
    const admin = SANDBOX_FIXTURES.find(
      (fixture) => fixture.slackUserId === SANDBOX_ADMIN_SLACK_USER_ID
    );
    expect(admin).toMatchObject({ slackDeactivated: false });
  });

  it('knows the admin of the real workspace and of the sandbox only', () => {
    vi.stubEnv('NODE_ENV', 'development');
    expect(adminSlackUserId('T_LOCAL')).toBe(SANDBOX_ADMIN_SLACK_USER_ID);
    expect(adminSlackUserId(ADMIN_SLACK_IDENTITY.teamId)).toBe(ADMIN_SLACK_IDENTITY.slackUserId);
    expect(adminSlackUserId('T_ELSEWHERE')).toBeNull();
    expect(adminSlackUserId('')).toBeNull();
    vi.unstubAllEnvs();
  });

  it('never grants admin in the sandbox workspace of a production build', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(adminSlackUserId('T_LOCAL')).toBeNull();
    vi.unstubAllEnvs();
  });
});
