'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { AlertTriangle, Package, RefreshCw } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

interface LowStockAlert {
  id: string
  item_name: string
  current_stock: number
  par_level: number
  reorder_point: number
  unit: string
  category: string
  severity: 'critical' | 'warning'
}

interface LowStockAlertsProps {
  compact?: boolean
}

export function LowStockAlerts({ compact = false }: LowStockAlertsProps) {
  const [alerts, setAlerts] = useState<LowStockAlert[]>([])
  const [loading, setLoading] = useState(true)

  const fetchAlerts = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/inventory/alerts')
      const json = await res.json()
      if (res.ok) {
        setAlerts(json.data ?? [])
      } else {
        toast.error(json.error ?? 'Failed to load alerts')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAlerts()
  }, [fetchAlerts])

  if (loading) {
    return <Skeleton className="h-64 rounded-xl" />
  }

  const displayAlerts = compact ? alerts.slice(0, 6) : alerts

  return (
    <Card className="border-warm shadow-warm">
      <div className="flex items-center justify-between p-4 pb-2">
        <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          Low Stock Alerts
          {alerts.length > 0 && (
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
              {alerts.length}
            </Badge>
          )}
        </h3>
        <Button variant="ghost" size="sm" onClick={fetchAlerts} className="h-8 w-8 p-0">
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>
      <CardContent className="pt-0">
        {displayAlerts.length === 0 ? (
          <div className="text-center py-6">
            <Package className="h-6 w-6 text-green-500 mx-auto mb-2" />
            <p className="text-sm font-medium text-green-700">All items stocked</p>
            <p className="text-xs text-muted-foreground">No items below par level</p>
          </div>
        ) : (
          <div className="space-y-2">
            {displayAlerts.map((alert) => {
              const pctOfPar = alert.par_level > 0
                ? Math.round((alert.current_stock / alert.par_level) * 100)
                : 0
              return (
                <div
                  key={alert.id}
                  className={`flex items-center justify-between rounded-lg px-3 py-2 ${
                    alert.severity === 'critical'
                      ? 'bg-red-50 border border-red-100'
                      : 'bg-amber-50 border border-amber-100'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground truncate">
                        {alert.item_name}
                      </p>
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0 ${
                          alert.severity === 'critical'
                            ? 'bg-red-100 text-red-700 border-red-200'
                            : 'bg-amber-100 text-amber-700 border-amber-200'
                        }`}
                      >
                        {alert.severity}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {alert.current_stock} / {alert.par_level} {alert.unit}
                    </p>
                  </div>
                  <div className="ml-3 w-16">
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          alert.severity === 'critical' ? 'bg-red-500' : 'bg-amber-500'
                        }`}
                        style={{ width: `${Math.min(100, pctOfPar)}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-right text-muted-foreground mt-0.5">
                      {pctOfPar}%
                    </p>
                  </div>
                </div>
              )
            })}
            {compact && alerts.length > 6 && (
              <p className="text-xs text-center text-muted-foreground pt-1">
                +{alerts.length - 6} more alerts
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
