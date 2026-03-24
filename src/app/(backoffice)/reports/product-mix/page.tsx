'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DateRangePicker, type DatePreset } from '@/components/reports/DateRangePicker'
import { PMIXScatter } from '@/components/reports/PMIXScatter'
import { Download, ArrowUpDown, ChefHat } from 'lucide-react'

interface PMIXItem {
  name: string; category: string; quantity_sold: number; revenue: number; food_cost_pct: number; margin_pct: number; classification: string; popularity: number; profitability: number
}

const CLASSIFICATION_BG: Record<string, string> = { Star: 'bg-orange-100 text-orange-800', Plowhorse: 'bg-blue-100 text-blue-800', Puzzle: 'bg-purple-100 text-purple-800', Dog: 'bg-gray-100 text-gray-800' }
const CLASSIFICATION_COLORS: Record<string, string> = { Star: '#007AFF', Plowhorse: '#2563EB', Puzzle: '#7C3AED', Dog: '#9CA3AF' }

type SortField = 'name' | 'quantity_sold' | 'revenue' | 'food_cost_pct' | 'margin_pct' | 'classification'

export default function ProductMixPage() {
  const [data, setData] = useState<PMIXItem[]>([])
  const [loading, setLoading] = useState(false)
  const [isEmpty, setIsEmpty] = useState(false)
  const [sortField, setSortField] = useState<SortField>('revenue')
  const [sortAsc, setSortAsc] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState<string>('all')

  const fetchData = useCallback(async (_preset: DatePreset, dateFrom: string, dateTo: string) => {
    setLoading(true); setIsEmpty(false)
    try {
      const res = await fetch(`/api/reports/pmix?date_from=${dateFrom}&date_to=${dateTo}`)
      if (res.ok) { const json = await res.json(); if (json.data?.length) setData(json.data); else { setData([]); setIsEmpty(true) } }
    } catch { setIsEmpty(true) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    const now = new Date(); const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 6)
    fetchData('this_week', weekAgo.toISOString().split('T')[0], now.toISOString().split('T')[0])
  }, [fetchData])

  const handleSort = (field: SortField) => { if (sortField === field) setSortAsc(!sortAsc); else { setSortField(field); setSortAsc(false) } }
  const categories = ['all', ...Array.from(new Set(data.map(d => d.category)))]
  const filtered = categoryFilter === 'all' ? data : data.filter(d => d.category === categoryFilter)
  const sorted = [...filtered].sort((a, b) => {
    const aVal = a[sortField]; const bVal = b[sortField]
    if (typeof aVal === 'string' && typeof bVal === 'string') return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
    return sortAsc ? Number(aVal) - Number(bVal) : Number(bVal) - Number(aVal)
  })
  const classificationCounts = data.reduce<Record<string, number>>((acc, d) => { acc[d.classification] = (acc[d.classification] ?? 0) + 1; return acc }, {})

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-semibold">Product Mix (PMIX)</h1><p className="text-sm text-[var(--muted-foreground)] mt-1">Item popularity and profitability analysis</p></div>
        <div className="flex items-center gap-3">
          <DateRangePicker onRangeChange={fetchData} initialPreset="this_week" />
          <button type="button" onClick={() => window.open('/api/reports/export?type=pmix', '_blank')} className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-medium hover:bg-[var(--secondary)] transition-colors" style={{ height: 44 }}><Download className="h-4 w-4" /> Export PDF</button>
        </div>
      </div>
      {loading && <div className="space-y-4">{[1, 2].map(i => <div key={i} className="h-48 rounded-xl bg-[var(--secondary)] animate-pulse" />)}</div>}
      {isEmpty && !loading && <div className="flex flex-col items-center justify-center py-16 text-center"><ChefHat className="h-12 w-12 text-[var(--muted-foreground)] mb-4" /><h3 className="text-lg font-medium mb-1">No product mix data</h3><p className="text-sm text-[var(--muted-foreground)]">PMIX data will appear once items are sold.</p></div>}
      {!loading && data.length > 0 && (
        <>
          <div className="grid grid-cols-4 gap-4">
            {(['Star', 'Plowhorse', 'Puzzle', 'Dog'] as const).map(cls => (
              <Card key={cls} className="shadow-warm-sm"><CardContent className="p-4 flex items-center gap-3">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CLASSIFICATION_COLORS[cls] }} />
                <div><p className="text-xs text-[var(--muted-foreground)]">{cls}s</p><p className="text-lg font-bold tabular-nums">{classificationCounts[cls] ?? 0}</p></div>
              </CardContent></Card>
            ))}
          </div>
          <PMIXScatter data={data} />
          <div className="flex items-center gap-2">
            <span className="text-sm text-[var(--muted-foreground)]">Filter:</span>
            {categories.map(cat => (
              <button key={cat} type="button" onClick={() => setCategoryFilter(cat)} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${categoryFilter === cat ? 'bg-[var(--primary)] text-white' : 'bg-[var(--secondary)] text-[var(--secondary-foreground)] hover:bg-[var(--muted)]'}`}>
                {cat === 'all' ? 'All Categories' : cat}
              </button>
            ))}
          </div>
          <Card className="shadow-warm-sm"><CardHeader><CardTitle className="text-base">Item Details</CardTitle></CardHeader><CardContent>
            <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-[var(--border)]">
              {[{ field: 'name' as SortField, label: 'Item' }, { field: 'quantity_sold' as SortField, label: 'Qty Sold' }, { field: 'revenue' as SortField, label: 'Revenue' }, { field: 'food_cost_pct' as SortField, label: 'Cost %' }, { field: 'margin_pct' as SortField, label: 'Margin %' }, { field: 'classification' as SortField, label: 'Class' }].map(col => (
                <th key={col.field} className={`py-2 px-3 font-medium text-[var(--muted-foreground)] cursor-pointer hover:text-[var(--foreground)] ${col.field === 'name' ? 'text-left' : 'text-right'}`} onClick={() => handleSort(col.field)}>
                  <span className="inline-flex items-center gap-1">{col.label}<ArrowUpDown className="h-3 w-3" /></span>
                </th>
              ))}
            </tr></thead><tbody>
              {sorted.map(item => (
                <tr key={item.name} className="border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--secondary)] even:bg-[var(--secondary)]/30">
                  <td className="py-2 px-3"><div className="font-medium">{item.name}</div><div className="text-xs text-[var(--muted-foreground)]">{item.category}</div></td>
                  <td className="py-2 px-3 text-right tabular-nums">{item.quantity_sold}</td>
                  <td className="py-2 px-3 text-right tabular-nums">${item.revenue.toLocaleString()}</td>
                  <td className="py-2 px-3 text-right tabular-nums">{item.food_cost_pct}%</td>
                  <td className="py-2 px-3 text-right tabular-nums">{item.margin_pct}%</td>
                  <td className="py-2 px-3 text-right"><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${CLASSIFICATION_BG[item.classification] ?? ''}`}>{item.classification}</span></td>
                </tr>
              ))}
            </tbody></table></div>
          </CardContent></Card>
        </>
      )}
    </div>
  )
}
