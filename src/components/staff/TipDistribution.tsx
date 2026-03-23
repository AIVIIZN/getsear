'use client'

import { useState, useEffect } from 'react'
import { DollarSign, CreditCard, Banknote, TrendingUp, Calculator, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { EmptyState } from '@/components/shared/EmptyState'
import { TipDistributionPreview } from './TipDistributionPreview'
import type { TipDistributionResult } from '@/lib/staff/tip-pool-calculator'

interface TipEntry {
  userId: string
  name: string
  role: string
  cardTips: number
  cashDeclared: number
  poolShare: number
  tipOutGiven: number
  tipOutReceived: number
  netTips: number
}

export function TipDistribution() {
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(false)
  const [entries, setEntries] = useState<TipEntry[]>([])
  const [totalCard, setTotalCard] = useState(0)
  const [totalCash, setTotalCash] = useState(0)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewData, setPreviewData] = useState<TipDistributionResult[]>([])
  const [committing, setCommitting] = useState(false)

  useEffect(() => {
    loadTips()
  }, [date])

  const loadTips = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/staff/tips?date=${date}`)
      if (res.ok) {
        const json = await res.json()
        if (json.data) {
          const tips = json.data
          setTotalCard(tips.total_credit_tips ? Math.round(parseFloat(tips.total_credit_tips) * 100) : 0)
          setTotalCash(tips.total_cash_tips ? Math.round(parseFloat(tips.total_cash_tips) * 100) : 0)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const byStaff = (tips.by_staff ?? []).map((s: any) => ({
            userId: s.user_id,
            name: s.name,
            role: s.role ?? 'staff',
            cardTips: Math.round(parseFloat(s.credit_tips ?? '0') * 100),
            cashDeclared: Math.round(parseFloat(s.cash_tips ?? '0') * 100),
            poolShare: 0,
            tipOutGiven: Math.round(parseFloat(s.tip_out_given ?? '0') * 100),
            tipOutReceived: Math.round(parseFloat(s.tip_out_received ?? '0') * 100),
            netTips: Math.round(parseFloat(s.total_tips ?? '0') * 100),
          }))
          setEntries(byStaff)
        }
      }
    } catch { /* silent */ }
    setLoading(false)
  }

  const handleRunDistribution = async () => {
    // For now, create a preview based on current data
    const preview: TipDistributionResult[] = entries.map((e) => ({
      userId: e.userId,
      name: e.name,
      role: e.role,
      cardTipsCents: e.cardTips,
      cashTipsDeclaredCents: e.cashDeclared,
      poolShareCents: e.poolShare,
      tipOutGivenCents: e.tipOutGiven,
      tipOutReceivedCents: e.tipOutReceived,
      processingFeeDeductedCents: 0,
      netTipsCents: e.netTips,
      breakdown: 'Direct distribution',
    }))
    setPreviewData(preview)
    setPreviewOpen(true)
  }

  const handleCommit = async () => {
    setCommitting(true)
    try {
      const distributions = previewData.map((d) => ({
        user_id: d.userId,
        amount: (d.netTipsCents / 100).toFixed(2),
      }))

      const res = await fetch('/api/staff/tips/distribute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          location_id: 'default',
          total_pool_amount: (previewData.reduce((s, d) => s + d.netTipsCents, 0) / 100).toFixed(2),
          distributions,
        }),
      })

      if (res.ok) {
        toast.success('Tip distribution committed')
        setPreviewOpen(false)
        loadTips()
      } else {
        const json = await res.json()
        toast.error(json.error ?? 'Failed to distribute')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setCommitting(false)
    }
  }

  const totalAll = totalCard + totalCash
  const totalHours = 1 // placeholder
  const tipsPerHour = totalHours > 0 ? totalAll / totalHours / 100 : 0

  return (
    <div className="space-y-6">
      {/* Date picker + actions */}
      <div className="flex items-center gap-3">
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-40 h-10"
        />
        <Button onClick={handleRunDistribution} disabled={entries.length === 0} className="gap-2">
          <Calculator className="h-4 w-4" />
          Run Distribution
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Card Tips</span>
            </div>
            <p className="text-xl font-bold font-mono">${(totalCard / 100).toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Banknote className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Cash Tips</span>
            </div>
            <p className="text-xl font-bold font-mono">${(totalCash / 100).toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Total</span>
            </div>
            <p className="text-xl font-bold font-mono">${(totalAll / 100).toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Pool Amount</span>
            </div>
            <p className="text-xl font-bold font-mono">$0.00</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Tips/Labor Hr</span>
            </div>
            <p className="text-xl font-bold font-mono">${tipsPerHour.toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Distribution table */}
      {loading ? (
        <div className="animate-pulse space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-10 bg-muted rounded" />)}</div>
      ) : entries.length === 0 ? (
        <EmptyState
          icon={DollarSign}
          title="No tip data"
          description="No tip data for this date. Tips appear after employees clock out."
        />
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Employee</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="text-right">Card Tips</TableHead>
                <TableHead className="text-right">Cash Declared</TableHead>
                <TableHead className="text-right">Pool Share</TableHead>
                <TableHead className="text-right">Tip-out Given</TableHead>
                <TableHead className="text-right">Tip-out Received</TableHead>
                <TableHead className="text-right font-semibold">Net Tips</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((e) => (
                <TableRow key={e.userId}>
                  <TableCell className="text-sm font-medium">{e.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize text-xs">{e.role}</Badge>
                  </TableCell>
                  <TableCell className="text-sm font-mono text-right">${(e.cardTips / 100).toFixed(2)}</TableCell>
                  <TableCell className="text-sm font-mono text-right">${(e.cashDeclared / 100).toFixed(2)}</TableCell>
                  <TableCell className="text-sm font-mono text-right">{e.poolShare > 0 ? `$${(e.poolShare / 100).toFixed(2)}` : '--'}</TableCell>
                  <TableCell className="text-sm font-mono text-right">{e.tipOutGiven > 0 ? `$${(e.tipOutGiven / 100).toFixed(2)}` : '--'}</TableCell>
                  <TableCell className="text-sm font-mono text-right">{e.tipOutReceived > 0 ? `$${(e.tipOutReceived / 100).toFixed(2)}` : '--'}</TableCell>
                  <TableCell className="text-sm font-mono text-right font-semibold">${(e.netTips / 100).toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <TipDistributionPreview
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        distributions={previewData}
        onCommit={handleCommit}
        committing={committing}
      />
    </div>
  )
}
