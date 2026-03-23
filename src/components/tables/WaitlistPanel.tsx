'use client'

import { useState, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Bell,
  Plus,
  Users,
  Clock,
  Loader2,
  X,
  MessageSquare,
  Armchair,
  AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'

interface WaitlistEntry {
  id: string
  customer_name: string
  customer_phone: string | null
  party_size: number
  quoted_wait_minutes: number | null
  position: number
  status: string
  notes: string | null
  created_at: string
  notified_at: string | null
}

interface WaitlistPanelProps {
  className?: string
  onSeatEntry?: (entryId: string) => void
}

function getMinutesAgo(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
}

/**
 * Full waitlist management panel with add, notify, seat, and remove.
 */
export function WaitlistPanel({ className, onSeatEntry }: WaitlistPanelProps) {
  const [entries, setEntries] = useState<WaitlistEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [addLoading, setAddLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [form, setForm] = useState({
    customer_name: '',
    customer_phone: '',
    party_size: '2',
    quoted_wait_minutes: '15',
    notes: '',
  })

  const fetchWaitlist = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/reservations/waitlist?status=waiting,notified')
      if (res.ok) {
        const json = await res.json()
        setEntries(json.data ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchWaitlist()
  }, [fetchWaitlist])

  // Refresh timer for actual wait times
  useEffect(() => {
    const interval = setInterval(() => {
      setEntries((prev) => [...prev]) // Force re-render for timer
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  const handleAdd = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setAddLoading(true)
      try {
        const res = await fetch('/api/reservations/waitlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customer_name: form.customer_name,
            customer_phone: form.customer_phone || null,
            party_size: parseInt(form.party_size, 10),
            quoted_wait_minutes: parseInt(form.quoted_wait_minutes, 10),
            notes: form.notes || null,
          }),
        })
        if (res.ok) {
          setAddOpen(false)
          setForm({
            customer_name: '',
            customer_phone: '',
            party_size: '2',
            quoted_wait_minutes: '15',
            notes: '',
          })
          toast.success(`${form.customer_name} added to waitlist`)
          fetchWaitlist()
        }
      } finally {
        setAddLoading(false)
      }
    },
    [form, fetchWaitlist]
  )

  const handleNotify = useCallback(
    async (entry: WaitlistEntry) => {
      if (!entry.customer_phone) {
        toast.error('No phone number for this guest')
        return
      }
      setActionLoading(entry.id)
      try {
        const res = await fetch('/api/waitlist/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ waitlist_entry_id: entry.id }),
        })
        if (res.ok) {
          const json = await res.json()
          if (json.data.sms_sent) {
            toast.success(`SMS sent to ${entry.customer_name}`)
          } else {
            toast.info(`${entry.customer_name} marked as notified (SMS: ${json.data.sms_error ?? 'not configured'})`)
          }
          fetchWaitlist()
        }
      } finally {
        setActionLoading(null)
      }
    },
    [fetchWaitlist]
  )

  const handleSeat = useCallback(
    async (entry: WaitlistEntry) => {
      setActionLoading(entry.id)
      try {
        await fetch(`/api/reservations/waitlist/${entry.id}/seat`, { method: 'POST' })
        toast.success(`${entry.customer_name} seated from waitlist`)
        fetchWaitlist()
        onSeatEntry?.(entry.id)
      } finally {
        setActionLoading(null)
      }
    },
    [fetchWaitlist, onSeatEntry]
  )

  const handleRemove = useCallback(
    async (entry: WaitlistEntry) => {
      if (!confirm(`Remove ${entry.customer_name} from the waitlist?`)) return
      setActionLoading(entry.id)
      try {
        await fetch(`/api/reservations/waitlist/${entry.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'cancelled' }),
        })
        toast.success(`${entry.customer_name} removed from waitlist`)
        fetchWaitlist()
      } finally {
        setActionLoading(null)
      }
    },
    [fetchWaitlist]
  )

  const waiting = entries.filter((e) => e.status === 'waiting')
  const notified = entries.filter((e) => e.status === 'notified')

  return (
    <div className={className}>
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-bold text-foreground">Waitlist</h3>
          {entries.length > 0 && (
            <Badge variant="secondary" className="px-1.5 py-0 text-xs">
              {entries.length}
            </Badge>
          )}
        </div>
        <Button
          size="sm"
          className="touch-target"
          onClick={() => setAddOpen(true)}
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          Add Guest
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-center">
          <Clock className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            No guests waiting. Add walk-ins to the waitlist.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Waiting entries */}
          {waiting.map((entry) => {
            const minutesWaiting = getMinutesAgo(entry.created_at)
            const isOverQuoted =
              entry.quoted_wait_minutes !== null &&
              minutesWaiting > entry.quoted_wait_minutes

            return (
              <div
                key={entry.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
              >
                {/* Position */}
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-bold tabular-nums">
                  {entry.position}
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {entry.customer_name}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-0.5">
                      <Users className="h-3 w-3" />
                      {entry.party_size}
                    </span>
                    <span
                      className={
                        isOverQuoted ? 'font-medium text-destructive' : ''
                      }
                    >
                      {minutesWaiting}m
                      {isOverQuoted && (
                        <AlertTriangle className="ml-0.5 inline h-3 w-3" />
                      )}
                    </span>
                    {entry.quoted_wait_minutes !== null && (
                      <span className="text-muted-foreground/60">
                        / {entry.quoted_wait_minutes}m quoted
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  {entry.customer_phone && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 touch-target px-2 text-xs"
                      disabled={actionLoading === entry.id}
                      onClick={() => handleNotify(entry)}
                    >
                      <Bell className="mr-1 h-3 w-3" />
                      Notify
                    </Button>
                  )}
                  <Button
                    size="sm"
                    className="h-8 touch-target px-2 text-xs"
                    disabled={actionLoading === entry.id}
                    onClick={() => handleSeat(entry)}
                  >
                    <Armchair className="mr-1 h-3 w-3" />
                    Seat
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 touch-target p-0 text-muted-foreground hover:text-destructive"
                    disabled={actionLoading === entry.id}
                    onClick={() => handleRemove(entry)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )
          })}

          {/* Notified entries */}
          {notified.length > 0 && (
            <>
              <div className="pt-2">
                <p className="text-xs font-medium text-amber-700">
                  Notified (waiting for return)
                </p>
              </div>
              {notified.map((entry) => {
                const minutesSinceNotify = entry.notified_at
                  ? getMinutesAgo(entry.notified_at)
                  : 0
                const isNoResponse = minutesSinceNotify >= 15

                return (
                  <div
                    key={entry.id}
                    className={`flex items-center gap-3 rounded-xl border p-3 ${
                      isNoResponse
                        ? 'border-amber-300 bg-amber-50'
                        : 'border-blue-200 bg-blue-50'
                    }`}
                  >
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm">
                      <MessageSquare className="h-4 w-4 text-blue-600" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {entry.customer_name}
                        </p>
                        {isNoResponse && (
                          <Badge
                            variant="outline"
                            className="border-amber-300 bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0"
                          >
                            No Response
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-0.5">
                          <Users className="h-3 w-3" />
                          {entry.party_size}
                        </span>
                        <span>Notified {minutesSinceNotify}m ago</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        className="h-8 touch-target px-2 text-xs"
                        disabled={actionLoading === entry.id}
                        onClick={() => handleSeat(entry)}
                      >
                        <Armchair className="mr-1 h-3 w-3" />
                        Seat
                      </Button>
                      {entry.customer_phone && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 touch-target px-2 text-xs"
                          disabled={actionLoading === entry.id}
                          onClick={() => handleNotify(entry)}
                        >
                          Re-notify
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 touch-target p-0 text-muted-foreground hover:text-destructive"
                        disabled={actionLoading === entry.id}
                        onClick={() => handleRemove(entry)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </>
          )}
        </div>
      )}

      {/* Add to Waitlist Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add to Waitlist</DialogTitle>
            <DialogDescription>
              Add a walk-in guest to the waitlist.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="wl-name">Guest Name</Label>
              <Input
                id="wl-name"
                placeholder="Full name"
                value={form.customer_name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, customer_name: e.target.value }))
                }
                className="h-12"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wl-phone">Phone</Label>
              <Input
                id="wl-phone"
                type="tel"
                placeholder="(555) 123-4567"
                value={form.customer_phone}
                onChange={(e) =>
                  setForm((f) => ({ ...f, customer_phone: e.target.value }))
                }
                className="h-12"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="wl-party">Party Size</Label>
                <Input
                  id="wl-party"
                  type="number"
                  min={1}
                  max={100}
                  value={form.party_size}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, party_size: e.target.value }))
                  }
                  className="h-12"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wl-wait">Quoted Wait (min)</Label>
                <Input
                  id="wl-wait"
                  type="number"
                  min={0}
                  value={form.quoted_wait_minutes}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      quoted_wait_minutes: e.target.value,
                    }))
                  }
                  className="h-12"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={addLoading} className="btn-press">
                {addLoading && (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                )}
                Add to Waitlist
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
