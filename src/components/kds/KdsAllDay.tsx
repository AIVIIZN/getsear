'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

interface KdsAllDayProps {
  counts: Record<string, number>
  countsByCategory?: Record<string, Record<string, number>>
  isOpen: boolean
  onClose: () => void
}

export function KdsAllDay({ counts, countsByCategory, isOpen, onClose }: KdsAllDayProps) {
  const [groupByCategory, setGroupByCategory] = useState(!!countsByCategory)

  if (!isOpen) return null

  const flatEntries = Object.entries(counts).sort(([, a], [, b]) => b - a)
  const categoryEntries = countsByCategory
    ? Object.entries(countsByCategory).sort(([a], [b]) => a.localeCompare(b))
    : []

  return (
    <div className="fixed inset-x-0 bottom-0 z-40">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60" onClick={onClose} />

      {/* Panel */}
      <div className="relative rounded-t-xl bg-[var(--color-kds-surface)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--color-kds-border-strong)] px-4 py-3">
          <h3 className="text-lg font-bold text-white">All-Day Counts</h3>

          {/* Toggle: flat vs grouped */}
          {countsByCategory && Object.keys(countsByCategory).length > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setGroupByCategory(false)}
                className={cn(
                  'rounded-lg px-3 py-1 text-caption-1 font-semibold transition-colors',
                  !groupByCategory ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-kds-surface-active)] text-[var(--color-kds-text-muted)]'
                )}
              >
                All Items
              </button>
              <button
                onClick={() => setGroupByCategory(true)}
                className={cn(
                  'rounded-lg px-3 py-1 text-caption-1 font-semibold transition-colors',
                  groupByCategory ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-kds-surface-active)] text-[var(--color-kds-text-muted)]'
                )}
              >
                By Station
              </button>
            </div>
          )}

          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-[var(--color-kds-text-muted)] hover:bg-[var(--color-kds-surface-active)]"
            style={{ minWidth: 44, minHeight: 44 }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto p-4">
          {!groupByCategory ? (
            // Flat view
            <>
              {flatEntries.length === 0 ? (
                <p className="text-center text-sm text-[var(--color-kds-text-muted)]">
                  No pending items
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                  {flatEntries.map(([name, count]) => (
                    <div
                      key={name}
                      className="flex items-center justify-between rounded-lg bg-[var(--color-kds-surface-active)] px-3 py-2"
                    >
                      <span className="mr-2 truncate text-sm font-medium text-white">
                        {name}
                      </span>
                      <span className="flex-shrink-0 text-xl font-black tabular-nums text-[var(--color-primary)]">
                        {count}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            // Grouped by station/category view
            <>
              {categoryEntries.length === 0 ? (
                <p className="text-center text-sm text-[var(--color-kds-text-muted)]">
                  No pending items
                </p>
              ) : (
                <div className="space-y-4">
                  {categoryEntries.map(([category, items]) => {
                    const itemEntries = Object.entries(items).sort(([, a], [, b]) => b - a)
                    return (
                      <div key={category}>
                        <h4 className="mb-2 text-caption-1 font-bold uppercase tracking-wider text-[var(--color-kds-text-muted)]">
                          {category}
                        </h4>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                          {itemEntries.map(([name, count]) => (
                            <div
                              key={`${category}-${name}`}
                              className="flex items-center justify-between rounded-lg bg-[var(--color-kds-surface-active)] px-3 py-2"
                            >
                              <span className="mr-2 truncate text-sm font-medium text-white">
                                {name}
                              </span>
                              <span className="flex-shrink-0 text-xl font-black tabular-nums text-[var(--color-primary)]">
                                {count}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
