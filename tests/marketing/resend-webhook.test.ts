import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verify: vi.fn(),
  createAdminClient: vi.fn(),
}))

vi.mock('svix', () => ({
  Webhook: vi.fn().mockImplementation(function WebhookMock() {
    return {
      verify: mocks.verify,
    }
  }),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => mocks.createAdminClient(),
}))

import { POST, applyResendWebhookEvent } from '@/app/api/integrations/resend/webhook/route'

interface RecipientRow {
  id: string
  customer_id: string
  status: string
  resend_message_id: string
}

function makeSupabase(recipient: RecipientRow | null) {
  const updates: Array<{
    table: string
    patch: Record<string, unknown>
    filters: Record<string, unknown>
  }> = []

  const supabase = {
    from(table: string) {
      const state: {
        patch?: Record<string, unknown>
        filters: Record<string, unknown>
      } = { filters: {} }

      const chain = {
        select: () => chain,
        update: (patch: Record<string, unknown>) => {
          state.patch = patch
          return chain
        },
        eq: (column: string, value: unknown) => {
          state.filters[column] = value
          return chain
        },
        maybeSingle: async () => {
          if (
            table === 'campaign_recipients' &&
            recipient &&
            state.filters.resend_message_id === recipient.resend_message_id
          ) {
            return { data: recipient, error: null }
          }
          return { data: null, error: null }
        },
        then: (resolve: (value: { data: null; error: null }) => void) => {
          updates.push({
            table,
            patch: state.patch ?? {},
            filters: { ...state.filters },
          })
          resolve({ data: null, error: null })
        },
      }

      return chain
    },
  }

  return { supabase, updates }
}

const deliveredEvent = {
  type: 'email.delivered' as const,
  data: { email_id: 'email-1' },
}

describe('applyResendWebhookEvent', () => {
  it('marks a sent recipient delivered by resend_message_id', async () => {
    const { supabase, updates } = makeSupabase({
      id: 'recipient-1',
      customer_id: 'customer-1',
      status: 'sent',
      resend_message_id: 'email-1',
    })

    const result = await applyResendWebhookEvent(supabase as never, deliveredEvent)

    expect(result).toBe('processed')
    expect(updates).toEqual([
      {
        table: 'campaign_recipients',
        patch: { status: 'delivered' },
        filters: { id: 'recipient-1' },
      },
    ])
  })

  it('does not demote stronger engagement states when delivery arrives late', async () => {
    const { supabase, updates } = makeSupabase({
      id: 'recipient-1',
      customer_id: 'customer-1',
      status: 'clicked',
      resend_message_id: 'email-1',
    })

    const result = await applyResendWebhookEvent(supabase as never, deliveredEvent)

    expect(result).toBe('ignored')
    expect(updates).toEqual([])
  })

  it('marks bounces and suppresses the customer from future marketing sends', async () => {
    const { supabase, updates } = makeSupabase({
      id: 'recipient-1',
      customer_id: 'customer-1',
      status: 'sent',
      resend_message_id: 'email-1',
    })

    const result = await applyResendWebhookEvent(supabase as never, {
      type: 'email.bounced',
      data: {
        email_id: 'email-1',
        bounce: { message: 'mailbox disabled' },
      },
    })

    expect(result).toBe('processed')
    expect(updates).toHaveLength(2)
    expect(updates[0]).toEqual({
      table: 'campaign_recipients',
      patch: { status: 'bounced', bounce_reason: 'mailbox disabled' },
      filters: { id: 'recipient-1' },
    })
    expect(updates[1]).toMatchObject({
      table: 'customers',
      filters: { id: 'customer-1' },
    })
    expect(updates[1].patch.marketing_opt_in).toBe(false)
  })
})

describe('POST /api/integrations/resend/webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.RESEND_WEBHOOK_SECRET = 'whsec_test'
  })

  it('verifies the Svix signature before processing', async () => {
    const { supabase } = makeSupabase({
      id: 'recipient-1',
      customer_id: 'customer-1',
      status: 'sent',
      resend_message_id: 'email-1',
    })
    mocks.createAdminClient.mockReturnValue(supabase)
    mocks.verify.mockReturnValue(deliveredEvent)

    const response = await POST(
      new Request('http://localhost/api/integrations/resend/webhook', {
        method: 'POST',
        headers: {
          'svix-id': 'msg_1',
          'svix-timestamp': '1710000000',
          'svix-signature': 'v1,test',
        },
        body: JSON.stringify(deliveredEvent),
      }) as never,
    )

    expect(response.status).toBe(200)
    expect(mocks.verify).toHaveBeenCalledWith(JSON.stringify(deliveredEvent), {
      'svix-id': 'msg_1',
      'svix-timestamp': '1710000000',
      'svix-signature': 'v1,test',
    })
  })

  it('rejects invalid signatures', async () => {
    mocks.verify.mockImplementation(() => {
      throw new Error('invalid')
    })

    const response = await POST(
      new Request('http://localhost/api/integrations/resend/webhook', {
        method: 'POST',
        body: '{}',
      }) as never,
    )

    expect(response.status).toBe(400)
    expect(mocks.createAdminClient).not.toHaveBeenCalled()
  })
})
