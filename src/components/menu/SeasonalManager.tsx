'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Calendar,
  Plus,
  Copy,
  Trash2,
  X,
  Loader2,
  AlertCircle,
  Leaf,
  Snowflake,
  Sun,
  CloudRain,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn, formatDate } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SeasonalManagerProps {
  locationId: string
  orgId: string
  onClose?: () => void
}

interface SeasonalItem {
  id: string
  org_id: string
  location_id: string
  item_id: string
  replaces_item_id: string | null
  start_date: string
  end_date: string
  is_active: boolean
  created_at: string
  updated_at: string
  menu_item: {
    id: string
    name: string
    price: string
    image_url: string | null
    is_86d: boolean
  } | null
  replaces_item: {
    id: string
    name: string
    price: string
  } | null
}

interface MenuItemOption {
  id: string
  name: string
  price: string
}

type FilterTab = 'active' | 'upcoming' | 'expired'

interface SeasonalFormData {
  item_id: string
  replaces_item_id: string
  start_date: string
  end_date: string
}

const EMPTY_FORM: SeasonalFormData = {
  item_id: '',
  replaces_item_id: '',
  start_date: '',
  end_date: '',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getSeasonIcon(startDate: string): typeof Leaf {
  const month = new Date(startDate + 'T00:00:00').getMonth()
  if (month >= 2 && month <= 4) return Leaf       // spring
  if (month >= 5 && month <= 7) return Sun         // summer
  if (month >= 8 && month <= 10) return CloudRain  // fall
  return Snowflake                                  // winter
}

function dateRangeProgress(start: string, end: string): number {
  const now = Date.now()
  const s = new Date(start + 'T00:00:00').getTime()
  const e = new Date(end + 'T23:59:59').getTime()
  if (now < s) return 0
  if (now > e) return 100
  return Math.round(((now - s) / (e - s)) * 100)
}

function getStatusColor(start: string, end: string): string {
  const today = new Date().toISOString().split('T')[0]
  if (end < today) return 'bg-gray-100 text-gray-600 border-gray-200'
  if (start > today) return 'bg-blue-50 text-blue-600 border-blue-200'
  return 'bg-emerald-50 text-emerald-600 border-emerald-200'
}

function getStatusLabel(start: string, end: string): string {
  const today = new Date().toISOString().split('T')[0]
  if (end < today) return 'Expired'
  if (start > today) return 'Upcoming'
  return 'Active'
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SeasonalManager({ locationId, orgId, onClose }: SeasonalManagerProps) {
  const [items, setItems] = useState<SeasonalItem[]>([])
  const [menuItems, setMenuItems] = useState<MenuItemOption[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<FilterTab>('active')

  // Form
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [form, setForm] = useState<SeasonalFormData>(EMPTY_FORM)
  const [isSaving, setIsSaving] = useState(false)

  // Delete
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // -----------------------------------------------------------------------
  // Fetch
  // -----------------------------------------------------------------------

  const fetchSeasonalItems = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/menu/seasonal?location_id=${locationId}&filter=${activeTab}`,
      )
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to fetch')
      setItems(json.data ?? [])
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load seasonal items',
      )
    } finally {
      setIsLoading(false)
    }
  }, [locationId, activeTab])

  const fetchMenuItems = useCallback(async () => {
    try {
      const res = await fetch(`/api/menu/items?location_id=${locationId}`)
      const json = await res.json()
      setMenuItems(
        (json.data ?? []).map(
          (i: { id: string; name: string; price: string }) => ({
            id: i.id,
            name: i.name,
            price: i.price,
          }),
        ),
      )
    } catch {
      // Silent
    }
  }, [locationId])

  useEffect(() => {
    fetchSeasonalItems()
  }, [fetchSeasonalItems])

  useEffect(() => {
    fetchMenuItems()
  }, [fetchMenuItems])

  // -----------------------------------------------------------------------
  // Actions
  // -----------------------------------------------------------------------

  function openForm() {
    setForm(EMPTY_FORM)
    setIsFormOpen(true)
  }

  async function handleCreate() {
    if (!form.item_id || !form.start_date || !form.end_date) return

    setIsSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/menu/seasonal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location_id: locationId,
          item_id: form.item_id,
          replaces_item_id: form.replaces_item_id || null,
          start_date: form.start_date,
          end_date: form.end_date,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to create')
      setIsFormOpen(false)
      setForm(EMPTY_FORM)
      await fetchSeasonalItems()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete(id: string) {
    setError(null)
    try {
      const res = await fetch(`/api/menu/seasonal?id=${id}`, {
        method: 'DELETE',
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to delete')
      setDeletingId(null)
      await fetchSeasonalItems()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
      setDeletingId(null)
    }
  }

  async function cloneFromLastYear() {
    setError(null)
    setIsSaving(true)
    try {
      // Fetch expired items from ~last year
      const res = await fetch(
        `/api/menu/seasonal?location_id=${locationId}&filter=expired`,
      )
      const json = await res.json()
      const expired: SeasonalItem[] = json.data ?? []

      if (expired.length === 0) {
        setError('No expired seasonal items found to clone.')
        return
      }

      // Clone each with dates shifted +1 year
      let cloned = 0
      for (const item of expired) {
        const newStart = shiftDateOneYear(item.start_date)
        const newEnd = shiftDateOneYear(item.end_date)

        const createRes = await fetch('/api/menu/seasonal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            location_id: locationId,
            item_id: item.item_id,
            replaces_item_id: item.replaces_item_id,
            start_date: newStart,
            end_date: newEnd,
          }),
        })

        if (createRes.ok) cloned++
      }

      if (cloned > 0) {
        setActiveTab('upcoming')
        await fetchSeasonalItems()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Clone failed')
    } finally {
      setIsSaving(false)
    }
  }

  function shiftDateOneYear(dateStr: string): string {
    const d = new Date(dateStr + 'T00:00:00')
    d.setFullYear(d.getFullYear() + 1)
    return d.toISOString().split('T')[0]
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  const TABS: { value: FilterTab; label: string }[] = [
    { value: 'active', label: 'Active' },
    { value: 'upcoming', label: 'Upcoming' },
    { value: 'expired', label: 'Expired' },
  ]

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Calendar className="size-5 text-[#007AFF]" />
          <h2 className="text-lg font-semibold">Seasonal Menu Manager</h2>
        </div>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="size-4" />
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-3">
            <AlertCircle className="size-4 text-red-600 shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            onClick={openForm}
            className="bg-[#007AFF] hover:bg-[#E05A0D] text-white gap-1.5"
          >
            <Plus className="size-4" />
            Add Seasonal Item
          </Button>
          <Button
            variant="outline"
            onClick={cloneFromLastYear}
            disabled={isSaving}
            className="gap-1.5"
          >
            <Copy className="size-4" />
            Clone from Last Year
          </Button>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setActiveTab(tab.value)}
              className={cn(
                'flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-all min-h-[36px]',
                activeTab === tab.value
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Create Form */}
        {isFormOpen && (
          <div className="rounded-lg border-2 border-[#007AFF]/30 bg-[#007AFF]/5 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">New Seasonal Item</h3>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => setIsFormOpen(false)}
              >
                <X className="size-3.5" />
              </Button>
            </div>

            {/* Menu item picker */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Menu Item
              </label>
              <select
                value={form.item_id}
                onChange={(e) =>
                  setForm((f) => ({ ...f, item_id: e.target.value }))
                }
                className="w-full h-10 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <option value="">Select an item...</option>
                {menuItems.map((mi) => (
                  <option key={mi.id} value={mi.id}>
                    {mi.name} (${mi.price})
                  </option>
                ))}
              </select>
            </div>

            {/* Replaces item */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Replaces (optional)
              </label>
              <select
                value={form.replaces_item_id}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    replaces_item_id: e.target.value,
                  }))
                }
                className="w-full h-10 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <option value="">None (add alongside existing)</option>
                {menuItems
                  .filter((mi) => mi.id !== form.item_id)
                  .map((mi) => (
                    <option key={mi.id} value={mi.id}>
                      {mi.name}
                    </option>
                  ))}
              </select>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Start Date
                </label>
                <Input
                  type="date"
                  value={form.start_date}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, start_date: e.target.value }))
                  }
                  className="h-10"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  End Date
                </label>
                <Input
                  type="date"
                  value={form.end_date}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, end_date: e.target.value }))
                  }
                  className="h-10"
                />
              </div>
            </div>

            {form.start_date &&
              form.end_date &&
              form.end_date <= form.start_date && (
                <p className="text-xs text-red-600">
                  End date must be after start date.
                </p>
              )}

            <Button
              onClick={handleCreate}
              disabled={
                isSaving ||
                !form.item_id ||
                !form.start_date ||
                !form.end_date ||
                form.end_date <= form.start_date
              }
              className="w-full h-10 bg-[#007AFF] hover:bg-[#E05A0D] text-white"
            >
              {isSaving ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Seasonal Item'
              )}
            </Button>
          </div>
        )}

        {/* Seasonal Items List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-8">
            <Calendar className="size-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No {activeTab} seasonal items.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => {
              const SeasonIcon = getSeasonIcon(item.start_date)
              const progress = dateRangeProgress(
                item.start_date,
                item.end_date,
              )
              const statusColor = getStatusColor(
                item.start_date,
                item.end_date,
              )
              const statusLabel = getStatusLabel(
                item.start_date,
                item.end_date,
              )

              return (
                <div
                  key={item.id}
                  className="rounded-lg border border-border p-4 space-y-3"
                >
                  {/* Top row */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-lg bg-muted flex items-center justify-center">
                        <SeasonIcon className="size-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">
                          {item.menu_item?.name ?? 'Unknown Item'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          ${item.menu_item?.price ?? '0.00'}
                        </p>
                      </div>
                    </div>
                    <Badge
                      className={cn(
                        'text-[10px] border',
                        statusColor,
                      )}
                    >
                      {statusLabel}
                    </Badge>
                  </div>

                  {/* Date range bar */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{formatDate(item.start_date)}</span>
                      <span>{formatDate(item.end_date)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#007AFF] transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Replaces info */}
                  {item.replaces_item && (
                    <p className="text-xs text-muted-foreground">
                      Replaces:{' '}
                      <span className="font-medium text-foreground">
                        {item.replaces_item.name}
                      </span>
                    </p>
                  )}

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-1">
                    {deletingId === item.id ? (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="destructive"
                          size="xs"
                          onClick={() => handleDelete(item.id)}
                        >
                          Confirm Delete
                        </Button>
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => setDeletingId(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setDeletingId(item.id)}
                      >
                        <Trash2 className="size-3.5 text-red-500" />
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
