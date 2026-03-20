import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Test Configuration
 *
 * Run tests:
 *   npx playwright test
 *
 * Run with UI:
 *   npx playwright test --ui
 *
 * Run specific file:
 *   npx playwright test tests/e2e/regression.test.ts
 *
 * Run in headed mode (see browser):
 *   npx playwright test --headed
 */
export default defineConfig({
  testDir: './tests',

  // Timeout per test
  timeout: 60 * 1000,

  // Expect timeout for assertions
  expect: {
    timeout: 10000,
  },

  // Run tests in parallel
  fullyParallel: false,

  // Number of retries
  retries: 0,

  // Number of workers
  workers: 1,

  // Reporter
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report' }],
  ],

  use: {
    // Base URL for tests
    baseURL: 'http://localhost:3001',

    // Collect trace on failure
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Video on failure
    video: 'retain-on-failure',
  },

  // Configure projects for major browsers
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Skip webkit for now - requires separate browser installation
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],

  // Run local dev server before tests
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3001',
    reuseExistingServer: true,
    timeout: 60 * 1000,
  },
});
