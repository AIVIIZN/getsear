import { CardSkeleton } from '@/components/shared/LoadingSkeleton'

export default function AuthLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: 'var(--background)' }}>
      <div className="w-full max-w-md space-y-4 p-8">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    </div>
  )
}
