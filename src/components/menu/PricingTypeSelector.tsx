'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export type ModifierPricingType =
  | 'included'
  | 'upcharge'
  | 'replacement'
  | 'replacement_upcharge'
  | 'quantity_based'

export interface ModifierPricing {
  type: ModifierPricingType
  upcharge: string
  free_quantity: number
  per_additional: string
}

const PRICING_TYPES: { value: ModifierPricingType; label: string; description: string }[] = [
  { value: 'included', label: 'Included', description: 'No extra charge ($0)' },
  { value: 'upcharge', label: 'Upcharge', description: 'Add extra charge (+$X)' },
  { value: 'replacement', label: 'Replacement', description: 'Swap item at no cost ($0)' },
  { value: 'replacement_upcharge', label: 'Replacement + Upcharge', description: 'Swap with extra charge (+$X)' },
  { value: 'quantity_based', label: 'Quantity Based', description: 'First N free, then +$X each' },
]

interface PricingTypeSelectorProps {
  pricing: ModifierPricing
  onChange: (pricing: ModifierPricing) => void
}

export function PricingTypeSelector({ pricing, onChange }: PricingTypeSelectorProps) {
  return (
    <div className="space-y-3">
      <Label className="text-xs font-medium text-muted-foreground">Pricing Type</Label>

      {/* Type selector pills */}
      <div className="flex flex-wrap gap-1.5">
        {PRICING_TYPES.map((pt) => (
          <button
            key={pt.value}
            type="button"
            onClick={() =>
              onChange({
                ...pricing,
                type: pt.value,
                ...(pt.value === 'included' || pt.value === 'replacement'
                  ? { upcharge: '0.00' }
                  : {}),
              })
            }
            className={cn(
              'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
              pricing.type === pt.value
                ? 'border-[#F06B18] bg-[#F06B18]/10 text-[#F06B18]'
                : 'border-border text-muted-foreground hover:border-border'
            )}
            title={pt.description}
          >
            {pt.label}
          </button>
        ))}
      </div>

      {/* Upcharge input for relevant types */}
      {(pricing.type === 'upcharge' || pricing.type === 'replacement_upcharge') && (
        <div className="space-y-1.5">
          <Label className="text-xs">Upcharge Amount</Label>
          <div className="relative w-24">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">+$</span>
            <Input
              placeholder="0.00"
              value={pricing.upcharge}
              onChange={(e) => onChange({ ...pricing, upcharge: e.target.value })}
              className="pl-7 tabular-nums h-8"
            />
          </div>
        </div>
      )}

      {/* Quantity-based fields */}
      {pricing.type === 'quantity_based' && (
        <div className="flex gap-3">
          <div className="space-y-1.5 flex-1">
            <Label className="text-xs">Free Qty</Label>
            <Input
              type="number"
              min={0}
              value={pricing.free_quantity}
              onChange={(e) =>
                onChange({ ...pricing, free_quantity: parseInt(e.target.value, 10) || 0 })
              }
              className="h-8 tabular-nums"
            />
          </div>
          <div className="space-y-1.5 flex-1">
            <Label className="text-xs">Each Additional</Label>
            <div className="relative">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">+$</span>
              <Input
                placeholder="0.00"
                value={pricing.per_additional}
                onChange={(e) => onChange({ ...pricing, per_additional: e.target.value })}
                className="pl-7 tabular-nums h-8"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export const DEFAULT_MODIFIER_PRICING: ModifierPricing = {
  type: 'included',
  upcharge: '0.00',
  free_quantity: 0,
  per_additional: '0.00',
}
