import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SlackApiError,
  SlackRateLimitError,
  listSlackUsers,
  getSlackUser,
  getSlackPermalink,
  isActiveSlackMember,
  validateSlackBotTeam,
} from '@/lib/slack/client';
import {
  SlackIdentityError,
  validateIdentityMapping,
  validateSlackProfile,
} from '@/lib/slack/identity';
import { authConfig } from '@/auth.config';
import { isInitialMessageReviewer } from '@/lib/auth/message-review-defaults';

beforeEach(() => {
  vi.stubEnv('SLACK_TEAM_ID', 'T-trusted');
  vi.stubEnv('SLACK_BOT_TOKEN', 'xoxb-test');
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('Slack identity guards', () => {
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

describe('initial message reviewer', () => {
  it('matches only the approved Slack team and user IDs', () => {
    expect(isInitialMessageReviewer('T02HKL21R', 'U05NP1NF3QB')).toBe(true);
    expect(isInitialMessageReviewer('T02HKL21R', 'UOTHER')).toBe(false);
    expect(isInitialMessageReviewer('TOTHER', 'U05NP1NF3QB')).toBe(false);
  });
});

describe('Slack client', () => {
  it('validates bot workspace and rejects mismatch', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
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
    for (const [index, [url, init]] of fetch.mock.calls.entries()) {
      expect(url).toBe('https://slack.com/api/users.list');
      expect(init.method).toBe('POST');
      expect(new Headers(init.headers).get('authorization')).toBe('Bearer xoxb-test');
      expect(Object.fromEntries(new URLSearchParams(init.body))).toEqual(
        index === 0 ? { limit: '200' } : { limit: '200', cursor: 'next' }
      );
    }
  });
  it('exposes typed rate limits', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 429,
        headers: new Headers({ 'retry-after': '7' }),
        json: async () => ({ ok: false }),
      })
    );
    await expect(listSlackUsers()).rejects.toMatchObject({
      constructor: SlackRateLimitError,
      name: 'SlackRateLimitError',
      errorCode: 'ratelimited',
      status: 429,
      retryAfter: 7,
    });
  });
  it('rejects Slack error bodies even with HTTP 200', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({ ok: false, error: 'invalid_auth' }),
      })
    );
    await expect(listSlackUsers()).rejects.toMatchObject({
      constructor: SlackApiError,
      name: 'SlackApiError',
      errorCode: 'invalid_auth',
      status: 200,
    });
  });
});

it('invalidates stale non-Slack sessions in the edge config', async () => {
  const session = await authConfig.callbacks!.session!({
    session: { user: {} },
    token: { provider: 'MicrosoftEntraID', sub: 'old' },
  } as never);
  expect(session.userId).toBeUndefined();
});

describe('Slack client failure and identity boundaries', () => {
  it('accepts a bot only in the configured workspace', async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          team_id: 'T-trusted',
          user_id: 'B1',
        })
      )
    );
    vi.stubGlobal('fetch', fetch);
    await expect(validateSlackBotTeam()).resolves.toEqual({ teamId: 'T-trusted', userId: 'B1' });
    expect(fetch.mock.calls[0][0]).toBe('https://slack.com/api/auth.test');
  });

  it('stops repeated cursors rather than returning a truncated directory or looping', async () => {
    const fetch = vi.fn().mockImplementation(
      async () =>
        new Response(
          JSON.stringify({
            ok: true,
            members: [{ id: 'U1' }],
            response_metadata: { next_cursor: ' same ' },
          })
        )
    );
    vi.stubGlobal('fetch', fetch);
    await expect(listSlackUsers()).rejects.toMatchObject({ errorCode: 'pagination_loop' });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(new URLSearchParams(fetch.mock.calls[1][1].body).get('cursor')).toBe('same');
  });

  it.each([null, {}, 'members'])('rejects malformed directory members %j', async (members) => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, members })))
    );
    await expect(listSlackUsers()).rejects.toThrow('Invalid Slack directory response');
  });

  it.each([null, 'invalid'])(
    'defaults an unavailable Retry-After %j to sixty seconds',
    async (retryAfter) => {
      const headers = new Headers(retryAfter === null ? {} : { 'retry-after': retryAfter });
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 429, headers }));
      await expect(listSlackUsers()).rejects.toMatchObject({ retryAfter: 60 });
    }
  );

  it('fails before requesting Slack when the bot token is missing', async () => {
    vi.stubEnv('SLACK_BOT_TOKEN', ' ');
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    await expect(listSlackUsers()).rejects.toThrow('SLACK_BOT_TOKEN');
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    { deleted: true },
    { is_bot: true },
    { is_restricted: true },
    { is_ultra_restricted: true },
    { is_invited_user: true },
    { id: 'USLACKBOT' },
    { team_id: 'T-other' },
    { team_id: undefined },
  ])('excludes an ineligible directory member %j', (overrides) => {
    expect(isActiveSlackMember({ id: 'U1', team_id: 'T-trusted', ...overrides })).toBe(false);
  });

  it('keeps an ordinary active workspace member eligible', () => {
    expect(isActiveSlackMember({ id: 'U1', team_id: 'T-trusted' })).toBe(true);
  });

  it('fetches the requested user and refuses a different identity in the response', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, user: { id: 'U1' } })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, user: { id: 'U2' } })));
    vi.stubGlobal('fetch', fetch);
    await expect(getSlackUser('U1')).resolves.toEqual({ id: 'U1' });
    expect(new URLSearchParams(fetch.mock.calls[0][1].body).get('user')).toBe('U1');
    await expect(getSlackUser('U1')).rejects.toThrow('Invalid Slack user response');
  });

  it.each([
    'https://workspace.slack.com/archives/C1/p123',
    'https://slack.com.attacker.example/archives/C1/p123',
    'http://workspace.slack.com/archives/C1/p123',
    'https://user:secret@workspace.slack.com/archives/C1/p123',
    'https://workspace.slack.com:8443/archives/C1/p123',
  ])('returns only a trusted Slack permalink %s', async (permalink) => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, permalink })));
    vi.stubGlobal('fetch', fetch);
    if (permalink === 'https://workspace.slack.com/archives/C1/p123') {
      await expect(getSlackPermalink('C1', '123.000001')).resolves.toBe(permalink);
      expect(Object.fromEntries(new URLSearchParams(fetch.mock.calls[0][1].body))).toEqual({
        channel: 'C1',
        message_ts: '123.000001',
      });
    } else {
      await expect(getSlackPermalink('C1', '123.000001')).rejects.toThrow(
        'Invalid Slack permalink'
      );
    }
  });
});

describe('Slack identity mapping boundaries', () => {
  const identity = { email: 'a@example.com', slackUserId: 'U1', slackTeamId: 'T-trusted' };
  const user = { userId: 'local-1', ...identity };
  it('returns no mapping for a new identity and preserves the local ID for an unlinked email', () => {
    expect(validateIdentityMapping(identity, [], [])).toBeNull();
    expect(
      validateIdentityMapping(identity, [], [{ userId: 'legacy', email: 'A@example.com' }])
    ).toEqual({ userId: 'legacy', email: 'A@example.com' });
  });
  it.each([
    ['duplicate Slack identity', [user, { ...user, userId: 'local-2' }], [], 'Ambiguous'],
    ['changed Slack email', [{ ...user, email: 'other@example.com' }], [], 'different email'],
    ['different Slack user', [], [{ ...user, slackUserId: 'U2' }], 'different Slack account'],
    ['different Slack team', [], [{ ...user, slackTeamId: 'T-other' }], 'different Slack account'],
  ] as const)('rejects %s', (_, bySlack, byEmail, error) => {
    expect(() => validateIdentityMapping(identity, [...bySlack], [...byEmail])).toThrow(error);
  });
  it.each([null, '', ' ', undefined])('rejects a missing OIDC email %j', (email) => {
    expect(() =>
      validateSlackProfile({ email, email_verified: true, sub: 'U1', team_id: 'T-trusted' })
    ).toThrow('no email');
  });
  it('uses alternate Slack claims when the OIDC subject is absent', () => {
    expect(
      validateSlackProfile({
        email: ' A@Example.COM ',
        email_verified: true,
        team_id: 'T-trusted',
        'https://slack.com/user_id': 'U1',
        given_name: 'Anna',
        family_name: 'Andersen',
      })
    ).toEqual({ ...identity, firstName: 'Anna', lastName: 'Andersen', profilePicture: null });
  });
});
