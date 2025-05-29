import { test, expect } from '@playwright/test';

test.describe('E2E: Homepage', () => {
  test('should load the homepage and display the correct title', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await expect(page).toHaveTitle(/WØRK/i);
  });
});
