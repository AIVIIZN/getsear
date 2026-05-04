'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Save, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { GeneralTab, type GeneralFormData } from './tabs/GeneralTab'
import { ModifiersTab } from './tabs/ModifiersTab'
import { PhotosTab, type MenuItemPhoto } from './tabs/PhotosTab'
import { PricingTab, type PricingTabSaveData } from './tabs/PricingTab'
import { AvailabilityTab, type AvailabilityTabSaveData } from './tabs/AvailabilityTab'
import { AllergensTab, type AllergensTabData } from './tabs/AllergensTab'
import type { MenuItem } from './ItemGrid'
import type { MenuCategory } from './CategoryPanel'
import type { ModifierGroup } from './ItemDetailSheet'

interface DetailEditorProps {
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
  onCreateModifierGroup: (data: {
    name: string
    is_required: boolean
    min_selections: number
    max_selections: number
    modifiers: { name: string; price: string; is_active: boolean }[]
  }) => Promise<void>
  onUploadPhoto: (itemId: string, file: File) => Promise<void>
  onDeletePhoto: (photoId: string) => Promise<void>
  onReorderPhotos: (itemId: string, photoIds: string[]) => Promise<void>
  onGeneratePhoto?: (itemId: string) => Promise<{ url: string } | null>
  photos: MenuItemPhoto[]
  isUploadingPhoto: boolean
  isGeneratingPhoto?: boolean
  generatedPhotoPreviewUrl?: string | null
}

function createEmptyForm(categories: MenuCategory[]): GeneralFormData {
  return {
    name: '',
    short_name: '',
    description: '',
    category_id: categories[0]?.id ?? '',
    tax_class: '',
    revenue_class: '',
    prep_station: '',
    prep_time_minutes: '',
    course: '',
    plu_code: '',
    barcode: '',
    is_active: true,
    is_online_visible: true,
    is_kiosk_visible: true,
  }
}

function itemToFormData(item: MenuItem): GeneralFormData {
  return {
    name: item.name,
    short_name: item.short_name ?? '',
    description: item.description ?? '',
    category_id: item.category_id,
    tax_class: '',
    revenue_class: '',
    prep_station: item.prep_station ?? '',
    prep_time_minutes: item.prep_time_minutes?.toString() ?? '',
    course: item.course ?? '',
    plu_code: item.plu_code ?? '',
    barcode: item.barcode ?? '',
    is_active: item.is_active,
    is_online_visible: true,
    is_kiosk_visible: true,
  }
}

export function DetailEditor({
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
  onCreateModifierGroup,
  onUploadPhoto,
  onDeletePhoto,
  onReorderPhotos,
  onGeneratePhoto,
  photos,
  isUploadingPhoto,
  isGeneratingPhoto,
  generatedPhotoPreviewUrl,
}: DetailEditorProps) {
  const [generalForm, setGeneralForm] = useState<GeneralFormData>(createEmptyForm(categories))
  const [priceStr, setPriceStr] = useState('')
  const [costStr, setCostStr] = useState('')
  const [selectedModGroupIds, setSelectedModGroupIds] = useState<string[]>([])
  const [allergens, setAllergens] = useState<string[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [activeTab, setActiveTab] = useState('general')

  // Populate form when item changes
  useEffect(() => {
    if (item && !isNew) {
      setGeneralForm(itemToFormData(item))
      setPriceStr(item.price)
      setCostStr(item.cost ?? '')
      setSelectedModGroupIds(linkedModifierGroupIds)
      setAllergens(item.allergens ?? [])
    } else {
      setGeneralForm(createEmptyForm(categories))
      setPriceStr('')
      setCostStr('')
      setSelectedModGroupIds([])
      setAllergens([])
    }
    setActiveTab('general')
  }, [item, isNew, linkedModifierGroupIds, categories])

  const updateGeneralField = useCallback(
    <K extends keyof GeneralFormData>(field: K, value: GeneralFormData[K]) => {
      setGeneralForm((prev) => ({ ...prev, [field]: value }))
    },
    []
  )

  const handleSave = useCallback(async () => {
    if (!generalForm.name.trim() || !priceStr.trim() || !generalForm.category_id) return
    setIsSaving(true)
    try {
      const payload: Partial<MenuItem> & { category_id: string } = {
        name: generalForm.name.trim(),
        short_name: generalForm.short_name.trim() || null,
        description: generalForm.description.trim(),
        price: priceStr,
        cost: costStr.trim() || null,
        category_id: generalForm.category_id,
        prep_station: generalForm.prep_station || null,
        prep_time_minutes: generalForm.prep_time_minutes
          ? parseInt(generalForm.prep_time_minutes, 10)
          : null,
        course: generalForm.course || null,
        is_taxable: true,
        is_active: generalForm.is_active,
        allergens: allergens.length > 0 ? allergens : null,
        plu_code: generalForm.plu_code.trim() || null,
        barcode: generalForm.barcode.trim() || null,
      }
      await onSave(payload)

      // Save modifier group links if item exists
      if (item?.id) {
        await onLinkModifierGroups(item.id, selectedModGroupIds)
      }
    } finally {
      setIsSaving(false)
    }
  }, [generalForm, priceStr, costStr, allergens, item, selectedModGroupIds, onSave, onLinkModifierGroups])

  const handleDelete = useCallback(async () => {
    if (!item?.id) return
    if (!window.confirm(`Delete "${item.name}"? This cannot be undone.`)) return
    setIsDeleting(true)
    try {
      await onDelete(item.id)
    } finally {
      setIsDeleting(false)
    }
  }, [item, onDelete])

  const handlePhotoUpload = useCallback(
    async (file: File) => {
      if (!item?.id) return
      await onUploadPhoto(item.id, file)
    },
    [item, onUploadPhoto]
  )

  const handlePhotoReorder = useCallback(
    async (photoIds: string[]) => {
      if (!item?.id) return
      await onReorderPhotos(item.id, photoIds)
    },
    [item, onReorderPhotos]
  )

  const handlePhotoGenerate = useCallback(
    async () => {
      if (!item?.id || !onGeneratePhoto) return null
      return onGeneratePhoto(item.id)
    },
    [item, onGeneratePhoto]
  )

  const isValid = generalForm.name.trim() && priceStr.trim() && generalForm.category_id

  if (!isOpen) return null

  return (
    <div className="flex h-full w-[400px] flex-shrink-0 flex-col border-l border-border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">
          {isNew ? 'New Item' : item?.name ?? 'Edit Item'}
        </h2>
        <Button variant="ghost" size="icon-xs" onClick={onClose} aria-label="Close">
          <X className="size-4" />
        </Button>
      </div>

      {/* Price row (always visible) */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-2.5">
        <div className="flex-1">
          <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Price *</label>
          <div className="relative mt-0.5">
            <span className="absolute left-0 top-1/2 -translate-y-1/2 text-lg font-bold text-foreground">$</span>
            <input
              value={priceStr}
              onChange={(e) => setPriceStr(e.target.value)}
              placeholder="0.00"
              className="w-full bg-transparent pl-5 text-lg font-bold tabular-nums text-foreground outline-none placeholder:text-muted-foreground/40"
            />
          </div>
        </div>
        <div className="w-px h-8 bg-border" />
        <div className="flex-1">
          <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Cost</label>
          <div className="relative mt-0.5">
            <span className="absolute left-0 top-1/2 -translate-y-1/2 text-lg font-bold text-muted-foreground">$</span>
            <input
              value={costStr}
              onChange={(e) => setCostStr(e.target.value)}
              placeholder="0.00"
              className="w-full bg-transparent pl-5 text-lg font-bold tabular-nums text-muted-foreground outline-none placeholder:text-muted-foreground/40"
            />
          </div>
        </div>
      </div>

      {/* Tabbed content */}
      <div className="flex-1 overflow-y-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
          <div className="border-b border-border px-4 flex-shrink-0">
            <TabsList variant="line" className="w-full">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="modifiers">Modifiers</TabsTrigger>
              <TabsTrigger value="pricing">Pricing</TabsTrigger>
              <TabsTrigger value="availability">Hours</TabsTrigger>
              <TabsTrigger value="allergens">Allergens</TabsTrigger>
              <TabsTrigger value="photos">Photos</TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto">
            <TabsContent value="general" className="p-4">
              <GeneralTab
                form={generalForm}
                categories={categories}
                onUpdateField={updateGeneralField}
              />
            </TabsContent>

            <TabsContent value="modifiers" className="p-4">
              <ModifiersTab
                allModifierGroups={modifierGroups}
                linkedGroupIds={selectedModGroupIds}
                onLinkGroups={setSelectedModGroupIds}
                onCreateGroup={onCreateModifierGroup}
              />
            </TabsContent>

            <TabsContent value="pricing" className="p-4">
              {item && (
                <PricingTab
                  item={{ id: item.id, price: item.price, price_type: (item as unknown as Record<string, unknown>).price_type as string | undefined }}
                  locationId={item.location_id ?? ''}
                  onSave={async (data: PricingTabSaveData) => {
                    await onSave({ price: data.basePrice } as Partial<MenuItem>)
                  }}
                />
              )}
            </TabsContent>

            <TabsContent value="availability" className="p-4">
              {item && (
                <AvailabilityTab
                  item={{
                    id: item.id,
                    is_86d: item.is_86d,
                    is_running_low: false,
                  }}
                  locationId={item.location_id ?? ''}
                  onSave={async (data: AvailabilityTabSaveData) => {
                    await onSave({ is_86d: data.is_86d } as Partial<MenuItem>)
                  }}
                />
              )}
            </TabsContent>

            <TabsContent value="allergens" className="p-4">
              <AllergensTab
                initialAllergens={item?.allergens ?? null}
                initialMayContain={null}
                initialDietaryTags={null}
                initialCrossContamination={false}
                initialIngredientList=""
                onSave={async (data: AllergensTabData) => {
                  await onSave({
                    allergens: data.allergens.map(a => a.allergen_id),
                  } as Partial<MenuItem>)
                }}
              />
            </TabsContent>

            <TabsContent value="photos" className="p-4">
              <PhotosTab
                itemId={item?.id ?? null}
                photos={photos}
                onUpload={handlePhotoUpload}
                onDelete={onDeletePhoto}
                onReorder={handlePhotoReorder}
                onGenerate={onGeneratePhoto ? handlePhotoGenerate : undefined}
                isUploading={isUploadingPhoto}
                isGenerating={isGeneratingPhoto}
                generatedPreviewUrl={generatedPhotoPreviewUrl}
              />
            </TabsContent>
          </div>
        </Tabs>
      </div>

      {/* Footer */}
      <div className="flex items-center gap-2 border-t border-border px-4 py-3">
        {!isNew && item?.id && (
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            <Trash2 className="size-3.5 mr-1" />
            {isDeleting ? 'Deleting...' : 'Delete'}
          </Button>
        )}
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={!isValid || isSaving}
        >
          <Save className="size-3.5 mr-1" />
          {isSaving ? 'Saving...' : isNew ? 'Create' : 'Save'}
        </Button>
      </div>
    </div>
  )
}

