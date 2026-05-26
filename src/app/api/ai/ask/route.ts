import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { CLAUDE_MODEL, sendMessage } from '@/lib/ai/claude-client'
import { getAskSystemPrompt } from '@/lib/ai/system-prompts'
import { AI_TOOLS } from '@/lib/ai/tools'
import { executeToolCall } from '@/lib/ai/tool-handlers'
import { checkRateLimit } from '@/lib/ai/cost-tracker'
import { getCachedResponse, setCachedResponse } from '@/lib/ai/cache'
import { billingFeatures, requireFeatureTier } from '@/lib/billing/features'
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
const INPUT_COST_PER_TOKEN = 3 / 1_000_000
const OUTPUT_COST_PER_TOKEN = 15 / 1_000_000

function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4)
}

function estimateCost(inputTokens: number, outputTokens: number): number {
  return inputTokens * INPUT_COST_PER_TOKEN + outputTokens * OUTPUT_COST_PER_TOKEN
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin', 'manager', 'shift_manager', 'server', 'bartender'])
  if (roleErr) return roleErr

  const billingErr = await requireFeatureTier(user.org_id, billingFeatures.ai)
  if (billingErr) return billingErr

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError(400, 'Invalid JSON')
  }

  const parsed = askSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
  }

  const { message, history } = parsed.data
  const locationId = user.location_ids[0] ?? ''

  // Rate limit check
  const rateLimit = await checkRateLimit(user.org_id, user.id)
  if (!rateLimit.allowed) {
    return apiError(429, 'Rate limit exceeded')
  }

  // Check cache
  const cached = getCachedResponse({
    orgId: user.org_id,
    locationId,
    query: message,
  })
  if (cached) {
    const estimatedInputTokensSaved = estimateTokenCount(
      [message, ...history.map((h) => h.content)].join('\n')
    )
    const estimatedOutputTokensSaved = estimateTokenCount(cached)

    return NextResponse.json({
      response: cached,
      cached: true,
      model: CLAUDE_MODEL,
      tokens: {
        input: 0,
        output: 0,
        total: 0,
      },
      estimated_cost: 0,
      estimated_cache_savings: {
        input_tokens: estimatedInputTokensSaved,
        output_tokens: estimatedOutputTokensSaved,
        total_tokens: estimatedInputTokensSaved + estimatedOutputTokensSaved,
        cost: estimateCost(estimatedInputTokensSaved, estimatedOutputTokensSaved),
      },
      tool_rounds: 0,
      tool_calls: 0,
    })
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
    let totalInputTokens = response.inputTokens
    let totalOutputTokens = response.outputTokens
    let totalEstimatedCost = response.estimatedCost
    let totalToolCalls = response.toolCalls.length

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
      totalInputTokens += response.inputTokens
      totalOutputTokens += response.outputTokens
      totalEstimatedCost += response.estimatedCost
      totalToolCalls += response.toolCalls.length
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
      model: response.model,
      tokens: {
        input: totalInputTokens,
        output: totalOutputTokens,
        total: totalInputTokens + totalOutputTokens,
      },
      estimated_cost: totalEstimatedCost,
      estimated_cache_savings: {
        input_tokens: 0,
        output_tokens: 0,
        total_tokens: 0,
        cost: 0,
      },
      tool_rounds: rounds,
      tool_calls: totalToolCalls,
    })
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    console.error('[api/ai/ask] Error:', errMsg)

    if (errMsg.includes('ANTHROPIC_API_KEY')) {
      return apiError(503, 'AI assistant is not configured. Please set your Anthropic API key.')
    }

    return apiError(503, 'AI assistant is temporarily unavailable. Please try again in a few minutes.')
  }
}
