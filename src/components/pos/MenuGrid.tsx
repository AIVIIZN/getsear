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
  modifier_groups: { id: string; is_required: boolean }[]
}

interface MenuGridProps {
  onItemTap: (item: MenuItem) => void
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
      // Available items first, then sort by name
      if (a.is_available !== b.is_available) return a.is_available ? -1 : 1
      return a.name.localeCompare(b.name)
    })
  }, [items, activeCategoryId, searchQuery])

  const handleItemTap = useCallback(
    (item: MenuItem) => {
      if (!item.is_available) return
      onItemTap(item)
    },
    [onItemTap]
  )

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[var(--background)]">
      {/* Category tabs */}
      <div className="shrink-0 border-b border-border bg-white px-3 pt-2">
        <div className="flex gap-1 overflow-x-auto scrollbar-hide pb-0">
          <button
            type="button"
            onClick={() => setActiveCategory(null)}
            className={cn(
              'btn-press touch-target shrink-0 rounded-t-lg px-4 py-2.5 text-xs font-semibold transition-all duration-150 border-b-2',
              activeCategoryId === null
                ? 'border-[var(--primary)] text-[var(--primary)] bg-[var(--accent)]'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-[var(--secondary)]'
            )}
          >
            All
          </button>
          {categories
            .filter((c) => c.is_active)
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={cn(
                  'btn-press touch-target shrink-0 rounded-t-lg px-4 py-2.5 text-xs font-semibold transition-all duration-150 border-b-2',
                  activeCategoryId === cat.id
                    ? 'text-foreground bg-[var(--accent)]'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-[var(--secondary)]'
                )}
                style={{
                  borderBottomColor:
                    activeCategoryId === cat.id ? (cat.color || 'var(--primary)') : 'transparent',
                }}
              >
                {cat.name}
              </button>
            ))}
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
            className="h-12 w-full rounded-xl border border-border bg-[var(--secondary)] pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-[var(--ring)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20 transition-all"
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
          <div className="grid grid-cols-3 gap-2 lg:grid-cols-4">
            {filteredItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleItemTap(item as MenuItem)}
                disabled={!item.is_available}
                className={cn(
                  'btn-press relative flex flex-col items-start rounded-xl border p-3 text-left transition-all duration-150',
                  item.is_available
                    ? 'border-border bg-white shadow-warm-sm hover:shadow-warm-md hover:border-[var(--border-hover)] active:shadow-warm-sm'
                    : 'border-border/50 bg-[var(--muted)] opacity-50 cursor-not-allowed'
                )}
              >
                <span
                  className={cn(
                    'text-sm font-semibold text-foreground leading-tight line-clamp-2',
                    !item.is_available && 'text-muted-foreground'
                  )}
                >
                  {item.name}
                </span>
                <MoneyDisplay
                  cents={item.price_cents}
                  className={cn(
                    'mt-1.5 text-sm',
                    item.is_available ? 'text-muted-foreground' : 'text-muted-foreground/60'
                  )}
                />
                {!item.is_available && (
                  <div className="absolute top-2 right-2 flex items-center gap-0.5 rounded-md bg-[var(--error-bg)] px-1.5 py-0.5">
                    <Ban className="h-3 w-3 text-[var(--error)]" />
                    <span className="text-[10px] font-bold text-[var(--error)]">86&apos;d</span>
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function MenuGridSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-2 lg:grid-cols-4">
      {Array.from({ length: 12 }).map((_, i) => (
        <div
          key={i}
          className="flex flex-col rounded-xl border border-border p-3"
        >
          <div className="h-4 w-3/4 animate-skeleton rounded" />
          <div className="mt-2 h-3 w-1/2 animate-skeleton rounded" />
        </div>
      ))}
    </div>
  )
}
