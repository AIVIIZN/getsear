'use client'

import { useState, useCallback } from 'react'
import { Building2, Upload, X, ChevronRight } from 'lucide-react'
import { z } from 'zod'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import type { StepComponentProps } from './SetupWizard'

const restaurantSchema = z.object({
  name: z.string().min(1, 'Restaurant name is required').max(200),
  address: z.string().min(1, 'Address is required').max(500),
  city: z.string().min(1, 'City is required').max(100),
  state: z.string().min(2, 'State is required').max(2),
  zip: z.string().min(5, 'Zip code is required').max(10),
  phone: z.string().min(10, 'Phone number is required').max(20),
  timezone: z.string().min(1, 'Timezone is required'),
  cuisine_type: z.string().optional(),
})

type RestaurantData = z.infer<typeof restaurantSchema>

const CUISINE_TYPES = [
  'American', 'Italian', 'Mexican', 'Chinese', 'Japanese', 'Thai',
  'Indian', 'French', 'Mediterranean', 'Korean', 'Vietnamese',
  'Caribbean', 'Southern', 'Seafood', 'Steakhouse', 'Pizza',
  'BBQ', 'Gastropub', 'Farm-to-Table', 'Fusion', 'Other',
]

const US_TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
]

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN',
  'IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH',
  'NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT',
  'VT','VA','WA','WV','WI','WY',
]

export function StepRestaurantDetails({ onNext, progress }: StepComponentProps) {
  const saved = (progress.data.step_0 ?? {}) as Partial<RestaurantData>

  const [form, setForm] = useState<Partial<RestaurantData>>({
    name: saved.name ?? '',
    address: saved.address ?? '',
    city: saved.city ?? '',
    state: saved.state ?? '',
    zip: saved.zip ?? '',
    phone: saved.phone ?? '',
    timezone: saved.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    cuisine_type: saved.cuisine_type ?? '',
  })

  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const updateField = useCallback((field: keyof RestaurantData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => {
      const next = { ...prev }
      delete next[field]
      return next
    })
  }, [])

  const handleLogoUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      setLogoPreview(ev.target?.result as string)
    }
    reader.readAsDataURL(file)
  }, [])

  const handleSubmit = useCallback(() => {
    const result = restaurantSchema.safeParse(form)
    if (!result.success) {
      const fieldErrors: Record<string, string> = {}
      result.error.issues.forEach((issue) => {
        const field = issue.path[0] as string
        fieldErrors[field] = issue.message
      })
      setErrors(fieldErrors)
      return
    }
    onNext(result.data as unknown as Record<string, unknown>)
  }, [form, onNext])

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--accent)]">
          <Building2 className="h-8 w-8 text-[var(--primary)]" />
        </div>
        <h1 className="text-title-1 font-semibold text-[var(--foreground)]">
          Tell us about your restaurant
        </h1>
        <p className="mt-2 text-body text-[var(--muted-foreground)]">
          This information helps us set up your POS system.
        </p>
      </div>

      {/* Form */}
      <div className="space-y-5">
        {/* Logo Upload */}
        <div className="flex justify-center">
          <label className="group relative cursor-pointer">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleLogoUpload}
            />
            {logoPreview ? (
              <div className="relative">
                <img
                  src={logoPreview}
                  alt="Logo preview"
                  className="h-24 w-24 rounded-2xl object-cover shadow-warm-md"
                />
                <button
                  onClick={(e) => {
                    e.preventDefault()
                    setLogoPreview(null)
                  }}
                  className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--destructive)] text-white shadow-warm-sm"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex h-24 w-24 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[var(--border)] bg-[var(--secondary)] transition-colors group-hover:border-[var(--primary)]">
                <Upload className="h-6 w-6 text-[var(--muted-foreground)]" />
                <span className="mt-1 text-caption-1 text-[var(--muted-foreground)]">Logo</span>
              </div>
            )}
          </label>
        </div>

        {/* Restaurant Name */}
        <div>
          <label className="mb-1.5 block text-subhead font-medium text-[var(--foreground)]">
            Restaurant Name <span className="text-[var(--destructive)]">*</span>
          </label>
          <input
            type="text"
            value={form.name ?? ''}
            onChange={(e) => updateField('name', e.target.value)}
            placeholder="e.g. The Ember Grill"
            className={cn(
              'w-full rounded-xl border bg-[var(--card)] px-4 py-3 text-body text-[var(--foreground)] shadow-warm-sm transition-shadow placeholder:text-[var(--muted-foreground)]',
              'focus:shadow-warm-md focus:outline-none focus:ring-2 focus:ring-[var(--ring)]',
              errors.name ? 'border-[var(--destructive)]' : 'border-[var(--border)]'
            )}
          />
          {errors.name && (
            <p className="mt-1 text-footnote text-[var(--destructive)]">{errors.name}</p>
          )}
        </div>

        {/* Address */}
        <div>
          <label className="mb-1.5 block text-subhead font-medium text-[var(--foreground)]">
            Street Address <span className="text-[var(--destructive)]">*</span>
          </label>
          <input
            type="text"
            value={form.address ?? ''}
            onChange={(e) => updateField('address', e.target.value)}
            placeholder="123 Main Street"
            className={cn(
              'w-full rounded-xl border bg-[var(--card)] px-4 py-3 text-body text-[var(--foreground)] shadow-warm-sm transition-shadow placeholder:text-[var(--muted-foreground)]',
              'focus:shadow-warm-md focus:outline-none focus:ring-2 focus:ring-[var(--ring)]',
              errors.address ? 'border-[var(--destructive)]' : 'border-[var(--border)]'
            )}
          />
          {errors.address && (
            <p className="mt-1 text-footnote text-[var(--destructive)]">{errors.address}</p>
          )}
        </div>

        {/* City, State, Zip */}
        <div className="grid grid-cols-6 gap-3">
          <div className="col-span-3">
            <label className="mb-1.5 block text-subhead font-medium text-[var(--foreground)]">
              City <span className="text-[var(--destructive)]">*</span>
            </label>
            <input
              type="text"
              value={form.city ?? ''}
              onChange={(e) => updateField('city', e.target.value)}
              placeholder="New York"
              className={cn(
                'w-full rounded-xl border bg-[var(--card)] px-4 py-3 text-body text-[var(--foreground)] shadow-warm-sm transition-shadow placeholder:text-[var(--muted-foreground)]',
                'focus:shadow-warm-md focus:outline-none focus:ring-2 focus:ring-[var(--ring)]',
                errors.city ? 'border-[var(--destructive)]' : 'border-[var(--border)]'
              )}
            />
            {errors.city && (
              <p className="mt-1 text-footnote text-[var(--destructive)]">{errors.city}</p>
            )}
          </div>
          <div className="col-span-1">
            <label className="mb-1.5 block text-subhead font-medium text-[var(--foreground)]">
              State <span className="text-[var(--destructive)]">*</span>
            </label>
            <select
              value={form.state ?? ''}
              onChange={(e) => updateField('state', e.target.value)}
              className={cn(
                'w-full rounded-xl border bg-[var(--card)] px-3 py-3 text-body text-[var(--foreground)] shadow-warm-sm transition-shadow',
                'focus:shadow-warm-md focus:outline-none focus:ring-2 focus:ring-[var(--ring)]',
                errors.state ? 'border-[var(--destructive)]' : 'border-[var(--border)]'
              )}
            >
              <option value="">--</option>
              {US_STATES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="col-span-2">
            <label className="mb-1.5 block text-subhead font-medium text-[var(--foreground)]">
              Zip Code <span className="text-[var(--destructive)]">*</span>
            </label>
            <input
              type="text"
              value={form.zip ?? ''}
              onChange={(e) => updateField('zip', e.target.value)}
              placeholder="10001"
              maxLength={10}
              className={cn(
                'w-full rounded-xl border bg-[var(--card)] px-4 py-3 text-body text-[var(--foreground)] shadow-warm-sm transition-shadow placeholder:text-[var(--muted-foreground)]',
                'focus:shadow-warm-md focus:outline-none focus:ring-2 focus:ring-[var(--ring)]',
                errors.zip ? 'border-[var(--destructive)]' : 'border-[var(--border)]'
              )}
            />
            {errors.zip && (
              <p className="mt-1 text-footnote text-[var(--destructive)]">{errors.zip}</p>
            )}
          </div>
        </div>

        {/* Phone */}
        <div>
          <label className="mb-1.5 block text-subhead font-medium text-[var(--foreground)]">
            Phone Number <span className="text-[var(--destructive)]">*</span>
          </label>
          <input
            type="tel"
            value={form.phone ?? ''}
            onChange={(e) => updateField('phone', e.target.value)}
            placeholder="(212) 555-0123"
            className={cn(
              'w-full rounded-xl border bg-[var(--card)] px-4 py-3 text-body text-[var(--foreground)] shadow-warm-sm transition-shadow placeholder:text-[var(--muted-foreground)]',
              'focus:shadow-warm-md focus:outline-none focus:ring-2 focus:ring-[var(--ring)]',
              errors.phone ? 'border-[var(--destructive)]' : 'border-[var(--border)]'
            )}
          />
          {errors.phone && (
            <p className="mt-1 text-footnote text-[var(--destructive)]">{errors.phone}</p>
          )}
        </div>

        {/* Timezone */}
        <div>
          <label className="mb-1.5 block text-subhead font-medium text-[var(--foreground)]">
            Timezone <span className="text-[var(--destructive)]">*</span>
          </label>
          <select
            value={form.timezone ?? ''}
            onChange={(e) => updateField('timezone', e.target.value)}
            className={cn(
              'w-full rounded-xl border bg-[var(--card)] px-4 py-3 text-body text-[var(--foreground)] shadow-warm-sm transition-shadow',
              'focus:shadow-warm-md focus:outline-none focus:ring-2 focus:ring-[var(--ring)]',
              errors.timezone ? 'border-[var(--destructive)]' : 'border-[var(--border)]'
            )}
          >
            {US_TIMEZONES.map((tz) => (
              <option key={tz.value} value={tz.value}>{tz.label}</option>
            ))}
          </select>
        </div>

        {/* Cuisine Type */}
        <div>
          <label className="mb-1.5 block text-subhead font-medium text-[var(--foreground)]">
            Cuisine Type
          </label>
          <div className="flex flex-wrap gap-2">
            {CUISINE_TYPES.map((cuisine) => (
              <button
                key={cuisine}
                onClick={() => updateField('cuisine_type', cuisine)}
                className={cn(
                  'rounded-full px-4 py-2 text-footnote font-medium transition-all btn-press',
                  form.cuisine_type === cuisine
                    ? 'bg-[var(--primary)] text-white shadow-warm-sm'
                    : 'bg-[var(--secondary)] text-[var(--secondary-foreground)] hover:bg-[var(--muted)]'
                )}
              >
                {cuisine}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Continue button */}
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
