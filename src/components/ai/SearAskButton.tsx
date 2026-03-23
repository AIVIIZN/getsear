'use client'

import { useState } from 'react'
import { MessageSquare, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAIStore } from '@/stores/ai-store'
import { SearAskChat } from './SearAskChat'

/**
 * Floating "Ask Sear" button — 48px ember orange circle, bottom-right.
 * Opens a chat panel overlay.
 */
export function SearAskButton() {
  const chatOpen = useAIStore((s) => s.chatOpen)
  const openChat = useAIStore((s) => s.actions.openChat)
  const closeChat = useAIStore((s) => s.actions.closeChat)
  const [animating, setAnimating] = useState(false)

  const handleToggle = () => {
    if (chatOpen) {
      setAnimating(true)
      closeChat()
      setTimeout(() => setAnimating(false), 300)
    } else {
      openChat()
    }
  }

  return (
    <>
      {/* Chat Panel */}
      {chatOpen && (
        <div
          className="fixed bottom-20 right-6 z-50 flex flex-col overflow-hidden rounded-2xl bg-white"
          style={{
            width: '420px',
            height: '600px',
            maxHeight: 'calc(100vh - 120px)',
            boxShadow: 'var(--shadow-xl)',
            border: '0.5px solid var(--border)',
            animation: 'fade-in var(--duration-normal) var(--ease-spring)',
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-5 py-3"
            style={{ borderBottom: '0.5px solid var(--separator)' }}
          >
            <div className="flex items-center gap-3">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full"
                style={{ backgroundColor: 'var(--primary)' }}
              >
                <MessageSquare className="h-4 w-4 text-white" strokeWidth={2} />
              </div>
              <div>
                <p className="text-headline">Ask Sear</p>
                <p className="text-caption-1 text-muted-foreground">AI Business Assistant</p>
              </div>
            </div>
            <button
              onClick={closeChat}
              className="btn-press flex h-8 w-8 items-center justify-center rounded-full hover:bg-black/[0.04]"
            >
              <X className="h-4 w-4 text-[var(--muted-foreground)]" />
            </button>
          </div>

          {/* Chat content */}
          <div className="flex-1 overflow-hidden">
            <SearAskChat compact />
          </div>
        </div>
      )}

      {/* Floating Button */}
      <button
        onClick={handleToggle}
        className={cn(
          'fixed bottom-6 right-6 z-50 flex items-center justify-center rounded-full',
          'btn-press transition-all',
          chatOpen ? 'rotate-0' : '',
          animating ? 'scale-95' : ''
        )}
        style={{
          width: '48px',
          height: '48px',
          backgroundColor: 'var(--primary)',
          boxShadow: '0 4px 12px rgba(240, 107, 24, 0.35)',
        }}
        aria-label={chatOpen ? 'Close chat' : 'Ask Sear'}
      >
        {chatOpen ? (
          <X className="h-5 w-5 text-white" strokeWidth={2.2} />
        ) : (
          <MessageSquare className="h-5 w-5 text-white" strokeWidth={2.2} />
        )}
      </button>
    </>
  )
}
