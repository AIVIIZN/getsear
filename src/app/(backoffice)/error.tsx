'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

import { captureRouteGroupError } from '@/lib/observability/sentry'

export default function BackofficeError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    captureRouteGroupError(error, 'backoffice')
  }, [error])

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-primary p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-warm-lg">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-error-bg text-error">
          <AlertTriangle className="h-7 w-7" strokeWidth={1.8} />
        </div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-ember">
          Back office recovery
        </p>
        <h2 className="page-title mb-3 text-xl">Management tools need a reload</h2>
        <p className="mb-6 text-sm text-text-secondary">
          Reports, staffing, and settings are still protected. Reload this workspace to keep working.
        </p>
        <button
          onClick={reset}
          className="btn-press inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-ember px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-ember/90"
        >
          <RefreshCw className="h-4 w-4" />
          Reload workspace
        </button>
      </div>
    </div>
  )
}
