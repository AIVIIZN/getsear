'use client'

export default function FullscreenError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-primary p-6">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-warm-lg text-center">
        <h2 className="page-title text-xl mb-2">Something went wrong</h2>
        <p className="text-text-secondary text-sm mb-6">
          {error.message || 'An unexpected error occurred.'}
        </p>
        <button
          onClick={reset}
          className="btn-press inline-flex items-center justify-center rounded-xl bg-brand-ember px-6 py-3 text-sm font-semibold text-white hover:bg-brand-ember/90 transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
