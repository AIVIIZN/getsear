import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => mocks.createAdminClient(),
}))

import { getCampaignAnalytics } from '@/lib/marketing/analytics'

function makeSupabase(rows: unknown[] | null, error: unknown = null) {
  return {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: rows, error }),
    })),
  }
}

describe('getCampaignAnalytics', () => {
  it('rolls up the constrained recipient status vocabulary', async () => {
    mocks.createAdminClient.mockReturnValue(
      makeSupabase([
        {
          status: 'sent',
          opened_at: null,
          clicked_at: null,
          open_count: 0,
          click_count: 0,
        },
        {
          status: 'delivered',
          opened_at: null,
          clicked_at: null,
          open_count: 0,
          click_count: 0,
        },
        {
          status: 'opened',
          opened_at: '2026-05-24T12:00:00.000Z',
          clicked_at: null,
          open_count: 2,
          click_count: 0,
        },
        {
          status: 'clicked',
          opened_at: '2026-05-24T12:01:00.000Z',
          clicked_at: '2026-05-24T12:02:00.000Z',
          open_count: 1,
          click_count: 3,
        },
        {
          status: 'bounced',
          opened_at: null,
          clicked_at: null,
          open_count: 0,
          click_count: 0,
        },
        {
          status: 'failed',
          opened_at: null,
          clicked_at: null,
          open_count: 0,
          click_count: 0,
        },
        {
          status: 'queued',
          opened_at: null,
          clicked_at: null,
          open_count: 0,
          click_count: 0,
        },
      ]),
    )

    await expect(getCampaignAnalytics('campaign-1')).resolves.toEqual({
      sent: 4,
      delivered: 3,
      opened: 3,
      clicked: 3,
      bounced: 1,
      failed: 1,
      opens_unique: 2,
      clicks_unique: 1,
    })
  })

  it('returns zeroed analytics when the recipient query fails', async () => {
    mocks.createAdminClient.mockReturnValue(makeSupabase(null, { message: 'boom' }))

    await expect(getCampaignAnalytics('campaign-1')).resolves.toEqual({
      sent: 0,
      delivered: 0,
      opened: 0,
      clicked: 0,
      bounced: 0,
      failed: 0,
      opens_unique: 0,
      clicks_unique: 0,
    })
  })
})
