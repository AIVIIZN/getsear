'use client'

import { DIETARY_TAG_MAP } from '@/lib/menu/allergen-constants'
import { cn } from '@/lib/utils'

interface DietaryTagPillProps {
  tagId: string
  size?: 'sm' | 'md'
  className?: string
}

/**
 * Rounded pill showing a dietary tag abbreviation with its designated color.
 * E.g., green "V" for Vegetarian, dark green "VG" for Vegan, amber "GF" for Gluten-Free.
 */
export function DietaryTagPill({ tagId, size = 'sm', className }: DietaryTagPillProps) {
  const tag = DIETARY_TAG_MAP.get(tagId)
  if (!tag) return null

  const sizeClass = size === 'sm'
    ? 'px-1.5 py-0.5 text-[10px]'
    : 'px-2 py-1 text-xs'

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-full font-bold text-white shrink-0',
        sizeClass,
        className
      )}
      style={{ backgroundColor: tag.color }}
      title={tag.name}
    >
      {tag.abbreviation}
    </span>
  )
}
