import { page } from '@vitest/browser/context';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { useState } from 'react';
import { DatePickerButton } from '@/components/week/DatePickerButton';

it.each([
  ['previous', '2026-09-18'],
  ['next', '2026-11-18'],
])('opens on the displayed day and jumps to the %s month', async (direction, expectedDay) => {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const onNavigate = vi.fn();
  try {
    root.render(
      <DatePickerButton date="2026-10-14" scope="day" today="2026-08-03" onNavigate={onNavigate} />
    );

    await page.getByRole('button', { name: 'Choose date' }).click();
    const dialog = page.getByRole('dialog', { name: 'Choose date' });
    await expect
      .element(dialog.getByRole('gridcell', { name: '14', exact: true }))
      .toHaveAttribute('aria-selected', 'true');
    await dialog.getByRole('button', { name: `Go to ${direction} month` }).click();
    await dialog.getByRole('gridcell', { name: '18', exact: true }).click();

    expect(onNavigate).toHaveBeenCalledExactlyOnceWith(`/today?day=${expectedDay}`);
    await expect.element(dialog).not.toBeInTheDocument();
  } finally {
    root.unmount();
    container.remove();
  }
});

it('selects a work-week interval across a year boundary and marks it on reopening', async () => {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const onNavigate = vi.fn();

  function WeekView() {
    const [week, setWeek] = useState('2026-11-16');
    return (
      <DatePickerButton
        date={week}
        scope="week"
        today="2026-11-20"
        onNavigate={(href) => {
          onNavigate(href);
          setWeek(new URL(href, window.location.origin).searchParams.get('week')!);
        }}
      />
    );
  }

  try {
    root.render(<WeekView />);
    const picker = page.getByRole('button', { name: 'Choose week' });
    const dialog = page.getByRole('dialog', { name: 'Choose week' });
    await picker.click();
    await expect
      .element(dialog.getByRole('button', { name: '16–20 Nov' }))
      .toHaveAttribute('aria-current', 'true');
    await expect.element(dialog.getByRole('button', { name: '30 Nov–4 Dec' })).toBeVisible();
    await dialog.getByRole('button', { name: 'Go to next month' }).click();
    await expect.element(dialog.getByText('December 2026')).toBeVisible();
    await dialog.getByRole('button', { name: 'Go to next month' }).click();
    await expect.element(dialog.getByText('January 2027')).toBeVisible();

    await dialog.getByRole('button', { name: '28 Dec 2026–1 Jan 2027' }).click();
    expect(onNavigate).toHaveBeenCalledExactlyOnceWith('/today?week=2026-12-28');
    await expect.element(dialog).not.toBeInTheDocument();
    await picker.click();
    await expect.element(dialog.getByText('December 2026')).toBeVisible();
    await expect
      .element(dialog.getByRole('button', { name: '28 Dec 2026–1 Jan 2027' }))
      .toHaveAttribute('aria-current', 'true');
    await dialog.getByRole('button', { name: 'Go to previous month' }).click();
    await expect.element(dialog.getByText('November 2026')).toBeVisible();
  } finally {
    root.unmount();
    container.remove();
  }
});
