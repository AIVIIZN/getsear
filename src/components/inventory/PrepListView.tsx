'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { ClipboardList, Printer, Loader2, RefreshCw, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface PrepListItem {
  inventory_item_id: string
  item_name: string
  unit: string
  current_count: number
  par_level: number
  avg_daily_usage: number
  prep_quantity: number
  priority: 'critical' | 'high' | 'normal'
  category: string
}

interface PrepListData {
  generated_at: string
  day_of_week: string
  items: PrepListItem[]
  total_items: number
  critical_count: number
}

const PRIORITY_STYLES = {
  critical: 'bg-red-50 text-red-700 border-red-200',
  high: 'bg-amber-50 text-amber-700 border-amber-200',
  normal: 'bg-green-50 text-green-700 border-green-200',
}

export function PrepListView() {
  const [data, setData] = useState<PrepListData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchPrepList = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/inventory/prep-list')
      const json = await res.json()
      if (res.ok) {
        setData(json.data)
      } else {
        toast.error(json.error ?? 'Failed to load prep list')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPrepList()
  }, [fetchPrepList])

  const handlePrint = () => {
    window.print()
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    )
  }

  if (!data || data.items.length === 0) {
    return (
      <Card className="border-warm shadow-warm">
        <CardContent className="py-12 text-center">
          <ClipboardList className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="font-medium text-foreground">All items at par</p>
          <p className="text-sm text-muted-foreground mt-1">
            No prep needed right now. All inventory items are at or above their par levels.
          </p>
        </CardContent>
      </Card>
    )
  }

  // Group by category
  const categories = Array.from(new Set(data.items.map((i) => i.category))).sort()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            Prep List &mdash; {data.day_of_week}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Generated {new Date(data.generated_at).toLocaleString()} &middot; {data.total_items}{' '}
            items
            {data.critical_count > 0 && (
              <span className="text-red-600 ml-1">
                ({data.critical_count} critical)
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchPrepList} disabled={loading}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Regenerate
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="h-3.5 w-3.5 mr-1.5" />
            Print
          </Button>
        </div>
      </div>

      {/* Critical Alerts */}
      {data.critical_count > 0 && (
        <Card className="border-red-200 bg-red-50/50 shadow-warm">
          <CardContent className="p-3 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-800">
                {data.critical_count} item{data.critical_count > 1 ? 's' : ''} critically low
              </p>
              <p className="text-xs text-red-600">
                {data.items
                  .filter((i) => i.priority === 'critical')
                  .map((i) => i.item_name)
                  .join(', ')}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Prep List by Category */}
      <div className="print:block" id="prep-list-print">
        {categories.map((category) => {
          const categoryItems = data.items.filter((i) => i.category === category)
          return (
            <Card key={category} className="border-warm shadow-warm mb-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span>{category}</span>
                  <Badge variant="outline" className="text-xs">
                    {categoryItems.length} item{categoryItems.length > 1 ? 's' : ''}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead className="text-right">On Hand</TableHead>
                      <TableHead className="text-right">Par</TableHead>
                      <TableHead className="text-right">Avg Usage</TableHead>
                      <TableHead className="text-right">Prep Qty</TableHead>
                      <TableHead>Priority</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categoryItems.map((item) => (
                      <TableRow
                        key={item.inventory_item_id}
                        className={item.priority === 'critical' ? 'bg-red-50/30' : ''}
                      >
                        <TableCell className="font-medium">{item.item_name}</TableCell>
                        <TableCell className="text-right">
                          <span
                            className={
                              item.current_count <= 0
                                ? 'text-red-600 font-bold'
                                : 'text-foreground'
                            }
                          >
                            {item.current_count}
                          </span>{' '}
                          <span className="text-xs text-muted-foreground">{item.unit}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          {item.par_level} {item.unit}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {item.avg_daily_usage.toFixed(1)} /day
                        </TableCell>
                        <TableCell className="text-right font-bold text-orange-600">
                          {item.prep_quantity.toFixed(1)} {item.unit}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={PRIORITY_STYLES[item.priority]}
                          >
                            {item.priority}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
