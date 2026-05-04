import OpenAI from 'openai'
import { createAdminClient } from '@/lib/supabase/admin'

const BUCKET_NAME = 'menu-photos'
const APPROX_COST_CENTS = 4

let openaiClient: OpenAI | null = null

function getClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not configured')
  }
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }
  return openaiClient
}

const PROMPT_TEMPLATE = (name: string, description?: string | null): string =>
  `Professional restaurant menu photography of "${name}"${description ? `: ${description}` : ''}. ` +
  `Top-down or 3/4 angle, soft natural lighting, shallow depth of field, ` +
  `served on clean white ceramic plate or appropriate vessel, neutral wood or marble surface. ` +
  `Photorealistic, appetizing, magazine quality. No text, no logos, no watermarks. ` +
  `Square 1024x1024 composition.`

export interface GeneratePhotoParams {
  org_id: string
  item_id: string
  name: string
  description?: string | null
}

export interface GeneratePhotoResult {
  url: string
  cost_cents: number
  storage_path: string
}

export function isPhotoPipelineConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY)
}

export async function generateMenuPhoto(
  params: GeneratePhotoParams
): Promise<GeneratePhotoResult> {
  const prompt = PROMPT_TEMPLATE(params.name, params.description ?? null)
  const client = getClient()

  const result = await client.images.generate({
    model: 'gpt-image-1',
    prompt,
    size: '1024x1024',
    quality: 'high',
    n: 1,
  })

  const b64 = result.data?.[0]?.b64_json
  if (!b64) {
    throw new Error('OpenAI image API returned no image data')
  }

  const buffer = Buffer.from(b64, 'base64')
  const supabase = createAdminClient()
  const storagePath = `${params.org_id}/${params.item_id}/generated-${Date.now()}.png`

  const { error: uploadErr } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(storagePath, buffer, {
      contentType: 'image/png',
      upsert: true,
    })
  if (uploadErr) {
    throw new Error(`Failed to upload generated photo: ${uploadErr.message}`)
  }

  const { data: urlData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(storagePath)

  // The prompt itself is intentionally NOT returned — keep it internal so
  // future callers can't accidentally log it (V6.3.1 reviewer concern).
  return {
    url: urlData.publicUrl,
    cost_cents: APPROX_COST_CENTS,
    storage_path: storagePath,
  }
}
