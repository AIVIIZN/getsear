'use client'

import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { Search, Loader2, Users } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
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
import { PointsHistory } from './PointsHistory'

interface Member {
  id: string
  customer_id: string
  customer_name: string
  phone: string
  points_balance: number
  tier: string
  total_earned: number
  total_redeemed: number
  visit_count: number
  enrolled_at: string
}

const TIER_COLORS: Record<string, string> = {
  Bronze: 'bg-orange-100 text-orange-800 border-orange-200',
  Silver: 'bg-gray-100 text-gray-700 border-gray-300',
  Gold: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  Platinum: 'bg-purple-100 text-purple-800 border-purple-200',
}

export function MemberLookup() {
  const [search, setSearch] = useState('')
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)

  const handleSearch = useCallback(async () => {
    if (!search.trim()) return
    setLoading(true)
    setHasSearched(true)

    try {
      const res = await fetch(`/api/loyalty/accounts?search=${encodeURIComponent(search)}`)
      const json = await res.json()
      if (res.ok) {
        const membersList = (json.data ?? []).map((acc: Record<string, unknown>) => {
          const cust = acc.customers as Record<string, unknown> | null
          return {
            id: acc.id,
            customer_id: acc.customer_id,
            customer_name: cust
              ? `${cust.first_name ?? ''} ${cust.last_name ?? ''}`.trim() || 'Guest'
              : 'Guest',
            phone: (cust?.phone as string) ?? '',
            points_balance: acc.points_balance,
            tier: acc.tier,
            total_earned: acc.total_earned,
            total_redeemed: acc.total_redeemed,
            visit_count: 0,
            enrolled_at: acc.enrolled_at as string,
          }
        })
        setMembers(membersList)
      } else {
        toast.error(json.error ?? 'Search failed')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setLoading(false)
    }
  }, [search])

  if (selectedMember) {
    return (
      <div className="space-y-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSelectedMember(null)}
        >
          Back to search
        </Button>
        <PointsHistory
          accountId={selectedMember.id}
          memberName={selectedMember.customer_name}
          tier={selectedMember.tier}
          balance={selectedMember.points_balance}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card className="border-warm shadow-warm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Member Lookup
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search by name or phone..."
                className="pl-9 h-11"
              />
            </div>
            <Button onClick={handleSearch} disabled={loading} className="h-11">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : hasSearched ? (
        <Card className="border-warm shadow-warm">
          <CardContent className="pt-4">
            {members.length === 0 ? (
              <div className="text-center py-8">
                <Users className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No members found</p>
              </div>
            ) : (
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
                  {members.map((member) => (
                    <TableRow
                      key={member.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedMember(member)}
                    >
                      <TableCell className="font-medium">{member.customer_name}</TableCell>
                      <TableCell className="text-muted-foreground">{member.phone}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={TIER_COLORS[member.tier] ?? ''}>
                          {member.tier}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium text-orange-600">
                        {member.points_balance.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {member.total_earned.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(member.enrolled_at).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
