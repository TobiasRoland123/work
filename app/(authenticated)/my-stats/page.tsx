import React from 'react';
import { PersonalStatsDashboard } from '@/components/personal-stats/PersonalStatsDashboard';
import { getPersonalStats } from '@/lib/personal-stats/service';

export const dynamic = 'force-dynamic';

const one = (value: string | string[] | undefined) =>
  typeof value === 'string' ? value : undefined;

export default async function MyStatsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string | string[]; comparison?: string | string[] }>;
}) {
  const params = await searchParams;
  const data = await getPersonalStats({ days: one(params.range), compare: one(params.comparison) });
  return <PersonalStatsDashboard data={data} />;
}
