import { test, expect } from '@playwright/test';
import dotenv from 'dotenv';
dotenv.config();

const bypassHeader = { [`x-e2e-test-bypass${process.env.BYPASS_SECRET}`]: 'true' };

test.describe('E2E: Homepage', () => {
  test('should load the homepage and display the correct title', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await expect(page).toHaveTitle(/WØRK/i);
  });
  test('should display the login form on the homepage', async ({ page }) => {
    await page.goto('http://localhost:3000');
    const loginForm = page.locator('form');

    const csrfTokenInput = page.locator('input[name="csrfToken"]');
    const callbackUrlInput = page.locator('input[name="callbackUrl"]');
    const loginButton = page.locator('button[type="submit"]');

    await Promise.all([
      expect(loginForm).toBeVisible(),
      expect(csrfTokenInput).toHaveCount(1),
      expect(callbackUrlInput).toHaveCount(1),
      expect(loginButton).toBeVisible(),
    ]);
  });
});

test.describe('E2E: Mocked Login', () => {
  test('should access /today as a logged-in user (mocked)', async ({ page }) => {
    // Set the bypass header before navigating
    await page.setExtraHTTPHeaders(bypassHeader);

    // Go directly to /today
    await page.goto('http://localhost:3000/today');

    const appTitle = page.locator('span', { hasText: 'WØRK' });
    const navToday = page.locator('a[href="/today"]').first();
    const navContact = page.locator('a[href="/contact"]').first();
    const navProfile = page.locator('a[href="/profile"]').first();
    const switchButton = page.locator('button[role="switch"]');
    const todayText = page.locator('text=At the office today');

    // Assert you are on the /today page and see expected content
    await expect(page).toHaveURL(/\/today/);
    await Promise.all([
      expect(appTitle).toBeVisible(),
      expect(navToday).toBeVisible(),
      expect(navContact).toBeVisible(),
      expect(navProfile).toBeVisible(),
      expect(todayText).toBeVisible(),
      expect(switchButton).toBeVisible(),
    ]);
  });

  test.describe('E2E: (auth path) - Contact', () => {
    test('should navigate to /contact and back to /today', async ({ page }) => {
      // Set the bypass header before navigating
      await page.setExtraHTTPHeaders(bypassHeader);

      // Go directly to /today
      await page.goto('http://localhost:3000/today');

      const navContact = page.locator('a[href="/contact"]').first();
      const contactText = page.locator('p.font-mono.text-base', { hasText: 'People' });

      // Navigate to /contact
      await navContact.click();
      await expect(page).toHaveURL(/\/contact/);
      await expect(contactText).toBeVisible();

      // Navigate back to /today
      await page.goBack();
      await expect(page).toHaveURL(/\/today/);
    });
  });

  test.describe('E2E: (auth path) - Profile', () => {
    test('should navigate to /profile and see user info', async ({ page }) => {
      // Set the bypass header before navigating
      await page.setExtraHTTPHeaders(bypassHeader);

      // Go directly to /today
      await page.goto('http://localhost:3000/today');

      const navProfile = page.locator('a[href="/profile"]').first();

      // Navigate to /profile
      await navProfile.click();

      const profileText = page.locator('span', { hasText: 'Your information' });
      const nameField = page.locator('p', { hasText: 'Test User' });
      const phoneField = page.locator('p', { hasText: '1234567890' });
      const emailField = page.locator('p', { hasText: 'testuser@example.com' });

      // TODO: NEED TO ADD SOMETHING THAT SECURES THE BYPASS SO PEOPLE CANT SPOOF IT

      await Promise.all([
        expect(page).toHaveURL(/\/profile/),
        expect(profileText).toBeVisible(),
        expect(nameField).toBeVisible(),
        expect(phoneField).toBeVisible(),
        expect(emailField).toBeVisible(),
      ]);
    });
  });
});
