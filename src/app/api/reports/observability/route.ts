import { NextResponse } from 'next/server'
import { observabilityAlertRules } from '@/lib/observability/alert-rules'
import { getRumRouteSummaries } from '@/lib/observability/rum-store'

export async function GET() {
  return NextResponse.json({
    data: {
      rum: getRumRouteSummaries(),
      alert_rules: observabilityAlertRules,
    },
  })
}
