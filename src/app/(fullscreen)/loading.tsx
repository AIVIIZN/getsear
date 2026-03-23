export default function FullscreenLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-primary">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-ember border-t-transparent" />
    </div>
  )
}
