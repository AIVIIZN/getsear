export default function AskLoading() {
  return (
    <div className="flex h-[calc(100vh-var(--topbar-height)-48px)] items-center justify-center">
      <div className="flex items-center gap-3">
        <div className="h-5 w-5 rounded-full animate-pulse-attention" style={{ backgroundColor: 'var(--primary)' }} />
        <p className="text-callout text-muted-foreground">Loading Sear Ask...</p>
      </div>
    </div>
  )
}
