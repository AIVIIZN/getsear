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

export const SECTION_COLOR_MAP: Record<SectionColor, { bg: string; text: string; hex: string; label: string }> = {
  coral: { bg: 'bg-[#FF6B6B]', text: 'text-[#FF6B6B]', hex: '#FF6B6B', label: 'Coral' },
  teal: { bg: 'bg-[#2EC4B6]', text: 'text-[#2EC4B6]', hex: '#2EC4B6', label: 'Teal' },
  lavender: { bg: 'bg-[#B39DDB]', text: 'text-[#B39DDB]', hex: '#B39DDB', label: 'Lavender' },
  lime: { bg: 'bg-[#8BC34A]', text: 'text-[#8BC34A]', hex: '#8BC34A', label: 'Lime' },
  sky: { bg: 'bg-[#4FC3F7]', text: 'text-[#4FC3F7]', hex: '#4FC3F7', label: 'Sky' },
  peach: { bg: 'bg-[#FFAB91]', text: 'text-[#FFAB91]', hex: '#FFAB91', label: 'Peach' },
  mint: { bg: 'bg-[#80CBC4]', text: 'text-[#80CBC4]', hex: '#80CBC4', label: 'Mint' },
  gold: { bg: 'bg-[#FFD54F]', text: 'text-[#FFD54F]', hex: '#FFD54F', label: 'Gold' },
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
