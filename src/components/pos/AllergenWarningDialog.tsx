'use client'

import { useCallback } from 'react'
import { AlertTriangle, X } from 'lucide-react'

interface AllergenConflict {
  allergen: string
  seatNumber: number | null
  guestName: string | null
  severity: 'preference' | 'intolerance' | 'allergy' | 'severe_anaphylaxis'
}

interface AllergenWarningDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  itemName: string
  conflicts: AllergenConflict[]
  onAcknowledge: () => void
  onCancel: () => void
}

const SEVERITY_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  preference: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Preference' },
  intolerance: { bg: 'bg-orange-50', text: 'text-orange-700', label: 'Intolerance' },
  allergy: { bg: 'bg-red-50', text: 'text-red-700', label: 'Allergy' },
  severe_anaphylaxis: { bg: 'bg-red-100', text: 'text-red-800', label: 'ANAPHYLAXIS' },
}

export function AllergenWarningDialog({
  open,
  onOpenChange,
  itemName,
  conflicts,
  onAcknowledge,
  onCancel,
}: AllergenWarningDialogProps) {
  const handleAcknowledge = useCallback(() => {
    onAcknowledge()
    onOpenChange(false)
  }, [onAcknowledge, onOpenChange])

  const handleCancel = useCallback(() => {
    onCancel()
    onOpenChange(false)
  }, [onCancel, onOpenChange])

  const hasSevere = conflicts.some(
    (c) => c.severity === 'allergy' || c.severity === 'severe_anaphylaxis'
  )

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-[420px] rounded-2xl bg-white p-0 shadow-xl overflow-hidden">
        {/* Red header banner */}
        <div className="bg-red-600 px-5 py-4 text-center">
          <AlertTriangle className="mx-auto h-10 w-10 text-white mb-2" />
          <h3 className="text-xl font-black text-white tracking-tight">
            ALLERGEN WARNING
          </h3>
          <p className="mt-1 text-sm font-medium text-red-100">
            {itemName}
          </p>
        </div>

        {/* Conflicts list */}
        <div className="px-5 py-4 space-y-2.5 max-h-64 overflow-y-auto">
          {conflicts.map((conflict, idx) => {
            const style = SEVERITY_STYLES[conflict.severity] ?? SEVERITY_STYLES.allergy
            return (
              <div
                key={idx}
                className={`flex items-center gap-3 rounded-xl ${style.bg} px-4 py-3 border border-red-200`}
              >
                <AlertTriangle className={`h-5 w-5 shrink-0 ${style.text}`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-bold ${style.text}`}>
                    Contains {conflict.allergen.toUpperCase()}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {conflict.seatNumber != null ? `Seat ${conflict.seatNumber}` : 'Guest'}
                    {conflict.guestName ? ` — ${conflict.guestName}` : ''} has{' '}
                    {conflict.severity === 'severe_anaphylaxis' ? 'a severe' : 'a'}{' '}
                    {conflict.allergen} {conflict.severity.replace('_', ' ')}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full ${style.bg} border ${style.text} px-2 py-0.5 text-[10px] font-black uppercase`}>
                  {style.label}
                </span>
              </div>
            )
          })}
        </div>

        {/* Action buttons */}
        <div className="border-t border-border px-5 py-4 flex gap-3">
          <button
            type="button"
            onClick={handleCancel}
            className="btn-press flex-1 h-14 rounded-xl bg-[var(--secondary)] text-sm font-bold text-foreground transition-colors hover:bg-[var(--muted)]"
          >
            Cancel — Don&apos;t Add
          </button>
          <button
            type="button"
            onClick={handleAcknowledge}
            className={`btn-press flex-1 h-14 rounded-xl text-sm font-bold text-white transition-colors ${
              hasSevere
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-amber-500 hover:bg-amber-600'
            }`}
          >
            {hasSevere ? 'I Understand — Add Anyway' : 'Acknowledge & Add'}
          </button>
        </div>
      </div>
    </div>
  )
}
