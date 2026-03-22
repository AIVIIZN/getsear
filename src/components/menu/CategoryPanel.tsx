'use client'

import { useState, useCallback } from 'react'
import { Plus, GripVertical, Pencil, Trash2, FolderOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export interface MenuCategory {
  id: string
  name: string
  description: string
  color: string
  sort_order: number
  is_active: boolean
  image_url: string | null
}

interface CategoryPanelProps {
  categories: MenuCategory[]
  selectedCategoryId: string | null
  onSelectCategory: (id: string | null) => void
  onCreateCategory: (name: string, color: string) => Promise<void>
  onDeleteCategory: (id: string) => Promise<void>
  onReorderCategories: (items: { id: string; sort_order: number }[]) => Promise<void>
  isLoading: boolean
}

const CATEGORY_COLORS = [
  '#F06B18', '#DC2626', '#16A34A', '#2563EB',
  '#7C3AED', '#D97706', '#0891B2', '#EC4899',
]

export function CategoryPanel({
  categories,
  selectedCategoryId,
  onSelectCategory,
  onCreateCategory,
  onDeleteCategory,
  onReorderCategories,
  isLoading,
}: CategoryPanelProps) {
  const [isAdding, setIsAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(CATEGORY_COLORS[0])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

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

  const handleDragStart = useCallback((index: number) => {
    setDragIndex(index)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault()
    setDragOverIndex(index)
  }, [])

  const handleDrop = useCallback(async (targetIndex: number) => {
    if (dragIndex === null || dragIndex === targetIndex) {
      setDragIndex(null)
      setDragOverIndex(null)
      return
    }

    const reordered = [...categories]
    const [moved] = reordered.splice(dragIndex, 1)
    reordered.splice(targetIndex, 0, moved)

    const reorderItems = reordered.map((cat, idx) => ({
      id: cat.id,
      sort_order: idx,
    }))

    setDragIndex(null)
    setDragOverIndex(null)

    await onReorderCategories(reorderItems)
  }, [dragIndex, categories, onReorderCategories])

  const handleDragEnd = useCallback(() => {
    setDragIndex(null)
    setDragOverIndex(null)
  }, [])

  return (
    <div className="flex h-full w-[240px] flex-shrink-0 flex-col border-r border-border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-3">
        <h2 className="text-sm font-semibold text-foreground">Categories</h2>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => setIsAdding(!isAdding)}
          aria-label="Add category"
        >
          <Plus className="size-4" />
        </Button>
      </div>

      {/* Add category form */}
      {isAdding && (
        <div className="border-b border-border p-3 space-y-2">
          <Input
            placeholder="Category name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate()
              if (e.key === 'Escape') setIsAdding(false)
            }}
            autoFocus
          />
          <div className="flex gap-1.5 flex-wrap">
            {CATEGORY_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                className={cn(
                  'size-6 rounded-full border-2 transition-all touch-target',
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
              className="flex-1 btn-press"
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
              className="btn-press"
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
            <div className="rounded-full bg-muted p-3 mb-3">
              <FolderOpen className="size-5 text-muted-foreground" strokeWidth={1.5} />
            </div>
            <p className="text-sm text-muted-foreground">No categories yet</p>
            <Button
              variant="link"
              size="sm"
              onClick={() => setIsAdding(true)}
              className="mt-1"
            >
              Create your first category
            </Button>
          </div>
        ) : (
          <div className="p-1.5 space-y-0.5">
            {/* "All items" option */}
            <button
              type="button"
              onClick={() => onSelectCategory(null)}
              className={cn(
                'flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors touch-target',
                selectedCategoryId === null
                  ? 'bg-accent text-accent-foreground'
                  : 'text-foreground/70 hover:bg-muted'
              )}
            >
              All Items
            </button>

            {categories.map((cat, index) => (
              <div
                key={cat.id}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={() => handleDrop(index)}
                onDragEnd={handleDragEnd}
                className={cn(
                  'group flex items-center gap-2 rounded-lg transition-all touch-target',
                  dragOverIndex === index && dragIndex !== index && 'border-t-2 border-primary',
                  dragIndex === index && 'opacity-40'
                )}
              >
                <button
                  type="button"
                  onClick={() => onSelectCategory(cat.id)}
                  className={cn(
                    'flex flex-1 items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors min-w-0',
                    selectedCategoryId === cat.id
                      ? 'bg-accent text-accent-foreground'
                      : 'text-foreground/70 hover:bg-muted'
                  )}
                >
                  <div
                    className="size-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: cat.color || '#F06B18' }}
                  />
                  <span className="truncate">{cat.name}</span>
                </button>
                <div className="hidden items-center gap-0.5 pr-1 group-hover:flex">
                  <button
                    type="button"
                    className="p-1 rounded text-muted-foreground hover:text-destructive transition-colors"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDeleteCategory(cat.id)
                    }}
                    aria-label={`Delete ${cat.name}`}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                  <div className="cursor-grab text-muted-foreground">
                    <GripVertical className="size-3.5" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
