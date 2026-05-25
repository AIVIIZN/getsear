'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Loader2, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return

    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      if (res.status === 429) {
        setError('Too many requests. Please wait before trying again.')
        return
      }

      // Always show success to prevent email enumeration
      setSubmitted(true)
    } catch {
      setError('Network error. Please check your connection.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4"
      style={{ backgroundColor: 'var(--color-bg-muted)' }}
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

          {submitted ? (
            /* Success state */
            <div className="space-y-4 text-center">
              <div
                className="mx-auto flex h-16 w-16 items-center justify-center rounded-full"
                style={{ backgroundColor: 'var(--primary)', color: 'white' }}
              >
                <Mail className="size-8" />
              </div>
              <h2 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
                Check your email
              </h2>
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                If an account exists with <strong>{email}</strong>, you will receive a
                password reset link. The link expires in 1 hour.
              </p>
              <Link
                href="/login"
                className="btn-press mt-4 inline-flex items-center gap-2 text-sm font-medium touch-target"
                style={{ color: 'var(--primary)' }}
              >
                <ArrowLeft className="size-4" />
                Back to sign in
              </Link>
            </div>
          ) : (
            /* Form state */
            <>
              <h2
                className="mb-2 text-center text-xl font-semibold"
                style={{ color: 'var(--foreground)' }}
              >
                Forgot your password?
              </h2>
              <p
                className="mb-6 text-center text-sm"
                style={{ color: 'var(--muted-foreground)' }}
              >
                Enter your email address and we will send you a link to reset your password.
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

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email address</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@restaurant.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-12 px-4 text-base"
                    autoFocus
                    required
                  />
                </div>

                <Button
                  type="submit"
                  disabled={isLoading || !email.trim()}
                  className="btn-press h-12 w-full text-base font-semibold"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 size-5 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    'Send reset link'
                  )}
                </Button>
              </form>

              <div className="mt-6 text-center">
                <Link
                  href="/login"
                  className="btn-press inline-flex items-center gap-2 text-sm font-medium touch-target"
                  style={{ color: 'var(--primary)' }}
                >
                  <ArrowLeft className="size-4" />
                  Back to sign in
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
