/**
 * Print Job Logger
 *
 * Functions for logging print jobs to the database, tracking their status,
 * and enabling reprints from the print history UI.
 */

import { createAdminClient } from '@/lib/supabase/admin'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PrintJobType = 'receipt' | 'kitchen' | 'void' | 'kds_failover' | 'bar' | 'label' | 'report'
export type PrintJobStatus = 'pending' | 'sending' | 'completed' | 'failed' | 'cancelled'

export interface PrintJobLog {
  orgId: string
  locationId: string
  printerId: string
  printerName?: string
  jobType: PrintJobType
  orderId?: string | null
  orderNumber?: string | null
  documentData: string
  metadata?: Record<string, unknown>
}

export interface PrintJobRecord {
  id: string
  org_id: string
  location_id: string
  printer_id: string
  printer_name: string | null
  job_type: PrintJobType
  order_id: string | null
  order_number: string | null
  document_data: string
  status: PrintJobStatus
  attempts: number
  error_message: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
  completed_at: string | null
}

export interface PrintJobFilters {
  orgId: string
  locationId?: string
  jobType?: PrintJobType
  status?: PrintJobStatus
  printerId?: string
  startDate?: string
  endDate?: string
  page?: number
  pageSize?: number
}

// ---------------------------------------------------------------------------
// Log a new print job
// ---------------------------------------------------------------------------

export async function logPrintJob(job: PrintJobLog): Promise<string | null> {
  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('print_jobs') as any)
    .insert({
      org_id: job.orgId,
      location_id: job.locationId,
      printer_id: job.printerId,
      printer_name: job.printerName ?? null,
      job_type: job.jobType,
      order_id: job.orderId ?? null,
      order_number: job.orderNumber ?? null,
      document_data: job.documentData,
      status: 'pending' as PrintJobStatus,
      attempts: 0,
      metadata: job.metadata ?? null,
    })
    .select('id')
    .single()

  if (error) {
    console.error('[print-job-logger] Failed to log print job:', error)
    return null
  }

  return data?.id ?? null
}

// ---------------------------------------------------------------------------
// Update print job status
// ---------------------------------------------------------------------------

export async function updatePrintJobStatus(
  jobId: string,
  status: PrintJobStatus,
  errorMessage?: string
): Promise<boolean> {
  const supabase = createAdminClient()

  const updates: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  }

  if (status === 'completed') {
    updates.completed_at = new Date().toISOString()
  }

  if (status === 'failed' && errorMessage) {
    updates.error_message = errorMessage
  }

  if (status === 'sending') {
    // Increment attempts
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: current } = await (supabase.from('print_jobs') as any)
      .select('attempts')
      .eq('id', jobId)
      .single()

    updates.attempts = (current?.attempts ?? 0) + 1
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('print_jobs') as any)
    .update(updates)
    .eq('id', jobId)

  if (error) {
    console.error('[print-job-logger] Failed to update status:', error)
    return false
  }

  return true
}

// ---------------------------------------------------------------------------
// Get print job history
// ---------------------------------------------------------------------------

export async function getPrintJobHistory(
  filters: PrintJobFilters
): Promise<{ jobs: PrintJobRecord[]; total: number }> {
  const supabase = createAdminClient()
  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? 25
  const offset = (page - 1) * pageSize

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from('print_jobs') as any)
    .select('*', { count: 'exact' })
    .eq('org_id', filters.orgId)
    .order('created_at', { ascending: false })
    .range(offset, offset + pageSize - 1)

  if (filters.locationId) {
    query = query.eq('location_id', filters.locationId)
  }

  if (filters.jobType) {
    query = query.eq('job_type', filters.jobType)
  }

  if (filters.status) {
    query = query.eq('status', filters.status)
  }

  if (filters.printerId) {
    query = query.eq('printer_id', filters.printerId)
  }

  if (filters.startDate) {
    query = query.gte('created_at', filters.startDate)
  }

  if (filters.endDate) {
    query = query.lte('created_at', filters.endDate)
  }

  const { data, count, error } = await query

  if (error) {
    console.error('[print-job-logger] Failed to fetch history:', error)
    return { jobs: [], total: 0 }
  }

  return {
    jobs: (data ?? []) as PrintJobRecord[],
    total: count ?? 0,
  }
}

// ---------------------------------------------------------------------------
// Get reprint data
// ---------------------------------------------------------------------------

export async function getReprintData(
  jobId: string
): Promise<{ documentData: string; printerId: string; jobType: PrintJobType } | null> {
  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('print_jobs') as any)
    .select('document_data, printer_id, job_type')
    .eq('id', jobId)
    .single()

  if (error || !data) {
    console.error('[print-job-logger] Failed to get reprint data:', error)
    return null
  }

  return {
    documentData: data.document_data,
    printerId: data.printer_id,
    jobType: data.job_type as PrintJobType,
  }
}

// ---------------------------------------------------------------------------
// Reprint a job (creates a new print job record from an existing one)
// ---------------------------------------------------------------------------

export async function reprintJob(
  originalJobId: string,
  overridePrinterId?: string
): Promise<string | null> {
  const reprintData = await getReprintData(originalJobId)
  if (!reprintData) return null

  const supabase = createAdminClient()

  // Get full original job for org/location context
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: originalJob } = await (supabase.from('print_jobs') as any)
    .select('org_id, location_id, order_id, order_number, printer_name, metadata')
    .eq('id', originalJobId)
    .single()

  if (!originalJob) return null

  return logPrintJob({
    orgId: originalJob.org_id,
    locationId: originalJob.location_id,
    printerId: overridePrinterId ?? reprintData.printerId,
    printerName: originalJob.printer_name,
    jobType: reprintData.jobType,
    orderId: originalJob.order_id,
    orderNumber: originalJob.order_number,
    documentData: reprintData.documentData,
    metadata: {
      ...(originalJob.metadata ?? {}),
      is_reprint: true,
      original_job_id: originalJobId,
      reprinted_at: new Date().toISOString(),
    },
  })
}
