'use client'

import { useCallback } from 'react'
import { cn } from '@/lib/utils'

interface ForHereToGoToggleProps {
  forHere: boolean
  onChange: (forHere: boolean) => void
}

/**
 * iOS-style segmented control toggle for For Here / To Go.
 * Updates tax calculation when toggled.
 */
export function ForHereToGoToggle({ forHere, onChange }: ForHereToGoToggleProps) {
  const handleForHere = useCallback(() => onChange(true), [onChange])
  const handleToGo = useCallback(() => onChange(false), [onChange])

  return (
    <div
      className="relative flex rounded-xl p-0.5"
      style={{
        backgroundColor: 'var(--secondary)',
        height: 36,
      }}
    >
      {/* Sliding selection indicator */}
      <div
        className="absolute top-0.5 bottom-0.5 rounded-[10px] bg-white transition-all duration-200 ease-out"
        style={{
          width: 'calc(50% - 2px)',
          left: forHere ? 2 : 'calc(50%)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)',
        }}
      />

      <button
        type="button"
        onClick={handleForHere}
        className={cn(
          'relative z-10 flex-1 rounded-[10px] text-xs font-semibold transition-colors duration-150',
          forHere
            ? 'text-[var(--foreground)]'
            : 'text-[var(--muted-foreground)]'
        )}
        style={{ minWidth: 64, minHeight: 32 }}
      >
        For Here
      </button>
      <button
        type="button"
        onClick={handleToGo}
        className={cn(
          'relative z-10 flex-1 rounded-[10px] text-xs font-semibold transition-colors duration-150',
          !forHere
            ? 'text-[var(--foreground)]'
            : 'text-[var(--muted-foreground)]'
        )}
        style={{ minWidth: 64, minHeight: 32 }}
      >
        To Go
      </button>
    </div>
  )
}
