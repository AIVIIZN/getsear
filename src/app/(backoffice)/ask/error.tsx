'use client'

import { AlertCircle } from 'lucide-react'

export default function AskError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex h-[calc(100vh-var(--topbar-height)-48px)] items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-center">
        <AlertCircle className="h-8 w-8 text-[var(--error)]" />
        <h2 className="text-headline">Something went wrong</h2>
        <p className="text-footnote text-muted-foreground max-w-md">
          {error.message || 'An unexpected error occurred while loading Sear Ask.'}
        </p>
        <button
          onClick={reset}
          className="btn-press mt-2 rounded-xl px-6 py-2.5 text-callout font-medium text-white"
          style={{ backgroundColor: 'var(--primary)' }}
        >
          Try Again
        </button>
      </div>
    </div>
  )
}
