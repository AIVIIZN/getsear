'use client'

import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { useMenuStore } from '@/stores/menu-store'
import { MoneyDisplay } from '@/components/shared/MoneyDisplay'
import { Search, Ban } from 'lucide-react'
import { cn } from '@/lib/utils'

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

// Category color palette — when categories don't have a custom color
const CATEGORY_COLORS = [
  '#FF9500', // Orange — Appetizers
  '#FF3B30', // Red — Entrees
  '#34C759', // Green — Salads
  '#007AFF', // Blue — Drinks
  '#AF52DE', // Purple — Desserts
  '#5AC8FA', // Teal — Sides
  '#FF2D55', // Pink — Specials
  '#8E8E93', // Gray — Wine/Beer
  '#FF6B35', // Deep orange
  '#30D158', // Mint
]

function getCategoryColor(index: number, customColor?: string): string {
  if (customColor && customColor.startsWith('#')) return customColor
  return CATEGORY_COLORS[index % CATEGORY_COLORS.length]
}

// Generate a softer background tint from a hex color
function tintColor(hex: string, opacity: number = 0.12): string {
  return `${hex}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`
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
  const catScrollRef = useRef<HTMLDivElement>(null)

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
      {/* Category pills — horizontally scrollable */}
      <div className="shrink-0 bg-white border-b border-border">
        <div ref={catScrollRef} className="flex gap-2 overflow-x-auto scrollbar-hide px-3 py-2.5">
          {/* All button */}
          <button
            type="button"
            onClick={() => setActiveCategory(null)}
            className={cn(
              'btn-press shrink-0 rounded-full px-5 py-2 text-sm font-semibold transition-all duration-150',
              activeCategoryId === null
                ? 'bg-[var(--foreground)] text-white shadow-warm-sm'
                : 'bg-[var(--secondary)] text-muted-foreground hover:bg-[var(--muted)]'
            )}
          >
            All
          </button>
          {sortedCategories.map((cat) => {
            const color = categoryColorMap.get(cat.id) ?? '#8E8E93'
            const isActive = activeCategoryId === cat.id
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={cn(
                  'btn-press shrink-0 rounded-full px-5 py-2 text-sm font-semibold transition-all duration-150',
                  isActive
                    ? 'text-white shadow-warm-sm'
                    : 'text-foreground hover:shadow-warm-sm'
                )}
                style={{
                  backgroundColor: isActive ? color : tintColor(color, 0.12),
                  color: isActive ? '#fff' : color,
                }}
              >
                {cat.name}
              </button>
            )
          })}
        </div>
      </div>

      {/* Search bar */}
      <div className="shrink-0 px-3 py-2 bg-white border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search menu..."
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="h-11 w-full rounded-xl border border-border bg-[var(--secondary)] pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-[var(--ring)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20 transition-all"
          />
        </div>
      </div>

      {/* Item grid — scrollable */}
      <div className="flex-1 overflow-y-auto scrollbar-hide p-3">
        {isLoading ? (
          <MenuGridSkeleton />
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <Search className="h-8 w-8 text-muted-foreground/40 mb-2" />
            <p className="text-sm font-medium text-muted-foreground">No items found</p>
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput('')
                  setSearchQuery('')
                }}
                className="mt-2 text-xs text-[var(--primary)] font-medium hover:underline"
              >
                Clear search
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2.5 lg:grid-cols-4 xl:grid-cols-5">
            {filteredItems.map((item) => {
              const catColor = categoryColorMap.get(item.category_id) ?? '#8E8E93'
              const hasImage = !!(item as MenuItem & { image_url?: string | null }).image_url
              const firstLetter = item.name.charAt(0).toUpperCase()

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleItemTap(item as MenuItem)}
                  disabled={!item.is_available}
                  className={cn(
                    'btn-press group relative flex flex-col overflow-hidden rounded-2xl transition-all duration-150',
                    item.is_available
                      ? 'shadow-[0_1px_3px_rgba(0,0,0,0.08)] hover:shadow-[0_2px_8px_rgba(0,0,0,0.12)] hover:scale-[1.02] active:scale-[0.97]'
                      : 'opacity-50 cursor-not-allowed'
                  )}
                  style={{ aspectRatio: '1' }}
                >
                  {/* Tile background — image or colored */}
                  {hasImage ? (
                    <div
                      className="absolute inset-0 bg-cover bg-center"
                      style={{
                        backgroundImage: `url(${(item as MenuItem & { image_url?: string }).image_url})`,
                      }}
                    >
                      {/* Gradient overlay for text readability */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                    </div>
                  ) : (
                    <div
                      className="absolute inset-0"
                      style={{ backgroundColor: tintColor(catColor, 0.08) }}
                    >
                      {/* Large letter watermark */}
                      <span
                        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-5xl font-black opacity-[0.07]"
                        style={{ color: catColor }}
                      >
                        {firstLetter}
                      </span>
                    </div>
                  )}

                  {/* Content overlay */}
                  <div className="relative flex flex-1 flex-col justify-end p-2.5">
                    <p
                      className={cn(
                        'text-sm font-semibold leading-tight line-clamp-2',
                        hasImage ? 'text-white' : 'text-foreground'
                      )}
                    >
                      {item.name}
                    </p>
                    <MoneyDisplay
                      cents={item.price_cents}
                      className={cn(
                        'mt-0.5 text-sm font-medium',
                        hasImage ? 'text-white/80' : 'text-muted-foreground'
                      )}
                    />
                  </div>

                  {/* Category color indicator bar at top */}
                  <div
                    className="absolute top-0 left-0 right-0 h-1"
                    style={{ backgroundColor: catColor }}
                  />

                  {/* 86'd overlay */}
                  {!item.is_available && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/70">
                      <div className="flex items-center gap-1.5 rounded-lg bg-[var(--error)] px-3 py-1.5">
                        <Ban className="h-4 w-4 text-white" />
                        <span className="text-sm font-black text-white">86&apos;d</span>
                      </div>
                    </div>
                  )}

                  {/* Border */}
                  <div className="absolute inset-0 rounded-2xl border border-black/[0.06] pointer-events-none" />
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
    <div className="grid grid-cols-3 gap-2.5 lg:grid-cols-4 xl:grid-cols-5">
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
