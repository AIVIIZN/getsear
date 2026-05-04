import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  // Skip dev-only specs that target localhost:3000 — they live in e2e/dev-only/
  // and run via playwright.dev.config.ts. Including them in the prod run would
  // 100% fail (no dev server, baseURL mismatch).
  testIgnore: ['**/dev-only/**'],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 1,
  workers: 3,
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 30000,
  use: {
    baseURL: 'https://getsear.com',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium', viewport: { width: 1366, height: 1024 } },
    },
  ],
})
