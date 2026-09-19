import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { isSandbox } from '@/lib/sandbox/enabled';
import { Toaster } from '@/components/ui/sonner';
import './sandbox.css';

// No session is required here; middleware lets /sandbox through outside production.
export default function SandboxLayout({ children }: { children: ReactNode }) {
  if (!isSandbox()) notFound();
  return (
    <main id="dashboard-main" className="sandbox-page">
      {children}
      <Toaster />
    </main>
  );
}
