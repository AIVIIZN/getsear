'use client'

import { Check, X, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

type OverrideState = 'inherit' | 'grant' | 'deny'

interface PermissionToggleProps {
  state: OverrideState
  roleDefault: 'grant' | 'deny'
  onChange: (state: OverrideState) => void
  disabled?: boolean
}

export function PermissionToggle({
  state,
  roleDefault,
  onChange,
  disabled = false,
}: PermissionToggleProps) {
  const cycle = () => {
    if (disabled) return
    // Cycle: inherit -> grant -> deny -> inherit
    const next: OverrideState =
      state === 'inherit' ? 'grant' : state === 'grant' ? 'deny' : 'inherit'
    onChange(next)
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={cycle}
        disabled={disabled}
        className={cn(
          'flex items-center justify-center w-9 h-9 rounded-lg border-2 transition-all',
          'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
          disabled && 'opacity-50 cursor-not-allowed',
          state === 'inherit' && 'border-gray-300 bg-gray-50 text-gray-400 hover:border-gray-400',
          state === 'grant' && 'border-green-400 bg-green-50 text-green-600 hover:border-green-500',
          state === 'deny' && 'border-red-400 bg-red-50 text-red-600 hover:border-red-500'
        )}
        title={
          state === 'inherit'
            ? `Inherit from role (${roleDefault})`
            : state === 'grant'
              ? 'Granted (override)'
              : 'Denied (override)'
        }
      >
        {state === 'inherit' && <Minus className="h-4 w-4" />}
        {state === 'grant' && <Check className="h-4 w-4" strokeWidth={3} />}
        {state === 'deny' && <X className="h-4 w-4" strokeWidth={3} />}
      </button>
      <span className="text-xs text-muted-foreground">
        {state === 'inherit'
          ? `Role: ${roleDefault === 'grant' ? 'Allow' : 'Deny'}`
          : state === 'grant'
            ? 'Override: Allow'
            : 'Override: Deny'}
      </span>
    </div>
  )
}
