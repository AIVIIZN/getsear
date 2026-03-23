'use client'

import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, X, ChevronDown, ChevronUp } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import {
  PricingTypeSelector,
  DEFAULT_MODIFIER_PRICING,
  type ModifierPricing,
} from './PricingTypeSelector'

export interface ModifierRowData {
  id?: string
  name: string
  price: string
  is_active: boolean
  pricing: ModifierPricing
  sub_modifier_group_id?: string | null
}

interface ModifierRowProps {
  modifier: ModifierRowData
  index: number
  onUpdate: (index: number, field: keyof ModifierRowData, value: string | boolean | ModifierPricing | null) => void
  onRemove: (index: number) => void
}

export function ModifierRow({ modifier, index, onUpdate, onRemove }: ModifierRowProps) {
  const [showPricing, setShowPricing] = useState(false)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: modifier.id || `new-modifier-${index}`,
    data: {
      type: 'modifier',
      modifier,
      index,
    },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'rounded-lg border border-border bg-card p-2 space-y-2 transition-all',
        isDragging && 'opacity-50 shadow-lg'
      )}
    >
      <div className="flex items-center gap-2">
        {/* Drag handle */}
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab text-muted-foreground/40 hover:text-muted-foreground flex-shrink-0"
        >
          <GripVertical className="size-3.5" />
        </div>

        {/* Name */}
        <Input
          placeholder="Modifier name"
          value={modifier.name}
          onChange={(e) => onUpdate(index, 'name', e.target.value)}
          className="flex-1 h-8"
        />

        {/* Price */}
        <div className="relative w-20 flex-shrink-0">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
          <Input
            placeholder="0.00"
            value={modifier.price}
            onChange={(e) => onUpdate(index, 'price', e.target.value)}
            className="pl-6 tabular-nums h-8"
          />
        </div>

        {/* Active toggle */}
        <button
          type="button"
          onClick={() => onUpdate(index, 'is_active', !modifier.is_active)}
          className="flex-shrink-0"
        >
          <Switch checked={modifier.is_active} />
        </button>

        {/* Pricing expand */}
        <button
          type="button"
          onClick={() => setShowPricing(!showPricing)}
          className="p-1 text-muted-foreground hover:text-foreground flex-shrink-0 transition-colors"
          aria-label="Toggle pricing options"
        >
          {showPricing ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
        </button>

        {/* Remove */}
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="p-1 text-muted-foreground hover:text-destructive flex-shrink-0 transition-colors"
          aria-label="Remove modifier"
        >
          <X className="size-3.5" />
        </button>
      </div>

      {/* Pricing options (expanded) */}
      {showPricing && (
        <div className="pl-6 pt-1">
          <PricingTypeSelector
            pricing={modifier.pricing}
            onChange={(pricing) => onUpdate(index, 'pricing', pricing)}
          />
        </div>
      )}
    </div>
  )
}

export function createEmptyModifier(): ModifierRowData {
  return {
    name: '',
    price: '0.00',
    is_active: true,
    pricing: { ...DEFAULT_MODIFIER_PRICING },
    sub_modifier_group_id: null,
  }
}
