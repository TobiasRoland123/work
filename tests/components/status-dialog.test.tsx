import React, { useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { page } from '@vitest/browser/context';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { StatusDialog } from '@/components/layout/StatusDialog';
import { StatusForm } from '@/components/StatusForm/StatusForm';
import { copenhagenDate } from '@/lib/status/active';
import { workWeekDays, workWeekStart } from '@/lib/status/week';
import { planStatusAction, planColleagueStatusAction } from './status-actions.mock';

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  saved: vi.fn(),
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));

let root: Root;
let container: HTMLDivElement;
let styles: HTMLStyleElement;

beforeEach(() => {
  vi.clearAllMocks();
  planStatusAction.mockResolvedValue({ ok: true, count: 1 });
  planColleagueStatusAction.mockResolvedValue({ ok: true, count: 1 });
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  // Exercise Base UI's real delayed unmount without loading the app's Tailwind bundle.
  styles = document.createElement('style');
  styles.textContent = `
    [data-slot='drawer-viewport'] { position: fixed; inset: 0; z-index: 50; }
    .office-status-dialog { opacity: 1; transition: opacity 1s; }
    .office-status-dialog[data-ending-style] { opacity: 0; }
  `;
  document.head.append(styles);
});

afterEach(() => {
  root.unmount();
  container.remove();
  styles.remove();
});

function Harness({ colleague }: { colleague?: { userId: string; name: string } }) {
  const [open, setOpen] = useState(false);
  return (
    <StatusDialog
      userId="me"
      open={open}
      onOpenChange={setOpen}
      onSaved={mocks.saved}
      colleague={colleague}
      trigger={<button>Set status</button>}
    />
  );
}

async function chooseHome() {
  await page.getByRole('button', { name: 'Set status', exact: true }).click();
  await page.getByRole('button', { name: 'set-status-to-FROM_HOME' }).click();
  await page.getByRole('textbox').fill('Waiting for a delivery');
}

it.each([
  { width: 390, forColleague: false },
  { width: 1280, forColleague: false },
  { width: 390, forColleague: true },
  { width: 1280, forColleague: true },
])(
  'keeps the saved form during closing and opens a fresh form (width: $width, colleague: $forColleague)',
  async ({ width, forColleague }) => {
    await page.viewport(width, 900);
    root.render(
      <Harness colleague={forColleague ? { userId: 'anna', name: 'Anna' } : undefined} />
    );
    await chooseHome();
    await page.getByRole('button', { name: 'Register Status' }).click();

    await expect.poll(() => mocks.saved.mock.calls.length).toBe(1);
    expect(mocks.refresh).toHaveBeenCalledOnce();
    const action = forColleague ? planColleagueStatusAction : planStatusAction;
    expect(action).toHaveBeenCalledOnce();
    expect(action.mock.calls[0].at(-1)).toMatchObject({
      status: 'FROM_HOME',
      details: 'Waiting for a delivery',
      echo: forColleague ? undefined : true,
    });
    await expect
      .poll(
        () =>
          document
            .querySelector('.office-status-dialog[data-ending-style]')
            ?.querySelector('.status-form-summary')?.textContent
      )
      .toContain('From home');
    await expect
      .poll(() => document.querySelector('.office-status-dialog'), { timeout: 3000 })
      .toBeNull();

    await page.getByRole('button', { name: 'Set status', exact: true }).click();
    await expect
      .element(page.getByRole('button', { name: 'set-status-to-FROM_HOME' }))
      .toBeVisible();
    await page.getByRole('button', { name: 'set-status-to-FROM_HOME' }).click();
    await expect.element(page.getByRole('textbox')).toHaveValue('');
  }
);

it('keeps the entered status and details when saving fails so the person can retry', async () => {
  planStatusAction.mockResolvedValueOnce({ ok: false, error: 'Please try again.' });
  root.render(<Harness />);
  await chooseHome();
  await page.getByRole('button', { name: 'Register Status' }).click();
  await expect.poll(() => planStatusAction.mock.calls.length).toBe(1);
  await expect.element(page.getByRole('button', { name: 'Register Status' })).toBeEnabled();
  await expect.element(page.getByRole('textbox')).toHaveValue('Waiting for a delivery');
  expect(mocks.saved).not.toHaveBeenCalled();
  expect(mocks.refresh).not.toHaveBeenCalled();
  await page.getByRole('button', { name: 'Register Status' }).click();
  await expect.poll(() => mocks.saved.mock.calls.length).toBe(1);
  expect(planStatusAction).toHaveBeenCalledTimes(2);
});

it('renders step two safely when no status is selected', async () => {
  const days = workWeekDays(workWeekStart(copenhagenDate()));
  root.render(
    <StatusForm userId="me" currentStep={2} setCurrentStep={vi.fn()} initialDays={days} />
  );
  await expect.element(page.getByRole('button', { name: 'Register Status' })).toBeVisible();
  expect(document.querySelector('.status-form-summary')).toBeNull();
});
