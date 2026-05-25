'use client'

import Image from 'next/image'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, ImageIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { FALLBACK_BLUR } from './ItemCard'
import type { MenuItem } from './ItemGrid'

interface ItemListRowProps {
  item: MenuItem
  isSelected: boolean
  isMultiSelected: boolean
  isMultiSelectMode: boolean
  categoryName: string
  onSelect: (item: MenuItem) => void
  onToggleMultiSelect: (id: string) => void
  onToggle86: (itemId: string) => Promise<void>
}

function formatPrice(price: string): string {
  const num = parseFloat(price)
  return isNaN(num) ? '$0.00' : `$${num.toFixed(2)}`
}

export function ItemListRow({
  item,
  isSelected,
  isMultiSelected,
  isMultiSelectMode,
  categoryName,
  onSelect,
  onToggleMultiSelect,
  onToggle86,
}: ItemListRowProps) {
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
        'group flex items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 transition-all cursor-pointer hover:bg-muted/50',
        isSelected && 'border-[var(--color-primary)] bg-accent',
        isMultiSelected && 'border-[var(--color-primary)] bg-accent',
        item.is_86d && 'opacity-60',
        isDragging && 'opacity-50 z-50 shadow-lg bg-background',
      )}
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab text-muted-foreground/40 hover:text-muted-foreground"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="size-4" />
      </div>

      {/* Multi-select checkbox */}
      {isMultiSelectMode && (
        <div
          className={cn(
            'size-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors',
            isMultiSelected
              ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white'
              : 'border-border bg-background'
          )}
        >
          {isMultiSelected && (
            <svg className="size-3" viewBox="0 0 12 12" fill="none">
              <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
      )}

      {/* Photo */}
      <div className="relative size-10 flex-shrink-0 rounded-lg overflow-hidden bg-muted">
        {item.image_url ? (
          <Image
            src={item.image_url}
            alt={item.name}
            fill
            sizes="40px"
            placeholder="blur"
            blurDataURL={FALLBACK_BLUR}
            className="object-cover"
          />
        ) : (
          <div className="size-full flex items-center justify-center">
            <ImageIcon className="size-4 text-muted-foreground/40" strokeWidth={1.5} />
          </div>
        )}
      </div>

      {/* Name and category */}
      <div className="flex-1 min-w-0">
        <h3 className={cn(
          'text-sm font-semibold text-foreground truncate',
          item.is_86d && 'line-through'
        )}>
          {item.name}
        </h3>
        <p className="text-xs text-muted-foreground truncate">{categoryName}</p>
      </div>

      {/* Price */}
      <span className="text-sm font-bold tabular-nums text-foreground flex-shrink-0">
        {formatPrice(item.price)}
      </span>

      {/* Status badges */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {item.is_86d && (
          <Badge variant="destructive" className="text-[10px]">86&apos;d</Badge>
        )}
      </div>

      {/* 86 toggle */}
      <div onClick={(e) => e.stopPropagation()} className="flex-shrink-0">
        <button
          type="button"
          onClick={() => onToggle86(item.id)}
          className="flex items-center"
        >
          <Switch
            checked={!item.is_86d}
            className={cn(
              !item.is_86d
                ? '[&]:data-checked:bg-success'
                : '[&]:data-unchecked:bg-destructive/30'
            )}
          />
        </button>
      </div>
    </div>
  )
}
