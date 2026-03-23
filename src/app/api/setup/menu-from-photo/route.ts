import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const requestSchema = z.object({
  image: z.string().min(1, 'Image is required'),
})

interface ExtractedMenuItem {
  name: string
  description: string
  price: string
  category: string
  confidence: 'high' | 'medium' | 'low'
}

/**
 * POST /api/setup/menu-from-photo
 * Receives a base64 image, calls Claude Vision API to extract menu items.
 * Returns structured JSON of extracted menu items.
 */
export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const { image } = parsed.data

  // Validate image size (base64 string should be reasonable)
  if (image.length > 15_000_000) {
    return NextResponse.json(
      { error: 'Image too large. Maximum 10MB.' },
      { status: 400 }
    )
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    // Fallback: return sample data for development
    return NextResponse.json({
      items: getSampleExtraction(),
      warning: 'AI extraction is not configured. Showing sample data.',
    })
  }

  try {
    // Extract base64 content and media type
    const base64Match = image.match(/^data:([^;]+);base64,(.+)$/)
    const mediaType = base64Match ? base64Match[1] : 'image/jpeg'
    const base64Data = base64Match ? base64Match[2] : image

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType,
                  data: base64Data,
                },
              },
              {
                type: 'text',
                text: `Extract all menu items from this restaurant menu image. For each item, provide:
- name: The item name exactly as shown
- description: The item description if visible (empty string if not shown)
- price: The price as a string (e.g., "14.95"). If no price is visible, use "0.00"
- category: The menu section/category the item belongs to (e.g., "Appetizers", "Entrees", "Beverages")
- confidence: "high" if clearly readable, "medium" if partially readable, "low" if uncertain

Return ONLY a valid JSON array. No markdown, no explanation. Example:
[{"name":"Caesar Salad","description":"Romaine, parmesan, croutons","price":"12.95","category":"Salads","confidence":"high"}]`,
              },
            ],
          },
        ],
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      console.error('Claude API error:', errorData)
      return NextResponse.json(
        { error: 'AI extraction failed. Please try again or use CSV import.' },
        { status: 502 }
      )
    }

    const data = await response.json()
    const textContent = data.content?.find(
      (c: { type: string }) => c.type === 'text'
    )
    const rawText = textContent?.text ?? '[]'

    // Parse the JSON response
    let items: ExtractedMenuItem[]
    try {
      // Handle potential markdown wrapping
      const jsonStr = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      items = JSON.parse(jsonStr)
    } catch {
      console.error('Failed to parse Claude response:', rawText)
      return NextResponse.json(
        { error: 'Could not parse the extracted menu. Please try with a clearer photo.' },
        { status: 422 }
      )
    }

    // Validate and clean items
    const cleanedItems: ExtractedMenuItem[] = items.map((item) => ({
      name: String(item.name ?? '').trim(),
      description: String(item.description ?? '').trim(),
      price: String(item.price ?? '0.00').replace(/[^0-9.]/g, '') || '0.00',
      category: String(item.category ?? 'General').trim(),
      confidence: (['high', 'medium', 'low'].includes(item.confidence) ? item.confidence : 'medium') as 'high' | 'medium' | 'low',
    })).filter((item) => item.name)

    return NextResponse.json({ items: cleanedItems })
  } catch (error) {
    console.error('Menu extraction error:', error)
    return NextResponse.json(
      { error: 'Failed to extract menu items. Please try again.' },
      { status: 500 }
    )
  }
}

/**
 * Sample extraction for development/demo when no API key is configured.
 */
function getSampleExtraction(): ExtractedMenuItem[] {
  return [
    { name: 'Caesar Salad', description: 'Romaine, parmesan, croutons, Caesar dressing', price: '12.95', category: 'Salads', confidence: 'high' },
    { name: 'French Onion Soup', description: 'Classic with gruyere crouton', price: '9.95', category: 'Appetizers', confidence: 'high' },
    { name: 'Grilled Chicken Breast', description: 'With seasonal vegetables and herb butter', price: '18.95', category: 'Entrees', confidence: 'high' },
    { name: 'New York Strip', description: '12oz USDA Prime, roasted potatoes', price: '34.95', category: 'Entrees', confidence: 'high' },
    { name: 'Pan-Seared Salmon', description: 'Atlantic salmon, lemon dill sauce, rice pilaf', price: '24.95', category: 'Seafood', confidence: 'high' },
    { name: 'Margherita Pizza', description: 'Fresh mozzarella, basil, San Marzano tomatoes', price: '16.95', category: 'Pizza', confidence: 'medium' },
    { name: 'Chocolate Mousse', description: 'Rich dark chocolate with whipped cream', price: '8.95', category: 'Desserts', confidence: 'high' },
    { name: 'House Red Wine', description: 'Glass', price: '11.00', category: 'Beverages', confidence: 'medium' },
    { name: 'Craft IPA', description: 'Local brewery, 16oz', price: '7.95', category: 'Beverages', confidence: 'low' },
    { name: 'Espresso', description: 'Double shot', price: '3.95', category: 'Beverages', confidence: 'high' },
  ]
}
