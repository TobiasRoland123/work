import type { PersonalStatsRange } from '@/lib/personal-stats/types';

export function personalStatsUrl(range: PersonalStatsRange, comparison: boolean) {
  const query = new URLSearchParams({ range: String(range) });
  if (!comparison) query.set('comparison', 'off');
  return `/my-stats?${query}`;
}
