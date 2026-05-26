'use client'

import { useCallback, useMemo, useState } from 'react'
import { ArrowRight, Check, HelpCircle, RotateCcw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FIRST_ORDER_TOUR_STEPS, TOUR_STORAGE_KEY, type OnboardingTourStep } from '@/lib/onboarding/tour'
import { cn } from '@/lib/utils'

interface TourProps {
  steps?: OnboardingTourStep[]
  onComplete?: () => void
  replay?: boolean
}

export function Tour({ steps = FIRST_ORDER_TOUR_STEPS, onComplete, replay = false }: TourProps) {
  const [index, setIndex] = useState(0)
  const [dismissed, setDismissed] = useState(false)
  const current = steps[index]
  const percent = useMemo(() => Math.round(((index + 1) / steps.length) * 100), [index, steps.length])

  const finish = useCallback(() => {
    try {
      window.localStorage.setItem(TOUR_STORAGE_KEY, 'true')
    } catch {
      // Browser storage is optional; server progress still records completion.
    }
    onComplete?.()
    setDismissed(true)
  }, [onComplete])

  const reset = useCallback(() => {
    setDismissed(false)
    setIndex(0)
  }, [])

  if (dismissed) {
    return (
      <Button type="button" variant="outline" className="h-11 rounded-xl" onClick={reset}>
        <RotateCcw className="h-4 w-4" />
        Replay first-order tour
      </Button>
    )
  }

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-warm-md">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)]">
            <HelpCircle className="h-5 w-5 text-[var(--primary)]" />
          </div>
          <div>
            <p className="text-caption-1 font-semibold uppercase text-[var(--muted-foreground)]">
              First-order tour
            </p>
            <h2 className="text-title-3 font-semibold text-[var(--foreground)]">{current.title}</h2>
          </div>
        </div>
        {replay && (
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-xl text-[var(--muted-foreground)] transition-colors hover:bg-[var(--secondary)] hover:text-[var(--foreground)]"
            onClick={() => setDismissed(true)}
            aria-label="Close tour"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <p className="text-body text-[var(--muted-foreground)]">{current.body}</p>

      <div className="mt-5 rounded-xl bg-[var(--secondary)] p-4">
        <div className="flex items-center justify-between text-footnote">
          <span className="font-medium text-[var(--foreground)]">Step {index + 1} of {steps.length}</span>
          <span className="text-[var(--muted-foreground)]">{percent}%</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--muted)]">
          <div className="h-full rounded-full bg-[var(--primary)] transition-all" style={{ width: `${percent}%` }} />
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          className={cn('h-11 rounded-xl', index === 0 && 'opacity-40')}
          disabled={index === 0}
          onClick={() => setIndex((value) => Math.max(0, value - 1))}
        >
          Back
        </Button>
        {index < steps.length - 1 ? (
          <Button type="button" className="h-11 rounded-xl" onClick={() => setIndex((value) => value + 1)}>
            Next
            <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button type="button" className="h-11 rounded-xl" onClick={finish}>
            <Check className="h-4 w-4" />
            Mark tour complete
          </Button>
        )}
      </div>
    </section>
  )
}
