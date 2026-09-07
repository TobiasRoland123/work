import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SlackApiError,
  SlackRateLimitError,
  listSlackUsers,
  validateSlackBotTeam,
} from '@/lib/slack/client';
import {
  SlackIdentityError,
  validateIdentityMapping,
  validateSlackProfile,
} from '@/lib/slack/identity';
import { authConfig } from '@/auth.config';

describe('Slack identity guards', () => {
  beforeEach(() => {
    process.env.SLACK_TEAM_ID = 'T-trusted';
    process.env.SLACK_BOT_TOKEN = 'xoxb-test';
  });
  it('accepts namespaced OIDC claims and preserves the OIDC subject', () =>
    expect(
      validateSlackProfile({
        email: 'A@Example.com',
        email_verified: true,
        sub: 'U-oidc',
        'https://slack.com/team_id': 'T-trusted',
      })
    ).toMatchObject({ email: 'a@example.com', slackUserId: 'U-oidc', slackTeamId: 'T-trusted' }));
  it.each([
    { email_verified: false },
    { email_verified: true, 'https://slack.com/team_id': 'T-other' },
    { email_verified: true, 'https://slack.com/team_id': 'T-trusted', sub: undefined },
  ])('rejects untrusted or incomplete profile %#', (profile) =>
    expect(() =>
      validateSlackProfile({
        email: 'a@example.com',
        sub: 'U1',
        'https://slack.com/team_id': 'T-trusted',
        ...profile,
      })
    ).toThrow(SlackIdentityError)
  );
  it('reuses a matching identity and rejects ambiguous or conflicting mappings', () => {
    const identity = { email: 'a@example.com', slackUserId: 'U1', slackTeamId: 'T-trusted' };
    const existing = {
      userId: 'local-1',
      email: 'a@example.com',
      slackUserId: 'U1',
      slackTeamId: 'T-trusted',
    };
    expect(validateIdentityMapping(identity, [existing], [existing])?.userId).toBe('local-1');
    expect(() =>
      validateIdentityMapping(identity, [], [existing, { ...existing, userId: 'local-2' }])
    ).toThrow('Ambiguous');
    expect(() =>
      validateIdentityMapping(identity, [existing], [{ ...existing, userId: 'local-2' }])
    ).toThrow('different users');
  });
});

describe('Slack client', () => {
  beforeEach(() => {
    process.env.SLACK_TEAM_ID = 'T-trusted';
    process.env.SLACK_BOT_TOKEN = 'xoxb-test';
    vi.restoreAllMocks();
  });
  it('validates bot workspace and rejects mismatch', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue({
          ok: true,
          json: async () => ({ ok: true, team_id: 'T-other', user_id: 'B1' }),
        })
    );
    await expect(validateSlackBotTeam()).rejects.toThrow('different workspace');
  });
  it('follows users.list pagination', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          members: [{ id: 'U1' }],
          response_metadata: { next_cursor: 'next' },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          members: [{ id: 'U2' }],
          response_metadata: { next_cursor: '' },
        }),
      });
    vi.stubGlobal('fetch', fetch);
    await expect(listSlackUsers()).resolves.toEqual([{ id: 'U1' }, { id: 'U2' }]);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it('exposes typed rate limits', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue({
          status: 429,
          headers: new Headers({ 'retry-after': '7' }),
          json: async () => ({ ok: false }),
        })
    );
    await expect(listSlackUsers()).rejects.toBeInstanceOf(SlackRateLimitError);
  });
  it('rejects Slack error bodies even with HTTP 200', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => ({ ok: false, error: 'invalid_auth' }),
        })
    );
    await expect(listSlackUsers()).rejects.toBeInstanceOf(SlackApiError);
  });
});

it('invalidates stale non-Slack sessions in the edge config', async () => {
  const session = await authConfig.callbacks!.session!({
    session: { user: {} },
    token: { provider: 'MicrosoftEntraID', sub: 'old' },
  } as never);
  expect(session.userId).toBeUndefined();
});
