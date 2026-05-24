'use client'

import { useRef, useEffect, useState } from 'react'
import { Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAIStore } from '@/stores/ai-store'
import { ChatMessage } from './ChatMessage'
import { ChatSuggestions } from './ChatSuggestions'
import { AIStatusBar } from './AIStatusBar'

interface SearAskChatProps {
  compact?: boolean
}

/**
 * Full chat interface.
 * Used both in the floating panel (compact=true) and the full /ask page.
 */
export function SearAskChat({ compact = false }: SearAskChatProps) {
  const currentConversation = useAIStore((s) => s.currentConversation)
  const isLoading = useAIStore((s) => s.isLoading)
  const sendMessage = useAIStore((s) => s.actions.sendMessage)
  const startNewConversation = useAIStore((s) => s.actions.startNewConversation)

  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const messages = currentConversation?.messages ?? []
  const isEmpty = messages.length === 0

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  // Focus input on mount
  useEffect(() => {
    if (!compact) {
      inputRef.current?.focus()
    }
  }, [compact])

  const handleSend = () => {
    const trimmed = input.trim()
    if (!trimmed || isLoading) return

    if (!currentConversation) {
      startNewConversation()
    }

    setInput('')
    sendMessage(trimmed)
  }

  const handleSuggestionSelect = (question: string) => {
    if (!currentConversation) {
      startNewConversation()
    }
    sendMessage(question)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Messages area */}
      <div
        className="flex-1 overflow-y-auto scroll-container px-4 py-3"
        style={{ backgroundColor: 'var(--background)' }}
      >
        {isEmpty ? (
          <ChatSuggestions onSelect={handleSuggestionSelect} />
        ) : (
          <div className="space-y-3">
            {messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <div
        className="shrink-0 px-4 py-3"
        style={{
          borderTop: '0.5px solid var(--separator)',
          backgroundColor: 'var(--card)',
        }}
      >
        <div
          className="flex items-center gap-2 rounded-xl px-3"
          style={{
            backgroundColor: 'var(--background)',
            border: '0.5px solid var(--border)',
            minHeight: '44px',
          }}
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your restaurant..."
            disabled={isLoading}
            className={cn(
              'flex-1 bg-transparent text-subhead text-foreground placeholder:text-muted-foreground',
              'outline-none border-none focus:ring-0',
              'disabled:opacity-50'
            )}
            style={{ minHeight: '44px' }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors',
              input.trim() && !isLoading
                ? 'bg-[var(--primary)] text-white'
                : 'bg-transparent text-muted-foreground'
            )}
          >
            <Send className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        <AIStatusBar compact={compact} />

        {!compact && (
          <p className="mt-2 text-center text-caption-2 text-muted-foreground">
            Sear AI analyzes your restaurant data. No customer PII is shared.
          </p>
        )}
      </div>
    </div>
  )
}
