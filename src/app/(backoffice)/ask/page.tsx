'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { MessageSquare, Plus, Clock, ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAIStore } from '@/stores/ai-store'
import { SearAskChat } from '@/components/ai/SearAskChat'
import { InsightsList } from '@/components/ai/InsightsList'
import { PredictionChart } from '@/components/ai/PredictionChart'
import { PredictionSummary } from '@/components/ai/PredictionSummary'

/**
 * Full-page Sear Ask chat interface.
 * Left panel: chat history + insights + predictions.
 * Right panel: active chat.
 */
export default function AskPage() {
  const currentConversation = useAIStore((s) => s.currentConversation)
  const conversations = useAIStore((s) => s.conversations)
  const predictions = useAIStore((s) => s.predictions)
  const startNewConversation = useAIStore((s) => s.actions.startNewConversation)
  const loadConversation = useAIStore((s) => s.actions.loadConversation)

  useEffect(() => {
    if (!currentConversation) {
      startNewConversation()
    }
  }, [currentConversation, startNewConversation])

  return (
    <div className="flex h-[calc(100vh-var(--topbar-height)-48px)] gap-6">
      {/* Left sidebar — conversations + insights */}
      <div className="hidden w-[320px] shrink-0 flex-col gap-6 overflow-y-auto scroll-container lg:flex">
        {/* New conversation button */}
        <button
          onClick={startNewConversation}
          className="btn-press flex items-center gap-2 rounded-xl px-4 py-3 text-left font-medium text-white transition-colors"
          style={{
            backgroundColor: 'var(--primary)',
            boxShadow: '0 2px 8px rgba(240, 107, 24, 0.25)',
          }}
        >
          <Plus className="h-4 w-4" />
          New Conversation
        </button>

        {/* Recent conversations */}
        {conversations.length > 0 && (
          <div>
            <p className="text-caption-1 font-semibold uppercase tracking-wide text-muted-foreground mb-2 px-1">
              Recent
            </p>
            <div className="space-y-1">
              {conversations.slice(0, 10).map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => loadConversation(conv.id)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left transition-colors',
                    currentConversation?.id === conv.id
                      ? 'bg-[var(--primary)]/[0.1]'
                      : 'hover:bg-black/[0.03]'
                  )}
                >
                  <MessageSquare
                    className="h-4 w-4 shrink-0"
                    style={{
                      color:
                        currentConversation?.id === conv.id
                          ? 'var(--primary)'
                          : 'var(--muted-foreground)',
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        'text-footnote truncate',
                        currentConversation?.id === conv.id
                          ? 'font-semibold text-[var(--primary)]'
                          : 'text-foreground'
                      )}
                    >
                      {conv.title || 'New conversation'}
                    </p>
                    <p className="text-caption-2 text-muted-foreground">
                      {conv.messages.length} messages
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Insights section */}
        <InsightsList maxItems={5} showViewAll={false} />

        {/* Predictions section */}
        <PredictionSummary />
        {predictions.length > 0 && <PredictionChart predictions={predictions} height={200} />}
      </div>

      {/* Main chat area */}
      <div
        className="flex flex-1 flex-col overflow-hidden rounded-2xl bg-white"
        style={{
          boxShadow: 'var(--shadow-md)',
          border: '0.5px solid var(--border)',
        }}
      >
        {/* Chat header */}
        <div
          className="flex items-center justify-between px-5 py-3 shrink-0"
          style={{ borderBottom: '0.5px solid var(--separator)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-full"
              style={{ backgroundColor: 'var(--primary)' }}
            >
              <MessageSquare className="h-4 w-4 text-white" strokeWidth={2} />
            </div>
            <div>
              <h1 className="text-headline">Ask Sear</h1>
              <p className="text-caption-1 text-muted-foreground">
                AI-powered business intelligence
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/settings/ai"
              className="text-caption-1 font-medium transition-colors hover:opacity-80"
              style={{ color: 'var(--primary)' }}
            >
              Settings
            </Link>
          </div>
        </div>

        {/* Chat content */}
        <div className="flex-1 overflow-hidden">
          <SearAskChat />
        </div>
      </div>
    </div>
  )
}
