'use client'

import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import Image from 'next/image'
import { useMenuStore } from '@/stores/menu-store'
import { MoneyDisplay } from '@/components/shared/MoneyDisplay'
import { QuickFavorites } from './QuickFavorites'
import { Search, Ban } from 'lucide-react'
import { cn } from '@/lib/utils'
import { haptics } from '@/lib/haptics'
import { EmptyState } from '@/components/ui-v2/feedback/EmptyState'
import { FALLBACK_BLUR } from '@/components/menu/ItemCard'

interface MenuItem {
  id: string
  name: string
  price_cents: number
  category_id: string
  is_available: boolean
  image_url?: string | null
  modifier_groups: { id: string; is_required: boolean }[]
}

interface MenuGridProps {
  onItemTap: (item: MenuItem) => void
}

// Category color palette — Toast-style pastels (soft, not alarming)
const CATEGORY_COLORS = [
  'var(--color-primary-soft)', // Light Blue — Appetizers
  'var(--color-danger-soft)', // Light Pink — Entrees
  'var(--color-success-soft)', // Light Green — Salads
  'var(--color-primary-soft)', // Light Blue — Drinks
  'var(--color-purple-soft)', // Light Lavender — Desserts
  'var(--color-cyan-bg)', // Light Cyan — Sides
  'var(--color-pink-soft)', // Light Rose — Specials
  'var(--color-bg-muted)', // Light Gray — Wine/Beer
  'var(--color-marketing-bg-warm)', // Light Peach
  'var(--color-success-soft)', // Light Mint
]

function getCategoryColor(index: number, customColor?: string): string {
  if (customColor && customColor.startsWith('#')) return customColor
  return CATEGORY_COLORS[index % CATEGORY_COLORS.length]
}

function tintColor(color: string, opacity: number = 0.12): string {
  return `color-mix(in srgb, ${color} ${Math.round(opacity * 100)}%, transparent)`
}

export function MenuGrid({ onItemTap }: MenuGridProps) {
  const categories = useMenuStore((s) => s.categories)
  const items = useMenuStore((s) => s.items)
  const activeCategoryId = useMenuStore((s) => s.activeCategoryId)
  const searchQuery = useMenuStore((s) => s.searchQuery)
  const isLoading = useMenuStore((s) => s.isLoading)
  const { setActiveCategory, setSearchQuery } = useMenuStore((s) => s.actions)

  const [searchInput, setSearchInput] = useState(searchQuery)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Debounced search
  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchInput(value)
      clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        setSearchQuery(value)
      }, 200)
    },
    [setSearchQuery]
  )

  useEffect(() => {
    return () => clearTimeout(debounceRef.current)
  }, [])

  // Category color map
  const categoryColorMap = useMemo(() => {
    const map = new Map<string, string>()
    const sorted = [...categories].filter((c) => c.is_active).sort((a, b) => a.sort_order - b.sort_order)
    sorted.forEach((cat, idx) => {
      map.set(cat.id, getCategoryColor(idx, cat.color))
    })
    return map
  }, [categories])

  // Filter items
  const filteredItems = useMemo(() => {
    let result = items
    if (activeCategoryId) {
      result = result.filter((i) => i.category_id === activeCategoryId)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter((i) => i.name.toLowerCase().includes(q))
    }
    return result.sort((a, b) => {
      if (a.is_available !== b.is_available) return a.is_available ? -1 : 1
      return a.sort_order - b.sort_order
    })
  }, [items, activeCategoryId, searchQuery])

  const handleItemTap = useCallback(
    (item: MenuItem) => {
      if (!item.is_available) return
      haptics.orderAdd()
      onItemTap(item)
    },
    [onItemTap]
  )

  const sortedCategories = useMemo(
    () => categories.filter((c) => c.is_active).sort((a, b) => a.sort_order - b.sort_order),
    [categories]
  )

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[var(--background)]">
      {/* Quick Favorites speed bar */}
      <QuickFavorites onItemTap={onItemTap} />

      {/* Category pills — horizontally scrollable, 36px tall */}
      <div
        className="shrink-0 bg-white"
        style={{ borderBottom: '0.5px solid var(--separator)' }}
      >
        <div className="flex gap-2 overflow-x-auto scrollbar-hide px-4 py-3">
          {/* All button */}
          <button
            type="button"
            onClick={() => setActiveCategory(null)}
            className={cn(
              'btn-press shrink-0 rounded-full px-6 text-subhead font-semibold transition-all duration-150',
              activeCategoryId === null
                ? 'bg-[var(--foreground)] text-white shadow-warm-sm'
                : 'bg-[var(--secondary)] text-muted-foreground hover:bg-[var(--muted)]'
            )}
            style={{ height: 36, minWidth: 64 }}
          >
            All
          </button>
          {sortedCategories.map((cat) => {
            const color = categoryColorMap.get(cat.id) ?? 'var(--color-text-muted)'
            const isActive = activeCategoryId === cat.id
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={cn(
                  'btn-press shrink-0 rounded-full px-6 text-subhead font-semibold transition-all duration-150',
                  isActive ? 'text-white shadow-warm-sm' : 'hover:shadow-warm-sm'
                )}
                style={{
                  height: 36,
                  minWidth: 80,
                  backgroundColor: isActive ? color : 'transparent',
                  color: isActive ? 'var(--color-text)' : 'var(--color-text-muted)',
                  border: isActive ? '2px solid var(--color-primary)' : '1.5px solid var(--gray-200)',
                }}
              >
                {cat.name}
              </button>
            )
          })}
        </div>
      </div>

      {/* Search bar — 44px tall */}
      <div
        className="shrink-0 px-4 py-2.5 bg-white"
        style={{ borderBottom: '0.5px solid var(--separator)' }}
      >
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search menu..."
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="h-11 w-full rounded-xl border-0 bg-[var(--secondary)] pl-10 pr-4 text-body text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-[var(--ring)]/20 transition-all"
          />
        </div>
      </div>

      {/* Item grid — scrollable, bigger tiles */}
      <div className="flex-1 overflow-y-auto scrollbar-hide scroll-container p-4">
        {isLoading ? (
          <MenuGridSkeleton />
        ) : filteredItems.length === 0 ? (
          <EmptyState
            illustration="no-menu-items"
            title={searchQuery ? 'No items match your search' : 'No menu items yet'}
            description={
              searchQuery
                ? 'Try a different search term or clear the filter to see all items.'
                : 'Add your first menu item from the back office to start taking orders.'
            }
            action={
              searchQuery
                ? {
                    label: 'Clear search',
                    onClick: () => {
                      setSearchInput('')
                      setSearchQuery('')
                    },
                  }
                : undefined
            }
          />
        ) : (
          <div
            className="grid gap-3"
            style={{
              gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
            }}
          >
            {filteredItems.map((item, index) => {
              const catColor = categoryColorMap.get(item.category_id) ?? 'var(--color-text-muted)'
              const imageUrl = (item as MenuItem & { image_url?: string | null }).image_url
              const hasImage = !!imageUrl
              const firstLetter = item.name.charAt(0).toUpperCase()
              const isAboveFold = index < 8

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleItemTap(item as MenuItem)}
                  disabled={!item.is_available}
                  className={cn(
                    'tile-press group relative flex flex-col overflow-hidden rounded-2xl',
                    item.is_available
                      ? 'shadow-warm-md hover:shadow-warm-lg active:scale-[0.96]'
                      : 'opacity-50 cursor-not-allowed'
                  )}
                  style={{
                    aspectRatio: '1',
                    cornerShape: 'squircle',
                  } as React.CSSProperties}
                >
                  {/* Tile background — image or colored */}
                  {hasImage && imageUrl ? (
                    <div className="absolute inset-0">
                      <Image
                        src={imageUrl}
                        alt={item.name}
                        fill
                        sizes="(max-width: 640px) 33vw, (max-width: 1024px) 25vw, 200px"
                        placeholder="blur"
                        blurDataURL={FALLBACK_BLUR}
                        priority={isAboveFold}
                        className="object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                    </div>
                  ) : (
                    <div
                      className="absolute inset-0"
                      style={{ backgroundColor: tintColor(catColor, 0.07) }}
                    >
                      {/* Large letter watermark */}
                      <span
                        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 font-black opacity-[0.06]"
                        style={{ color: catColor, fontSize: 72 }}
                      >
                        {firstLetter}
                      </span>
                    </div>
                  )}

                  {/* Category color bar at top — 4px */}
                  <div
                    className="absolute top-0 left-0 right-0"
                    style={{ height: 4, backgroundColor: catColor }}
                  />

                  {/* Content — name + price at bottom */}
                  <div className="relative flex flex-1 flex-col justify-end p-3">
                    <p
                      className={cn(
                        'text-callout font-semibold leading-tight line-clamp-2',
                        hasImage ? 'text-white' : 'text-foreground'
                      )}
                    >
                      {item.name}
                    </p>
                    <MoneyDisplay
                      cents={item.price_cents}
                      className={cn(
                        'mt-0.5 text-subhead font-medium tabular-nums',
                        hasImage ? 'text-white/80' : 'text-muted-foreground'
                      )}
                    />
                  </div>

                  {/* 86'd overlay */}
                  {!item.is_available && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/70">
                      <div className="flex items-center gap-1.5 rounded-xl bg-[var(--error)] px-4 py-2">
                        <Ban className="h-5 w-5 text-white" />
                        <span className="text-subhead font-black text-white">86&apos;d</span>
                      </div>
                    </div>
                  )}

                  {/* Subtle border */}
                  <div className="absolute inset-0 rounded-2xl border border-black/[0.04] pointer-events-none" />
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function MenuGridSkeleton() {
  return (
    <div
      className="grid gap-3"
      style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))' }}
    >
      {Array.from({ length: 12 }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl bg-[var(--secondary)] animate-skeleton"
          style={{ aspectRatio: '1' }}
        />
      ))}
    </div>
  )
}
