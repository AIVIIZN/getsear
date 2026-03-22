'use client'

interface KdsAllDayProps {
  counts: Record<string, number>
  isOpen: boolean
  onClose: () => void
}

export function KdsAllDay({ counts, isOpen, onClose }: KdsAllDayProps) {
  if (!isOpen) return null

  const entries = Object.entries(counts).sort(([, a], [, b]) => b - a)

  return (
    <div className="fixed inset-x-0 bottom-0 z-40">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />

      {/* Panel */}
      <div className="relative rounded-t-xl bg-[var(--card)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <h3 className="text-lg font-bold text-[var(--foreground)]">All-Day Counts</h3>
          <button
            onClick={onClose}
            className="touch-target flex h-10 w-10 items-center justify-center rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--secondary)]"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="max-h-64 overflow-y-auto p-4">
          {entries.length === 0 ? (
            <p className="text-center text-sm text-[var(--muted-foreground)]">
              No pending items
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {entries.map(([name, count]) => (
                <div
                  key={name}
                  className="flex items-center justify-between rounded-lg bg-[var(--secondary)] px-3 py-2"
                >
                  <span className="mr-2 truncate text-sm font-medium text-[var(--foreground)]">
                    {name}
                  </span>
                  <span className="flex-shrink-0 text-xl font-black tabular-nums text-[var(--primary)]">
                    {count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
