'use client'

import { useState } from 'react'
import { Loader2, ShieldCheck, Key } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface MFAVerifyProps {
  factorId: string
  onVerified: () => void
  onCancel: () => void
}

export function MFAVerify({ factorId, onVerified, onCancel }: MFAVerifyProps) {
  const [code, setCode] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showRecovery, setShowRecovery] = useState(false)
  const [recoveryCode, setRecoveryCode] = useState('')

  async function handleVerify() {
    if (code.length !== 6) return

    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/auth/mfa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          factor_id: factorId,
          challenge_id: factorId,
          code,
        }),
      })

      const json = await res.json()

      if (!res.ok) {
        setError(json.error || 'Invalid code. Please try again.')
        setCode('')
        return
      }

      onVerified()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleRecovery() {
    if (!recoveryCode.trim()) return

    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/auth/mfa/recovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recovery_code: recoveryCode }),
      })

      const json = await res.json()

      if (!res.ok) {
        setError(json.error || 'Invalid recovery code.')
        return
      }

      onVerified()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  if (showRecovery) {
    return (
      <div
        className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-5"
        style={{ animationTimingFunction: 'var(--ease-out)' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: 'var(--primary)', color: 'white' }}
          >
            <Key className="size-5" />
          </div>
          <div>
            <h3 className="font-semibold" style={{ color: 'var(--foreground)' }}>
              Use a recovery code
            </h3>
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
              Enter one of your saved recovery codes
            </p>
          </div>
        </div>

        {error && (
          <div
            className="rounded-lg px-4 py-3 text-sm font-medium"
            style={{
              backgroundColor: 'var(--error-bg)',
              color: 'var(--error)',
              border: '1px solid var(--error)',
            }}
            role="alert"
          >
            {error}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="recovery-code">Recovery code</Label>
          <Input
            id="recovery-code"
            type="text"
            placeholder="XXXX-XXXX"
            value={recoveryCode}
            onChange={(e) => {
              setRecoveryCode(e.target.value.toUpperCase())
              setError(null)
            }}
            className="h-12 font-mono text-base tracking-wider"
            autoFocus
          />
        </div>

        <Button
          onClick={handleRecovery}
          disabled={isLoading || !recoveryCode.trim()}
          className="h-12 w-full touch-target text-base font-semibold"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 size-5 animate-spin" />
              Verifying...
            </>
          ) : (
            'Sign in with recovery code'
          )}
        </Button>

        <button
          type="button"
          onClick={() => {
            setShowRecovery(false)
            setError(null)
          }}
          className="w-full text-center text-sm font-medium touch-target"
          style={{ color: 'var(--primary)' }}
        >
          Back to authenticator code
        </button>
      </div>
    )
  }

  return (
    <div
      className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-5"
      style={{ animationTimingFunction: 'var(--ease-out)' }}
    >
      {/* Accent line */}
      <div
        className="mx-auto mb-2 h-[3px] w-16 rounded-full"
        style={{ backgroundColor: 'var(--primary)' }}
      />

      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: 'var(--primary)', color: 'white' }}
        >
          <ShieldCheck className="size-5" />
        </div>
        <div>
          <h3 className="font-semibold" style={{ color: 'var(--foreground)' }}>
            Two-factor authentication
          </h3>
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            Enter the 6-digit code from your authenticator app
          </p>
        </div>
      </div>

      {error && (
        <div
          className="rounded-lg px-4 py-3 text-sm font-medium"
          style={{
            backgroundColor: 'var(--error-bg)',
            color: 'var(--error)',
            border: '1px solid var(--error)',
          }}
          role="alert"
        >
          {error}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="totp-code">Authentication code</Label>
        <Input
          id="totp-code"
          type="text"
          inputMode="numeric"
          maxLength={6}
          placeholder="000000"
          value={code}
          onChange={(e) => {
            const val = e.target.value.replace(/\D/g, '').slice(0, 6)
            setCode(val)
            setError(null)
          }}
          className="h-14 text-center font-mono text-2xl tracking-[0.5em]"
          style={{
            borderColor: error ? 'var(--error)' : undefined,
          }}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter' && code.length === 6) {
              handleVerify()
            }
          }}
        />
      </div>

      <Button
        onClick={handleVerify}
        disabled={isLoading || code.length !== 6}
        className="h-12 w-full touch-target text-base font-semibold"
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 size-5 animate-spin" />
            Verifying...
          </>
        ) : (
          'Verify'
        )}
      </Button>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setShowRecovery(true)}
          className="text-sm font-medium touch-target"
          style={{ color: 'var(--primary)' }}
        >
          Use a recovery code
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-sm font-medium touch-target"
          style={{ color: 'var(--muted-foreground)' }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
