/**
 * Claude API Client Wrapper
 *
 * Wraps the Anthropic SDK with error handling, retry logic,
 * and cost tracking for Sear POS AI Intelligence Layer.
 */

import Anthropic from '@anthropic-ai/sdk'
import { trackUsage } from './cost-tracker'

const MODEL = 'claude-sonnet-4-20250514'
const MAX_TOKENS = 4096
const MAX_RETRIES = 3
const RETRY_DELAY_MS = 1000

export interface ClaudeToolDefinition {
  name: string
  description: string
  input_schema: Record<string, unknown>
}

export interface ClaudeToolUse {
  type: 'tool_use'
  id: string
  name: string
  input: Record<string, unknown>
}

export interface ClaudeToolResult {
  type: 'tool_result'
  tool_use_id: string
  content: string
}

export interface ClaudeMessage {
  role: 'user' | 'assistant'
  content: string | Array<Anthropic.ContentBlock>
}

export interface ClaudeResponse {
  text: string
  toolCalls: ClaudeToolUse[]
  stopReason: string | null
  inputTokens: number
  outputTokens: number
  estimatedCost: number
}

/**
 * Cost per token for Claude 3.5 Sonnet (in USD).
 * Input: $3 / 1M tokens, Output: $15 / 1M tokens
 */
const INPUT_COST_PER_TOKEN = 3 / 1_000_000
const OUTPUT_COST_PER_TOKEN = 15 / 1_000_000

function estimateCost(inputTokens: number, outputTokens: number): number {
  return inputTokens * INPUT_COST_PER_TOKEN + outputTokens * OUTPUT_COST_PER_TOKEN
}

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is not set')
  }
  return new Anthropic({ apiKey })
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Send a message to Claude with optional tools.
 * Handles retries on transient errors (rate limits, server errors).
 */
export async function sendMessage(params: {
  systemPrompt: string
  messages: Array<{ role: 'user' | 'assistant'; content: string | Array<Anthropic.ContentBlockParam> }>
  tools?: ClaudeToolDefinition[]
  orgId: string
  userId: string
  queryType: 'ask' | 'insights' | 'predict'
}): Promise<ClaudeResponse> {
  const { systemPrompt, messages, tools, orgId, userId, queryType } = params
  const client = getClient()

  let lastError: Error | null = null

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const requestParams: Anthropic.MessageCreateParamsNonStreaming = {
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: systemPrompt,
        messages: messages as Anthropic.MessageParam[],
      }

      if (tools && tools.length > 0) {
        requestParams.tools = tools.map((t) => ({
          name: t.name,
          description: t.description,
          input_schema: t.input_schema as Anthropic.Tool['input_schema'],
        }))
      }

      const response = await client.messages.create(requestParams)

      const text = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('')

      const toolCalls = response.content
        .filter((block): block is Anthropic.ToolUseBlock => block.type === 'tool_use')
        .map((block) => ({
          type: 'tool_use' as const,
          id: block.id,
          name: block.name,
          input: block.input as Record<string, unknown>,
        }))

      const inputTokens = response.usage.input_tokens
      const outputTokens = response.usage.output_tokens
      const cost = estimateCost(inputTokens, outputTokens)

      // Track usage asynchronously (don't block response)
      trackUsage({
        orgId,
        userId,
        inputTokens,
        outputTokens,
        estimatedCost: cost,
        queryType,
      }).catch((err) => {
        console.error('[claude-client] Failed to track usage:', err)
      })

      return {
        text,
        toolCalls,
        stopReason: response.stop_reason,
        inputTokens,
        outputTokens,
        estimatedCost: cost,
      }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))

      // Retry on rate limits (429) and server errors (500+)
      const isRetryable =
        lastError.message.includes('429') ||
        lastError.message.includes('500') ||
        lastError.message.includes('503') ||
        lastError.message.includes('overloaded')

      if (isRetryable && attempt < MAX_RETRIES - 1) {
        const delay = RETRY_DELAY_MS * Math.pow(2, attempt)
        console.warn(
          `[claude-client] Retryable error (attempt ${attempt + 1}/${MAX_RETRIES}), waiting ${delay}ms:`,
          lastError.message
        )
        await sleep(delay)
        continue
      }

      break
    }
  }

  throw lastError ?? new Error('Claude API request failed')
}

/**
 * Continue a conversation after tool results are provided.
 * This sends the tool results back to Claude to get the final response.
 */
export async function continueWithToolResults(params: {
  systemPrompt: string
  messages: Array<{ role: 'user' | 'assistant'; content: string | Array<Anthropic.ContentBlockParam> }>
  tools: ClaudeToolDefinition[]
  orgId: string
  userId: string
  queryType: 'ask' | 'insights' | 'predict'
}): Promise<ClaudeResponse> {
  return sendMessage(params)
}
