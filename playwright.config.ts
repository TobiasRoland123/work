import { defineConfig } from '@playwright/test';

export default defineConfig({
  webServer: {
    command: 'npm run dev',
    port: 3000,
    timeout: 120 * 1000, // 2 minutes
    reuseExistingServer: !process.env.CI,
  },
});
