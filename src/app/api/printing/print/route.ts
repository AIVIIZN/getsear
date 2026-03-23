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
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = submitPrintJobSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
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
    return NextResponse.json({ error: 'Printer not found' }, { status: 404 })
  }

  if (!printer.is_active) {
    return NextResponse.json({ error: 'Printer is not active' }, { status: 400 })
  }

  // Decode base64 to verify it's valid
  try {
    atob(documentData)
  } catch {
    return NextResponse.json({ error: 'Invalid base64 document data' }, { status: 400 })
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
    return NextResponse.json(
      { error: 'Failed to create print job' },
      { status: 500 }
    )
  }

  return NextResponse.json({ data: job }, { status: 201 })
}
