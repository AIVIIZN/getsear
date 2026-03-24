'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  ChevronRight,
  GripVertical,
  FolderPlus,
  Pencil,
  Copy,
  Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import type { MenuCategory } from './CategoryPanel'

interface NavTreeNodeProps {
  category: MenuCategory
  isSelected: boolean
  isExpanded: boolean
  isDropTarget: boolean
  itemCount: number
  count86d: number
  depth: number
  onSelect: (id: string) => void
  onToggleExpand: (id: string) => void
  onRename: (id: string, name: string) => Promise<void>
  onDuplicate: (id: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onAddSubcategory: (parentId: string) => void
}

export function NavTreeNode({
  category,
  isSelected,
  isExpanded,
  isDropTarget,
  itemCount,
  count86d,
  depth,
  onSelect,
  onToggleExpand,
  onRename,
  onDuplicate,
  onDelete,
  onAddSubcategory,
}: NavTreeNodeProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(category.name)
  const [showContextMenu, setShowContextMenu] = useState(false)
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 })
  const contextMenuRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: category.id,
    data: {
      type: 'category',
      category,
    },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenuPos({ x: e.clientX, y: e.clientY })
    setShowContextMenu(true)
  }, [])

  const handleRenameSubmit = useCallback(async () => {
    const trimmed = editName.trim()
    if (trimmed && trimmed !== category.name) {
      await onRename(category.id, trimmed)
    }
    setIsEditing(false)
  }, [editName, category.id, category.name, onRename])

  const handleStartRename = useCallback(() => {
    setEditName(category.name)
    setIsEditing(true)
    setShowContextMenu(false)
  }, [category.name])

  const handleDuplicate = useCallback(() => {
    setShowContextMenu(false)
    onDuplicate(category.id)
  }, [category.id, onDuplicate])

  const handleDelete = useCallback(() => {
    setShowContextMenu(false)
    onDelete(category.id)
  }, [category.id, onDelete])

  const handleAddSub = useCallback(() => {
    setShowContextMenu(false)
    onAddSubcategory(category.id)
  }, [category.id, onAddSubcategory])

  // Close context menu on click outside
  useEffect(() => {
    if (!showContextMenu) return
    const handleClick = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setShowContextMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showContextMenu])

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className={cn(
          'group relative flex items-center rounded-lg transition-all',
          isDragging && 'opacity-40 z-50',
          isDropTarget && 'ring-2 ring-[#007AFF] bg-[#007AFF]/5',
          isSelected && !isDropTarget && 'bg-accent text-accent-foreground',
          !isSelected && !isDropTarget && 'hover:bg-muted',
        )}
        onContextMenu={handleContextMenu}
      >
        {/* Expand button for categories with children (future subcategory support) */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onToggleExpand(category.id)
          }}
          className={cn(
            'flex size-6 items-center justify-center flex-shrink-0 text-muted-foreground/60',
            depth > 0 && 'ml-4'
          )}
          aria-label={isExpanded ? 'Collapse' : 'Expand'}
        >
          <ChevronRight
            className={cn(
              'size-3.5 transition-transform',
              isExpanded && 'rotate-90'
            )}
          />
        </button>

        {/* Category button */}
        {isEditing ? (
          <div className="flex-1 min-w-0 py-1 pr-2">
            <Input
              ref={inputRef as React.Ref<HTMLInputElement>}
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRenameSubmit()
                if (e.key === 'Escape') setIsEditing(false)
              }}
              onBlur={handleRenameSubmit}
              className="h-7 text-sm"
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => onSelect(category.id)}
            className="flex flex-1 items-center gap-2 min-w-0 py-2.5 pr-2 text-sm font-medium"
          >
            <div
              className="size-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: category.color || '#007AFF' }}
            />
            <span className="truncate">{category.name}</span>
            <div className="flex items-center gap-1 ml-auto flex-shrink-0">
              {count86d > 0 && (
                <span className="inline-flex min-w-[18px] h-[18px] items-center justify-center rounded-full bg-destructive/10 px-1 text-[10px] font-bold text-destructive tabular-nums">
                  {count86d}
                </span>
              )}
              <span className="text-xs text-muted-foreground tabular-nums">
                {itemCount}
              </span>
            </div>
          </button>
        )}

        {/* Drag handle */}
        <div
          {...attributes}
          {...listeners}
          className="hidden cursor-grab items-center px-1 text-muted-foreground/60 group-hover:flex"
        >
          <GripVertical className="size-3.5" />
        </div>
      </div>

      {/* Context menu */}
      {showContextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed z-[100] min-w-[160px] rounded-lg bg-popover p-1 shadow-lg ring-1 ring-foreground/10"
          style={{ left: contextMenuPos.x, top: contextMenuPos.y }}
        >
          <button
            type="button"
            onClick={handleStartRename}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent transition-colors"
          >
            <Pencil className="size-3.5" />
            Rename
          </button>
          <button
            type="button"
            onClick={handleDuplicate}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent transition-colors"
          >
            <Copy className="size-3.5" />
            Duplicate
          </button>
          <button
            type="button"
            onClick={handleAddSub}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent transition-colors"
          >
            <FolderPlus className="size-3.5" />
            Add Subcategory
          </button>
          <div className="my-1 h-px bg-border" />
          <button
            type="button"
            onClick={handleDelete}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-destructive hover:bg-destructive/10 transition-colors"
          >
            <Trash2 className="size-3.5" />
            Delete
          </button>
        </div>
      )}
    </>
  )
}
