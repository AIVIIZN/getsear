'use client'

import { useMemo } from 'react'
import { Check, X } from 'lucide-react'

interface PasswordStrengthProps {
  password: string
}

interface Requirement {
  label: string
  met: boolean
}

export function PasswordStrength({ password }: PasswordStrengthProps) {
  const requirements: Requirement[] = useMemo(() => [
    { label: 'At least 8 characters', met: password.length >= 8 },
    { label: 'One uppercase letter', met: /[A-Z]/.test(password) },
    { label: 'One lowercase letter', met: /[a-z]/.test(password) },
    { label: 'One number', met: /[0-9]/.test(password) },
  ], [password])

  const metCount = requirements.filter((r) => r.met).length
  const strength = metCount === 0 ? 0 : metCount <= 2 ? 1 : metCount <= 3 ? 2 : 3

  const strengthLabels = ['', 'Weak', 'Fair', 'Strong']
  const strengthColors = ['', 'var(--error)', 'var(--warning, #EAB308)', 'var(--success, #22C55E)']

  if (!password) return null

  return (
    <div className="space-y-3">
      {/* Strength bar */}
      <div className="flex items-center gap-3">
        <div className="flex flex-1 gap-1">
          {[1, 2, 3].map((level) => (
            <div
              key={level}
              className="h-1.5 flex-1 rounded-full transition-colors duration-300"
              style={{
                backgroundColor: strength >= level
                  ? strengthColors[strength]
                  : 'var(--muted)',
              }}
            />
          ))}
        </div>
        {strength > 0 && (
          <span
            className="text-xs font-medium"
            style={{ color: strengthColors[strength] }}
          >
            {strengthLabels[strength]}
          </span>
        )}
      </div>

      {/* Requirements checklist */}
      <ul className="space-y-1.5">
        {requirements.map((req) => (
          <li key={req.label} className="flex items-center gap-2 text-xs">
            {req.met ? (
              <Check className="size-3.5 shrink-0" style={{ color: 'var(--success, #22C55E)' }} />
            ) : (
              <X className="size-3.5 shrink-0" style={{ color: 'var(--muted-foreground)' }} />
            )}
            <span
              style={{
                color: req.met ? 'var(--foreground)' : 'var(--muted-foreground)',
              }}
            >
              {req.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
