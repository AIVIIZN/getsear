'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { TrendingDown, TrendingUp, AlertTriangle, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

interface FoodCostCategory {
  category: string
  theoretical_cost: number
  actual_cost: number
  revenue: number
  theoretical_pct: number
  actual_pct: number
  variance_pct: number
  is_flagged: boolean
}

interface FoodCostReportData {
  total_theoretical_cost: number
  total_actual_cost: number
  total_revenue: number
  theoretical_pct: number
  actual_pct: number
  variance_pct: number
  by_category: FoodCostCategory[]
  current_food_cost_pct: number
  period: string
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

export function FoodCostReport() {
  const [data, setData] = useState<FoodCostReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('week')

  const fetchReport = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/inventory/food-cost?period=${period}`)
      const json = await res.json()
      if (res.ok) {
        setData(json.data)
      } else {
        toast.error(json.error ?? 'Failed to load food cost report')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => {
    fetchReport()
  }, [fetchReport])

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    )
  }

  if (!data) {
    return (
      <Card className="border-warm shadow-warm">
        <CardContent className="py-12 text-center">
          <AlertTriangle className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No food cost data available</p>
          <p className="text-xs text-muted-foreground mt-1">
            Link recipes to menu items and record inventory to see food cost analysis
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground">Food Cost Analysis</h3>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={(v) => v && setPeriod(v)}>
            <SelectTrigger className="w-32 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={fetchReport} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Refresh'}
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-warm shadow-warm">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Theoretical Food Cost
            </p>
            <p className="text-2xl font-bold text-blue-600 mt-1">{data.theoretical_pct}%</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {formatCents(data.total_theoretical_cost)} of {formatCents(data.total_revenue)} revenue
            </p>
          </CardContent>
        </Card>

        <Card className="border-warm shadow-warm">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Actual Food Cost
            </p>
            <p
              className={`text-2xl font-bold mt-1 ${
                data.actual_pct > 35
                  ? 'text-red-600'
                  : data.actual_pct > 30
                    ? 'text-amber-600'
                    : 'text-green-600'
              }`}
            >
              {data.actual_pct}%
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {formatCents(data.total_actual_cost)} actual cost
            </p>
          </CardContent>
        </Card>

        <Card
          className={`border-warm shadow-warm ${
            Math.abs(data.variance_pct) > 3 ? 'ring-2 ring-red-200' : ''
          }`}
        >
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Variance
            </p>
            <div className="flex items-center gap-2 mt-1">
              {data.variance_pct > 0 ? (
                <TrendingUp className="h-5 w-5 text-red-500" />
              ) : (
                <TrendingDown className="h-5 w-5 text-green-500" />
              )}
              <p
                className={`text-2xl font-bold ${
                  Math.abs(data.variance_pct) > 3 ? 'text-red-600' : 'text-green-600'
                }`}
              >
                {data.variance_pct > 0 ? '+' : ''}
                {data.variance_pct}%
              </p>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {Math.abs(data.variance_pct) > 3 ? 'Exceeds 3% threshold' : 'Within threshold'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Category Breakdown */}
      <Card className="border-warm shadow-warm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Cost by Category</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {data.by_category.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No category data available. Link recipes to menu items to see breakdown.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Theoretical</TableHead>
                  <TableHead className="text-right">Actual</TableHead>
                  <TableHead className="text-right">Variance</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.by_category.map((cat) => (
                  <TableRow
                    key={cat.category}
                    className={cat.is_flagged ? 'bg-red-50/50' : ''}
                  >
                    <TableCell className="font-medium">{cat.category}</TableCell>
                    <TableCell className="text-right">{formatCents(cat.revenue)}</TableCell>
                    <TableCell className="text-right">
                      <span className="text-blue-600">{cat.theoretical_pct}%</span>
                      <span className="text-xs text-muted-foreground ml-1">
                        ({formatCents(cat.theoretical_cost)})
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={
                          cat.actual_pct > 35
                            ? 'text-red-600'
                            : cat.actual_pct > 30
                              ? 'text-amber-600'
                              : 'text-green-600'
                        }
                      >
                        {cat.actual_pct}%
                      </span>
                      <span className="text-xs text-muted-foreground ml-1">
                        ({formatCents(cat.actual_cost)})
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={`font-semibold ${
                          Math.abs(cat.variance_pct) > 3 ? 'text-red-600' : 'text-green-600'
                        }`}
                      >
                        {cat.variance_pct > 0 ? '+' : ''}
                        {cat.variance_pct}%
                      </span>
                    </TableCell>
                    <TableCell>
                      {cat.is_flagged ? (
                        <Badge
                          variant="outline"
                          className="bg-red-50 text-red-700 border-red-200"
                        >
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Over threshold
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="bg-green-50 text-green-700 border-green-200"
                        >
                          OK
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Visual Bar Chart (CSS-based for simplicity) */}
      {data.by_category.length > 0 && (
        <Card className="border-warm shadow-warm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Theoretical vs Actual</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-4">
            {data.by_category.map((cat) => (
              <div key={cat.category} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{cat.category}</span>
                  <span
                    className={`text-xs font-semibold ${
                      cat.is_flagged ? 'text-red-600' : 'text-green-600'
                    }`}
                  >
                    {cat.variance_pct > 0 ? '+' : ''}
                    {cat.variance_pct}% variance
                  </span>
                </div>
                <div className="flex gap-1.5">
                  <div className="flex-1">
                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-400 rounded-full transition-all"
                        style={{
                          width: `${Math.min(100, cat.theoretical_pct * 2.5)}%`,
                        }}
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Theoretical {cat.theoretical_pct}%
                    </p>
                  </div>
                  <div className="flex-1">
                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          cat.is_flagged ? 'bg-red-400' : 'bg-green-400'
                        }`}
                        style={{
                          width: `${Math.min(100, cat.actual_pct * 2.5)}%`,
                        }}
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Actual {cat.actual_pct}%
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
