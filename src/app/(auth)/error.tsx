'use client'

import { ErrorState } from '@/components/shared/ErrorState'

export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <ErrorState
      message="Unable to load"
      description="Something went wrong loading this page. Please try again."
      onRetry={reset}
      compact
    />
  )
}
