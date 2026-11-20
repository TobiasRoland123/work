import { page } from '@vitest/browser/context';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { DayPickerButton } from '@/components/week/DayPickerButton';

it.each([
  ['previous', '2026-09-18'],
  ['next', '2026-11-18'],
])('opens on the displayed day and jumps to the %s month', async (direction, expectedDay) => {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const onNavigate = vi.fn();
  try {
    root.render(<DayPickerButton day="2026-10-14" today="2026-08-03" onNavigate={onNavigate} />);

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
