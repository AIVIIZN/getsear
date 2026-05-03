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
import { MoneyDisplay } from '@/components/shared/MoneyDisplay'
import { Check, ChevronLeft, ChevronRight, Package } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ModifierGroup {
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

interface ComboSlotOption {
  id: string
  menu_item_id: string
  name: string
  upcharge_cents: number
  is_default: boolean
  modifier_groups: ModifierGroup[]
}

interface ComboSlot {
  id: string
  name: string
  sort_order: number
  options: ComboSlotOption[]
}

interface ComboItem {
  id: string
  name: string
  price_cents: number
  combo_name: string
  combo_price_cents: number
  combo_slots: ComboSlot[]
}

interface SelectedSlotOption {
  slot_id: string
  slot_name: string
  option: ComboSlotOption
  modifiers: {
    modifier_id: string
    name: string
    price_cents: number
    quantity: number
  }[]
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

interface ComboBuilderProps {
  item: ComboItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onAcceptCombo: (comboName: string, comboPriceCents: number, children: ComboChildResult[]) => void
  onDeclineCombo: () => void
}

export function ComboBuilder({ item, open, onOpenChange, onAcceptCombo, onDeclineCombo }: ComboBuilderProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [slotSelections, setSlotSelections] = useState<Map<string, SelectedSlotOption>>(new Map())

  const sortedSlots = useMemo(() => {
    if (!item) return []
    return [...item.combo_slots].sort((a, b) => a.sort_order - b.sort_order)
  }, [item])

  const currentSlot = sortedSlots[currentStep] ?? null
  const totalSteps = sortedSlots.length
  const isLastStep = currentStep === totalSteps - 1

  const upchargeTotal = useMemo(() => {
    let total = 0
    for (const [, sel] of slotSelections) {
      total += sel.option.upcharge_cents
      total += sel.modifiers.reduce((sum, m) => sum + m.price_cents * m.quantity, 0)
    }
    return total
  }, [slotSelections])

  const comboPriceCents = item?.combo_price_cents ?? 0
  const runningTotal = comboPriceCents + upchargeTotal

  const selectOption = useCallback((slot: ComboSlot, option: ComboSlotOption) => {
    setSlotSelections((prev) => {
      const next = new Map(prev)
      next.set(slot.id, {
        slot_id: slot.id,
        slot_name: slot.name,
        option,
        modifiers: [],
      })
      return next
    })
  }, [])

  const handleClose = useCallback(() => {
    setCurrentStep(0)
    setSlotSelections(new Map())
    onOpenChange(false)
  }, [onOpenChange])

  const handleNext = useCallback(() => {
    if (!currentSlot) return
    const sel = slotSelections.get(currentSlot.id)
    if (!sel) return // Must select an option before proceeding

    if (isLastStep) {
      // Build combo children and submit
      if (!item) return
      const children: ComboChildResult[] = []
      for (const slot of sortedSlots) {
        const selection = slotSelections.get(slot.id)
        if (selection) {
          children.push({
            id: crypto.randomUUID(),
            menu_item_id: selection.option.menu_item_id,
            name: selection.option.name,
            slot_name: selection.slot_name,
            upcharge_cents: selection.option.upcharge_cents,
            modifiers: selection.modifiers.map((m) => ({
              id: crypto.randomUUID(),
              modifier_id: m.modifier_id,
              name: m.name,
              price_cents: m.price_cents,
              quantity: m.quantity,
            })),
          })
        }
      }
      onAcceptCombo(item.combo_name, comboPriceCents, children)
      handleClose()
    } else {
      setCurrentStep((prev) => Math.min(prev + 1, totalSteps - 1))
    }
  }, [currentSlot, isLastStep, item, sortedSlots, slotSelections, comboPriceCents, onAcceptCombo, totalSteps, handleClose])

  const handleBack = useCallback(() => {
    if (currentStep === 0) return
    setCurrentStep((prev) => prev - 1)
  }, [currentStep])

  const handleDecline = useCallback(() => {
    handleClose()
    onDeclineCombo()
  }, [handleClose, onDeclineCombo])

  const currentSelection = currentSlot ? slotSelections.get(currentSlot.id) : null
  const canProceed = currentSelection !== null && currentSelection !== undefined

  if (!item) return null

  return (
    <Sheet open={open} onOpenChange={handleClose}>
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
          <div className="flex items-center gap-2 mb-1">
            <Package className="h-5 w-5 text-[var(--primary)]" />
            <SheetTitle className="text-lg font-bold">{item.combo_name}</SheetTitle>
          </div>
          <SheetDescription className="text-sm text-muted-foreground">
            <MoneyDisplay cents={comboPriceCents} className="text-base font-semibold text-foreground" />
            {comboPriceCents < item.price_cents && (
              <span className="ml-2 text-[var(--success)] text-xs font-semibold">
                Save <MoneyDisplay cents={item.price_cents - comboPriceCents} className="text-[var(--success)]" />
              </span>
            )}
          </SheetDescription>

          {/* Step indicator */}
          {totalSteps > 1 && (
            <div className="flex items-center gap-2 mt-3">
              {sortedSlots.map((slot, idx) => (
                <div key={slot.id} className="flex items-center gap-2">
                  <div
                    className={cn(
                      'flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors',
                      idx < currentStep
                        ? 'bg-[var(--success)] text-white'
                        : idx === currentStep
                          ? 'bg-[var(--primary)] text-white'
                          : 'bg-[var(--secondary,hsl(38,25%,95%))] text-muted-foreground'
                    )}
                  >
                    {idx < currentStep ? <Check className="h-3.5 w-3.5" /> : idx + 1}
                  </div>
                  {idx < totalSteps - 1 && (
                    <div
                      className={cn(
                        'h-0.5 w-6 rounded-full transition-colors',
                        idx < currentStep ? 'bg-[var(--success)]' : 'bg-[var(--border)]'
                      )}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </SheetHeader>

        {/* Current step content */}
        <div className="flex-1 overflow-y-auto scroll-container px-5 py-4">
          {currentSlot && (
            <>
              <h3 className="text-base font-bold text-foreground mb-1">
                Step {currentStep + 1}: Choose {currentSlot.name}
              </h3>
              <p className="text-xs text-muted-foreground mb-4">
                Select one option below
              </p>

              <div className="space-y-2">
                {currentSlot.options
                  .sort((a, b) => (a.is_default ? -1 : 0) - (b.is_default ? -1 : 0))
                  .map((option) => {
                    const isSelected = currentSelection?.option.id === option.id
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => selectOption(currentSlot, option)}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-xl border px-4 transition-all duration-150 active:scale-[0.98]',
                          isSelected
                            ? 'border-[var(--primary)] bg-[var(--primary-subtle,hsl(22,90%,96%))] shadow-warm-sm'
                            : 'border-[var(--border)] bg-white hover:bg-[var(--secondary,hsl(38,25%,95%))]'
                        )}
                        style={{ minHeight: 56 }}
                      >
                        {/* Radio indicator */}
                        <div
                          className={cn(
                            'flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                            isSelected
                              ? 'border-[var(--primary)] bg-[var(--primary)]'
                              : 'border-[var(--border-hover,hsl(30,10%,78%))]'
                          )}
                        >
                          {isSelected && (
                            <div className="h-2 w-2 rounded-full bg-white" />
                          )}
                        </div>

                        {/* Option name */}
                        <span className={cn(
                          'flex-1 text-left text-sm',
                          isSelected ? 'font-semibold text-foreground' : 'font-medium text-foreground'
                        )}>
                          {option.name}
                          {option.is_default && (
                            <span className="ml-2 text-xs text-muted-foreground">(Popular)</span>
                          )}
                        </span>

                        {/* Upcharge */}
                        {option.upcharge_cents > 0 ? (
                          <MoneyDisplay
                            cents={option.upcharge_cents}
                            showSign
                            className={cn(
                              'text-sm',
                              isSelected ? 'text-foreground font-semibold' : 'text-muted-foreground'
                            )}
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">Included</span>
                        )}
                      </button>
                    )
                  })}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <SheetFooter
          className="px-5 pb-5 pt-4 gap-3"
          style={{ borderTop: '0.5px solid var(--separator, var(--border))' }}
        >
          <div className="flex w-full items-center justify-between mb-3">
            <span className="text-sm text-muted-foreground">Combo Total</span>
            <MoneyDisplay cents={runningTotal} className="text-lg font-bold text-foreground" />
          </div>

          <div className="flex w-full gap-3">
            {currentStep === 0 ? (
              <button
                type="button"
                onClick={handleDecline}
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                style={{ minHeight: 48 }}
              >
                No thanks
              </button>
            ) : (
              <Button
                onClick={handleBack}
                variant="outline"
                className="rounded-xl font-semibold"
                style={{ height: 50, minWidth: 80 }}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            )}

            <Button
              onClick={handleNext}
              disabled={!canProceed}
              className="flex-1 rounded-xl text-base font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-40"
              style={{ height: 50 }}
            >
              {isLastStep ? (
                <>
                  Add Combo to Order
                  <span className="ml-2 opacity-90">
                    <MoneyDisplay cents={runningTotal} className="text-white" />
                  </span>
                </>
              ) : (
                <>
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </>
              )}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
