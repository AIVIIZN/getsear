'use client'

import Image from 'next/image'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, ImageIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { MenuItem } from './ItemGrid'

export const FALLBACK_BLUR =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxIDEiPjxyZWN0IHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9IiNmMmYyZjciLz48L3N2Zz4='

const DIETARY_ICONS: Record<string, { label: string; abbrev: string; color: string }> = {
  vegetarian: { label: 'Vegetarian', abbrev: 'V', color: 'bg-green-100 text-green-700' },
  vegan: { label: 'Vegan', abbrev: 'VG', color: 'bg-green-100 text-green-800' },
  gluten_free: { label: 'Gluten Free', abbrev: 'GF', color: 'bg-amber-100 text-amber-700' },
  dairy_free: { label: 'Dairy Free', abbrev: 'DF', color: 'bg-blue-100 text-blue-700' },
}

const ALLERGEN_TO_DIETARY: Record<string, string> = {
  gluten: 'gluten_free',
  dairy: 'dairy_free',
}

interface ItemCardProps {
  item: MenuItem
  isSelected: boolean
  isMultiSelected: boolean
  isMultiSelectMode: boolean
  onSelect: (item: MenuItem) => void
  onToggleMultiSelect: (id: string) => void
}

function formatPrice(price: string): string {
  const num = parseFloat(price)
  return isNaN(num) ? '$0.00' : `$${num.toFixed(2)}`
}

export function ItemCard({
  item,
  isSelected,
  isMultiSelected,
  isMultiSelectMode,
  onSelect,
  onToggleMultiSelect,
}: ItemCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.id,
    data: {
      type: 'item',
      item,
    },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  // Derive dietary info from allergens
  const dietaryFlags: string[] = []
  if (item.allergens) {
    for (const allergen of item.allergens) {
      const dietary = ALLERGEN_TO_DIETARY[allergen]
      if (dietary) dietaryFlags.push(dietary)
    }
  }

  const handleClick = () => {
    if (isMultiSelectMode) {
      onToggleMultiSelect(item.id)
    } else {
      onSelect(item)
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={handleClick}
      className={cn(
        'group relative flex cursor-pointer flex-col rounded-xl bg-card p-3 shadow-warm-sm ring-1 ring-foreground/5 transition-all hover:shadow-warm-md hover:ring-foreground/10',
        isSelected && 'ring-2 ring-[#007AFF] shadow-warm-md',
        isMultiSelected && 'ring-2 ring-[#007AFF]',
        item.is_86d && 'opacity-60',
        isDragging && 'opacity-50 z-50 shadow-lg scale-[1.02]',
      )}
    >
      {/* 86 overlay */}
      {item.is_86d && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-destructive/5">
          <Badge variant="destructive" className="text-xs font-bold">
            86&apos;d
          </Badge>
        </div>
      )}

      {/* Multi-select checkbox */}
      {isMultiSelectMode && (
        <div className="absolute top-2 left-2 z-20">
          <div
            className={cn(
              'size-5 rounded-md border-2 flex items-center justify-center transition-colors',
              isMultiSelected
                ? 'border-[#007AFF] bg-[#007AFF] text-white'
                : 'border-border bg-background'
            )}
          >
            {isMultiSelected && (
              <svg className="size-3" viewBox="0 0 12 12" fill="none">
                <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
        </div>
      )}

      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute top-2 right-2 hidden cursor-grab text-muted-foreground group-hover:block z-20"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="size-4" />
      </div>

      {/* Photo thumbnail */}
      {item.image_url ? (
        <div className="relative mb-2 aspect-video w-full overflow-hidden rounded-lg bg-muted">
          <Image
            src={item.image_url}
            alt={item.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 200px"
            placeholder="blur"
            blurDataURL={FALLBACK_BLUR}
            className="object-cover"
          />
        </div>
      ) : (
        <div className="mb-2 flex aspect-video w-full items-center justify-center rounded-lg bg-muted/50">
          <ImageIcon className="size-5 text-muted-foreground/40" strokeWidth={1.5} />
        </div>
      )}

      {/* Item name */}
      <h3
        className={cn(
          'text-sm font-semibold text-foreground leading-tight line-clamp-2',
          item.is_86d && 'line-through'
        )}
      >
        {item.name}
      </h3>

      {/* Price and dietary icons */}
      <div className="mt-auto flex items-center justify-between pt-2">
        <span className="text-sm font-bold tabular-nums text-foreground">
          {formatPrice(item.price)}
        </span>
        <div className="flex gap-0.5">
          {dietaryFlags.map((flag) => {
            const info = DIETARY_ICONS[flag]
            if (!info) return null
            return (
              <span
                key={flag}
                className={cn(
                  'inline-flex size-5 items-center justify-center rounded-full text-[9px] font-bold',
                  info.color
                )}
                title={info.label}
              >
                {info.abbrev}
              </span>
            )
          })}
          {item.allergens && item.allergens.length > 0 && (
            <span
              className="inline-flex size-5 items-center justify-center rounded-full bg-warning-bg text-[9px] font-bold text-warning"
              title={`${item.allergens.length} allergen${item.allergens.length !== 1 ? 's' : ''}`}
            >
              !
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
