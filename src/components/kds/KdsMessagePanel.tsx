'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { MessageSquare, X, Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import { KdsQuickMessages } from './KdsQuickMessages'
import type { KdsMessage } from '@/hooks/use-kds-realtime'

interface KdsMessagePanelProps {
  isOpen: boolean
  onClose: () => void
  stationId: string | null
  stationName: string
  locationId: string
  messages: KdsMessage[]
  stations: Array<{ id: string; name: string; station_type: string }>
  onSendMessage: (message: string, toStationId: string | null, messageType: 'quick' | 'custom') => void
  onMarkRead: (messageId: string) => void
}

export function KdsMessagePanel({
  isOpen,
  onClose,
  stationId,
  stationName,
  locationId,
  messages,
  stations,
  onSendMessage,
  onMarkRead,
}: KdsMessagePanelProps) {
  const [customMessage, setCustomMessage] = useState('')
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null) // null = broadcast
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-scroll to latest message
  useEffect(() => {
    if (scrollRef.current && isOpen) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isOpen])

  // Mark unread messages as read when panel opens
  useEffect(() => {
    if (isOpen && stationId) {
      for (const msg of messages) {
        if (
          !msg.is_read &&
          msg.from_station_id !== stationId &&
          !(msg.read_by ?? []).includes(stationId)
        ) {
          onMarkRead(msg.id)
        }
      }
    }
  }, [isOpen, messages, stationId, onMarkRead])

  const handleSendCustom = useCallback(() => {
    const text = customMessage.trim()
    if (!text) return

    onSendMessage(text, selectedTarget, 'custom')
    setCustomMessage('')
    inputRef.current?.focus()
  }, [customMessage, selectedTarget, onSendMessage])

  const handleQuickMessage = useCallback(
    (message: string) => {
      onSendMessage(message, selectedTarget, 'quick')
    },
    [selectedTarget, onSendMessage]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSendCustom()
      }
    },
    [handleSendCustom]
  )

  // Filter messages relevant to this station
  const relevantMessages = messages.filter(
    (msg) =>
      msg.from_station_id === stationId ||
      msg.to_station_id === stationId ||
      msg.to_station_id === null // broadcasts
  )

  // Other stations for target selector (exclude self)
  const otherStations = stations.filter((s) => s.id !== stationId)

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />

      {/* Panel — slide from right */}
      <div className="relative flex w-full max-w-md flex-col bg-[#1a1a1a] shadow-2xl animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#2a2a2a] px-4 py-3">
          <div className="flex items-center gap-3">
            <MessageSquare className="h-5 w-5 text-[var(--primary)]" />
            <h2 className="text-lg font-bold text-white">Messages</h2>
            <span className="text-sm text-[#888]">{stationName}</span>
          </div>
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#2a2a2a] text-[#888] transition-colors hover:bg-[#333] hover:text-white"
          >
            <X className="h-5 w-5" />
            <span className="sr-only">Close</span>
          </button>
        </div>

        {/* Target selector */}
        <div className="flex items-center gap-2 border-b border-[#2a2a2a] px-4 py-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#888]">To:</span>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setSelectedTarget(null)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-bold transition-colors',
                selectedTarget === null
                  ? 'bg-[var(--primary)] text-white'
                  : 'bg-[#2a2a2a] text-[#888] hover:bg-[#333]'
              )}
            >
              All Stations
            </button>
            {otherStations.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedTarget(s.id)}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-bold transition-colors',
                  selectedTarget === s.id
                    ? 'bg-[var(--primary)] text-white'
                    : 'bg-[#2a2a2a] text-[#888] hover:bg-[#333]'
                )}
              >
                {s.name}
                {s.station_type === 'expo' && (
                  <span className="ml-1 text-[10px] opacity-70">EXPO</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Message thread */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto scroll-container px-4 py-3 space-y-3"
        >
          {relevantMessages.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-[#666]">No messages yet</p>
            </div>
          ) : (
            relevantMessages.map((msg) => {
              const isFromMe = msg.from_station_id === stationId
              const isBroadcast = msg.to_station_id === null

              return (
                <div
                  key={msg.id}
                  className={cn(
                    'flex flex-col',
                    isFromMe ? 'items-end' : 'items-start'
                  )}
                >
                  {/* Sender info */}
                  <div className="mb-1 flex items-center gap-2">
                    <span className="text-xs font-semibold text-[#888]">
                      {isFromMe ? 'You' : msg.from_station_name}
                    </span>
                    {isBroadcast && (
                      <span className="rounded bg-[#333] px-1.5 py-0.5 text-[10px] font-bold uppercase text-[#888]">
                        All
                      </span>
                    )}
                    <span className="text-[10px] text-[#555]">
                      {formatTime(msg.created_at)}
                    </span>
                  </div>

                  {/* Message bubble */}
                  <div
                    className={cn(
                      'max-w-[85%] rounded-xl px-4 py-2.5 text-sm',
                      isFromMe
                        ? 'bg-[var(--primary)] text-white'
                        : 'bg-[#2a2a2a] text-white',
                      msg.message_type === 'quick' && !isFromMe && 'border border-[#444]'
                    )}
                  >
                    {msg.message}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Quick messages */}
        <KdsQuickMessages
          stationId={stationId}
          locationId={locationId}
          onSend={handleQuickMessage}
        />

        {/* Custom message input */}
        <div className="border-t border-[#2a2a2a] px-4 py-3">
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              className="flex-1 rounded-xl border border-[#333] bg-[#0a0a0a] px-4 py-3 text-sm text-white placeholder-[#555] outline-none focus:border-[var(--primary)]"
              maxLength={500}
              autoComplete="off"
              inputMode="text"
              enterKeyHint="send"
            />
            <button
              onClick={handleSendCustom}
              disabled={!customMessage.trim()}
              className={cn(
                'flex h-12 w-12 items-center justify-center rounded-xl transition-colors',
                customMessage.trim()
                  ? 'bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)]'
                  : 'bg-[#2a2a2a] text-[#555]'
              )}
            >
              <Send className="h-5 w-5" />
              <span className="sr-only">Send</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
