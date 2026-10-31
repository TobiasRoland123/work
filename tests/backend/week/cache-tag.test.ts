import { beforeEach, expect, it, vi } from 'vitest';
const revalidateTag = vi.hoisted(() => vi.fn());
vi.mock('next/cache', () => ({ revalidateTag }));
import { invalidateWeekOverview } from '@/lib/services/weekOverviewCache';
beforeEach(() => vi.resetAllMocks());
it('invalidates the tag shared by every week/day variant', () => {
  invalidateWeekOverview();
  expect(revalidateTag).toHaveBeenCalledWith('week-overview');
});
it('allows standalone seed scripts without a Next cache context', () => {
  revalidateTag.mockImplementationOnce(() => {
    throw Object.assign(new Error('no request'), { __NEXT_ERROR_CODE: 'E263' });
  });
  expect(invalidateWeekOverview).not.toThrow();
});
it('propagates other invalidation failures', () => {
  revalidateTag.mockImplementationOnce(() => {
    throw new Error('cache failed');
  });
  expect(invalidateWeekOverview).toThrow('cache failed');
});
