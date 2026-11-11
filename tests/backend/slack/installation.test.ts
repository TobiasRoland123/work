import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as install } from '@/app/api/slack/install/route';
import { GET as callback } from '@/app/api/slack/install/callback/route';
import {
  createInstallationState,
  installationCallbackPath,
  installationConfig,
  installationCookie,
  installationScopes,
  signInstallationValue,
  validInstallationState,
  validInstallationTicket,
} from '@/lib/slack/installation';

const secret = 'installation-test-secret';
const origin = 'https://work.example';
const teamId = 'TTEST';
const now = new Date('2026-09-07T07:30:00Z').getTime();

function request(path: string, options: ConstructorParameters<typeof NextRequest>[1] = {}) {
  return new NextRequest(`${origin}${path}`, options);
}

function ticket(expires = now + 60_000) {
  return `${expires}.${createHmac('sha256', secret).update(`ticket:${expires}`).digest('hex')}`;
}

function callbackRequest(
  state: string,
  cookie: string,
  query = `code=temporary-code&state=${state}`
) {
  return request(`/api/slack/install/callback?${query}`, {
    headers: { cookie: `${installationCookie}=${cookie}` },
  });
}

function validSlackResponse(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    team: { id: teamId },
    token_type: 'bot',
    access_token: 'xoxb-test-token',
    scope: installationScopes.join(','),
    ...overrides,
  };
}

beforeEach(() => {
  vi.spyOn(Date, 'now').mockReturnValue(now);
  vi.stubEnv('AUTH_URL', origin);
  vi.stubEnv('AUTH_SECRET', secret);
  vi.stubEnv('AUTH_SLACK_ID', 'client-id');
  vi.stubEnv('AUTH_SLACK_SECRET', 'client-secret');
  vi.stubEnv('SLACK_TEAM_ID', teamId);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('Slack installation setup route', () => {
  it.each([
    ['valid', ticket()],
    ['tampered', `${ticket()}x`],
    ['expired', ticket(now - 1)],
  ])('accepts only a %s setup ticket', async (kind, value) => {
    const response = await install(request(`/api/slack/install?ticket=${value}`));
    if (kind === 'valid') {
      expect(response.status).toBe(302);
      const location = new URL(response.headers.get('location')!);
      expect(location.origin + location.pathname).toBe('https://slack.com/oauth/v2/authorize');
      expect(location.searchParams.get('client_id')).toBe('client-id');
      expect(location.searchParams.get('scope')).toBe(installationScopes.join(','));
      expect(location.searchParams.get('team')).toBe(teamId);
      expect(location.searchParams.get('redirect_uri')).toBe(
        `${origin}${installationCallbackPath}`
      );
      expect(location.searchParams.get('state')).toMatch(/^[a-f0-9]{64}$/);
      const cookie = response.headers.get('set-cookie')!;
      expect(cookie).toContain(`${installationCookie}=`);
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('Secure');
      expect(cookie).toContain('SameSite=lax');
      expect(cookie).toContain('Path=/');
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(response.headers.get('referrer-policy')).toBe('no-referrer');
    } else {
      expect(response.status).toBe(403);
    }
  });
});

describe('Slack installation callback route', () => {
  it('rejects an untrusted callback before fetching Slack', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const response = await callback(callbackRequest('a'.repeat(64), 'forged-cookie'));
    expect(response.status).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    ['tampered', 'bad'],
    [
      'expired',
      `${now - 1}.${'a'.repeat(64)}.${signInstallationValue('state', `${now - 1}.${'a'.repeat(64)}`, secret)}`,
    ],
  ])('rejects a %s state before fetching Slack', async (_kind, cookie) => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const response = await callback(callbackRequest('a'.repeat(64), cookie));
    expect(response.status).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('exchanges a valid code with the exact callback and clears the cookie without returning the token', async () => {
    const { state, cookie } = createInstallationState(secret);
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(validSlackResponse()), { status: 200 }));
    vi.stubGlobal('fetch', fetch);

    const response = await callback(callbackRequest(state, cookie));
    expect(response.status).toBe(200);
    expect(await response.text()).not.toContain('xoxb-test-token');
    expect(fetch).toHaveBeenCalledOnce();
    const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://slack.com/api/oauth.v2.access');
    expect(init.method).toBe('POST');
    expect(new URLSearchParams(String(init.body))).toEqual(
      new URLSearchParams({
        client_id: 'client-id',
        client_secret: 'client-secret',
        code: 'temporary-code',
        redirect_uri: `${origin}${installationCallbackPath}`,
      })
    );
    expect(response.headers.get('set-cookie')).toContain(`${installationCookie}=;`);
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(init.cache).toBe('no-store');
  });

  it.each([
    ['wrong team', { team: { id: 'TOTHER' } }],
    ['missing scope', { scope: installationScopes.slice(0, -1).join(',') }],
    ['Slack failure', { ok: false }],
    ['user token', { token_type: 'user' }],
    ['invalid bot token', { access_token: 'xoxp-user-token' }],
    ['missing token', { access_token: undefined }],
    ['enterprise install', { is_enterprise_install: true }],
  ])('rejects %s and clears the cookie', async (_kind, body) => {
    const { state, cookie } = createInstallationState(secret);
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(validSlackResponse(body)), { status: 200 }));
    vi.stubGlobal('fetch', fetch);
    const response = await callback(callbackRequest(state, cookie));
    expect(response.status).toBe(502);
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
  });

  it('handles Slack HTTP failures and clears the cookie', async () => {
    const { state, cookie } = createInstallationState(secret);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 500 })));
    const response = await callback(callbackRequest(state, cookie));
    expect(response.status).toBe(502);
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
  });
});

describe('installation state and configuration', () => {
  it('creates and validates a state cookie, while rejecting tampering and expiry', () => {
    const { state, cookie } = createInstallationState(secret);
    expect(cookie).toMatch(/^[0-9]+\.[a-f0-9]{64}\.[a-f0-9]{64}$/);
    expect(installationConfig()).toMatchObject({ origin, teamId });
    expect(state).toMatch(/^[a-f0-9]{64}$/);
    expect(validInstallationState(state, cookie, secret)).toBe(true);
    expect(validInstallationState(state, `${cookie}x`, secret)).toBe(false);
    const expiredValue = `${now - 1}.${state}`;
    const expiredCookie = `${expiredValue}.${signInstallationValue('state', expiredValue, secret)}`;
    expect(validInstallationState(state, expiredCookie, secret)).toBe(false);
  });
});

describe('installation trust and time boundaries', () => {
  it.each([
    [-1, false],
    [0, false],
    [1, true],
    [15 * 60_000, true],
    [15 * 60_000 + 1, false],
  ])('accepts a ticket expiring in %i milliseconds only within its lifetime', (offset, valid) => {
    expect(validInstallationTicket(ticket(now + offset), secret)).toBe(valid);
  });

  it('binds a state cookie to its nonce, signing purpose and secret', () => {
    const { state, cookie } = createInstallationState(secret);
    expect(validInstallationState('b'.repeat(64), cookie, secret)).toBe(false);
    expect(validInstallationState(state, cookie, 'another-secret')).toBe(false);
    const value = cookie.slice(0, cookie.lastIndexOf('.'));
    expect(
      validInstallationState(
        state,
        `${value}.${signInstallationValue('ticket', value, secret)}`,
        secret
      )
    ).toBe(false);
    expect(validInstallationState(state, `${cookie}.extra`, secret)).toBe(false);
  });

  it.each([
    [-1, false],
    [0, false],
    [1, true],
    [600_000, true],
    [600_001, false],
  ] as const)('bounds signed state expiry at %i milliseconds', (offset, valid) => {
    const state = 'a'.repeat(64);
    const value = `${now + offset}.${state}`;
    const cookie = `${value}.${signInstallationValue('state', value, secret)}`;
    expect(validInstallationState(state, cookie, secret)).toBe(valid);
  });

  it.each(['error=access_denied', ''])(
    'clears a verified session without calling Slack for query %j',
    async (query) => {
      const { state, cookie } = createInstallationState(secret);
      const fetch = vi.fn();
      vi.stubGlobal('fetch', fetch);
      const response = await callback(callbackRequest(state, cookie, `${query}&state=${state}`));
      expect(response.status).toBe(400);
      expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
      expect(fetch).not.toHaveBeenCalled();
    }
  );

  it.each(['http://work.example', 'https://user:password@work.example'])(
    'rejects an unsafe installation origin %s',
    (url) => {
      vi.stubEnv('AUTH_URL', url);
      expect(() => installationConfig()).toThrow('HTTPS AUTH_URL');
    }
  );

  it.each(['AUTH_URL', 'AUTH_SECRET', 'AUTH_SLACK_ID', 'AUTH_SLACK_SECRET', 'SLACK_TEAM_ID'])(
    'fails closed without %s',
    async (name) => {
      vi.stubEnv(name, ' ');
      const response = await install(request(`/api/slack/install?ticket=${ticket()}`));
      expect(response.status).toBe(503);
      expect(response.headers.get('location')).toBeNull();
      expect(response.headers.get('set-cookie')).toBeNull();
    }
  );
});

it('signs the purpose and value with the installation secret', () => {
  expect(signInstallationValue('state', 'fixed-value', secret)).toBe(
    '7a96fd37dceeb31131ea81b2f17916286a0ba1d2730e1eae5fcffa253e46cb16'
  );
});
