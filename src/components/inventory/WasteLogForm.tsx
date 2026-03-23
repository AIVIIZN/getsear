'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { Trash2, Loader2, Search } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import { Skeleton } from '@/components/ui/skeleton'

interface InventoryItemOption {
  id: string
  name: string
  unit: string
  unit_cost: string
  current_stock: number
}

interface WasteEntry {
  id: string
  item_name: string
  quantity: number
  unit: string
  reason: string
  notes: string | null
  recorded_by_name: string
  dollar_value: number
  created_at: string
}

const WASTE_REASONS = [
  { value: 'expired', label: 'Expired', color: 'bg-red-50 text-red-700 border-red-200' },
  { value: 'dropped', label: 'Dropped', color: 'bg-orange-50 text-orange-700 border-orange-200' },
  { value: 'returned', label: 'Customer Return', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { value: 'overproduction', label: 'Overproduction', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { value: 'other', label: 'Other', color: 'bg-gray-50 text-gray-700 border-gray-200' },
]

export function WasteLogForm() {
  const [items, setItems] = useState<InventoryItemOption[]>([])
  const [entries, setEntries] = useState<WasteEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [search, setSearch] = useState('')

  // Form state
  const [selectedItemId, setSelectedItemId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [itemsRes, wasteRes] = await Promise.all([
        fetch('/api/inventory/items'),
        fetch('/api/inventory/waste?limit=25'),
      ])
      const [itemsData, wasteData] = await Promise.all([itemsRes.json(), wasteRes.json()])
      setItems(itemsData.data ?? [])
      setEntries(wasteData.data ?? [])
    } catch {
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleSubmit = async () => {
    if (!selectedItemId || !quantity || !reason) {
      toast.error('Please fill in all required fields')
      return
    }

    const qty = parseFloat(quantity)
    if (isNaN(qty) || qty <= 0) {
      toast.error('Quantity must be a positive number')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/inventory/waste', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inventory_item_id: selectedItemId,
          quantity: qty,
          reason,
          notes: notes || undefined,
        }),
      })

      if (res.ok) {
        toast.success('Waste entry recorded')
        setSelectedItemId('')
        setQuantity('')
        setReason('')
        setNotes('')
        fetchData()
      } else {
        const json = await res.json()
        toast.error(json.error ?? 'Failed to record waste')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setSubmitting(false)
    }
  }

  const selectedItem = items.find((i) => i.id === selectedItemId)
  const estimatedValue = selectedItem && quantity
    ? (parseFloat(selectedItem.unit_cost) * parseFloat(quantity)).toFixed(2)
    : '0.00'

  const filteredEntries = entries.filter((e) =>
    search ? e.item_name.toLowerCase().includes(search.toLowerCase()) : true
  )

  // Waste summary
  const totalWasteValue = entries.reduce((sum, e) => sum + e.dollar_value, 0)
  const wasteByReason = WASTE_REASONS.map((r) => ({
    ...r,
    count: entries.filter((e) => e.reason === r.value).length,
    value: entries
      .filter((e) => e.reason === r.value)
      .reduce((sum, e) => sum + e.dollar_value, 0),
  }))

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Quick Entry Form */}
      <Card className="border-warm shadow-warm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Trash2 className="h-4 w-4 text-red-500" />
            Log Waste
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Item *</Label>
              <Select value={selectedItemId} onValueChange={(v) => v && setSelectedItemId(v)}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Select item" />
                </SelectTrigger>
                <SelectContent>
                  {items.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name} ({item.current_stock} {item.unit})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                Quantity * {selectedItem ? `(${selectedItem.unit})` : ''}
              </Label>
              <Input
                type="number"
                step="0.1"
                min="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="0.0"
                className="h-11"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Reason *</Label>
              <Select value={reason} onValueChange={(v) => v && setReason(v)}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Select reason" />
                </SelectTrigger>
                <SelectContent>
                  {WASTE_REASONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Est. Value</Label>
              <div className="flex items-center gap-2">
                <div className="h-11 flex items-center px-3 bg-red-50 rounded-lg border border-red-200 text-red-700 font-semibold text-sm flex-1">
                  -${estimatedValue}
                </div>
                <Button
                  onClick={handleSubmit}
                  disabled={submitting || !selectedItemId || !quantity || !reason}
                  className="h-11 bg-red-600 hover:bg-red-700 text-white"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Log'}
                </Button>
              </div>
            </div>
          </div>

          <div className="mt-3">
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes..."
              className="resize-none h-16"
            />
          </div>
        </CardContent>
      </Card>

      {/* Waste Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="border-warm shadow-warm">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Total Waste</p>
            <p className="text-lg font-bold text-red-600">${totalWasteValue.toFixed(2)}</p>
          </CardContent>
        </Card>
        {wasteByReason
          .filter((r) => r.count > 0)
          .map((r) => (
            <Card key={r.value} className="border-warm shadow-warm">
              <CardContent className="p-3 text-center">
                <p className="text-xs text-muted-foreground">{r.label}</p>
                <p className="text-lg font-bold text-foreground">{r.count}</p>
                <p className="text-xs text-red-600">${r.value.toFixed(2)}</p>
              </CardContent>
            </Card>
          ))}
      </div>

      {/* Waste Log Table */}
      <Card className="border-warm shadow-warm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Waste Log</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search items..."
                className="pl-9 h-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Recorded By</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEntries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No waste entries found
                  </TableCell>
                </TableRow>
              ) : (
                filteredEntries.map((entry) => {
                  const reasonInfo = WASTE_REASONS.find((r) => r.value === entry.reason)
                  return (
                    <TableRow key={entry.id}>
                      <TableCell className="font-medium">{entry.item_name}</TableCell>
                      <TableCell>
                        {entry.quantity} {entry.unit}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={reasonInfo?.color ?? ''}>
                          {reasonInfo?.label ?? entry.reason}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-red-600 font-medium">
                        -${entry.dollar_value.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {entry.recorded_by_name || 'Unknown'}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(entry.created_at).toLocaleDateString()}{' '}
                        {new Date(entry.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
