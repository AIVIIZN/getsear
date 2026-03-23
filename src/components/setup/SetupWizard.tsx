'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Check, ChevronRight, Flame } from 'lucide-react'
import { cn } from '@/lib/utils'
import { StepRestaurantDetails } from './StepRestaurantDetails'
import { StepLocation } from './StepLocation'
import { StepTaxRates } from './StepTaxRates'
import { StepMenu } from './StepMenu'
import { StepFloorPlan } from './StepFloorPlan'
import { StepStaff } from './StepStaff'
import { StepHardware } from './StepHardware'
import { StepComplete } from './StepComplete'

const STORAGE_KEY = 'sear_setup_progress'

export interface SetupProgress {
  current_step: number
  completed_steps: number[]
  data: Record<string, unknown>
}

interface WizardStep {
  id: number
  label: string
  description: string
}

const WIZARD_STEPS: WizardStep[] = [
  { id: 0, label: 'Restaurant', description: 'Tell us about your restaurant' },
  { id: 1, label: 'Location', description: 'Set up your dining areas' },
  { id: 2, label: 'Tax Rates', description: 'Configure tax rates' },
  { id: 3, label: 'Menu', description: 'Import or build your menu' },
  { id: 4, label: 'Floor Plan', description: 'Set up your tables' },
  { id: 5, label: 'Staff', description: 'Add your team members' },
  { id: 6, label: 'Hardware', description: 'Connect printers & terminals' },
  { id: 7, label: 'All Done', description: 'Your restaurant is ready' },
]

function loadProgress(): SetupProgress {
  if (typeof window === 'undefined') {
    return { current_step: 0, completed_steps: [], data: {} }
  }
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      return JSON.parse(saved) as SetupProgress
    }
  } catch {
    // Ignore parse errors
  }
  return { current_step: 0, completed_steps: [], data: {} }
}

function saveProgress(progress: SetupProgress): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress))
  } catch {
    // Storage full or unavailable
  }
}

export function SetupWizard() {
  const [progress, setProgress] = useState<SetupProgress>(() => loadProgress())
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward')
  const [isAnimating, setIsAnimating] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

  // Persist progress on change
  useEffect(() => {
    saveProgress(progress)
  }, [progress])

  // Also save to API (fire-and-forget)
  useEffect(() => {
    const saveToApi = async () => {
      try {
        await fetch('/api/setup/progress', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(progress),
        })
      } catch {
        // Offline or not authenticated yet — localStorage is primary
      }
    }
    saveToApi()
  }, [progress])

  const goToStep = useCallback((step: number) => {
    if (isAnimating) return
    setDirection(step > progress.current_step ? 'forward' : 'backward')
    setIsAnimating(true)
    setTimeout(() => {
      setProgress((prev) => ({ ...prev, current_step: step }))
      setIsAnimating(false)
    }, 250)
  }, [progress.current_step, isAnimating])

  const completeStep = useCallback((stepId: number, stepData?: Record<string, unknown>) => {
    setProgress((prev) => {
      const completed = prev.completed_steps.includes(stepId)
        ? prev.completed_steps
        : [...prev.completed_steps, stepId]
      const data = stepData
        ? { ...prev.data, [`step_${stepId}`]: stepData }
        : prev.data
      return { ...prev, completed_steps: completed, data }
    })
  }, [])

  const nextStep = useCallback((stepData?: Record<string, unknown>) => {
    const current = progress.current_step
    completeStep(current, stepData)
    if (current < WIZARD_STEPS.length - 1) {
      goToStep(current + 1)
    }
  }, [progress.current_step, completeStep, goToStep])

  const skipStep = useCallback(() => {
    if (progress.current_step < WIZARD_STEPS.length - 1) {
      goToStep(progress.current_step + 1)
    }
  }, [progress.current_step, goToStep])

  const prevStep = useCallback(() => {
    if (progress.current_step > 0) {
      goToStep(progress.current_step - 1)
    }
  }, [progress.current_step, goToStep])

  const updateStepData = useCallback((key: string, value: unknown) => {
    setProgress((prev) => ({
      ...prev,
      data: { ...prev.data, [key]: value },
    }))
  }, [])

  const currentStep = progress.current_step
  const isFinalStep = currentStep === WIZARD_STEPS.length - 1

  const stepProps = {
    onNext: nextStep,
    onSkip: skipStep,
    onPrev: prevStep,
    onComplete: completeStep,
    progress,
    updateData: updateStepData,
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Top bar with logo and progress */}
      {!isFinalStep && (
        <header className="sticky top-0 z-50 flex items-center justify-between border-b border-[var(--border)] bg-[var(--card)] px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--primary)]">
              <Flame className="h-5 w-5 text-white" />
            </div>
            <span className="text-headline text-[var(--foreground)]">Sear POS</span>
          </div>

          {/* Progress indicator */}
          <div className="hidden items-center gap-1 md:flex">
            {WIZARD_STEPS.slice(0, -1).map((step) => {
              const isCompleted = progress.completed_steps.includes(step.id)
              const isCurrent = step.id === currentStep
              return (
                <button
                  key={step.id}
                  onClick={() => goToStep(step.id)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-footnote transition-all',
                    'touch-target btn-press',
                    isCurrent && 'bg-[var(--accent)] text-[var(--accent-foreground)] font-medium',
                    isCompleted && !isCurrent && 'text-[var(--success)]',
                    !isCurrent && !isCompleted && 'text-[var(--muted-foreground)]'
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <span className={cn(
                      'flex h-5 w-5 items-center justify-center rounded-full text-caption-2 font-semibold',
                      isCurrent
                        ? 'bg-[var(--primary)] text-white'
                        : 'bg-[var(--muted)] text-[var(--muted-foreground)]'
                    )}>
                      {step.id + 1}
                    </span>
                  )}
                  <span className="hidden lg:inline">{step.label}</span>
                </button>
              )
            })}
          </div>

          {/* Mobile progress bar */}
          <div className="flex items-center gap-3 md:hidden">
            <span className="text-footnote text-[var(--muted-foreground)]">
              Step {currentStep + 1} of {WIZARD_STEPS.length - 1}
            </span>
            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-[var(--muted)]">
              <div
                className="h-full rounded-full bg-[var(--primary)] transition-all duration-300"
                style={{ width: `${((currentStep + 1) / (WIZARD_STEPS.length - 1)) * 100}%` }}
              />
            </div>
          </div>
        </header>
      )}

      {/* Step content */}
      <main className="flex flex-1 items-start justify-center px-4 py-8 md:px-8 md:py-12">
        <div
          ref={contentRef}
          className={cn(
            'w-full max-w-2xl transition-all duration-250',
            isAnimating && direction === 'forward' && 'translate-x-8 opacity-0',
            isAnimating && direction === 'backward' && '-translate-x-8 opacity-0',
            !isAnimating && 'translate-x-0 opacity-100'
          )}
          style={{ transitionTimingFunction: 'var(--ease-spring)' }}
        >
          {currentStep === 0 && <StepRestaurantDetails {...stepProps} />}
          {currentStep === 1 && <StepLocation {...stepProps} />}
          {currentStep === 2 && <StepTaxRates {...stepProps} />}
          {currentStep === 3 && <StepMenu {...stepProps} />}
          {currentStep === 4 && <StepFloorPlan {...stepProps} />}
          {currentStep === 5 && <StepStaff {...stepProps} />}
          {currentStep === 6 && <StepHardware {...stepProps} />}
          {currentStep === 7 && <StepComplete progress={progress} />}
        </div>
      </main>

      {/* Bottom navigation (not on final step) */}
      {!isFinalStep && (
        <footer className="sticky bottom-0 border-t border-[var(--border)] bg-[var(--card)] px-6 py-4">
          <div className="mx-auto flex max-w-2xl items-center justify-between">
            <button
              onClick={prevStep}
              disabled={currentStep === 0}
              className={cn(
                'rounded-xl px-5 py-3 text-callout font-medium transition-colors touch-target-lg btn-press',
                currentStep === 0
                  ? 'text-[var(--muted-foreground)] opacity-50'
                  : 'text-[var(--foreground)] hover:bg-[var(--secondary)]'
              )}
            >
              Back
            </button>
            <button
              onClick={skipStep}
              className="rounded-xl px-5 py-3 text-callout text-[var(--muted-foreground)] transition-colors touch-target-lg btn-press hover:text-[var(--foreground)]"
            >
              Complete later
            </button>
          </div>
        </footer>
      )}
    </div>
  )
}

export type StepComponentProps = {
  onNext: (data?: Record<string, unknown>) => void
  onSkip: () => void
  onPrev: () => void
  onComplete: (stepId: number, data?: Record<string, unknown>) => void
  progress: SetupProgress
  updateData: (key: string, value: unknown) => void
}
