'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuthStore } from '@/stores/auth-store'

const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

type LoginFormData = z.infer<typeof loginSchema>

export default function LoginPage() {
  const router = useRouter()
  const { actions } = useAuthStore()
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [shake, setShake] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    defaultValues: { email: '', password: '' },
  })

  async function onSubmit(data: LoginFormData) {
    setIsLoading(true)
    setServerError(null)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      const json = await res.json() as {
        user?: {
          id: string
          email: string
          display_name: string
          role: string
          org_id: string
          location_ids: string[]
          avatar_url?: string | null
        }
        error?: string
      }

      if (!res.ok || !json.user) {
        setServerError(json.error ?? 'Sign in failed. Please try again.')
        triggerShake()
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

      toast.success(`Welcome back, ${json.user.display_name}`)
      router.push('/orders')
    } catch {
      setServerError('Network error. Please check your connection.')
      triggerShake()
    } finally {
      setIsLoading(false)
    }
  }

  function triggerShake() {
    setShake(true)
    setTimeout(() => setShake(false), 500)
  }

  return (
    <div
      className="animate-in fade-in slide-in-from-bottom-4 duration-500"
      style={{ animationTimingFunction: 'var(--ease-out)' }}
    >
      {/* Accent line */}
      <div
        className="mx-auto mb-6 h-[3px] w-16 rounded-full"
        style={{ backgroundColor: 'var(--primary)' }}
      />

      {/* Error banner */}
      {serverError && (
        <div
          className={`mb-4 rounded-lg px-4 py-3 text-sm font-medium ${shake ? 'animate-shake' : ''}`}
          style={{
            backgroundColor: 'var(--error-bg)',
            color: 'var(--error)',
            border: '1px solid var(--error)',
          }}
          role="alert"
        >
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        {/* Email */}
        <div className="space-y-2">
          <Label htmlFor="email">Email address</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@restaurant.com"
            className="h-12 px-4 text-base"
            style={{
              borderColor: errors.email ? 'var(--error)' : undefined,
            }}
            {...register('email', {
              required: 'Email is required',
              pattern: {
                value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                message: 'Enter a valid email address',
              },
            })}
          />
          {errors.email && (
            <p className="text-xs" style={{ color: 'var(--error)' }}>
              {errors.email.message}
            </p>
          )}
        </div>

        {/* Password */}
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Enter your password"
              className="h-12 pr-12 px-4 text-base"
              style={{
                borderColor: errors.password ? 'var(--error)' : undefined,
              }}
              {...register('password', {
                required: 'Password is required',
              })}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="btn-press absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 touch-target"
              style={{ color: 'var(--muted-foreground)' }}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
                <EyeOff className="size-5" />
              ) : (
                <Eye className="size-5" />
              )}
            </button>
          </div>
          {errors.password && (
            <p className="text-xs" style={{ color: 'var(--error)' }}>
              {errors.password.message}
            </p>
          )}
        </div>

        {/* Submit */}
        <Button
          type="submit"
          disabled={isLoading}
          className="btn-press h-12 w-full text-base font-semibold"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 size-5 animate-spin" />
              Signing in...
            </>
          ) : (
            'Sign In'
          )}
        </Button>
      </form>

      {/* PIN login link */}
      <div className="mt-6 text-center">
        <Link
          href="/pin-login"
          className="btn-press inline-flex items-center text-sm font-medium touch-target"
          style={{ color: 'var(--primary)' }}
        >
          Sign in with PIN
        </Link>
      </div>

      {/* Shake animation (inline keyframes for the error state) */}
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
