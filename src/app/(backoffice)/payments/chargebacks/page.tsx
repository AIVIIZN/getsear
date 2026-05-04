'use client'

import { useState, useEffect, useCallback } from 'react'
import { cn, formatMoney, formatDate } from '@/lib/utils'
import { Button } from '@/components/ui-v2/Button'
import { Badge, type BadgeProps } from '@/components/ui-v2/data/Badge'
import { Card } from '@/components/ui-v2/Card'
import { Skeleton } from '@/components/ui-v2/data/Skeleton'
import { EmptyState } from '@/components/ui-v2/feedback/EmptyState'
import { Textarea } from '@/components/ui-v2/inputs/Textarea'
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Upload,
  FileText,
  ChevronRight,
  ArrowLeft,
  Shield,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChargebackCase {
  id: string
  payment_id: string | null
  processor_dispute_id: string
  reason_code: string
  reason_description: string | null
  amount: string
  amount_cents: number
  received_at: string
  respond_by: string
  status: string
  evidence_submitted_at: string | null
  evidence: Record<string, unknown>[] | null
  resolved_at: string | null
  resolution: string | null
  days_remaining: number
  is_urgent: boolean
  is_expired: boolean
}

interface ChargebackStats {
  total: number
  open: number
  evidence_submitted: number
  won: number
  lost: number
  total_amount_cents: number
  total_lost_cents: number
}

type StatusFilter = 'all' | 'open' | 'evidence_submitted' | 'won' | 'lost'

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

function statusBadgeFor(
  status: string,
  isUrgent: boolean,
  isExpired: boolean,
): { variant: BadgeProps['variant']; icon: React.ReactNode; label: string } {
  if (isExpired) {
    return {
      variant: 'danger',
      icon: <XCircle className="h-3 w-3" />,
      label: 'Expired',
    }
  }
  switch (status) {
    case 'open':
      return {
        variant: isUrgent ? 'warning' : 'info',
        icon: isUrgent ? <AlertTriangle className="h-3 w-3" /> : <Clock className="h-3 w-3" />,
        label: isUrgent ? 'Urgent' : 'Open',
      }
    case 'evidence_submitted':
      return {
        variant: 'primary',
        icon: <FileText className="h-3 w-3" />,
        label: 'Responded',
      }
    case 'won':
      return {
        variant: 'success',
        icon: <CheckCircle2 className="h-3 w-3" />,
        label: 'Won',
      }
    case 'lost':
      return {
        variant: 'danger',
        icon: <XCircle className="h-3 w-3" />,
        label: 'Lost',
      }
    default:
      return { variant: 'default', icon: null, label: status }
  }
}

function StatusBadge({ status, isUrgent, isExpired }: { status: string; isUrgent: boolean; isExpired: boolean }) {
  const cfg = statusBadgeFor(status, isUrgent, isExpired)
  return (
    <Badge variant={cfg.variant}>
      {cfg.icon}
      {cfg.label}
    </Badge>
  )
}

function getRecommendedAction(reasonCode: string): { action: string; reasoning: string } {
  const fraudCodes = ['10.1', '10.2', '10.3', '10.4', '4837', '4863']
  const authCodes = ['10.5', '4834']

  if (fraudCodes.some((c) => reasonCode.includes(c))) {
    return {
      action: 'FIGHT',
      reasoning: 'EMV/chip transactions have strong evidence for dispute resolution.',
    }
  }
  if (authCodes.some((c) => reasonCode.includes(c))) {
    return {
      action: 'REVIEW',
      reasoning: 'Review the authorization details and transaction records.',
    }
  }
  return {
    action: 'REVIEW',
    reasoning: 'Gather evidence from POS records and decide whether to dispute.',
  }
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'evidence_submitted', label: 'Responded' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
]

export default function ChargebacksPage() {
  const [chargebacks, setChargebacks] = useState<ChargebackCase[]>([])
  const [stats, setStats] = useState<ChargebackStats | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [selectedCase, setSelectedCase] = useState<ChargebackCase | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchChargebacks = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') {
        params.set('status', statusFilter)
      }
      const res = await fetch(`/api/payments/chargebacks?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to fetch chargebacks')
      const json = await res.json()
      setChargebacks(json.data ?? [])
      setStats(json.stats ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load chargebacks')
    } finally {
      setIsLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    fetchChargebacks()
  }, [fetchChargebacks])

  if (selectedCase) {
    return (
      <ChargebackDetail
        chargebackCase={selectedCase}
        onBack={() => {
          setSelectedCase(null)
          fetchChargebacks()
        }}
      />
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-[var(--space-6)] py-[var(--space-3)] border-b border-[color:var(--color-border)]">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[length:var(--type-title-3-size)] font-[var(--weight-semibold)] text-[color:var(--color-text)]">Chargebacks</h1>
            <p className="text-[length:var(--type-subhead-size)] text-[color:var(--color-text-muted)] mt-[var(--space-1)]">
              Manage disputes and submit evidence
            </p>
          </div>
          <Shield className="h-6 w-6 text-[color:var(--color-text-muted)]" />
        </div>

        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-[var(--space-2)] mt-[var(--space-3)]">
            <StatCard label="Open" value={stats.open} color="var(--color-primary)" />
            <StatCard label="Won" value={stats.won} color="var(--color-success)" />
            <StatCard
              label="Lost"
              value={stats.lost}
              subValue={stats.total_lost_cents > 0 ? formatMoney(stats.total_lost_cents) : undefined}
              color="var(--color-danger)"
            />
            <StatCard label="Total Disputed" value={formatMoney(stats.total_amount_cents)} color="var(--color-text)" />
          </div>
        )}
      </div>

      <div className="px-[var(--space-6)] py-[var(--space-2)] border-b border-[color:var(--color-border)] flex gap-[var(--space-2)] overflow-x-auto">
        {STATUS_FILTERS.map((filter) => (
          <Button
            key={filter.value}
            size="sm"
            variant={statusFilter === filter.value ? 'primary' : 'secondary'}
            onClick={() => setStatusFilter(filter.value)}
          >
            {filter.label}
          </Button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-[var(--space-3)] space-y-[var(--space-2)]">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} variant="table-row" />)}
          </div>
        ) : error ? (
          <EmptyState icon={AlertTriangle} title="Couldn't load chargebacks" description={error} />
        ) : chargebacks.length === 0 ? (
          <EmptyState icon={Shield} title="No chargebacks found" description="Disputes will appear here once your processor reports them." />
        ) : (
          <div className="divide-y divide-[color:var(--color-border)]">
            {chargebacks.map((cb) => (
              <button
                key={cb.id}
                type="button"
                className={cn(
                  'btn-press w-full px-[var(--space-6)] py-[var(--space-3)]',
                  'flex items-center gap-[var(--space-3)] text-left',
                  'hover:bg-[color:var(--color-surface-hover)] transition-colors',
                )}
                onClick={() => setSelectedCase(cb)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-[var(--space-2)] mb-[var(--space-1)]">
                    <StatusBadge status={cb.status} isUrgent={cb.is_urgent} isExpired={cb.is_expired} />
                    <span className="text-[length:var(--type-caption-1-size)] text-[color:var(--color-text-muted)]">{cb.reason_code}</span>
                  </div>
                  <div className="text-[length:var(--type-subhead-size)] font-[var(--weight-medium)] text-[color:var(--color-text)] truncate">
                    {cb.reason_description ?? `Reason Code: ${cb.reason_code}`}
                  </div>
                  <div className="text-[length:var(--type-caption-1-size)] text-[color:var(--color-text-muted)] mt-[var(--space-1)]">
                    Received {formatDate(cb.received_at)}
                    {cb.status === 'open' && ` - ${cb.days_remaining} days to respond`}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-[length:var(--type-headline-size)] font-[var(--weight-semibold)] tabular-nums text-[color:var(--color-text)]">
                    {formatMoney(cb.amount_cents)}
                  </div>
                </div>

                <ChevronRight className="h-4 w-4 text-[color:var(--color-text-muted)] shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Stat Card
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  subValue,
  color,
}: {
  label: string
  value: number | string
  subValue?: string
  color: string
}) {
  return (
    <Card padding="compact">
      <div className="text-[length:var(--type-caption-1-size)] font-[var(--weight-medium)] text-[color:var(--color-text-muted)]">{label}</div>
      <div className="text-[length:var(--type-headline-size)] font-[var(--weight-bold)] tabular-nums mt-[var(--space-1)]" style={{ color }}>
        {value}
      </div>
      {subValue && (
        <div className="text-[length:var(--type-caption-1-size)] text-[color:var(--color-text-muted)] mt-[var(--space-1)]">{subValue}</div>
      )}
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Detail View
// ---------------------------------------------------------------------------

function ChargebackDetail({
  chargebackCase,
  onBack,
}: {
  chargebackCase: ChargebackCase
  onBack: () => void
}) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [evidenceText, setEvidenceText] = useState('')

  const recommendation = getRecommendedAction(chargebackCase.reason_code)
  const canRespond = ['open', 'evidence_submitted'].includes(chargebackCase.status)

  const handleSubmitEvidence = async () => {
    if (!evidenceText.trim()) return

    setIsSubmitting(true)
    setSubmitError(null)
    try {
      const res = await fetch('/api/payments/chargebacks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chargeback_id: chargebackCase.id,
          evidence_type: 'other',
          evidence_text: evidenceText,
          notes: 'Submitted from chargeback management UI',
        }),
      })

      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error ?? 'Failed to submit evidence')
      }

      setSubmitSuccess(true)
      setEvidenceText('')
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to submit')
    } finally {
      setIsSubmitting(false)
    }
  }

  const recommendationBg =
    recommendation.action === 'FIGHT'
      ? 'var(--color-success-bg)'
      : recommendation.action === 'ACCEPT'
        ? 'var(--color-danger-bg)'
        : 'var(--color-warning-bg)'
  const recommendationFg =
    recommendation.action === 'FIGHT'
      ? 'var(--color-success)'
      : recommendation.action === 'ACCEPT'
        ? 'var(--color-danger)'
        : 'var(--color-warning)'

  return (
    <div className="flex flex-col h-full">
      <div className="px-[var(--space-6)] py-[var(--space-3)] border-b border-[color:var(--color-border)]">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          leadingIcon={<ArrowLeft className="h-4 w-4" />}
          className="mb-[var(--space-2)]"
        >
          Back to chargebacks
        </Button>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[length:var(--type-headline-size)] font-[var(--weight-semibold)] text-[color:var(--color-text)]">Chargeback Detail</h2>
            <p className="text-[length:var(--type-subhead-size)] text-[color:var(--color-text-muted)] mt-[var(--space-1)]">
              Dispute {chargebackCase.processor_dispute_id}
            </p>
          </div>
          <StatusBadge status={chargebackCase.status} isUrgent={chargebackCase.is_urgent} isExpired={chargebackCase.is_expired} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-[var(--space-6)] py-[var(--space-3)] space-y-[var(--space-4)]">
        <div className="grid grid-cols-2 gap-[var(--space-3)]">
          <Card padding="default">
            <div className="text-[length:var(--type-caption-1-size)] font-[var(--weight-medium)] text-[color:var(--color-text-muted)]">Dispute Amount</div>
            <div className="text-[length:var(--type-title-2-size)] font-[var(--weight-bold)] tabular-nums text-[color:var(--color-text)] mt-[var(--space-1)]">
              {formatMoney(chargebackCase.amount_cents)}
            </div>
          </Card>
          <Card padding="default">
            <div className="text-[length:var(--type-caption-1-size)] font-[var(--weight-medium)] text-[color:var(--color-text-muted)]">Respond By</div>
            <div
              className="text-[length:var(--type-headline-size)] font-[var(--weight-semibold)] mt-[var(--space-1)]"
              style={{ color: chargebackCase.is_urgent ? 'var(--color-danger)' : 'var(--color-text)' }}
            >
              {formatDate(chargebackCase.respond_by)}
            </div>
            <div className="text-[length:var(--type-caption-1-size)] text-[color:var(--color-text-muted)] mt-[var(--space-1)]">
              {chargebackCase.days_remaining} days remaining
            </div>
          </Card>
        </div>

        <Card padding="default">
          <div className="text-[length:var(--type-caption-1-size)] font-[var(--weight-medium)] text-[color:var(--color-text-muted)] mb-[var(--space-1)]">Reason</div>
          <div className="text-[length:var(--type-subhead-size)] font-[var(--weight-medium)] text-[color:var(--color-text)]">{chargebackCase.reason_code}</div>
          {chargebackCase.reason_description && (
            <div className="text-[length:var(--type-subhead-size)] text-[color:var(--color-text-muted)] mt-[var(--space-1)]">
              {chargebackCase.reason_description}
            </div>
          )}
        </Card>

        <div
          className="rounded-[var(--radius-md)] border p-[var(--space-3)]"
          style={{ backgroundColor: recommendationBg, borderColor: recommendationFg }}
        >
          <div className="text-[length:var(--type-caption-1-size)] font-[var(--weight-medium)] text-[color:var(--color-text-muted)] mb-[var(--space-1)]">
            Recommended Action
          </div>
          <div className="text-[length:var(--type-subhead-size)] font-[var(--weight-semibold)]" style={{ color: recommendationFg }}>
            {recommendation.action}
          </div>
          <div className="text-[length:var(--type-subhead-size)] text-[color:var(--color-text-muted)] mt-[var(--space-1)]">
            {recommendation.reasoning}
          </div>
        </div>

        {chargebackCase.evidence && (chargebackCase.evidence as unknown[]).length > 0 && (
          <Card padding="default">
            <div className="text-[length:var(--type-caption-1-size)] font-[var(--weight-medium)] text-[color:var(--color-text-muted)] mb-[var(--space-2)]">
              Submitted Evidence
            </div>
            <div className="space-y-[var(--space-2)]">
              {(chargebackCase.evidence as Record<string, unknown>[]).map((ev, i) => (
                <div
                  key={i}
                  className="text-[length:var(--type-subhead-size)] text-[color:var(--color-text-muted)] p-[var(--space-2)] bg-[color:var(--color-bg-subtle)] rounded-[var(--radius-sm)]"
                >
                  <span className="font-[var(--weight-medium)]">{ev.type as string}:</span>{' '}
                  {(ev.text as string) ?? (ev.url as string) ?? 'File uploaded'}
                  <div className="text-[length:var(--type-caption-1-size)] text-[color:var(--color-text-muted)] mt-[var(--space-1)]">
                    {ev.submitted_at ? formatDate(ev.submitted_at as string) : ''}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {canRespond && (
          <Card padding="default">
            <div className="text-[length:var(--type-caption-1-size)] font-[var(--weight-medium)] text-[color:var(--color-text-muted)] mb-[var(--space-2)]">
              Submit Evidence
            </div>

            {submitSuccess && (
              <div className="mb-[var(--space-3)] p-[var(--space-2)] bg-[color:var(--color-success-bg)] border border-[color:var(--color-success)] rounded-[var(--radius-sm)] text-[length:var(--type-subhead-size)] text-[color:var(--color-success)]">
                Evidence submitted successfully.
              </div>
            )}

            {submitError && (
              <div className="mb-[var(--space-3)] p-[var(--space-2)] bg-[color:var(--color-danger-bg)] border border-[color:var(--color-danger)] rounded-[var(--radius-sm)] text-[length:var(--type-subhead-size)] text-[color:var(--color-danger)]">
                {submitError}
              </div>
            )}

            <Textarea
              value={evidenceText}
              onChange={(e) => setEvidenceText(e.target.value)}
              placeholder="Describe the evidence (transaction details, customer interactions, etc.)"
              rows={4}
            />

            <div className="flex gap-[var(--space-2)] mt-[var(--space-3)]">
              <Button variant="secondary" size="lg" disabled leadingIcon={<Upload className="h-4 w-4" />}>
                Upload File
              </Button>
              <Button
                size="lg"
                className="flex-1"
                onClick={handleSubmitEvidence}
                disabled={isSubmitting || !evidenceText.trim()}
                loading={isSubmitting}
              >
                Submit Evidence
              </Button>
            </div>
          </Card>
        )}

        {chargebackCase.resolution && (
          <div
            className="rounded-[var(--radius-md)] border p-[var(--space-3)]"
            style={{
              backgroundColor: chargebackCase.resolution === 'won' ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
              borderColor: chargebackCase.resolution === 'won' ? 'var(--color-success)' : 'var(--color-danger)',
            }}
          >
            <div className="text-[length:var(--type-caption-1-size)] font-[var(--weight-medium)] text-[color:var(--color-text-muted)] mb-[var(--space-1)]">Resolution</div>
            <div
              className="text-[length:var(--type-subhead-size)] font-[var(--weight-semibold)]"
              style={{ color: chargebackCase.resolution === 'won' ? 'var(--color-success)' : 'var(--color-danger)' }}
            >
              {chargebackCase.resolution === 'won' ? 'Won - Funds returned' : 'Lost - Funds deducted'}
            </div>
            {chargebackCase.resolved_at && (
              <div className="text-[length:var(--type-caption-1-size)] text-[color:var(--color-text-muted)] mt-[var(--space-1)]">
                Resolved {formatDate(chargebackCase.resolved_at)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
