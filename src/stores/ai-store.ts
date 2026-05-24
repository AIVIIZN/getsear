'use client'

import { create } from 'zustand'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  chartData?: ChartData | null
  tableData?: TableData | null
  timestamp: string
  isLoading?: boolean
}

export interface AIRuntimeStatus {
  model: string
  contextTokens: number
  contextLimit: number
  spentTokens: number
  spentCost: number
  cachedTokensSaved: number
  cachedCostSaved: number
  cacheHits: number
  activeAgents: number
  lastToolCalls: number
  lastResponseCached: boolean
  lastUpdated: string | null
}

export interface ChartData {
  type: 'bar' | 'line' | 'pie'
  title: string
  data: Array<Record<string, string | number>>
  xKey: string
  yKey: string
  color?: string
}

export interface TableData {
  headers: string[]
  rows: string[][]
}

export interface Insight {
  id: string
  category: string
  priority: 'high' | 'medium' | 'low'
  title: string
  summary: string
  details: string
  metricValue: string
  comparisonText: string
  isDismissed: boolean
  feedback: 'helpful' | 'not_helpful' | null
  generatedAt: string
}

export interface Prediction {
  date: string
  dayOfWeek: string
  predictedRevenueCents: number
  predictedCovers: number
  predictedLaborHours: number
  confidence: number
  actualRevenueCents: number | null
  actualCovers: number | null
}

interface Conversation {
  id: string
  messages: ChatMessage[]
  createdAt: string
  title: string
}

interface AIState {
  // Chat
  chatOpen: boolean
  chatExpanded: boolean
  currentConversation: Conversation | null
  conversations: Conversation[]
  isLoading: boolean
  runtimeStatus: AIRuntimeStatus

  // Insights
  insights: Insight[]
  insightsLoading: boolean

  // Predictions
  predictions: Prediction[]
  predictionAccuracy: { revenueAccuracy: number; coverAccuracy: number; days: number } | null
  predictionsLoading: boolean
  minimumDataMet: boolean

  actions: {
    // Chat
    openChat: () => void
    closeChat: () => void
    toggleChatExpanded: () => void
    sendMessage: (message: string) => Promise<void>
    startNewConversation: () => void
    loadConversation: (id: string) => void
    setLoading: (loading: boolean) => void

    // Insights
    loadInsights: () => Promise<void>
    dismissInsight: (id: string) => Promise<void>
    feedbackInsight: (id: string, feedback: 'helpful' | 'not_helpful') => Promise<void>

    // Predictions
    loadPredictions: (startDate: string, endDate: string) => Promise<void>
  }
}

let msgCounter = 0
function nextMsgId(): string {
  return `msg-${Date.now()}-${++msgCounter}`
}

function parseChartData(text: string): ChartData | null {
  const match = text.match(/```chart\s*([\s\S]*?)```/)
  if (!match) return null
  try {
    return JSON.parse(match[1])
  } catch {
    return null
  }
}

function parseTableData(text: string): TableData | null {
  const match = text.match(/```table\s*([\s\S]*?)```/)
  if (!match) return null
  try {
    return JSON.parse(match[1])
  } catch {
    return null
  }
}

function cleanResponseText(text: string): string {
  return text
    .replace(/```chart[\s\S]*?```/g, '')
    .replace(/```table[\s\S]*?```/g, '')
    .trim()
}

function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4)
}

function estimateConversationContext(messages: ChatMessage[], nextMessage?: string): number {
  const text = [
    ...messages.map((m) => `${m.role}: ${m.content}`),
    nextMessage ? `user: ${nextMessage}` : '',
  ]
    .filter(Boolean)
    .join('\n')

  return estimateTokenCount(text)
}

export const useAIStore = create<AIState>()((set, get) => ({
  chatOpen: false,
  chatExpanded: false,
  currentConversation: null,
  conversations: [],
  isLoading: false,
  runtimeStatus: {
    model: 'claude-sonnet-4-6',
    contextTokens: 0,
    contextLimit: 200_000,
    spentTokens: 0,
    spentCost: 0,
    cachedTokensSaved: 0,
    cachedCostSaved: 0,
    cacheHits: 0,
    activeAgents: 0,
    lastToolCalls: 0,
    lastResponseCached: false,
    lastUpdated: null,
  },

  insights: [],
  insightsLoading: false,

  predictions: [],
  predictionAccuracy: null,
  predictionsLoading: false,
  minimumDataMet: true,

  actions: {
    openChat: () => set({ chatOpen: true }),
    closeChat: () => set({ chatOpen: false }),
    toggleChatExpanded: () => set((s) => ({ chatExpanded: !s.chatExpanded })),

    setLoading: (loading) => set({ isLoading: loading }),

    startNewConversation: () => {
      const conv: Conversation = {
        id: `conv-${Date.now()}`,
        messages: [],
        createdAt: new Date().toISOString(),
        title: 'New Conversation',
      }
      set((state) => ({
        currentConversation: conv,
        conversations: [conv, ...state.conversations].slice(0, 10),
      }))
    },

    loadConversation: (id) => {
      const conv = get().conversations.find((c) => c.id === id)
      if (conv) set({ currentConversation: conv })
    },

    sendMessage: async (message: string) => {
      const state = get()
      let conv = state.currentConversation
      if (!conv) {
        conv = {
          id: `conv-${Date.now()}`,
          messages: [],
          createdAt: new Date().toISOString(),
          title: message.slice(0, 50),
        }
      }

      const userMsg: ChatMessage = {
        id: nextMsgId(),
        role: 'user',
        content: message,
        timestamp: new Date().toISOString(),
      }

      const loadingMsg: ChatMessage = {
        id: nextMsgId(),
        role: 'assistant',
        content: '',
        timestamp: new Date().toISOString(),
        isLoading: true,
      }

      const updatedConv = {
        ...conv,
        messages: [...conv.messages, userMsg, loadingMsg],
        title: conv.messages.length === 0 ? message.slice(0, 50) : conv.title,
      }

      set({
        currentConversation: updatedConv,
        isLoading: true,
        runtimeStatus: {
          ...state.runtimeStatus,
          contextTokens: estimateConversationContext(conv.messages, message),
          activeAgents: 1,
          lastUpdated: new Date().toISOString(),
        },
        conversations: [
          updatedConv,
          ...get().conversations.filter((c) => c.id !== conv!.id),
        ].slice(0, 10),
      })

      try {
        const resp = await fetch('/api/ai/ask', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message,
            conversation_id: conv.id,
            history: conv.messages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
          }),
        })

        if (!resp.ok) {
          const errData = await resp.json().catch(() => ({ error: 'Request failed' }))
          throw new Error(errData.error ?? `HTTP ${resp.status}`)
        }

        const data = await resp.json()
        const responseText = data.response ?? ''
        const inputTokens = Number(data.tokens?.input ?? 0)
        const outputTokens = Number(data.tokens?.output ?? 0)
        const totalTokens = Number(data.tokens?.total ?? inputTokens + outputTokens)
        const estimatedCost = Number(data.estimated_cost ?? 0)
        const savedTokens = Number(data.estimated_cache_savings?.total_tokens ?? 0)
        const savedCost = Number(data.estimated_cache_savings?.cost ?? 0)
        const responseWasCached = Boolean(data.cached)

        const assistantMsg: ChatMessage = {
          id: nextMsgId(),
          role: 'assistant',
          content: cleanResponseText(responseText),
          chartData: parseChartData(responseText),
          tableData: parseTableData(responseText),
          timestamp: new Date().toISOString(),
        }

        const finalConv = {
          ...updatedConv,
          messages: [...updatedConv.messages.slice(0, -1), assistantMsg],
        }

        set({
          currentConversation: finalConv,
          isLoading: false,
          runtimeStatus: {
            ...get().runtimeStatus,
            model: data.model ?? get().runtimeStatus.model,
            contextTokens: estimateConversationContext(finalConv.messages),
            spentTokens: get().runtimeStatus.spentTokens + totalTokens,
            spentCost: get().runtimeStatus.spentCost + estimatedCost,
            cachedTokensSaved: get().runtimeStatus.cachedTokensSaved + savedTokens,
            cachedCostSaved: get().runtimeStatus.cachedCostSaved + savedCost,
            cacheHits: get().runtimeStatus.cacheHits + (responseWasCached ? 1 : 0),
            activeAgents: 0,
            lastToolCalls: Number(data.tool_calls ?? 0),
            lastResponseCached: responseWasCached,
            lastUpdated: new Date().toISOString(),
          },
          conversations: [
            finalConv,
            ...get().conversations.filter((c) => c.id !== conv!.id),
          ].slice(0, 10),
        })
      } catch (err) {
        const errorMsg: ChatMessage = {
          id: nextMsgId(),
          role: 'assistant',
          content:
            err instanceof Error && err.message.includes('rate limit')
              ? "You've reached your daily query limit (50 queries). Try again tomorrow."
              : err instanceof Error && err.message.includes('API key')
                ? 'AI assistant is not configured. Please set up your Anthropic API key in Settings > AI.'
                : 'AI assistant is temporarily unavailable. Please try again in a few minutes.',
          timestamp: new Date().toISOString(),
        }

        const errorConv = {
          ...updatedConv,
          messages: [...updatedConv.messages.slice(0, -1), errorMsg],
        }

        set({
          currentConversation: errorConv,
          isLoading: false,
          runtimeStatus: {
            ...get().runtimeStatus,
            activeAgents: 0,
            lastUpdated: new Date().toISOString(),
          },
          conversations: [
            errorConv,
            ...get().conversations.filter((c) => c.id !== conv!.id),
          ].slice(0, 10),
        })
      }
    },

    loadInsights: async () => {
      set({ insightsLoading: true })
      try {
        const resp = await fetch('/api/ai/insights')
        if (!resp.ok) throw new Error('Failed to load insights')
        const data = await resp.json()
        set({
          insights: (data.data ?? []).map((i: Record<string, unknown>) => ({
            id: i.id,
            category: i.category,
            priority: i.priority,
            title: i.title,
            summary: i.summary,
            details: i.details,
            metricValue: i.metric_value,
            comparisonText: i.comparison_text,
            isDismissed: i.is_dismissed,
            feedback: i.feedback,
            generatedAt: i.generated_at,
          })),
          insightsLoading: false,
        })
      } catch {
        set({ insightsLoading: false })
      }
    },

    dismissInsight: async (id: string) => {
      set((s) => ({
        insights: s.insights.map((i) =>
          i.id === id ? { ...i, isDismissed: true } : i
        ),
      }))
      await fetch('/api/ai/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'dismiss', insight_id: id }),
      }).catch(() => {})
    },

    feedbackInsight: async (id: string, feedback: 'helpful' | 'not_helpful') => {
      set((s) => ({
        insights: s.insights.map((i) =>
          i.id === id ? { ...i, feedback } : i
        ),
      }))
      await fetch('/api/ai/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'feedback', insight_id: id, feedback }),
      }).catch(() => {})
    },

    loadPredictions: async (startDate: string, endDate: string) => {
      set({ predictionsLoading: true })
      try {
        const resp = await fetch(
          `/api/ai/predict?start_date=${startDate}&end_date=${endDate}`
        )
        if (!resp.ok) throw new Error('Failed to load predictions')
        const data = await resp.json()
        set({
          predictions: data.predictions ?? [],
          predictionAccuracy: data.accuracy ?? null,
          minimumDataMet: data.minimum_data_met ?? true,
          predictionsLoading: false,
        })
      } catch {
        set({ predictionsLoading: false })
      }
    },
  },
}))
