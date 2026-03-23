'use client'

import { useState, useCallback, useEffect } from 'react'
import { Receipt, Search, Check, ChevronRight, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { lookupTaxRates, type TaxRates } from '@/lib/setup/tax-lookup'
import type { StepComponentProps } from './SetupWizard'

interface TaxFormData {
  food_rate: string
  alcohol_rate: string
  takeout_rate: string
  zip_code: string
  state: string
}

export function StepTaxRates({ onNext, progress }: StepComponentProps) {
  const saved = (progress.data.step_2 ?? {}) as Partial<TaxFormData>
  const restaurantZip = (progress.data.step_0 as Record<string, string> | undefined)?.zip ?? ''

  const [form, setForm] = useState<TaxFormData>({
    food_rate: saved.food_rate ?? '',
    alcohol_rate: saved.alcohol_rate ?? '',
    takeout_rate: saved.takeout_rate ?? '',
    zip_code: saved.zip_code ?? restaurantZip,
    state: saved.state ?? '',
  })
  const [lookupResult, setLookupResult] = useState<TaxRates | null>(null)
  const [isLooking, setIsLooking] = useState(false)
  const [applied, setApplied] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Auto-lookup on mount if we have a zip
  useEffect(() => {
    if (form.zip_code && form.zip_code.length >= 5 && !form.food_rate) {
      handleLookup()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleLookup = useCallback(() => {
    if (form.zip_code.length < 5) {
      setErrors({ zip_code: 'Enter a valid 5-digit zip code' })
      return
    }
    setIsLooking(true)
    // Simulate brief delay for UX feel
    setTimeout(() => {
      const result = lookupTaxRates(form.zip_code)
      setLookupResult(result)
      if (result) {
        setForm((prev) => ({
          ...prev,
          food_rate: result.foodRate.toString(),
          alcohol_rate: result.alcoholRate.toString(),
          takeout_rate: result.takeoutRate.toString(),
          state: result.state,
        }))
        setApplied(true)
      }
      setIsLooking(false)
    }, 300)
  }, [form.zip_code])

  const handleSubmit = useCallback(() => {
    const newErrors: Record<string, string> = {}
    const food = parseFloat(form.food_rate)
    const alcohol = parseFloat(form.alcohol_rate)
    const takeout = parseFloat(form.takeout_rate)

    if (isNaN(food) || food < 0 || food > 30) {
      newErrors.food_rate = 'Enter a valid food tax rate (0-30%)'
    }
    if (isNaN(alcohol) || alcohol < 0 || alcohol > 30) {
      newErrors.alcohol_rate = 'Enter a valid alcohol tax rate (0-30%)'
    }
    if (isNaN(takeout) || takeout < 0 || takeout > 30) {
      newErrors.takeout_rate = 'Enter a valid takeout tax rate (0-30%)'
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    onNext({
      food_rate: form.food_rate,
      alcohol_rate: form.alcohol_rate,
      takeout_rate: form.takeout_rate,
      zip_code: form.zip_code,
      state: form.state,
    })
  }, [form, onNext])

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--accent)]">
          <Receipt className="h-8 w-8 text-[var(--primary)]" />
        </div>
        <h1 className="text-title-1 font-semibold text-[var(--foreground)]">
          Configure tax rates
        </h1>
        <p className="mt-2 text-body text-[var(--muted-foreground)]">
          Enter your zip code and we will look up the tax rates for your area.
        </p>
      </div>

      {/* Zip Code Lookup */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-warm-sm">
        <label className="mb-1.5 block text-subhead font-medium text-[var(--foreground)]">
          Look up by Zip Code
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={form.zip_code}
            onChange={(e) => {
              setForm((prev) => ({ ...prev, zip_code: e.target.value.replace(/\D/g, '').slice(0, 5) }))
              setApplied(false)
              setErrors((prev) => { const next = { ...prev }; delete next.zip_code; return next })
            }}
            placeholder="Enter zip code"
            maxLength={5}
            className={cn(
              'flex-1 rounded-xl border bg-[var(--card)] px-4 py-3 text-body text-[var(--foreground)] shadow-warm-sm transition-shadow placeholder:text-[var(--muted-foreground)]',
              'focus:shadow-warm-md focus:outline-none focus:ring-2 focus:ring-[var(--ring)]',
              errors.zip_code ? 'border-[var(--destructive)]' : 'border-[var(--border)]'
            )}
          />
          <Button
            onClick={handleLookup}
            disabled={isLooking || form.zip_code.length < 5}
            className="h-12 rounded-xl px-6"
          >
            {isLooking ? (
              <span className="animate-pulse">Searching...</span>
            ) : (
              <>
                <Search className="mr-1.5 h-4 w-4" />
                Look Up
              </>
            )}
          </Button>
        </div>
        {errors.zip_code && (
          <p className="mt-1 text-footnote text-[var(--destructive)]">{errors.zip_code}</p>
        )}
        {lookupResult && applied && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-[var(--success-bg)] px-4 py-2.5">
            <Check className="h-4 w-4 text-[var(--success)]" />
            <span className="text-footnote text-[var(--success)]">
              Found rates for {lookupResult.stateName}
              {lookupResult.source === 'state_average' ? ' (state average)' : ''}.
              Review and adjust below.
            </span>
          </div>
        )}
        {lookupResult === null && form.zip_code.length >= 5 && !isLooking && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-[var(--warning-bg)] px-4 py-2.5">
            <AlertCircle className="h-4 w-4 text-[var(--warning)]" />
            <span className="text-footnote text-[var(--warning)]">
              Could not find rates for this zip code. Enter rates manually below.
            </span>
          </div>
        )}
      </div>

      {/* Tax Rate Inputs */}
      <div className="space-y-5">
        <div>
          <label className="mb-1.5 block text-subhead font-medium text-[var(--foreground)]">
            Food Tax Rate (%)
          </label>
          <div className="relative">
            <input
              type="number"
              step="0.001"
              min="0"
              max="30"
              value={form.food_rate}
              onChange={(e) => {
                setForm((prev) => ({ ...prev, food_rate: e.target.value }))
                setErrors((prev) => { const next = { ...prev }; delete next.food_rate; return next })
              }}
              placeholder="8.875"
              className={cn(
                'w-full rounded-xl border bg-[var(--card)] px-4 py-3 pr-10 text-body text-[var(--foreground)] shadow-warm-sm transition-shadow placeholder:text-[var(--muted-foreground)]',
                'focus:shadow-warm-md focus:outline-none focus:ring-2 focus:ring-[var(--ring)]',
                errors.food_rate ? 'border-[var(--destructive)]' : 'border-[var(--border)]'
              )}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-callout text-[var(--muted-foreground)]">%</span>
          </div>
          {errors.food_rate && (
            <p className="mt-1 text-footnote text-[var(--destructive)]">{errors.food_rate}</p>
          )}
        </div>

        <div>
          <label className="mb-1.5 block text-subhead font-medium text-[var(--foreground)]">
            Alcohol Tax Rate (%)
          </label>
          <div className="relative">
            <input
              type="number"
              step="0.001"
              min="0"
              max="30"
              value={form.alcohol_rate}
              onChange={(e) => {
                setForm((prev) => ({ ...prev, alcohol_rate: e.target.value }))
                setErrors((prev) => { const next = { ...prev }; delete next.alcohol_rate; return next })
              }}
              placeholder="8.875"
              className={cn(
                'w-full rounded-xl border bg-[var(--card)] px-4 py-3 pr-10 text-body text-[var(--foreground)] shadow-warm-sm transition-shadow placeholder:text-[var(--muted-foreground)]',
                'focus:shadow-warm-md focus:outline-none focus:ring-2 focus:ring-[var(--ring)]',
                errors.alcohol_rate ? 'border-[var(--destructive)]' : 'border-[var(--border)]'
              )}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-callout text-[var(--muted-foreground)]">%</span>
          </div>
          {errors.alcohol_rate && (
            <p className="mt-1 text-footnote text-[var(--destructive)]">{errors.alcohol_rate}</p>
          )}
        </div>

        <div>
          <label className="mb-1.5 block text-subhead font-medium text-[var(--foreground)]">
            Takeout Tax Rate (%)
          </label>
          <div className="relative">
            <input
              type="number"
              step="0.001"
              min="0"
              max="30"
              value={form.takeout_rate}
              onChange={(e) => {
                setForm((prev) => ({ ...prev, takeout_rate: e.target.value }))
                setErrors((prev) => { const next = { ...prev }; delete next.takeout_rate; return next })
              }}
              placeholder="8.875"
              className={cn(
                'w-full rounded-xl border bg-[var(--card)] px-4 py-3 pr-10 text-body text-[var(--foreground)] shadow-warm-sm transition-shadow placeholder:text-[var(--muted-foreground)]',
                'focus:shadow-warm-md focus:outline-none focus:ring-2 focus:ring-[var(--ring)]',
                errors.takeout_rate ? 'border-[var(--destructive)]' : 'border-[var(--border)]'
              )}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-callout text-[var(--muted-foreground)]">%</span>
          </div>
          {errors.takeout_rate && (
            <p className="mt-1 text-footnote text-[var(--destructive)]">{errors.takeout_rate}</p>
          )}
          <p className="mt-1 text-footnote text-[var(--muted-foreground)]">
            Set to 0 if takeout is not taxable in your state.
          </p>
        </div>
      </div>

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
