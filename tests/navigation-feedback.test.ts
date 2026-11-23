import { expect, test } from '@playwright/test';

test.use({ baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000' });

test.describe('prompt navigation feedback across pages', () => {
  test.skip(
    process.env.PLAYWRIGHT_PRODUCTION !== '1',
    'Prefetch TTL and production RSC streaming require next start (PLAYWRIGHT_PRODUCTION=1).'
  );

  test('Roles -> Week responds immediately even after prefetch expiration and avoids double redirect when week-scope=week', async ({
    page,
  }) => {
    const now = Date.now();
    await page.clock.setFixedTime(now);

    await page.goto('/today');
    const nav = page.getByRole('navigation', { name: 'App navigation' });
    await expect(page.locator('.week-board[role="table"]')).toBeVisible();

    // Switch to Week scope so the week-scope=week cookie is set.
    await page.locator('.week-filters a', { hasText: 'Week' }).click();
    await expect(page).toHaveURL(/\/today\?week=/);
    await expect(page.getByRole('heading', { level: 1, name: 'This week', exact: true })).toBeVisible();
    await expect(page.locator('.week-board[role="table"]')).toBeVisible();

    const rolesLink = nav.getByRole('link', { name: 'Roles', exact: true });
    if ((await rolesLink.count()) > 0) {
      await rolesLink.click();
      await expect(page).toHaveURL(/\/admin\/roles$/);
      await expect(page.locator('.roles-panel')).toBeVisible();

      // Advance past the 60s static prefetch TTL so Next.js must refetch from the server,
      // then throttle RSC responses to verify immediate UI feedback before data arrives.
      await page.clock.setFixedTime(now + 61_000);
      await page.route('**/*', async (route) => {
        const req = route.request();
        if (req.headers().rsc === '1') {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
        await route.continue();
      });

      const weekRequests: string[] = [];
      page.on('request', (req) => {
        const url = new URL(req.url());
        if (
          req.headers().rsc === '1' &&
          !req.headers()['next-router-prefetch'] &&
          url.pathname === '/today'
        ) {
          weekRequests.push(url.pathname + url.search);
        }
      });

      const weekLink = nav.getByRole('link', { name: 'Week', exact: true });
      await expect(weekLink).toHaveAttribute('href', /\/today\?week=\d{4}-\d{2}-\d{2}/);

      const clickedAt = Date.now();
      await weekLink.click();

      // Immediate feedback must appear well before the 500ms server delay finishes.
      await expect(weekLink).toHaveAttribute('data-pending', 'true', { timeout: 150 });
      await expect(rolesLink).toHaveAttribute('data-nav-leaving', 'true', { timeout: 150 });
      const navDelayMs = Date.now() - clickedAt;
      expect(navDelayMs).toBeLessThan(150);

      await expect(page.getByText('Loading the week overview…')).toBeAttached({ timeout: 250 });
      const skeletonDelayMs = Date.now() - clickedAt;
      expect(skeletonDelayMs).toBeLessThan(300);

      // Attendance data arrives after the delayed RSC response in a single request (no /today -> ?week= redirect hop).
      await expect(page.locator('.week-board[role="table"]')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 5000 });
      await expect(weekLink).toHaveAttribute('aria-current', 'page');
      expect(weekRequests).toHaveLength(1);
      expect(weekRequests[0]).toMatch(/^\/today\?week=\d{4}-\d{2}-\d{2}/);
    }
  });

  test('general cross-page transitions show prompt feedback before slow server responses finish', async ({
    page,
  }) => {
    let fakeNow = Date.now();
    await page.clock.setFixedTime(fakeNow);

    await page.route('**/*', async (route) => {
      const req = route.request();
      if (req.headers().rsc === '1') {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      await route.continue();
    });

    await page.goto('/admin/roles');
    const nav = page.getByRole('navigation', { name: 'App navigation' });

    const steps: Array<{
      label: string;
      statusText: string;
      readySelector: string;
      urlPattern: RegExp;
    }> = [
      {
        label: 'Week',
        statusText: 'Loading the week overview…',
        readySelector: '.week-board[role="table"]',
        urlPattern: /\/today/,
      },
      {
        label: 'My stats',
        statusText: 'Loading your attendance trends…',
        readySelector: '.personal-stats-summary',
        urlPattern: /\/my-stats$/,
      },
      {
        label: 'Contact',
        statusText: 'Loading colleagues…',
        readySelector: '.contact-directory',
        urlPattern: /\/contact$/,
      },
      {
        label: 'Profile',
        statusText: 'Loading your profile…',
        readySelector: '.profile-info',
        urlPattern: /\/profile$/,
      },
    ];

    for (const step of steps) {
      fakeNow += 61_000;
      await page.clock.setFixedTime(fakeNow);
      const link = nav.getByRole('link', { name: step.label, exact: true });
      await link.click();
      await expect(link).toHaveAttribute('data-pending', 'true', { timeout: 150 });
      await expect(page.getByText(step.statusText)).toBeAttached({ timeout: 250 });
      await expect(page).toHaveURL(step.urlPattern);
      await expect(page.locator(step.readySelector)).toBeVisible({ timeout: 5000 });
      await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 5000 });
      await expect(link).toHaveAttribute('aria-current', 'page');
    }
  });

  test('cached Contact and Profile switches do not flash skeleton or progress UI', async ({
    page,
  }) => {
    await page.goto('/today', { waitUntil: 'networkidle' });
    await expect(page.locator('.week-board[role="table"]')).toBeVisible();
    const nav = page.getByRole('navigation', { name: 'App navigation' });

    await nav.getByRole('link', { name: 'Contact', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Contact', exact: true })).toBeVisible();
    await expect(page.locator('.contact-directory')).toBeVisible();
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);

    await nav.getByRole('link', { name: 'Profile', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Profile', exact: true })).toBeVisible();
    await expect(page.locator('.profile-info')).toBeVisible();
    await expect(page.locator('.profile-info__fields')).toBeVisible();
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);

    const rscRequests: string[] = [];
    page.on('request', (req) => {
      const path = new URL(req.url()).pathname;
      if (req.headers().rsc === '1' && ['/contact', '/profile'].includes(path)) {
        rscRequests.push(path);
      }
    });

    await page.evaluate(() => {
      let flashedLoadingUi = false;
      const check = () => {
        if (
          document.querySelector('.app-shell-progress') ||
          document.querySelector('[aria-busy="true"]')
        ) {
          flashedLoadingUi = true;
        }
      };
      const observer = new MutationObserver(check);
      observer.observe(document.body, { subtree: true, childList: true, attributes: true });
      (window as unknown as { __flashProbe?: () => boolean }).__flashProbe = () => {
        check();
        observer.disconnect();
        return flashedLoadingUi;
      };
    });

    await nav.getByRole('link', { name: 'Contact', exact: true }).click();
    await expect(page.locator('.contact-directory')).toBeVisible();
    await nav.getByRole('link', { name: 'Profile', exact: true }).click();
    await expect(page.locator('.profile-info')).toBeVisible();

    const flashed = await page.evaluate(() =>
      (window as unknown as { __flashProbe?: () => boolean }).__flashProbe?.() ?? false
    );
    expect(rscRequests).toEqual([]);
    expect(flashed).toBe(false);
  });
});
