import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const guard = vi.hoisted(() => vi.fn());
const session = vi.hoisted(() => ({ auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn() }));
const service = vi.hoisted(() => ({
  createSandboxProfile: vi.fn(),
  deleteSandboxMessage: vi.fn(),
  editSandboxMessage: vi.fn(),
  listSandboxInbox: vi.fn(),
  listSandboxProfiles: vi.fn(),
  resetSandboxData: vi.fn(),
  runSandboxRetries: vi.fn(),
  sandboxReadiness: vi.fn(),
  sendSandboxMessage: vi.fn(),
}));
const seed = vi.hoisted(() => vi.fn());
vi.mock('@/lib/auth/sandbox', () => ({ requireSandboxAccess: guard }));
vi.mock('@/auth', () => session);
vi.mock('@/db', () => ({ db: { select: vi.fn() } }));
vi.mock('@/lib/sandbox/profiles', () => ({ seedSandboxProfiles: seed }));
vi.mock('@/lib/sandbox/service', () => ({ ...service, SandboxInputError: class extends Error {} }));
import * as actions from '@/app/actions/sandboxActions';

beforeEach(() => {
  vi.clearAllMocks();
  guard.mockReset();
});
afterEach(() => vi.unstubAllEnvs());

describe('sandbox server action authorization', () => {
  it.each([
    () => actions.getSandboxOverview(),
    () => actions.sendSandboxMessageAction({ slackUserId: 'U_TEST', text: 'wfh' }),
    () =>
      actions.editSandboxMessageAction({
        slackUserId: 'U_TEST',
        text: 'wfh',
        messageTs: '1789000000.000123',
      }),
    () =>
      actions.deleteSandboxMessageAction({ slackUserId: 'U_TEST', messageTs: '1789000000.000123' }),
    () => actions.runSandboxRetriesAction(),
    () => actions.createSandboxProfileAction({ firstName: 'Test', lastName: 'Author' }),
    () => actions.seedSandboxProfilesAction(),
    () => actions.resetSandboxDataAction(),
  ])('blocks a direct action call without live permission (%#)', async (invoke) => {
    guard.mockRejectedValue(new Error('NOT_FOUND'));
    await expect(invoke()).rejects.toThrow('NOT_FOUND');
    for (const operation of Object.values(service)) expect(operation).not.toHaveBeenCalled();
    expect(seed).not.toHaveBeenCalled();
    expect(session.auth).not.toHaveBeenCalled();
  });
  it('allows a granted production account to compose a message', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    guard.mockResolvedValue(undefined);
    service.sendSandboxMessage.mockResolvedValue({ messageKey: 'T_LOCAL:C_LOCAL:test' });
    await expect(
      actions.sendSandboxMessageAction({ slackUserId: 'U_TEST', text: 'wfh' })
    ).resolves.toMatchObject({ ok: true });
    expect(service.sendSandboxMessage).toHaveBeenCalledWith({ slackUserId: 'U_TEST', text: 'wfh' });
  });
  it('keeps profile sign-in and session switching disabled in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const form = new FormData();
    form.set('userId', 'sandbox-anna');
    await expect(actions.signInAsSandboxProfileAction(form)).rejects.toThrow('disabled');
    await expect(actions.signOutSandboxAction()).rejects.toThrow('disabled');
    expect(session.signIn).not.toHaveBeenCalled();
    expect(session.signOut).not.toHaveBeenCalled();
  });
});
