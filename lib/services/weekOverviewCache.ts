import { revalidateTag } from 'next/cache';

export const WEEK_OVERVIEW_TAG = 'week-overview';

/** Invalidate every day/week variant after a committed board change. */
export function invalidateWeekOverview() {
  try {
    revalidateTag(WEEK_OVERVIEW_TAG);
  } catch (error) {
    // Standalone seed scripts have no Next request/cache to invalidate. Their
    // changes become visible within the cache lifetime. Never hide runtime errors.
    if ((error as { __NEXT_ERROR_CODE?: string }).__NEXT_ERROR_CODE !== 'E263') throw error;
  }
}
