'use client'

import {
  Receipt,
  ChefHat,
  CircleDollarSign,
  FileText,
  Tag,
  RotateCcw,
  X,
  Check,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import type { PrintJob, PrintJobType, PrintJobStatus } from '@/lib/printing/print-queue'

// ---------------------------------------------------------------------------
// Icon mapping for job types
// ---------------------------------------------------------------------------

const JOB_TYPE_ICONS: Record<PrintJobType, typeof Receipt> = {
  receipt: Receipt,
  kitchen_ticket: ChefHat,
  cash_drawer: CircleDollarSign,
  test_page: FileText,
  label: Tag,
}

const JOB_TYPE_LABELS: Record<PrintJobType, string> = {
  receipt: 'Receipt',
  kitchen_ticket: 'Kitchen Ticket',
  cash_drawer: 'Cash Drawer',
  test_page: 'Test Print',
  label: 'Label',
}

// ---------------------------------------------------------------------------
// Status rendering
// ---------------------------------------------------------------------------

function StatusIndicator({ status }: { status: PrintJobStatus }) {
  switch (status) {
    case 'printing':
    case 'queued':
      return (
        <div className="flex items-center gap-1.5">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--color-primary)]" />
          <span className="text-xs font-medium text-[var(--color-primary)]">
            {status === 'printing' ? 'Printing' : 'Queued'}
          </span>
        </div>
      )
    case 'printed':
      return (
        <div className="flex items-center gap-1.5">
          <Check className="h-3.5 w-3.5 text-[var(--color-success-strong)]" />
          <span className="text-xs font-medium text-[var(--color-success-strong)]">Printed</span>
        </div>
      )
    case 'failed':
      return (
        <div className="flex items-center gap-1.5">
          <AlertCircle className="h-3.5 w-3.5 text-[var(--color-danger-strong)]" />
          <span className="text-xs font-medium text-[var(--color-danger-strong)]">Failed</span>
        </div>
      )
    case 'cancelled':
      return (
        <div className="flex items-center gap-1.5">
          <X className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />
          <span className="text-xs font-medium text-[var(--color-text-muted)]">Cancelled</span>
        </div>
      )
  }
}

// ---------------------------------------------------------------------------
// Time formatting
// ---------------------------------------------------------------------------

function formatRelativeTime(isoDate: string): string {
  const now = Date.now()
  const then = new Date(isoDate).getTime()
  const diffMs = now - then

  if (diffMs < 60_000) return 'just now'
  if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)}m ago`
  if (diffMs < 86_400_000) return `${Math.floor(diffMs / 3_600_000)}h ago`
  return new Date(isoDate).toLocaleDateString()
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface PrintQueueItemProps {
  job: PrintJob
  onRetry: (jobId: string) => void
  onCancel: (jobId: string) => void
}

export function PrintQueueItem({ job, onRetry, onCancel }: PrintQueueItemProps) {
  const Icon = JOB_TYPE_ICONS[job.job_type] ?? FileText
  const typeLabel = JOB_TYPE_LABELS[job.job_type] ?? 'Print Job'
  const isFailed = job.status === 'failed'
  const canRetry = isFailed
  const canCancel = job.status === 'queued' || isFailed

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors',
        isFailed && 'border-l-[3px] border-l-[var(--color-danger-strong)] bg-[var(--color-danger-strong)]/[0.04]',
        !isFailed && 'hover:bg-black/[0.02]'
      )}
    >
      {/* Type icon */}
      <div
        className={cn(
          'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
          isFailed ? 'bg-[var(--color-danger-strong)]/10 text-[var(--color-danger-strong)]' : 'bg-black/[0.04] text-[var(--color-text-secondary)]'
        )}
      >
        <Icon className="h-4 w-4" strokeWidth={1.8} />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium text-[var(--color-text)]">
            {typeLabel}
          </span>
          <StatusIndicator status={job.status} />
        </div>

        <p className="mt-0.5 truncate text-xs text-[var(--color-text-muted)]">
          {job.printer_name}
        </p>

        {/* Error message for failed jobs */}
        {isFailed && job.error_message && (
          <p className="mt-1 text-xs text-[var(--color-danger-strong)]">
            {job.error_message}
          </p>
        )}

        {/* Timestamp + actions row */}
        <div className="mt-1.5 flex items-center justify-between">
          <span className="text-[11px] text-[var(--gray-400)]">
            {formatRelativeTime(job.created_at)}
          </span>

          {(canRetry || canCancel) && (
            <div className="flex items-center gap-1">
              {canRetry && (
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => onRetry(job.id)}
                  className="h-6 gap-1 px-2 text-[var(--color-primary)]"
                >
                  <RotateCcw className="h-3 w-3" />
                  Retry
                </Button>
              )}
              {canCancel && (
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => onCancel(job.id)}
                  className="h-6 gap-1 px-2 text-[var(--color-danger-strong)]"
                >
                  <X className="h-3 w-3" />
                  Cancel
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
