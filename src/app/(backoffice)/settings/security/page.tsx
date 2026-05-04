'use client'

import { useState, useEffect, useCallback } from 'react'
import { ShieldCheck, ShieldOff, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui-v2/Button'
import { Card } from '@/components/ui-v2/Card'
import { Skeleton } from '@/components/ui-v2/data/Skeleton'
import { Badge } from '@/components/ui-v2/data/Badge'
import { ConfirmDialog } from '@/components/ui-v2/feedback/ConfirmDialog'
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
  const [confirmOpen, setConfirmOpen] = useState(false)

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
      <div className="flex flex-col gap-[var(--space-6)]">
        <div>
          <Skeleton className="h-7 w-32" />
          <Skeleton className="mt-[var(--space-2)] h-4 w-80" />
        </div>
        <Skeleton variant="card" className="h-32" />
        <Skeleton variant="card" className="h-32" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-[var(--space-8)]">
      {/* Page header */}
      <div>
        <h2 className="text-[length:var(--type-title-2-size)] font-[var(--weight-semibold)] text-[color:var(--color-text)]">
          Security
        </h2>
        <p className="mt-[var(--space-1)] text-[length:var(--type-subhead-size)] text-[color:var(--color-text-muted)]">
          Manage two-factor authentication and account security settings.
        </p>
      </div>

      {/* Two-Factor Authentication */}
      <Card variant="flat" padding="default" className="gap-0 p-0">
        <div className="border-b border-[color:var(--color-border)] p-[var(--space-6)]">
          <div className="flex items-center justify-between gap-[var(--space-4)]">
            <div className="flex items-center gap-[var(--space-3)]">
              {mfaStatus?.is_enrolled ? (
                <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] bg-[color:var(--color-success-bg)]">
                  <ShieldCheck className="h-5 w-5 text-[color:var(--color-success)]" />
                </div>
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] bg-[color:var(--color-bg-muted)]">
                  <ShieldOff className="h-5 w-5 text-[color:var(--color-text-muted)]" />
                </div>
              )}
              <div>
                <h3 className="text-[length:var(--type-headline-size)] font-[var(--weight-semibold)] text-[color:var(--color-text)]">
                  Two-Factor Authentication
                </h3>
                <p className="text-[length:var(--type-subhead-size)] text-[color:var(--color-text-muted)]">
                  {mfaStatus?.is_enrolled
                    ? 'Your account is protected with 2FA'
                    : 'Add an extra layer of security to your account'}
                </p>
              </div>
            </div>
            {mfaStatus?.is_enrolled ? (
              <Badge variant="success" shape="pill">
                Enabled
              </Badge>
            ) : (
              <Badge variant="danger" shape="pill">
                Not configured
              </Badge>
            )}
          </div>
        </div>

        <div className="p-[var(--space-6)]">
          {showSetup ? (
            <MFASetup onComplete={handleSetupComplete} />
          ) : mfaStatus?.is_enrolled ? (
            <div className="flex flex-col gap-[var(--space-4)]">
              {mfaStatus.factors
                .filter((f) => f.status === 'verified')
                .map((factor) => (
                  <div
                    key={factor.id}
                    className="flex items-center justify-between gap-[var(--space-4)] rounded-[var(--radius-md)] border border-[color:var(--color-border)] p-[var(--space-4)]"
                  >
                    <div>
                      <p className="text-[length:var(--type-subhead-size)] font-[var(--weight-medium)] text-[color:var(--color-text)]">
                        {factor.friendly_name || 'Authenticator App'}
                      </p>
                      <p className="text-[length:var(--type-footnote-size)] text-[color:var(--color-text-muted)]">
                        Added {new Date(factor.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Button
                      variant="destructive"
                      size="md"
                      onClick={() => setConfirmOpen(true)}
                      loading={isDisabling}
                    >
                      Disable
                    </Button>
                  </div>
                ))}

              {/* Security warning */}
              <div className="flex items-start gap-[var(--space-3)] rounded-[var(--radius-md)] bg-[color:var(--color-warning-bg)] p-[var(--space-4)]">
                <AlertTriangle className="mt-[2px] h-4 w-4 shrink-0 text-[color:var(--color-warning)]" />
                <p className="text-[length:var(--type-footnote-size)] text-[color:var(--color-text-muted)]">
                  If you disable two-factor authentication, your account will only be protected
                  by your password. We strongly recommend keeping 2FA enabled.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-[var(--space-4)]">
              <p className="text-[length:var(--type-subhead-size)] text-[color:var(--color-text-muted)]">
                Two-factor authentication adds an additional layer of security by requiring
                a verification code from your authenticator app when you sign in.
                Recommended for all owner and admin accounts.
              </p>
              <div>
                <Button onClick={() => setShowSetup(true)} size="lg">
                  Set up two-factor authentication
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Password section */}
      <Card variant="flat" padding="default">
        <div>
          <h3 className="text-[length:var(--type-headline-size)] font-[var(--weight-semibold)] text-[color:var(--color-text)]">
            Password
          </h3>
          <p className="mt-[var(--space-1)] text-[length:var(--type-subhead-size)] text-[color:var(--color-text-muted)]">
            Change your password or request a password reset link via email.
          </p>
        </div>
        <div>
          <Button
            variant="secondary"
            size="lg"
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
      </Card>

      {/* Session info */}
      <Card variant="flat" padding="default">
        <div>
          <h3 className="text-[length:var(--type-headline-size)] font-[var(--weight-semibold)] text-[color:var(--color-text)]">
            Session
          </h3>
          <p className="mt-[var(--space-1)] text-[length:var(--type-subhead-size)] text-[color:var(--color-text-muted)]">
            POS terminals stay signed in for 12 hours. Back-office sessions expire after 1 hour of inactivity.
          </p>
        </div>
      </Card>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Disable two-factor authentication?"
        description="Your account will be less secure. You can re-enable 2FA at any time."
        confirmLabel="Disable 2FA"
        variant="destructive"
        onConfirm={handleDisableMFA}
      />
    </div>
  )
}
