import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  returning: vi.fn(),
  transaction: vi.fn(),
  invalidate: vi.fn(),
  send: vi.fn(),
}));
vi.mock('@/db', () => {
  const query = {
    values: () => query,
    set: () => query,
    where: () => query,
    returning: mocks.returning,
  };
  return {
    db: {
      insert: () => query,
      update: () => query,
      delete: () => query,
      transaction: mocks.transaction,
    },
  };
});
vi.mock('next/cache', () => ({ revalidateTag: mocks.invalidate }));
vi.mock('@/lib/supabaseClient', () => ({ supabase: { channel: () => ({ send: mocks.send }) } }));
import { statusService } from '@/lib/services/statusService';
beforeEach(() => {
  vi.clearAllMocks();
  mocks.returning.mockResolvedValue([{ id: 1 }]);
});

describe('manual status cache invalidation', () => {
  const writes = [
    () => statusService.createNewStatus({ userID: 'person', status: 'IN_OFFICE' }),
    () => statusService.updateStatusByUserUserId('person', { status: 'REMOTE' }),
    () => statusService.deleteStatusById(1),
    () => statusService.deleteStatusByUserUserId('person'),
  ];
  it.each(writes)('invalidates after a successful write and before broadcast', async (write) => {
    mocks.returning.mockImplementationOnce(async () => {
      expect(mocks.invalidate).not.toHaveBeenCalled();
      return [{ id: 1 }];
    });
    mocks.send.mockImplementationOnce(async () =>
      expect(mocks.invalidate).toHaveBeenCalledWith('week-overview')
    );
    await write();
    expect(mocks.invalidate).toHaveBeenCalledTimes(1);
  });
  it.each(writes)('does not invalidate failed writes', async (write) => {
    mocks.returning.mockRejectedValueOnce(new Error('write failed'));
    await expect(write()).rejects.toThrow('write failed');
    expect(mocks.invalidate).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it.each(writes)('does not invalidate when no rows changed', async (write) => {
    mocks.returning.mockResolvedValueOnce([]);
    await write();
    expect(mocks.invalidate).not.toHaveBeenCalled();
  });
  it.each([false, true])(
    'invalidates corrections only when changed=%s after commit',
    async (changed) => {
      mocks.transaction.mockResolvedValueOnce({ duplicate: !changed, changed });
      await statusService.correctImportedStatus('person', {
        statusId: 1,
        status: 'IN_OFFICE',
        day: '2026-10-30',
        scope: 'day',
      });
      expect(mocks.invalidate).toHaveBeenCalledTimes(changed ? 1 : 0);
    }
  );
});
