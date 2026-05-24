'use client'

import { useState, useMemo } from 'react'
import { Search, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import Link from 'next/link'

import { HELP_CATEGORIES, HELP_ARTICLES } from './content'

export default function HelpCenterPage() {
  const [searchQuery, setSearchQuery] = useState('')

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return []
    const query = searchQuery.toLowerCase()
    return HELP_ARTICLES.filter(
      (article) =>
        article.title.toLowerCase().includes(query) ||
        article.summary.toLowerCase().includes(query) ||
        article.content.toLowerCase().includes(query)
    ).slice(0, 10)
  }, [searchQuery])

  const isSearching = searchQuery.trim().length > 0

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="page-title text-title-1 font-semibold">Help Center</h1>
        <p className="page-subtitle mt-1">
          Find answers, troubleshoot issues, and learn how to use Sear POS.
        </p>
      </div>

      {/* Search */}
      <div className="mx-auto max-w-xl">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--muted-foreground)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search for help..."
            className="w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] py-4 pl-12 pr-4 text-body text-[var(--foreground)] shadow-warm-md transition-shadow placeholder:text-[var(--muted-foreground)] focus:shadow-warm-lg focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
          />
        </div>
      </div>

      {/* Search Results */}
      {isSearching && (
        <div className="mx-auto max-w-xl space-y-2">
          {searchResults.length === 0 ? (
            <div className="rounded-2xl bg-[var(--card)] p-6 text-center shadow-warm-sm">
              <p className="text-body text-[var(--muted-foreground)]">
                No articles found for &quot;{searchQuery}&quot;. Try different keywords.
              </p>
            </div>
          ) : (
            <>
              <p className="text-footnote text-[var(--muted-foreground)]">
                {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} found
              </p>
              {searchResults.map((article) => (
                <Link
                  key={`${article.category}/${article.slug}`}
                  href={`/help/${article.category}/${article.slug}`}
                  className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-warm-sm transition-all hover:shadow-warm-md"
                >
                  <div className="flex-1">
                    <h3 className="text-callout font-medium text-[var(--foreground)]">{article.title}</h3>
                    <p className="mt-0.5 text-footnote text-[var(--muted-foreground)]">{article.summary}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 flex-shrink-0 text-[var(--muted-foreground)]" />
                </Link>
              ))}
            </>
          )}
        </div>
      )}

      {/* Category Grid */}
      {!isSearching && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {HELP_CATEGORIES.map((category) => (
            <Link
              key={category.slug}
              href={`/help/${category.slug}`}
              className="group rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-warm-sm transition-all hover:shadow-warm-md hover:border-[var(--border-hover)]"
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent)]">
                <category.icon className="h-5 w-5 text-[var(--primary)]" />
              </div>
              <h2 className="text-headline text-[var(--foreground)] group-hover:text-[var(--primary)]">
                {category.name}
              </h2>
              <p className="mt-1 text-footnote text-[var(--muted-foreground)]">
                {category.description}
              </p>
              <p className="mt-2 text-caption-1 text-[var(--primary)]">
                {category.articleCount} articles
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

