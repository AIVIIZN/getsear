'use client'

import { X, ShoppingBag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { SwapRequestCard } from './SwapRequestCard'
import { ShiftBlock } from './ShiftBlock'
import type { ScheduleShift, SwapRequest } from '@/stores/schedule-store'

interface ShiftMarketplaceProps {
  openShifts: ScheduleShift[]
  swapRequests: SwapRequest[]
  onClose: () => void
  onPickupShift: (shiftId: string) => void
  onApproveRequest: (requestId: string) => void
  onDenyRequest: (requestId: string) => void
}

export function ShiftMarketplace({
  openShifts,
  swapRequests,
  onClose,
  onPickupShift,
  onApproveRequest,
  onDenyRequest,
}: ShiftMarketplaceProps) {
  const pendingRequests = swapRequests.filter((r) => r.status === 'pending')

  return (
    <div className="w-80 border-l border-border bg-card flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <ShoppingBag className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Shift Marketplace</h3>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {/* Open shifts */}
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Open Shifts ({openShifts.length})
            </h4>
            {openShifts.length === 0 ? (
              <p className="text-xs text-muted-foreground">No open shifts available</p>
            ) : (
              <div className="space-y-2">
                {openShifts.map((shift) => (
                  <div key={shift.id} className="space-y-1">
                    <ShiftBlock
                      startTime={shift.startTime}
                      endTime={shift.endTime}
                      role={shift.role}
                      employeeName={null}
                      isOpen
                      onClick={() => onPickupShift(shift.id)}
                    />
                    <p className="text-[10px] text-muted-foreground pl-1">
                      {new Date(shift.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Separator />

          {/* Swap/Drop/Pickup requests */}
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Requests ({pendingRequests.length} pending)
            </h4>
            {pendingRequests.length === 0 ? (
              <p className="text-xs text-muted-foreground">No pending requests</p>
            ) : (
              <div className="space-y-2">
                {pendingRequests.map((req) => (
                  <SwapRequestCard
                    key={req.id}
                    type={req.type}
                    requesterName={req.requesterName}
                    shiftDate={req.requesterShift.date}
                    shiftTime={`${req.requesterShift.startTime} - ${req.requesterShift.endTime}`}
                    role={req.requesterShift.role}
                    targetName={req.targetName}
                    targetShift={req.targetShift ? `${req.targetShift.startTime} - ${req.targetShift.endTime}` : null}
                    status={req.status}
                    reason={req.reason}
                    onApprove={() => onApproveRequest(req.id)}
                    onDeny={() => onDenyRequest(req.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}
