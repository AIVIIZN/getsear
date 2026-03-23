'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Loader2, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PasswordStrength } from '@/components/auth/PasswordStrength'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const passwordsMatch = password === confirmPassword && password.length > 0
  const passwordValid = password.length >= 8 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /[0-9]/.test(password)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!passwordValid) {
      setError('Password does not meet all requirements.')
      return
    }

    if (!passwordsMatch) {
      setError('Passwords do not match.')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })

      const json = await res.json()

      if (!res.ok) {
        setError(json.error || 'Failed to reset password. The link may have expired.')
        return
      }

      setSuccess(true)
      toast.success('Password updated successfully')

      // Redirect to login after a short delay
      setTimeout(() => {
        router.push('/login')
      }, 2000)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4"
      style={{ backgroundColor: '#F2F2F7' }}
    >
      <div
        className="w-full max-w-md rounded-2xl border p-8 shadow-lg"
        style={{
          backgroundColor: 'var(--card)',
          borderColor: 'var(--border)',
        }}
      >
        <div
          className="animate-in fade-in slide-in-from-bottom-4 duration-500"
          style={{ animationTimingFunction: 'var(--ease-out)' }}
        >
          {/* Accent line */}
          <div
            className="mx-auto mb-6 h-[3px] w-16 rounded-full"
            style={{ backgroundColor: 'var(--primary)' }}
          />

          {success ? (
            <div className="space-y-4 text-center">
              <div
                className="mx-auto flex h-16 w-16 items-center justify-center rounded-full"
                style={{ backgroundColor: 'var(--success, #22C55E)', color: 'white' }}
              >
                <CheckCircle2 className="size-8" />
              </div>
              <h2 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
                Password updated
              </h2>
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                Your password has been reset. Redirecting to sign in...
              </p>
            </div>
          ) : (
            <>
              <h2
                className="mb-2 text-center text-xl font-semibold"
                style={{ color: 'var(--foreground)' }}
              >
                Set a new password
              </h2>
              <p
                className="mb-6 text-center text-sm"
                style={{ color: 'var(--muted-foreground)' }}
              >
                Choose a strong password for your account.
              </p>

              {error && (
                <div
                  className="mb-4 rounded-lg px-4 py-3 text-sm font-medium"
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

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* New password */}
                <div className="space-y-2">
                  <Label htmlFor="new-password">New password</Label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder="Enter your new password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value)
                        setError(null)
                      }}
                      className="h-12 pr-12 px-4 text-base"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="btn-press absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 touch-target"
                      style={{ color: 'var(--muted-foreground)' }}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                    </button>
                  </div>
                  <PasswordStrength password={password} />
                </div>

                {/* Confirm password */}
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm password</Label>
                  <Input
                    id="confirm-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Confirm your new password"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value)
                      setError(null)
                    }}
                    className="h-12 px-4 text-base"
                    style={{
                      borderColor: confirmPassword && !passwordsMatch ? 'var(--error)' : undefined,
                    }}
                  />
                  {confirmPassword && !passwordsMatch && (
                    <p className="text-xs" style={{ color: 'var(--error)' }}>
                      Passwords do not match
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={isLoading || !passwordValid || !passwordsMatch}
                  className="btn-press h-12 w-full text-base font-semibold"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 size-5 animate-spin" />
                      Updating password...
                    </>
                  ) : (
                    'Reset Password'
                  )}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
