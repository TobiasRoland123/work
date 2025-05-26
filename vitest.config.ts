import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { storybookTest } from '@storybook/experimental-addon-test/vitest-plugin';

const dirname =
  typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    exclude: [
      '.next',
      'node_modules',
      'dist',
      'coverage',
      'storybook-static',
      'scripts',
      'app', // Exclude Next.js app directory - this is where your pages and components live (This is due to the storyb
      'components', // Exclude shared components (This is due to storybook setup)
      'out', // Exclude Next.js build output
      '.cache', // Exclude any temp/caching folders if they exist
    ],
    coverage: {
      provider: 'v8',
      include: ['lib/**/*.{ts,tsx}', 'utils/**/*.{ts,tsx}'],
      exclude: [
        'components/ui/**',
        '**/*.stories.tsx',
        // Add more patterns here as needed
      ],
      reporter: ['text', 'json', 'html'],
    },
    workspace: [
      {
        extends: true,
        plugins: [storybookTest({ configDir: path.join(dirname, '.storybook') })],
        test: {
          name: 'storybook',
          browser: {
            enabled: true,
            headless: true,
            name: 'chromium',
            provider: 'playwright',
          },
          setupFiles: ['.storybook/vitest.setup.ts'],
          exclude: ['.next', 'dist', 'storybook-static', 'coverage', 'out', '**/*.stories.tsx'],
        },
      },
      {
        extends: true,
        resolve: {
          alias: {
            '@': path.resolve(dirname, '.'),
          },
        },
        test: {
          name: 'backend',
          environment: 'node',
          include: ['tests/backend/**/*.test.ts'],
          exclude: [
            '.next',
            'dist',
            'coverage',
            'storybook-static',
            'out',
            'node_modules',
            '**/*.stories.tsx',
          ],
        },
      },
    ],
  },
});
