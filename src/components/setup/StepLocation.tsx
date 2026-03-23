'use client'

import { useState, useCallback } from 'react'
import { MapPin, Plus, X, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import type { StepComponentProps } from './SetupWizard'

const DEFAULT_SECTIONS = ['Dining Room', 'Bar', 'Patio']
const SECTION_SUGGESTIONS = ['Dining Room', 'Bar', 'Patio', 'Private Dining', 'Outdoor', 'Lounge', 'Counter', 'Rooftop']

interface LocationData {
  location_name: string
  sections: string[]
}

export function StepLocation({ onNext, progress }: StepComponentProps) {
  const saved = (progress.data.step_1 ?? {}) as Partial<LocationData>
  const restaurantName = ((progress.data.step_0 as Record<string, string> | undefined)?.name) ?? 'Main Location'

  const [locationName, setLocationName] = useState(saved.location_name ?? restaurantName)
  const [sections, setSections] = useState<string[]>(saved.sections ?? DEFAULT_SECTIONS)
  const [newSection, setNewSection] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const addSection = useCallback((name: string) => {
    const trimmed = name.trim()
    if (!trimmed || sections.includes(trimmed)) return
    setSections((prev) => [...prev, trimmed])
    setNewSection('')
  }, [sections])

  const removeSection = useCallback((name: string) => {
    setSections((prev) => prev.filter((s) => s !== name))
  }, [])

  const handleSubmit = useCallback(() => {
    const newErrors: Record<string, string> = {}
    if (!locationName.trim()) {
      newErrors.location_name = 'Location name is required'
    }
    if (sections.length === 0) {
      newErrors.sections = 'Add at least one dining section'
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    onNext({
      location_name: locationName.trim(),
      sections,
    })
  }, [locationName, sections, onNext])

  const availableSuggestions = SECTION_SUGGESTIONS.filter((s) => !sections.includes(s))

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--accent)]">
          <MapPin className="h-8 w-8 text-[var(--primary)]" />
        </div>
        <h1 className="text-title-1 font-semibold text-[var(--foreground)]">
          Set up your location
        </h1>
        <p className="mt-2 text-body text-[var(--muted-foreground)]">
          Define your dining areas. You can add more sections later.
        </p>
      </div>

      {/* Form */}
      <div className="space-y-6">
        {/* Location Name */}
        <div>
          <label className="mb-1.5 block text-subhead font-medium text-[var(--foreground)]">
            Location Name
          </label>
          <input
            type="text"
            value={locationName}
            onChange={(e) => {
              setLocationName(e.target.value)
              setErrors((prev) => { const next = { ...prev }; delete next.location_name; return next })
            }}
            placeholder="Main Location"
            className={cn(
              'w-full rounded-xl border bg-[var(--card)] px-4 py-3 text-body text-[var(--foreground)] shadow-warm-sm transition-shadow placeholder:text-[var(--muted-foreground)]',
              'focus:shadow-warm-md focus:outline-none focus:ring-2 focus:ring-[var(--ring)]',
              errors.location_name ? 'border-[var(--destructive)]' : 'border-[var(--border)]'
            )}
          />
          <p className="mt-1 text-footnote text-[var(--muted-foreground)]">
            If you have multiple locations, you can add more later in Settings.
          </p>
          {errors.location_name && (
            <p className="mt-1 text-footnote text-[var(--destructive)]">{errors.location_name}</p>
          )}
        </div>

        {/* Dining Sections */}
        <div>
          <label className="mb-1.5 block text-subhead font-medium text-[var(--foreground)]">
            Dining Sections
          </label>
          <p className="mb-3 text-footnote text-[var(--muted-foreground)]">
            Sections help organize your floor plan and route orders to the right kitchen station.
          </p>

          {/* Current sections */}
          <div className="mb-4 flex flex-wrap gap-2">
            {sections.map((section) => (
              <div
                key={section}
                className="flex items-center gap-2 rounded-xl bg-[var(--card)] px-4 py-2.5 shadow-warm-sm border border-[var(--border)]"
              >
                <span className="text-callout font-medium text-[var(--foreground)]">{section}</span>
                <button
                  onClick={() => removeSection(section)}
                  className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--muted)] text-[var(--muted-foreground)] transition-colors hover:bg-[var(--destructive)] hover:text-white"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>

          {errors.sections && (
            <p className="mb-3 text-footnote text-[var(--destructive)]">{errors.sections}</p>
          )}

          {/* Add custom section */}
          <div className="flex gap-2">
            <input
              type="text"
              value={newSection}
              onChange={(e) => setNewSection(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addSection(newSection)
                }
              }}
              placeholder="Add a section..."
              className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-body text-[var(--foreground)] shadow-warm-sm transition-shadow placeholder:text-[var(--muted-foreground)] focus:shadow-warm-md focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
            <Button
              onClick={() => addSection(newSection)}
              disabled={!newSection.trim()}
              variant="outline"
              className="h-12 rounded-xl px-4"
            >
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </div>

          {/* Suggestions */}
          {availableSuggestions.length > 0 && (
            <div className="mt-3">
              <span className="text-footnote text-[var(--muted-foreground)]">Suggestions: </span>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {availableSuggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => addSection(suggestion)}
                    className="rounded-full border border-dashed border-[var(--border)] px-3 py-1.5 text-footnote text-[var(--muted-foreground)] transition-all btn-press hover:border-[var(--primary)] hover:text-[var(--primary)]"
                  >
                    + {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}
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
