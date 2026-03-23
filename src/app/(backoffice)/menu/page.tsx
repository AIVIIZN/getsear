'use client'

import { useState, useEffect, useCallback } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { CategoryPanel, type MenuCategory } from '@/components/menu/CategoryPanel'
import { ItemGrid, type MenuItem } from '@/components/menu/ItemGrid'
import { ItemDetailSheet, type ModifierGroup } from '@/components/menu/ItemDetailSheet'
import { ModifierGroupManager } from '@/components/menu/ModifierGroupManager'

export default function MenuManagerPage() {
  // --- State ---
  const [categories, setCategories] = useState<MenuCategory[]>([])
  const [items, setItems] = useState<MenuItem[]>([])
  const [modifierGroups, setModifierGroups] = useState<ModifierGroup[]>([])
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [isCategoriesLoading, setIsCategoriesLoading] = useState(true)
  const [isItemsLoading, setIsItemsLoading] = useState(true)

  // Item detail sheet state
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null)
  const [isNewItem, setIsNewItem] = useState(false)
  const [linkedModGroupIds, setLinkedModGroupIds] = useState<string[]>([])

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

  useEffect(() => {
    fetchCategories()
    fetchItems()
    fetchModifierGroups()
  }, [fetchCategories, fetchItems, fetchModifierGroups])

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

  const handleDeleteCategory = useCallback(async (id: string) => {
    const res = await fetch(`/api/menu/categories/${id}`, { method: 'DELETE' })
    if (res.ok) {
      if (selectedCategoryId === id) setSelectedCategoryId(null)
      await fetchCategories()
    }
  }, [selectedCategoryId, fetchCategories])

  const handleReorderCategories = useCallback(async (reorderItems: { id: string; sort_order: number }[]) => {
    // Optimistic update
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
    // Optimistic update
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, is_86d: !item.is_86d } : item
      )
    )

    const res = await fetch(`/api/menu/items/${itemId}/86`, { method: 'PATCH' })
    if (!res.ok) {
      // Revert on failure
      setItems((prev) =>
        prev.map((item) =>
          item.id === itemId ? { ...item, is_86d: !item.is_86d } : item
        )
      )
    }
  }, [])

  const handleReorderItems = useCallback(async (reorderItems: { id: string; sort_order: number }[]) => {
    // Optimistic update
    setItems((prev) => {
      const map = new Map(reorderItems.map((r) => [r.id, r.sort_order]))
      return [...prev]
        .map((item) => ({ ...item, sort_order: map.get(item.id) ?? item.sort_order }))
        .sort((a, b) => a.sort_order - b.sort_order)
    })

    await fetch('/api/menu/items/reorder', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: reorderItems }),
    })
  }, [])

  const handleSelectItem = useCallback((item: MenuItem) => {
    setEditingItem(item)
    setIsNewItem(false)
    const linkedIds = (item.menu_item_modifier_groups ?? []).map(
      (link) => link.modifier_group_id
    )
    setLinkedModGroupIds(linkedIds)
    setSheetOpen(true)
  }, [])

  const handleAddItem = useCallback(() => {
    setEditingItem(null)
    setIsNewItem(true)
    setLinkedModGroupIds([])
    setSheetOpen(true)
  }, [])

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
        // If this is a new item, link modifier groups
        if (linkedModGroupIds.length > 0) {
          await fetch(`/api/menu/items/${newItem.id}/modifier-groups`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ modifier_group_ids: linkedModGroupIds }),
          })
        }
        await fetchItems()
        setSheetOpen(false)
      }
    } else if (editingItem) {
      const res = await fetch(`/api/menu/items/${editingItem.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (res.ok) {
        await fetchItems()
        setSheetOpen(false)
      }
    }
  }, [isNewItem, editingItem, linkedModGroupIds, fetchItems])

  const handleDeleteItem = useCallback(async (id: string) => {
    const res = await fetch(`/api/menu/items/${id}`, { method: 'DELETE' })
    if (res.ok) {
      await fetchItems()
      setSheetOpen(false)
    }
  }, [fetchItems])

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

  return (
    <div className="-mx-6 -mt-6 flex h-[calc(100vh-var(--topbar-height))] flex-col overflow-hidden">
      {/* Page header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-3">
        <div>
          <h1 className="page-title">Menu Manager</h1>
          <p className="page-subtitle">
            Manage categories, items, and modifier groups.
          </p>
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
          {/* Left: Category panel */}
          <CategoryPanel
            categories={categories}
            selectedCategoryId={selectedCategoryId}
            onSelectCategory={setSelectedCategoryId}
            onCreateCategory={handleCreateCategory}
            onDeleteCategory={handleDeleteCategory}
            onReorderCategories={handleReorderCategories}
            isLoading={isCategoriesLoading}
          />

          {/* Center: Item grid */}
          <ItemGrid
            items={items}
            categories={categories}
            selectedCategoryId={selectedCategoryId}
            onSelectItem={handleSelectItem}
            onToggle86={handleToggle86}
            onAddItem={handleAddItem}
            onReorderItems={handleReorderItems}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            isLoading={isItemsLoading}
          />

          {/* Right: Item detail sheet (slide-over) */}
          <ItemDetailSheet
            item={editingItem}
            isNew={isNewItem}
            isOpen={sheetOpen}
            onClose={() => setSheetOpen(false)}
            onSave={handleSaveItem}
            onDelete={handleDeleteItem}
            categories={categories}
            modifierGroups={modifierGroups}
            linkedModifierGroupIds={linkedModGroupIds}
            onLinkModifierGroups={handleLinkModifierGroups}
          />
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
    </div>
  )
}
