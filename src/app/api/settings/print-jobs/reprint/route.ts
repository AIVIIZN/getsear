import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { reprintJob } from '@/lib/printing/print-job-logger'

const bodySchema = z.object({
  job_id: z.string().uuid(),
  printer_id: z.string().uuid().optional(),
})

/**
 * POST /api/settings/print-jobs/reprint
 *
 * Reprint a previously completed print job. Creates a new print job
 * record with the same document data, optionally to a different printer.
 */
export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    )
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request body', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const { job_id, printer_id } = parsed.data

  const newJobId = await reprintJob(job_id, printer_id)
  if (!newJobId) {
    return NextResponse.json(
      { error: 'Failed to create reprint job. Original job may not exist.' },
      { status: 404 }
    )
  }

  return NextResponse.json({
    data: {
      job_id: newJobId,
      original_job_id: job_id,
      message: 'Reprint job created successfully',
    },
  })
}
