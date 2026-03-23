'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { DollarSign, AlertTriangle, Users, TrendingUp, RefreshCw, FileText } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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

interface AgingSummary {
  current: number
  days_30: number
  days_60: number
  days_90_plus: number
  total: number
}

interface AccountAging {
  id: string
  name: string
  balance: number
  credit_limit: number
  utilization_pct: number
  current: number
  days_30: number
  days_60: number
  days_90_plus: number
}

export function AccountDashboard() {
  const [summary, setSummary] = useState<AgingSummary | null>(null)
  const [accounts, setAccounts] = useState<AccountAging[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/house-accounts/aging')
      const json = await res.json()
      if (res.ok) {
        setSummary(json.data?.summary ?? null)
        setAccounts(json.data?.accounts ?? [])
      }
    } catch {
      toast.error('Failed to load aging data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const generateStatement = async (accountId: string) => {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]

    window.open(`/api/house-accounts/${accountId}/statement?date_from=${monthStart}&date_to=${monthEnd}&format=html`, '_blank')
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-5 gap-3">
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  const utilizationColor = (pct: number) =>
    pct >= 100 ? 'text-red-600' : pct >= 80 ? 'text-amber-600' : 'text-green-600'

  const utilizationBg = (pct: number) =>
    pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-green-500'

  return (
    <div className="space-y-6">
      {/* Aging Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="border-warm shadow-warm">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Current</p>
            <p className="text-xl font-bold text-green-600">${(summary?.current ?? 0).toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card className="border-warm shadow-warm">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">30 Days</p>
            <p className="text-xl font-bold text-amber-600">${(summary?.days_30 ?? 0).toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card className="border-warm shadow-warm">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">60 Days</p>
            <p className="text-xl font-bold text-orange-600">${(summary?.days_60 ?? 0).toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card className="border-warm shadow-warm">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">90+ Days</p>
            <p className="text-xl font-bold text-red-600">${(summary?.days_90_plus ?? 0).toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card className="border-warm shadow-warm">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Total AR</p>
            <p className="text-xl font-bold">${(summary?.total ?? 0).toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Accounts Table */}
      <Card className="border-warm shadow-warm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Accounts Receivable Aging</CardTitle>
            <Button variant="ghost" size="sm" onClick={fetchData} className="h-8 w-8 p-0">
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead className="text-right">Credit Limit</TableHead>
                <TableHead className="text-center">Utilization</TableHead>
                <TableHead className="text-right">Current</TableHead>
                <TableHead className="text-right">30 Days</TableHead>
                <TableHead className="text-right">60 Days</TableHead>
                <TableHead className="text-right">90+</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    No house accounts
                  </TableCell>
                </TableRow>
              ) : (
                accounts.map((acc) => (
                  <TableRow key={acc.id} className={acc.utilization_pct >= 80 ? 'bg-amber-50/30' : ''}>
                    <TableCell className="font-medium">{acc.name}</TableCell>
                    <TableCell className="text-right font-medium">${acc.balance.toFixed(2)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">${acc.credit_limit.toFixed(2)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 justify-center">
                        <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${utilizationBg(acc.utilization_pct)}`}
                            style={{ width: `${Math.min(100, acc.utilization_pct)}%` }}
                          />
                        </div>
                        <span className={`text-xs font-medium ${utilizationColor(acc.utilization_pct)}`}>
                          {acc.utilization_pct}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-green-600">{acc.current > 0 ? `$${acc.current.toFixed(2)}` : '-'}</TableCell>
                    <TableCell className="text-right text-amber-600">{acc.days_30 > 0 ? `$${acc.days_30.toFixed(2)}` : '-'}</TableCell>
                    <TableCell className="text-right text-orange-600">{acc.days_60 > 0 ? `$${acc.days_60.toFixed(2)}` : '-'}</TableCell>
                    <TableCell className="text-right text-red-600">{acc.days_90_plus > 0 ? `$${acc.days_90_plus.toFixed(2)}` : '-'}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => generateStatement(acc.id)}
                        className="h-7 px-2"
                      >
                        <FileText className="h-3 w-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
