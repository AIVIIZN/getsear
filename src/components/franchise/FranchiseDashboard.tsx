'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { Building2, DollarSign, TrendingUp, Users, RefreshCw, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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

interface LocationPL {
  location_id: string
  location_name: string
  revenue: number
  labor_cost: number
  labor_pct: number
  food_cost_pct: number
  net_profit: number
  net_margin: number
}

interface Totals {
  revenue: number
  labor_cost: number
  labor_pct: number
  food_cost_pct: number
  net_profit: number
  net_margin: number
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function FranchiseDashboard() {
  const [locations, setLocations] = useState<LocationPL[]>([])
  const [totals, setTotals] = useState<Totals | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('month')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/franchise/consolidated-pl?period=${period}`)
      const json = await res.json()
      if (res.ok) {
        setLocations(json.data?.locations ?? [])
        setTotals(json.data?.totals ?? null)
      }
    } catch {
      toast.error('Failed to load franchise data')
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground">Multi-Location Overview</h3>
        <div className="flex gap-2">
          <Select value={period} onValueChange={(v) => v && setPeriod(v)}>
            <SelectTrigger className="w-32 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Today</SelectItem>
              <SelectItem value="weekly">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="quarterly">Quarter</SelectItem>
              <SelectItem value="yearly">Year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Consolidated KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-warm shadow-warm">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase">Total Revenue</p>
                <p className="text-2xl font-bold text-green-600 mt-1">{formatCents(totals?.revenue ?? 0)}</p>
              </div>
              <div className="rounded-lg p-2 bg-green-50">
                <DollarSign className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-warm shadow-warm">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase">Labor %</p>
            <p className={`text-2xl font-bold mt-1 ${(totals?.labor_pct ?? 0) > 30 ? 'text-red-600' : 'text-green-600'}`}>
              {totals?.labor_pct ?? 0}%
            </p>
          </CardContent>
        </Card>
        <Card className="border-warm shadow-warm">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase">Food Cost %</p>
            <p className={`text-2xl font-bold mt-1 ${(totals?.food_cost_pct ?? 0) > 32 ? 'text-red-600' : 'text-green-600'}`}>
              {totals?.food_cost_pct ?? 0}%
            </p>
          </CardContent>
        </Card>
        <Card className="border-warm shadow-warm">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase">Net Profit</p>
            <p className={`text-2xl font-bold mt-1 ${(totals?.net_profit ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCents(totals?.net_profit ?? 0)}
            </p>
            <p className="text-xs text-muted-foreground">{totals?.net_margin ?? 0}% margin</p>
          </CardContent>
        </Card>
      </div>

      {/* Location Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {locations.map((loc) => (
          <Card key={loc.location_id} className="border-warm shadow-warm hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-orange-500" />
                  <h4 className="font-semibold text-sm">{loc.location_name}</h4>
                </div>
                <Badge
                  variant="outline"
                  className={loc.net_profit >= 0 ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}
                >
                  {loc.net_margin >= 0 ? '+' : ''}{loc.net_margin}%
                </Badge>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Revenue</span>
                  <span className="font-medium">{formatCents(loc.revenue)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Labor</span>
                  <span className={`font-medium ${loc.labor_pct > 30 ? 'text-red-600' : ''}`}>
                    {loc.labor_pct}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Food Cost</span>
                  <span className={`font-medium ${loc.food_cost_pct > 32 ? 'text-red-600' : ''}`}>
                    {loc.food_cost_pct}%
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t">
                  <span className="font-medium">Net Profit</span>
                  <span className={`font-bold ${loc.net_profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCents(loc.net_profit)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Comparison Table */}
      <Card className="border-warm shadow-warm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Location Comparison</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Location</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Labor %</TableHead>
                <TableHead className="text-right">Food Cost %</TableHead>
                <TableHead className="text-right">Net Profit</TableHead>
                <TableHead className="text-right">Margin</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {locations.map((loc) => (
                <TableRow key={loc.location_id}>
                  <TableCell className="font-medium">{loc.location_name}</TableCell>
                  <TableCell className="text-right">{formatCents(loc.revenue)}</TableCell>
                  <TableCell className={`text-right ${loc.labor_pct > 30 ? 'text-red-600 font-medium' : ''}`}>
                    {loc.labor_pct}%
                  </TableCell>
                  <TableCell className={`text-right ${loc.food_cost_pct > 32 ? 'text-red-600 font-medium' : ''}`}>
                    {loc.food_cost_pct}%
                  </TableCell>
                  <TableCell className={`text-right font-medium ${loc.net_profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCents(loc.net_profit)}
                  </TableCell>
                  <TableCell className={`text-right ${loc.net_margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {loc.net_margin}%
                  </TableCell>
                </TableRow>
              ))}
              {totals && (
                <TableRow className="bg-gray-50 font-bold">
                  <TableCell>TOTAL</TableCell>
                  <TableCell className="text-right">{formatCents(totals.revenue)}</TableCell>
                  <TableCell className="text-right">{totals.labor_pct}%</TableCell>
                  <TableCell className="text-right">{totals.food_cost_pct}%</TableCell>
                  <TableCell className={`text-right ${totals.net_profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCents(totals.net_profit)}
                  </TableCell>
                  <TableCell className="text-right">{totals.net_margin}%</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
