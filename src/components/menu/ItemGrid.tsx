'use client'

import { useState, useCallback } from 'react'
import {
  Plus,
  Search,
  GripVertical,
  AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { MenuCategory } from './CategoryPanel'

export interface MenuItem {
  id: string
  org_id: string
  category_id: string
  location_id: string | null
  name: string
  short_name: string | null
  description: string
  price: string
  cost: string | null
  tax_rate_id: string | null
  is_taxable: boolean
  prep_station: string | null
  prep_time_minutes: number | null
  course: string | null
  is_active: boolean
  is_86d: boolean
  color: string | null
  image_url: string | null
  sort_order: number
  allergens: string[] | null
  nutrition: Record<string, unknown> | null
  plu_code: string | null
  barcode: string | null
  menu_item_modifier_groups?: { modifier_group_id: string }[]
}

const ALLERGEN_LABELS: Record<string, string> = {
  gluten: 'G',
  dairy: 'D',
  nuts: 'N',
  shellfish: 'SF',
  soy: 'S',
  eggs: 'E',
  fish: 'F',
  sesame: 'Se',
}

interface ItemGridProps {
  items: MenuItem[]
  categories: MenuCategory[]
  selectedCategoryId: string | null
  onSelectItem: (item: MenuItem) => void
  onToggle86: (itemId: string) => Promise<void>
  onAddItem: () => void
  onReorderItems: (items: { id: string; sort_order: number }[]) => Promise<void>
  searchQuery: string
  onSearchChange: (query: string) => void
  isLoading: boolean
}

export function ItemGrid({
  items,
  categories,
  selectedCategoryId,
  onSelectItem,
  onToggle86,
  onAddItem,
  onReorderItems,
  searchQuery,
  onSearchChange,
  isLoading,
}: ItemGridProps) {
  const [toggling86, setToggling86] = useState<string | null>(null)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  const filteredItems = items.filter((item) => {
    const matchesCategory = !selectedCategoryId || item.category_id === selectedCategoryId
    const matchesSearch =
      !searchQuery.trim() ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.short_name && item.short_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.plu_code && item.plu_code.toLowerCase().includes(searchQuery.toLowerCase()))
    return matchesCategory && matchesSearch
  })

  const categoryName = selectedCategoryId
    ? categories.find((c) => c.id === selectedCategoryId)?.name ?? 'Category'
    : 'All Items'

  const handle86Toggle = useCallback(
    async (e: React.MouseEvent, itemId: string) => {
      e.stopPropagation()
      setToggling86(itemId)
      try {
        await onToggle86(itemId)
      } finally {
        setToggling86(null)
      }
    },
    [onToggle86]
  )

  const handleDragStart = useCallback((index: number) => {
    setDragIndex(index)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault()
    setDragOverIndex(index)
  }, [])

  const handleDrop = useCallback(
    async (targetIndex: number) => {
      if (dragIndex === null || dragIndex === targetIndex) {
        setDragIndex(null)
        setDragOverIndex(null)
        return
      }

      const reordered = [...filteredItems]
      const [moved] = reordered.splice(dragIndex, 1)
      reordered.splice(targetIndex, 0, moved)

      const reorderPayload = reordered.map((item, idx) => ({
        id: item.id,
        sort_order: idx,
      }))

      setDragIndex(null)
      setDragOverIndex(null)

      await onReorderItems(reorderPayload)
    },
    [dragIndex, filteredItems, onReorderItems]
  )

  const handleDragEnd = useCallback(() => {
    setDragIndex(null)
    setDragOverIndex(null)
  }, [])

  const formatPrice = (price: string): string => {
    const num = parseFloat(price)
    return isNaN(num) ? '$0.00' : `$${num.toFixed(2)}`
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-foreground">{categoryName}</h2>
          <span className="text-xs text-muted-foreground">
            {filteredItems.length} item{filteredItems.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search items..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="h-8 w-[200px] pl-8"
            />
          </div>
          <Button size="sm" onClick={onAddItem} className="btn-press">
            <Plus className="size-4 mr-1" />
            Add Item
          </Button>
        </div>
      </div>

      {/* Items grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-[140px] rounded-xl animate-skeleton" />
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="rounded-full bg-muted p-4 mb-4">
              <AlertTriangle className="size-6 text-muted-foreground" strokeWidth={1.5} />
            </div>
            <h3 className="text-base font-semibold text-foreground mb-1">
              {searchQuery ? 'No items match your search' : 'No items in this category'}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {searchQuery
                ? 'Try a different search term'
                : 'Add your first item to get started'}
            </p>
            {!searchQuery && (
              <Button onClick={onAddItem} className="btn-press">
                <Plus className="size-4 mr-1" />
                Add Item
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
            {filteredItems.map((item, index) => (
              <div
                key={item.id}
                draggable={!!selectedCategoryId}
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={() => handleDrop(index)}
                onDragEnd={handleDragEnd}
                onClick={() => onSelectItem(item)}
                className={cn(
                  'group relative flex cursor-pointer flex-col rounded-xl bg-card p-3 shadow-warm-sm ring-1 ring-foreground/5 transition-all hover:shadow-warm-md hover:ring-foreground/10 touch-target',
                  item.is_86d && 'opacity-60',
                  dragIndex === index && 'opacity-40',
                  dragOverIndex === index && dragIndex !== index && 'ring-2 ring-primary'
                )}
              >
                {/* 86 overlay */}
                {item.is_86d && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-error/5">
                    <Badge variant="destructive" className="text-xs font-bold">
                      86&apos;d
                    </Badge>
                  </div>
                )}

                {/* Drag handle */}
                {selectedCategoryId && (
                  <div className="absolute top-2 right-2 hidden cursor-grab text-muted-foreground group-hover:block">
                    <GripVertical className="size-4" />
                  </div>
                )}

                {/* Item name and price */}
                <div className="flex items-start justify-between gap-2">
                  <h3
                    className={cn(
                      'text-sm font-semibold text-foreground leading-tight',
                      item.is_86d && 'line-through'
                    )}
                  >
                    {item.name}
                  </h3>
                </div>

                {/* Description */}
                {item.description && (
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                    {item.description}
                  </p>
                )}

                {/* Price and info row */}
                <div className="mt-auto flex items-center justify-between pt-2">
                  <span className="text-sm font-bold tabular-nums text-foreground">
                    {formatPrice(item.price)}
                  </span>

                  {/* Allergen badges */}
                  {item.allergens && item.allergens.length > 0 && (
                    <div className="flex gap-0.5">
                      {item.allergens.slice(0, 3).map((a) => (
                        <span
                          key={a}
                          className="inline-flex size-5 items-center justify-center rounded-full bg-warning-bg text-[10px] font-bold text-warning"
                          title={a}
                        >
                          {ALLERGEN_LABELS[a] ?? a[0].toUpperCase()}
                        </span>
                      ))}
                      {item.allergens.length > 3 && (
                        <span className="inline-flex size-5 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground">
                          +{item.allergens.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* 86 toggle */}
                <div
                  className="mt-2 flex items-center justify-between border-t border-border/50 pt-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className={cn('text-xs', item.is_86d ? 'text-destructive font-medium' : 'text-muted-foreground')}>
                    {item.is_86d ? '86\'d' : 'Available'}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => handle86Toggle(e, item.id)}
                    disabled={toggling86 === item.id}
                    className="touch-target flex items-center"
                    aria-label={item.is_86d ? 'Mark as available' : 'Mark as 86\'d'}
                  >
                    <Switch
                      checked={!item.is_86d}
                      disabled={toggling86 === item.id}
                      className={cn(
                        !item.is_86d
                          ? '[&]:data-checked:bg-success'
                          : '[&]:data-unchecked:bg-destructive/30'
                      )}
                    />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
