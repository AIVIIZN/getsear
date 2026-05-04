'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
  closestCenter,
  pointerWithin,
  rectIntersection,
  type CollisionDetection,
} from '@dnd-kit/core'
import {
  SortableContext,
  rectSortingStrategy,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import {
  Plus,
  Search,
  LayoutGrid,
  List,
  CheckSquare,
  Zap,
  Filter,
  ImageIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { NavTree } from './NavTree'
import { ItemCard } from './ItemCard'
import { ItemListRow } from './ItemListRow'
import { DetailEditor } from './DetailEditor'
import { BulkActionsBar } from './BulkActionsBar'
import { QuickAddSpecial } from './QuickAddSpecial'
import { ModifierGroupManager } from './ModifierGroupManager'
import { useMenuBuilderStore, type FilterMode } from '@/stores/menu-builder-store'
import type { MenuCategory } from './CategoryPanel'
import type { MenuItem } from './ItemGrid'
import type { ModifierGroup } from './ItemDetailSheet'
import type { MenuItemPhoto } from './tabs/PhotosTab'

const FILTER_PILLS: { value: FilterMode; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: '86d', label: "86'd" },
  { value: 'has_photo', label: 'Has Photo' },
  { value: 'no_photo', label: 'No Photo' },
]

export function MenuBuilder() {
  // --- Data state ---
  const [categories, setCategories] = useState<MenuCategory[]>([])
  const [items, setItems] = useState<MenuItem[]>([])
  const [modifierGroups, setModifierGroups] = useState<ModifierGroup[]>([])
  const [isCategoriesLoading, setIsCategoriesLoading] = useState(true)
  const [isItemsLoading, setIsItemsLoading] = useState(true)
  const [photos, setPhotos] = useState<MenuItemPhoto[]>([])
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false)
  const [isGeneratingPhoto, setIsGeneratingPhoto] = useState(false)
  const [generatedPhotoPreviewUrl, setGeneratedPhotoPreviewUrl] = useState<string | null>(null)

  // --- Drag state ---
  const [activeDragItem, setActiveDragItem] = useState<MenuItem | null>(null)
  const [dropTargetCategoryId, setDropTargetCategoryId] = useState<string | null>(null)

  // --- Item detail state ---
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null)
  const [isNewItem, setIsNewItem] = useState(false)
  const [linkedModGroupIds, setLinkedModGroupIds] = useState<string[]>([])

  // --- Store ---
  const {
    selectedCategoryId,
    selectedItemId,
    selectedItemIds,
    searchQuery,
    filterMode,
    viewMode,
    isDetailOpen,
    isMultiSelectMode,
    isQuickAddOpen,
    selectCategory,
    selectItem,
    toggleItemSelection,
    selectAllItems,
    clearSelection,
    setSearchQuery,
    setFilterMode,
    setViewMode,
    openDetail,
    closeDetail,
    toggleMultiSelect,
    setQuickAddOpen,
  } = useMenuBuilderStore()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 10 } })
  )

  // --- Data fetching ---
  const fetchCategories = useCallback(async () => {
    setIsCategoriesLoading(true)
    try {
      const res = await fetch('/api/menu/categories')
      if (res.ok) {
        const json = await res.json()
        setCategories(json.data ?? [])
      }
    } finally {
      setIsCategoriesLoading(false)
    }
  }, [])

  const fetchItems = useCallback(async () => {
    setIsItemsLoading(true)
    try {
      const res = await fetch('/api/menu/items')
      if (res.ok) {
        const json = await res.json()
        setItems(json.data ?? [])
      }
    } finally {
      setIsItemsLoading(false)
    }
  }, [])

  const fetchModifierGroups = useCallback(async () => {
    try {
      const res = await fetch('/api/menu/modifier-groups')
      if (res.ok) {
        const json = await res.json()
        setModifierGroups(json.data ?? [])
      }
    } catch {
      // silently fail
    }
  }, [])

  const fetchPhotos = useCallback(async (itemId: string) => {
    try {
      const res = await fetch(`/api/menu/photos?item_id=${itemId}`)
      if (res.ok) {
        const json = await res.json()
        setPhotos(json.data ?? [])
      }
    } catch {
      setPhotos([])
    }
  }, [])

  useEffect(() => {
    fetchCategories()
    fetchItems()
    fetchModifierGroups()
  }, [fetchCategories, fetchItems, fetchModifierGroups])

  // Fetch photos when item changes
  useEffect(() => {
    if (editingItem?.id) {
      fetchPhotos(editingItem.id)
    } else {
      setPhotos([])
    }
    setGeneratedPhotoPreviewUrl(null)
  }, [editingItem?.id, fetchPhotos])

  // --- Filtered items ---
  const filteredItems = useMemo(() => {
    let filtered = items

    // Category filter
    if (selectedCategoryId) {
      filtered = filtered.filter((item) => item.category_id === selectedCategoryId)
    }

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          (item.short_name && item.short_name.toLowerCase().includes(q)) ||
          (item.plu_code && item.plu_code.toLowerCase().includes(q))
      )
    }

    // Filter mode
    switch (filterMode) {
      case 'active':
        filtered = filtered.filter((item) => item.is_active && !item.is_86d)
        break
      case '86d':
        filtered = filtered.filter((item) => item.is_86d)
        break
      case 'has_photo':
        filtered = filtered.filter((item) => item.image_url)
        break
      case 'no_photo':
        filtered = filtered.filter((item) => !item.image_url)
        break
    }

    return filtered.sort((a, b) => a.sort_order - b.sort_order)
  }, [items, selectedCategoryId, searchQuery, filterMode])

  // --- Category actions ---
  const handleCreateCategory = useCallback(async (name: string, color: string) => {
    const res = await fetch('/api/menu/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, color }),
    })
    if (res.ok) {
      await fetchCategories()
    }
  }, [fetchCategories])

  const handleRenameCategory = useCallback(async (id: string, name: string) => {
    const res = await fetch(`/api/menu/categories/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    if (res.ok) {
      await fetchCategories()
    }
  }, [fetchCategories])

  const handleDuplicateCategory = useCallback(async (id: string) => {
    const cat = categories.find((c) => c.id === id)
    if (!cat) return
    await handleCreateCategory(`${cat.name} (Copy)`, cat.color)
  }, [categories, handleCreateCategory])

  const handleDeleteCategory = useCallback(async (id: string) => {
    if (!window.confirm('Delete this category? Items will be unassigned.')) return
    const res = await fetch(`/api/menu/categories/${id}`, { method: 'DELETE' })
    if (res.ok) {
      if (selectedCategoryId === id) selectCategory(null)
      await fetchCategories()
    }
  }, [selectedCategoryId, selectCategory, fetchCategories])

  const handleReorderCategories = useCallback(async (reorderItems: { id: string; sort_order: number }[]) => {
    // Optimistic
    setCategories((prev) => {
      const map = new Map(reorderItems.map((r) => [r.id, r.sort_order]))
      return [...prev]
        .map((c) => ({ ...c, sort_order: map.get(c.id) ?? c.sort_order }))
        .sort((a, b) => a.sort_order - b.sort_order)
    })
    await fetch('/api/menu/categories/reorder', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: reorderItems }),
    })
  }, [])

  // --- Item actions ---
  const handleToggle86 = useCallback(async (itemId: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, is_86d: !item.is_86d } : item
      )
    )
    const res = await fetch(`/api/menu/items/${itemId}/86`, { method: 'PATCH' })
    if (!res.ok) {
      setItems((prev) =>
        prev.map((item) =>
          item.id === itemId ? { ...item, is_86d: !item.is_86d } : item
        )
      )
    }
  }, [])

  const handleReorderItems = useCallback(async (reorderPayload: { id: string; sort_order: number }[]) => {
    setItems((prev) => {
      const map = new Map(reorderPayload.map((r) => [r.id, r.sort_order]))
      return [...prev]
        .map((item) => ({ ...item, sort_order: map.get(item.id) ?? item.sort_order }))
        .sort((a, b) => a.sort_order - b.sort_order)
    })
    await fetch('/api/menu/items/reorder', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: reorderPayload }),
    })
  }, [])

  const handleMoveItemToCategory = useCallback(async (itemId: string, categoryId: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, category_id: categoryId } : item
      )
    )
    await fetch(`/api/menu/items/${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category_id: categoryId }),
    })
  }, [])

  const handleSelectItem = useCallback((item: MenuItem) => {
    setEditingItem(item)
    setIsNewItem(false)
    const linkedIds = (item.menu_item_modifier_groups ?? []).map(
      (link) => link.modifier_group_id
    )
    setLinkedModGroupIds(linkedIds)
    openDetail(item.id)
  }, [openDetail])

  const handleAddItem = useCallback(() => {
    setEditingItem(null)
    setIsNewItem(true)
    setLinkedModGroupIds([])
    openDetail('new')
  }, [openDetail])

  const handleSaveItem = useCallback(async (data: Partial<MenuItem>) => {
    if (isNewItem) {
      const res = await fetch('/api/menu/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (res.ok) {
        const json = await res.json()
        const newItem = json.data as MenuItem
        if (linkedModGroupIds.length > 0) {
          await fetch(`/api/menu/items/${newItem.id}/modifier-groups`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ modifier_group_ids: linkedModGroupIds }),
          })
        }
        await fetchItems()
        closeDetail()
      }
    } else if (editingItem) {
      const res = await fetch(`/api/menu/items/${editingItem.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (res.ok) {
        await fetchItems()
        closeDetail()
      }
    }
  }, [isNewItem, editingItem, linkedModGroupIds, fetchItems, closeDetail])

  const handleDeleteItem = useCallback(async (id: string) => {
    const res = await fetch(`/api/menu/items/${id}`, { method: 'DELETE' })
    if (res.ok) {
      await fetchItems()
      closeDetail()
    }
  }, [fetchItems, closeDetail])

  const handleLinkModifierGroups = useCallback(async (itemId: string, groupIds: string[]) => {
    await fetch(`/api/menu/items/${itemId}/modifier-groups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modifier_group_ids: groupIds }),
    })
    await fetchItems()
  }, [fetchItems])

  // --- Modifier group actions ---
  const handleCreateModifierGroup = useCallback(async (data: {
    name: string
    is_required: boolean
    min_selections: number
    max_selections: number
    modifiers: { name: string; price: string; is_active: boolean }[]
  }) => {
    const res = await fetch('/api/menu/modifier-groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (res.ok) {
      await fetchModifierGroups()
    }
  }, [fetchModifierGroups])

  const handleUpdateModifierGroup = useCallback(async (id: string, data: {
    name?: string
    is_required?: boolean
    min_selections?: number
    max_selections?: number
    modifiers?: { id?: string; name: string; price: string; is_active: boolean; sort_order?: number }[]
  }) => {
    const res = await fetch(`/api/menu/modifier-groups/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (res.ok) {
      await fetchModifierGroups()
    }
  }, [fetchModifierGroups])

  const handleDeleteModifierGroup = useCallback(async (id: string) => {
    const res = await fetch(`/api/menu/modifier-groups/${id}`, { method: 'DELETE' })
    if (res.ok) {
      await fetchModifierGroups()
    }
  }, [fetchModifierGroups])

  // --- Photo actions ---
  const handleUploadPhoto = useCallback(async (itemId: string, file: File) => {
    setIsUploadingPhoto(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('item_id', itemId)

      const res = await fetch('/api/menu/photos', {
        method: 'POST',
        body: formData,
      })
      if (res.ok) {
        await fetchPhotos(itemId)
        await fetchItems() // Refresh to get updated image_url
      }
    } finally {
      setIsUploadingPhoto(false)
    }
  }, [fetchPhotos, fetchItems])

  const handleDeletePhoto = useCallback(async (photoId: string) => {
    const res = await fetch(`/api/menu/photos/${photoId}`, { method: 'DELETE' })
    if (res.ok && editingItem?.id) {
      await fetchPhotos(editingItem.id)
      await fetchItems()
    }
  }, [editingItem?.id, fetchPhotos, fetchItems])

  const handleGeneratePhoto = useCallback(async (itemId: string): Promise<{ url: string } | null> => {
    setIsGeneratingPhoto(true)
    try {
      const res = await fetch(`/api/menu/items/${itemId}/photo/generate`, {
        method: 'POST',
      })
      if (!res.ok) {
        let message = 'Photo generation failed'
        try {
          const body = await res.json()
          if (typeof body?.error === 'string') message = body.error
        } catch {
          // ignore JSON parse errors
        }
        throw new Error(message)
      }
      const json = await res.json()
      const url = json?.data?.url as string | undefined
      if (!url) throw new Error('Generation returned no URL')
      setGeneratedPhotoPreviewUrl(url)
      await fetchItems()
      return { url }
    } finally {
      setIsGeneratingPhoto(false)
    }
  }, [fetchItems])

  const handleReorderPhotos = useCallback(async (itemId: string, photoIds: string[]) => {
    await fetch(`/api/menu/photos/${photoIds[0]}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photo_ids: photoIds }),
    })
    await fetchPhotos(itemId)
  }, [fetchPhotos])

  // --- Bulk actions ---
  const handleBulk86 = useCallback(async (ids: string[]) => {
    for (const id of ids) {
      await handleToggle86(id)
    }
    clearSelection()
  }, [handleToggle86, clearSelection])

  const handleBulkActivate = useCallback(async (ids: string[]) => {
    for (const id of ids) {
      const item = items.find((i) => i.id === id)
      if (item?.is_86d) {
        await handleToggle86(id)
      }
    }
    clearSelection()
  }, [items, handleToggle86, clearSelection])

  const handleBulkDelete = useCallback(async (ids: string[]) => {
    for (const id of ids) {
      await fetch(`/api/menu/items/${id}`, { method: 'DELETE' })
    }
    await fetchItems()
    clearSelection()
  }, [fetchItems, clearSelection])

  const handleBulkMoveToCategory = useCallback(async (ids: string[], categoryId: string) => {
    for (const id of ids) {
      await handleMoveItemToCategory(id, categoryId)
    }
    clearSelection()
  }, [handleMoveItemToCategory, clearSelection])

  // --- Quick add ---
  const handleQuickAddSave = useCallback(async (data: {
    name: string
    price: string
    category_id: string
    description: string
    prep_station: string | null
    allergens: string[] | null
    availability_preset: string
  }) => {
    const res = await fetch('/api/menu/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: data.name,
        price: data.price,
        category_id: data.category_id,
        description: data.description,
        prep_station: data.prep_station,
        allergens: data.allergens,
        is_active: true,
      }),
    })
    if (res.ok) {
      await fetchItems()
    }
  }, [fetchItems])

  // --- Cross-panel DnD (item from grid dropped on NavTree category) ---
  const handleItemDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current
    if (data?.type === 'item') {
      setActiveDragItem(data.item as MenuItem)
    }
  }, [])

  const handleItemDragOver = useCallback((event: DragOverEvent) => {
    const overData = event.over?.data.current
    if (overData?.type === 'category-drop-target') {
      setDropTargetCategoryId(overData.categoryId as string)
    } else {
      setDropTargetCategoryId(null)
    }
  }, [])

  const handleItemDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveDragItem(null)
    setDropTargetCategoryId(null)

    if (!over) return

    const activeData = active.data.current
    const overData = over.data.current

    // Item dropped on a category
    if (activeData?.type === 'item' && overData?.type === 'category-drop-target') {
      const itemId = active.id as string
      const targetCategoryId = overData.categoryId as string
      const item = items.find((i) => i.id === itemId)
      if (item && item.category_id !== targetCategoryId) {
        await handleMoveItemToCategory(itemId, targetCategoryId)
      }
      return
    }

    // Item reorder within grid
    if (activeData?.type === 'item' && overData?.type === 'item') {
      const oldIndex = filteredItems.findIndex((i) => i.id === active.id)
      const newIndex = filteredItems.findIndex((i) => i.id === over.id)
      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        const reordered = arrayMove(filteredItems, oldIndex, newIndex)
        const reorderPayload = reordered.map((item, idx) => ({
          id: item.id,
          sort_order: idx,
        }))
        await handleReorderItems(reorderPayload)
      }
    }
  }, [items, filteredItems, handleMoveItemToCategory, handleReorderItems])

  const categoryName = selectedCategoryId
    ? categories.find((c) => c.id === selectedCategoryId)?.name ?? 'Category'
    : 'All Items'

  const handleCloseDetail = useCallback(() => {
    closeDetail()
    setEditingItem(null)
    setIsNewItem(false)
  }, [closeDetail])

  return (
    <div className="-mx-6 -mt-6 flex h-[calc(100vh-var(--topbar-height))] flex-col overflow-hidden">
      {/* Page header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-3">
        <div>
          <h1 className="page-title">Menu Builder</h1>
          <p className="page-subtitle">
            Build and manage your menu with categories, items, modifiers, and photos.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setQuickAddOpen(true)}
          >
            <Zap className="size-3.5 mr-1" />
            Quick Add
          </Button>
        </div>
      </div>

      {/* Main content tabs */}
      <Tabs defaultValue="items" className="flex flex-1 flex-col overflow-hidden">
        <div className="border-b border-border px-6">
          <TabsList variant="line">
            <TabsTrigger value="items">Items</TabsTrigger>
            <TabsTrigger value="modifiers">Modifier Groups</TabsTrigger>
          </TabsList>
        </div>

        {/* Items tab — 3-panel layout */}
        <TabsContent value="items" className="flex flex-1 overflow-hidden mt-0">
          <DndContext
            sensors={sensors}
            onDragStart={handleItemDragStart}
            onDragOver={handleItemDragOver}
            onDragEnd={handleItemDragEnd}
          >
            {/* Left: NavTree */}
            <NavTree
              categories={categories}
              items={items}
              onCreateCategory={handleCreateCategory}
              onRenameCategory={handleRenameCategory}
              onDuplicateCategory={handleDuplicateCategory}
              onDeleteCategory={handleDeleteCategory}
              onReorderCategories={handleReorderCategories}
              onMoveItemToCategory={handleMoveItemToCategory}
              isLoading={isCategoriesLoading}
              dropTargetCategoryId={dropTargetCategoryId}
            />

            {/* Center: Item grid/list */}
            <div className="flex flex-1 flex-col overflow-hidden">
              {/* Toolbar */}
              <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <h2 className="text-sm font-semibold text-foreground truncate">{categoryName}</h2>
                  <span className="text-xs text-muted-foreground tabular-nums flex-shrink-0">
                    {filteredItems.length} item{filteredItems.length !== 1 ? 's' : ''}
                  </span>
                </div>

                <div className="flex-1" />

                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search items..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-7 w-[180px] pl-7 text-xs"
                  />
                </div>

                {/* Filter pills */}
                <div className="flex gap-1">
                  {FILTER_PILLS.map((pill) => (
                    <button
                      key={pill.value}
                      type="button"
                      onClick={() => setFilterMode(pill.value)}
                      className={cn(
                        'rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                        filterMode === pill.value
                          ? 'border-[#007AFF] bg-[#007AFF]/10 text-[#007AFF]'
                          : 'border-border text-muted-foreground hover:bg-muted'
                      )}
                    >
                      {pill.label}
                    </button>
                  ))}
                </div>

                {/* View toggle */}
                <div className="flex rounded-lg border border-border overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setViewMode('grid')}
                    className={cn(
                      'p-1.5 transition-colors',
                      viewMode === 'grid' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted'
                    )}
                    aria-label="Grid view"
                  >
                    <LayoutGrid className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('list')}
                    className={cn(
                      'p-1.5 transition-colors',
                      viewMode === 'list' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted'
                    )}
                    aria-label="List view"
                  >
                    <List className="size-3.5" />
                  </button>
                </div>

                {/* Multi-select toggle */}
                <Button
                  variant={isMultiSelectMode ? 'default' : 'outline'}
                  size="icon-sm"
                  onClick={toggleMultiSelect}
                  aria-label="Toggle multi-select"
                >
                  <CheckSquare className="size-3.5" />
                </Button>

                {/* Add item */}
                <Button size="sm" onClick={handleAddItem}>
                  <Plus className="size-3.5 mr-1" />
                  Add Item
                </Button>
              </div>

              {/* Items area */}
              <div className="flex-1 overflow-y-auto p-4">
                {isItemsLoading ? (
                  <div className={cn(
                    'gap-3',
                    viewMode === 'grid'
                      ? 'grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                      : 'flex flex-col'
                  )}>
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div
                        key={i}
                        className={cn(
                          'animate-skeleton rounded-xl',
                          viewMode === 'grid' ? 'h-[180px]' : 'h-[56px]'
                        )}
                      />
                    ))}
                  </div>
                ) : filteredItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="rounded-2xl bg-muted/60 p-5 mb-4">
                      <ImageIcon className="size-10 text-muted-foreground/40" strokeWidth={1.5} />
                    </div>
                    <h3 className="text-base font-semibold text-foreground mb-1">
                      {searchQuery
                        ? 'No items match your search'
                        : filterMode !== 'all'
                          ? `No ${filterMode.replace('_', ' ')} items`
                          : 'No items in this category'}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      {searchQuery
                        ? 'Try a different search term or filter'
                        : 'Add your first item to get started'}
                    </p>
                    {!searchQuery && filterMode === 'all' && (
                      <div className="flex gap-2">
                        <Button onClick={handleAddItem}>
                          <Plus className="size-3.5 mr-1" />
                          Add Item
                        </Button>
                        <Button variant="outline" onClick={() => setQuickAddOpen(true)}>
                          <Zap className="size-3.5 mr-1" />
                          Quick Add
                        </Button>
                      </div>
                    )}
                  </div>
                ) : viewMode === 'grid' ? (
                  <SortableContext
                    items={filteredItems.map((i) => i.id)}
                    strategy={rectSortingStrategy}
                  >
                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
                      {filteredItems.map((item) => (
                        <ItemCard
                          key={item.id}
                          item={item}
                          isSelected={editingItem?.id === item.id && isDetailOpen}
                          isMultiSelected={selectedItemIds.has(item.id)}
                          isMultiSelectMode={isMultiSelectMode}
                          onSelect={handleSelectItem}
                          onToggleMultiSelect={toggleItemSelection}
                        />
                      ))}
                    </div>
                  </SortableContext>
                ) : (
                  <SortableContext
                    items={filteredItems.map((i) => i.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-1">
                      {filteredItems.map((item) => {
                        const catName = categories.find((c) => c.id === item.category_id)?.name ?? ''
                        return (
                          <ItemListRow
                            key={item.id}
                            item={item}
                            isSelected={editingItem?.id === item.id && isDetailOpen}
                            isMultiSelected={selectedItemIds.has(item.id)}
                            isMultiSelectMode={isMultiSelectMode}
                            categoryName={catName}
                            onSelect={handleSelectItem}
                            onToggleMultiSelect={toggleItemSelection}
                            onToggle86={handleToggle86}
                          />
                        )
                      })}
                    </div>
                  </SortableContext>
                )}
              </div>

              {/* Bulk actions bar */}
              {isMultiSelectMode && selectedItemIds.size > 0 && (
                <BulkActionsBar
                  selectedCount={selectedItemIds.size}
                  selectedItemIds={Array.from(selectedItemIds)}
                  categories={categories}
                  onAction={async (action, params) => {
                    const ids = Array.from(selectedItemIds)
                    switch (action) {
                      case '86':
                        await handleBulk86(ids)
                        break
                      case 'restore':
                        await handleBulkActivate(ids)
                        break
                      case 'delete':
                        await handleBulkDelete(ids)
                        break
                      case 'move':
                        if (params?.categoryId) {
                          await handleBulkMoveToCategory(ids, params.categoryId as string)
                        }
                        break
                    }
                  }}
                  onSelectAll={() => selectAllItems(filteredItems.map(i => i.id))}
                  onDeselectAll={clearSelection}
                />
              )}
            </div>

            {/* Drag overlay */}
            <DragOverlay>
              {activeDragItem ? (
                <div className="flex items-center gap-2 rounded-lg bg-card px-3 py-2 shadow-lg ring-1 ring-foreground/10 opacity-80 max-w-[200px]">
                  {activeDragItem.image_url ? (
                    <img
                      src={activeDragItem.image_url}
                      alt=""
                      className="size-8 rounded object-cover"
                    />
                  ) : (
                    <div className="size-8 rounded bg-muted flex items-center justify-center">
                      <ImageIcon className="size-4 text-muted-foreground/40" />
                    </div>
                  )}
                  <span className="text-sm font-medium text-foreground truncate">
                    {activeDragItem.name}
                  </span>
                </div>
              ) : null}
            </DragOverlay>

            {/* Right: Detail editor */}
            <DetailEditor
              item={editingItem}
              isNew={isNewItem}
              isOpen={isDetailOpen}
              onClose={handleCloseDetail}
              onSave={handleSaveItem}
              onDelete={handleDeleteItem}
              categories={categories}
              modifierGroups={modifierGroups}
              linkedModifierGroupIds={linkedModGroupIds}
              onLinkModifierGroups={handleLinkModifierGroups}
              onCreateModifierGroup={handleCreateModifierGroup}
              onUploadPhoto={handleUploadPhoto}
              onDeletePhoto={handleDeletePhoto}
              onReorderPhotos={handleReorderPhotos}
              onGeneratePhoto={handleGeneratePhoto}
              photos={photos}
              isUploadingPhoto={isUploadingPhoto}
              isGeneratingPhoto={isGeneratingPhoto}
              generatedPhotoPreviewUrl={generatedPhotoPreviewUrl}
            />
          </DndContext>
        </TabsContent>

        {/* Modifier groups tab */}
        <TabsContent value="modifiers" className="flex-1 overflow-y-auto p-6 mt-0">
          <ModifierGroupManager
            groups={modifierGroups}
            onCreateGroup={handleCreateModifierGroup}
            onUpdateGroup={handleUpdateModifierGroup}
            onDeleteGroup={handleDeleteModifierGroup}
          />
        </TabsContent>
      </Tabs>

      {/* Quick Add overlay */}
      <QuickAddSpecial
        isOpen={isQuickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        categories={categories}
        onSave={handleQuickAddSave}
      />
    </div>
  )
}
