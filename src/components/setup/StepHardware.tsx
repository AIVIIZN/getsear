'use client'

import { useState, useCallback } from 'react'
import { Printer, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { HardwareSubWizard } from './HardwareSubWizard'
import type { StepComponentProps } from './SetupWizard'

export function StepHardware({ onNext }: StepComponentProps) {
  const [hasPrinters, setHasPrinters] = useState<boolean | null>(null)
  const [showSubWizard, setShowSubWizard] = useState(false)

  const handleNo = useCallback(() => {
    onNext({ has_hardware: false })
  }, [onNext])

  const handleSubWizardComplete = useCallback(() => {
    onNext({ has_hardware: true })
  }, [onNext])

  if (showSubWizard) {
    return (
      <HardwareSubWizard
        onComplete={handleSubWizardComplete}
        onBack={() => setShowSubWizard(false)}
      />
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--accent)]">
          <Printer className="h-8 w-8 text-[var(--primary)]" />
        </div>
        <h1 className="text-title-1 font-semibold text-[var(--foreground)]">
          Hardware setup
        </h1>
        <p className="mt-2 text-body text-[var(--muted-foreground)]">
          Do you have printers and payment terminals ready to connect?
        </p>
      </div>

      {/* Yes/No options */}
      <div className="grid gap-4 sm:grid-cols-2">
        <button
          onClick={() => {
            setHasPrinters(true)
            setShowSubWizard(true)
          }}
          className={cn(
            'group rounded-2xl border-2 p-6 text-center transition-all btn-press',
            hasPrinters === true
              ? 'border-[var(--primary)] bg-[var(--accent)] shadow-warm-md'
              : 'border-[var(--border)] bg-[var(--card)] shadow-warm-sm hover:shadow-warm-md hover:border-[var(--border-hover)]'
          )}
        >
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--success-bg)]">
            <Printer className="h-7 w-7 text-[var(--success)]" />
          </div>
          <h3 className="text-headline text-[var(--foreground)]">Yes, let&apos;s set them up</h3>
          <p className="mt-1 text-footnote text-[var(--muted-foreground)]">
            I have receipt printers and/or payment terminals ready to connect.
          </p>
        </button>

        <button
          onClick={handleNo}
          className={cn(
            'group rounded-2xl border-2 p-6 text-center transition-all btn-press',
            hasPrinters === false
              ? 'border-[var(--primary)] bg-[var(--accent)] shadow-warm-md'
              : 'border-[var(--border)] bg-[var(--card)] shadow-warm-sm hover:shadow-warm-md hover:border-[var(--border-hover)]'
          )}
        >
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--secondary)]">
            <ChevronRight className="h-7 w-7 text-[var(--muted-foreground)]" />
          </div>
          <h3 className="text-headline text-[var(--foreground)]">Not yet</h3>
          <p className="mt-1 text-footnote text-[var(--muted-foreground)]">
            I will set up hardware later from Settings.
          </p>
        </button>
      </div>

      {/* Info box */}
      <div className="rounded-xl bg-[var(--info-bg)] p-4">
        <p className="text-footnote text-[var(--info)]">
          Sear POS works with standard receipt printers (Star Micronics, Epson) and Valor payment terminals.
          No proprietary hardware required. You can set this up at any time from Settings.
        </p>
      </div>
    </div>
  )
}
