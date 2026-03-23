'use client'

import { AlertTriangle, WifiOff, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

// ---------------------------------------------------------------------------
// ErrorState — reusable error display with recovery action
// Used in error.tsx route files and inline error states.
// No raw error text is ever shown to the user.
// ---------------------------------------------------------------------------

interface ErrorStateProps {
  /** User-friendly error message */
  message?: string
  /** Description providing more context */
  description?: string
  /** Retry handler */
  onRetry?: () => void
  /** Retry button label */
  retryLabel?: string
  /** Whether this is a network/offline error */
  isOffline?: boolean
  /** Compact mode for inline usage */
  compact?: boolean
}

export function ErrorState({
  message = 'Something went wrong',
  description = 'An unexpected error occurred. Please try again.',
  onRetry,
  retryLabel = 'Try Again',
  isOffline = false,
  compact = false,
}: ErrorStateProps) {
  const Icon = isOffline ? WifiOff : AlertTriangle
  const displayMessage = isOffline ? 'Connection lost' : message
  const displayDescription = isOffline
    ? 'Check your internet connection and try again.'
    : description

  return (
    <div
      className={`flex flex-col items-center justify-center text-center animate-page-fade-in ${
        compact ? 'py-8 px-4' : 'py-16 px-6'
      }`}
      role="alert"
      aria-live="assertive"
    >
      <div
        className={`flex items-center justify-center rounded-2xl ${
          compact ? 'h-12 w-12 mb-3' : 'h-16 w-16 mb-4'
        }`}
        style={{ background: 'var(--error-bg)' }}
      >
        <Icon
          className={`${compact ? 'h-6 w-6' : 'h-8 w-8'}`}
          style={{ color: 'var(--error)' }}
          strokeWidth={1.5}
        />
      </div>
      <h3
        className={`font-semibold ${compact ? 'text-base mb-1' : 'text-lg mb-1'}`}
        style={{ color: 'var(--foreground)' }}
      >
        {displayMessage}
      </h3>
      <p
        className={`max-w-sm ${compact ? 'text-xs mb-4' : 'text-sm mb-6'}`}
        style={{ color: 'var(--muted-foreground)' }}
      >
        {displayDescription}
      </p>
      {onRetry && (
        <Button
          onClick={onRetry}
          variant="outline"
          size={compact ? 'sm' : 'default'}
          aria-label={retryLabel}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          {retryLabel}
        </Button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Inline Error — smaller error for form sections or card areas
// ---------------------------------------------------------------------------
export function InlineError({
  message,
  onRetry,
}: {
  message: string
  onRetry?: () => void
}) {
  return (
    <div
      className="flex items-center gap-3 rounded-xl p-4"
      style={{
        background: 'var(--error-bg)',
        border: '0.5px solid var(--error)',
      }}
      role="alert"
    >
      <AlertTriangle className="h-5 w-5 shrink-0" style={{ color: 'var(--error)' }} />
      <p className="text-sm flex-1" style={{ color: 'var(--foreground)' }}>
        {message}
      </p>
      {onRetry && (
        <Button
          onClick={onRetry}
          variant="ghost"
          size="sm"
          aria-label="Retry"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  )
}
