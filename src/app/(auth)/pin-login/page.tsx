'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Delete, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/stores/auth-store'

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface StaffMember {
  id: string
  display_name: string
  first_name: string
  last_name: string
  role: string
  avatar_url: string | null
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Deterministic color from a string — yields a warm, readable hue */
function avatarColor(name: string): string {
  const colors = [
    '#E05A0A', '#2563EB', '#16A34A', '#7C3AED', '#D97706',
    '#0891B2', '#DC2626', '#6366F1', '#059669', '#DB2777',
    '#CA8A04', '#9333EA', '#0D9488', '#E11D48', '#4F46E5',
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

function initials(member: StaffMember): string {
  const first = member.first_name?.[0] ?? ''
  const last = member.last_name?.[0] ?? ''
  if (first || last) return (first + last).toUpperCase()
  return (member.display_name?.[0] ?? '?').toUpperCase()
}

function displayNameFor(m: StaffMember): string {
  return m.display_name || [m.first_name, m.last_name].filter(Boolean).join(' ') || 'User'
}

const PIN_LENGTH = 4
const NUMPAD_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'backspace'] as const

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function PinLoginPage() {
  const router = useRouter()
  const { actions } = useAuthStore()

  const [staff, setStaff] = useState<StaffMember[]>([])
  const [loadingStaff, setLoadingStaff] = useState(true)
  const [selectedUser, setSelectedUser] = useState<StaffMember | null>(null)
  const [pin, setPin] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [shake, setShake] = useState(false)
  const [lockedUntil, setLockedUntil] = useState<number | null>(null)
  const [lockCountdown, setLockCountdown] = useState(0)

  /* Fetch active staff */
  useEffect(() => {
    async function fetchStaff() {
      try {
        const res = await fetch('/api/auth/me')
        // We fetch staff list; if the user isn't logged in yet, use a public
        // staff endpoint. For now, we'll use a fallback approach.
        // In production, this would be an unauthenticated endpoint that returns
        // active staff names + IDs only (no sensitive data).
        if (res.ok) {
          // User is already authenticated — redirect to orders
          router.push('/orders')
          return
        }
      } catch {
        // Not authenticated — that's expected
      }

      try {
        // Fetch active staff for PIN selection.
        // This uses a dedicated endpoint that returns minimal user data.
        const res = await fetch('/api/staff/active')
        if (res.ok) {
          const json = await res.json() as { staff?: StaffMember[] }
          setStaff(json.staff ?? [])
        }
      } catch {
        // If staff endpoint doesn't exist yet, use empty list
        setStaff([])
      } finally {
        setLoadingStaff(false)
      }
    }

    void fetchStaff()
  }, [router])

  /* Lockout countdown timer */
  useEffect(() => {
    if (!lockedUntil) return

    const interval = setInterval(() => {
      const remaining = Math.max(0, lockedUntil - Date.now())
      setLockCountdown(Math.ceil(remaining / 1000))
      if (remaining <= 0) {
        setLockedUntil(null)
        setLockCountdown(0)
        setError(null)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [lockedUntil])

  /* Submit PIN when 4 digits entered */
  const submitPin = useCallback(
    async (fullPin: string) => {
      if (!selectedUser || isSubmitting) return

      setIsSubmitting(true)
      setError(null)

      try {
        const res = await fetch('/api/auth/pin-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: selectedUser.id, pin: fullPin }),
        })

        const json = await res.json() as {
          user?: {
            id: string
            email: string
            display_name: string
            role: string
            org_id: string
            location_ids: string[]
          }
          error?: string
          locked_until?: number
          attempts_remaining?: number
        }

        if (!res.ok || !json.user) {
          setPin('')

          if (json.locked_until) {
            setLockedUntil(json.locked_until)
          }

          setError(json.error ?? 'Incorrect PIN.')
          setShake(true)
          setTimeout(() => setShake(false), 500)
          return
        }

        actions.setUser({
          id: json.user.id,
          email: json.user.email,
          display_name: json.user.display_name,
          role: json.user.role,
          org_id: json.user.org_id,
          location_ids: json.user.location_ids,
        })

        toast.success(`Welcome, ${json.user.display_name}`)
        router.push('/orders')
      } catch {
        setPin('')
        setError('Network error. Please try again.')
        setShake(true)
        setTimeout(() => setShake(false), 500)
      } finally {
        setIsSubmitting(false)
      }
    },
    [selectedUser, isSubmitting, actions, router]
  )

  /* Handle numpad key press */
  const handleKey = useCallback(
    (key: string) => {
      if (lockedUntil) return

      if (key === 'clear') {
        setPin('')
        setError(null)
        return
      }
      if (key === 'backspace') {
        setPin((prev) => prev.slice(0, -1))
        setError(null)
        return
      }

      setPin((prev) => {
        if (prev.length >= PIN_LENGTH) return prev
        const next = prev + key
        if (next.length === PIN_LENGTH) {
          // Auto-submit
          void submitPin(next)
        }
        return next
      })
    },
    [lockedUntil, submitPin]
  )

  /* Keyboard support */
  useEffect(() => {
    if (!selectedUser) return

    function onKeyDown(e: KeyboardEvent) {
      if (e.key >= '0' && e.key <= '9') {
        handleKey(e.key)
      } else if (e.key === 'Backspace') {
        handleKey('backspace')
      } else if (e.key === 'Escape') {
        setSelectedUser(null)
        setPin('')
        setError(null)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedUser, handleKey])

  /* ---------------------------------------------------------------- */
  /* Render — Avatar Grid                                              */
  /* ---------------------------------------------------------------- */

  if (!selectedUser) {
    return (
      <div
        className="animate-in fade-in slide-in-from-bottom-4 duration-500"
        style={{ animationTimingFunction: 'var(--ease-out)' }}
      >
        <h2 className="mb-1 text-center text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
          Who are you?
        </h2>
        <p className="mb-6 text-center text-sm" style={{ color: 'var(--muted-foreground)' }}>
          Tap your name to sign in with PIN
        </p>

        {loadingStaff ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-8 animate-spin" style={{ color: 'var(--primary)' }} />
          </div>
        ) : staff.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
              No staff available for PIN login.
            </p>
            <p className="mt-1 text-xs" style={{ color: 'var(--muted-foreground)' }}>
              Use email login or ask your admin to set up staff PINs.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {staff.map((member) => {
              const color = avatarColor(displayNameFor(member))
              return (
                <button
                  key={member.id}
                  onClick={() => {
                    setSelectedUser(member)
                    setPin('')
                    setError(null)
                  }}
                  className="btn-press flex flex-col items-center gap-2 rounded-xl p-3 transition-colors touch-target"
                  style={{
                    transitionDuration: 'var(--duration-fast)',
                  }}
                >
                  {/* Avatar circle */}
                  <div
                    className="flex size-[72px] items-center justify-center rounded-full text-xl font-bold text-white shadow-sm"
                    style={{ backgroundColor: color }}
                  >
                    {initials(member)}
                  </div>
                  {/* Name */}
                  <span
                    className="text-xs font-medium leading-tight text-center line-clamp-2"
                    style={{ color: 'var(--foreground)' }}
                  >
                    {displayNameFor(member)}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        {/* Back to email login */}
        <div className="mt-6 text-center">
          <Link
            href="/login"
            className="btn-press inline-flex items-center gap-1.5 text-sm font-medium touch-target"
            style={{ color: 'var(--primary)' }}
          >
            <ArrowLeft className="size-4" />
            Sign in with email
          </Link>
        </div>
      </div>
    )
  }

  /* ---------------------------------------------------------------- */
  /* Render — PIN Entry                                                */
  /* ---------------------------------------------------------------- */

  const userColor = avatarColor(displayNameFor(selectedUser))
  const lockMinutes = Math.ceil(lockCountdown / 60)

  return (
    <div
      className="animate-in fade-in slide-in-from-bottom-4 duration-500"
      style={{ animationTimingFunction: 'var(--ease-out)' }}
    >
      {/* Selected user */}
      <div className="mb-6 flex flex-col items-center gap-2">
        <div
          className="flex size-[72px] items-center justify-center rounded-full text-xl font-bold text-white"
          style={{
            backgroundColor: userColor,
            boxShadow: '0 0 0 4px var(--primary), var(--shadow-sm)',
          }}
        >
          {initials(selectedUser)}
        </div>
        <span className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
          {displayNameFor(selectedUser)}
        </span>
        <button
          onClick={() => {
            setSelectedUser(null)
            setPin('')
            setError(null)
            setLockedUntil(null)
          }}
          className="btn-press text-xs font-medium touch-target"
          style={{ color: 'var(--muted-foreground)' }}
        >
          Not you? Switch user
        </button>
      </div>

      {/* Error / Lockout message */}
      {error && (
        <div
          className={`mb-4 rounded-lg px-4 py-3 text-center text-sm font-medium ${shake ? 'animate-shake' : ''}`}
          style={{
            backgroundColor: 'var(--error-bg)',
            color: 'var(--error)',
            border: '1px solid var(--error)',
          }}
          role="alert"
        >
          {lockedUntil
            ? `Too many attempts. Try again in ${lockMinutes} minute${lockMinutes !== 1 ? 's' : ''}.`
            : error}
        </div>
      )}

      {/* PIN dots */}
      <div className="mb-6 flex items-center justify-center gap-4">
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <div
            key={i}
            className="size-4 rounded-full transition-all"
            style={{
              transitionDuration: 'var(--duration-fast)',
              transitionTimingFunction: 'var(--ease-spring)',
              backgroundColor: i < pin.length ? 'var(--primary)' : 'var(--border)',
              transform: i < pin.length ? 'scale(1.25)' : 'scale(1)',
            }}
          />
        ))}
      </div>

      {/* Numpad */}
      <div className="grid grid-cols-3 gap-2">
        {NUMPAD_KEYS.map((key) => {
          if (key === 'clear') {
            return (
              <Button
                key={key}
                type="button"
                variant="ghost"
                onClick={() => handleKey(key)}
                disabled={!!lockedUntil || isSubmitting}
                className="btn-press h-16 text-base font-medium touch-target-lg rounded-xl"
              >
                Clear
              </Button>
            )
          }
          if (key === 'backspace') {
            return (
              <Button
                key={key}
                type="button"
                variant="ghost"
                onClick={() => handleKey(key)}
                disabled={!!lockedUntil || isSubmitting}
                className="btn-press h-16 touch-target-lg rounded-xl"
                aria-label="Backspace"
              >
                <Delete className="size-6" />
              </Button>
            )
          }
          return (
            <Button
              key={key}
              type="button"
              variant="outline"
              onClick={() => handleKey(key)}
              disabled={!!lockedUntil || isSubmitting}
              className="btn-press h-16 text-xl font-semibold touch-target-lg rounded-xl"
              style={{
                transitionDuration: 'var(--duration-fast)',
              }}
            >
              {key}
            </Button>
          )
        })}
      </div>

      {/* Submitting indicator */}
      {isSubmitting && (
        <div className="mt-4 flex items-center justify-center gap-2 text-sm" style={{ color: 'var(--muted-foreground)' }}>
          <Loader2 className="size-4 animate-spin" />
          Verifying...
        </div>
      )}

      {/* Back to email login */}
      <div className="mt-6 text-center">
        <Link
          href="/login"
          className="btn-press inline-flex items-center gap-1.5 text-sm font-medium touch-target"
          style={{ color: 'var(--primary)' }}
        >
          <ArrowLeft className="size-4" />
          Sign in with email
        </Link>
      </div>

      {/* Shake animation */}
      <style jsx>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
          20%, 40%, 60%, 80% { transform: translateX(4px); }
        }
        .animate-shake {
          animation: shake 0.5s ease-in-out;
        }
      `}</style>
    </div>
  )
}
