'use client'

import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'

export type SectionColor =
  | 'coral'
  | 'teal'
  | 'lavender'
  | 'lime'
  | 'sky'
  | 'peach'
  | 'mint'
  | 'gold'

export const SECTION_COLOR_MAP: Record<SectionColor, { bg: string; text: string; cssVar: string; label: string }> = {
  coral: { bg: 'bg-[var(--color-section-coral)]', text: 'text-[var(--color-section-coral)]', cssVar: 'var(--color-section-coral)', label: 'Coral' },
  teal: { bg: 'bg-[var(--color-section-teal)]', text: 'text-[var(--color-section-teal)]', cssVar: 'var(--color-section-teal)', label: 'Teal' },
  lavender: { bg: 'bg-[var(--color-section-lavender)]', text: 'text-[var(--color-section-lavender)]', cssVar: 'var(--color-section-lavender)', label: 'Lavender' },
  lime: { bg: 'bg-[var(--color-section-lime)]', text: 'text-[var(--color-section-lime)]', cssVar: 'var(--color-section-lime)', label: 'Lime' },
  sky: { bg: 'bg-[var(--color-section-sky)]', text: 'text-[var(--color-section-sky)]', cssVar: 'var(--color-section-sky)', label: 'Sky' },
  peach: { bg: 'bg-[var(--color-section-peach)]', text: 'text-[var(--color-section-peach)]', cssVar: 'var(--color-section-peach)', label: 'Peach' },
  mint: { bg: 'bg-[var(--color-section-mint)]', text: 'text-[var(--color-section-mint)]', cssVar: 'var(--color-section-mint)', label: 'Mint' },
  gold: { bg: 'bg-[var(--color-section-gold)]', text: 'text-[var(--color-section-gold)]', cssVar: 'var(--color-section-gold)', label: 'Gold' },
}

export const SECTION_COLORS = Object.keys(SECTION_COLOR_MAP) as SectionColor[]

interface SectionColorPickerProps {
  selected: SectionColor | null
  onSelect: (color: SectionColor) => void
  className?: string
}

/**
 * 8-color palette for server section assignment.
 * Renders as a 4x2 grid of 32x32 color swatches.
 */
export function SectionColorPicker({ selected, onSelect, className }: SectionColorPickerProps) {
  return (
    <div className={cn('grid grid-cols-4 gap-1.5', className)}>
      {SECTION_COLORS.map((color) => {
        const isSelected = selected === color
        return (
          <button
            key={color}
            type="button"
            onClick={() => onSelect(color)}
            className={cn(
              'relative flex h-8 w-8 items-center justify-center rounded-lg transition-all',
              SECTION_COLOR_MAP[color].bg,
              isSelected
                ? 'ring-2 ring-foreground ring-offset-2 ring-offset-background scale-110'
                : 'hover:scale-105 hover:ring-1 hover:ring-foreground/20',
            )}
            title={SECTION_COLOR_MAP[color].label}
          >
            {isSelected && <Check className="h-4 w-4 text-white drop-shadow-sm" />}
          </button>
        )
      })}
    </div>
  )
}

/**
 * Small color pip/dot for displaying section color inline.
 */
export function SectionColorPip({
  color,
  size = 'sm',
  className,
}: {
  color: string | null
  size?: 'xs' | 'sm' | 'md'
  className?: string
}) {
  if (!color || !(color in SECTION_COLOR_MAP)) return null

  const sizeClasses = {
    xs: 'h-2 w-2',
    sm: 'h-2.5 w-2.5',
    md: 'h-3 w-3',
  }

  return (
    <span
      className={cn(
        'inline-block rounded-full flex-shrink-0',
        SECTION_COLOR_MAP[color as SectionColor].bg,
        sizeClasses[size],
        className
      )}
    />
  )
}
