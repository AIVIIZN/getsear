'use client'

import { useEffect, useState, useCallback } from 'react'
import { OrderPanel } from '@/components/pos/OrderPanel'
import { MenuGrid } from '@/components/pos/MenuGrid'
import { QuickActions } from '@/components/pos/QuickActions'
import { ModifierSheet } from '@/components/pos/ModifierSheet'
import { useOrderStore } from '@/stores/order-store'
import { useMenuStore } from '@/stores/menu-store'
import { toast } from 'sonner'

interface MenuItemWithModifiers {
  id: string
  name: string
  price_cents: number
  category_id: string
  is_available: boolean
  modifier_groups: {
    id: string
    name: string
    is_required: boolean
    min_selections: number
    max_selections: number
    modifiers: {
      id: string
      name: string
      price_cents: number
      is_available: boolean
      sort_order: number
    }[]
  }[]
}

interface SelectedModifier {
  modifier_id: string
  modifier_group_id: string
  name: string
  price_cents: number
  quantity: number
}

export default function OrdersPage() {
  const currentOrder = useOrderStore((s) => s.currentOrder)
  const { addItem, newOrder, clearCurrentOrder } = useOrderStore((s) => s.actions)
  const { setCategories, setItems, setLoading } = useMenuStore((s) => s.actions)

  const [modifierItem, setModifierItem] = useState<MenuItemWithModifiers | null>(null)
  const [modifierSheetOpen, setModifierSheetOpen] = useState(false)
  const [isSending, setIsSending] = useState(false)

  // Fetch menu data on mount
  useEffect(() => {
    async function loadMenu() {
      setLoading(true)
      try {
        const [catRes, itemRes] = await Promise.all([
          fetch('/api/menu/categories'),
          fetch('/api/menu/items'),
        ])

        if (catRes.ok) {
          const catJson = await catRes.json()
          setCategories(
            (catJson.data ?? []).map(
              (c: { id: string; name: string; color?: string; sort_order: number; is_active: boolean }) => ({
                id: c.id,
                name: c.name,
                color: c.color ?? '',
                sort_order: c.sort_order ?? 0,
                is_active: c.is_active ?? true,
                item_count: 0,
              })
            )
          )
        }

        if (itemRes.ok) {
          const itemJson = await itemRes.json()
          setItems(
            (itemJson.data ?? []).map(
              (i: {
                id: string
                name: string
                description?: string
                price: string
                category_id: string
                is_active: boolean
                is_86d?: boolean
                is_taxable?: boolean
                sort_order: number
                image_url?: string | null
                allergens?: string[] | null
                menu_item_modifier_groups?: { modifier_group_id: string }[]
              }) => ({
                id: i.id,
                name: i.name,
                description: i.description ?? '',
                price_cents: Math.round(parseFloat(i.price) * 100),
                category_id: i.category_id,
                is_available: i.is_active && !i.is_86d,
                is_taxable: i.is_taxable ?? true,
                sort_order: i.sort_order ?? 0,
                image_url: i.image_url ?? null,
                allergens: i.allergens ?? [],
                modifier_groups: [], // Loaded on-demand when item tapped
              })
            )
          )
        }
      } catch {
        toast.error('Failed to load menu')
      } finally {
        setLoading(false)
      }
    }

    loadMenu()
  }, [setCategories, setItems, setLoading])

  // Auto-create a draft order if none exists
  useEffect(() => {
    if (!currentOrder) {
      newOrder({
        order_type: 'dine_in',
        server_id: 'current-user', // Placeholder, replaced on send
        server_name: 'Server',
      })
    }
  }, [currentOrder, newOrder])

  // Handle item tap from menu grid
  const handleItemTap = useCallback(
    async (item: { id: string; name: string; price_cents: number; modifier_groups: { id: string; is_required: boolean }[] }) => {
      const hasRequiredModifiers = item.modifier_groups.some((g) => g.is_required)

      if (hasRequiredModifiers || item.modifier_groups.length > 0) {
        // Load full modifier data
        try {
          const res = await fetch(`/api/menu/items/${item.id}/modifier-groups`)
          if (res.ok) {
            const json = await res.json()
            setModifierItem({
              ...item,
              category_id: '',
              is_available: true,
              modifier_groups: (json.data ?? []).map(
                (g: {
                  id: string
                  name: string
                  is_required: boolean
                  min_selections: number
                  max_selections: number
                  modifiers: { id: string; name: string; price_adjustment: string; is_active: boolean; sort_order: number }[]
                }) => ({
                  id: g.id,
                  name: g.name,
                  is_required: g.is_required,
                  min_selections: g.min_selections ?? 0,
                  max_selections: g.max_selections ?? 10,
                  modifiers: (g.modifiers ?? []).map(
                    (m: { id: string; name: string; price_adjustment: string; is_active: boolean; sort_order: number }) => ({
                      id: m.id,
                      name: m.name,
                      price_cents: Math.round(parseFloat(m.price_adjustment ?? '0') * 100),
                      is_available: m.is_active ?? true,
                      sort_order: m.sort_order ?? 0,
                    })
                  ),
                })
              ),
            })
            setModifierSheetOpen(true)
          } else {
            // Fallback — add without modifiers
            addItem({
              menu_item_id: item.id,
              name: item.name,
              price_cents: item.price_cents,
            })
          }
        } catch {
          addItem({
            menu_item_id: item.id,
            name: item.name,
            price_cents: item.price_cents,
          })
        }
      } else {
        // No modifiers — add directly
        addItem({
          menu_item_id: item.id,
          name: item.name,
          price_cents: item.price_cents,
        })
      }
    },
    [addItem]
  )

  // Handle adding item with modifiers from sheet
  const handleAddWithModifiers = useCallback(
    (modifiers: SelectedModifier[], specialInstructions: string) => {
      if (!modifierItem) return
      addItem({
        menu_item_id: modifierItem.id,
        name: modifierItem.name,
        price_cents: modifierItem.price_cents,
        modifiers: modifiers.map((m) => ({
          id: crypto.randomUUID(),
          modifier_id: m.modifier_id,
          name: m.name,
          price_cents: m.price_cents,
          quantity: m.quantity,
        })),
        special_instructions: specialInstructions,
      })
      setModifierItem(null)
    },
    [modifierItem, addItem]
  )

  // Send to kitchen
  const handleSendToKitchen = useCallback(async () => {
    if (!currentOrder || isSending) return

    setIsSending(true)
    try {
      // First persist the order if it's new (draft with no server-side ID)
      let orderId = currentOrder.id

      if (currentOrder.status === 'draft' && !currentOrder.order_number) {
        // Create order on server
        const createRes = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            order_type: currentOrder.order_type,
            location_id: currentOrder.table_id ? undefined : undefined, // Location from context
            table_id: currentOrder.table_id,
            guest_count: currentOrder.guest_count,
            notes: currentOrder.notes,
          }),
        })

        if (!createRes.ok) {
          toast.error('Failed to create order')
          return
        }

        const createJson = await createRes.json()
        orderId = createJson.data.id

        // Add each item to the server
        for (const item of currentOrder.items.filter((i) => !i.voided)) {
          await fetch(`/api/orders/${orderId}/items`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              menu_item_id: item.menu_item_id,
              name: item.name,
              unit_price: (item.price_cents / 100).toFixed(2),
              quantity: item.quantity,
              seat_number: item.seat_number,
              course: item.course,
              notes: item.special_instructions,
              modifiers: item.modifiers.map((m) => ({
                modifier_id: m.modifier_id,
                name: m.name,
                price_adjustment: (m.price_cents / 100).toFixed(2),
                quantity: m.quantity,
              })),
            }),
          })
        }
      }

      // Send to kitchen
      const sendRes = await fetch(`/api/orders/${orderId}/send`, {
        method: 'POST',
      })

      if (sendRes.ok) {
        toast.success('Order sent to kitchen!', {
          description: `${currentOrder.items.filter((i) => !i.voided && i.status === 'pending').length} items sent`,
        })

        // Clear and start fresh
        clearCurrentOrder()
      } else {
        toast.error('Failed to send order')
      }
    } catch {
      toast.error('Network error — could not send order')
    } finally {
      setIsSending(false)
    }
  }, [currentOrder, isSending, clearCurrentOrder])

  // Quick action handlers
  const handleHold = useCallback(async () => {
    if (!currentOrder) return
    try {
      await fetch(`/api/orders/${currentOrder.id}/hold`, { method: 'POST' })
      toast.info('Order held')
    } catch {
      toast.error('Failed to hold order')
    }
  }, [currentOrder])

  const handleFireCourse = useCallback(async () => {
    if (!currentOrder) return
    const activeCourse = useOrderStore.getState().activeCourse
    try {
      const res = await fetch(`/api/orders/${currentOrder.id}/fire-course`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ course: activeCourse }),
      })
      if (res.ok) {
        toast.success(`Course ${activeCourse} fired!`)
      }
    } catch {
      toast.error('Failed to fire course')
    }
  }, [currentOrder])

  const handleRush = useCallback(() => {
    toast.info('Rush flag set — kitchen notified')
  }, [])

  const handleDiscount = useCallback(() => {
    toast.info('Discount — coming soon')
  }, [])

  const handlePrint = useCallback(() => {
    toast.info('Print — coming soon')
  }, [])

  const handleVoid = useCallback(async () => {
    if (!currentOrder) return
    if (currentOrder.items.length === 0) {
      clearCurrentOrder()
      toast.info('Order cleared')
      return
    }
    try {
      await fetch(`/api/orders/${currentOrder.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ void_reason: 'Voided from POS' }),
      })
      clearCurrentOrder()
      toast.info('Order voided')
    } catch {
      toast.error('Failed to void order')
    }
  }, [currentOrder, clearCurrentOrder])

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left Panel — Current Order */}
      <OrderPanel onSendToKitchen={handleSendToKitchen} isSending={isSending} />

      {/* Center Panel — Menu Grid */}
      <MenuGrid onItemTap={handleItemTap} />

      {/* Right Strip — Quick Actions */}
      <QuickActions
        onHold={handleHold}
        onFireCourse={handleFireCourse}
        onRush={handleRush}
        onDiscount={handleDiscount}
        onPrint={handlePrint}
        onVoid={handleVoid}
        disabled={!currentOrder}
      />

      {/* Modifier Sheet */}
      <ModifierSheet
        item={modifierItem}
        open={modifierSheetOpen}
        onOpenChange={setModifierSheetOpen}
        onAddToOrder={handleAddWithModifiers}
      />
    </div>
  )
}
