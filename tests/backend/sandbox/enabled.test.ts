import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  assertSandbox,
  isSandbox,
  SANDBOX_CHANNEL_ID,
  SANDBOX_TEAM_ID,
} from '@/lib/sandbox/enabled';

afterEach(() => vi.unstubAllEnvs());

describe('Local Sandbox guard', () => {
  it('is inert in production builds', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(isSandbox()).toBe(false);
    expect(() => assertSandbox()).toThrow('disabled');
  });
  it.each(['development', 'test'])('is enabled when NODE_ENV is %s', (env) => {
    vi.stubEnv('NODE_ENV', env);
    expect(isSandbox()).toBe(true);
    expect(() => assertSandbox()).not.toThrow();
  });
  it('never uses the real workspace identifiers', () => {
    expect(SANDBOX_TEAM_ID).toBe('T_LOCAL');
    expect(SANDBOX_CHANNEL_ID).toBe('C_LOCAL');
  });
});
