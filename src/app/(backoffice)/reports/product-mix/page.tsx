'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui-v2/Card'
import { Button } from '@/components/ui-v2/Button'
import { Skeleton } from '@/components/ui-v2/data/Skeleton'
import { EmptyState } from '@/components/ui-v2/feedback/EmptyState'
import { Table, TableBody, TableCell, TableHeader, TableRow, type SortDirection } from '@/components/ui-v2/data/Table'
import { Badge, type BadgeProps } from '@/components/ui-v2/data/Badge'
import { DateRangePicker, type DatePreset } from '@/components/reports/DateRangePicker'
import { PMIXScatter } from '@/components/reports/PMIXScatter'
import { Download, ChefHat } from 'lucide-react'

interface PMIXItem {
  name: string
  category: string
  quantity_sold: number
  revenue: number
  food_cost_pct: number
  margin_pct: number
  classification: string
  popularity: number
  profitability: number
}

const CLASSIFICATION_COLORS: Record<string, string> = {
  Star: 'var(--color-primary)',
  Plowhorse: 'var(--color-primary-active)',
  Puzzle: '#7C3AED',
  Dog: 'var(--color-text-muted)',
}

const CLASSIFICATION_BADGE: Record<string, BadgeProps['variant']> = {
  Star: 'primary',
  Plowhorse: 'info',
  Puzzle: 'warning',
  Dog: 'default',
}

type SortField = 'name' | 'quantity_sold' | 'revenue' | 'food_cost_pct' | 'margin_pct' | 'classification'

export default function ProductMixPage() {
  const [data, setData] = useState<PMIXItem[]>([])
  const [loading, setLoading] = useState(false)
  const [isEmpty, setIsEmpty] = useState(false)
  const [sortField, setSortField] = useState<SortField>('revenue')
  const [sortAsc, setSortAsc] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState<string>('all')

  const fetchData = useCallback(async (_preset: DatePreset, dateFrom: string, dateTo: string) => {
    setLoading(true)
    setIsEmpty(false)
    try {
      const res = await fetch(`/api/reports/pmix?date_from=${dateFrom}&date_to=${dateTo}`)
      if (res.ok) {
        const json = await res.json()
        if (json.data?.length) setData(json.data)
        else {
          setData([])
          setIsEmpty(true)
        }
      }
    } catch {
      setIsEmpty(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const now = new Date()
    const weekAgo = new Date(now)
    weekAgo.setDate(weekAgo.getDate() - 6)
    fetchData('this_week', weekAgo.toISOString().split('T')[0], now.toISOString().split('T')[0])
  }, [fetchData])

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortAsc(!sortAsc)
    else {
      setSortField(field)
      setSortAsc(false)
    }
  }
  const sortDirFor = (field: SortField): SortDirection =>
    sortField === field ? (sortAsc ? 'asc' : 'desc') : null

  const categories = ['all', ...Array.from(new Set(data.map(d => d.category)))]
  const filtered = categoryFilter === 'all' ? data : data.filter(d => d.category === categoryFilter)
  const sorted = [...filtered].sort((a, b) => {
    const aVal = a[sortField]
    const bVal = b[sortField]
    if (typeof aVal === 'string' && typeof bVal === 'string') return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
    return sortAsc ? Number(aVal) - Number(bVal) : Number(bVal) - Number(aVal)
  })
  const classificationCounts = data.reduce<Record<string, number>>((acc, d) => {
    acc[d.classification] = (acc[d.classification] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="p-[var(--space-6)] max-w-7xl mx-auto space-y-[var(--space-5)]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[length:var(--type-title-2-size)] font-[var(--weight-semibold)] text-[color:var(--color-text)]">Product Mix (PMIX)</h1>
          <p className="text-[length:var(--type-subhead-size)] text-[color:var(--color-text-muted)] mt-[var(--space-1)]">Item popularity and profitability analysis</p>
        </div>
        <div className="flex items-center gap-[var(--space-2)]">
          <DateRangePicker onRangeChange={fetchData} initialPreset="this_week" />
          <Button
            variant="secondary"
            size="md"
            onClick={() => window.open('/api/reports/export?type=pmix', '_blank')}
            leadingIcon={<Download className="h-4 w-4" />}
          >
            Export PDF
          </Button>
        </div>
      </div>

      {loading && (
        <div className="space-y-[var(--space-3)]">
          {[1, 2].map(i => <Skeleton key={i} variant="card" />)}
        </div>
      )}

      {isEmpty && !loading && (
        <EmptyState icon={ChefHat} title="No product mix data" description="PMIX data will appear once items are sold." />
      )}

      {!loading && data.length > 0 && (
        <>
          <div className="grid grid-cols-4 gap-[var(--space-3)]">
            {(['Star', 'Plowhorse', 'Puzzle', 'Dog'] as const).map(cls => (
              <Card key={cls} padding="compact">
                <div className="flex items-center gap-[var(--space-3)]">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CLASSIFICATION_COLORS[cls] }} />
                  <div>
                    <p className="text-[length:var(--type-caption-1-size)] text-[color:var(--color-text-muted)]">{cls}s</p>
                    <p className="text-[length:var(--type-headline-size)] font-[var(--weight-bold)] tabular-nums">{classificationCounts[cls] ?? 0}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <PMIXScatter data={data} />

          <div className="flex items-center gap-[var(--space-2)] flex-wrap">
            <span className="text-[length:var(--type-subhead-size)] text-[color:var(--color-text-muted)]">Filter:</span>
            {categories.map(cat => (
              <Button
                key={cat}
                variant={categoryFilter === cat ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setCategoryFilter(cat)}
              >
                {cat === 'all' ? 'All Categories' : cat}
              </Button>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Item Details</CardTitle>
            </CardHeader>
            <CardBody>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableCell header sortable sortDirection={sortDirFor('name')} onSort={() => handleSort('name')}>Item</TableCell>
                    <TableCell header align="right" sortable sortDirection={sortDirFor('quantity_sold')} onSort={() => handleSort('quantity_sold')}>Qty Sold</TableCell>
                    <TableCell header align="right" sortable sortDirection={sortDirFor('revenue')} onSort={() => handleSort('revenue')}>Revenue</TableCell>
                    <TableCell header align="right" sortable sortDirection={sortDirFor('food_cost_pct')} onSort={() => handleSort('food_cost_pct')}>Cost %</TableCell>
                    <TableCell header align="right" sortable sortDirection={sortDirFor('margin_pct')} onSort={() => handleSort('margin_pct')}>Margin %</TableCell>
                    <TableCell header align="right" sortable sortDirection={sortDirFor('classification')} onSort={() => handleSort('classification')}>Class</TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map(item => (
                    <TableRow key={item.name}>
                      <TableCell>
                        <div className="font-[var(--weight-medium)]">{item.name}</div>
                        <div className="text-[length:var(--type-caption-1-size)] text-[color:var(--color-text-muted)]">{item.category}</div>
                      </TableCell>
                      <TableCell align="right" className="tabular-nums">{item.quantity_sold}</TableCell>
                      <TableCell align="right" className="tabular-nums">${item.revenue.toLocaleString()}</TableCell>
                      <TableCell align="right" className="tabular-nums">{item.food_cost_pct}%</TableCell>
                      <TableCell align="right" className="tabular-nums">{item.margin_pct}%</TableCell>
                      <TableCell align="right">
                        <Badge variant={CLASSIFICATION_BADGE[item.classification] ?? 'default'} shape="pill">
                          {item.classification}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardBody>
          </Card>
        </>
      )}
    </div>
  )
}
