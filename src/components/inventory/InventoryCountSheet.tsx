'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { ClipboardCheck, Loader2, Save, Printer, Search } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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

interface CountItem {
  id: string
  name: string
  unit: string
  category: string
  par_level: number
  current_stock: number
  counted_quantity: number | null
  variance: number | null
}

export function InventoryCountSheet() {
  const [items, setItems] = useState<CountItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [counts, setCounts] = useState<Map<string, string>>(new Map())
  const [savedCount, setSavedCount] = useState(0)

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/inventory/items')
      const json = await res.json()
      if (res.ok) {
        const countItems = (json.data ?? []).map((item: Record<string, unknown>) => ({
          id: item.id as string,
          name: item.name as string,
          unit: item.unit as string,
          category: (item.category as string) ?? 'General',
          par_level: item.par_level as number,
          current_stock: item.current_stock as number,
          counted_quantity: null,
          variance: null,
        }))
        setItems(countItems)
      } else {
        toast.error(json.error ?? 'Failed to load items')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  const handleCountChange = (itemId: string, value: string) => {
    const newCounts = new Map(counts)
    newCounts.set(itemId, value)
    setCounts(newCounts)
  }

  const saveCount = async (itemId: string) => {
    const value = counts.get(itemId)
    if (!value) return

    const qty = parseFloat(value)
    if (isNaN(qty) || qty < 0) {
      toast.error('Invalid quantity')
      return
    }

    try {
      const res = await fetch(`/api/inventory/items/${itemId}/count`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ counted_quantity: qty }),
      })

      if (res.ok) {
        setSavedCount((prev) => prev + 1)
        // Update local state
        setItems((prev) =>
          prev.map((item) =>
            item.id === itemId
              ? {
                  ...item,
                  counted_quantity: qty,
                  variance: qty - item.current_stock,
                  current_stock: qty,
                }
              : item
          )
        )
        toast.success('Count saved')
      } else {
        const json = await res.json()
        toast.error(json.error ?? 'Failed to save count')
      }
    } catch {
      toast.error('Network error')
    }
  }

  const saveAllCounts = async () => {
    setSaving(true)
    let success = 0
    let failed = 0

    for (const [itemId, value] of counts.entries()) {
      const qty = parseFloat(value)
      if (isNaN(qty) || qty < 0) continue

      try {
        const res = await fetch(`/api/inventory/items/${itemId}/count`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ counted_quantity: qty }),
        })
        if (res.ok) success++
        else failed++
      } catch {
        failed++
      }
    }

    setSaving(false)
    setSavedCount(success)
    if (success > 0) toast.success(`${success} count(s) saved`)
    if (failed > 0) toast.error(`${failed} count(s) failed`)
    fetchItems()
  }

  const filteredItems = items.filter((i) =>
    search ? i.name.toLowerCase().includes(search.toLowerCase()) : true
  )

  const categories = Array.from(new Set(filteredItems.map((i) => i.category))).sort()
  const pendingCounts = counts.size

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4" />
            Inventory Count
          </h3>
          {pendingCounts > 0 && (
            <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
              {pendingCounts} unsaved
            </Badge>
          )}
          {savedCount > 0 && (
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              {savedCount} saved
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search items..."
              className="pl-9 h-9"
            />
          </div>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-3.5 w-3.5 mr-1.5" />
            Print Sheet
          </Button>
          {pendingCounts > 0 && (
            <Button size="sm" onClick={saveAllCounts} disabled={saving}>
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              ) : (
                <Save className="h-3.5 w-3.5 mr-1.5" />
              )}
              Save All ({pendingCounts})
            </Button>
          )}
        </div>
      </div>

      {/* Count Sheet by Category */}
      {categories.map((category) => {
        const categoryItems = filteredItems.filter((i) => i.category === category)
        return (
          <Card key={category} className="border-warm shadow-warm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{category}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-1/3">Item</TableHead>
                    <TableHead className="text-right">System Count</TableHead>
                    <TableHead className="text-right">Par Level</TableHead>
                    <TableHead className="text-center w-36">Actual Count</TableHead>
                    <TableHead className="text-right">Variance</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categoryItems.map((item) => {
                    const countValue = counts.get(item.id) ?? ''
                    const numericCount = parseFloat(countValue)
                    const variance = !isNaN(numericCount)
                      ? numericCount - item.current_stock
                      : item.variance

                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">
                          {item.name}
                          <span className="text-xs text-muted-foreground ml-1">({item.unit})</span>
                        </TableCell>
                        <TableCell className="text-right">{item.current_stock}</TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {item.par_level}
                        </TableCell>
                        <TableCell className="text-center">
                          <Input
                            type="number"
                            step="0.1"
                            min="0"
                            value={countValue}
                            onChange={(e) => handleCountChange(item.id, e.target.value)}
                            placeholder="—"
                            className="h-9 w-28 mx-auto text-center"
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          {variance !== null && variance !== undefined ? (
                            <span
                              className={`font-medium ${
                                variance < 0 ? 'text-red-600' : variance > 0 ? 'text-green-600' : ''
                              }`}
                            >
                              {variance > 0 ? '+' : ''}
                              {variance.toFixed(1)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {countValue && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => saveCount(item.id)}
                              className="h-8 px-2"
                            >
                              <Save className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
