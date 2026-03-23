'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { OrderPanel } from '@/components/pos/OrderPanel'
import { MenuGrid } from '@/components/pos/MenuGrid'
import { ModifierSheet } from '@/components/pos/ModifierSheet'
import { VoidReasonDialog } from '@/components/pos/VoidReasonDialog'
import { CompDialog } from '@/components/pos/CompDialog'
import { DiscountDialog } from '@/components/pos/DiscountDialog'
import { OrderTransferDialog } from '@/components/pos/OrderTransferDialog'
import { TableMoveDialog } from '@/components/pos/TableMoveDialog'
import { useOrderStore } from '@/stores/order-store'
import { useMenuStore } from '@/stores/menu-store'
import { useAuthStore } from '@/stores/auth-store'
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
  const router = useRouter()
  const currentOrder = useOrderStore((s) => s.currentOrder)
  const { addItem, newOrder, clearCurrentOrder, voidItem } = useOrderStore((s) => s.actions)
  const { setCategories, setItems, setLoading } = useMenuStore((s) => s.actions)
  const user = useAuthStore((s) => s.user)
  const activeLocationId = useAuthStore((s) => s.activeLocationId)

  const [modifierItem, setModifierItem] = useState<MenuItemWithModifiers | null>(null)
  const [modifierSheetOpen, setModifierSheetOpen] = useState(false)
  const [isSending, setIsSending] = useState(false)

  // Dialog states
  const [voidDialogOpen, setVoidDialogOpen] = useState(false)
  const [voidTarget, setVoidTarget] = useState<{ id: string; name: string; isSent: boolean } | null>(null)
  const [compDialogOpen, setCompDialogOpen] = useState(false)
  const [compTarget, setCompTarget] = useState<{ id: string; name: string; priceCents: number } | null>(null)
  const [discountOpen, setDiscountOpen] = useState(false)
  const [transferOpen, setTransferOpen] = useState(false)
  const [tableMoveOpen, setTableMoveOpen] = useState(false)

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
                modifier_groups: [],
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
    if (!currentOrder && user) {
      newOrder({
        order_type: 'dine_in',
        server_id: user.id,
        server_name: user.display_name,
      })
    }
  }, [currentOrder, newOrder, user])

  // Handle item tap from menu grid
  const handleItemTap = useCallback(
    async (item: { id: string; name: string; price_cents: number; modifier_groups: { id: string; is_required: boolean }[] }) => {
      const hasRequiredModifiers = item.modifier_groups.some((g) => g.is_required)

      if (hasRequiredModifiers || item.modifier_groups.length > 0) {
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
            addItem({ menu_item_id: item.id, name: item.name, price_cents: item.price_cents })
          }
        } catch {
          addItem({ menu_item_id: item.id, name: item.name, price_cents: item.price_cents })
        }
      } else {
        addItem({ menu_item_id: item.id, name: item.name, price_cents: item.price_cents })
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

  // ========== SEND TO KITCHEN ==========
  const handleSendToKitchen = useCallback(async () => {
    if (!currentOrder || isSending) return

    setIsSending(true)
    try {
      let orderId = currentOrder.id

      if (currentOrder.status === 'draft' && !currentOrder.order_number) {
        if (!activeLocationId) {
          toast.error('No active location set')
          return
        }

        const createRes = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            order_type: currentOrder.order_type,
            location_id: activeLocationId,
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

      const sendRes = await fetch(`/api/orders/${orderId}/send`, {
        method: 'POST',
      })

      if (sendRes.ok) {
        toast.success('Order sent to kitchen!', {
          description: `${currentOrder.items.filter((i) => !i.voided && i.status === 'pending').length} items sent`,
        })
        clearCurrentOrder()
      } else {
        toast.error('Failed to send order')
      }
    } catch {
      toast.error('Network error — could not send order')
    } finally {
      setIsSending(false)
    }
  }, [currentOrder, isSending, clearCurrentOrder, activeLocationId])

  // ========== ORDER ACTIONS (moved from QuickActions) ==========

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

  const handleRush = useCallback(async () => {
    if (!currentOrder) return
    try {
      const res = await fetch(`/api/orders/${currentOrder.id}/rush`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'long_wait' }),
      })
      if (res.ok) {
        toast.success('Rush flag set — kitchen notified')
      } else {
        toast.error('Failed to set rush')
      }
    } catch {
      toast.error('Failed to set rush')
    }
  }, [currentOrder])

  const handleDiscount = useCallback(() => {
    if (!currentOrder) return
    setDiscountOpen(true)
  }, [currentOrder])

  const handlePrint = useCallback(async () => {
    if (!currentOrder) return
    try {
      const res = await fetch(`/api/orders/${currentOrder.id}/print-check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format: 'receipt' }),
      })
      if (res.ok) {
        toast.success('Check printed')
      } else {
        window.print()
      }
    } catch {
      window.print()
    }
  }, [currentOrder])

  const handleVoidOrder = useCallback(() => {
    if (!currentOrder) return
    if (currentOrder.items.length === 0) {
      clearCurrentOrder()
      toast.info('Order cleared')
      return
    }
    const hasSentItems = currentOrder.items.some((i) => i.status !== 'pending' && !i.voided)
    setVoidTarget({
      id: '__ORDER__',
      name: `Entire Order (${currentOrder.items.filter((i) => !i.voided).length} items)`,
      isSent: hasSentItems,
    })
    setVoidDialogOpen(true)
  }, [currentOrder, clearCurrentOrder])

  // Handle voiding from OrderPanel (individual item)
  const handleItemVoid = useCallback((itemId: string, itemName: string, isSent: boolean) => {
    setVoidTarget({ id: itemId, name: itemName, isSent })
    setVoidDialogOpen(true)
  }, [])

  // Handle comping from OrderPanel (individual item)
  const handleItemComp = useCallback((itemId: string, itemName: string, priceCents: number) => {
    setCompTarget({ id: itemId, name: itemName, priceCents })
    setCompDialogOpen(true)
  }, [])

  // Void confirmation
  const handleVoidConfirm = useCallback(
    async (reason: string, note: string, managerId?: string) => {
      if (!currentOrder || !voidTarget) return

      if (voidTarget.id === '__ORDER__') {
        try {
          await fetch(`/api/orders/${currentOrder.id}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              void_reason: `${reason}${note ? ': ' + note : ''}`,
              manager_id: managerId,
            }),
          })
          clearCurrentOrder()
          toast.info('Order voided')
        } catch {
          toast.error('Failed to void order')
        }
      } else {
        voidItem(voidTarget.id, `${reason}${note ? ': ' + note : ''}`)
        toast.info(`Voided: ${voidTarget.name}`)
      }
    },
    [currentOrder, voidTarget, voidItem, clearCurrentOrder]
  )

  // Comp confirmation
  const handleCompConfirm = useCallback(
    async (reason: string, note: string, managerId: string) => {
      if (!currentOrder || !compTarget) return
      try {
        const res = await fetch(`/api/orders/${currentOrder.id}/comp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            order_item_id: compTarget.id,
            comp_reason: `${reason}${note ? ': ' + note : ''}`,
            manager_id: managerId,
          }),
        })
        if (res.ok) {
          toast.success(`Comped: ${compTarget.name}`)
        } else {
          toast.error('Failed to comp item')
        }
      } catch {
        toast.error('Failed to comp item')
      }
    },
    [currentOrder, compTarget]
  )

  // Discount application
  const handleDiscountApply = useCallback(
    async (params: { discount_type: 'percentage' | 'fixed'; discount_value: number; reason: string; managerId?: string }) => {
      if (!currentOrder) return
      try {
        const res = await fetch(`/api/orders/${currentOrder.id}/discount`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            discount_type: params.discount_type,
            discount_value: params.discount_type === 'percentage'
              ? params.discount_value
              : (params.discount_value / 100).toFixed(2),
            reason: params.reason,
            manager_id: params.managerId,
          }),
        })
        if (res.ok) {
          const label = params.discount_type === 'percentage'
            ? `${params.discount_value}%`
            : `$${(params.discount_value / 100).toFixed(2)}`
          toast.success(`Discount applied: ${label}`)
        } else {
          toast.error('Failed to apply discount')
        }
      } catch {
        toast.error('Failed to apply discount')
      }
    },
    [currentOrder]
  )

  // Transfer order
  const handleTransfer = useCallback(
    async (newServerId: string, newServerName: string) => {
      if (!currentOrder) return
      try {
        const res = await fetch(`/api/orders/${currentOrder.id}/transfer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ new_server_id: newServerId }),
        })
        if (res.ok) {
          toast.success(`Order transferred to ${newServerName}`)
        } else {
          toast.error('Failed to transfer order')
        }
      } catch {
        toast.error('Failed to transfer order')
      }
    },
    [currentOrder]
  )

  // Move table
  const handleTableMove = useCallback(
    async (newTableId: string, newTableName: string) => {
      if (!currentOrder) return
      try {
        const res = await fetch(`/api/orders/${currentOrder.id}/move-table`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ new_table_id: newTableId }),
        })
        if (res.ok) {
          toast.success(`Moved to ${newTableName}`)
          useOrderStore.getState().actions.setTable(newTableId, newTableName)
        } else {
          toast.error('Failed to move table')
        }
      } catch {
        toast.error('Failed to move table')
      }
    },
    [currentOrder]
  )

  // Navigate to payment
  const handleGoToPayment = useCallback(() => {
    if (!currentOrder) return
    router.push(`/payments?order_id=${currentOrder.id}&total_cents=${currentOrder.total_cents}`)
  }, [currentOrder, router])

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left Panel — Order (30%) */}
      <OrderPanel
        onSendToKitchen={handleSendToKitchen}
        isSending={isSending}
        onItemVoid={handleItemVoid}
        onItemComp={handleItemComp}
        onGoToPayment={handleGoToPayment}
        onHold={handleHold}
        onFireCourse={handleFireCourse}
        onRush={handleRush}
        onDiscount={handleDiscount}
        onPrint={handlePrint}
        onVoidOrder={handleVoidOrder}
        onTransfer={() => setTransferOpen(true)}
        onMoveTable={() => setTableMoveOpen(true)}
      />

      {/* Right Panel — Menu Grid (70%) */}
      <MenuGrid onItemTap={handleItemTap} />

      {/* Modifier Sheet */}
      <ModifierSheet
        item={modifierItem}
        open={modifierSheetOpen}
        onOpenChange={setModifierSheetOpen}
        onAddToOrder={handleAddWithModifiers}
      />

      {/* Void Reason Dialog */}
      {voidTarget && (
        <VoidReasonDialog
          open={voidDialogOpen}
          onOpenChange={setVoidDialogOpen}
          itemName={voidTarget.name}
          isSent={voidTarget.isSent}
          onConfirm={handleVoidConfirm}
        />
      )}

      {/* Comp Dialog */}
      {compTarget && (
        <CompDialog
          open={compDialogOpen}
          onOpenChange={setCompDialogOpen}
          itemName={compTarget.name}
          itemPriceCents={compTarget.priceCents}
          onConfirm={handleCompConfirm}
        />
      )}

      {/* Discount Dialog */}
      <DiscountDialog
        open={discountOpen}
        onOpenChange={setDiscountOpen}
        subtotalCents={currentOrder?.subtotal_cents ?? 0}
        onApply={handleDiscountApply}
      />

      {/* Order Transfer Dialog */}
      <OrderTransferDialog
        open={transferOpen}
        onOpenChange={setTransferOpen}
        currentServerId={currentOrder?.server_id ?? ''}
        currentServerName={currentOrder?.server_name ?? ''}
        onTransfer={handleTransfer}
      />

      {/* Table Move Dialog */}
      <TableMoveDialog
        open={tableMoveOpen}
        onOpenChange={setTableMoveOpen}
        currentTableId={currentOrder?.table_id ?? null}
        currentTableName={currentOrder?.table_name ?? null}
        locationId={activeLocationId ?? ''}
        onMove={handleTableMove}
      />
    </div>
  )
}
