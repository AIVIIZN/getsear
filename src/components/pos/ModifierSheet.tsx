'use client'

import { useState, useMemo, useCallback } from 'react'
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
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Modifier {
  id: string
  name: string
  price_cents: number
  is_available: boolean
  sort_order: number
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

export function ModifierSheet({ item, open, onOpenChange, onAddToOrder }: ModifierSheetProps) {
  const [selections, setSelections] = useState<Map<string, Set<string>>>(new Map())
  const [specialInstructions, setSpecialInstructions] = useState('')

  // Reset on item change
  const resetState = useCallback(() => {
    setSelections(new Map())
    setSpecialInstructions('')
  }, [])

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (!isOpen) resetState()
      onOpenChange(isOpen)
    },
    [onOpenChange, resetState]
  )

  const toggleModifier = useCallback((groupId: string, modifierId: string, maxSelections: number) => {
    setSelections((prev) => {
      const next = new Map(prev)
      const groupSet = new Set(next.get(groupId) ?? [])

      if (groupSet.has(modifierId)) {
        groupSet.delete(modifierId)
      } else {
        if (maxSelections === 1) {
          groupSet.clear()
        } else if (groupSet.size >= maxSelections && maxSelections > 0) {
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

  const isValid = useMemo(() => {
    if (!item) return false
    for (const group of item.modifier_groups) {
      if (group.is_required) {
        const selected = selections.get(group.id)
        const count = selected?.size ?? 0
        if (count < group.min_selections) return false
      }
    }
    return true
  }, [item, selections])

  const handleAdd = useCallback(() => {
    if (!item || !isValid) return

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
  }, [item, isValid, selections, specialInstructions, onAddToOrder, handleOpenChange])

  if (!item) return null

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        className="w-full max-w-[480px]! flex flex-col"
        showCloseButton={false}
      >
        <SheetHeader className="border-b border-border pb-4">
          <SheetTitle className="text-lg">{item.name}</SheetTitle>
          <SheetDescription>
            <MoneyDisplay cents={item.price_cents} className="text-base font-semibold text-foreground" />
          </SheetDescription>
        </SheetHeader>

        {/* Modifier groups */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-5">
          {item.modifier_groups.map((group) => {
            const selected = selections.get(group.id) ?? new Set<string>()
            return (
              <div key={group.id}>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-foreground">{group.name}</h4>
                  {group.is_required && (
                    <span className="rounded-full bg-[var(--error-bg)] px-2 py-0.5 text-[10px] font-semibold text-[var(--error)]">
                      Required
                    </span>
                  )}
                </div>
                {group.min_selections > 0 && (
                  <p className="text-xs text-muted-foreground mb-2">
                    Select {group.min_selections === group.max_selections
                      ? `exactly ${group.min_selections}`
                      : `${group.min_selections}-${group.max_selections}`}
                  </p>
                )}
                <div className="space-y-1">
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
                            'btn-press touch-target-lg flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left transition-all duration-150',
                            isSelected
                              ? 'border-[var(--primary)] bg-[var(--accent)]'
                              : 'border-border bg-white hover:bg-[var(--secondary)]'
                          )}
                        >
                          <div
                            className={cn(
                              'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors',
                              isSelected
                                ? 'border-[var(--primary)] bg-[var(--primary)]'
                                : 'border-[var(--border-hover)]'
                            )}
                          >
                            {isSelected && <Check className="h-3 w-3 text-white" />}
                          </div>
                          <span className="flex-1 text-sm font-medium">{mod.name}</span>
                          {mod.price_cents !== 0 && (
                            <MoneyDisplay
                              cents={mod.price_cents}
                              showSign={mod.price_cents > 0}
                              className="text-sm text-muted-foreground"
                            />
                          )}
                        </button>
                      )
                    })}
                </div>
              </div>
            )
          })}

          {/* Special instructions */}
          <div>
            <label htmlFor="special-instructions" className="mb-1.5 block text-sm font-semibold text-foreground">
              Special Instructions
            </label>
            <Textarea
              id="special-instructions"
              placeholder="e.g. No onions, extra sauce..."
              value={specialInstructions}
              onChange={(e) => setSpecialInstructions(e.target.value)}
              className="min-h-[80px] resize-none text-sm"
              maxLength={500}
            />
          </div>
        </div>

        <SheetFooter className="border-t border-border gap-3 pt-4">
          <button
            type="button"
            onClick={() => handleOpenChange(false)}
            className="btn-press touch-target-lg text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <Button
            onClick={handleAdd}
            disabled={!isValid}
            className="btn-press touch-target-lg flex-1 h-14 rounded-xl text-base font-semibold bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] disabled:opacity-40"
          >
            Add to Order
            <span className="ml-2 opacity-80">
              <MoneyDisplay cents={runningTotal} className="text-white" />
            </span>
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
