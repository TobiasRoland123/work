import { test, expect } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config();

test.describe('E2E: Homepage (logged-out)', () => {
  // For every test in this describe block create a fresh context with no cookies
  test.use({ storageState: { cookies: [], origins: [] } });

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
    // Go directly to /today
    await page.goto('http://localhost:3000/today');

    const appTitle = page.locator('a[href="/"]:visible h1', { hasText: 'WØRK' });
    const navToday = page.locator('a[href="/today"]').first();
    const navContact = page.locator('a[href="/contact"]').first();
    const navProfile = page.locator('a[href="/profile"]').first();
    const switchButton = page.locator('button[role="switch"]');
    const todayText = page.locator('text=Out of office today');

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
    test('should navigate to /profile and back to /today', async ({ page }) => {
      // Go directly to /today
      await page.goto('http://localhost:3000/today');

      // Remove the NextJS Util button
      await page
        .locator('.nextjs-toast')
        .evaluateAll((buttons) => buttons.forEach((btn) => btn.remove()));

      const navProfile = page.locator('a[href="/profile"]:visible', { hasText: 'Profile' });
      await navProfile.click();

      const profileName = page.locator('h1', { hasText: 'Test User' });
      const profileNameField = page.locator('p', { hasText: 'Test User' });
      const profilePhoneField = page.locator('p', { hasText: '1234567890' });
      const profileEmailField = page.locator('p', { hasText: 'testuser@example.com' });

      await Promise.all([
        expect(page).toHaveURL(/\/profile/),
        expect(profileName).toBeVisible(),
        expect(profileNameField).toBeVisible(),
        expect(profilePhoneField).toBeVisible(),
        expect(profileEmailField).toBeVisible(),
      ]);

      // Navigate back to /today
      await page.goBack();
      await expect(page).toHaveURL(/\/today/);
    });
  });

  test.describe('E2E: (auth path) - Report Status', () => {
    test('Should report the test user as "Working from Home"', async ({ page }) => {
      // Go directly to /today
      await page.goto('http://localhost:3000/today');

      const statusButton = page.locator('button', { hasText: 'Report Status' }).first();

      await statusButton.click();

      const fromHomeOption = page.locator('button', { hasText: 'From Home' }).first();

      await fromHomeOption.click();

      const detailsField = page.locator('input[name="detailsString"]');

      await detailsField.fill('E2E test - Working from Home');

      const registerButton = page.locator('button', { hasText: 'Register' }).first();
      await registerButton.click();

      const switchButton = page.locator('button[role="switch"]');
      await switchButton.click();

      const todayText = page.locator('p', { hasText: 'Out of office today' });
      const testUserName = page.locator('h2', { hasText: 'Test User' });
      const phoneNumber = page.locator('a', { hasText: '1234567890' });
      const email = page.locator('a', { hasText: 'testuser@example.com' });
      const statusText = page.getByRole('paragraph').filter({ hasText: /^From home$/ });

      await Promise.all([
        expect(todayText).toBeVisible(),
        expect(testUserName).toBeVisible(),
        expect(phoneNumber).toBeVisible(),
        expect(email).toBeVisible(),
        expect(statusText).toBeVisible(),
        expect(page).toHaveURL(/\/today/),
      ]);
    });
    test('Should report the test user as "At Client"', async ({ page }) => {
      // Go directly to /today
      await page.goto('http://localhost:3000/today');

      const statusButton = page.locator('button', { hasText: 'Report Status' }).first();

      await statusButton.click();

      const atClient = page.locator('button', { hasText: 'At Client' }).first();

      await atClient.click();

      const detailsField = page.locator('input[name="detailsString"]');

      await detailsField.fill('E2E test - Working at Client');

      const registerButton = page.locator('button', { hasText: 'Register' }).first();
      await registerButton.click();

      const switchButton = page.locator('button[role="switch"]');
      await switchButton.click();

      const todayText = page.locator('p', { hasText: 'Out of office today' });
      const testUserName = page.locator('h2', { hasText: 'Test User' });
      const phoneNumber = page.locator('a', { hasText: '1234567890' });
      const email = page.locator('a', { hasText: 'testuser@example.com' });
      const statusText = page.getByRole('paragraph').filter({ hasText: /^At client$/ });

      await Promise.all([
        expect(todayText).toBeVisible(),
        expect(testUserName).toBeVisible(),
        expect(phoneNumber).toBeVisible(),
        expect(email).toBeVisible(),
        expect(statusText).toBeVisible(),
        expect(page).toHaveURL(/\/today/),
      ]);
    });
    test('Should report the test user as "Sick"', async ({ page }) => {
      // Go directly to /today
      await page.goto('http://localhost:3000/today');

      const statusButton = page.locator('button', { hasText: 'Report Status' }).first();

      await statusButton.click();

      const sickOption = page.locator('button', { hasText: 'Sick' }).first();

      await sickOption.click();

      const registerButton = page.locator('button', { hasText: 'Register' }).first();
      await registerButton.click();

      const switchButton = page.locator('button[role="switch"]');
      await switchButton.click();

      const todayText = page.locator('p', { hasText: 'Out of office today' });
      const testUserName = page.locator('h2', { hasText: 'Test User' });
      const phoneNumber = page.locator('a', { hasText: '1234567890' });
      const email = page.locator('a', { hasText: 'testuser@example.com' });
      const statusText = page.getByRole('paragraph').filter({ hasText: /^Sick$/ });

      await Promise.all([
        expect(todayText).toBeVisible(),
        expect(testUserName).toBeVisible(),
        expect(phoneNumber).toBeVisible(),
        expect(email).toBeVisible(),
        expect(statusText).toBeVisible(),
        expect(page).toHaveURL(/\/today/),
      ]);
    });

    test('(Other) Should report the test user as "In Late"', async ({ page }) => {
      // Go directly to /today
      await page.goto('http://localhost:3000/today');

      const statusButton = page.locator('button', { hasText: 'Report Status' }).first();

      await statusButton.click();

      const otherOption = page.locator('button', { hasText: 'Other' }).first();

      await otherOption.click();

      const inLateOption = page.locator('button', { hasText: 'In Late' }).first();

      await inLateOption.click();

      const timeField = page.locator('input[name="Action Time"]');
      // Calculate 1 hour later
      const now = new Date();
      now.setHours(now.getHours() + 1);
      const hour = String(now.getHours()).padStart(2, '0');
      const minute = String(now.getMinutes()).padStart(2, '0');
      const timeString = `${hour}:${minute}`;

      await timeField.fill(timeString);

      const detailsField = page.locator('input[name="detailsString"]');

      const detailsDescription = 'Car broke down on the way to work';

      await detailsField.fill(detailsDescription);

      const registerButton = page.locator('button', { hasText: 'Register' }).first();
      await registerButton.click();

      const switchButton = page.locator('button[role="switch"]');
      await switchButton.click();

      const todayText = page.locator('p', { hasText: 'Out of office today' });
      const testUserName = page.locator('h2', { hasText: 'Test User' });
      const phoneNumber = page.locator('a', { hasText: '1234567890' });
      const email = page.locator('a', { hasText: 'testuser@example.com' });
      const inLateDetails = page.locator('p', { hasText: detailsDescription });
      const statusText = page
        .getByRole('paragraph')
        .filter({ hasText: /^In late$/ })
        .first();

      await Promise.all([
        expect(todayText).toBeVisible(),
        expect(testUserName).toBeVisible(),
        expect(phoneNumber).toBeVisible(),
        expect(email).toBeVisible(),
        expect(statusText).toBeVisible(),
        expect(inLateDetails).toBeVisible(),
        expect(page).toHaveURL(/\/today/),
      ]);
    });
    test('(Other) Should report the test user as "Leaving Early"', async ({ page }) => {
      // Go directly to /today
      await page.goto('http://localhost:3000/today');

      const statusButton = page.locator('button', { hasText: 'Report Status' }).first();

      await statusButton.click();

      const otherOption = page.locator('button', { hasText: 'Other' }).first();

      await otherOption.click();

      const leavingEarlyOption = page.locator('button', { hasText: 'Leaving Early' }).first();

      await leavingEarlyOption.click();

      const timeField = page.locator('input[name="Action Time"]');
      // Calculate 1 hour later
      const now = new Date();
      now.setHours(now.getHours() + 1);
      const hour = String(now.getHours()).padStart(2, '0');
      const minute = String(now.getMinutes()).padStart(2, '0');
      const timeString = `${hour}:${minute}`;

      await timeField.fill(timeString);

      const detailsField = page.locator('input[name="detailsString"]');

      const detailsDescription = 'Have to pick up my kids from school';

      await detailsField.fill(detailsDescription);

      const registerButton = page.locator('button', { hasText: 'Register' }).first();
      await registerButton.click();

      const todayText = page.locator('p', { hasText: 'At the office today' });
      const testUserName = page.locator('h2', { hasText: 'Test User' });
      const phoneNumber = page.locator('a', { hasText: '1234567890' });
      const email = page.locator('a', { hasText: 'testuser@example.com' });
      const inLateDetails = page.locator('p', { hasText: detailsDescription });
      const statusText = page
        .getByRole('paragraph')
        .filter({ hasText: /^Leaving early$/ })
        .first();

      await Promise.all([
        expect(todayText).toBeVisible(),
        expect(testUserName).toBeVisible(),
        expect(phoneNumber).toBeVisible(),
        expect(email).toBeVisible(),
        expect(statusText).toBeVisible(),
        expect(inLateDetails).toBeVisible(),
        expect(page).toHaveURL(/\/today/),
      ]);
    });
    test('(Other) Should report the test user as "Vacation"', async ({ page }) => {
      // Go directly to /today
      await page.goto('http://localhost:3000/today');

      const statusButton = page.locator('button', { hasText: 'Report Status' }).first();

      await statusButton.click();

      const otherOption = page.locator('button', { hasText: 'Other' }).first();

      await otherOption.click();

      const vacationOption = page.locator('button', { hasText: 'Vacation' }).first();

      await vacationOption.click();

      const detailsField = page.locator('input[name="detailsString"]');

      const detailsDescription = 'Going to Disney Land';

      await detailsField.fill(detailsDescription);

      const registerButton = page.locator('button', { hasText: 'Register' }).first();
      await registerButton.click();

      const switchButton = page.locator('button[role="switch"]');
      await switchButton.click();

      const todayText = page.locator('p', { hasText: 'Out of office today' });
      const testUserName = page.locator('h2', { hasText: 'Test User' });
      const phoneNumber = page.locator('a', { hasText: '1234567890' });
      const email = page.locator('a', { hasText: 'testuser@example.com' });
      const inLateDetails = page.locator('p', { hasText: detailsDescription });
      const statusText = page
        .getByRole('paragraph')
        .filter({ hasText: /^Vacation$/ })
        .first();

      await Promise.all([
        expect(todayText).toBeVisible(),
        expect(testUserName).toBeVisible(),
        expect(phoneNumber).toBeVisible(),
        expect(email).toBeVisible(),
        expect(statusText).toBeVisible(),
        expect(inLateDetails).toBeVisible(),
        expect(page).toHaveURL(/\/today/),
      ]);
    });
    test('(Other) Should report the test user as "Child sick"', async ({ page }) => {
      // Go directly to /today
      await page.goto('http://localhost:3000/today');

      const statusButton = page.locator('button', { hasText: 'Report Status' }).first();

      await statusButton.click();

      const otherOption = page.locator('button', { hasText: 'Other' }).first();

      await otherOption.click();

      const childSickOption = page.locator('button', { hasText: 'Child Sick' }).first();

      await childSickOption.click();

      const detailsField = page.locator('input[name="detailsString"]');

      const detailsDescription = 'Going to Disney Land';

      await detailsField.fill(detailsDescription);

      const registerButton = page.locator('button', { hasText: 'Register' }).first();
      await registerButton.click();

      const switchButton = page.locator('button[role="switch"]');
      await switchButton.click();

      const todayText = page.locator('p', { hasText: 'Out of office today' });
      const testUserName = page.locator('h2', { hasText: 'Test User' });
      const phoneNumber = page.locator('a', { hasText: '1234567890' });
      const email = page.locator('a', { hasText: 'testuser@example.com' });
      const inLateDetails = page.locator('p', { hasText: detailsDescription });
      const statusText = page
        .getByRole('paragraph')
        .filter({ hasText: /^Child sick$/ })
        .first();

      await Promise.all([
        expect(todayText).toBeVisible(),
        expect(testUserName).toBeVisible(),
        expect(phoneNumber).toBeVisible(),
        expect(email).toBeVisible(),
        expect(statusText).toBeVisible(),
        expect(inLateDetails).toBeVisible(),
        expect(page).toHaveURL(/\/today/),
      ]);
    });
    test('(Other) Should report the test user as "On Leave"', async ({ page }) => {
      // Go directly to /today
      await page.goto('http://localhost:3000/today');

      const statusButton = page.locator('button', { hasText: 'Report Status' }).first();

      await statusButton.click();

      const otherOption = page.locator('button', { hasText: 'Other' }).first();

      await otherOption.click();

      const onLeaveOption = page.locator('button', { hasText: 'On Leave' }).first();

      await onLeaveOption.click();

      const detailsField = page.locator('input[name="detailsString"]');

      const detailsDescription = 'On leave for personal reasons';

      await detailsField.fill(detailsDescription);

      const registerButton = page.locator('button', { hasText: 'Register' }).first();
      await registerButton.click();

      const switchButton = page.locator('button[role="switch"]');
      await switchButton.click();

      const todayText = page.locator('p', { hasText: 'Out of office today' });
      const testUserName = page.locator('h2', { hasText: 'Test User' });
      const phoneNumber = page.locator('a', { hasText: '1234567890' });
      const email = page.locator('a', { hasText: 'testuser@example.com' });
      const inLateDetails = page.locator('p', { hasText: detailsDescription });
      const statusText = page
        .getByRole('paragraph')
        .filter({ hasText: /^On leave$/ })
        .first();

      await Promise.all([
        expect(todayText).toBeVisible(),
        expect(testUserName).toBeVisible(),
        expect(phoneNumber).toBeVisible(),
        expect(email).toBeVisible(),
        expect(statusText).toBeVisible(),
        expect(inLateDetails).toBeVisible(),
        expect(page).toHaveURL(/\/today/),
      ]);
    });
    test('User opens "Other" option, then press "Back" then closes sidebar', async ({ page }) => {
      // Go directly to /today
      await page.goto('http://localhost:3000/today');

      const statusButton = page.locator('button', { hasText: 'Report Status' }).first();

      await statusButton.click();

      const sidebar = page.locator('[data-slot="inset-sheet"]');

      const otherOption = page.locator('button', { hasText: 'Other' }).first();

      await otherOption.click();

      const backOption = page.locator('button', { hasText: 'Back' }).first();

      await backOption.click();

      const fromHomeOption = page.locator('button', { hasText: 'From Home' }).first();
      const atClientOption = page.locator('button', { hasText: 'At Client' }).first();
      const sickOption = page.locator('button', { hasText: 'Sick' }).first();

      await Promise.all([
        expect(sidebar).toBeVisible(),
        expect(fromHomeOption).toBeVisible(),
        expect(atClientOption).toBeVisible(),
        expect(sickOption).toBeVisible(),
        expect(otherOption).toBeVisible(),
      ]);

      // Close the sidebar
      const closeButton = page.locator('button[aria-label="Close sidebar"]');

      await closeButton.click();

      await Promise.all([expect(page).toHaveURL(/\/today/), expect(sidebar).toBeHidden()]);
    });
  });
});
