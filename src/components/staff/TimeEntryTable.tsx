'use client'

import { useState, useMemo } from 'react'
import { Check, Pencil, Download, Clock, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { EmptyState } from '@/components/shared/EmptyState'
import { TimeEntryEditModal } from './TimeEntryEditModal'
import type { TimeEntryRow } from '@/stores/staff-store'

interface TimeEntryTableProps {
  entries: TimeEntryRow[]
  loading: boolean
  onRefresh: () => void
}

function formatEntryTime(iso: string | null): string {
  if (!iso) return '--'
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function formatEntryDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function TimeEntryTable({ entries, loading, onRefresh }: TimeEntryTableProps) {
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 7)
    return d.toISOString().split('T')[0]
  })
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [editEntry, setEditEntry] = useState<TimeEntryRow | null>(null)

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      const date = e.clock_in.split('T')[0]
      return date >= dateFrom && date <= dateTo
    })
  }, [entries, dateFrom, dateTo])

  const pendingCount = filtered.filter((e) => !e.is_approved).length

  const handleBulkApprove = async () => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return

    try {
      for (const id of ids) {
        await fetch(`/api/staff/time-entries/${id}/approve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      }
      toast.success(`${ids.length} entries approved`)
      setSelectedIds(new Set())
      onRefresh()
    } catch {
      toast.error('Failed to approve entries')
    }
  }

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleExportCSV = () => {
    const headers = 'Date,Employee,Role,Clock In,Clock Out,Regular Hours,OT Hours,Tips,Status\n'
    const rows = filtered.map((e) =>
      [
        formatEntryDate(e.clock_in),
        e.staff_name ?? 'Unknown',
        e.role_during_shift ?? '',
        formatEntryTime(e.clock_in),
        formatEntryTime(e.clock_out),
        (e.regular_hours ?? 0).toFixed(1),
        (e.overtime_hours ?? 0).toFixed(1),
        `$${(parseFloat(e.cash_tips ?? '0') + parseFloat(e.credit_tips ?? '0')).toFixed(2)}`,
        e.is_approved ? 'Approved' : 'Pending',
      ].join(',')
    ).join('\n')

    const blob = new Blob([headers + rows], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `time_entries_${dateFrom}_${dateTo}.csv`
    link.click()
    URL.revokeObjectURL(url)
    toast.success('Time entries exported')
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-9 w-36"
          />
          <span className="text-sm text-muted-foreground">to</span>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-9 w-36"
          />
        </div>

        {pendingCount > 0 && (
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 gap-1">
            <AlertCircle className="h-3 w-3" />
            {pendingCount} unapproved
          </Badge>
        )}

        <div className="ml-auto flex items-center gap-2">
          {selectedIds.size > 0 && (
            <Button variant="outline" size="sm" onClick={handleBulkApprove} className="gap-1">
              <Check className="h-3.5 w-3.5" />
              Approve ({selectedIds.size})
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-1">
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="animate-pulse space-y-2">
          {[...Array(5)].map((_, i) => <div key={i} className="h-10 bg-muted rounded" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="No time entries"
          description="No time entries found for this date range."
        />
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-10">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === filtered.length && filtered.length > 0}
                    onChange={() =>
                      selectedIds.size === filtered.length
                        ? setSelectedIds(new Set())
                        : setSelectedIds(new Set(filtered.map((e) => e.id)))
                    }
                    className="h-4 w-4"
                  />
                </TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Clock In</TableHead>
                <TableHead>Clock Out</TableHead>
                <TableHead className="text-right">Reg Hours</TableHead>
                <TableHead className="text-right">OT Hours</TableHead>
                <TableHead className="text-right">Tips</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(entry.id)}
                      onChange={() => toggleSelected(entry.id)}
                      className="h-4 w-4"
                    />
                  </TableCell>
                  <TableCell className="text-sm font-medium">
                    {formatEntryDate(entry.clock_in)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {entry.staff_name ?? 'Unknown'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize text-xs">
                      {entry.role_during_shift ?? '--'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm font-mono">
                    {formatEntryTime(entry.clock_in)}
                  </TableCell>
                  <TableCell className="text-sm font-mono">
                    {formatEntryTime(entry.clock_out)}
                  </TableCell>
                  <TableCell className="text-sm font-mono text-right">
                    {(entry.regular_hours ?? 0).toFixed(1)}
                  </TableCell>
                  <TableCell className="text-sm font-mono text-right">
                    {(entry.overtime_hours ?? 0) > 0 ? (
                      <span className="text-red-600">{(entry.overtime_hours ?? 0).toFixed(1)}</span>
                    ) : '--'}
                  </TableCell>
                  <TableCell className="text-sm font-mono text-right">
                    ${(parseFloat(entry.cash_tips ?? '0') + parseFloat(entry.credit_tips ?? '0')).toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        entry.is_approved
                          ? 'bg-green-50 text-green-700 border-green-200 text-xs'
                          : 'bg-amber-50 text-amber-700 border-amber-200 text-xs'
                      }
                    >
                      {entry.is_approved ? 'Approved' : 'Pending'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => setEditEntry(entry)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <TimeEntryEditModal
        open={!!editEntry}
        onOpenChange={(open) => !open && setEditEntry(null)}
        onSaved={onRefresh}
        entry={editEntry}
      />
    </div>
  )
}
