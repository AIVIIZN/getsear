'use client'

import { useState } from 'react'
import { AlertTriangle, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { resolveConflict } from '@/lib/offline/conflict-resolver'
import type { CachedConflict } from '@/lib/offline/db'

interface ConflictResolutionDialogProps {
  conflict: CachedConflict
  open: boolean
  onClose: () => void
  onResolved: () => void
}

type Resolution = 'keep_local' | 'keep_server' | 'merge'

/**
 * Two-column comparison dialog for conflict resolution.
 * Shows local vs server data with Keep Mine / Keep Server / Merge buttons.
 */
export function ConflictResolutionDialog({
  conflict,
  open,
  onClose,
  onResolved,
}: ConflictResolutionDialogProps) {
  const [isResolving, setIsResolving] = useState(false)
  const [selectedResolution, setSelectedResolution] = useState<Resolution | null>(null)

  if (!open) return null

  const handleResolve = async (resolution: Resolution) => {
    setIsResolving(true)
    setSelectedResolution(resolution)
    try {
      await resolveConflict(conflict.id, resolution)
      onResolved()
      onClose()
    } catch (error) {
      console.error('Failed to resolve conflict:', error)
    } finally {
      setIsResolving(false)
      setSelectedResolution(null)
    }
  }

  const localEntries = Object.entries(conflict.local_data).filter(
    ([key]) => !['synced_at', 'sync_status', 'location_id'].includes(key)
  )
  const serverEntries = Object.entries(conflict.server_data).filter(
    ([key]) => !['synced_at', 'sync_status', 'location_id'].includes(key)
  )

  // Find differing fields
  const differingKeys = new Set<string>()
  for (const [key, value] of localEntries) {
    const serverValue = conflict.server_data[key]
    if (JSON.stringify(value) !== JSON.stringify(serverValue)) {
      differingKeys.add(key)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div
        className="relative w-full max-w-2xl mx-4 rounded-xl bg-white shadow-2xl overflow-hidden"
        style={{ maxHeight: 'calc(100vh - 80px)' }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-[rgba(60,60,67,0.12)]">
          <div className="flex items-center justify-center w-9 h-9 rounded-full bg-[#EF4444]/10">
            <AlertTriangle className="h-4.5 w-4.5 text-[#EF4444]" strokeWidth={2} />
          </div>
          <div>
            <h2 className="text-[17px] font-semibold text-[#1C1C1E]">
              Resolve Conflict
            </h2>
            <p className="text-[13px] text-[#8E8E93] mt-0.5">
              {conflict.description}
            </p>
          </div>
        </div>

        {/* Two-column comparison */}
        <div className="grid grid-cols-2 gap-0 overflow-auto" style={{ maxHeight: 360 }}>
          {/* Local (Your Version) */}
          <div className="border-r border-[rgba(60,60,67,0.12)]">
            <div className="sticky top-0 px-4 py-2.5 bg-[#F59E0B]/5 border-b border-[rgba(60,60,67,0.12)]">
              <span className="text-[13px] font-semibold text-[#92400E]">Your Version (Local)</span>
            </div>
            <div className="px-4 py-3 space-y-2">
              {localEntries.map(([key, value]) => (
                <div key={key} className={cn(
                  'rounded-md px-2.5 py-1.5',
                  differingKeys.has(key) ? 'bg-[#F59E0B]/8' : ''
                )}>
                  <div className="text-[11px] font-medium text-[#8E8E93] uppercase tracking-wide">
                    {formatFieldName(key)}
                  </div>
                  <div className="text-[14px] text-[#1C1C1E] mt-0.5 break-words">
                    {formatValue(value)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Server Version */}
          <div>
            <div className="sticky top-0 px-4 py-2.5 bg-[#3B82F6]/5 border-b border-[rgba(60,60,67,0.12)]">
              <span className="text-[13px] font-semibold text-[#1E40AF]">Server Version</span>
            </div>
            <div className="px-4 py-3 space-y-2">
              {serverEntries.map(([key, value]) => (
                <div key={key} className={cn(
                  'rounded-md px-2.5 py-1.5',
                  differingKeys.has(key) ? 'bg-[#3B82F6]/8' : ''
                )}>
                  <div className="text-[11px] font-medium text-[#8E8E93] uppercase tracking-wide">
                    {formatFieldName(key)}
                  </div>
                  <div className="text-[14px] text-[#1C1C1E] mt-0.5 break-words">
                    {formatValue(value)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-[rgba(60,60,67,0.12)] bg-[#F9F9F9]">
          <button
            onClick={onClose}
            className={cn(
              'px-4 py-2 rounded-lg text-[14px] font-medium',
              'text-[#3C3C43] bg-white border border-[rgba(60,60,67,0.12)]',
              'hover:bg-[#F2F2F7] active:bg-[#E5E5EA] transition-colors'
            )}
            style={{ minHeight: 40 }}
            disabled={isResolving}
          >
            Cancel
          </button>
          <button
            onClick={() => handleResolve('keep_server')}
            disabled={isResolving}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2 rounded-lg text-[14px] font-medium',
              'text-[#1E40AF] bg-[#3B82F6]/10 border border-[#3B82F6]/20',
              'hover:bg-[#3B82F6]/15 active:bg-[#3B82F6]/20 transition-colors',
              isResolving && selectedResolution === 'keep_server' && 'opacity-60'
            )}
            style={{ minHeight: 40 }}
          >
            Keep Server
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => handleResolve('keep_local')}
            disabled={isResolving}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2 rounded-lg text-[14px] font-semibold',
              'text-white bg-[#007AFF]',
              'hover:bg-[#E05A0D] active:bg-[#C44D0B] transition-colors',
              isResolving && selectedResolution === 'keep_local' && 'opacity-60'
            )}
            style={{ minHeight: 40 }}
          >
            Keep Mine
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}

function formatFieldName(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'object') return JSON.stringify(value, null, 2)
  return String(value)
}
