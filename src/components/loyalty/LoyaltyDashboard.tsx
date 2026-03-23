'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { Users, Star, Gift, TrendingUp, RefreshCw } from 'lucide-react'
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

interface DashboardData {
  active_members: number
  points_issued_today: number
  rewards_redeemed_today: number
  program_roi: number
  member_growth: Array<{ date: string; count: number }>
  top_members: Array<{
    id: string
    customer_name: string
    phone: string
    points_balance: number
    tier: string
    total_earned: number
    enrolled_at: string
  }>
}

const TIER_COLORS: Record<string, string> = {
  Bronze: 'bg-orange-100 text-orange-800 border-orange-200',
  Silver: 'bg-gray-100 text-gray-700 border-gray-300',
  Gold: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  Platinum: 'bg-purple-100 text-purple-800 border-purple-200',
}

export function LoyaltyDashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchDashboard = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/loyalty/dashboard')
      const json = await res.json()
      if (res.ok) setData(json.data)
      else toast.error(json.error ?? 'Failed to load dashboard')
    } catch {
      toast.error('Network error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDashboard()
  }, [fetchDashboard])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-warm shadow-warm">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Active Members</p>
                <p className="text-2xl font-bold text-blue-600 mt-1">{data.active_members.toLocaleString()}</p>
              </div>
              <div className="rounded-lg p-2 bg-blue-50">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-warm shadow-warm">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Points Issued Today</p>
                <p className="text-2xl font-bold text-orange-600 mt-1">{data.points_issued_today.toLocaleString()}</p>
              </div>
              <div className="rounded-lg p-2 bg-orange-50">
                <Star className="h-5 w-5 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-warm shadow-warm">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Rewards Redeemed</p>
                <p className="text-2xl font-bold text-green-600 mt-1">{data.rewards_redeemed_today}</p>
                <p className="text-xs text-muted-foreground">today</p>
              </div>
              <div className="rounded-lg p-2 bg-green-50">
                <Gift className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-warm shadow-warm">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Earn/Redeem Ratio</p>
                <p className="text-2xl font-bold text-indigo-600 mt-1">{data.program_roi}x</p>
                <p className="text-xs text-muted-foreground">earn vs redeem</p>
              </div>
              <div className="rounded-lg p-2 bg-indigo-50">
                <TrendingUp className="h-5 w-5 text-indigo-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Member Growth Chart (CSS bars) */}
      {data.member_growth.length > 0 && (
        <Card className="border-warm shadow-warm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">New Enrollments (Last 30 Days)</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-end gap-1 h-32">
              {data.member_growth.map((day) => {
                const maxCount = Math.max(...data.member_growth.map((d) => d.count))
                const height = maxCount > 0 ? (day.count / maxCount) * 100 : 0
                return (
                  <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[9px] text-muted-foreground">{day.count}</span>
                    <div
                      className="w-full bg-orange-400 rounded-t transition-all min-h-[2px]"
                      style={{ height: `${height}%` }}
                    />
                    <span className="text-[8px] text-muted-foreground rotate-45 origin-left whitespace-nowrap">
                      {new Date(day.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top Members */}
      <Card className="border-warm shadow-warm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Top Members</CardTitle>
            <Button variant="ghost" size="sm" onClick={fetchDashboard} className="h-8 w-8 p-0">
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead className="text-right">Total Earned</TableHead>
                <TableHead>Enrolled</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.top_members.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No members enrolled yet
                  </TableCell>
                </TableRow>
              ) : (
                data.top_members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">{member.customer_name}</TableCell>
                    <TableCell className="text-muted-foreground">{member.phone}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={TIER_COLORS[member.tier] ?? ''}>
                        {member.tier}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {member.points_balance.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {member.total_earned.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(member.enrolled_at).toLocaleDateString()}
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
