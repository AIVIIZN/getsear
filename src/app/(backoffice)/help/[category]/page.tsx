'use client'

import { use } from 'react'
import Link from 'next/link'
import { ChevronRight, ArrowLeft } from 'lucide-react'
import { HELP_CATEGORIES, HELP_ARTICLES } from '../content'

export default function HelpCategoryPage({
  params,
}: {
  params: Promise<{ category: string }>
}) {
  const { category: categorySlug } = use(params)
  const category = HELP_CATEGORIES.find((c) => c.slug === categorySlug)
  const articles = HELP_ARTICLES.filter((a) => a.category === categorySlug)

  if (!category) {
    return (
      <div className="space-y-6">
        <Link
          href="/help"
          className="inline-flex items-center gap-1 text-callout text-[var(--primary)] btn-press"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Help Center
        </Link>
        <div className="rounded-2xl bg-[var(--card)] p-8 text-center shadow-warm-sm">
          <h1 className="text-title-2 font-semibold text-[var(--foreground)]">Category not found</h1>
          <p className="mt-2 text-body text-[var(--muted-foreground)]">
            This help category does not exist. Go back to the Help Center to browse all categories.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Link
        href="/help"
        className="inline-flex items-center gap-1 text-callout text-[var(--primary)] btn-press"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Help Center
      </Link>

      {/* Header */}
      <div>
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--accent)]">
          <category.icon className="h-6 w-6 text-[var(--primary)]" />
        </div>
        <h1 className="page-title text-title-1 font-semibold">{category.name}</h1>
        <p className="page-subtitle mt-1">{category.description}</p>
      </div>

      {/* Article List */}
      <div className="space-y-2">
        {articles.map((article) => (
          <Link
            key={article.slug}
            href={`/help/${categorySlug}/${article.slug}`}
            className="flex items-center gap-4 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-warm-sm transition-all hover:shadow-warm-md hover:border-[var(--border-hover)]"
          >
            <div className="flex-1">
              <h2 className="text-headline text-[var(--foreground)]">{article.title}</h2>
              <p className="mt-0.5 text-footnote text-[var(--muted-foreground)]">{article.summary}</p>
            </div>
            <ChevronRight className="h-5 w-5 flex-shrink-0 text-[var(--muted-foreground)]" />
          </Link>
        ))}

        {articles.length === 0 && (
          <div className="rounded-2xl bg-[var(--card)] p-8 text-center shadow-warm-sm">
            <p className="text-body text-[var(--muted-foreground)]">
              No articles in this category yet. Check back soon.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
