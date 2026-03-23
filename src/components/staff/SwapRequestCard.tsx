'use client'

import { ArrowLeftRight, ArrowDown, HandHeart, Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface SwapRequestCardProps {
  type: 'swap' | 'drop' | 'pickup'
  requesterName: string
  shiftDate: string
  shiftTime: string
  role: string
  targetName?: string | null
  targetShift?: string | null
  status: string
  reason?: string | null
  onApprove?: () => void
  onDeny?: () => void
  loading?: boolean
}

const TYPE_CONFIG = {
  swap: { icon: ArrowLeftRight, label: 'Swap Request', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  drop: { icon: ArrowDown, label: 'Drop Request', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  pickup: { icon: HandHeart, label: 'Pickup Request', color: 'bg-green-50 text-green-700 border-green-200' },
}

export function SwapRequestCard({
  type,
  requesterName,
  shiftDate,
  shiftTime,
  role,
  targetName,
  targetShift,
  status,
  reason,
  onApprove,
  onDeny,
  loading = false,
}: SwapRequestCardProps) {
  const config = TYPE_CONFIG[type]
  const Icon = config.icon

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-3">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className={`text-xs ${config.color}`}>
                {config.label}
              </Badge>
              <Badge variant="outline" className="text-xs capitalize">
                {status}
              </Badge>
            </div>
            <p className="text-sm font-medium text-foreground">
              {requesterName}
            </p>
            <p className="text-xs text-muted-foreground">
              {shiftDate} {shiftTime} ({role})
            </p>
            {type === 'swap' && targetName && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Swap with: {targetName} {targetShift ?? ''}
              </p>
            )}
            {reason && (
              <p className="text-xs text-muted-foreground mt-0.5 italic">
                &quot;{reason}&quot;
              </p>
            )}

            {status === 'pending' && onApprove && onDeny && (
              <div className="flex gap-2 mt-2">
                <Button size="sm" variant="outline" onClick={onDeny} disabled={loading} className="h-7 text-xs">
                  Deny
                </Button>
                <Button size="sm" onClick={onApprove} disabled={loading} className="h-7 text-xs">
                  {loading && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                  Approve
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
