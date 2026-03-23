'use client'

import { ChevronRight, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TutorialTooltipProps {
  title: string
  body: string
  stepNumber: number
  totalSteps: number
  placement: 'top' | 'bottom' | 'left' | 'right'
  position: { top: number; left: number }
  onNext: () => void
  onSkip: () => void
  isLast: boolean
}

export function TutorialTooltip({
  title,
  body,
  stepNumber,
  totalSteps,
  placement,
  position,
  onNext,
  onSkip,
  isLast,
}: TutorialTooltipProps) {
  return (
    <div
      className={cn(
        'fixed z-[10001] w-[280px] rounded-2xl bg-[var(--card)] p-4 shadow-warm-xl animate-fade-in',
        'border border-[var(--border)]'
      )}
      style={{
        top: position.top,
        left: position.left,
        animationDuration: '300ms',
        animationTimingFunction: 'var(--ease-spring)',
      }}
    >
      {/* Arrow */}
      <div
        className={cn(
          'absolute h-3 w-3 rotate-45 bg-[var(--card)] border border-[var(--border)]',
          placement === 'top' && 'bottom-[-7px] left-1/2 -translate-x-1/2 border-l-0 border-t-0',
          placement === 'bottom' && 'top-[-7px] left-1/2 -translate-x-1/2 border-b-0 border-r-0',
          placement === 'left' && 'right-[-7px] top-1/2 -translate-y-1/2 border-b-0 border-l-0',
          placement === 'right' && 'left-[-7px] top-1/2 -translate-y-1/2 border-r-0 border-t-0'
        )}
      />

      {/* Step indicator */}
      <div className="mb-2 flex items-center justify-between">
        <span className="text-caption-1 font-medium text-[var(--muted-foreground)]">
          Step {stepNumber} of {totalSteps}
        </span>
        <button
          onClick={onSkip}
          className="flex h-6 w-6 items-center justify-center rounded-full text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)]"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Content */}
      <h3 className="text-headline text-[var(--foreground)]">{title}</h3>
      <p className="mt-1 text-footnote leading-relaxed text-[var(--muted-foreground)]">{body}</p>

      {/* Actions */}
      <div className="mt-3 flex items-center justify-between">
        <button
          onClick={onSkip}
          className="text-footnote text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
        >
          Skip Tutorial
        </button>
        <button
          onClick={onNext}
          className="flex items-center gap-1 rounded-xl bg-[var(--primary)] px-4 py-2 text-footnote font-semibold text-white transition-all btn-press hover:bg-[var(--primary-hover)]"
        >
          {isLast ? 'Finish' : 'Next'}
          {!isLast && <ChevronRight className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  )
}
