'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Printer,
  RefreshCw,
  RotateCcw,
  Filter,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
  Loader2,
  FileText,
} from 'lucide-react'
import type {
  PrintJobRecord,
  PrintJobType,
  PrintJobStatus,
} from '@/lib/printing/print-job-logger'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PrintJobHistoryProps {
  orgId: string
  locationId?: string
}

interface PrintJobHistoryResponse {
  data: {
    jobs: PrintJobRecord[]
    total: number
  }
}

// ---------------------------------------------------------------------------
// Status badge component
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: PrintJobStatus }) {
  const variants: Record<PrintJobStatus, { icon: typeof CheckCircle2; className: string; label: string }> = {
    pending: {
      icon: Clock,
      className: 'bg-amber-50 text-amber-700 border-amber-200',
      label: 'Pending',
    },
    sending: {
      icon: Loader2,
      className: 'bg-blue-50 text-blue-700 border-blue-200',
      label: 'Sending',
    },
    completed: {
      icon: CheckCircle2,
      className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      label: 'Completed',
    },
    failed: {
      icon: XCircle,
      className: 'bg-red-50 text-red-700 border-red-200',
      label: 'Failed',
    },
    cancelled: {
      icon: XCircle,
      className: 'bg-neutral-50 text-neutral-500 border-neutral-200',
      label: 'Cancelled',
    },
  }

  const variant = variants[status]
  const Icon = variant.icon

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${variant.className}`}
    >
      <Icon className={`h-3 w-3 ${status === 'sending' ? 'animate-spin' : ''}`} />
      {variant.label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Job type badge
// ---------------------------------------------------------------------------

function JobTypeBadge({ type }: { type: PrintJobType }) {
  const labels: Record<PrintJobType, string> = {
    receipt: 'Receipt',
    kitchen: 'Kitchen',
    void: 'Void',
    kds_failover: 'KDS Failover',
    bar: 'Bar',
    label: 'Label',
    report: 'Report',
  }

  const colors: Record<PrintJobType, string> = {
    receipt: 'bg-blue-50 text-blue-700',
    kitchen: 'bg-orange-50 text-orange-700',
    void: 'bg-red-50 text-red-700',
    kds_failover: 'bg-amber-50 text-amber-700',
    bar: 'bg-purple-50 text-purple-700',
    label: 'bg-neutral-50 text-neutral-600',
    report: 'bg-emerald-50 text-emerald-700',
  }

  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${colors[type]}`}>
      {labels[type]}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function PrintJobHistory({ orgId, locationId }: PrintJobHistoryProps) {
  const [jobs, setJobs] = useState<PrintJobRecord[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [reprinting, setReprinting] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const pageSize = 20

  // Filters
  const [filterType, setFilterType] = useState<PrintJobType | ''>('')
  const [filterStatus, setFilterStatus] = useState<PrintJobStatus | ''>('')
  const [filterStartDate, setFilterStartDate] = useState('')
  const [filterEndDate, setFilterEndDate] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  const totalPages = Math.ceil(total / pageSize)

  const fetchJobs = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        org_id: orgId,
        page: page.toString(),
        page_size: pageSize.toString(),
      })

      if (locationId) params.set('location_id', locationId)
      if (filterType) params.set('job_type', filterType)
      if (filterStatus) params.set('status', filterStatus)
      if (filterStartDate) params.set('start_date', filterStartDate)
      if (filterEndDate) params.set('end_date', filterEndDate)

      const res = await fetch(`/api/settings/print-jobs?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to fetch print jobs')

      const json: PrintJobHistoryResponse = await res.json()
      setJobs(json.data.jobs)
      setTotal(json.data.total)
    } catch (err) {
      console.error('[PrintJobHistory] Fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [orgId, locationId, page, filterType, filterStatus, filterStartDate, filterEndDate])

  useEffect(() => {
    fetchJobs()
  }, [fetchJobs])

  const handleReprint = async (jobId: string) => {
    setReprinting(jobId)
    try {
      const res = await fetch('/api/settings/print-jobs/reprint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_id: jobId }),
      })

      if (!res.ok) throw new Error('Failed to reprint')

      // Refresh the list to show the new reprint job
      await fetchJobs()
    } catch (err) {
      console.error('[PrintJobHistory] Reprint error:', err)
    } finally {
      setReprinting(null)
    }
  }

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-neutral-500" />
          <h3 className="text-base font-semibold text-neutral-900">Print History</h3>
          <span className="text-sm text-neutral-500">
            {total} job{total !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
              showFilters
                ? 'border-[#F06B18] bg-orange-50 text-[#F06B18]'
                : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
            }`}
            style={{ minHeight: 44 }}
          >
            <Filter className="h-4 w-4" />
            Filters
          </button>

          <button
            onClick={fetchJobs}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 disabled:opacity-50"
            style={{ minHeight: 44 }}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-500">Job Type</label>
              <select
                value={filterType}
                onChange={(e) => { setFilterType(e.target.value as PrintJobType | ''); setPage(1) }}
                className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-[#F06B18] focus:outline-none focus:ring-1 focus:ring-[#F06B18]"
                style={{ minHeight: 44 }}
              >
                <option value="">All Types</option>
                <option value="receipt">Receipt</option>
                <option value="kitchen">Kitchen</option>
                <option value="void">Void</option>
                <option value="kds_failover">KDS Failover</option>
                <option value="bar">Bar</option>
                <option value="label">Label</option>
                <option value="report">Report</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-500">Status</label>
              <select
                value={filterStatus}
                onChange={(e) => { setFilterStatus(e.target.value as PrintJobStatus | ''); setPage(1) }}
                className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-[#F06B18] focus:outline-none focus:ring-1 focus:ring-[#F06B18]"
                style={{ minHeight: 44 }}
              >
                <option value="">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="sending">Sending</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-500">From</label>
              <input
                type="date"
                value={filterStartDate}
                onChange={(e) => { setFilterStartDate(e.target.value); setPage(1) }}
                className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-[#F06B18] focus:outline-none focus:ring-1 focus:ring-[#F06B18]"
                style={{ minHeight: 44 }}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-500">To</label>
              <input
                type="date"
                value={filterEndDate}
                onChange={(e) => { setFilterEndDate(e.target.value); setPage(1) }}
                className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-[#F06B18] focus:outline-none focus:ring-1 focus:ring-[#F06B18]"
                style={{ minHeight: 44 }}
              />
            </div>
          </div>

          {(filterType || filterStatus || filterStartDate || filterEndDate) && (
            <button
              onClick={() => {
                setFilterType('')
                setFilterStatus('')
                setFilterStartDate('')
                setFilterEndDate('')
                setPage(1)
              }}
              className="mt-3 text-sm font-medium text-[#F06B18] hover:text-[#d45e14]"
            >
              Clear all filters
            </button>
          )}
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
        {loading && jobs.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
            <span className="ml-2 text-sm text-neutral-500">Loading print history...</span>
          </div>
        ) : jobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Printer className="h-10 w-10 text-neutral-300" />
            <p className="mt-2 text-sm text-neutral-500">No print jobs found</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-neutral-100 bg-neutral-50/60">
                    <th className="whitespace-nowrap px-4 py-3 text-xs font-medium text-neutral-500">Time</th>
                    <th className="whitespace-nowrap px-4 py-3 text-xs font-medium text-neutral-500">Type</th>
                    <th className="whitespace-nowrap px-4 py-3 text-xs font-medium text-neutral-500">Printer</th>
                    <th className="whitespace-nowrap px-4 py-3 text-xs font-medium text-neutral-500">Order</th>
                    <th className="whitespace-nowrap px-4 py-3 text-xs font-medium text-neutral-500">Status</th>
                    <th className="whitespace-nowrap px-4 py-3 text-xs font-medium text-neutral-500">Attempts</th>
                    <th className="whitespace-nowrap px-4 py-3 text-xs font-medium text-neutral-500 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {jobs.map((job) => (
                    <tr
                      key={job.id}
                      className="transition-colors hover:bg-neutral-50/50"
                    >
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-neutral-700">
                        {formatTime(job.created_at)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <JobTypeBadge type={job.job_type} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-neutral-700">
                        <div className="flex items-center gap-1.5">
                          <Printer className="h-3.5 w-3.5 text-neutral-400" />
                          {job.printer_name ?? job.printer_id.slice(0, 8)}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm">
                        {job.order_number ? (
                          <span className="font-medium text-[#F06B18]">
                            #{job.order_number}
                          </span>
                        ) : (
                          <span className="text-neutral-400">--</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <StatusBadge status={job.status} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-neutral-500">
                        {job.attempts}
                        {job.error_message && (
                          <span className="ml-1.5 inline-flex" title={job.error_message}>
                            <AlertCircle className="h-3.5 w-3.5 text-red-400" />
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <button
                          onClick={() => handleReprint(job.id)}
                          disabled={reprinting === job.id}
                          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 disabled:opacity-50"
                          style={{ minHeight: 36 }}
                          title="Reprint this job"
                        >
                          {reprinting === job.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <RotateCcw className="h-3.5 w-3.5" />
                          )}
                          Reprint
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-neutral-100 px-4 py-3">
                <p className="text-xs text-neutral-500">
                  Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
                </p>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="inline-flex items-center justify-center rounded-lg border border-neutral-200 p-2 text-neutral-600 transition-colors hover:bg-neutral-50 disabled:opacity-40"
                    style={{ minHeight: 44, minWidth: 44 }}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>

                  <span className="px-3 text-sm font-medium text-neutral-700">
                    {page} / {totalPages}
                  </span>

                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="inline-flex items-center justify-center rounded-lg border border-neutral-200 p-2 text-neutral-600 transition-colors hover:bg-neutral-50 disabled:opacity-40"
                    style={{ minHeight: 44, minWidth: 44 }}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
