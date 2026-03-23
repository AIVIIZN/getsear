'use client'

import { useState, useCallback } from 'react'
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
import { ManagerPinDialog } from './ManagerPinDialog'
import { cn } from '@/lib/utils'

const COMP_REASONS = [
  { id: 'service_recovery', label: 'Service recovery' },
  { id: 'quality_issue', label: 'Quality issue' },
  { id: 'long_wait', label: 'Long wait time' },
  { id: 'manager_comp', label: 'Manager comp' },
  { id: 'vip_guest', label: 'VIP guest' },
  { id: 'employee_meal', label: 'Employee meal' },
  { id: 'other', label: 'Other' },
] as const

interface CompDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  itemName: string
  itemPriceCents: number
  onConfirm: (reason: string, note: string, managerId: string) => void
}

/**
 * Comp dialog — always requires manager PIN since it zeroes out an item.
 */
export function CompDialog({
  open,
  onOpenChange,
  itemName,
  itemPriceCents,
  onConfirm,
}: CompDialogProps) {
  const [selectedReason, setSelectedReason] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [pinOpen, setPinOpen] = useState(false)

  const handleConfirm = useCallback(() => {
    if (!selectedReason) return
    setPinOpen(true)
  }, [selectedReason])

  const handlePinVerified = useCallback(
    (managerId: string) => {
      const reasonLabel = COMP_REASONS.find((r) => r.id === selectedReason)?.label ?? selectedReason ?? ''
      onConfirm(reasonLabel, note, managerId)
      onOpenChange(false)
      setSelectedReason(null)
      setNote('')
    },
    [selectedReason, note, onConfirm, onOpenChange]
  )

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full max-w-[420px]! flex flex-col" showCloseButton={false}>
          <SheetHeader className="border-b border-border pb-4">
            <SheetTitle className="text-lg">Comp Item</SheetTitle>
            <SheetDescription>
              <span className="font-medium text-foreground">{itemName}</span>
              {' — '}
              <MoneyDisplay cents={itemPriceCents} className="font-semibold text-foreground" />
              <span className="ml-2 rounded-full bg-[var(--warning-bg)] px-2 py-0.5 text-[10px] font-bold text-[var(--warning)]">
                Manager Required
              </span>
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            <p className="text-sm font-medium text-foreground">Reason for comp</p>
            <div className="space-y-1.5">
              {COMP_REASONS.map((reason) => (
                <button
                  key={reason.id}
                  type="button"
                  onClick={() => setSelectedReason(reason.id)}
                  className={cn(
                    'btn-press touch-target-lg flex w-full items-center rounded-xl border px-4 py-3.5 text-left text-sm font-medium transition-all duration-150',
                    selectedReason === reason.id
                      ? 'border-[var(--primary)] bg-[var(--accent)] text-foreground'
                      : 'border-border bg-white text-foreground hover:bg-[var(--secondary)]'
                  )}
                >
                  <div
                    className={cn(
                      'mr-3 h-4 w-4 shrink-0 rounded-full border-2 transition-colors',
                      selectedReason === reason.id
                        ? 'border-[var(--primary)] bg-[var(--primary)]'
                        : 'border-[var(--border-hover)]'
                    )}
                  >
                    {selectedReason === reason.id && (
                      <div className="mt-0.5 ml-0.5 h-2 w-2 rounded-full bg-white" />
                    )}
                  </div>
                  {reason.label}
                </button>
              ))}
            </div>

            {selectedReason === 'other' && (
              <Textarea
                placeholder="Describe the reason..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="min-h-[80px] resize-none text-sm"
                maxLength={500}
              />
            )}
          </div>

          <SheetFooter className="border-t border-border gap-3 pt-4">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="btn-press touch-target-lg text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <Button
              onClick={handleConfirm}
              disabled={!selectedReason}
              className="btn-press touch-target-lg flex-1 h-14 rounded-xl text-base font-semibold bg-[var(--warning)] text-white hover:bg-amber-600 disabled:opacity-40"
            >
              Comp — Manager PIN
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <ManagerPinDialog
        open={pinOpen}
        onOpenChange={setPinOpen}
        title="Manager Approval"
        description={`Comp: ${itemName}`}
        onVerified={handlePinVerified}
      />
    </>
  )
}
