'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { AlertTriangle, CheckCircle2, Gift, RefreshCw, ShieldAlert, TrendingUp, Users, WalletCards } from 'lucide-react'
import { Button } from '@/components/ui-v2/Button'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui-v2/Card'
import { Badge, type BadgeProps } from '@/components/ui-v2/data/Badge'
import { Skeleton } from '@/components/ui-v2/data/Skeleton'
import { Stat } from '@/components/ui-v2/data/Stat'
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui-v2/data/Table'
import { EmptyState } from '@/components/ui-v2/feedback/EmptyState'

type ReviewStatus = 'open' | 'in_review' | 'resolved' | 'dismissed'

type ReviewItem = {
  id: string
  signal_type: string
  severity: 'low' | 'medium' | 'high'
  status: ReviewStatus
  title: string
  description: string
  detected_at: string
  evidence: Record<string, unknown>
  guests?: { display_name?: string } | { display_name?: string }[] | null
  crm_loyalty_accounts?: { account_number?: string } | { account_number?: string }[] | null
  crm_rewards?: { name?: string } | { name?: string }[] | null
}

type DashboardData = {
  period_days: number
  summary: {
    active_members: number
    enrollments: number
    liability_cents: number
    points_outstanding: number
    points_earned: number
    points_redeemed: number
    redemptions: number
    redemption_discount_cents: number
    loyalty_revenue_cents: number
    open_review_items: number
  }
  check_comparison: {
    loyalty_average_check_cents: number
    non_loyalty_average_check_cents: number
    loyalty_check_count: number
    non_loyalty_check_count: number
  }
  member_growth: Array<{ date: string; count: number }>
  top_members: Array<{
    id: string
    guest_name: string
    account_number: string
    points_balance: number
    tier: string
    visits_count: number
    lifetime_points_earned: number
    lifetime_points_redeemed: number
    enrolled_at: string
  }>
  top_rewards: Array<{
    reward_name: string
    redemptions: number
    discount_cents: number
    points_spent: number
  }>
  review_items: ReviewItem[]
  churn: {
    inactive_30_days: number
    low_balance_members: number
  }
}

function relationOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function money(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(cents / 100)
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function severityVariant(severity: ReviewItem['severity']): NonNullable<BadgeProps['variant']> {
  if (severity === 'high') return 'danger'
  if (severity === 'medium') return 'warning'
  return 'info'
}

function signalLabel(signal: string): string {
  return signal
    .split('_')
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(' ')
}

export function LoyaltyDashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const fetchDashboard = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/crm/loyalty/dashboard?days=30')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to load loyalty dashboard')
      setData(json.data)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load loyalty dashboard')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDashboard()
  }, [fetchDashboard])

  async function updateReviewItem(reviewItemId: string, status: ReviewStatus) {
    setUpdatingId(reviewItemId)
    try {
      const res = await fetch('/api/crm/loyalty/fraud', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ review_item_id: reviewItemId, status }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to update review item')
      toast.success(status === 'resolved' ? 'Review item resolved' : 'Review item updated')
      await fetchDashboard()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update review item')
    } finally {
      setUpdatingId(null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} variant="card" className="h-[132px]" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <Skeleton variant="chart" />
          <Skeleton variant="card" className="h-[260px]" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} variant="table-row" />
          ))}
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <EmptyState
        icon={WalletCards}
        title="Loyalty dashboard unavailable"
        description="Refresh to reload the CRM loyalty performance and review queue."
        action={{ label: 'Refresh dashboard', onClick: fetchDashboard }}
      />
    )
  }

  const checkLift = data.check_comparison.non_loyalty_average_check_cents
    ? Math.round(((data.check_comparison.loyalty_average_check_cents - data.check_comparison.non_loyalty_average_check_cents) / data.check_comparison.non_loyalty_average_check_cents) * 100)
    : 0
  const maxGrowth = Math.max(1, ...data.member_growth.map((day) => day.count))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-[var(--space-3)]">
        <div>
          <p className="text-[length:var(--type-subhead-size)] font-[var(--weight-medium)] text-[var(--color-text-muted)]">
            Last {data.period_days} days
          </p>
          <h2 className="text-[length:var(--type-title-2-size)] font-[var(--weight-semibold)] text-[var(--color-text)]">
            CRM loyalty performance
          </h2>
        </div>
        <Button variant="secondary" size="md" leadingIcon={<RefreshCw />} onClick={fetchDashboard}>
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card variant="elevated" padding="compact">
          <CardBody>
            <div className="flex items-start justify-between gap-[var(--space-4)]">
              <Stat label="Active members" value={data.summary.active_members.toLocaleString()} delta={{ value: `${data.summary.enrollments} enrolled`, direction: 'up', intent: 'positive', label: 'period' }} />
              <Users className="h-5 w-5 text-[var(--color-primary)]" />
            </div>
          </CardBody>
        </Card>
        <Card variant="elevated" padding="compact">
          <CardBody>
            <div className="flex items-start justify-between gap-[var(--space-4)]">
              <Stat label="Reward liability" value={money(data.summary.liability_cents)} delta={{ value: `${data.summary.points_outstanding.toLocaleString()} pts`, direction: 'flat', label: 'outstanding' }} />
              <WalletCards className="h-5 w-5 text-[var(--color-warning)]" />
            </div>
          </CardBody>
        </Card>
        <Card variant="elevated" padding="compact">
          <CardBody>
            <div className="flex items-start justify-between gap-[var(--space-4)]">
              <Stat label="Loyalty revenue" value={money(data.summary.loyalty_revenue_cents)} delta={{ value: `${data.summary.redemptions} redemptions`, direction: 'up', label: 'tracked' }} />
              <TrendingUp className="h-5 w-5 text-[var(--color-success)]" />
            </div>
          </CardBody>
        </Card>
        <Card variant="elevated" padding="compact">
          <CardBody>
            <div className="flex items-start justify-between gap-[var(--space-4)]">
              <Stat label="Review queue" value={data.summary.open_review_items.toLocaleString()} delta={{ value: 'human review', direction: data.summary.open_review_items ? 'down' : 'flat', intent: data.summary.open_review_items ? 'negative' : 'positive' }} />
              <ShieldAlert className="h-5 w-5 text-[var(--color-danger)]" />
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <Card variant="elevated">
          <CardHeader>
            <CardTitle>Enrollment and check comparison</CardTitle>
          </CardHeader>
          <CardBody className="space-y-5">
            {data.member_growth.length ? (
              <div className="flex h-[160px] items-end gap-[var(--space-2)] border-b border-[var(--color-border)] pb-[var(--space-4)]">
                {data.member_growth.map((day) => (
                  <div key={day.date} className="flex min-w-[18px] flex-1 flex-col items-center gap-[var(--space-1)]">
                    <span className="text-[length:var(--type-caption-2-size)] text-[var(--color-text-muted)]">{day.count}</span>
                    <div
                      className="w-full rounded-t-[var(--radius-xs)] bg-[var(--color-primary)]"
                      style={{ height: `${Math.max(6, (day.count / maxGrowth) * 100)}%` }}
                    />
                    <span className="text-[length:var(--type-caption-2-size)] text-[var(--color-text-muted)]">{shortDate(day.date)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Users}
                title="No new enrollments in this period"
                description="Checkout enrollments will appear here as guests join loyalty."
              />
            )}
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <p className="text-[length:var(--type-caption-1-size)] text-[var(--color-text-muted)]">Loyalty avg check</p>
                <p className="text-[length:var(--type-title-3-size)] font-[var(--weight-semibold)]">{money(data.check_comparison.loyalty_average_check_cents)}</p>
              </div>
              <div>
                <p className="text-[length:var(--type-caption-1-size)] text-[var(--color-text-muted)]">Non-loyalty avg check</p>
                <p className="text-[length:var(--type-title-3-size)] font-[var(--weight-semibold)]">{money(data.check_comparison.non_loyalty_average_check_cents)}</p>
              </div>
              <div>
                <p className="text-[length:var(--type-caption-1-size)] text-[var(--color-text-muted)]">Check lift</p>
                <p className="text-[length:var(--type-title-3-size)] font-[var(--weight-semibold)]">{checkLift > 0 ? '+' : ''}{checkLift}%</p>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card variant="elevated">
          <CardHeader>
            <CardTitle>Top rewards</CardTitle>
          </CardHeader>
          <CardBody>
            {data.top_rewards.length ? (
              <div className="space-y-3">
                {data.top_rewards.map((reward) => (
                  <div key={reward.reward_name} className="flex items-center justify-between gap-[var(--space-3)] rounded-[var(--radius-sm)] border border-[var(--color-border)] p-[var(--space-3)]">
                    <div className="min-w-0">
                      <p className="truncate font-[var(--weight-medium)] text-[var(--color-text)]">{reward.reward_name}</p>
                      <p className="text-[length:var(--type-caption-1-size)] text-[var(--color-text-muted)]">{reward.points_spent.toLocaleString()} points spent</p>
                    </div>
                    <div className="text-right">
                      <Badge variant="primary">{reward.redemptions} used</Badge>
                      <p className="mt-[var(--space-1)] text-[length:var(--type-caption-1-size)] text-[var(--color-text-muted)]">{money(reward.discount_cents)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon={Gift} title="No rewards redeemed yet" description="Top rewards populate after CRM loyalty redemptions." />
            )}
          </CardBody>
        </Card>
      </div>

      <Card variant="elevated">
        <CardHeader>
          <div className="flex items-center justify-between gap-[var(--space-3)]">
            <CardTitle>Suspicious activity review</CardTitle>
            <Badge variant={data.review_items.length ? 'warning' : 'success'}>{data.review_items.length || 'Clear'}</Badge>
          </div>
        </CardHeader>
        <CardBody>
          {data.review_items.length ? (
            <div className="space-y-3">
              {data.review_items.map((item) => {
                const guest = relationOne(item.guests)
                const account = relationOne(item.crm_loyalty_accounts)
                const reward = relationOne(item.crm_rewards)
                return (
                  <div key={item.id} className="rounded-[var(--radius-md)] border border-[var(--color-border)] p-[var(--space-4)]">
                    <div className="flex flex-col gap-[var(--space-3)] md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-[var(--space-2)]">
                          <Badge variant={severityVariant(item.severity)}>{item.severity}</Badge>
                          <Badge variant="default">{signalLabel(item.signal_type)}</Badge>
                          <span className="text-[length:var(--type-caption-1-size)] text-[var(--color-text-muted)]">{shortDate(item.detected_at)}</span>
                        </div>
                        <div>
                          <p className="font-[var(--weight-semibold)] text-[var(--color-text)]">{item.title}</p>
                          <p className="mt-[var(--space-1)] text-[length:var(--type-subhead-size)] text-[var(--color-text-muted)]">{item.description}</p>
                        </div>
                        <p className="text-[length:var(--type-caption-1-size)] text-[var(--color-text-muted)]">
                          {guest?.display_name ?? 'Guest'} · {account?.account_number ?? 'No account number'}{reward?.name ? ` · ${reward.name}` : ''}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-[var(--space-2)]">
                        <Button
                          variant="secondary"
                          size="sm"
                          leadingIcon={<AlertTriangle />}
                          loading={updatingId === item.id}
                          onClick={() => updateReviewItem(item.id, 'in_review')}
                        >
                          Review
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          leadingIcon={<CheckCircle2 />}
                          loading={updatingId === item.id}
                          onClick={() => updateReviewItem(item.id, 'resolved')}
                        >
                          Resolve
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <EmptyState
              icon={ShieldAlert}
              title="No loyalty review items"
              description="Suspicious rewards, manual adjustments, shared phones, refunds, and comp stacking are monitored without automatic punishment."
            />
          )}
        </CardBody>
      </Card>

      <Card variant="elevated">
        <CardHeader>
          <CardTitle>Top members</CardTitle>
        </CardHeader>
        <CardBody>
          {data.top_members.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableCell header>Guest</TableCell>
                  <TableCell header>Tier</TableCell>
                  <TableCell header align="right">Balance</TableCell>
                  <TableCell header align="right">Earned</TableCell>
                  <TableCell header align="right">Redeemed</TableCell>
                  <TableCell header align="right">Visits</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.top_members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div>
                        <p className="font-[var(--weight-medium)]">{member.guest_name}</p>
                        <p className="text-[length:var(--type-caption-1-size)] text-[var(--color-text-muted)]">{member.account_number}</p>
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="primary">{member.tier}</Badge></TableCell>
                    <TableCell align="right" className="tabular-nums">{member.points_balance.toLocaleString()}</TableCell>
                    <TableCell align="right" className="tabular-nums">{member.lifetime_points_earned.toLocaleString()}</TableCell>
                    <TableCell align="right" className="tabular-nums">{member.lifetime_points_redeemed.toLocaleString()}</TableCell>
                    <TableCell align="right" className="tabular-nums">{member.visits_count.toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState icon={Users} title="No loyalty members yet" description="Members appear after POS checkout enrollment or CRM enrollment." />
          )}
        </CardBody>
      </Card>
    </div>
  )
}
