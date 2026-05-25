'use client'

import * as React from 'react'
import { AlertTriangle, CheckCircle2, ClipboardCheck, DatabaseZap, RefreshCw, SearchX, ShieldCheck, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui-v2/Button'
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from '@/components/ui-v2/Card'
import { Badge } from '@/components/ui-v2/data/Badge'
import { Skeleton } from '@/components/ui-v2/data/Skeleton'
import { EmptyState } from '@/components/ui-v2/feedback/EmptyState'
import { Select } from '@/components/ui-v2/inputs/Select'
import { cn } from '@/lib/utils'

type HealthIssue = {
  id: string
  issue_type: string
  title: string
  description: string
  status: 'open' | 'review_required' | 'approved' | 'resolved' | 'dismissed'
  severity: 'critical' | 'high' | 'medium' | 'low'
  impact_score: number
  affected_record_count: number
  affected_table: string
  evidence: Record<string, unknown>
  fix_strategy: string
  fix_preview: Record<string, unknown>
  ai_suggestion: { confidence?: string; recommendation?: string }
  updated_at: string
}

type HealthRun = {
  id: string
  completed_at?: string | null
  issue_counts?: Record<string, number>
  impact_score?: number
}

const issueTypes = [
  'duplicate_rate',
  'no_contact',
  'missing_consent',
  'invalid_email',
  'invalid_phone',
  'weak_identity',
  'old_inactive_segment',
  'broken_automation',
  'failed_send',
]

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init)
  const json = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(json.error ?? 'Request failed')
  return json as T
}

function titleCase(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function formatDateTime(value?: string | null) {
  if (!value) return 'Not yet'
  return new Date(value).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function severityVariant(severity: HealthIssue['severity']) {
  if (severity === 'critical' || severity === 'high') return 'danger'
  if (severity === 'medium') return 'warning'
  return 'default'
}

function statusVariant(status: HealthIssue['status']) {
  if (status === 'resolved' || status === 'approved') return 'success'
  if (status === 'dismissed') return 'default'
  return 'warning'
}

export default function CrmHealthPage() {
  const [issues, setIssues] = React.useState<HealthIssue[]>([])
  const [latestRun, setLatestRun] = React.useState<HealthRun | null>(null)
  const [state, setState] = React.useState<'loading' | 'ready' | 'error' | 'permission'>('loading')
  const [actionState, setActionState] = React.useState<string | null>(null)
  const [statusFilter, setStatusFilter] = React.useState('review_required')
  const [typeFilter, setTypeFilter] = React.useState('')
  const didInitialScan = React.useRef(false)

  const loadHealth = React.useCallback(async (scan = false) => {
    setState('loading')
    const params = new URLSearchParams({ include_scan: String(scan), limit: '50' })
    if (statusFilter) params.set('status', statusFilter)
    if (typeFilter) params.set('type', typeFilter)

    try {
      const json = await fetchJson<{ data: HealthIssue[]; latest_run: HealthRun | null }>(`/api/crm/health?${params.toString()}`)
      setIssues(json.data)
      setLatestRun(json.latest_run)
      setState('ready')
    } catch (error) {
      setState(error instanceof Error && /Forbidden|Unauthorized/i.test(error.message) ? 'permission' : 'error')
    }
  }, [statusFilter, typeFilter])

  React.useEffect(() => {
    const shouldScan = !didInitialScan.current
    didInitialScan.current = true
    loadHealth(shouldScan)
  }, [loadHealth])

  async function reviewIssue(issue: HealthIssue, action: 'approve_fix' | 'resolve' | 'dismiss') {
    setActionState(`${issue.id}:${action}`)
    try {
      await fetchJson('/api/crm/health', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          issue_id: issue.id,
          action,
          review_note: action === 'approve_fix' ? 'Reviewed preview and approved safe cleanup queue.' : null,
          metadata: { source: 'crm_health_page', fix_strategy: issue.fix_strategy },
        }),
      })
      await loadHealth(false)
    } finally {
      setActionState(null)
    }
  }

  const totals = issues.reduce(
    (acc, issue) => {
      acc.records += issue.affected_record_count
      if (issue.severity === 'critical' || issue.severity === 'high') acc.high += 1
      if (issue.status === 'review_required') acc.review += 1
      return acc
    },
    { records: 0, high: 0, review: 0 },
  )

  return (
    <div className="flex flex-col gap-[var(--space-6)]">
      <div className="flex flex-col gap-[var(--space-4)] lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-[length:var(--type-title-1-size)] font-[var(--weight-semibold)] leading-[var(--type-line-height-tight)] text-[color:var(--color-text)]">
            CRM Health
          </h1>
          <p className="mt-[var(--space-1)] max-w-3xl text-[length:var(--type-subhead-size)] text-[color:var(--color-text-muted)]">
            Ranked data-quality issues across guests, consent, identities, segments, automations, and sends with review-gated cleanup previews.
          </p>
        </div>
        <Button variant="secondary" size="md" onClick={() => loadHealth(true)} leadingIcon={<RefreshCw />}>
          Run scan
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-[var(--space-4)] md:grid-cols-4">
        {[
          ['Open issues', issues.length],
          ['Needs review', totals.review],
          ['High impact', totals.high],
          ['Records affected', totals.records],
        ].map(([label, value]) => (
          <Card key={label} padding="compact">
            <p className="text-[length:var(--type-caption-1-size)] font-[var(--weight-medium)] text-[color:var(--color-text-muted)]">{label}</p>
            <p className="text-[length:var(--type-title-2-size)] font-[var(--weight-semibold)] text-[color:var(--color-text)]">{value}</p>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex-col gap-[var(--space-3)] lg:flex-row lg:items-end lg:justify-between">
          <div>
            <CardTitle>Issue queue</CardTitle>
            <CardDescription>
              Last scan: {formatDateTime(latestRun?.completed_at)}. Safe fixes stay in preview until an owner or manager reviews them.
            </CardDescription>
          </div>
          <div className="grid w-full grid-cols-1 gap-[var(--space-3)] md:grid-cols-2 lg:w-[520px]">
            <Select
              label="Status"
              value={statusFilter}
              options={[
                { value: '', label: 'All statuses' },
                { value: 'review_required', label: 'Needs review' },
                { value: 'approved', label: 'Approved' },
                { value: 'resolved', label: 'Resolved' },
                { value: 'dismissed', label: 'Dismissed' },
              ]}
              onChange={setStatusFilter}
            />
            <Select
              label="Issue type"
              value={typeFilter}
              options={[{ value: '', label: 'All issue types' }, ...issueTypes.map((type) => ({ value: type, label: titleCase(type) }))]}
              onChange={setTypeFilter}
            />
          </div>
        </CardHeader>
        <CardBody>
          {state === 'loading' ? (
            <div className="grid grid-cols-1 gap-[var(--space-4)] xl:grid-cols-2">
              <Skeleton variant="card" />
              <Skeleton variant="card" />
            </div>
          ) : state === 'permission' ? (
            <EmptyState icon={ShieldCheck} title="CRM health access is restricted" description="Ask an owner or admin to review CRM data quality and cleanup previews." />
          ) : state === 'error' ? (
            <EmptyState icon={AlertTriangle} title="CRM health scan unavailable" description="Refresh after the data-quality service is reachable." action={{ label: 'Retry', onClick: () => loadHealth(true) }} />
          ) : issues.length === 0 ? (
            <EmptyState icon={CheckCircle2} title="No matching CRM health issues" description="Run a fresh scan or clear filters to review the full data-quality queue." action={{ label: 'Run scan', onClick: () => loadHealth(true) }} />
          ) : (
            <div className="grid grid-cols-1 gap-[var(--space-4)] xl:grid-cols-2">
              {issues.map((issue, index) => (
                <Card key={issue.id} className={cn(index === 0 && 'border-[color:var(--color-warning)]')}>
                  <CardHeader className="flex-row items-start justify-between gap-[var(--space-3)]">
                    <div>
                      <div className="mb-[var(--space-2)] flex flex-wrap items-center gap-[var(--space-2)]">
                        <Badge variant={severityVariant(issue.severity)} shape="pill">{issue.severity}</Badge>
                        <Badge variant={statusVariant(issue.status)} shape="pill">{titleCase(issue.status)}</Badge>
                        <Badge variant="default" shape="pill">{titleCase(issue.issue_type)}</Badge>
                      </div>
                      <CardTitle>{issue.title}</CardTitle>
                      <CardDescription>{issue.description}</CardDescription>
                    </div>
                    <div className="flex h-[56px] w-[64px] shrink-0 flex-col items-center justify-center rounded-[var(--radius-sm)] bg-[color:var(--color-bg-muted)]">
                      <span className="text-[length:var(--type-title-3-size)] font-[var(--weight-semibold)] text-[color:var(--color-text)]">{Math.round(issue.impact_score)}</span>
                      <span className="text-[length:var(--type-caption-2-size)] text-[color:var(--color-text-muted)]">impact</span>
                    </div>
                  </CardHeader>
                  <CardBody>
                    <div className="grid grid-cols-3 gap-[var(--space-3)]">
                      {[
                        ['Records', issue.affected_record_count],
                        ['Table', issue.affected_table],
                        ['Strategy', titleCase(issue.fix_strategy)],
                      ].map(([label, value]) => (
                        <div key={label} className="rounded-[var(--radius-sm)] bg-[color:var(--color-bg-muted)] p-[var(--space-3)]">
                          <p className="text-[length:var(--type-caption-2-size)] text-[color:var(--color-text-muted)]">{label}</p>
                          <p className="mt-[var(--space-1)] truncate text-[length:var(--type-footnote-size)] font-[var(--weight-semibold)] text-[color:var(--color-text)]">{value}</p>
                        </div>
                      ))}
                    </div>
                    <div className="rounded-[var(--radius-sm)] border border-[color:var(--color-border)] p-[var(--space-3)]">
                      <div className="mb-[var(--space-2)] flex items-center gap-[var(--space-2)] text-[length:var(--type-caption-1-size)] font-[var(--weight-semibold)] text-[color:var(--color-text)]">
                        <Sparkles className="h-4 w-4" />
                        Safe fix preview
                      </div>
                      <p className="text-[length:var(--type-footnote-size)] text-[color:var(--color-text-muted)]">
                        {issue.ai_suggestion?.recommendation ?? 'Review evidence before approving this cleanup.'}
                      </p>
                      <pre className="mt-[var(--space-3)] max-h-[140px] overflow-auto rounded-[var(--radius-sm)] bg-[color:var(--color-bg-muted)] p-[var(--space-3)] text-[length:var(--type-caption-1-size)] text-[color:var(--color-text)]">
                        {JSON.stringify(issue.fix_preview, null, 2)}
                      </pre>
                    </div>
                    <div className="flex flex-wrap gap-[var(--space-2)]">
                      <Button
                        size="sm"
                        leadingIcon={<ClipboardCheck />}
                        loading={actionState === `${issue.id}:approve_fix`}
                        disabled={issue.status === 'approved' || issue.status === 'resolved'}
                        onClick={() => reviewIssue(issue, 'approve_fix')}
                      >
                        Approve preview
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        leadingIcon={<DatabaseZap />}
                        loading={actionState === `${issue.id}:resolve`}
                        disabled={issue.status === 'resolved'}
                        onClick={() => reviewIssue(issue, 'resolve')}
                      >
                        Mark resolved
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        leadingIcon={<SearchX />}
                        loading={actionState === `${issue.id}:dismiss`}
                        disabled={issue.status === 'dismissed'}
                        onClick={() => reviewIssue(issue, 'dismiss')}
                      >
                        Dismiss
                      </Button>
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  )
}
