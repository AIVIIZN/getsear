/**
 * k6 load test — CRM launch readiness
 *
 * Covers CRM-V12.5 budgets:
 * - guest search p95 <= 300ms
 * - profile/timeline p95 <= 1000ms
 * - segment preview p95 <= 1500ms
 * - reports preview p95 <= 2000ms without POS write locks
 * - campaign queue scheduling/test-send routes stay below the global p95 budget
 */

import http from 'k6/http'
import { check, group, sleep } from 'k6'
import { Trend } from 'k6/metrics'

const BASE_URL = __ENV.BASE_URL || 'https://getsear.com'
const DEMO_EMAIL = __ENV.DEMO_EMAIL || 'demo@getsear.com'
const DEMO_PASSWORD = __ENV.DEMO_PASSWORD

if (!DEMO_PASSWORD) {
  throw new Error('DEMO_PASSWORD env var is required. Refusing to run CRM launch load test without explicit credentials.')
}

const guestSearchTrend = new Trend('crm_guest_search_duration', true)
const guestProfileTrend = new Trend('crm_guest_profile_duration', true)
const segmentPreviewTrend = new Trend('crm_segment_preview_duration', true)
const campaignQueueTrend = new Trend('crm_campaign_queue_duration', true)
const reportPreviewTrend = new Trend('crm_report_preview_duration', true)

export const options = {
  scenarios: {
    crm_launch: {
      executor: 'constant-vus',
      vus: 6,
      duration: '6m',
      gracefulStop: '30s',
    },
  },
  thresholds: {
    'crm_guest_search_duration': [{ threshold: 'p(95)<300', abortOnFail: false }],
    'crm_guest_profile_duration': [{ threshold: 'p(95)<1000', abortOnFail: false }],
    'crm_segment_preview_duration': [{ threshold: 'p(95)<1500', abortOnFail: false }],
    'crm_campaign_queue_duration': [{ threshold: 'p(95)<2000', abortOnFail: false }],
    'crm_report_preview_duration': [{ threshold: 'p(95)<2000', abortOnFail: false }],
    'http_req_failed': [{ threshold: 'rate<0.01', abortOnFail: false }],
    'checks': [{ threshold: 'rate>0.99', abortOnFail: false }],
  },
}

export function setup() {
  const loginRes = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ email: DEMO_EMAIL, password: DEMO_PASSWORD }),
    { headers: { 'Content-Type': 'application/json' } }
  )

  check(loginRes, { 'setup: login status 200': (response) => response.status === 200 })
  if (loginRes.status !== 200) throw new Error(`setup login failed with ${loginRes.status}`)

  const cookieHeader = Object.entries(loginRes.cookies || {})
    .map(([name, arr]) => `${name}=${arr[0].value}`)
    .join('; ')

  if (!cookieHeader) throw new Error('setup login returned no cookies')

  const guestsRes = http.get(`${BASE_URL}/api/crm/guests?search=a&limit=1`, { headers: authHeaders(cookieHeader) })
  check(guestsRes, { 'setup: guest search reachable': (response) => response.status === 200 })

  let guestId = null
  try {
    guestId = guestsRes.json('data.0.id') || guestsRes.json('guests.0.id') || null
  } catch {
    guestId = null
  }

  const segmentsRes = http.get(`${BASE_URL}/api/crm/segments?limit=1`, { headers: authHeaders(cookieHeader) })
  check(segmentsRes, { 'setup: segment list reachable': (response) => response.status === 200 })

  let segmentId = null
  try {
    segmentId = segmentsRes.json('data.0.id') || null
  } catch {
    segmentId = null
  }

  if (!guestId) throw new Error('setup: no CRM guest returned. Seed CRM demo data before running launch load gates.')
  if (!segmentId) throw new Error('setup: no CRM segment returned. Seed CRM demo segments before running launch load gates.')

  return { cookieHeader, guestId, segmentId }
}

function authHeaders(cookieHeader, extra) {
  return Object.assign({ 'Content-Type': 'application/json', Cookie: cookieHeader }, extra || {})
}

function record(trend, response) {
  trend.add(response.timings.duration)
  return response
}

export default function crmLaunchScenario(data) {
  group('guest search budget', () => {
    const response = record(guestSearchTrend, http.get(`${BASE_URL}/api/crm/guests?search=a&limit=10`, { headers: authHeaders(data.cookieHeader) }))
    check(response, { 'guest search status 200': (r) => r.status === 200 })
  })

  group('guest profile budget', () => {
    const profile = record(guestProfileTrend, http.get(`${BASE_URL}/api/crm/guests/${data.guestId}`, { headers: authHeaders(data.cookieHeader) }))
    const timeline = record(guestProfileTrend, http.get(`${BASE_URL}/api/crm/guests/${data.guestId}/timeline`, { headers: authHeaders(data.cookieHeader) }))
    check(profile, { 'guest profile status 200': (r) => r.status === 200 })
    check(timeline, { 'guest timeline status 200': (r) => r.status === 200 })
  })

  group('segment preview budget', () => {
    const response = record(segmentPreviewTrend, http.post(`${BASE_URL}/api/crm/segments/${data.segmentId}/preview`, null, { headers: authHeaders(data.cookieHeader) }))
    check(response, { 'segment preview status 200': (r) => r.status === 200 })
  })

  group('campaign queue budget', () => {
    const response = record(campaignQueueTrend, http.get(`${BASE_URL}/api/crm/campaigns?status=scheduled&limit=20`, { headers: authHeaders(data.cookieHeader) }))
    check(response, { 'campaign queue status 200': (r) => r.status === 200 })
  })

  group('report preview budget', () => {
    const response = record(reportPreviewTrend, http.post(
      `${BASE_URL}/api/crm/reports/preview`,
      JSON.stringify({ metric_keys: ['active_guest'], dimension_keys: ['guest_lifecycle_stage'], filters: {}, visualization: 'table', sample_limit: 100 }),
      { headers: authHeaders(data.cookieHeader) }
    ))
    check(response, { 'report preview status 200': (r) => r.status === 200 })
  })

  sleep(1)
}
