import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { classifyCrmFeedback } from '@/lib/crm/feedback'
import { createCrmReviewSchema, createCrmSurveyResponseSchema, createCrmSurveySchema } from '@/lib/schemas/crm'

const root = process.cwd()

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8')
}

describe('CRM-V9.1 feedback and review ingestion', () => {
  it('creates feedback, review, survey, and complaint tables with tenant RLS and rollback coverage', () => {
    const migration = read('supabase/migrations/20260525174307_add_crm_feedback_ingestion.sql')
    const rollback = read('supabase/_rollbacks/20260525174307_add_crm_feedback_ingestion.rollback.sql')

    for (const table of ['crm_surveys', 'crm_survey_responses', 'crm_reviews', 'crm_complaints']) {
      expect(migration).toContain(`CREATE TABLE IF NOT EXISTS public.${table}`)
      expect(migration).toMatch(new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}[\\s\\S]*?org_id uuid NOT NULL REFERENCES public\\.organizations\\(id\\) ON DELETE CASCADE`))
      expect(migration).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`)
      expect(migration).toContain(`CREATE POLICY "tenant_select" ON public.${table}`)
      expect(rollback).toContain(`DROP TABLE IF EXISTS public.${table}`)
    }

    expect(migration).toContain("source_type IN ('receipt_qr', 'email', 'sms', 'reservation_follow_up', 'online_order_follow_up', 'manual', 'review_import')")
    expect(migration).toContain("topics <@ ARRAY['food', 'service', 'speed', 'cleanliness', 'pricing', 'reservation', 'delivery', 'staff_compliment']")
    expect(migration).toContain("recovery_status text NOT NULL DEFAULT 'needs_recovery'")
    expect(migration).toContain('crm_complaints_org_status_idx')
  })

  it('validates CRM feedback write boundaries', () => {
    const survey = createCrmSurveySchema.parse({
      name: 'Post visit pulse',
      source_type: 'receipt_qr',
      questions: [{ key: 'rating', label: 'How was your visit?', type: 'rating', required: true }],
    })
    expect(survey.status).toBe('active')
    expect(survey.trigger_event).toBe('post_visit')

    const response = createCrmSurveyResponseSchema.parse({
      source_type: 'sms',
      rating: 2,
      topics: ['service', 'speed'],
      response_text: 'The server was friendly, but we waited 45 minutes.',
    })
    expect(response.contact_requested).toBe(false)
    expect(response.topics).toEqual(['service', 'speed'])

    expect(() => createCrmSurveyResponseSchema.parse({ source_type: 'sms', rating: 6 })).toThrow()
    expect(() => createCrmReviewSchema.parse({ provider: 'google', review_url: 'not-a-url' })).toThrow()
  })

  it('classifies negative feedback and routes it through complaint-backed APIs', () => {
    expect(classifyCrmFeedback({
      rating: 1,
      text: 'The food was cold and service was slow.',
    })).toMatchObject({
      sentiment: 'negative',
      severity: 'critical',
      topics: ['food', 'service', 'speed'],
    })

    const feedbackRoute = read('src/app/api/crm/feedback/route.ts')
    const reviewsRoute = read('src/app/api/crm/reviews/route.ts')
    const surveysRoute = read('src/app/api/crm/feedback/surveys/route.ts')
    const auditLog = read('src/lib/audit/log.ts')

    expect(feedbackRoute).toContain("from('crm_survey_responses')")
    expect(feedbackRoute).toContain("from('crm_complaints')")
    expect(feedbackRoute).toContain("event_type: classification.sentiment === 'negative' ? 'crm.recovery.opened'")
    expect(feedbackRoute).toContain("eq('org_id', user.org_id)")
    expect(feedbackRoute).toContain('Survey not found for this organization')
    expect(feedbackRoute).toContain('Staff user not found for this organization')
    expect(reviewsRoute).toContain("from('crm_reviews')")
    expect(reviewsRoute).toContain("source_type: 'review'")
    expect(reviewsRoute).toContain('Guest not found for this organization')
    expect(reviewsRoute).toContain('Order not found for this organization')
    expect(surveysRoute).toContain("from('crm_surveys')")
    expect(auditLog).toContain("'crm_negative_feedback_routed'")
    expect(auditLog).toContain("'crm_negative_review_routed'")
  })
})
