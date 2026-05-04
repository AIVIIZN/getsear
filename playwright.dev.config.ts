import { defineConfig } from '@playwright/test'

/**
 * V5.5.3 — dev-only Playwright config.
 *
 * The default `playwright.config.ts` targets https://getsear.com (production)
 * and runs the full e2e suite. A handful of tests need things that ONLY exist
 * in development builds:
 *   - The `window.{syncQueue, syncProcessor, useOfflineStore}` test-harness
 *     globals exposed by `src/components/dev/TestHarness.tsx` (gated on
 *     `NODE_ENV === 'development'`, dead-code-eliminated in prod).
 *   - Permission to send malformed Idempotency-Key probes that would 400 a
 *     production session and pollute the audit log.
 *
 * Those tests live in `e2e/dev-only/` and are excluded from the default suite
 * via the `testDir` boundary. To run them locally:
 *
 *   # Terminal 1:
 *   npm run dev
 *
 *   # Terminal 2 (after dev server is ready):
 *   npm run test:e2e:dev
 *
 * No CI integration yet — this config is for local validation while iterating
 * on offline-queue and idempotency-middleware code.
 */
export default defineConfig({
  testDir: './e2e/dev-only',
  fullyParallel: false, // dev server is single-process; serial avoids races
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  timeout: 30000,
  use: {
    baseURL: 'http://localhost:3000',
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
