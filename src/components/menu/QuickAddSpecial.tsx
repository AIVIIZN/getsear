'use client'

import { useState, useCallback } from 'react'
import { X, Zap, Clock, Ban } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type { MenuCategory } from './CategoryPanel'

type AvailabilityPreset = 'tonight_only' | 'until_86d' | 'always'

const STATION_OPTIONS = [
  'grill', 'saute', 'fry', 'expo', 'cold', 'pizza', 'bar', 'pastry',
] as const

const ALLERGEN_OPTIONS = [
  'gluten', 'dairy', 'nuts', 'shellfish', 'soy', 'eggs', 'fish', 'sesame',
] as const

const selectClassName = 'flex h-8 w-full items-center rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'

interface QuickAddSpecialProps {
  isOpen: boolean
  onClose: () => void
  categories: MenuCategory[]
  onSave: (data: {
    name: string
    price: string
    category_id: string
    description: string
    prep_station: string | null
    allergens: string[] | null
    availability_preset: AvailabilityPreset
  }) => Promise<void>
}

export function QuickAddSpecial({
  isOpen,
  onClose,
  categories,
  onSave,
}: QuickAddSpecialProps) {
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '')
  const [description, setDescription] = useState('')
  const [station, setStation] = useState('')
  const [allergens, setAllergens] = useState<string[]>([])
  const [availability, setAvailability] = useState<AvailabilityPreset>('always')
  const [isSaving, setIsSaving] = useState(false)

  const resetForm = useCallback(() => {
    setName('')
    setPrice('')
    setCategoryId(categories[0]?.id ?? '')
    setDescription('')
    setStation('')
    setAllergens([])
    setAvailability('always')
  }, [categories])

  const handleSave = useCallback(async () => {
    if (!name.trim() || !price.trim() || !categoryId) return
    setIsSaving(true)
    try {
      await onSave({
        name: name.trim(),
        price: price.trim(),
        category_id: categoryId,
        description: description.trim(),
        prep_station: station || null,
        allergens: allergens.length > 0 ? allergens : null,
        availability_preset: availability,
      })
      resetForm()
      onClose()
    } finally {
      setIsSaving(false)
    }
  }, [name, price, categoryId, description, station, allergens, availability, onSave, resetForm, onClose])

  const toggleAllergen = (allergen: string) => {
    setAllergens((prev) =>
      prev.includes(allergen)
        ? prev.filter((a) => a !== allergen)
        : [...prev, allergen]
    )
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl ring-1 ring-foreground/10">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-[#F06B18]/10 p-2">
              <Zap className="size-5 text-[#F06B18]" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Quick Add Special</h2>
              <p className="text-xs text-muted-foreground">Add to POS in under 30 seconds</p>
            </div>
          </div>
          <Button variant="ghost" size="icon-xs" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>

        <div className="space-y-3">
          {/* Name - required, autofocus */}
          <div className="space-y-1">
            <Label htmlFor="quick-name" className="text-xs">Name *</Label>
            <Input
              id="quick-name"
              placeholder="e.g. Pan-Seared Duck Breast"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              className="h-10 text-base"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && name.trim() && price.trim()) {
                  handleSave()
                }
              }}
            />
          </div>

          {/* Price and Category - inline */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="quick-price" className="text-xs">Price *</Label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-base font-bold text-muted-foreground">$</span>
                <Input
                  id="quick-price"
                  placeholder="0.00"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="h-10 pl-7 text-base font-bold tabular-nums"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="quick-category" className="text-xs">Category *</Label>
              <select
                id="quick-category"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className={cn(selectClassName, 'h-10')}
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Description - optional */}
          <div className="space-y-1">
            <Label htmlFor="quick-desc" className="text-xs">Description (optional)</Label>
            <Textarea
              id="quick-desc"
              placeholder="Short description..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="resize-none"
            />
          </div>

          {/* Station routing */}
          <div className="space-y-1">
            <Label className="text-xs">Station</Label>
            <div className="flex flex-wrap gap-1.5">
              {STATION_OPTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStation(station === s ? '' : s)}
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-xs font-medium capitalize transition-colors',
                    station === s
                      ? 'border-[#F06B18] bg-[#F06B18]/10 text-[#F06B18]'
                      : 'border-border text-muted-foreground'
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Quick allergen tags */}
          <div className="space-y-1">
            <Label className="text-xs">Allergens</Label>
            <div className="flex flex-wrap gap-1.5">
              {ALLERGEN_OPTIONS.map((allergen) => (
                <button
                  key={allergen}
                  type="button"
                  onClick={() => toggleAllergen(allergen)}
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-xs font-medium capitalize transition-colors',
                    allergens.includes(allergen)
                      ? 'border-warning bg-warning-bg text-warning'
                      : 'border-border text-muted-foreground'
                  )}
                >
                  {allergen}
                </button>
              ))}
            </div>
          </div>

          {/* Availability presets */}
          <div className="space-y-1">
            <Label className="text-xs">Availability</Label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setAvailability('always')}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-lg border p-2 text-xs font-medium transition-colors',
                  availability === 'always'
                    ? 'border-[#F06B18] bg-[#F06B18]/5 text-[#F06B18]'
                    : 'border-border text-muted-foreground'
                )}
              >
                <Zap className="size-4" />
                Always
              </button>
              <button
                type="button"
                onClick={() => setAvailability('tonight_only')}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-lg border p-2 text-xs font-medium transition-colors',
                  availability === 'tonight_only'
                    ? 'border-[#F06B18] bg-[#F06B18]/5 text-[#F06B18]'
                    : 'border-border text-muted-foreground'
                )}
              >
                <Clock className="size-4" />
                Tonight Only
              </button>
              <button
                type="button"
                onClick={() => setAvailability('until_86d')}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-lg border p-2 text-xs font-medium transition-colors',
                  availability === 'until_86d'
                    ? 'border-[#F06B18] bg-[#F06B18]/5 text-[#F06B18]'
                    : 'border-border text-muted-foreground'
                )}
              >
                <Ban className="size-4" />
                Until 86&apos;d
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 mt-4">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!name.trim() || !price.trim() || !categoryId || isSaving}
            className="flex-1"
          >
            <Zap className="size-3.5 mr-1" />
            {isSaving ? 'Adding...' : 'Add to Menu'}
          </Button>
        </div>
      </div>
    </div>
  )
}
