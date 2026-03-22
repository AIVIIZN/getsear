'use client'

import { useState, useEffect, useCallback } from 'react'
import { Save, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import type { MenuItem } from './ItemGrid'
import type { MenuCategory } from './CategoryPanel'

export interface ModifierGroup {
  id: string
  name: string
  is_required: boolean
  min_selections: number
  max_selections: number
  sort_order: number
  modifiers: Modifier[]
}

export interface Modifier {
  id: string
  name: string
  price: string
  is_active: boolean
  sort_order: number
}

const ALLERGEN_OPTIONS = [
  'gluten', 'dairy', 'nuts', 'shellfish', 'soy', 'eggs', 'fish', 'sesame',
] as const

const COURSE_OPTIONS = ['appetizer', 'soup', 'salad', 'entree', 'dessert', 'beverage'] as const

const STATION_OPTIONS = ['grill', 'saute', 'fry', 'expo', 'cold', 'pizza', 'bar', 'pastry'] as const

interface ItemDetailSheetProps {
  item: MenuItem | null
  isNew: boolean
  isOpen: boolean
  onClose: () => void
  onSave: (data: Partial<MenuItem>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  categories: MenuCategory[]
  modifierGroups: ModifierGroup[]
  linkedModifierGroupIds: string[]
  onLinkModifierGroups: (itemId: string, groupIds: string[]) => Promise<void>
}

interface FormData {
  name: string
  short_name: string
  description: string
  price: string
  cost: string
  category_id: string
  prep_station: string
  prep_time_minutes: string
  course: string
  is_taxable: boolean
  allergens: string[]
  plu_code: string
  barcode: string
}

export function ItemDetailSheet({
  item,
  isNew,
  isOpen,
  onClose,
  onSave,
  onDelete,
  categories,
  modifierGroups,
  linkedModifierGroupIds,
  onLinkModifierGroups,
}: ItemDetailSheetProps) {
  const [form, setForm] = useState<FormData>({
    name: '',
    short_name: '',
    description: '',
    price: '',
    cost: '',
    category_id: '',
    prep_station: '',
    prep_time_minutes: '',
    course: '',
    is_taxable: true,
    allergens: [],
    plu_code: '',
    barcode: '',
  })
  const [selectedModifierGroupIds, setSelectedModifierGroupIds] = useState<string[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Populate form when item changes
  useEffect(() => {
    if (item && !isNew) {
      setForm({
        name: item.name,
        short_name: item.short_name ?? '',
        description: item.description ?? '',
        price: item.price,
        cost: item.cost ?? '',
        category_id: item.category_id,
        prep_station: item.prep_station ?? '',
        prep_time_minutes: item.prep_time_minutes?.toString() ?? '',
        course: item.course ?? '',
        is_taxable: item.is_taxable,
        allergens: item.allergens ?? [],
        plu_code: item.plu_code ?? '',
        barcode: item.barcode ?? '',
      })
      setSelectedModifierGroupIds(linkedModifierGroupIds)
    } else {
      setForm({
        name: '',
        short_name: '',
        description: '',
        price: '',
        cost: '',
        category_id: categories[0]?.id ?? '',
        prep_station: '',
        prep_time_minutes: '',
        course: '',
        is_taxable: true,
        allergens: [],
        plu_code: '',
        barcode: '',
      })
      setSelectedModifierGroupIds([])
    }
  }, [item, isNew, linkedModifierGroupIds, categories])

  const updateField = useCallback(
    <K extends keyof FormData>(field: K, value: FormData[K]) => {
      setForm((prev) => ({ ...prev, [field]: value }))
    },
    []
  )

  const toggleAllergen = useCallback((allergen: string) => {
    setForm((prev) => ({
      ...prev,
      allergens: prev.allergens.includes(allergen)
        ? prev.allergens.filter((a) => a !== allergen)
        : [...prev.allergens, allergen],
    }))
  }, [])

  const toggleModifierGroup = useCallback((groupId: string) => {
    setSelectedModifierGroupIds((prev) =>
      prev.includes(groupId)
        ? prev.filter((id) => id !== groupId)
        : [...prev, groupId]
    )
  }, [])

  const handleSave = useCallback(async () => {
    if (!form.name.trim() || !form.price.trim() || !form.category_id) return
    setIsSaving(true)
    try {
      const payload: Partial<MenuItem> & { category_id: string } = {
        name: form.name.trim(),
        short_name: form.short_name.trim() || null,
        description: form.description.trim(),
        price: form.price,
        cost: form.cost.trim() || null,
        category_id: form.category_id,
        prep_station: form.prep_station || null,
        prep_time_minutes: form.prep_time_minutes ? parseInt(form.prep_time_minutes, 10) : null,
        course: form.course || null,
        is_taxable: form.is_taxable,
        allergens: form.allergens.length > 0 ? form.allergens : null,
        plu_code: form.plu_code.trim() || null,
        barcode: form.barcode.trim() || null,
      }
      await onSave(payload)

      // Save modifier group links if item exists
      if (item?.id) {
        await onLinkModifierGroups(item.id, selectedModifierGroupIds)
      }
    } finally {
      setIsSaving(false)
    }
  }, [form, item, selectedModifierGroupIds, onSave, onLinkModifierGroups])

  const handleDelete = useCallback(async () => {
    if (!item?.id) return
    setIsDeleting(true)
    try {
      await onDelete(item.id)
    } finally {
      setIsDeleting(false)
    }
  }, [item, onDelete])

  const isValid = form.name.trim() && form.price.trim() && form.category_id

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-[400px] sm:max-w-[400px] overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle>{isNew ? 'Add Item' : 'Edit Item'}</SheetTitle>
          <SheetDescription>
            {isNew
              ? 'Create a new menu item.'
              : `Editing "${item?.name}"`}
          </SheetDescription>
        </SheetHeader>

        <Tabs defaultValue="details" className="px-4">
          <TabsList className="w-full">
            <TabsTrigger value="details" className="flex-1">Details</TabsTrigger>
            <TabsTrigger value="modifiers" className="flex-1">Modifiers</TabsTrigger>
            <TabsTrigger value="extras" className="flex-1">Extras</TabsTrigger>
          </TabsList>

          {/* Details tab */}
          <TabsContent value="details" className="space-y-4 pt-4">
            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="item-name">Name *</Label>
              <Input
                id="item-name"
                placeholder="e.g. Grilled Salmon"
                value={form.name}
                onChange={(e) => updateField('name', e.target.value)}
              />
            </div>

            {/* Short name */}
            <div className="space-y-1.5">
              <Label htmlFor="item-short-name">Short Name (KDS)</Label>
              <Input
                id="item-short-name"
                placeholder="e.g. GRL SALMN"
                value={form.short_name}
                onChange={(e) => updateField('short_name', e.target.value)}
                maxLength={30}
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="item-desc">Description</Label>
              <Textarea
                id="item-desc"
                placeholder="Item description..."
                value={form.description}
                onChange={(e) => updateField('description', e.target.value)}
                rows={2}
              />
            </div>

            {/* Price and Cost */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="item-price">Price *</Label>
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                  <Input
                    id="item-price"
                    placeholder="0.00"
                    value={form.price}
                    onChange={(e) => updateField('price', e.target.value)}
                    className="pl-6 tabular-nums"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="item-cost">Cost</Label>
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                  <Input
                    id="item-cost"
                    placeholder="0.00"
                    value={form.cost}
                    onChange={(e) => updateField('cost', e.target.value)}
                    className="pl-6 tabular-nums"
                  />
                </div>
              </div>
            </div>

            {/* Category */}
            <div className="space-y-1.5">
              <Label htmlFor="item-category">Category *</Label>
              <select
                id="item-category"
                value={form.category_id}
                onChange={(e) => updateField('category_id', e.target.value)}
                className="flex h-8 w-full items-center rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <option value="">Select category</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Station and Course */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="item-station">Prep Station</Label>
                <select
                  id="item-station"
                  value={form.prep_station}
                  onChange={(e) => updateField('prep_station', e.target.value)}
                  className="flex h-8 w-full items-center rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <option value="">None</option>
                  {STATION_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="item-course">Course</Label>
                <select
                  id="item-course"
                  value={form.course}
                  onChange={(e) => updateField('course', e.target.value)}
                  className="flex h-8 w-full items-center rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <option value="">None</option>
                  {COURSE_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {c.charAt(0).toUpperCase() + c.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Prep time */}
            <div className="space-y-1.5">
              <Label htmlFor="item-prep-time">Prep Time (minutes)</Label>
              <Input
                id="item-prep-time"
                type="number"
                placeholder="0"
                value={form.prep_time_minutes}
                onChange={(e) => updateField('prep_time_minutes', e.target.value)}
                min={0}
              />
            </div>

            {/* Taxable toggle */}
            <div className="flex items-center justify-between">
              <Label htmlFor="item-taxable">Taxable</Label>
              <button
                type="button"
                onClick={() => updateField('is_taxable', !form.is_taxable)}
                className="touch-target flex items-center"
              >
                <Switch checked={form.is_taxable} />
              </button>
            </div>
          </TabsContent>

          {/* Modifiers tab */}
          <TabsContent value="modifiers" className="space-y-3 pt-4">
            {modifierGroups.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-center">
                <p className="text-sm text-muted-foreground">
                  No modifier groups created yet.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Create modifier groups first, then link them here.
                </p>
              </div>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  Select modifier groups to attach to this item.
                </p>
                {modifierGroups.map((group) => {
                  const isLinked = selectedModifierGroupIds.includes(group.id)
                  return (
                    <button
                      key={group.id}
                      type="button"
                      onClick={() => toggleModifierGroup(group.id)}
                      className={cn(
                        'flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors touch-target',
                        isLinked
                          ? 'border-primary bg-accent'
                          : 'border-border hover:border-border-hover'
                      )}
                    >
                      <div>
                        <div className="text-sm font-medium text-foreground">
                          {group.name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {group.is_required ? 'Required' : 'Optional'}
                          {group.min_selections > 0 && ` - min ${group.min_selections}`}
                          {group.max_selections > 0 && ` - max ${group.max_selections}`}
                          {' / '}
                          {group.modifiers.length} modifier{group.modifiers.length !== 1 ? 's' : ''}
                        </div>
                      </div>
                      <div
                        className={cn(
                          'size-5 rounded-md border-2 flex items-center justify-center transition-colors',
                          isLinked
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border'
                        )}
                      >
                        {isLinked && (
                          <svg className="size-3" viewBox="0 0 12 12" fill="none">
                            <path
                              d="M2 6l3 3 5-5"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        )}
                      </div>
                    </button>
                  )
                })}
              </>
            )}
          </TabsContent>

          {/* Extras tab */}
          <TabsContent value="extras" className="space-y-4 pt-4">
            {/* Allergens */}
            <div className="space-y-2">
              <Label>Allergens</Label>
              <div className="flex flex-wrap gap-2">
                {ALLERGEN_OPTIONS.map((allergen) => {
                  const isSelected = form.allergens.includes(allergen)
                  return (
                    <button
                      key={allergen}
                      type="button"
                      onClick={() => toggleAllergen(allergen)}
                      className={cn(
                        'rounded-full border px-3 py-1.5 text-xs font-medium capitalize transition-colors touch-target',
                        isSelected
                          ? 'border-warning bg-warning-bg text-warning'
                          : 'border-border text-muted-foreground hover:border-border-hover'
                      )}
                    >
                      {allergen}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* PLU Code */}
            <div className="space-y-1.5">
              <Label htmlFor="item-plu">PLU Code</Label>
              <Input
                id="item-plu"
                placeholder="e.g. 1234"
                value={form.plu_code}
                onChange={(e) => updateField('plu_code', e.target.value)}
                maxLength={20}
              />
            </div>

            {/* Barcode */}
            <div className="space-y-1.5">
              <Label htmlFor="item-barcode">Barcode</Label>
              <Input
                id="item-barcode"
                placeholder="e.g. 0123456789"
                value={form.barcode}
                onChange={(e) => updateField('barcode', e.target.value)}
                maxLength={50}
              />
            </div>
          </TabsContent>
        </Tabs>

        <SheetFooter className="gap-2">
          {!isNew && item?.id && (
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
              className="btn-press"
            >
              <Trash2 className="size-4 mr-1" />
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          )}
          <div className="flex-1" />
          <Button variant="outline" onClick={onClose} className="btn-press">
            <X className="size-4 mr-1" />
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!isValid || isSaving}
            className="btn-press"
          >
            <Save className="size-4 mr-1" />
            {isSaving ? 'Saving...' : isNew ? 'Create' : 'Save'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
