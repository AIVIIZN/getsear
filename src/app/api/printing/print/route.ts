import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const submitPrintJobSchema = z.object({
  printerId: z.string().uuid('Invalid printer ID'),
  jobType: z.enum(['receipt', 'kitchen_ticket', 'cash_drawer', 'test_page', 'label']),
  /** Base64-encoded ESC/POS binary data */
  documentData: z.string().min(1, 'Document data is required'),
  priority: z.number().int().min(0).max(100).optional().default(0),
})

// ---------------------------------------------------------------------------
// POST — Submit a print job
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  // All authenticated users can submit print jobs (servers print receipts, etc.)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError(400, 'Invalid JSON')
  }

  const parsed = submitPrintJobSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.flatten().fieldErrors, extra: { "details": parsed.error.flatten().fieldErrors } })
  }

  const { printerId, jobType, documentData, priority } = parsed.data

  const supabase = createAdminClient()

  // Validate printer exists and is active
  const { data: printer, error: printerError } = await supabase
    .from('printers')
    .select('id, name, is_active, location_id')
    .eq('id', printerId)
    .eq('org_id', user.org_id)
    .single()

  if (printerError || !printer) {
    return apiError(404, 'Printer not found')
  }

  if (!printer.is_active) {
    return apiError(400, 'Printer is not active')
  }

  // Decode base64 to verify it's valid
  try {
    atob(documentData)
  } catch {
    return apiError(400, 'Invalid base64 document data')
  }

  // Insert print job into the database
  const { data: job, error: insertError } = await supabase
    .from('print_jobs')
    .insert({
      org_id: user.org_id,
      location_id: printer.location_id,
      printer_id: printerId,
      job_type: jobType,
      document_data: documentData, // stored as text (base64); binary storage in bytea is handled by the print relay
      status: 'queued',
      priority,
      attempts: 0,
    })
    .select('id, status, created_at')
    .single()

  if (insertError) {
    return apiError(500, 'Failed to create print job')
  }

  return NextResponse.json({ data: job }, { status: 201 })
}
