'use client'

import { useEffect, useState } from 'react'
import { Check, Flame, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import type { SetupProgress } from './SetupWizard'

interface StepCompleteProps {
  progress: SetupProgress
}

const STEP_NAMES = [
  'Restaurant Details',
  'Location',
  'Tax Rates',
  'Menu',
  'Floor Plan',
  'Staff',
  'Hardware',
]

export function StepComplete({ progress }: StepCompleteProps) {
  const [showConfetti, setShowConfetti] = useState(false)

  useEffect(() => {
    // Trigger celebration animation
    const timer = setTimeout(() => setShowConfetti(true), 300)
    return () => clearTimeout(timer)
  }, [])

  const completedCount = progress.completed_steps.filter((s) => s < 7).length
  const skippedSteps = STEP_NAMES.filter((_, i) => !progress.completed_steps.includes(i))

  return (
    <div className="space-y-8 py-8 text-center">
      {/* Celebration icon */}
      <div className={cn(
        'mx-auto flex h-24 w-24 items-center justify-center rounded-3xl bg-[var(--success-bg)] transition-all duration-700',
        showConfetti ? 'scale-100 opacity-100' : 'scale-50 opacity-0'
      )} style={{ transitionTimingFunction: 'var(--ease-spring)' }}>
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--success)]">
          <Check className="h-10 w-10 text-white" strokeWidth={3} />
        </div>
      </div>

      {/* Title */}
      <div className={cn(
        'transition-all duration-700 delay-200',
        showConfetti ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
      )} style={{ transitionTimingFunction: 'var(--ease-spring)' }}>
        <h1 className="text-large-title font-bold text-[var(--foreground)]">
          Your restaurant is ready!
        </h1>
        <p className="mt-2 text-body text-[var(--muted-foreground)]">
          You completed {completedCount} of 7 setup steps. You can always finish the rest from Settings.
        </p>
      </div>

      {/* Summary */}
      <div className={cn(
        'mx-auto max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 text-left shadow-warm-md transition-all duration-700 delay-400',
        showConfetti ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
      )} style={{ transitionTimingFunction: 'var(--ease-spring)' }}>
        <div className="flex items-center gap-2 mb-4">
          <Flame className="h-5 w-5 text-[var(--primary)]" />
          <span className="text-headline text-[var(--foreground)]">Setup Summary</span>
        </div>
        <div className="space-y-2">
          {STEP_NAMES.map((name, i) => {
            const completed = progress.completed_steps.includes(i)
            return (
              <div key={i} className="flex items-center gap-2.5">
                <div className={cn(
                  'flex h-5 w-5 items-center justify-center rounded-full',
                  completed ? 'bg-[var(--success)]' : 'bg-[var(--muted)]'
                )}>
                  {completed ? (
                    <Check className="h-3 w-3 text-white" />
                  ) : (
                    <span className="h-1.5 w-1.5 rounded-full bg-[var(--muted-foreground)]" />
                  )}
                </div>
                <span className={cn(
                  'text-callout',
                  completed ? 'text-[var(--foreground)]' : 'text-[var(--muted-foreground)]'
                )}>
                  {name}
                  {!completed && <span className="ml-1 text-footnote">(skipped)</span>}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {skippedSteps.length > 0 && (
        <p className={cn(
          'text-footnote text-[var(--muted-foreground)] transition-all duration-700 delay-500',
          showConfetti ? 'opacity-100' : 'opacity-0'
        )}>
          You can complete skipped steps anytime from Settings.
        </p>
      )}

      {/* CTA Buttons */}
      <div className={cn(
        'flex flex-col items-center gap-3 transition-all duration-700 delay-600',
        showConfetti ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
      )} style={{ transitionTimingFunction: 'var(--ease-spring)' }}>
        <a
          href="/pos"
          className="inline-flex h-14 min-w-[240px] items-center justify-center rounded-2xl bg-[var(--primary)] px-10 text-headline font-semibold text-white shadow-warm-lg transition-all btn-press hover:bg-[var(--primary-hover)] active:scale-[0.97]"
        >
          Open POS
          <ArrowRight className="ml-2 h-5 w-5" />
        </a>
        <a
          href="/backoffice"
          className="inline-flex h-12 min-w-[240px] items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--card)] px-8 text-callout font-medium text-[var(--foreground)] shadow-warm-sm transition-all btn-press hover:bg-[var(--secondary)]"
        >
          Explore Back-Office
        </a>
      </div>
    </div>
  )
}
