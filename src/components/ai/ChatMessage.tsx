'use client'

import { cn } from '@/lib/utils'
import type { ChatMessage as ChatMessageType } from '@/stores/ai-store'
import { InlineChart } from './InlineChart'
import { InlineTable } from './InlineTable'

interface ChatMessageProps {
  message: ChatMessageType
}

/**
 * Typing indicator — three animated dots.
 */
function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-1 py-2">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-[6px] w-[6px] rounded-full"
          style={{
            backgroundColor: 'var(--muted-foreground)',
            animation: `pulse-dot 1.4s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
    </div>
  )
}

/**
 * Simple markdown-to-JSX renderer.
 * Handles: **bold**, *italic*, bullet lists, numbered lists, headings, line breaks.
 */
function renderMarkdown(text: string): React.ReactNode {
  const lines = text.split('\n')
  const elements: React.ReactNode[] = []
  let listItems: React.ReactNode[] = []
  let isInList = false
  let listType: 'ul' | 'ol' = 'ul'

  const processInline = (line: string): React.ReactNode => {
    const parts: React.ReactNode[] = []
    let remaining = line
    let key = 0

    while (remaining.length > 0) {
      // Bold
      const boldMatch = remaining.match(/\*\*(.+?)\*\*/)
      if (boldMatch && boldMatch.index !== undefined) {
        if (boldMatch.index > 0) {
          parts.push(<span key={key++}>{remaining.slice(0, boldMatch.index)}</span>)
        }
        parts.push(
          <strong key={key++} className="font-semibold">
            {boldMatch[1]}
          </strong>
        )
        remaining = remaining.slice(boldMatch.index + boldMatch[0].length)
        continue
      }

      // Italic
      const italicMatch = remaining.match(/\*(.+?)\*/)
      if (italicMatch && italicMatch.index !== undefined) {
        if (italicMatch.index > 0) {
          parts.push(<span key={key++}>{remaining.slice(0, italicMatch.index)}</span>)
        }
        parts.push(<em key={key++}>{italicMatch[1]}</em>)
        remaining = remaining.slice(italicMatch.index + italicMatch[0].length)
        continue
      }

      parts.push(<span key={key++}>{remaining}</span>)
      break
    }

    return <>{parts}</>
  }

  const flushList = () => {
    if (listItems.length > 0) {
      if (listType === 'ul') {
        elements.push(
          <ul key={`list-${elements.length}`} className="ml-4 list-disc space-y-0.5 text-subhead">
            {listItems}
          </ul>
        )
      } else {
        elements.push(
          <ol key={`list-${elements.length}`} className="ml-4 list-decimal space-y-0.5 text-subhead">
            {listItems}
          </ol>
        )
      }
      listItems = []
      isInList = false
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Headings
    if (line.startsWith('### ')) {
      flushList()
      elements.push(
        <h4 key={i} className="text-callout font-semibold mt-3 mb-1">
          {processInline(line.slice(4))}
        </h4>
      )
      continue
    }
    if (line.startsWith('## ')) {
      flushList()
      elements.push(
        <h3 key={i} className="text-headline mt-3 mb-1">
          {processInline(line.slice(3))}
        </h3>
      )
      continue
    }

    // Bullet list
    if (line.match(/^[-*]\s/)) {
      if (!isInList || listType !== 'ul') {
        flushList()
        isInList = true
        listType = 'ul'
      }
      listItems.push(<li key={i}>{processInline(line.slice(2))}</li>)
      continue
    }

    // Numbered list
    if (line.match(/^\d+\.\s/)) {
      if (!isInList || listType !== 'ol') {
        flushList()
        isInList = true
        listType = 'ol'
      }
      listItems.push(<li key={i}>{processInline(line.replace(/^\d+\.\s/, ''))}</li>)
      continue
    }

    // Empty line
    if (line.trim() === '') {
      flushList()
      continue
    }

    // Regular paragraph
    flushList()
    elements.push(
      <p key={i} className="text-subhead leading-relaxed">
        {processInline(line)}
      </p>
    )
  }

  flushList()
  return <div className="space-y-1.5">{elements}</div>
}

/**
 * Individual chat message bubble.
 * User messages: right-aligned, light gray background.
 * AI messages: left-aligned, white, full-width.
 */
export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user'

  if (message.isLoading) {
    return (
      <div className="flex justify-start animate-fade-in">
        <div
          className="max-w-[85%] rounded-2xl px-4 py-2"
          style={{
            backgroundColor: 'var(--card)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <TypingIndicator />
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn('flex animate-fade-in', isUser ? 'justify-end' : 'justify-start')}
    >
      <div
        className={cn(
          'rounded-2xl px-4 py-3',
          isUser ? 'max-w-[80%]' : 'max-w-[95%] w-full'
        )}
        style={{
          backgroundColor: isUser ? 'var(--secondary)' : 'var(--card)',
          boxShadow: isUser ? 'none' : 'var(--shadow-sm)',
        }}
      >
        <div className={cn('text-subhead', isUser ? 'text-foreground' : 'text-foreground')}>
          {isUser ? message.content : renderMarkdown(message.content)}
        </div>

        {/* Inline chart */}
        {message.chartData && (
          <div className="mt-3">
            <InlineChart data={message.chartData} />
          </div>
        )}

        {/* Inline table */}
        {message.tableData && (
          <div className="mt-3">
            <InlineTable data={message.tableData} />
          </div>
        )}
      </div>
    </div>
  )
}
