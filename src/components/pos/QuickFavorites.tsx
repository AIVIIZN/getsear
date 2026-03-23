'use client'

import { useMemo, useCallback } from 'react'
import { useMenuStore } from '@/stores/menu-store'
import { MoneyDisplay } from '@/components/shared/MoneyDisplay'
import { Zap } from 'lucide-react'
import { cn } from '@/lib/utils'

interface QuickFavoriteItem {
  id: string
  name: string
  price_cents: number
  has_required_modifiers: boolean
  modifier_groups: { id: string; is_required: boolean }[]
}

interface QuickFavoritesProps {
  onItemTap: (item: {
    id: string
    name: string
    price_cents: number
    category_id: string
    is_available: boolean
    modifier_groups: { id: string; is_required: boolean }[]
  }) => void
}

/**
 * Horizontal scrollable bar of speed buttons for frequently ordered items.
 * Auto-populated from the first 8 available items across categories.
 * Items without required modifiers are added instantly; items with required
 * modifiers still open the ModifierSheet.
 */
export function QuickFavorites({ onItemTap }: QuickFavoritesProps) {
  const items = useMenuStore((s) => s.items)

  // Get the first 8 available items across all categories, sorted by sort_order
  const favorites = useMemo<QuickFavoriteItem[]>(() => {
    const available = items
      .filter((i) => i.is_available && i.price_cents > 0)
      .sort((a, b) => a.sort_order - b.sort_order)
      .slice(0, 8)

    return available.map((item) => ({
      id: item.id,
      name: item.name,
      price_cents: item.price_cents,
      has_required_modifiers: item.modifier_groups.some((g) => g.is_required),
      modifier_groups: item.modifier_groups.map((g) => ({
        id: g.id,
        is_required: g.is_required,
      })),
    }))
  }, [items])

  // Find the full menu item data for the favorite
  const handleTap = useCallback(
    (fav: QuickFavoriteItem) => {
      const menuItem = items.find((i) => i.id === fav.id)
      if (!menuItem) return
      onItemTap({
        id: fav.id,
        name: fav.name,
        price_cents: fav.price_cents,
        category_id: menuItem.category_id,
        is_available: menuItem.is_available,
        modifier_groups: fav.modifier_groups,
      })
    },
    [onItemTap, items]
  )

  if (favorites.length === 0) return null

  return (
    <div
      className="shrink-0"
      style={{
        backgroundColor: 'var(--background-subtle)',
        borderBottom: '0.5px solid var(--separator)',
      }}
    >
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide px-4 py-2">
        <Zap
          className="h-4 w-4 shrink-0 text-[var(--primary)]"
          style={{ opacity: 0.6 }}
        />
        {favorites.map((fav) => (
          <button
            key={fav.id}
            type="button"
            onClick={() => handleTap(fav)}
            className={cn(
              'btn-press shrink-0 flex items-center gap-1.5 rounded-full px-3.5',
              'bg-white text-foreground',
              'hover:shadow-warm-sm active:scale-[0.97]',
              'transition-all duration-150'
            )}
            style={{
              height: 40,
              border: '1px solid rgba(0,0,0,0.06)',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
            }}
          >
            <span className="text-subhead font-semibold whitespace-nowrap max-w-[120px] truncate">
              {fav.name}
            </span>
            <MoneyDisplay
              cents={fav.price_cents}
              className="text-footnote text-muted-foreground whitespace-nowrap"
            />
          </button>
        ))}
      </div>
    </div>
  )
}
