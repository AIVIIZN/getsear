'use client'

import { useState, useCallback } from 'react'
import { DollarSign, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type NoSaleReason = 'making_change' | 'manager_override' | 'customer_request' | 'other'

interface NoSaleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Printer ID to send the cash drawer kick command to */
  printerId: string
  /** Staff member opening the drawer */
  staffId: string
  /** Terminal opening the drawer */
  terminalId?: string
  /** Called after drawer is successfully opened */
  onSuccess?: () => void
}

// ---------------------------------------------------------------------------
// Reason options
// ---------------------------------------------------------------------------

const REASON_OPTIONS: { value: NoSaleReason; label: string; icon: string }[] = [
  { value: 'making_change', label: 'Making Change', icon: '💵' },
  { value: 'manager_override', label: 'Manager Override', icon: '🔑' },
  { value: 'customer_request', label: 'Customer Request', icon: '👤' },
  { value: 'other', label: 'Other', icon: '📝' },
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NoSaleDialog({
  open,
  onOpenChange,
  printerId,
  staffId,
  terminalId,
  onSuccess,
}: NoSaleDialogProps) {
  const [selectedReason, setSelectedReason] = useState<NoSaleReason | null>(null)
  const [otherText, setOtherText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reasonText = selectedReason === 'other'
    ? otherText.trim()
    : REASON_OPTIONS.find((r) => r.value === selectedReason)?.label ?? ''

  const canSubmit = selectedReason !== null && (selectedReason !== 'other' || otherText.trim().length > 0)

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return

    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/printing/cash-drawer/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          printerId,
          staffId,
          terminalId: terminalId ?? null,
          reason: reasonText,
          eventType: 'no_sale',
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: 'Failed to open drawer' }))
        setError(data.error ?? 'Failed to open drawer')
        return
      }

      // Success — close dialog and notify
      onOpenChange(false)
      setSelectedReason(null)
      setOtherText('')
      onSuccess?.()
    } catch {
      setError('Network error. Check printer connection.')
    } finally {
      setIsSubmitting(false)
    }
  }, [canSubmit, printerId, staffId, terminalId, reasonText, onOpenChange, onSuccess])

  const handleClose = useCallback(() => {
    if (!isSubmitting) {
      onOpenChange(false)
      setSelectedReason(null)
      setOtherText('')
      setError(null)
    }
  }, [isSubmitting, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-[#F5A60B]/10">
            <DollarSign className="h-6 w-6 text-[#F5A60B]" strokeWidth={2} />
          </div>
          <DialogTitle className="text-center">Open Cash Drawer</DialogTitle>
          <DialogDescription className="text-center">
            Select a reason for opening the drawer without a transaction.
            This event will be logged.
          </DialogDescription>
        </DialogHeader>

        {/* Reason selection */}
        <div className="space-y-2 py-2">
          {REASON_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => setSelectedReason(option.value)}
              className={cn(
                'flex w-full items-center gap-3 rounded-xl border px-4 transition-all',
                selectedReason === option.value
                  ? 'border-[#007AFF] bg-[#007AFF]/[0.05]'
                  : 'border-black/[0.06] bg-white hover:border-black/[0.12] hover:bg-black/[0.01]'
              )}
              style={{ minHeight: 52 }}
            >
              <span className="text-lg">{option.icon}</span>
              <span
                className={cn(
                  'text-[15px] font-medium',
                  selectedReason === option.value ? 'text-[#007AFF]' : 'text-[#1C1C1E]'
                )}
              >
                {option.label}
              </span>
            </button>
          ))}

          {/* Other text input */}
          {selectedReason === 'other' && (
            <div className="pt-1">
              <Label className="mb-1.5 block text-sm text-[#3C3C43]">
                Describe the reason
              </Label>
              <Textarea
                value={otherText}
                onChange={(e) => setOtherText(e.target.value)}
                placeholder="Enter reason..."
                className="min-h-[80px] resize-none"
                maxLength={200}
                autoFocus
              />
              <p className="mt-1 text-right text-[11px] text-[#C7C7CC]">
                {otherText.length}/200
              </p>
            </div>
          )}
        </div>

        {/* Error display */}
        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-[#FF3B30]/[0.06] px-3 py-2.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#FF3B30]" strokeWidth={2} />
            <p className="text-sm text-[#FF3B30]">{error}</p>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isSubmitting}
            className="h-12"
            style={{ minHeight: 48 }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit || isSubmitting}
            className="h-12 gap-2"
            style={{ minHeight: 48 }}
          >
            <DollarSign className="h-4 w-4" />
            {isSubmitting ? 'Opening...' : 'Open Drawer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
