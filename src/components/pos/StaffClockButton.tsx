'use client'

import { useState, useCallback, useEffect } from 'react'
import { Clock, Coffee, LogIn, LogOut } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { ManagerPinDialog } from './ManagerPinDialog'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

type ClockStatus = 'clocked_out' | 'clocked_in' | 'on_break' | 'loading'

export function StaffClockButton() {
  const user = useAuthStore((s) => s.user)
  const [status, setStatus] = useState<ClockStatus>('loading')
  const [isProcessing, setIsProcessing] = useState(false)
  const [showMenu, setShowMenu] = useState(false)

  // Fetch current clock status on mount
  useEffect(() => {
    if (!user) return
    async function fetchStatus() {
      try {
        const res = await fetch(`/api/staff/${user!.id}/clock-status`)
        if (res.ok) {
          const json = await res.json()
          setStatus(json.data?.status ?? 'clocked_out')
        } else {
          setStatus('clocked_out')
        }
      } catch {
        setStatus('clocked_out')
      }
    }
    fetchStatus()
  }, [user])

  const handleClockIn = useCallback(async () => {
    if (!user) return
    setIsProcessing(true)
    try {
      const res = await fetch('/api/staff/clock-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id }),
      })
      if (res.ok) {
        setStatus('clocked_in')
        toast.success('Clocked in')
      } else {
        toast.error('Failed to clock in')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setIsProcessing(false)
      setShowMenu(false)
    }
  }, [user])

  const handleClockOut = useCallback(async () => {
    if (!user) return
    setIsProcessing(true)
    try {
      const res = await fetch('/api/staff/clock-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id }),
      })
      if (res.ok) {
        setStatus('clocked_out')
        toast.success('Clocked out')
      } else {
        toast.error('Failed to clock out')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setIsProcessing(false)
      setShowMenu(false)
    }
  }, [user])

  const handleBreakStart = useCallback(async () => {
    if (!user) return
    setIsProcessing(true)
    try {
      const res = await fetch('/api/staff/break-start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id }),
      })
      if (res.ok) {
        setStatus('on_break')
        toast.success('Break started')
      } else {
        toast.error('Failed to start break')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setIsProcessing(false)
      setShowMenu(false)
    }
  }, [user])

  const handleBreakEnd = useCallback(async () => {
    if (!user) return
    setIsProcessing(true)
    try {
      const res = await fetch('/api/staff/break-end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id }),
      })
      if (res.ok) {
        setStatus('clocked_in')
        toast.success('Break ended')
      } else {
        toast.error('Failed to end break')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setIsProcessing(false)
      setShowMenu(false)
    }
  }, [user])

  const statusColor = status === 'clocked_in'
    ? 'text-green-600 bg-green-50'
    : status === 'on_break'
    ? 'text-amber-600 bg-amber-50'
    : 'text-red-600 bg-red-50'

  const statusLabel = status === 'clocked_in'
    ? 'In'
    : status === 'on_break'
    ? 'Break'
    : 'Out'

  if (status === 'loading' || !user) {
    return (
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--muted)]">
        <Clock className="h-4 w-4 text-muted-foreground animate-pulse" />
      </div>
    )
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setShowMenu(!showMenu)}
        className={cn(
          'btn-press flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-bold transition-colors',
          statusColor
        )}
      >
        <Clock className="h-3.5 w-3.5" />
        {statusLabel}
      </button>

      {/* Dropdown menu */}
      {showMenu && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowMenu(false)}
          />
          <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-xl border border-border bg-white py-1 shadow-xl">
            {status === 'clocked_out' && (
              <button
                onClick={handleClockIn}
                disabled={isProcessing}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-sm font-medium text-foreground hover:bg-[var(--secondary)] transition-colors disabled:opacity-50"
              >
                <LogIn className="h-4 w-4 text-green-600" />
                Clock In
              </button>
            )}
            {status === 'clocked_in' && (
              <>
                <button
                  onClick={handleBreakStart}
                  disabled={isProcessing}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-sm font-medium text-foreground hover:bg-[var(--secondary)] transition-colors disabled:opacity-50"
                >
                  <Coffee className="h-4 w-4 text-amber-600" />
                  Start Break
                </button>
                <button
                  onClick={handleClockOut}
                  disabled={isProcessing}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-sm font-medium text-foreground hover:bg-[var(--secondary)] transition-colors disabled:opacity-50"
                >
                  <LogOut className="h-4 w-4 text-red-600" />
                  Clock Out
                </button>
              </>
            )}
            {status === 'on_break' && (
              <>
                <button
                  onClick={handleBreakEnd}
                  disabled={isProcessing}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-sm font-medium text-foreground hover:bg-[var(--secondary)] transition-colors disabled:opacity-50"
                >
                  <LogIn className="h-4 w-4 text-green-600" />
                  End Break
                </button>
                <button
                  onClick={handleClockOut}
                  disabled={isProcessing}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-sm font-medium text-foreground hover:bg-[var(--secondary)] transition-colors disabled:opacity-50"
                >
                  <LogOut className="h-4 w-4 text-red-600" />
                  Clock Out
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
