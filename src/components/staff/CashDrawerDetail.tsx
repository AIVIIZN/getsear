'use client'

import { useState, useEffect, useCallback } from 'react'
import { ArrowLeft, Loader2, DollarSign, ArrowUpRight, ArrowDownRight, Vault } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { DenominationCounter } from './DenominationCounter'
import type { DenominationCount } from '@/lib/staff/denomination-calculator'
import { useAuthStore } from '@/stores/auth-store'
import { cn } from '@/lib/utils'

interface DrawerData {
  id: string
  name: string
  status: string
  assigned_to: string | null
  expected_cash: string
  actual_cash: string
  over_short: string
  opened_at: string | null
  closed_at: string | null
}

interface DrawerEvent {
  id: string
  event_type: string
  amount: string
  performed_by_name: string
  notes: string | null
  created_at: string
}

interface CashDrawerDetailProps {
  drawerId: string
  onBack: () => void
}

export function CashDrawerDetail({ drawerId, onBack }: CashDrawerDetailProps) {
  const [drawer, setDrawer] = useState<DrawerData | null>(null)
  const [events, setEvents] = useState<DrawerEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<'view' | 'open' | 'close' | 'event'>('view')
  const [denomCounts, setDenomCounts] = useState<DenominationCount[]>([])
  const [denomTotal, setDenomTotal] = useState(0)
  const [eventType, setEventType] = useState<'pay_in' | 'pay_out' | 'safe_drop'>('pay_in')
  const [eventAmount, setEventAmount] = useState('')
  const [eventNotes, setEventNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const user = useAuthStore((s) => s.user)

  const loadDrawer = useCallback(async () => {
    setLoading(true)
    try {
      const [drawerRes, eventsRes] = await Promise.all([
        fetch(`/api/staff/cash-drawers/${drawerId}`),
        fetch(`/api/staff/cash-drawers/${drawerId}/events`),
      ])

      if (drawerRes.ok) {
        const json = await drawerRes.json()
        setDrawer(json.data)
      }
      if (eventsRes.ok) {
        const json = await eventsRes.json()
        setEvents(json.data ?? [])
      }
    } catch { /* silent */ }
    setLoading(false)
  }, [drawerId])

  useEffect(() => { loadDrawer() }, [loadDrawer])

  const handleOpen = async () => {
    if (!user) { toast.error('You must be signed in to open a drawer'); return }
    setSaving(true)
    try {
      const denomMap: Record<string, number> = {}
      denomCounts.forEach((d) => { denomMap[d.key] = d.quantity })

      const res = await fetch(`/api/staff/cash-drawers/${drawerId}/open`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assigned_to: user.id,
          starting_cash: (denomTotal / 100).toFixed(2),
          denominations: denomMap,
        }),
      })

      if (res.ok) {
        toast.success('Drawer opened')
        setMode('view')
        loadDrawer()
      } else {
        const json = await res.json()
        toast.error(json.error ?? 'Failed to open')
      }
    } catch { toast.error('Network error') }
    setSaving(false)
  }

  const handleClose = async () => {
    setSaving(true)
    try {
      const denomMap: Record<string, number> = {}
      denomCounts.forEach((d) => { denomMap[d.key] = d.quantity })

      const res = await fetch(`/api/staff/cash-drawers/${drawerId}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actual_cash: (denomTotal / 100).toFixed(2),
          denominations: denomMap,
        }),
      })

      if (res.ok) {
        toast.success('Drawer closed')
        setMode('view')
        loadDrawer()
      } else {
        const json = await res.json()
        toast.error(json.error ?? 'Failed to close')
      }
    } catch { toast.error('Network error') }
    setSaving(false)
  }

  const handleEvent = async () => {
    if (!eventAmount) { toast.error('Enter an amount'); return }
    setSaving(true)
    try {
      const res = await fetch(`/api/staff/cash-drawers/${drawerId}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_type: eventType,
          amount: eventAmount,
          notes: eventNotes || undefined,
        }),
      })

      if (res.ok) {
        toast.success(`${eventType.replace('_', ' ')} recorded`)
        setMode('view')
        setEventAmount('')
        setEventNotes('')
        loadDrawer()
      } else {
        const json = await res.json()
        toast.error(json.error ?? 'Failed')
      }
    } catch { toast.error('Network error') }
    setSaving(false)
  }

  if (loading || !drawer) {
    return <div className="animate-pulse space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-12 bg-muted rounded" />)}</div>
  }

  const isOpen = drawer.status === 'open'
  const overShort = parseFloat(drawer.over_short ?? '0')

  return (
    <div className="space-y-4">
      <Button variant="ghost" onClick={onBack} className="gap-2 mb-2">
        <ArrowLeft className="h-4 w-4" /> Back to Drawers
      </Button>

      {/* Drawer header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">{drawer.name}</h3>
          <Badge variant="outline" className={isOpen ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-100 text-gray-500 border-gray-200'}>
            {isOpen ? 'Open' : 'Closed'}
          </Badge>
        </div>
        <div className="flex gap-2">
          {!isOpen && mode === 'view' && (
            <Button onClick={() => setMode('open')} className="gap-1">Open Drawer</Button>
          )}
          {isOpen && mode === 'view' && (
            <>
              <Button variant="outline" onClick={() => setMode('event')} className="gap-1">
                <DollarSign className="h-4 w-4" /> Pay In/Out
              </Button>
              <Button onClick={() => setMode('close')} className="gap-1">Close Drawer</Button>
            </>
          )}
        </div>
      </div>

      {/* Expected cash display */}
      {isOpen && mode === 'view' && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Expected Cash</span>
              <span className="text-2xl font-bold font-mono">${parseFloat(drawer.expected_cash).toFixed(2)}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Over/Short for closed drawers */}
      {!isOpen && drawer.actual_cash !== '0.00' && (
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Over/Short</p>
              <p className={cn('text-2xl font-bold font-mono', overShort === 0 ? 'text-green-600' : overShort > 0 ? 'text-green-600' : 'text-red-600')}>
                {overShort === 0 ? 'Even' : `${overShort > 0 ? '+' : '-'}$${Math.abs(overShort).toFixed(2)}`}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Expected: ${parseFloat(drawer.expected_cash).toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">Actual: ${parseFloat(drawer.actual_cash).toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Open drawer flow */}
      {mode === 'open' && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Opening Count</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <DenominationCounter onChange={(counts, total) => { setDenomCounts(counts); setDenomTotal(total) }} />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setMode('view')}>Cancel</Button>
              <Button onClick={handleOpen} disabled={saving || !user}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Open with ${(denomTotal / 100).toFixed(2)}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Close drawer flow */}
      {mode === 'close' && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Closing Count</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <DenominationCounter
              onChange={(counts, total) => { setDenomCounts(counts); setDenomTotal(total) }}
              expectedCents={Math.round(parseFloat(drawer.expected_cash) * 100)}
            />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setMode('view')}>Cancel</Button>
              <Button onClick={handleClose} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Close Drawer
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pay in/out/safe drop */}
      {mode === 'event' && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Record Cash Event</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              {(['pay_in', 'pay_out', 'safe_drop'] as const).map((t) => (
                <Button key={t} variant={eventType === t ? 'default' : 'outline'} size="sm" onClick={() => setEventType(t)} className="capitalize">
                  {t === 'pay_in' && <ArrowDownRight className="h-3.5 w-3.5 mr-1" />}
                  {t === 'pay_out' && <ArrowUpRight className="h-3.5 w-3.5 mr-1" />}
                  {t === 'safe_drop' && <Vault className="h-3.5 w-3.5 mr-1" />}
                  {t.replace('_', ' ')}
                </Button>
              ))}
            </div>
            <div className="space-y-2">
              <Label>Amount ($)</Label>
              <Input type="number" step="0.01" min="0" value={eventAmount} onChange={(e) => setEventAmount(e.target.value)} className="h-10" />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input value={eventNotes} onChange={(e) => setEventNotes(e.target.value)} placeholder="Reason..." className="h-10" />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setMode('view')}>Cancel</Button>
              <Button onClick={handleEvent} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Record
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Event log */}
      <div>
        <h4 className="text-sm font-semibold mb-3">Event Log</h4>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No events recorded yet.</p>
        ) : (
          <div className="space-y-2">
            {events.map((e) => (
              <div key={e.id} className="flex items-center justify-between py-2 px-3 rounded-lg border border-border">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="capitalize text-xs">{e.event_type.replace('_', ' ')}</Badge>
                  <span className="text-sm text-muted-foreground">{e.performed_by_name}</span>
                </div>
                <div className="text-right">
                  <p className="text-sm font-mono font-semibold">${parseFloat(e.amount).toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(e.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
