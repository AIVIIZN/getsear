'use client'

import { useState, useEffect, useCallback } from 'react'
import { cn, formatMoney, formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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

function getStatusBadge(status: string, isUrgent: boolean, isExpired: boolean) {
  if (isExpired) {
    return (
      <Badge className="bg-red-100 text-red-700 border-red-200">
        <XCircle className="size-3 mr-1" />
        Expired
      </Badge>
    )
  }

  switch (status) {
    case 'open':
      return (
        <Badge className={cn(
          'border',
          isUrgent
            ? 'bg-amber-100 text-amber-700 border-amber-200'
            : 'bg-blue-50 text-blue-700 border-blue-200'
        )}>
          {isUrgent ? (
            <AlertTriangle className="size-3 mr-1" />
          ) : (
            <Clock className="size-3 mr-1" />
          )}
          {isUrgent ? 'Urgent' : 'Open'}
        </Badge>
      )
    case 'evidence_submitted':
      return (
        <Badge className="bg-purple-50 text-purple-700 border border-purple-200">
          <FileText className="size-3 mr-1" />
          Responded
        </Badge>
      )
    case 'won':
      return (
        <Badge className="bg-green-50 text-green-700 border border-green-200">
          <CheckCircle2 className="size-3 mr-1" />
          Won
        </Badge>
      )
    case 'lost':
      return (
        <Badge className="bg-red-50 text-red-700 border border-red-200">
          <XCircle className="size-3 mr-1" />
          Lost
        </Badge>
      )
    default:
      return (
        <Badge className="bg-stone-100 text-stone-600 border border-stone-200">
          {status}
        </Badge>
      )
  }
}

function getRecommendedAction(reasonCode: string): { action: string; reasoning: string } {
  // Common chargeback reason code categories
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

  // Detail view
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
      {/* Header */}
      <div className="px-6 py-4 border-b border-stone-200">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-stone-900">Chargebacks</h1>
            <p className="text-sm text-stone-500 mt-0.5">
              Manage disputes and submit evidence
            </p>
          </div>
          <Shield className="size-6 text-stone-400" />
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
            <StatCard
              label="Open"
              value={stats.open}
              color="text-blue-600"
            />
            <StatCard
              label="Won"
              value={stats.won}
              color="text-green-600"
            />
            <StatCard
              label="Lost"
              value={stats.lost}
              subValue={stats.total_lost_cents > 0 ? formatMoney(stats.total_lost_cents) : undefined}
              color="text-red-600"
            />
            <StatCard
              label="Total Disputed"
              value={formatMoney(stats.total_amount_cents)}
              isMonetary
              color="text-stone-700"
            />
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="px-6 py-3 border-b border-stone-100 flex gap-2 overflow-x-auto">
        {(['all', 'open', 'evidence_submitted', 'won', 'lost'] as StatusFilter[]).map((filter) => (
          <button
            key={filter}
            type="button"
            onClick={() => setStatusFilter(filter)}
            className={cn(
              'px-3 py-1.5 text-sm font-medium rounded-lg whitespace-nowrap transition-colors',
              statusFilter === filter
                ? 'bg-stone-900 text-white'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            )}
          >
            {filter === 'all'
              ? 'All'
              : filter === 'evidence_submitted'
                ? 'Responded'
                : filter.charAt(0).toUpperCase() + filter.slice(1)}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-sm text-stone-500">Loading chargebacks...</div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-sm text-red-600">{error}</div>
          </div>
        ) : chargebacks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Shield className="size-10 text-stone-300 mb-3" />
            <p className="text-sm text-stone-500">No chargebacks found</p>
          </div>
        ) : (
          <div className="divide-y divide-stone-100">
            {chargebacks.map((cb) => (
              <button
                key={cb.id}
                type="button"
                className="w-full px-6 py-4 flex items-center gap-4 hover:bg-stone-50 active:bg-stone-100 transition-colors text-left"
                onClick={() => setSelectedCase(cb)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {getStatusBadge(cb.status, cb.is_urgent, cb.is_expired)}
                    <span className="text-xs text-stone-400">
                      {cb.reason_code}
                    </span>
                  </div>
                  <div className="text-sm font-medium text-stone-900 truncate">
                    {cb.reason_description ?? `Reason Code: ${cb.reason_code}`}
                  </div>
                  <div className="text-xs text-stone-500 mt-0.5">
                    Received {formatDate(cb.received_at)}
                    {cb.status === 'open' && ` - ${cb.days_remaining} days to respond`}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-base font-semibold tabular-nums text-stone-900">
                    {formatMoney(cb.amount_cents)}
                  </div>
                </div>

                <ChevronRight className="size-4 text-stone-400 shrink-0" />
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
  isMonetary,
}: {
  label: string
  value: number | string
  subValue?: string
  color: string
  isMonetary?: boolean
}) {
  return (
    <div className="bg-white rounded-lg border border-stone-200 p-3">
      <div className="text-xs font-medium text-stone-500">{label}</div>
      <div className={cn('text-lg font-bold tabular-nums mt-0.5', color)}>
        {isMonetary ? value : value}
      </div>
      {subValue && (
        <div className="text-xs text-stone-400 mt-0.5">{subValue}</div>
      )}
    </div>
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

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-stone-200">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-stone-500 hover:text-stone-700 mb-2"
        >
          <ArrowLeft className="size-4" />
          Back to chargebacks
        </button>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-stone-900">
              Chargeback Detail
            </h2>
            <p className="text-sm text-stone-500 mt-0.5">
              Dispute {chargebackCase.processor_dispute_id}
            </p>
          </div>
          {getStatusBadge(
            chargebackCase.status,
            chargebackCase.is_urgent,
            chargebackCase.is_expired
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
        {/* Amount & Dates */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-lg border border-stone-200 p-4">
            <div className="text-xs font-medium text-stone-500">Dispute Amount</div>
            <div className="text-2xl font-bold tabular-nums text-stone-900 mt-1">
              {formatMoney(chargebackCase.amount_cents)}
            </div>
          </div>
          <div className="bg-white rounded-lg border border-stone-200 p-4">
            <div className="text-xs font-medium text-stone-500">Respond By</div>
            <div className={cn(
              'text-lg font-semibold mt-1',
              chargebackCase.is_urgent ? 'text-red-600' : 'text-stone-900'
            )}>
              {formatDate(chargebackCase.respond_by)}
            </div>
            <div className="text-xs text-stone-500 mt-0.5">
              {chargebackCase.days_remaining} days remaining
            </div>
          </div>
        </div>

        {/* Reason */}
        <div className="bg-white rounded-lg border border-stone-200 p-4">
          <div className="text-xs font-medium text-stone-500 mb-1">Reason</div>
          <div className="text-sm font-medium text-stone-900">
            {chargebackCase.reason_code}
          </div>
          {chargebackCase.reason_description && (
            <div className="text-sm text-stone-600 mt-1">
              {chargebackCase.reason_description}
            </div>
          )}
        </div>

        {/* Recommendation */}
        <div className={cn(
          'rounded-lg border p-4',
          recommendation.action === 'FIGHT'
            ? 'bg-green-50 border-green-200'
            : recommendation.action === 'ACCEPT'
              ? 'bg-red-50 border-red-200'
              : 'bg-amber-50 border-amber-200'
        )}>
          <div className="text-xs font-medium text-stone-500 mb-1">
            Recommended Action
          </div>
          <div className={cn(
            'text-sm font-semibold',
            recommendation.action === 'FIGHT'
              ? 'text-green-700'
              : recommendation.action === 'ACCEPT'
                ? 'text-red-700'
                : 'text-amber-700'
          )}>
            {recommendation.action}
          </div>
          <div className="text-sm text-stone-600 mt-1">
            {recommendation.reasoning}
          </div>
        </div>

        {/* Evidence */}
        {chargebackCase.evidence && (chargebackCase.evidence as unknown[]).length > 0 && (
          <div className="bg-white rounded-lg border border-stone-200 p-4">
            <div className="text-xs font-medium text-stone-500 mb-2">
              Submitted Evidence
            </div>
            <div className="space-y-2">
              {(chargebackCase.evidence as Record<string, unknown>[]).map((ev, i) => (
                <div
                  key={i}
                  className="text-sm text-stone-600 p-2 bg-stone-50 rounded"
                >
                  <span className="font-medium">{ev.type as string}:</span>{' '}
                  {(ev.text as string) ?? (ev.url as string) ?? 'File uploaded'}
                  <div className="text-xs text-stone-400 mt-0.5">
                    {ev.submitted_at ? formatDate(ev.submitted_at as string) : ''}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Submit Evidence */}
        {canRespond && (
          <div className="bg-white rounded-lg border border-stone-200 p-4">
            <div className="text-xs font-medium text-stone-500 mb-2">
              Submit Evidence
            </div>

            {submitSuccess && (
              <div className="mb-3 p-2 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                Evidence submitted successfully.
              </div>
            )}

            {submitError && (
              <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {submitError}
              </div>
            )}

            <textarea
              value={evidenceText}
              onChange={(e) => setEvidenceText(e.target.value)}
              placeholder="Describe the evidence (transaction details, customer interactions, etc.)"
              className="w-full h-24 p-3 text-sm border border-stone-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500"
            />

            <div className="flex gap-2 mt-3">
              <Button
                variant="outline"
                size="lg"
                className="h-11"
                disabled
              >
                <Upload className="size-4 mr-1.5" />
                Upload File
              </Button>
              <Button
                size="lg"
                className="h-11 flex-1"
                onClick={handleSubmitEvidence}
                disabled={isSubmitting || !evidenceText.trim()}
              >
                {isSubmitting ? 'Submitting...' : 'Submit Evidence'}
              </Button>
            </div>
          </div>
        )}

        {/* Resolution */}
        {chargebackCase.resolution && (
          <div className={cn(
            'rounded-lg border p-4',
            chargebackCase.resolution === 'won'
              ? 'bg-green-50 border-green-200'
              : 'bg-red-50 border-red-200'
          )}>
            <div className="text-xs font-medium text-stone-500 mb-1">Resolution</div>
            <div className={cn(
              'text-sm font-semibold',
              chargebackCase.resolution === 'won' ? 'text-green-700' : 'text-red-700'
            )}>
              {chargebackCase.resolution === 'won' ? 'Won - Funds returned' : 'Lost - Funds deducted'}
            </div>
            {chargebackCase.resolved_at && (
              <div className="text-xs text-stone-500 mt-1">
                Resolved {formatDate(chargebackCase.resolved_at)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
