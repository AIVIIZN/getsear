import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { sendMessage } from '@/lib/ai/claude-client'
import { getAskSystemPrompt } from '@/lib/ai/system-prompts'
import { AI_TOOLS } from '@/lib/ai/tools'
import { executeToolCall } from '@/lib/ai/tool-handlers'
import { checkRateLimit } from '@/lib/ai/cost-tracker'
import { getCachedResponse, setCachedResponse } from '@/lib/ai/cache'
import type Anthropic from '@anthropic-ai/sdk'

const askSchema = z.object({
  message: z.string().min(1).max(2000),
  conversation_id: z.string().optional(),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
      })
    )
    .max(20)
    .default([]),
})

const MAX_TOOL_ROUNDS = 5

export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin', 'manager', 'shift_manager', 'server', 'bartender'])
  if (roleErr) return roleErr

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = askSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const { message, history } = parsed.data
  const locationId = user.location_ids[0] ?? ''

  // Rate limit check
  const rateLimit = await checkRateLimit(user.org_id, user.id)
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: 'Rate limit exceeded',
        message: `You've reached your daily limit of queries. ${rateLimit.remaining} remaining. Resets at midnight.`,
      },
      { status: 429 }
    )
  }

  // Check cache
  const cached = getCachedResponse({
    orgId: user.org_id,
    locationId,
    query: message,
  })
  if (cached) {
    return NextResponse.json({ response: cached, cached: true })
  }

  // Build system prompt
  const now = new Date()
  const systemPrompt = getAskSystemPrompt({
    restaurantName: 'Your Restaurant',
    locationName: 'Main Location',
    timezone: 'America/New_York',
    currentDate: now.toISOString().split('T')[0],
    userRole: user.role,
  })

  // Build message history
  const messages: Array<{
    role: 'user' | 'assistant'
    content: string | Array<Anthropic.ContentBlockParam>
  }> = []

  // Include last 6 messages of history for context
  const recentHistory = history.slice(-6)
  for (const h of recentHistory) {
    messages.push({ role: h.role, content: h.content })
  }
  messages.push({ role: 'user', content: message })

  try {
    // Iterative tool calling loop
    let response = await sendMessage({
      systemPrompt,
      messages,
      tools: AI_TOOLS,
      orgId: user.org_id,
      userId: user.id,
      queryType: 'ask',
    })

    let rounds = 0
    while (response.toolCalls.length > 0 && rounds < MAX_TOOL_ROUNDS) {
      rounds++

      // Execute all tool calls
      const toolResults: Array<Anthropic.ContentBlockParam> = []

      // Add assistant's response (with tool_use blocks) to messages
      const assistantContent: Array<Anthropic.ContentBlockParam> = []
      if (response.text) {
        assistantContent.push({ type: 'text', text: response.text })
      }
      for (const tc of response.toolCalls) {
        assistantContent.push({
          type: 'tool_use',
          id: tc.id,
          name: tc.name,
          input: tc.input,
        })
      }
      messages.push({ role: 'assistant', content: assistantContent })

      // Execute tools and build results
      for (const tc of response.toolCalls) {
        const result = await executeToolCall(tc.name, tc.input, {
          orgId: user.org_id,
          locationId,
        })
        toolResults.push({
          type: 'tool_result',
          tool_use_id: tc.id,
          content: result,
        } as Anthropic.ContentBlockParam)
      }

      messages.push({ role: 'user', content: toolResults })

      // Continue conversation with tool results
      response = await sendMessage({
        systemPrompt,
        messages,
        tools: AI_TOOLS,
        orgId: user.org_id,
        userId: user.id,
        queryType: 'ask',
      })
    }

    // Cache the response
    setCachedResponse({
      orgId: user.org_id,
      locationId,
      query: message,
      response: response.text,
    })

    return NextResponse.json({
      response: response.text,
      cached: false,
      tokens: {
        input: response.inputTokens,
        output: response.outputTokens,
      },
      estimated_cost: response.estimatedCost,
    })
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    console.error('[api/ai/ask] Error:', errMsg)

    if (errMsg.includes('ANTHROPIC_API_KEY')) {
      return NextResponse.json(
        { error: 'AI assistant is not configured. Please set your Anthropic API key.' },
        { status: 503 }
      )
    }

    return NextResponse.json(
      { error: 'AI assistant is temporarily unavailable. Please try again in a few minutes.' },
      { status: 503 }
    )
  }
}
