'use client'

import { useState, useCallback } from 'react'
import { LayoutGrid, Check, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { FLOOR_PLAN_TEMPLATES, type FloorPlanTemplate } from '@/lib/setup/demo-data'
import type { StepComponentProps } from './SetupWizard'

export function StepFloorPlan({ onNext }: StepComponentProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<FloorPlanTemplate | null>(null)

  const handleSubmit = useCallback(() => {
    if (!selectedTemplate) return
    onNext({
      template: selectedTemplate.name,
      sections: selectedTemplate.sections,
      tables: selectedTemplate.tables,
    })
  }, [selectedTemplate, onNext])

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--accent)]">
          <LayoutGrid className="h-8 w-8 text-[var(--primary)]" />
        </div>
        <h1 className="text-title-1 font-semibold text-[var(--foreground)]">
          Choose a floor plan
        </h1>
        <p className="mt-2 text-body text-[var(--muted-foreground)]">
          Pick a template that matches your restaurant. You can customize tables later.
        </p>
      </div>

      {/* Templates grid */}
      <div className="grid gap-4 sm:grid-cols-2">
        {FLOOR_PLAN_TEMPLATES.map((template) => {
          const isSelected = selectedTemplate?.name === template.name
          return (
            <button
              key={template.name}
              onClick={() => setSelectedTemplate(template)}
              className={cn(
                'relative rounded-2xl border-2 p-5 text-left transition-all btn-press',
                isSelected
                  ? 'border-[var(--primary)] bg-[var(--accent)] shadow-warm-md'
                  : 'border-[var(--border)] bg-[var(--card)] shadow-warm-sm hover:shadow-warm-md hover:border-[var(--border-hover)]'
              )}
            >
              {isSelected && (
                <div className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--primary)]">
                  <Check className="h-3.5 w-3.5 text-white" />
                </div>
              )}

              {/* Floor plan preview */}
              <div className="mb-4 h-32 rounded-xl bg-[var(--secondary)] p-3 overflow-hidden">
                <div className="relative h-full w-full">
                  {template.tables.slice(0, 8).map((table, i) => {
                    // Scale positions to fit preview
                    const scaleX = 100 / 600
                    const scaleY = 100 / 500
                    return (
                      <div
                        key={i}
                        className={cn(
                          'absolute bg-[var(--primary)] opacity-40',
                          table.shape === 'round' ? 'rounded-full' : 'rounded-md'
                        )}
                        style={{
                          left: `${table.x * scaleX}%`,
                          top: `${table.y * scaleY}%`,
                          width: table.shape === 'rectangle' ? '16%' : '10%',
                          height: table.shape === 'rectangle' ? '10%' : '10%',
                        }}
                      />
                    )
                  })}
                  {template.tables.length === 0 && (
                    <div className="flex h-full items-center justify-center">
                      <span className="text-footnote text-[var(--muted-foreground)]">No tables needed</span>
                    </div>
                  )}
                </div>
              </div>

              <h3 className="text-headline text-[var(--foreground)]">{template.name}</h3>
              <p className="mt-1 text-footnote text-[var(--muted-foreground)]">
                {template.description}
              </p>
              <div className="mt-2 flex gap-2">
                {template.sections.map((section) => (
                  <span
                    key={section}
                    className="rounded-full bg-[var(--secondary)] px-2 py-0.5 text-caption-2 text-[var(--secondary-foreground)]"
                  >
                    {section}
                  </span>
                ))}
                {template.total_seats > 0 && (
                  <span className="rounded-full bg-[var(--secondary)] px-2 py-0.5 text-caption-2 text-[var(--secondary-foreground)]">
                    {template.total_seats} seats
                  </span>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* Continue */}
      <div className="flex justify-end pt-4">
        <Button
          onClick={handleSubmit}
          disabled={!selectedTemplate}
          className={cn(
            'h-12 min-w-[160px] rounded-xl px-8 text-callout font-semibold shadow-warm-md transition-all active:scale-[0.97]',
            selectedTemplate
              ? 'bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)]'
              : 'bg-[var(--muted)] text-[var(--muted-foreground)]'
          )}
        >
          Continue
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
