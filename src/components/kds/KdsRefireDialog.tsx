'use client'

import { type RefireReasonCode, REFIRE_REASON_LABELS } from '@/stores/kds-store'

/**
 * KDS Re-fire Reason Code Picker Dialog
 *
 * Shows 7 reason codes for why an item needs to be re-fired.
 * Appears on long-press of a completed/bumped item.
 */

interface KdsRefireDialogProps {
  itemName: string
  isOpen: boolean
  onSelect: (reason: RefireReasonCode) => void
  onClose: () => void
}

const REASON_CODES: RefireReasonCode[] = [
  'dropped',
  'wrong_temp',
  'wrong_item',
  'contamination',
  'customer_complaint',
  'expo_quality',
  'other',
]

export function KdsRefireDialog({ itemName, isOpen, onSelect, onClose }: KdsRefireDialogProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />

      {/* Dialog */}
      <div className="relative z-10 w-full max-w-sm rounded-2xl bg-[var(--color-kds-surface)] border border-[var(--color-kds-border-strong)] shadow-2xl">
        {/* Header */}
        <div className="border-b border-[var(--color-kds-border-strong)] px-5 py-4">
          <h3 className="text-lg font-black uppercase tracking-wider text-[var(--color-kds-priority-refire)]">
            Re-Fire Item
          </h3>
          <p className="mt-1 text-subhead text-[var(--color-kds-text-muted)]">
            {itemName}
          </p>
        </div>

        {/* Reason codes */}
        <div className="p-3">
          <p className="mb-2 px-2 text-caption-1 font-semibold uppercase tracking-wider text-[var(--color-kds-text-subtle)]">
            Select Reason
          </p>
          <div className="space-y-1.5">
            {REASON_CODES.map((code) => (
              <button
                key={code}
                onClick={() => onSelect(code)}
                className="btn-press flex w-full items-center rounded-xl bg-[var(--color-kds-surface-raised)] px-4 text-left transition-colors hover:bg-[var(--color-kds-surface-hover)] active:bg-[var(--color-kds-surface-pressed)]"
                style={{ height: 52, minHeight: 48 }}
              >
                <span className="text-callout font-semibold text-white">
                  {REFIRE_REASON_LABELS[code]}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Cancel */}
        <div className="border-t border-[var(--color-kds-border-strong)] p-3">
          <button
            onClick={onClose}
            className="btn-press flex w-full items-center justify-center rounded-xl bg-[var(--color-kds-surface-hover)] px-4 text-callout font-semibold text-[var(--color-kds-text-muted)] transition-colors hover:bg-[var(--color-kds-surface-pressed)]"
            style={{ height: 48 }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
