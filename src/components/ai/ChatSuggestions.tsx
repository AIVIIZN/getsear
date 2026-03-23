'use client'

import {
  TrendingUp,
  Users,
  UtensilsCrossed,
  Clock,
  DollarSign,
  BarChart3,
} from 'lucide-react'

interface ChatSuggestionsProps {
  onSelect: (question: string) => void
}

interface Suggestion {
  icon: React.ComponentType<{ className?: string }>
  label: string
  question: string
}

function getSuggestions(): Suggestion[] {
  const hour = new Date().getHours()

  // Morning suggestions (before 11 AM)
  if (hour < 11) {
    return [
      { icon: TrendingUp, label: "Yesterday's numbers", question: 'How did we do yesterday?' },
      { icon: BarChart3, label: 'Week-over-week', question: 'Compare this week to last week' },
      { icon: Users, label: 'Labor cost', question: "What was yesterday's labor cost percentage?" },
      { icon: UtensilsCrossed, label: 'Top sellers', question: 'What were our top 10 sellers this week?' },
      { icon: DollarSign, label: 'Food cost', question: "What's our food cost trending this month?" },
      { icon: Clock, label: 'Speed of service', question: "How are our ticket times this week?" },
    ]
  }

  // Afternoon suggestions (11 AM - 4 PM)
  if (hour < 16) {
    return [
      { icon: TrendingUp, label: "Today's sales", question: 'How are we doing today so far?' },
      { icon: Users, label: 'Staffing check', question: 'Am I overstaffed right now?' },
      { icon: UtensilsCrossed, label: 'Lunch performance', question: 'How did lunch go today?' },
      { icon: BarChart3, label: 'This vs last Saturday', question: 'Compare this Saturday to last Saturday' },
      { icon: DollarSign, label: 'Menu profitability', question: 'What should I 86 from the menu?' },
      { icon: Clock, label: 'Best servers', question: 'Who are my best servers this month?' },
    ]
  }

  // Evening suggestions (after 4 PM)
  return [
    { icon: TrendingUp, label: "Today's numbers", question: 'How are we doing today?' },
    { icon: Users, label: 'Server ranking', question: "Who's my best server tonight?" },
    { icon: UtensilsCrossed, label: 'Dinner pace', question: 'How is dinner pacing vs last week?' },
    { icon: BarChart3, label: 'Weekly recap', question: 'Give me this week in review' },
    { icon: DollarSign, label: 'Tips today', question: 'How are tips looking today?' },
    { icon: Clock, label: 'Kitchen speed', question: 'How are ticket times in the kitchen tonight?' },
  ]
}

export function ChatSuggestions({ onSelect }: ChatSuggestionsProps) {
  const suggestions = getSuggestions()

  return (
    <div className="flex flex-col items-center px-4 py-8">
      <div
        className="mb-2 flex h-12 w-12 items-center justify-center rounded-full"
        style={{ backgroundColor: 'var(--accent)' }}
      >
        <BarChart3
          className="h-6 w-6 text-[var(--primary)]"
        />
      </div>
      <h3 className="text-headline mb-1">Ask me anything</h3>
      <p className="text-footnote text-muted-foreground mb-6 text-center">
        I can help you understand your sales, labor, menu, and more
      </p>

      <div className="grid w-full grid-cols-2 gap-2">
        {suggestions.map((s) => {
          const Icon = s.icon
          return (
            <button
              key={s.question}
              onClick={() => onSelect(s.question)}
              className="btn-press flex items-center gap-2 rounded-xl px-3 py-3 text-left transition-colors hover:bg-black/[0.03]"
              style={{
                border: '0.5px solid var(--border)',
                backgroundColor: 'var(--card)',
              }}
            >
              <Icon
                className="h-4 w-4 shrink-0 text-[var(--primary)]"
              />
              <span className="text-footnote font-medium text-foreground truncate">
                {s.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
