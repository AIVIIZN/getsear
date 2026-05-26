import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getPrintJobHistory } from '@/lib/printing/print-job-logger'
import type { PrintJobType, PrintJobStatus } from '@/lib/printing/print-job-logger'

const querySchema = z.object({
  org_id: z.string().uuid(),
  location_id: z.string().uuid().optional(),
  job_type: z.enum(['receipt', 'kitchen', 'void', 'kds_failover', 'bar', 'label', 'report']).optional(),
  status: z.enum(['pending', 'sending', 'completed', 'failed', 'cancelled']).optional(),
  printer_id: z.string().uuid().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(25),
})

/**
 * GET /api/settings/print-jobs
 *
 * Retrieve print job history with filters and pagination.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl
  const rawParams: Record<string, string> = {}
  url.searchParams.forEach((value, key) => {
    rawParams[key] = value
  })

  const parsed = querySchema.safeParse(rawParams)
  if (!parsed.success) {
    return apiError(400, 'Invalid query parameters', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
  }

  const { org_id, location_id, job_type, status, printer_id, start_date, end_date, page, page_size } = parsed.data

  const result = await getPrintJobHistory({
    orgId: org_id,
    locationId: location_id,
    jobType: job_type as PrintJobType | undefined,
    status: status as PrintJobStatus | undefined,
    printerId: printer_id,
    startDate: start_date,
    endDate: end_date,
    page,
    pageSize: page_size,
  })

  return NextResponse.json({ data: result })
}
