'use client'

import { ALLERGEN_MAP, type AllergenMode } from '@/lib/menu/allergen-constants'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface AllergenBadgeProps {
  allergenId: string
  mode?: AllergenMode
  size?: 'sm' | 'md'
}

/**
 * Small colored circle with 2-letter abbreviation for an allergen.
 * Dashed border for MAY_CONTAIN mode.
 * Tooltip shows full allergen name on hover.
 */
export function AllergenBadge({ allergenId, mode = 'CONTAINS', size = 'sm' }: AllergenBadgeProps) {
  const allergen = ALLERGEN_MAP.get(allergenId)
  if (!allergen) return null

  const isMayContain = mode === 'MAY_CONTAIN'
  const sizeClass = size === 'sm' ? 'size-5 text-[10px]' : 'size-6 text-xs'

  return (
    <TooltipProvider delay={200}>
      <Tooltip>
        <TooltipTrigger
          className={cn(
            'inline-flex items-center justify-center rounded-full font-bold shrink-0 cursor-default',
            sizeClass,
            isMayContain && 'border-2 border-dashed'
          )}
          style={{
            backgroundColor: isMayContain ? 'transparent' : allergen.color,
            color: isMayContain ? allergen.color : 'var(--color-white)',
            borderColor: isMayContain ? allergen.color : undefined,
          }}
        >
          {allergen.abbreviation}
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          <span className="font-medium">{allergen.name}</span>
          {isMayContain && (
            <span className="text-muted-foreground ml-1">(may contain)</span>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
