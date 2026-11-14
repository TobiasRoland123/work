import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { page, userEvent } from '@vitest/browser/context';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { PersonalStatsDashboard } from '@/components/personal-stats/PersonalStatsDashboard';
import type {
  AttendanceTotals,
  PersonalStats,
  PersonalStatsPoint,
} from '@/lib/personal-stats/types';
import '@/app/themes.css';
import '@/components/layout/shell.css';

const navigation = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => navigation }));
vi.mock('@/components/layout/PageHeader', () => ({
  PageHeader: ({
    title,
    subtitle,
    actions,
  }: {
    title: string;
    subtitle: string;
    actions: React.ReactNode;
  }) => (
    <header className="office-header">
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <div className="office-header-actions">{actions}</div>
    </header>
  ),
}));
const totals = (overrides: Partial<AttendanceTotals> = {}): AttendanceTotals => ({
  office: 3,
  remote: 1,
  client: 0,
  away: 1,
  unknown: 0,
  assumed: 0,
  eligible: 5,
  recorded: 5,
  working: 4,
  officeShare: 0.75,
  coverage: 1,
  ...overrides,
});
const point = (
  key: string,
  personal: number | null,
  company: number | null
): PersonalStatsPoint => ({
  key,
  label: `${key} Oct`,
  title: `Week of ${key} October 2026`,
  startDate: '2026-10-01',
  endDate: '2026-10-07',
  totals: totals({ officeShare: personal }),
  companyShare: company,
  comparisonReason: company === null ? 'low-coverage' : null,
});
const fixture = (overrides: Partial<PersonalStats> = {}): PersonalStats => ({
  range: 30,
  comparison: true,
  startDate: '2026-10-01',
  endDate: '2026-10-30',
  workdays: 22,
  granularity: 'week',
  totals: totals({
    office: 12,
    remote: 5,
    client: 1,
    away: 2,
    unknown: 1,
    assumed: 1,
    eligible: 22,
    recorded: 20,
    working: 18,
    officeShare: 2 / 3,
    coverage: 20 / 22,
  }),
  series: [
    point('1', 0.5, 0.5),
    point('5', 0.75, 0.6),
    point('12', null, null),
    point('19', 0.75, 0.5),
    point('26', 0.5, 0.6),
  ],
  company: { officeShare: 0.55, comparisonReason: null },
  historyCompleteness: 'unverified',
  comparisonProvisional: true,
  ...overrides,
});

let root: Root;
let container: HTMLDivElement;
let styles: HTMLStyleElement;
beforeEach(() => {
  navigation.push.mockClear();
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  styles = document.createElement('style');
  styles.textContent = `* { box-sizing: border-box; } body { margin: 0; font-family: Arial, sans-serif; color: var(--office-ink); background: var(--office-canvas); } h1,h2,p { margin: 0; } a { color: inherit; text-decoration: none; } button,select { font: inherit; } .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }`;
  document.head.append(styles);
});
afterEach(() => {
  root.unmount();
  container.remove();
  styles.remove();
});

async function render(data = fixture()) {
  root.render(<PersonalStatsDashboard data={data} />);
  await expect.element(page.getByRole('heading', { name: 'Attendance trends' })).toBeVisible();
}

it('shows exact recorded totals, coverage and import uncertainty', async () => {
  await render();
  const total = Array.from(container.querySelectorAll('tfoot tr td')).map(
    (cell) => cell.textContent
  );
  expect(total).toEqual(['12', '18', '67%', '55%']);
  expect(container.querySelector('#personal-coverage')?.parentElement?.textContent).toContain(
    '91%'
  );
  expect(container.textContent).toContain('2 eligible weekdays have no recorded status.');
  expect(container.textContent).toContain('Slack history import completeness is unverified');
  expect(container.textContent).not.toContain('Team average');
});

it('keeps personal and company gaps disconnected in the chart', async () => {
  await render();
  for (const series of ['you', 'company']) {
    const path = container.querySelector(`[data-series="${series}"]`)?.getAttribute('d');
    expect(path?.match(/M/g)).toHaveLength(2);
    expect(path?.match(/L/g)).toHaveLength(2);
  }
});

it('keeps comparison state in toggle and period changes', async () => {
  await render(fixture({ comparison: false, range: 90 }));
  const toggle = container.querySelector('[role="switch"]');
  expect(toggle?.getAttribute('aria-checked')).toBe('false');
  await page.getByRole('switch', { name: 'Company average' }).click();
  expect(navigation.push).toHaveBeenCalledWith('/my-stats?range=90', { scroll: false });
  expect(container.querySelector('[data-series="company"]')).toBeNull();
  expect(container.querySelectorAll('thead th')).toHaveLength(4);
  await page.getByRole('combobox', { name: 'Reporting period' }).selectOptions('180');
  expect(navigation.push).toHaveBeenCalledWith('/my-stats?range=180&comparison=off', {
    scroll: false,
  });
});

it('switches comparison off with Space while retaining the range', async () => {
  await render(fixture({ range: 365 }));
  const toggle = container.querySelector<HTMLButtonElement>('[role="switch"]')!;
  toggle.focus();
  await userEvent.keyboard(' ');
  expect(navigation.push).toHaveBeenCalledWith('/my-stats?range=365&comparison=off', {
    scroll: false,
  });
});

it('explains hidden company values in a disclosure usable on touch screens', async () => {
  await render();
  const reason = container.querySelector('tbody details');
  expect(reason?.hasAttribute('open')).toBe(false);
  await userEvent.click(reason!.querySelector('summary')!);
  expect(reason?.hasAttribute('open')).toBe(true);
  expect(reason?.textContent).toContain('below 80%');
});

it('shows an honest empty state and N/A when no working days are recorded', async () => {
  const empty = totals({
    office: 0,
    remote: 0,
    client: 0,
    away: 0,
    unknown: 5,
    recorded: 0,
    working: 0,
    officeShare: null,
    coverage: 0,
  });
  await render(
    fixture({
      totals: empty,
      series: [{ ...point('1', null, null), totals: empty }],
      company: { officeShare: null, comparisonReason: 'low-coverage' },
    })
  );
  await expect
    .element(page.getByText('No recorded working days yet', { exact: true }))
    .toBeVisible();
  expect(container.querySelector('.personal-stat-number')?.textContent).toBe('N/A');
  expect(container.querySelector('svg')).toBeNull();
  expect(container.querySelector('tfoot')?.textContent).toContain('N/A');
});

it.each([320, 390, 1280])('fits the page and exact table at viewport width %s', async (width) => {
  await page.viewport(width, 1000);
  await render();
  expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width);
  const table = container.querySelector('table')!.getBoundingClientRect();
  expect(table.right).toBeLessThanOrEqual(width);
  await page.getByRole('main').screenshot({ path: `/tmp/personal-stats-${width}-full.png` });
  await page.getByRole('table').screenshot({ path: `/tmp/personal-stats-${width}-table.png` });
  await page
    .getByRole('complementary', { name: 'Coverage and history notice' })
    .screenshot({ path: `/tmp/personal-stats-${width}-history.png` });
  document.documentElement.classList.add('dark');
  await page.getByRole('main').screenshot({ path: `/tmp/personal-stats-${width}-dark.png` });
  document.documentElement.classList.remove('dark');
});
