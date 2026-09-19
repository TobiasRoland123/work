import { notFound } from 'next/navigation';
import { getSandboxOverview } from '@/app/actions/sandboxActions';
import { isSandbox } from '@/lib/sandbox/enabled';
import { SAMPLE_MESSAGES, UNMAPPED_AUTHOR } from '@/lib/sandbox/profiles';
import { SandboxConsole } from './SandboxConsole';

export const dynamic = 'force-dynamic';

export default async function SandboxPage() {
  if (!isSandbox()) notFound();
  const overview = await getSandboxOverview();
  return (
    <SandboxConsole
      overview={overview}
      samples={SAMPLE_MESSAGES}
      unmappedAuthor={UNMAPPED_AUTHOR}
    />
  );
}
