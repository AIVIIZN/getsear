'use client'

import { useState } from 'react'
import { Loader2, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RecoveryCodes } from './RecoveryCodes'

type SetupStep = 'idle' | 'scanning' | 'verifying' | 'recovery'

interface TotpData {
  factor_id: string
  totp: {
    qr_code: string
    secret: string
    uri: string
  }
  recovery_codes: string[]
}

interface MFASetupProps {
  onComplete: () => void
}

export function MFASetup({ onComplete }: MFASetupProps) {
  const [step, setStep] = useState<SetupStep>('idle')
  const [isLoading, setIsLoading] = useState(false)
  const [totpData, setTotpData] = useState<TotpData | null>(null)
  const [verificationCode, setVerificationCode] = useState('')
  const [verifyError, setVerifyError] = useState<string | null>(null)

  async function handleStartSetup() {
    setIsLoading(true)
    try {
      const res = await fetch('/api/auth/mfa/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ friendly_name: 'Authenticator App' }),
      })

      const json = await res.json()

      if (!res.ok) {
        toast.error(json.error || 'Failed to start MFA setup')
        return
      }

      setTotpData(json.data)
      setStep('scanning')
    } catch {
      toast.error('Network error. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleVerify() {
    if (!totpData || verificationCode.length !== 6) return

    setIsLoading(true)
    setVerifyError(null)

    try {
      // First create a challenge
      const challengeRes = await fetch('/api/auth/mfa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          factor_id: totpData.factor_id,
          challenge_id: totpData.factor_id, // Supabase uses factor_id for initial verification
          code: verificationCode,
        }),
      })

      const challengeJson = await challengeRes.json()

      if (!challengeRes.ok) {
        setVerifyError(challengeJson.error || 'Invalid code. Please try again.')
        return
      }

      toast.success('Two-factor authentication enabled successfully')
      setStep('recovery')
    } catch {
      setVerifyError('Network error. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  if (step === 'idle') {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: 'var(--primary)', color: 'white' }}
          >
            <ShieldCheck className="size-5" />
          </div>
          <div>
            <h3 className="font-semibold" style={{ color: 'var(--foreground)' }}>
              Two-Factor Authentication
            </h3>
            <p className="mt-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>
              Add an extra layer of security to your account. You will need an authenticator
              app like Google Authenticator, Authy, or 1Password.
            </p>
          </div>
        </div>

        <Button
          onClick={handleStartSetup}
          disabled={isLoading}
          className="h-12 w-full touch-target text-base font-semibold"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 size-5 animate-spin" />
              Setting up...
            </>
          ) : (
            'Enable Two-Factor Authentication'
          )}
        </Button>
      </div>
    )
  }

  if (step === 'scanning' && totpData) {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
            Scan the QR code
          </h3>
          <p className="mt-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>
            Open your authenticator app and scan this QR code. If you cannot scan,
            enter the secret key manually.
          </p>
        </div>

        {/* QR Code display */}
        <div
          className="mx-auto flex w-fit flex-col items-center gap-4 rounded-xl border p-6"
          style={{
            backgroundColor: 'white',
            borderColor: 'var(--border)',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={totpData.totp.qr_code}
            alt="Scan this QR code with your authenticator app"
            width={200}
            height={200}
            className="rounded"
          />
        </div>

        {/* Manual entry secret */}
        <div
          className="rounded-lg border p-4"
          style={{
            backgroundColor: 'var(--muted)',
            borderColor: 'var(--border)',
          }}
        >
          <p className="mb-1 text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
            Manual entry key
          </p>
          <p
            className="select-all break-all font-mono text-sm font-medium tracking-wider"
            style={{ color: 'var(--foreground)' }}
          >
            {totpData.totp.secret}
          </p>
        </div>

        {/* Verification input */}
        <div className="space-y-3">
          <Label htmlFor="verification-code">Enter the 6-digit code from your app</Label>
          <Input
            id="verification-code"
            type="text"
            inputMode="numeric"
            maxLength={6}
            placeholder="000000"
            value={verificationCode}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, '').slice(0, 6)
              setVerificationCode(val)
              setVerifyError(null)
            }}
            className="h-14 text-center font-mono text-2xl tracking-[0.5em]"
            style={{
              borderColor: verifyError ? 'var(--error)' : undefined,
            }}
            autoFocus
          />
          {verifyError && (
            <p className="text-sm" style={{ color: 'var(--error)' }}>
              {verifyError}
            </p>
          )}
        </div>

        <Button
          onClick={handleVerify}
          disabled={isLoading || verificationCode.length !== 6}
          className="h-12 w-full touch-target text-base font-semibold"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 size-5 animate-spin" />
              Verifying...
            </>
          ) : (
            'Verify and Enable'
          )}
        </Button>
      </div>
    )
  }

  if (step === 'recovery' && totpData) {
    return (
      <RecoveryCodes
        codes={totpData.recovery_codes}
        onDone={onComplete}
      />
    )
  }

  return null
}
