'use client'

import { useState, useEffect, useCallback } from 'react'
import { DollarSign, Copy, Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  PRICE_TYPES,
  PRICE_LEVEL_NAMES,
  dollarsToCents,
  centsToDollars,
  type PriceType,
} from '@/lib/menu/price-resolver'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PricingTabMenuItem {
  id: string
  price: string
  price_type?: string
}

export interface PriceLevelRow {
  id: string | null
  price_level_id: string | null
  level_name: string
  price: string
  daypart_id: string | null
  daypart_name: string | null
  is_active_now: boolean
}

export interface DaypartOption {
  id: string
  name: string
}

export interface PricingTabProps {
  item: PricingTabMenuItem
  locationId: string
  onSave: (data: PricingTabSaveData) => void
}

export interface PricingTabSaveData {
  basePrice: string
  priceType: PriceType
  priceLevels: Array<{
    level_name: string
    price: string
    daypart_id: string | null
  }>
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PricingTab({ item, locationId, onSave }: PricingTabProps) {
  const [basePrice, setBasePrice] = useState(item.price)
  const [priceType, setPriceType] = useState<PriceType>(
    (item.price_type as PriceType) || 'fixed',
  )
  const [priceLevels, setPriceLevels] = useState<PriceLevelRow[]>([])
  const [dayparts, setDayparts] = useState<DaypartOption[]>([])
  const [activeDaypartId, setActiveDaypartId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [copiedAll, setCopiedAll] = useState(false)

  // -----------------------------------------------------------------------
  // Fetch dayparts and price levels
  // -----------------------------------------------------------------------

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    try {
      // Fetch dayparts
      const dpRes = await fetch(`/api/menu/dayparts?location_id=${locationId}`)
      const dpJson = await dpRes.json()
      const fetchedDayparts: DaypartOption[] = (dpJson.data ?? []).map(
        (d: { id: string; name: string }) => ({ id: d.id, name: d.name }),
      )
      setDayparts(fetchedDayparts)

      // Fetch active daypart
      const activeRes = await fetch(
        `/api/menu/dayparts/active?location_id=${locationId}`,
      )
      const activeJson = await activeRes.json()
      const primaryId = activeJson.data?.primary_daypart?.id ?? null
      setActiveDaypartId(primaryId)

      // Fetch existing price level prices for this item
      // We'll build the 9-row grid, filling in existing data
      const plpRes = await fetch(
        `/api/menu/items/${item.id}?include_price_levels=true`,
      )
      const plpJson = await plpRes.json()
      const existingPrices: Array<{
        id: string
        price_level_id: string
        level_name: string
        price: string
        daypart_id: string | null
      }> = plpJson.data?.price_level_prices ?? []

      // Build the 9-row grid
      const rows: PriceLevelRow[] = PRICE_LEVEL_NAMES.map((levelName) => {
        const existing = existingPrices.find(
          (p) => p.level_name === levelName,
        )
        const dpId = existing?.daypart_id ?? null
        const dpName =
          fetchedDayparts.find((d) => d.id === dpId)?.name ?? null

        return {
          id: existing?.id ?? null,
          price_level_id: existing?.price_level_id ?? null,
          level_name: levelName,
          price: existing?.price ?? '',
          daypart_id: dpId,
          daypart_name: dpName,
          is_active_now:
            dpId != null && dpId === primaryId,
        }
      })

      setPriceLevels(rows)
    } catch {
      // Silently handle - user can retry
    } finally {
      setIsLoading(false)
    }
  }, [item.id, locationId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // -----------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------

  function handleBasePriceChange(value: string) {
    // Allow only valid dollar input
    const cleaned = value.replace(/[^0-9.]/g, '')
    setBasePrice(cleaned)
  }

  function handleLevelPriceChange(index: number, value: string) {
    const cleaned = value.replace(/[^0-9.]/g, '')
    setPriceLevels((prev) =>
      prev.map((row, i) => (i === index ? { ...row, price: cleaned } : row)),
    )
  }

  function handleLevelDaypartChange(index: number, daypartId: string) {
    const dpName = dayparts.find((d) => d.id === daypartId)?.name ?? null
    setPriceLevels((prev) =>
      prev.map((row, i) =>
        i === index
          ? {
              ...row,
              daypart_id: daypartId || null,
              daypart_name: dpName,
              is_active_now: daypartId === activeDaypartId,
            }
          : row,
      ),
    )
  }

  function copyBasePriceToAll() {
    setPriceLevels((prev) =>
      prev.map((row) => ({ ...row, price: basePrice })),
    )
    setCopiedAll(true)
    setTimeout(() => setCopiedAll(false), 2000)
  }

  async function handleSave() {
    setIsSaving(true)
    try {
      onSave({
        basePrice,
        priceType,
        priceLevels: priceLevels
          .filter((row) => row.price !== '')
          .map((row) => ({
            level_name: row.level_name,
            price: row.price,
            daypart_id: row.daypart_id,
          })),
      })
    } finally {
      setIsSaving(false)
    }
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">
          Loading pricing data...
        </span>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-4">
      {/* Base Price */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">
          Base Price
        </label>
        <div className="relative">
          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={basePrice}
            onChange={(e) => handleBasePriceChange(e.target.value)}
            className="pl-9 text-lg font-semibold h-12"
            placeholder="0.00"
            inputMode="decimal"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {dollarsToCents(basePrice) > 0
            ? `${dollarsToCents(basePrice)} cents`
            : 'Enter the base menu price'}
        </p>
      </div>

      {/* Price Type */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">
          Price Type
        </label>
        <div className="flex flex-wrap gap-2">
          {PRICE_TYPES.map((pt) => (
            <button
              key={pt.value}
              type="button"
              onClick={() => setPriceType(pt.value)}
              className={cn(
                'rounded-lg border px-3 py-2 text-sm font-medium transition-all min-h-[48px]',
                priceType === pt.value
                  ? 'border-[#007AFF] bg-[#007AFF]/10 text-[#007AFF]'
                  : 'border-border bg-background text-foreground hover:bg-muted',
              )}
            >
              {pt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Price Levels Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-foreground">
            Price Levels
          </label>
          <Button
            variant="outline"
            size="sm"
            onClick={copyBasePriceToAll}
            className="gap-1.5"
          >
            {copiedAll ? (
              <Check className="size-3.5 text-emerald-600" />
            ) : (
              <Copy className="size-3.5" />
            )}
            {copiedAll ? 'Copied' : 'Copy base to all'}
          </Button>
        </div>

        <div className="rounded-lg border border-border overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-[1fr_120px_140px] gap-2 px-3 py-2 bg-muted/50 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            <span>Level</span>
            <span>Price</span>
            <span>Daypart</span>
          </div>

          {/* Rows */}
          {priceLevels.map((row, index) => (
            <div
              key={row.level_name}
              className={cn(
                'grid grid-cols-[1fr_120px_140px] gap-2 px-3 py-2 items-center border-t border-border transition-colors',
                row.is_active_now && 'bg-[#007AFF]/5',
              )}
            >
              {/* Level name */}
              <div className="flex items-center gap-2 min-h-[48px]">
                <span className="text-sm font-medium">{row.level_name}</span>
                {row.is_active_now && (
                  <Badge
                    variant="default"
                    className="bg-[#007AFF] text-white text-[10px] px-1.5"
                  >
                    ACTIVE
                  </Badge>
                )}
              </div>

              {/* Price input */}
              <div className="relative">
                <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
                <Input
                  value={row.price}
                  onChange={(e) =>
                    handleLevelPriceChange(index, e.target.value)
                  }
                  className="pl-6 h-10 text-sm"
                  placeholder="--"
                  inputMode="decimal"
                />
              </div>

              {/* Daypart dropdown */}
              <select
                value={row.daypart_id ?? ''}
                onChange={(e) =>
                  handleLevelDaypartChange(index, e.target.value)
                }
                className="h-10 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <option value="">None</option>
                {dayparts.map((dp) => (
                  <option key={dp.id} value={dp.id}>
                    {dp.name}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>

        <p className="text-xs text-muted-foreground">
          Leave a price blank to use the base price for that level. Assign a
          daypart to automatically activate pricing during that time period.
        </p>
      </div>

      {/* Priority legend */}
      <div className="rounded-lg border border-border p-3 bg-muted/30">
        <p className="text-xs font-medium text-muted-foreground mb-2">
          Pricing Priority (highest to lowest)
        </p>
        <ol className="text-xs text-muted-foreground space-y-0.5 list-decimal list-inside">
          <li>Manual Override (manager-applied)</li>
          <li>Promotion / Coupon</li>
          <li>Daypart pricing (happy hour, etc.)</li>
          <li>Menu-specific pricing</li>
          <li>Base item price</li>
        </ol>
      </div>

      {/* Save */}
      <Button
        onClick={handleSave}
        disabled={isSaving}
        className="w-full h-12 bg-[#007AFF] hover:bg-[#E05A0D] text-white font-medium"
      >
        {isSaving ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Saving...
          </>
        ) : (
          'Save Pricing'
        )}
      </Button>
    </div>
  )
}
