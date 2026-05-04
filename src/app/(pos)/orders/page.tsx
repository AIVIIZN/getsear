'use client'

import { useEffect, useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { OrderPanel } from '@/components/pos/OrderPanel'
import { MenuGrid } from '@/components/pos/MenuGrid'
import { ModifierSheet } from '@/components/pos/ModifierSheet'
import { useOrderStore } from '@/stores/order-store'
import { useMenuStore } from '@/stores/menu-store'
import { useAuthStore } from '@/stores/auth-store'
import { useRealtime86 } from '@/hooks/use-realtime'
import { toast } from 'sonner'

const ComboBuilder = dynamic(
  () => import('@/components/pos/ComboBuilder').then(m => ({ default: m.ComboBuilder })),
  { ssr: false },
)
const OpenPriceDialog = dynamic(
  () => import('@/components/pos/OpenPriceDialog').then(m => ({ default: m.OpenPriceDialog })),
  { ssr: false },
)
const VoidReasonDialog = dynamic(
  () => import('@/components/pos/VoidReasonDialog').then(m => ({ default: m.VoidReasonDialog })),
  { ssr: false },
)
const CompDialog = dynamic(
  () => import('@/components/pos/CompDialog').then(m => ({ default: m.CompDialog })),
  { ssr: false },
)
const DiscountDialog = dynamic(
  () => import('@/components/pos/DiscountDialog').then(m => ({ default: m.DiscountDialog })),
  { ssr: false },
)
const OrderTransferDialog = dynamic(
  () => import('@/components/pos/OrderTransferDialog').then(m => ({ default: m.OrderTransferDialog })),
  { ssr: false },
)
const TableMoveDialog = dynamic(
  () => import('@/components/pos/TableMoveDialog').then(m => ({ default: m.TableMoveDialog })),
  { ssr: false },
)
const AllergenWarningDialog = dynamic(
  () => import('@/components/pos/AllergenWarningDialog').then(m => ({ default: m.AllergenWarningDialog })),
  { ssr: false },
)

interface ModifierGroupData {
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
    is_default?: boolean
  }[]
}

interface MenuItemWithModifiers {
  id: string
  name: string
  price_cents: number
  category_id: string
  is_available: boolean
  modifier_groups: ModifierGroupData[]
}

interface SelectedModifier {
  modifier_id: string
  modifier_group_id: string
  name: string
  price_cents: number
  quantity: number
}

interface ComboSlotOption {
  id: string
  menu_item_id: string
  name: string
  upcharge_cents: number
  is_default: boolean
  modifier_groups: ModifierGroupData[]
}

interface ComboSlot {
  id: string
  name: string
  sort_order: number
  options: ComboSlotOption[]
}

interface ComboItemData {
  id: string
  name: string
  price_cents: number
  combo_name: string
  combo_price_cents: number
  combo_slots: ComboSlot[]
}

interface OpenPriceItemData {
  id: string
  name: string
  price_type: 'open' | 'market_price'
  min_price_cents: number | null
  max_price_cents: number | null
}

interface ComboChildResult {
  id: string
  menu_item_id: string
  name: string
  slot_name: string
  upcharge_cents: number
  modifiers: {
    id: string
    modifier_id: string
    name: string
    price_cents: number
    quantity: number
  }[]
}

/**
 * Map the human-readable label produced by VoidReasonDialog back to the
 * canonical enum accepted by POST /api/orders/[id]/void. Unknown labels
 * fall back to `other` so we never block a void on a string mismatch.
 *
 * Sister: 5.99.3 (close DELETE side-door void).
 */
function mapVoidReasonToEnum(
  label: string
): 'customer_request' | 'kitchen_error' | 'server_error' | 'wrong_item' | 'quality_issue' | '86d' | 'duplicate' | 'other' {
  const l = label.toLowerCase()
  if (l.includes('wrong item')) return 'wrong_item'
  if (l.includes('customer changed')) return 'customer_request'
  if (l.includes('quality')) return 'quality_issue'
  // "Long wait time" is a service-speed complaint, not a kitchen-prep mistake;
  // map to customer_request as the closest semantic enum until/unless we add
  // a dedicated `long_wait` value to VOID_REASONS.
  if (l.includes('long wait')) return 'customer_request'
  if (l.includes('duplicate')) return 'duplicate'
  if (l.includes('kitchen')) return 'kitchen_error'
  if (l.includes('server error')) return 'server_error'
  if (l.includes('86')) return '86d'
  return 'other'
}

export default function OrdersPage() {
  const router = useRouter()
  const currentOrder = useOrderStore((s) => s.currentOrder)
  const { addItem, addComboToOrder, newOrder, clearCurrentOrder, voidItem } = useOrderStore((s) => s.actions)
  const { setCategories, setItems, setLoading } = useMenuStore((s) => s.actions)
  const user = useAuthStore((s) => s.user)
  const activeLocationId = useAuthStore((s) => s.activeLocationId)

  const [modifierItem, setModifierItem] = useState<MenuItemWithModifiers | null>(null)
  const [modifierSheetOpen, setModifierSheetOpen] = useState(false)
  const [isSending, setIsSending] = useState(false)

  // Combo builder state
  const [comboItem, setComboItem] = useState<ComboItemData | null>(null)
  const [comboBuilderOpen, setComboBuilderOpen] = useState(false)

  // Open price dialog state
  const [openPriceItem, setOpenPriceItem] = useState<OpenPriceItemData | null>(null)
  const [openPriceDialogOpen, setOpenPriceDialogOpen] = useState(false)
  // Used to hold item data when open price is confirmed and modifiers still need to be checked
  const [pendingOpenPriceItem, setPendingOpenPriceItem] = useState<{ id: string; name: string; price_cents: number; modifier_groups: { id: string; is_required: boolean }[] } | null>(null)

  // Dialog states
  const [voidDialogOpen, setVoidDialogOpen] = useState(false)
  const [voidTarget, setVoidTarget] = useState<{ id: string; name: string; isSent: boolean } | null>(null)
  const [compDialogOpen, setCompDialogOpen] = useState(false)
  const [compTarget, setCompTarget] = useState<{ id: string; name: string; priceCents: number } | null>(null)
  const [discountOpen, setDiscountOpen] = useState(false)
  const [transferOpen, setTransferOpen] = useState(false)
  const [tableMoveOpen, setTableMoveOpen] = useState(false)

  // Allergen warning
  const [allergenDialogOpen, setAllergenDialogOpen] = useState(false)
  const [allergenConflicts, setAllergenConflicts] = useState<{ allergen: string; seatNumber: number | null; guestName: string | null; severity: 'preference' | 'intolerance' | 'allergy' | 'severe_anaphylaxis' }[]>([])
  const [pendingAllergenItem, setPendingAllergenItem] = useState<{ menu_item_id: string; name: string; price_cents: number } | null>(null)

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
                price_type?: string
                min_price?: string | null
                max_price?: string | null
                combo_group_id?: string | null
                combo_name?: string | null
                combo_price?: string | null
                combo_slots?: ComboSlot[]
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
                price_type: (i.price_type as 'fixed' | 'open' | 'market_price') ?? 'fixed',
                min_price_cents: i.min_price ? Math.round(parseFloat(i.min_price) * 100) : null,
                max_price_cents: i.max_price ? Math.round(parseFloat(i.max_price) * 100) : null,
                combo_group_id: i.combo_group_id ?? null,
                combo_name: i.combo_name ?? null,
                combo_price_cents: i.combo_price ? Math.round(parseFloat(i.combo_price) * 100) : null,
                combo_slots: i.combo_slots ?? [],
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

  // Real-time 86 propagation — grey out items when 86'd on any terminal
  const orgId = useAuthStore((s) => s.user?.org_id) ?? ''
  const { update86Status } = useMenuStore((s) => s.actions)
  useRealtime86(orgId, useCallback((item: { id: string; is_86d: boolean; name: string }) => {
    update86Status(item.id, item.is_86d)
    if (item.is_86d) {
      toast.warning(`${item.name} has been 86'd`, { duration: 3000 })
    }
  }, [update86Status]))

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

  // Fetch modifier groups for an item and open modifier sheet
  const openModifierSheet = useCallback(
    async (item: { id: string; name: string; price_cents: number; modifier_groups: { id: string; is_required: boolean }[] }) => {
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
                modifiers: { id: string; name: string; price_adjustment: string; is_active: boolean; sort_order: number; is_default?: boolean }[]
              }) => ({
                id: g.id,
                name: g.name,
                is_required: g.is_required,
                min_selections: g.min_selections ?? 0,
                max_selections: g.max_selections ?? 10,
                modifiers: (g.modifiers ?? []).map(
                  (m: { id: string; name: string; price_adjustment: string; is_active: boolean; sort_order: number; is_default?: boolean }) => ({
                    id: m.id,
                    name: m.name,
                    price_cents: Math.round(parseFloat(m.price_adjustment ?? '0') * 100),
                    is_available: m.is_active ?? true,
                    sort_order: m.sort_order ?? 0,
                    is_default: m.is_default ?? false,
                  })
                ),
              })
            ),
          })
          setModifierSheetOpen(true)
        } else {
          addItemWithAllergenCheck(item.id, item.name, item.price_cents)
        }
      } catch {
        addItemWithAllergenCheck(item.id, item.name, item.price_cents)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [addItem]
  )

  // Handle item tap from menu grid
  // Flow: check combo -> check open price -> check modifiers -> add to order
  const handleItemTap = useCallback(
    async (item: { id: string; name: string; price_cents: number; modifier_groups: { id: string; is_required: boolean }[] }) => {
      // 1. Check if this is a combo item
      const menuItem = useMenuStore.getState().items.find((i) => i.id === item.id)
      if (menuItem?.combo_group_id && menuItem.combo_slots.length > 0) {
        setComboItem({
          id: menuItem.id,
          name: menuItem.name,
          price_cents: menuItem.price_cents,
          combo_name: menuItem.combo_name ?? menuItem.name + ' Combo',
          combo_price_cents: menuItem.combo_price_cents ?? menuItem.price_cents,
          combo_slots: menuItem.combo_slots,
        })
        setComboBuilderOpen(true)
        return
      }

      // 2. Check if this is an open/market price item
      if (menuItem?.price_type === 'open' || menuItem?.price_type === 'market_price') {
        setOpenPriceItem({
          id: menuItem.id,
          name: menuItem.name,
          price_type: menuItem.price_type,
          min_price_cents: menuItem.min_price_cents,
          max_price_cents: menuItem.max_price_cents,
        })
        // Store item data for after price is confirmed
        setPendingOpenPriceItem(item)
        setOpenPriceDialogOpen(true)
        return
      }

      // 3. Check if item has modifiers (forced or optional)
      const hasModifiers = item.modifier_groups.length > 0
      if (hasModifiers) {
        await openModifierSheet(item)
      } else {
        addItemWithAllergenCheck(item.id, item.name, item.price_cents)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [addItem, openModifierSheet]
  )

  // Check allergens before adding
  const addItemWithAllergenCheck = useCallback(
    (menuItemId: string, name: string, priceCents: number) => {
      // Get item allergens from menu store
      const menuItem = useMenuStore.getState().items.find((i) => i.id === menuItemId)
      const itemAllergens = menuItem?.allergens ?? []

      if (itemAllergens.length === 0) {
        addItem({ menu_item_id: menuItemId, name, price_cents: priceCents })
        return
      }

      // Check against guest allergies stored on the order (if any)
      // guest_allergens is populated when a guest profile with allergies is assigned
      const order = useOrderStore.getState().currentOrder as Record<string, unknown> | null
      const guestAllergens = (order?.guest_allergens ?? []) as Array<{
        allergen: string
        seat_number: number | null
        guest_name: string | null
        severity: string
      }>

      if (guestAllergens.length === 0) {
        addItem({ menu_item_id: menuItemId, name, price_cents: priceCents })
        return
      }

      // Find conflicts
      const conflicts = itemAllergens
        .filter((allergen) =>
          guestAllergens.some((ga) => ga.allergen.toLowerCase() === allergen.toLowerCase())
        )
        .map((allergen) => {
          const match = guestAllergens.find((ga) => ga.allergen.toLowerCase() === allergen.toLowerCase())
          return {
            allergen,
            seatNumber: match?.seat_number ?? null,
            guestName: match?.guest_name ?? null,
            severity: (match?.severity ?? 'allergy') as 'preference' | 'intolerance' | 'allergy' | 'severe_anaphylaxis',
          }
        })

      if (conflicts.length > 0) {
        setPendingAllergenItem({ menu_item_id: menuItemId, name, price_cents: priceCents })
        setAllergenConflicts(conflicts)
        setAllergenDialogOpen(true)
      } else {
        addItem({ menu_item_id: menuItemId, name, price_cents: priceCents })
      }
    },
    [addItem]
  )

  const handleAllergenAcknowledge = useCallback(() => {
    if (pendingAllergenItem) {
      addItem(pendingAllergenItem)
      setPendingAllergenItem(null)
    }
  }, [pendingAllergenItem, addItem])

  const handleAllergenCancel = useCallback(() => {
    setPendingAllergenItem(null)
  }, [])

  // Handle combo acceptance
  const handleComboAccept = useCallback(
    (comboName: string, comboPriceCents: number, children: ComboChildResult[]) => {
      if (!comboItem) return
      addComboToOrder({
        menu_item_id: comboItem.id,
        name: comboName,
        combo_price_cents: comboPriceCents,
        children: children.map((c) => ({
          id: c.id,
          menu_item_id: c.menu_item_id,
          name: c.name,
          slot_name: c.slot_name,
          upcharge_cents: c.upcharge_cents,
          modifiers: c.modifiers,
        })),
      })
      setComboItem(null)
    },
    [comboItem, addComboToOrder]
  )

  // Handle combo decline — add item at regular price
  const handleComboDecline = useCallback(() => {
    if (!comboItem) return
    addItemWithAllergenCheck(comboItem.id, comboItem.name, comboItem.price_cents)
    setComboItem(null)
  }, [comboItem, addItemWithAllergenCheck])

  // Handle open price confirmation
  const handleOpenPriceConfirm = useCallback(
    async (priceCents: number) => {
      if (!pendingOpenPriceItem) return
      const item = pendingOpenPriceItem

      // Check if item has modifiers after price entry
      const hasModifiers = item.modifier_groups.length > 0
      if (hasModifiers) {
        // Override price and open modifier sheet
        await openModifierSheet({
          ...item,
          price_cents: priceCents,
        })
      } else {
        addItemWithAllergenCheck(item.id, item.name, priceCents)
      }
      setPendingOpenPriceItem(null)
      setOpenPriceItem(null)
    },
    [pendingOpenPriceItem, openModifierSheet, addItemWithAllergenCheck]
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
    async (reason: string, note: string, _managerId?: string) => {
      if (!currentOrder || !voidTarget) return

      if (voidTarget.id === '__ORDER__') {
        // Map the VoidReasonDialog human label → canonical /void/ enum.
        // 5.99.3: route through /void/ subroute (state-machine + version check
        // + audit) instead of the deprecated DELETE side-door.
        const reasonEnum = mapVoidReasonToEnum(reason)
        try {
          const res = await fetch(`/api/orders/${currentOrder.id}/void`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              reason: reasonEnum,
              notes: note || undefined,
            }),
          })
          if (!res.ok) {
            const body = await res.json().catch(() => ({}))
            toast.error(body?.error ?? 'Failed to void order')
            return
          }
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

      {/* Combo Builder */}
      {comboBuilderOpen && (
        <ComboBuilder
          item={comboItem}
          open={comboBuilderOpen}
          onOpenChange={setComboBuilderOpen}
          onAcceptCombo={handleComboAccept}
          onDeclineCombo={handleComboDecline}
        />
      )}

      {/* Open Price Dialog */}
      {openPriceDialogOpen && (
        <OpenPriceDialog
          item={openPriceItem}
          open={openPriceDialogOpen}
          onOpenChange={setOpenPriceDialogOpen}
          onConfirmPrice={handleOpenPriceConfirm}
        />
      )}

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
      {discountOpen && (
        <DiscountDialog
          open={discountOpen}
          onOpenChange={setDiscountOpen}
          subtotalCents={currentOrder?.subtotal_cents ?? 0}
          onApply={handleDiscountApply}
        />
      )}

      {/* Order Transfer Dialog */}
      {transferOpen && (
        <OrderTransferDialog
          open={transferOpen}
          onOpenChange={setTransferOpen}
          currentServerId={currentOrder?.server_id ?? ''}
          currentServerName={currentOrder?.server_name ?? ''}
          onTransfer={handleTransfer}
        />
      )}

      {/* Table Move Dialog */}
      {tableMoveOpen && (
        <TableMoveDialog
          open={tableMoveOpen}
          onOpenChange={setTableMoveOpen}
          currentTableId={currentOrder?.table_id ?? null}
          currentTableName={currentOrder?.table_name ?? null}
          locationId={activeLocationId ?? ''}
          onMove={handleTableMove}
        />
      )}

      {/* Allergen Warning Dialog */}
      {allergenDialogOpen && (
        <AllergenWarningDialog
          open={allergenDialogOpen}
          onOpenChange={setAllergenDialogOpen}
          itemName={pendingAllergenItem?.name ?? ''}
          conflicts={allergenConflicts}
          onAcknowledge={handleAllergenAcknowledge}
          onCancel={handleAllergenCancel}
        />
      )}
    </div>
  )
}
