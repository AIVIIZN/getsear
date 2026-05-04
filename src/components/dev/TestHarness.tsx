'use client'

import { useEffect } from 'react'

/**
 * V5.5.3 — dev-only test-harness exposure.
 *
 * Exposes the offline-queue + sync-processor + offline-store modules on
 * `window` so Playwright specs in `e2e/dev-only/` can drive them via
 * `page.evaluate` without rebuilding the production bundle.
 *
 * Active ONLY when `process.env.NODE_ENV === 'development'`. Next inlines
 * `process.env.NODE_ENV` at build time, so in a production build this
 * component renders a no-op AND the dynamic imports are dead-code-eliminated.
 *
 * The harness is mounted from `src/app/layout.tsx` and renders nothing.
 */
export function TestHarness() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return

    let cancelled = false
    void (async () => {
      const [syncQueue, syncProcessor, offlineStore] = await Promise.all([
        import('@/lib/offline/sync-queue'),
        import('@/lib/offline/sync-processor'),
        import('@/stores/offline-store'),
      ])
      if (cancelled) return
      const w = window as unknown as Record<string, unknown>
      w.syncQueue = syncQueue
      w.syncProcessor = syncProcessor
      w.useOfflineStore = offlineStore.useOfflineStore
    })()

    return () => {
      cancelled = true
    }
  }, [])

  return null
}
