import { expect, test } from '@playwright/test';

test.use({ baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000' });

test('switches tabs without replacing the shared navigation', async ({ page }) => {
  await page.goto('/today');
  const navigation = page.getByRole('navigation', { name: 'App navigation' });
  await expect(navigation).toBeVisible();
  const originalNavigation = await navigation.elementHandle();

  for (let visit = 0; visit < 2; visit++) {
    for (const [label, path, heading] of [
      ['Contact', '/contact', 'Contact'],
      ['Profile', '/profile', 'Profile'],
      ['Week', '/today', 'This week'],
    ]) {
      const link = navigation.getByRole('link', { name: label, exact: true });
      if (visit === 0) {
        await link.click();
      } else {
        await link.focus();
        await link.press('Enter');
      }
      await expect(page).toHaveURL(new RegExp(`${path}$`));
      await expect(
        page.getByRole('heading', { level: 1, name: heading, exact: true })
      ).toBeVisible();
      await expect(link).toHaveAttribute('aria-current', 'page');
      expect(await originalNavigation!.evaluate((element) => element.isConnected)).toBe(true);
      await expect(navigation).toHaveCount(1);
    }
  }

  await page.goBack();
  await expect(page.getByRole('heading', { level: 1, name: 'Profile', exact: true })).toBeVisible();
  expect(await originalNavigation!.evaluate((element) => element.isConnected)).toBe(true);
  await page.goForward();
  await expect(
    page.getByRole('heading', { level: 1, name: 'This week', exact: true })
  ).toBeVisible();
});

test.describe('signed-out navigation', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('requires sign-in for every tab', async ({ page }) => {
    for (const path of ['/today', '/contact', '/profile']) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login$/);
      await expect(page.getByRole('navigation', { name: 'App navigation' })).toHaveCount(0);
    }
  });
});

test('reuses Contact and Profile for one minute while keeping Week fresh', async ({ page }) => {
  test.skip(
    process.env.PLAYWRIGHT_PRODUCTION !== '1',
    'Automatic prefetching requires a production server (next start).'
  );
  const now = Date.now();
  await page.clock.setFixedTime(now);
  await page.goto('/today');
  const navigation = page.getByRole('navigation', { name: 'App navigation' });
  for (const label of ['Contact', 'Profile']) {
    await navigation.getByRole('link', { name: label, exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: label, exact: true })).toBeVisible();
  }

  const directoryRequests: string[] = [];
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname;
    if (request.headers().rsc === '1' && ['/contact', '/profile'].includes(path)) {
      directoryRequests.push(path);
    }
  });
  for (let visit = 0; visit < 3; visit++) {
    for (const label of ['Contact', 'Profile']) {
      await navigation.getByRole('link', { name: label, exact: true }).click();
      await expect(page.getByRole('heading', { level: 1, name: label, exact: true })).toBeVisible();
    }
  }
  expect(directoryRequests).toEqual([]);

  const freshWeek = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === '/today' &&
      request.headers().rsc === '1' &&
      !request.headers()['next-router-prefetch']
  );
  await navigation.getByRole('link', { name: 'Week', exact: true }).click();
  await freshWeek;
  await expect(
    page.getByRole('heading', { level: 1, name: 'This week', exact: true })
  ).toBeVisible();

  await page.clock.setFixedTime(now + 61_000);
  const refreshedContact = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/contact' && response.request().headers().rsc === '1'
  );
  await navigation.getByRole('link', { name: 'Contact', exact: true }).click();
  await refreshedContact;
  await expect(page.getByRole('heading', { level: 1, name: 'Contact', exact: true })).toBeVisible();
  expect(directoryRequests).toContain('/contact');
});
