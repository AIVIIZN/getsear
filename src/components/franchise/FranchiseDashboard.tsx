'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { Building2, RefreshCw } from 'lucide-react'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui-v2/Card'
import { Badge } from '@/components/ui-v2/data/Badge'
import { Stat } from '@/components/ui-v2/data/Stat'
import { Skeleton } from '@/components/ui-v2/data/Skeleton'
import { Button } from '@/components/ui/button'
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

const LABOR_THRESHOLD = 30
const FOOD_COST_THRESHOLD = 32

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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} variant="card" className="h-28" />)}
        </div>
        <Skeleton variant="chart" className="h-64" />
      </div>
    )
  }

  const laborOver = (totals?.labor_pct ?? 0) > LABOR_THRESHOLD
  const foodOver = (totals?.food_cost_pct ?? 0) > FOOD_COST_THRESHOLD
  const profitNegative = (totals?.net_profit ?? 0) < 0

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex items-center justify-between">
        <h3 className="font-[var(--weight-semibold)] text-[var(--color-text)]">Multi-Location Overview</h3>
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

      {/* Consolidated KPIs — ui-v2 Stat */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card variant="elevated" padding="compact">
          <Stat
            label="Total Revenue"
            value={
              <span className="text-[var(--color-success)]">
                {formatCents(totals?.revenue ?? 0)}
              </span>
            }
          />
        </Card>
        <Card variant="elevated" padding="compact">
          <Stat
            label="Labor %"
            value={
              <span className={laborOver ? 'text-[var(--color-danger)]' : 'text-[var(--color-success)]'}>
                {totals?.labor_pct ?? 0}%
              </span>
            }
            delta={{
              value: `Target ≤${LABOR_THRESHOLD}%`,
              direction: laborOver ? 'up' : 'flat',
              intent: laborOver ? 'negative' : 'auto',
            }}
          />
        </Card>
        <Card variant="elevated" padding="compact">
          <Stat
            label="Food Cost %"
            value={
              <span className={foodOver ? 'text-[var(--color-danger)]' : 'text-[var(--color-success)]'}>
                {totals?.food_cost_pct ?? 0}%
              </span>
            }
            delta={{
              value: `Target ≤${FOOD_COST_THRESHOLD}%`,
              direction: foodOver ? 'up' : 'flat',
              intent: foodOver ? 'negative' : 'auto',
            }}
          />
        </Card>
        <Card variant="elevated" padding="compact">
          <Stat
            label="Net Profit"
            value={
              <span className={profitNegative ? 'text-[var(--color-danger)]' : 'text-[var(--color-success)]'}>
                {formatCents(totals?.net_profit ?? 0)}
              </span>
            }
            delta={{
              value: `${totals?.net_margin ?? 0}% margin`,
              direction: profitNegative ? 'down' : 'flat',
              intent: profitNegative ? 'negative' : 'auto',
            }}
          />
        </Card>
      </div>

      {/* Location Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {locations.map((loc) => {
          const profitPositive = loc.net_profit >= 0
          const locLaborOver = loc.labor_pct > LABOR_THRESHOLD
          const locFoodOver = loc.food_cost_pct > FOOD_COST_THRESHOLD
          return (
            <Card
              key={loc.location_id}
              variant="elevated"
              padding="compact"
              className="hover:shadow-[var(--shadow-mid)] transition-shadow"
            >
              <CardBody>
                <div className="flex items-center justify-between mb-[var(--space-3)]">
                  <div className="flex items-center gap-[var(--space-2)]">
                    <Building2 className="h-4 w-4 text-[var(--color-warning-strong)]" />
                    <h4 className="font-[var(--weight-semibold)] text-[var(--type-subhead-size)]">{loc.location_name}</h4>
                  </div>
                  <Badge variant={profitPositive ? 'success' : 'danger'} size="sm">
                    {loc.net_margin >= 0 ? '+' : ''}{loc.net_margin}%
                  </Badge>
                </div>

                <div className="space-y-[var(--space-2)] text-[var(--type-subhead-size)]">
                  <div className="flex justify-between">
                    <span className="text-[var(--color-text-muted)]">Revenue</span>
                    <span className="font-[var(--weight-medium)]">{formatCents(loc.revenue)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--color-text-muted)]">Labor</span>
                    <span className={`font-[var(--weight-medium)] ${locLaborOver ? 'text-[var(--color-danger)]' : ''}`}>
                      {loc.labor_pct}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--color-text-muted)]">Food Cost</span>
                    <span className={`font-[var(--weight-medium)] ${locFoodOver ? 'text-[var(--color-danger)]' : ''}`}>
                      {loc.food_cost_pct}%
                    </span>
                  </div>
                  <div className="flex justify-between pt-[var(--space-2)] border-t border-[var(--color-border)]">
                    <span className="font-[var(--weight-medium)]">Net Profit</span>
                    <span className={`font-[var(--weight-bold)] ${profitPositive ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
                      {formatCents(loc.net_profit)}
                    </span>
                  </div>
                </div>
              </CardBody>
            </Card>
          )
        })}
      </div>

      {/* Comparison Table */}
      <Card variant="flat" padding="compact" className="gap-[var(--space-3)]">
        <CardHeader>
          <CardTitle className="text-[length:var(--type-headline-size)]">Location Comparison</CardTitle>
        </CardHeader>
        <CardBody>
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
              {locations.map((loc) => {
                const locLaborOver = loc.labor_pct > LABOR_THRESHOLD
                const locFoodOver = loc.food_cost_pct > FOOD_COST_THRESHOLD
                const profitPositive = loc.net_profit >= 0
                return (
                  <TableRow key={loc.location_id}>
                    <TableCell className="font-[var(--weight-medium)]">{loc.location_name}</TableCell>
                    <TableCell className="text-right">{formatCents(loc.revenue)}</TableCell>
                    <TableCell className={`text-right ${locLaborOver ? 'text-[var(--color-danger)] font-[var(--weight-medium)]' : ''}`}>
                      {loc.labor_pct}%
                    </TableCell>
                    <TableCell className={`text-right ${locFoodOver ? 'text-[var(--color-danger)] font-[var(--weight-medium)]' : ''}`}>
                      {loc.food_cost_pct}%
                    </TableCell>
                    <TableCell className={`text-right font-[var(--weight-medium)] ${profitPositive ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
                      {formatCents(loc.net_profit)}
                    </TableCell>
                    <TableCell className={`text-right ${loc.net_margin >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
                      {loc.net_margin}%
                    </TableCell>
                  </TableRow>
                )
              })}
              {totals && (
                <TableRow className="bg-[var(--color-bg-subtle)] font-[var(--weight-bold)]">
                  <TableCell>TOTAL</TableCell>
                  <TableCell className="text-right">{formatCents(totals.revenue)}</TableCell>
                  <TableCell className="text-right">{totals.labor_pct}%</TableCell>
                  <TableCell className="text-right">{totals.food_cost_pct}%</TableCell>
                  <TableCell className={`text-right ${totals.net_profit >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
                    {formatCents(totals.net_profit)}
                  </TableCell>
                  <TableCell className="text-right">{totals.net_margin}%</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardBody>
      </Card>

    </div>
  )
}
