'use client'

import { useState, useEffect, useCallback } from 'react'
import { Wallet, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { EmptyState } from '@/components/shared/EmptyState'
import { CashDrawerDetail } from './CashDrawerDetail'
import { cn } from '@/lib/utils'

interface Drawer {
  id: string
  name: string
  status: string
  assigned_to: string | null
  expected_cash: string
  actual_cash: string
  over_short: string
  opened_at: string | null
}

export function CashDrawersTab() {
  const [drawers, setDrawers] = useState<Drawer[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState('')

  const loadDrawers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/staff/cash-drawers')
      if (res.ok) {
        const json = await res.json()
        setDrawers(json.data ?? [])
      }
    } catch { /* silent */ }
    setLoading(false)
  }, [])

  useEffect(() => { loadDrawers() }, [loadDrawers])

  const handleCreate = async () => {
    if (!newName.trim()) { toast.error('Enter a name'); return }
    try {
      const res = await fetch('/api/staff/cash-drawers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), location_id: 'default' }),
      })
      if (res.ok) {
        toast.success('Drawer created')
        setCreateOpen(false)
        setNewName('')
        loadDrawers()
      }
    } catch { toast.error('Network error') }
  }

  if (selectedId) {
    return (
      <CashDrawerDetail
        drawerId={selectedId}
        onBack={() => { setSelectedId(null); loadDrawers() }}
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Cash Drawers</h3>
        <Button onClick={() => setCreateOpen(true)} size="sm" className="gap-1">
          <Plus className="h-3.5 w-3.5" />
          Add Drawer
        </Button>
      </div>

      {loading ? (
        <div className="animate-pulse space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-12 bg-muted rounded" />)}</div>
      ) : drawers.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="No cash drawers configured"
          description="Go to Settings > Terminals to assign drawers, or add one here."
          actionLabel="Add Drawer"
          onAction={() => setCreateOpen(true)}
        />
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Expected Cash</TableHead>
                <TableHead className="text-right">Over/Short</TableHead>
                <TableHead>Opened At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {drawers.map((d) => {
                const overShort = parseFloat(d.over_short ?? '0')
                return (
                  <TableRow key={d.id} className="cursor-pointer hover:bg-accent/50" onClick={() => setSelectedId(d.id)}>
                    <TableCell className="text-sm font-medium">{d.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={d.status === 'open' ? 'bg-green-50 text-green-700 border-green-200 text-xs' : 'bg-gray-100 text-gray-500 border-gray-200 text-xs'}>
                        {d.status === 'open' ? 'Open' : 'Closed'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm font-mono text-right">
                      ${parseFloat(d.expected_cash ?? '0').toFixed(2)}
                    </TableCell>
                    <TableCell className={cn('text-sm font-mono text-right', overShort > 0 ? 'text-green-600' : overShort < 0 ? 'text-red-600' : '')}>
                      {d.status === 'closed' && d.actual_cash !== '0.00' ? (
                        overShort === 0 ? 'Even' : `${overShort > 0 ? '+' : '-'}$${Math.abs(overShort).toFixed(2)}`
                      ) : '--'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {d.opened_at ? new Date(d.opened_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '--'}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Cash Drawer</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Drawer Name</Label>
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Bar Drawer 1" className="h-10" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
