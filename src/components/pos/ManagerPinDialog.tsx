'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { ShieldCheck, X, Delete } from 'lucide-react'

interface ManagerPinDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  onVerified: (managerId: string, managerName: string, pin?: string) => void
  /**
   * When true, the entered PIN string is passed as the third argument to
   * `onVerified` after successful verification. Used by callers (e.g. the
   * audit-log CSV export) that need to forward the PIN to a downstream
   * endpoint that re-validates it server-side.
   */
  returnPin?: boolean
}

/**
 * Full-screen numpad overlay for manager PIN verification.
 * Used for voids, comps, discounts >10%, price overrides, etc.
 * Calls /api/auth/verify-manager-pin and returns the manager's identity.
 */
export function ManagerPinDialog({
  open,
  onOpenChange,
  title,
  description,
  onVerified,
  returnPin = false,
}: ManagerPinDialogProps) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isVerifying, setIsVerifying] = useState(false)
  const [shake, setShake] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Reset on open/close
  useEffect(() => {
    if (open) {
      setPin('')
      setError(null)
      setIsVerifying(false)
      // Focus the hidden input for keyboard support
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  // Auto-submit on 4 digits
  useEffect(() => {
    if (pin.length === 4) {
      verifyPin(pin)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin])

  const verifyPin = useCallback(
    async (enteredPin: string) => {
      setIsVerifying(true)
      setError(null)

      try {
        const res = await fetch('/api/auth/verify-manager-pin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin: enteredPin }),
        })

        if (res.ok) {
          const json = await res.json()
          onVerified(
            json.data.user_id,
            json.data.display_name,
            returnPin ? enteredPin : undefined,
          )
          onOpenChange(false)
        } else {
          const json = await res.json().catch(() => ({ error: 'Invalid PIN' }))
          setError(json.error ?? 'Invalid PIN')
          setPin('')
          setShake(true)
          setTimeout(() => setShake(false), 500)
        }
      } catch {
        setError('Network error')
        setPin('')
      } finally {
        setIsVerifying(false)
      }
    },
    [onVerified, onOpenChange, returnPin]
  )

  const handleDigit = useCallback(
    (digit: string) => {
      if (pin.length >= 4 || isVerifying) return
      setPin((p) => p + digit)
      setError(null)
    },
    [pin.length, isVerifying]
  )

  const handleDelete = useCallback(() => {
    setPin((p) => p.slice(0, -1))
    setError(null)
  }, [])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        handleDigit(e.key)
      } else if (e.key === 'Backspace') {
        handleDelete()
      } else if (e.key === 'Escape') {
        onOpenChange(false)
      }
    },
    [handleDigit, handleDelete, onOpenChange]
  )

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onKeyDown={handleKeyDown}
    >
      <div
        className={cn(
          'relative w-full max-w-[340px] rounded-2xl bg-white p-6 shadow-xl transition-transform duration-150',
          shake && 'animate-shake'
        )}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-[var(--muted)] transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header */}
        <div className="mb-5 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--warning-bg)]">
            <ShieldCheck className="h-6 w-6 text-[var(--warning)]" />
          </div>
          <h3 className="text-lg font-bold text-foreground">{title}</h3>
          {description && (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          )}
        </div>

        {/* PIN dots */}
        <div className="mb-4 flex justify-center gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={cn(
                'h-4 w-4 rounded-full border-2 transition-all duration-150',
                i < pin.length
                  ? 'border-[var(--primary)] bg-[var(--primary)] scale-110'
                  : 'border-[var(--border-hover)] bg-transparent'
              )}
            />
          ))}
        </div>

        {/* Error */}
        {error && (
          <p className="mb-3 text-center text-sm font-medium text-[var(--error)]">
            {error}
          </p>
        )}

        {/* Loading */}
        {isVerifying && (
          <p className="mb-3 text-center text-sm text-muted-foreground">
            Verifying...
          </p>
        )}

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-2">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'].map(
            (key) => {
              if (key === '') return <div key="empty" />
              if (key === 'del') {
                return (
                  <button
                    key="del"
                    type="button"
                    onClick={handleDelete}
                    disabled={isVerifying}
                    className="btn-press flex h-14 items-center justify-center rounded-xl bg-[var(--muted)] text-muted-foreground transition-colors hover:bg-[var(--secondary)] active:bg-[var(--accent)] disabled:opacity-30"
                  >
                    <Delete className="h-5 w-5" />
                  </button>
                )
              }
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleDigit(key)}
                  disabled={isVerifying}
                  className="btn-press flex h-14 items-center justify-center rounded-xl bg-[var(--secondary)] text-lg font-semibold text-foreground transition-colors hover:bg-[var(--muted)] active:bg-[var(--accent)] disabled:opacity-30"
                >
                  {key}
                </button>
              )
            }
          )}
        </div>

        {/* Hidden input for keyboard events */}
        <input
          ref={inputRef}
          type="text"
          className="sr-only"
          tabIndex={-1}
          autoFocus
        />
      </div>
    </div>
  )
}
