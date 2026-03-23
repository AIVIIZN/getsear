'use client'

import { useState, useCallback } from 'react'
import { Users, Plus, X, ChevronRight, AlertCircle } from 'lucide-react'
import { z } from 'zod'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import type { StepComponentProps } from './SetupWizard'

const staffMemberSchema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  role: z.string().min(1, 'Role is required'),
  pin: z.string().min(4, 'PIN must be 4+ digits').max(8),
})

interface StaffMember {
  first_name: string
  last_name: string
  role: string
  pin: string
}

const ROLES = [
  { value: 'manager', label: 'Manager' },
  { value: 'server', label: 'Server' },
  { value: 'bartender', label: 'Bartender' },
  { value: 'host', label: 'Host' },
  { value: 'line_cook', label: 'Line Cook' },
  { value: 'expo', label: 'Expo' },
  { value: 'cashier', label: 'Cashier' },
  { value: 'busser', label: 'Busser' },
]

const EMPTY_MEMBER: StaffMember = { first_name: '', last_name: '', role: '', pin: '' }

export function StepStaff({ onNext, progress }: StepComponentProps) {
  const saved = (progress.data.step_5 as { staff: StaffMember[] } | undefined)?.staff
  const [staff, setStaff] = useState<StaffMember[]>(
    saved ?? [{ first_name: '', last_name: '', role: 'manager', pin: '' }]
  )
  const [errors, setErrors] = useState<Record<string, string>>({})

  const addMember = useCallback(() => {
    setStaff((prev) => [...prev, { ...EMPTY_MEMBER }])
  }, [])

  const removeMember = useCallback((index: number) => {
    setStaff((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const updateMember = useCallback((index: number, field: keyof StaffMember, value: string) => {
    setStaff((prev) =>
      prev.map((m, i) => (i === index ? { ...m, [field]: value } : m))
    )
    setErrors((prev) => {
      const next = { ...prev }
      delete next[`${index}_${field}`]
      delete next.general
      return next
    })
  }, [])

  const handleSubmit = useCallback(() => {
    const newErrors: Record<string, string> = {}
    const hasManager = staff.some((m) => m.role === 'manager' && m.first_name.trim())

    if (!hasManager) {
      newErrors.general = 'You need at least one manager'
    }

    staff.forEach((member, i) => {
      // Only validate non-empty rows
      if (!member.first_name && !member.last_name && !member.pin) return
      const result = staffMemberSchema.safeParse(member)
      if (!result.success) {
        result.error.issues.forEach((issue) => {
          newErrors[`${i}_${String(issue.path[0])}`] = issue.message
        })
      }
    })

    // Check for duplicate PINs
    const pins = staff.filter((m) => m.pin).map((m) => m.pin)
    const duplicates = pins.filter((pin, i) => pins.indexOf(pin) !== i)
    if (duplicates.length > 0) {
      staff.forEach((m, i) => {
        if (duplicates.includes(m.pin)) {
          newErrors[`${i}_pin`] = 'Duplicate PIN'
        }
      })
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    const validStaff = staff.filter((m) => m.first_name.trim())
    onNext({ staff: validStaff })
  }, [staff, onNext])

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--accent)]">
          <Users className="h-8 w-8 text-[var(--primary)]" />
        </div>
        <h1 className="text-title-1 font-semibold text-[var(--foreground)]">
          Add your team
        </h1>
        <p className="mt-2 text-body text-[var(--muted-foreground)]">
          Add at least one manager. You can add more staff later.
        </p>
      </div>

      {errors.general && (
        <div className="flex items-center gap-2 rounded-xl bg-[var(--error-bg)] px-4 py-3">
          <AlertCircle className="h-4 w-4 text-[var(--destructive)]" />
          <span className="text-footnote text-[var(--destructive)]">{errors.general}</span>
        </div>
      )}

      {/* Staff list */}
      <div className="space-y-4">
        {staff.map((member, index) => (
          <div
            key={index}
            className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-warm-sm"
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-footnote font-medium text-[var(--muted-foreground)]">
                Employee {index + 1}
              </span>
              {staff.length > 1 && (
                <button
                  onClick={() => removeMember(index)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--muted-foreground)] transition-colors hover:bg-[var(--error-bg)] hover:text-[var(--destructive)]"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* First Name */}
              <div>
                <input
                  type="text"
                  value={member.first_name}
                  onChange={(e) => updateMember(index, 'first_name', e.target.value)}
                  placeholder="First name"
                  className={cn(
                    'w-full rounded-xl border bg-[var(--background)] px-4 py-3 text-body text-[var(--foreground)] shadow-warm-sm placeholder:text-[var(--muted-foreground)]',
                    'focus:shadow-warm-md focus:outline-none focus:ring-2 focus:ring-[var(--ring)]',
                    errors[`${index}_first_name`] ? 'border-[var(--destructive)]' : 'border-[var(--border)]'
                  )}
                />
                {errors[`${index}_first_name`] && (
                  <p className="mt-1 text-caption-1 text-[var(--destructive)]">{errors[`${index}_first_name`]}</p>
                )}
              </div>

              {/* Last Name */}
              <div>
                <input
                  type="text"
                  value={member.last_name}
                  onChange={(e) => updateMember(index, 'last_name', e.target.value)}
                  placeholder="Last name"
                  className={cn(
                    'w-full rounded-xl border bg-[var(--background)] px-4 py-3 text-body text-[var(--foreground)] shadow-warm-sm placeholder:text-[var(--muted-foreground)]',
                    'focus:shadow-warm-md focus:outline-none focus:ring-2 focus:ring-[var(--ring)]',
                    errors[`${index}_last_name`] ? 'border-[var(--destructive)]' : 'border-[var(--border)]'
                  )}
                />
                {errors[`${index}_last_name`] && (
                  <p className="mt-1 text-caption-1 text-[var(--destructive)]">{errors[`${index}_last_name`]}</p>
                )}
              </div>

              {/* Role */}
              <div>
                <select
                  value={member.role}
                  onChange={(e) => updateMember(index, 'role', e.target.value)}
                  className={cn(
                    'w-full rounded-xl border bg-[var(--background)] px-4 py-3 text-body text-[var(--foreground)] shadow-warm-sm',
                    'focus:shadow-warm-md focus:outline-none focus:ring-2 focus:ring-[var(--ring)]',
                    errors[`${index}_role`] ? 'border-[var(--destructive)]' : 'border-[var(--border)]'
                  )}
                >
                  <option value="">Select role</option>
                  {ROLES.map((role) => (
                    <option key={role.value} value={role.value}>{role.label}</option>
                  ))}
                </select>
                {errors[`${index}_role`] && (
                  <p className="mt-1 text-caption-1 text-[var(--destructive)]">{errors[`${index}_role`]}</p>
                )}
              </div>

              {/* PIN */}
              <div>
                <input
                  type="text"
                  inputMode="numeric"
                  value={member.pin}
                  onChange={(e) => updateMember(index, 'pin', e.target.value.replace(/\D/g, '').slice(0, 8))}
                  placeholder="4-digit PIN"
                  maxLength={8}
                  className={cn(
                    'w-full rounded-xl border bg-[var(--background)] px-4 py-3 text-body tabular-nums text-[var(--foreground)] shadow-warm-sm placeholder:text-[var(--muted-foreground)]',
                    'focus:shadow-warm-md focus:outline-none focus:ring-2 focus:ring-[var(--ring)]',
                    errors[`${index}_pin`] ? 'border-[var(--destructive)]' : 'border-[var(--border)]'
                  )}
                />
                {errors[`${index}_pin`] && (
                  <p className="mt-1 text-caption-1 text-[var(--destructive)]">{errors[`${index}_pin`]}</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add more */}
      <button
        onClick={addMember}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[var(--border)] py-4 text-callout text-[var(--muted-foreground)] transition-colors btn-press hover:border-[var(--primary)] hover:text-[var(--primary)]"
      >
        <Plus className="h-4 w-4" />
        Add another employee
      </button>

      {/* Continue */}
      <div className="flex justify-end pt-4">
        <Button
          onClick={handleSubmit}
          className="h-12 min-w-[160px] rounded-xl bg-[var(--primary)] px-8 text-callout font-semibold text-white shadow-warm-md transition-all hover:bg-[var(--primary-hover)] active:scale-[0.97]"
        >
          Continue
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
