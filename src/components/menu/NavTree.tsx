'use client'

import { useState, useCallback, useMemo } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
  useDroppable,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import {
  Plus,
  Search,
  ChevronsUpDown,
  FolderOpen,
  Utensils,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { NavTreeNode } from './NavTreeNode'
import { useMenuBuilderStore } from '@/stores/menu-builder-store'
import type { MenuCategory } from './CategoryPanel'
import type { MenuItem } from './ItemGrid'

interface NavTreeProps {
  categories: MenuCategory[]
  items: MenuItem[]
  onCreateCategory: (name: string, color: string) => Promise<void>
  onRenameCategory: (id: string, name: string) => Promise<void>
  onDuplicateCategory: (id: string) => Promise<void>
  onDeleteCategory: (id: string) => Promise<void>
  onReorderCategories: (items: { id: string; sort_order: number }[]) => Promise<void>
  onMoveItemToCategory: (itemId: string, categoryId: string) => Promise<void>
  isLoading: boolean
  /** ID of the category currently being dragged over for cross-panel drop */
  dropTargetCategoryId: string | null
}

const CATEGORY_COLORS = [
  'var(--color-primary)', 'var(--color-danger-600)', 'var(--color-success-600)', 'var(--color-blue-strong)',
  'var(--color-purple-deep)', 'var(--color-marketing-warning)', 'var(--color-cyan-strong)', 'var(--color-pink)',
]

function DroppableCategoryWrapper({
  categoryId,
  children,
  isDropTarget,
}: {
  categoryId: string
  children: React.ReactNode
  isDropTarget: boolean
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `category-drop-${categoryId}`,
    data: { type: 'category-drop-target', categoryId },
  })

  return (
    <div ref={setNodeRef} data-droptarget={isOver || isDropTarget}>
      {children}
    </div>
  )
}

export function NavTree({
  categories,
  items,
  onCreateCategory,
  onRenameCategory,
  onDuplicateCategory,
  onDeleteCategory,
  onReorderCategories,
  isLoading,
  dropTargetCategoryId,
}: NavTreeProps) {
  const [isAdding, setIsAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(CATEGORY_COLORS[0])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [filterText, setFilterText] = useState('')
  const [activeDragId, setActiveDragId] = useState<string | null>(null)

  const {
    selectedCategoryId,
    selectCategory,
    expandedCategoryIds,
    toggleCategoryExpanded,
    expandAllCategories,
    collapseAllCategories,
  } = useMenuBuilderStore()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  // Item counts per category
  const categoryItemCounts = useMemo(() => {
    const counts = new Map<string, number>()
    const counts86d = new Map<string, number>()
    for (const item of items) {
      counts.set(item.category_id, (counts.get(item.category_id) ?? 0) + 1)
      if (item.is_86d) {
        counts86d.set(item.category_id, (counts86d.get(item.category_id) ?? 0) + 1)
      }
    }
    return { counts, counts86d }
  }, [items])

  const filteredCategories = useMemo(() => {
    if (!filterText.trim()) return categories
    const q = filterText.toLowerCase()
    return categories.filter((c) => c.name.toLowerCase().includes(q))
  }, [categories, filterText])

  const handleCreate = useCallback(async () => {
    if (!newName.trim()) return
    setIsSubmitting(true)
    try {
      await onCreateCategory(newName.trim(), newColor)
      setNewName('')
      setNewColor(CATEGORY_COLORS[0])
      setIsAdding(false)
    } finally {
      setIsSubmitting(false)
    }
  }, [newName, newColor, onCreateCategory])

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveDragId(event.active.id as string)
  }, [])

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActiveDragId(null)
      const { active, over } = event
      if (!over || active.id === over.id) return

      const oldIndex = filteredCategories.findIndex((c) => c.id === active.id)
      const newIndex = filteredCategories.findIndex((c) => c.id === over.id)
      if (oldIndex === -1 || newIndex === -1) return

      const reordered = arrayMove(filteredCategories, oldIndex, newIndex)
      const reorderPayload = reordered.map((cat, idx) => ({
        id: cat.id,
        sort_order: idx,
      }))
      await onReorderCategories(reorderPayload)
    },
    [filteredCategories, onReorderCategories]
  )

  const handleToggleAll = useCallback(() => {
    if (expandedCategoryIds.size > 0) {
      collapseAllCategories()
    } else {
      expandAllCategories(categories.map((c) => c.id))
    }
  }, [expandedCategoryIds.size, categories, expandAllCategories, collapseAllCategories])

  const activeDragCategory = activeDragId
    ? categories.find((c) => c.id === activeDragId)
    : null

  const totalItems = items.length
  const total86d = items.filter((i) => i.is_86d).length

  return (
    <div className="flex h-full w-[240px] flex-shrink-0 flex-col border-r border-border bg-[var(--color-bg-muted)]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/60 px-3 py-3">
        <h2 className="text-sm font-semibold text-foreground">Categories</h2>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={handleToggleAll}
            aria-label="Toggle expand all"
          >
            <ChevronsUpDown className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setIsAdding(!isAdding)}
            aria-label="Add category"
          >
            <Plus className="size-4" />
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="px-2 pt-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Filter categories..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="h-7 pl-7 text-xs bg-background/60"
          />
        </div>
      </div>

      {/* Add category form */}
      {isAdding && (
        <div className="border-b border-border/60 p-3 space-y-2">
          <Input
            placeholder="Category name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate()
              if (e.key === 'Escape') setIsAdding(false)
            }}
            autoFocus
            className="h-8"
          />
          <div className="flex gap-1.5 flex-wrap">
            {CATEGORY_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                className={cn(
                  'size-6 rounded-full border-2 transition-all',
                  newColor === color ? 'border-foreground scale-110' : 'border-transparent'
                )}
                style={{ backgroundColor: color }}
                onClick={() => setNewColor(color)}
                aria-label={`Select color ${color}`}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleCreate}
              disabled={!newName.trim() || isSubmitting}
              className="flex-1"
            >
              Add
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setIsAdding(false)
                setNewName('')
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Category list */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {isLoading ? (
          <div className="space-y-1 p-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 rounded-lg animate-skeleton" />
            ))}
          </div>
        ) : categories.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <div className="rounded-2xl bg-muted/60 p-4 mb-3">
              <FolderOpen className="size-8 text-muted-foreground/60" strokeWidth={1.5} />
            </div>
            <p className="text-sm font-medium text-foreground/80 mb-1">No categories yet</p>
            <p className="text-xs text-muted-foreground mb-3">
              Create your first menu category to start organizing items.
            </p>
            <Button
              size="sm"
              onClick={() => setIsAdding(true)}
            >
              <Plus className="size-3.5 mr-1" />
              Create Category
            </Button>
          </div>
        ) : (
          <div className="p-1.5 space-y-0.5">
            {/* All Items option */}
            <button
              type="button"
              onClick={() => selectCategory(null)}
              className={cn(
                'flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                selectedCategoryId === null
                  ? 'bg-accent text-accent-foreground'
                  : 'text-foreground/70 hover:bg-muted'
              )}
            >
              <Utensils className="size-3.5 text-muted-foreground" />
              <span>All Items</span>
              <div className="flex items-center gap-1 ml-auto">
                {total86d > 0 && (
                  <span className="inline-flex min-w-[18px] h-[18px] items-center justify-center rounded-full bg-destructive/10 px-1 text-[10px] font-bold text-destructive tabular-nums">
                    {total86d}
                  </span>
                )}
                <span className="text-xs text-muted-foreground tabular-nums">{totalItems}</span>
              </div>
            </button>

            {/* Sortable categories */}
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={filteredCategories.map((c) => c.id)}
                strategy={verticalListSortingStrategy}
              >
                {filteredCategories.map((cat) => (
                  <DroppableCategoryWrapper
                    key={cat.id}
                    categoryId={cat.id}
                    isDropTarget={dropTargetCategoryId === cat.id}
                  >
                    <NavTreeNode
                      category={cat}
                      isSelected={selectedCategoryId === cat.id}
                      isExpanded={expandedCategoryIds.has(cat.id)}
                      isDropTarget={dropTargetCategoryId === cat.id}
                      itemCount={categoryItemCounts.counts.get(cat.id) ?? 0}
                      count86d={categoryItemCounts.counts86d.get(cat.id) ?? 0}
                      depth={0}
                      onSelect={selectCategory}
                      onToggleExpand={toggleCategoryExpanded}
                      onRename={onRenameCategory}
                      onDuplicate={onDuplicateCategory}
                      onDelete={onDeleteCategory}
                      onAddSubcategory={() => {
                        // Subcategory support stub - expands for future implementation
                        setIsAdding(true)
                      }}
                    />
                  </DroppableCategoryWrapper>
                ))}
              </SortableContext>

              <DragOverlay>
                {activeDragCategory ? (
                  <div className="flex items-center gap-2 rounded-lg bg-background px-3 py-2.5 text-sm font-medium shadow-lg ring-1 ring-foreground/10 opacity-90">
                    <div
                      className="size-2.5 rounded-full"
                      style={{ backgroundColor: activeDragCategory.color || 'var(--color-primary)' }}
                    />
                    <span>{activeDragCategory.name}</span>
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          </div>
        )}
      </div>
    </div>
  )
}
