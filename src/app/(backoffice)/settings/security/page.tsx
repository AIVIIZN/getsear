'use client'

import { useState, useEffect, useCallback } from 'react'
import { ShieldCheck, ShieldOff, Loader2, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { MFASetup } from '@/components/auth/MFASetup'

interface MfaFactor {
  id: string
  friendly_name: string | null
  status: string
  created_at: string
}

interface MfaStatus {
  is_enrolled: boolean
  factors: MfaFactor[]
}

export default function SecuritySettingsPage() {
  const [mfaStatus, setMfaStatus] = useState<MfaStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showSetup, setShowSetup] = useState(false)
  const [isDisabling, setIsDisabling] = useState(false)

  const fetchMfaStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/mfa/setup')
      const json = await res.json()
      if (res.ok) {
        setMfaStatus(json.data)
      }
    } catch {
      console.error('Failed to fetch MFA status')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMfaStatus()
  }, [fetchMfaStatus])

  async function handleDisableMFA() {
    if (!window.confirm('Are you sure you want to disable two-factor authentication? Your account will be less secure.')) {
      return
    }

    setIsDisabling(true)
    try {
      const res = await fetch('/api/auth/mfa/setup', { method: 'DELETE' })
      const json = await res.json()

      if (!res.ok) {
        toast.error(json.error || 'Failed to disable MFA')
        return
      }

      toast.success('Two-factor authentication has been disabled')
      await fetchMfaStatus()
      setShowSetup(false)
    } catch {
      toast.error('Network error. Please try again.')
    } finally {
      setIsDisabling(false)
    }
  }

  function handleSetupComplete() {
    setShowSetup(false)
    fetchMfaStatus()
    toast.success('Two-factor authentication is now active')
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin" style={{ color: 'var(--muted-foreground)' }} />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <h2 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
          Security
        </h2>
        <p className="mt-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>
          Manage two-factor authentication and account security settings.
        </p>
      </div>

      {/* Two-Factor Authentication section */}
      <div
        className="rounded-xl border"
        style={{
          backgroundColor: 'var(--card)',
          borderColor: 'var(--border)',
        }}
      >
        <div className="border-b p-6" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {mfaStatus?.is_enrolled ? (
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-lg"
                  style={{ backgroundColor: 'var(--success, #22C55E)', color: 'white' }}
                >
                  <ShieldCheck className="size-5" />
                </div>
              ) : (
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-lg"
                  style={{ backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)' }}
                >
                  <ShieldOff className="size-5" />
                </div>
              )}
              <div>
                <h3 className="font-semibold" style={{ color: 'var(--foreground)' }}>
                  Two-Factor Authentication
                </h3>
                <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  {mfaStatus?.is_enrolled
                    ? 'Your account is protected with 2FA'
                    : 'Add an extra layer of security to your account'}
                </p>
              </div>
            </div>

            {/* Status badge */}
            <div
              className="rounded-full px-3 py-1 text-xs font-semibold"
              style={{
                backgroundColor: mfaStatus?.is_enrolled
                  ? 'rgba(34, 197, 94, 0.1)'
                  : 'rgba(239, 68, 68, 0.1)',
                color: mfaStatus?.is_enrolled
                  ? 'var(--success, #22C55E)'
                  : 'var(--error)',
              }}
            >
              {mfaStatus?.is_enrolled ? 'Enabled' : 'Not configured'}
            </div>
          </div>
        </div>

        <div className="p-6">
          {showSetup ? (
            <MFASetup onComplete={handleSetupComplete} />
          ) : mfaStatus?.is_enrolled ? (
            <div className="space-y-4">
              {/* Enrolled factors */}
              {mfaStatus.factors
                .filter((f) => f.status === 'verified')
                .map((factor) => (
                  <div
                    key={factor.id}
                    className="flex items-center justify-between rounded-lg border p-4"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                        {factor.friendly_name || 'Authenticator App'}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                        Added {new Date(factor.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDisableMFA}
                      disabled={isDisabling}
                      className="h-9 text-sm touch-target"
                      style={{ color: 'var(--error)' }}
                    >
                      {isDisabling ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        'Disable'
                      )}
                    </Button>
                  </div>
                ))}

              {/* Security warning */}
              <div
                className="flex items-start gap-3 rounded-lg p-4"
                style={{ backgroundColor: 'var(--muted)' }}
              >
                <AlertTriangle className="mt-0.5 size-4 shrink-0" style={{ color: 'var(--warning, #EAB308)' }} />
                <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  If you disable two-factor authentication, your account will only be protected
                  by your password. We strongly recommend keeping 2FA enabled.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                Two-factor authentication adds an additional layer of security by requiring
                a verification code from your authenticator app when you sign in.
                Recommended for all owner and admin accounts.
              </p>
              <Button
                onClick={() => setShowSetup(true)}
                className="h-12 touch-target text-base font-semibold"
              >
                Set up two-factor authentication
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Password section */}
      <div
        className="rounded-xl border"
        style={{
          backgroundColor: 'var(--card)',
          borderColor: 'var(--border)',
        }}
      >
        <div className="p-6">
          <h3 className="font-semibold" style={{ color: 'var(--foreground)' }}>
            Password
          </h3>
          <p className="mt-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>
            Change your password or request a password reset link via email.
          </p>
          <div className="mt-4">
            <Button
              variant="outline"
              className="h-12 touch-target"
              onClick={async () => {
                try {
                  const res = await fetch('/api/auth/me')
                  const json = await res.json()
                  if (json.user?.email) {
                    await fetch('/api/auth/forgot-password', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ email: json.user.email }),
                    })
                    toast.success('Password reset link sent to your email')
                  }
                } catch {
                  toast.error('Failed to send reset link')
                }
              }}
            >
              Send password reset link
            </Button>
          </div>
        </div>
      </div>

      {/* Session info */}
      <div
        className="rounded-xl border"
        style={{
          backgroundColor: 'var(--card)',
          borderColor: 'var(--border)',
        }}
      >
        <div className="p-6">
          <h3 className="font-semibold" style={{ color: 'var(--foreground)' }}>
            Session
          </h3>
          <p className="mt-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>
            POS terminals stay signed in for 12 hours. Back-office sessions expire after 1 hour of inactivity.
          </p>
        </div>
      </div>
    </div>
  )
}
