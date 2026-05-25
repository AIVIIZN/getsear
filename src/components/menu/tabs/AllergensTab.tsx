'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { Save, Sparkles, AlertTriangle, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import {
  ALL_ALLERGENS,
  DIETARY_TAGS,
  detectAllergensFromIngredients,
  type AllergenDef,
  type AllergenMode,
  type DietaryTagDef,
} from '@/lib/menu/allergen-constants'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AllergenEntry {
  allergen_id: string
  mode: AllergenMode
}

export interface AllergensTabData {
  allergens: AllergenEntry[]
  dietary_tags: string[]
  cross_contamination_warning: boolean
  ingredient_list: string
}

interface AllergensTabProps {
  /** Initial allergen IDs already saved on the item (legacy text[] format) */
  initialAllergens: string[] | null
  /** Initial may_contain allergen IDs */
  initialMayContain: string[] | null
  /** Initial dietary tags */
  initialDietaryTags: string[] | null
  /** Cross-contamination warning toggle */
  initialCrossContamination: boolean
  /** Raw ingredient list text */
  initialIngredientList: string
  /** Called when user saves the allergens tab data */
  onSave: (data: AllergensTabData) => Promise<void>
  /** Whether save is in progress */
  isSaving?: boolean
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AllergensTab({
  initialAllergens,
  initialMayContain,
  initialDietaryTags,
  initialCrossContamination,
  initialIngredientList,
  onSave,
  isSaving = false,
}: AllergensTabProps) {
  // Allergen state: map from allergen_id to mode
  const [allergenState, setAllergenState] = useState<Map<string, AllergenMode>>(() => {
    const map = new Map<string, AllergenMode>()
    if (initialAllergens) {
      for (const id of initialAllergens) {
        map.set(id, 'CONTAINS')
      }
    }
    if (initialMayContain) {
      for (const id of initialMayContain) {
        if (!map.has(id)) {
          map.set(id, 'MAY_CONTAIN')
        }
      }
    }
    return map
  })

  const [dietaryTags, setDietaryTags] = useState<Set<string>>(
    () => new Set(initialDietaryTags ?? [])
  )
  const [crossContamination, setCrossContamination] = useState(initialCrossContamination)
  const [ingredientList, setIngredientList] = useState(initialIngredientList)

  // Track which allergens were auto-detected from ingredients
  const [autoDetected, setAutoDetected] = useState<Set<string>>(new Set())

  // Re-run auto-detection when ingredient list changes
  useEffect(() => {
    if (!ingredientList.trim()) {
      setAutoDetected(new Set())
      return
    }
    const detected = detectAllergensFromIngredients(ingredientList)
    setAutoDetected(detected)

    // Auto-add detected allergens that aren't already manually set
    setAllergenState((prev) => {
      const next = new Map(prev)
      let changed = false
      for (const id of detected) {
        if (!next.has(id)) {
          next.set(id, 'CONTAINS')
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [ingredientList])

  // Reset state when initial props change (new item selected)
  useEffect(() => {
    const map = new Map<string, AllergenMode>()
    if (initialAllergens) {
      for (const id of initialAllergens) {
        map.set(id, 'CONTAINS')
      }
    }
    if (initialMayContain) {
      for (const id of initialMayContain) {
        if (!map.has(id)) {
          map.set(id, 'MAY_CONTAIN')
        }
      }
    }
    setAllergenState(map)
    setDietaryTags(new Set(initialDietaryTags ?? []))
    setCrossContamination(initialCrossContamination)
    setIngredientList(initialIngredientList)
  }, [initialAllergens, initialMayContain, initialDietaryTags, initialCrossContamination, initialIngredientList])

  const toggleAllergen = useCallback((allergenId: string) => {
    setAllergenState((prev) => {
      const next = new Map(prev)
      if (next.has(allergenId)) {
        next.delete(allergenId)
      } else {
        next.set(allergenId, 'CONTAINS')
      }
      return next
    })
  }, [])

  const toggleAllergenMode = useCallback((allergenId: string) => {
    setAllergenState((prev) => {
      const next = new Map(prev)
      const current = next.get(allergenId)
      if (current === 'CONTAINS') {
        next.set(allergenId, 'MAY_CONTAIN')
      } else if (current === 'MAY_CONTAIN') {
        next.set(allergenId, 'CONTAINS')
      }
      return next
    })
  }, [])

  const toggleDietaryTag = useCallback((tagId: string) => {
    setDietaryTags((prev) => {
      const next = new Set(prev)
      if (next.has(tagId)) {
        next.delete(tagId)
      } else {
        next.add(tagId)
      }
      return next
    })
  }, [])

  const handleSave = useCallback(async () => {
    const allergens: AllergenEntry[] = []
    for (const [id, mode] of allergenState) {
      allergens.push({ allergen_id: id, mode })
    }

    await onSave({
      allergens,
      dietary_tags: [...dietaryTags],
      cross_contamination_warning: crossContamination,
      ingredient_list: ingredientList,
    })
  }, [allergenState, dietaryTags, crossContamination, ingredientList, onSave])

  const hasChanges = useMemo(() => {
    // Simple dirty check
    const currentAllergens = [...allergenState.keys()].sort().join(',')
    const initialSet = [...(initialAllergens ?? []), ...(initialMayContain ?? [])].sort().join(',')
    if (currentAllergens !== initialSet) return true
    const currentTags = [...dietaryTags].sort().join(',')
    const initialTagSet = (initialDietaryTags ?? []).sort().join(',')
    if (currentTags !== initialTagSet) return true
    if (crossContamination !== initialCrossContamination) return true
    if (ingredientList !== initialIngredientList) return true
    return false
  }, [allergenState, dietaryTags, crossContamination, ingredientList, initialAllergens, initialMayContain, initialDietaryTags, initialCrossContamination, initialIngredientList])

  return (
    <div className="space-y-6 py-4">
      {/* Section 1: Allergens */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-semibold text-foreground">Allergens</Label>
          <span className="text-xs text-muted-foreground">
            {allergenState.size} selected
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {ALL_ALLERGENS.map((allergen) => (
            <AllergenToggleRow
              key={allergen.id}
              allergen={allergen}
              isEnabled={allergenState.has(allergen.id)}
              mode={allergenState.get(allergen.id) ?? 'CONTAINS'}
              isAutoDetected={autoDetected.has(allergen.id)}
              onToggle={() => toggleAllergen(allergen.id)}
              onToggleMode={() => toggleAllergenMode(allergen.id)}
            />
          ))}
        </div>
      </section>

      {/* Section 2: Dietary Tags */}
      <section className="space-y-3">
        <Label className="text-sm font-semibold text-foreground">Dietary Tags</Label>
        <div className="flex flex-wrap gap-2">
          {DIETARY_TAGS.map((tag) => (
            <DietaryTagToggle
              key={tag.id}
              tag={tag}
              isSelected={dietaryTags.has(tag.id)}
              onToggle={() => toggleDietaryTag(tag.id)}
            />
          ))}
        </div>
      </section>

      {/* Section 3: Cross-contamination warning */}
      <section className="flex items-center justify-between rounded-lg border border-border bg-card p-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="size-4 text-amber-500" />
          <div>
            <p className="text-sm font-medium text-foreground">Cross-contamination Warning</p>
            <p className="text-xs text-muted-foreground">
              Adds blanket warning to online ordering and receipts
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setCrossContamination(!crossContamination)}
          className="touch-target flex items-center"
        >
          <Switch checked={crossContamination} />
        </button>
      </section>

      {/* Section 4: Ingredient list editor */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="ingredient-list" className="text-sm font-semibold text-foreground">
            Ingredient List
          </Label>
          {autoDetected.size > 0 && (
            <TooltipProvider delay={200}>
              <Tooltip>
                <TooltipTrigger className="inline-flex">
                  <Badge variant="secondary" className="gap-1 text-[10px]">
                    <Sparkles className="size-3" />
                    {autoDetected.size} auto-detected
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="left" className="text-xs max-w-[200px]">
                  Allergens auto-detected from ingredient keywords are marked with a sparkle icon above.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <Textarea
          id="ingredient-list"
          placeholder="Enter ingredients separated by commas (e.g., flour, butter, eggs, milk, salt)"
          value={ingredientList}
          onChange={(e) => setIngredientList(e.target.value)}
          rows={3}
          className="text-sm"
        />
        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
          <Info className="size-3 shrink-0" />
          Allergens are automatically detected from ingredients. Manually toggle to override.
        </p>
      </section>

      {/* Save button */}
      <div className="flex justify-end pt-2">
        <Button
          onClick={handleSave}
          disabled={!hasChanges || isSaving}
          className="btn-press"
        >
          <Save className="size-4 mr-1" />
          {isSaving ? 'Saving...' : 'Save Allergens'}
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface AllergenToggleRowProps {
  allergen: AllergenDef
  isEnabled: boolean
  mode: AllergenMode
  isAutoDetected: boolean
  onToggle: () => void
  onToggleMode: () => void
}

function AllergenToggleRow({
  allergen,
  isEnabled,
  mode,
  isAutoDetected,
  onToggle,
  onToggleMode,
}: AllergenToggleRowProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between rounded-lg border p-2 transition-colors',
        isEnabled
          ? 'border-foreground/20 bg-accent/50'
          : 'border-border bg-card'
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-2 touch-target flex-1 min-w-0"
      >
        <span
          className={cn(
            'inline-flex size-6 items-center justify-center rounded-full text-[10px] font-bold shrink-0 transition-all',
            isEnabled
              ? mode === 'MAY_CONTAIN'
                ? 'border-2 border-dashed bg-transparent'
                : 'text-white'
              : 'bg-muted text-muted-foreground'
          )}
          style={{
            backgroundColor: isEnabled && mode === 'CONTAINS' ? allergen.color : undefined,
            borderColor: isEnabled && mode === 'MAY_CONTAIN' ? allergen.color : undefined,
            color: isEnabled && mode === 'MAY_CONTAIN' ? allergen.color : isEnabled ? 'var(--color-white)' : undefined,
          }}
        >
          {allergen.abbreviation}
        </span>
        <span className="text-xs font-medium text-foreground truncate">
          {allergen.name}
        </span>
        {isAutoDetected && isEnabled && (
          <Sparkles className="size-3 text-amber-500 shrink-0" />
        )}
      </button>

      {isEnabled && (
        <button
          type="button"
          onClick={onToggleMode}
          className="touch-target shrink-0 ml-1"
        >
          <Badge
            variant={mode === 'CONTAINS' ? 'destructive' : 'secondary'}
            className="text-[9px] px-1 py-0 cursor-pointer select-none"
          >
            {mode === 'CONTAINS' ? 'Contains' : 'May'}
          </Badge>
        </button>
      )}
    </div>
  )
}

interface DietaryTagToggleProps {
  tag: DietaryTagDef
  isSelected: boolean
  onToggle: () => void
}

function DietaryTagToggle({ tag, isSelected, onToggle }: DietaryTagToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all touch-target',
        isSelected
          ? 'text-white border-transparent shadow-sm'
          : 'border-border text-muted-foreground hover:border-foreground/20'
      )}
      style={{
        backgroundColor: isSelected ? tag.color : undefined,
      }}
    >
      <span className="font-bold">{tag.abbreviation}</span>
      <span>{tag.name}</span>
    </button>
  )
}
