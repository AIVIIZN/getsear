'use client'

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { MoneyDisplay } from '@/components/shared/MoneyDisplay'
import { Check, Circle, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Modifier {
  id: string
  name: string
  price_cents: number
  is_available: boolean
  sort_order: number
  is_default?: boolean
}

interface ModifierGroup {
  id: string
  name: string
  is_required: boolean
  min_selections: number
  max_selections: number
  modifiers: Modifier[]
}

interface MenuItem {
  id: string
  name: string
  price_cents: number
  modifier_groups: ModifierGroup[]
}

interface SelectedModifier {
  modifier_id: string
  modifier_group_id: string
  name: string
  price_cents: number
  quantity: number
}

interface ModifierSheetProps {
  item: MenuItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onAddToOrder: (modifiers: SelectedModifier[], specialInstructions: string) => void
}

function formatSelectionHint(min: number, max: number): string {
  if (min === max && min === 1) return 'Choose 1'
  if (min === max) return `Choose exactly ${min}`
  if (min === 0 && max > 0) return `Choose up to ${max}`
  if (min > 0 && max > min) return `Choose ${min} to ${max}`
  if (min > 0) return `Choose at least ${min}`
  return ''
}

export function ModifierSheet({ item, open, onOpenChange, onAddToOrder }: ModifierSheetProps) {
  const [selections, setSelections] = useState<Map<string, Set<string>>>(new Map())
  const [specialInstructions, setSpecialInstructions] = useState('')
  const [attemptedSubmit, setAttemptedSubmit] = useState(false)
  const groupRefs = useRef<Map<string, HTMLDivElement | null>>(new Map())
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Pre-select default modifiers when item changes
  useEffect(() => {
    if (item && open) {
      const defaults = new Map<string, Set<string>>()
      for (const group of item.modifier_groups) {
        const defaultMods = group.modifiers.filter((m) => m.is_default && m.is_available)
        if (defaultMods.length > 0) {
          defaults.set(group.id, new Set(defaultMods.map((m) => m.id)))
        }
      }
      setSelections(defaults)
      setSpecialInstructions('')
      setAttemptedSubmit(false)
    }
  }, [item, open])

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (!isOpen) {
        setSelections(new Map())
        setSpecialInstructions('')
        setAttemptedSubmit(false)
      }
      onOpenChange(isOpen)
    },
    [onOpenChange]
  )

  const toggleModifier = useCallback((groupId: string, modifierId: string, maxSelections: number) => {
    setSelections((prev) => {
      const next = new Map(prev)
      const groupSet = new Set(next.get(groupId) ?? [])

      if (groupSet.has(modifierId)) {
        groupSet.delete(modifierId)
      } else {
        // Single-select: radio behavior
        if (maxSelections === 1) {
          groupSet.clear()
        } else if (groupSet.size >= maxSelections && maxSelections > 0) {
          // At max, don't add
          return prev
        }
        groupSet.add(modifierId)
      }

      next.set(groupId, groupSet)
      return next
    })
  }, [])

  const modifierTotal = useMemo(() => {
    if (!item) return 0
    let total = 0
    for (const group of item.modifier_groups) {
      const selected = selections.get(group.id)
      if (!selected) continue
      for (const mod of group.modifiers) {
        if (selected.has(mod.id)) {
          total += mod.price_cents
        }
      }
    }
    return total
  }, [item, selections])

  const runningTotal = (item?.price_cents ?? 0) + modifierTotal

  // Validation: check each required group meets min_selections
  const groupValidation = useMemo(() => {
    if (!item) return new Map<string, boolean>()
    const result = new Map<string, boolean>()
    for (const group of item.modifier_groups) {
      if (group.is_required || group.min_selections > 0) {
        const selected = selections.get(group.id)
        const count = selected?.size ?? 0
        result.set(group.id, count >= group.min_selections)
      } else {
        result.set(group.id, true)
      }
    }
    return result
  }, [item, selections])

  const isValid = useMemo(() => {
    for (const [, valid] of groupValidation) {
      if (!valid) return false
    }
    return true
  }, [groupValidation])

  const handleAdd = useCallback(() => {
    if (!item) return

    if (!isValid) {
      setAttemptedSubmit(true)
      // Scroll to first invalid group
      for (const group of item.modifier_groups) {
        const valid = groupValidation.get(group.id)
        if (!valid) {
          const el = groupRefs.current.get(group.id)
          if (el && scrollContainerRef.current) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }
          break
        }
      }
      return
    }

    const mods: SelectedModifier[] = []
    for (const group of item.modifier_groups) {
      const selected = selections.get(group.id)
      if (!selected) continue
      for (const mod of group.modifiers) {
        if (selected.has(mod.id)) {
          mods.push({
            modifier_id: mod.id,
            modifier_group_id: group.id,
            name: mod.name,
            price_cents: mod.price_cents,
            quantity: 1,
          })
        }
      }
    }

    onAddToOrder(mods, specialInstructions)
    handleOpenChange(false)
  }, [item, isValid, selections, specialInstructions, onAddToOrder, handleOpenChange, groupValidation])

  if (!item) return null

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        className="w-full max-w-[480px]! flex flex-col p-0!"
        showCloseButton={false}
      >
        {/* Drag indicator */}
        <div className="flex justify-center pt-3 pb-1">
          <div
            className="rounded-full bg-gray-300"
            style={{ width: 36, height: 5 }}
          />
        </div>

        <SheetHeader className="px-5 pb-4" style={{ borderBottom: '0.5px solid var(--separator, var(--border))' }}>
          <SheetTitle className="text-xl font-bold">{item.name}</SheetTitle>
          <SheetDescription>
            <MoneyDisplay cents={item.price_cents} className="text-base font-semibold text-foreground" />
          </SheetDescription>
        </SheetHeader>

        {/* Modifier groups - scrollable */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto scroll-container px-5 py-4 space-y-6"
        >
          {item.modifier_groups.map((group) => {
            const selected = selections.get(group.id) ?? new Set<string>()
            const isSingleSelect = group.max_selections === 1
            const isGroupValid = groupValidation.get(group.id) ?? true
            const showError = attemptedSubmit && !isGroupValid

            return (
              <div
                key={group.id}
                ref={(el) => { groupRefs.current.set(group.id, el) }}
                className={cn(
                  'rounded-2xl border p-4 transition-all duration-200',
                  showError
                    ? 'border-[var(--error)] bg-[var(--error-bg)]'
                    : 'border-[var(--border)] bg-white'
                )}
              >
                {/* Group header */}
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-sm font-bold text-foreground">{group.name}</h4>
                  {group.is_required && (
                    <span
                      className={cn(
                        'rounded-full px-2.5 py-0.5 text-[11px] font-bold',
                        showError
                          ? 'bg-[var(--error)] text-white'
                          : 'bg-[var(--error-bg)] text-[var(--error)]'
                      )}
                    >
                      Required
                    </span>
                  )}
                </div>

                {/* Selection hint */}
                {(group.min_selections > 0 || group.max_selections > 0) && (
                  <p className={cn(
                    'text-xs mb-3',
                    showError ? 'text-[var(--error)] font-medium' : 'text-muted-foreground'
                  )}>
                    {showError && <AlertCircle className="inline h-3 w-3 mr-1 -mt-0.5" />}
                    {formatSelectionHint(group.min_selections, group.max_selections)}
                    {showError && ` (${selected.size} selected)`}
                  </p>
                )}

                {/* Modifier options */}
                <div className="space-y-1.5">
                  {group.modifiers
                    .filter((m) => m.is_available)
                    .sort((a, b) => a.sort_order - b.sort_order)
                    .map((mod) => {
                      const isSelected = selected.has(mod.id)
                      return (
                        <button
                          key={mod.id}
                          type="button"
                          onClick={() => toggleModifier(group.id, mod.id, group.max_selections)}
                          className={cn(
                            'flex w-full items-center gap-3 rounded-xl px-3 transition-all duration-150 active:scale-[0.98]',
                            isSelected
                              ? 'bg-[var(--primary-subtle,hsl(22,90%,96%))]'
                              : 'bg-transparent hover:bg-[var(--secondary,hsl(38,25%,95%))]'
                          )}
                          style={{ minHeight: 48 }}
                        >
                          {/* Radio or Checkbox indicator */}
                          {isSingleSelect ? (
                            <div
                              className={cn(
                                'flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                                isSelected
                                  ? 'border-[var(--primary)] bg-[var(--primary)]'
                                  : 'border-[var(--border-hover,hsl(30,10%,78%))]'
                              )}
                            >
                              {isSelected && (
                                <Circle className="h-2 w-2 fill-white text-white" />
                              )}
                            </div>
                          ) : (
                            <div
                              className={cn(
                                'flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md border-2 transition-colors',
                                isSelected
                                  ? 'border-[var(--primary)] bg-[var(--primary)]'
                                  : 'border-[var(--border-hover,hsl(30,10%,78%))]'
                              )}
                            >
                              {isSelected && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
                            </div>
                          )}

                          {/* Modifier name */}
                          <span className={cn(
                            'flex-1 text-left text-sm',
                            isSelected ? 'font-semibold text-foreground' : 'font-medium text-foreground'
                          )}>
                            {mod.name}
                          </span>

                          {/* Price adjustment - right aligned */}
                          {mod.price_cents !== 0 && (
                            <MoneyDisplay
                              cents={mod.price_cents}
                              showSign={mod.price_cents > 0}
                              className={cn(
                                'text-sm',
                                isSelected ? 'text-foreground font-semibold' : 'text-muted-foreground'
                              )}
                            />
                          )}
                          {mod.price_cents === 0 && (
                            <span className="text-xs text-muted-foreground">Included</span>
                          )}
                        </button>
                      )
                    })}
                </div>
              </div>
            )
          })}

          {/* Special instructions */}
          <div className="pt-2">
            <label htmlFor="special-instructions" className="mb-2 block text-sm font-bold text-foreground">
              Special Instructions
            </label>
            <Textarea
              id="special-instructions"
              placeholder="e.g. No onions, extra sauce..."
              value={specialInstructions}
              onChange={(e) => setSpecialInstructions(e.target.value)}
              className="min-h-[80px] resize-none text-sm rounded-xl border-[var(--border)]"
              maxLength={500}
            />
            <p className="mt-1 text-right text-xs text-muted-foreground">
              {specialInstructions.length}/500
            </p>
          </div>
        </div>

        {/* Footer with Add to Order CTA */}
        <SheetFooter
          className="gap-3 px-5 pb-5 pt-4"
          style={{ borderTop: '0.5px solid var(--separator, var(--border))' }}
        >
          <button
            type="button"
            onClick={() => handleOpenChange(false)}
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            style={{ minHeight: 48 }}
          >
            Cancel
          </button>
          <Button
            onClick={handleAdd}
            className={cn(
              'flex-1 rounded-xl text-base font-bold text-white transition-all duration-150',
              !isValid && attemptedSubmit
                ? 'bg-[var(--error)] hover:bg-[var(--error-hover)]'
                : 'bg-[var(--primary)] hover:bg-[var(--primary-hover)]'
            )}
            style={{ height: 50 }}
          >
            {!isValid && attemptedSubmit ? (
              <>
                <AlertCircle className="h-4 w-4 mr-1.5" />
                Complete Required Selections
              </>
            ) : (
              <>
                Add to Order
                <span className="ml-2 opacity-90">
                  <MoneyDisplay cents={runningTotal} className="text-white" />
                </span>
              </>
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
