'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

import { captureRouteGroupError } from '@/lib/observability/sentry'

export default function FullscreenError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    captureRouteGroupError(error, 'fullscreen')
  }, [error])

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-warm-lg">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-error-bg text-error">
          <AlertTriangle className="h-7 w-7" strokeWidth={1.8} />
        </div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-ember">
          Kitchen display recovery
        </p>
        <h2 className="page-title mb-3 text-xl">Display needs a reload</h2>
        <p className="mb-6 text-sm text-text-secondary">
          Orders remain queued. Reload this fullscreen station to resume the live board.
        </p>
        <button
          onClick={reset}
          className="btn-press inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-ember px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-ember/90"
        >
          <RefreshCw className="h-4 w-4" />
          Reload display
        </button>
      </div>
    </div>
  )
}
