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
} from '@/lib/slack/installation';

const secret = 'installation-test-secret';
const origin = 'https://work.example';
const teamId = 'TTEST';

function request(path: string, options: ConstructorParameters<typeof NextRequest>[1] = {}) {
  return new NextRequest(`${origin}${path}`, options);
}

function ticket(expires = Date.now() + 60_000) {
  return `${expires}.${signInstallationValue('ticket', String(expires), secret)}`;
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
  vi.stubEnv('AUTH_URL', origin);
  vi.stubEnv('AUTH_SECRET', secret);
  vi.stubEnv('AUTH_SLACK_ID', 'client-id');
  vi.stubEnv('AUTH_SLACK_SECRET', 'client-secret');
  vi.stubEnv('SLACK_TEAM_ID', teamId);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('Slack installation setup route', () => {
  it.each([
    ['valid', ticket()],
    ['tampered', `${ticket()}x`],
    ['expired', ticket(Date.now() - 1)],
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
      expect(response.headers.get('set-cookie')).toContain(`${installationCookie}=`);
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
      `${Date.now() - 1}.${'a'.repeat(64)}.${signInstallationValue('state', `${Date.now() - 1}.${'a'.repeat(64)}`, secret)}`,
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
  });

  it.each([
    ['wrong team', { team: { id: 'TOTHER' } }],
    ['missing scope', { scope: installationScopes.slice(0, -1).join(',') }],
    ['Slack failure', { ok: false }],
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
    const expiredValue = `${Date.now() - 1}.${state}`;
    const expiredCookie = `${expiredValue}.${signInstallationValue('state', expiredValue, secret)}`;
    expect(validInstallationState(state, expiredCookie, secret)).toBe(false);
  });
});
