#!/usr/bin/env node
/**
 * Generate AI photos for all 60 demo seed menu items.
 *
 * Run:
 *   OPENAI_API_KEY=$(grep OPENAI_API_KEY .env.local | cut -d= -f2) \
 *   SUPABASE_SERVICE_ROLE_KEY=$(grep SUPABASE_SERVICE_ROLE_KEY .env.local | cut -d= -f2) \
 *   NEXT_PUBLIC_SUPABASE_URL=$(grep NEXT_PUBLIC_SUPABASE_URL .env.local | cut -d= -f2) \
 *   node scripts/generate-seed-photos.mjs
 *
 * Concurrency: 4. Skips items that already have an image_url unless --force.
 * Output: scripts/_seed-photos-output.json (gitignored)
 */

import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import { writeFile } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const DEMO_ORG_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
const BUCKET_NAME = 'menu-photos'
const CONCURRENCY = 4
const APPROX_COST_CENTS = 4
const FAILURE_THRESHOLD = 0.05

const FORCE = process.argv.includes('--force')

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const OPENAI_API_KEY = process.env.OPENAI_API_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.')
  process.exit(1)
}
if (!OPENAI_API_KEY) {
  console.error('OPENAI_API_KEY must be set.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const openai = new OpenAI({ apiKey: OPENAI_API_KEY })

function buildPrompt(name, description) {
  return (
    `Professional restaurant menu photography of "${name}"` +
    (description ? `: ${description}` : '') +
    `. Top-down or 3/4 angle, soft natural lighting, shallow depth of field, ` +
    `served on clean white ceramic plate or appropriate vessel, neutral wood or marble surface. ` +
    `Photorealistic, appetizing, magazine quality. No text, no logos, no watermarks. ` +
    `Square 1024x1024 composition.`
  )
}

async function generateOne(item) {
  const prompt = buildPrompt(item.name, item.description)
  const result = await openai.images.generate({
    model: 'gpt-image-1',
    prompt,
    size: '1024x1024',
    quality: 'high',
    n: 1,
  })
  const b64 = result?.data?.[0]?.b64_json
  if (!b64) throw new Error('No image data returned')

  const buffer = Buffer.from(b64, 'base64')
  const path = `${DEMO_ORG_ID}/${item.id}/seed-${Date.now()}.png`

  const { error: uploadErr } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(path, buffer, { contentType: 'image/png', upsert: true })
  if (uploadErr) throw new Error(`Storage upload failed: ${uploadErr.message}`)

  const { data: urlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(path)
  const publicUrl = urlData.publicUrl

  const { error: updateErr } = await supabase
    .from('menu_items')
    .update({ image_url: publicUrl, updated_at: new Date().toISOString() })
    .eq('id', item.id)
    .eq('org_id', DEMO_ORG_ID)
  if (updateErr) throw new Error(`DB update failed: ${updateErr.message}`)

  return { id: item.id, name: item.name, url: publicUrl, cost_cents: APPROX_COST_CENTS }
}

async function main() {
  console.log(`Loading demo menu items for org ${DEMO_ORG_ID}...`)

  const { data: items, error } = await supabase
    .from('menu_items')
    .select('id, name, description, image_url')
    .eq('org_id', DEMO_ORG_ID)
    .is('deleted_at', null)
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('Failed to load items:', error.message)
    process.exit(1)
  }
  if (!items || items.length === 0) {
    console.error('No demo items found. Run the seed first.')
    process.exit(1)
  }

  const targets = FORCE ? items : items.filter((i) => !i.image_url)
  console.log(
    `Found ${items.length} items. Generating ${targets.length} (skipping ${items.length - targets.length} with existing photos).`
  )

  const results = []
  const failures = []
  let inFlight = 0
  let cursor = 0

  await new Promise((done) => {
    const launch = () => {
      while (inFlight < CONCURRENCY && cursor < targets.length) {
        const item = targets[cursor++]
        inFlight++
        const idx = cursor
        generateOne(item)
          .then((res) => {
            results.push(res)
            console.log(`  [${idx}/${targets.length}] ${item.name}`)
          })
          .catch((err) => {
            const message = err instanceof Error ? err.message : String(err)
            failures.push({ id: item.id, name: item.name, error: message })
            console.error(`  [${idx}/${targets.length}] FAILED ${item.name}: ${message}`)
          })
          .finally(() => {
            inFlight--
            if (cursor >= targets.length && inFlight === 0) {
              done()
            } else {
              launch()
            }
          })
      }
      if (targets.length === 0) done()
    }
    launch()
  })

  const totalAttempted = targets.length
  const totalCostCents = results.length * APPROX_COST_CENTS
  const summary = {
    generated_at: new Date().toISOString(),
    org_id: DEMO_ORG_ID,
    attempted: totalAttempted,
    succeeded: results.length,
    failed: failures.length,
    total_cost_cents: totalCostCents,
    total_cost_usd: (totalCostCents / 100).toFixed(2),
    results,
    failures,
  }

  const outPath = resolve(__dirname, '_seed-photos-output.json')
  await writeFile(outPath, JSON.stringify(summary, null, 2), 'utf-8')
  console.log(`\nWrote summary to ${outPath}`)
  console.log(
    `Done. ${results.length}/${totalAttempted} succeeded, ${failures.length} failed. ` +
      `Approx cost: $${summary.total_cost_usd}`
  )

  if (totalAttempted > 0 && failures.length / totalAttempted > FAILURE_THRESHOLD) {
    console.error(`Failure rate ${(failures.length / totalAttempted * 100).toFixed(1)}% exceeds 5% threshold.`)
    process.exit(2)
  }
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
