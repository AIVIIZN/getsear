'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { Star, ArrowUp, ArrowDown, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

interface Transaction {
  id: string
  type: 'earn' | 'redeem' | 'adjust'
  points: number
  description: string
  created_at: string
  location_name?: string
}

interface PointsHistoryProps {
  accountId: string
  memberName: string
  tier: string
  balance: number
}

const TIER_COLORS: Record<string, string> = {
  Bronze: 'bg-orange-100 text-orange-800 border-orange-200',
  Silver: 'bg-gray-100 text-gray-700 border-gray-300',
  Gold: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  Platinum: 'bg-purple-100 text-purple-800 border-purple-200',
}

export function PointsHistory({ accountId, memberName, tier, balance }: PointsHistoryProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  const fetchHistory = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/loyalty/accounts/${accountId}`)
      const json = await res.json()
      if (res.ok) {
        setTransactions(json.data?.transactions ?? [])
      } else {
        toast.error(json.error ?? 'Failed to load history')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setLoading(false)
    }
  }, [accountId])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  if (loading) {
    return <Skeleton className="h-64 rounded-xl" />
  }

  return (
    <div className="space-y-4">
      {/* Member Card */}
      <Card className="border-warm shadow-warm">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-foreground">{memberName}</p>
              <Badge variant="outline" className={`${TIER_COLORS[tier] ?? ''} mt-1`}>
                {tier}
              </Badge>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Points Balance</p>
              <p className="text-2xl font-bold text-orange-600">{balance.toLocaleString()}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transaction History */}
      <Card className="border-warm shadow-warm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Star className="h-4 w-4 text-orange-500" />
            Points History
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No transactions yet
            </p>
          ) : (
            <div className="space-y-2">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between rounded-lg border border-border/50 p-3"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`rounded-full p-1.5 ${
                        tx.type === 'earn'
                          ? 'bg-green-50'
                          : tx.type === 'redeem'
                            ? 'bg-red-50'
                            : 'bg-blue-50'
                      }`}
                    >
                      {tx.type === 'earn' ? (
                        <ArrowUp className="h-3.5 w-3.5 text-green-600" />
                      ) : tx.type === 'redeem' ? (
                        <ArrowDown className="h-3.5 w-3.5 text-red-600" />
                      ) : (
                        <Star className="h-3.5 w-3.5 text-blue-600" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{tx.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(tx.created_at).toLocaleDateString()}{' '}
                        {new Date(tx.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                        {tx.location_name && ` • ${tx.location_name}`}
                      </p>
                    </div>
                  </div>
                  <p
                    className={`font-bold ${
                      tx.type === 'earn'
                        ? 'text-green-600'
                        : tx.type === 'redeem'
                          ? 'text-red-600'
                          : 'text-blue-600'
                    }`}
                  >
                    {tx.type === 'earn' ? '+' : tx.type === 'redeem' ? '-' : ''}
                    {Math.abs(tx.points).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
