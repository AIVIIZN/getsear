import { defineConfig } from '@playwright/test'
import { STORAGE_STATE_PATH } from './e2e/auth-state'

export default defineConfig({
  testDir: './e2e',
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
    // Logs in once; writes e2e/.auth/user.json for the chromium project to reuse.
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      testMatch: /.*\.spec\.ts/,
      // dev-only specs target localhost:3000 and run via playwright.dev.config.ts.
      testIgnore: '**/dev-only/**',
      dependencies: ['setup'],
      use: {
        browserName: 'chromium',
        viewport: { width: 1366, height: 1024 },
        storageState: STORAGE_STATE_PATH,
      },
    },
  ],
})
