'use client'

import { use } from 'react'
import Link from 'next/link'
import { ArrowLeft, ChevronRight } from 'lucide-react'
import { HELP_CATEGORIES, HELP_ARTICLES } from '../../page'

export default function HelpArticlePage({
  params,
}: {
  params: Promise<{ category: string; article: string }>
}) {
  const { category: categorySlug, article: articleSlug } = use(params)
  const category = HELP_CATEGORIES.find((c) => c.slug === categorySlug)
  const article = HELP_ARTICLES.find(
    (a) => a.category === categorySlug && a.slug === articleSlug
  )

  // Related articles in the same category (exclude current)
  const relatedArticles = HELP_ARTICLES.filter(
    (a) => a.category === categorySlug && a.slug !== articleSlug
  ).slice(0, 3)

  if (!category || !article) {
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
          <h1 className="text-title-2 font-semibold text-[var(--foreground)]">Article not found</h1>
          <p className="mt-2 text-body text-[var(--muted-foreground)]">
            This help article does not exist. Go back to the Help Center to find what you need.
          </p>
        </div>
      </div>
    )
  }

  // Split content into paragraphs
  const paragraphs = article.content.split('. ').reduce<string[]>((acc, sentence, i, arr) => {
    // Group every 3-4 sentences into a paragraph
    const groupSize = 3
    const groupIndex = Math.floor(i / groupSize)
    if (!acc[groupIndex]) acc[groupIndex] = ''
    acc[groupIndex] += sentence + (i < arr.length - 1 ? '. ' : '')
    return acc
  }, [])

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-footnote">
        <Link href="/help" className="text-[var(--primary)] hover:underline">
          Help Center
        </Link>
        <ChevronRight className="h-3 w-3 text-[var(--muted-foreground)]" />
        <Link href={`/help/${categorySlug}`} className="text-[var(--primary)] hover:underline">
          {category.name}
        </Link>
        <ChevronRight className="h-3 w-3 text-[var(--muted-foreground)]" />
        <span className="text-[var(--muted-foreground)]">{article.title}</span>
      </nav>

      {/* Article */}
      <article className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-8 shadow-warm-sm">
        <header className="mb-6">
          <div className="mb-2 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent)]">
              <category.icon className="h-4 w-4 text-[var(--primary)]" />
            </div>
            <span className="text-footnote font-medium text-[var(--primary)]">{category.name}</span>
          </div>
          <h1 className="text-title-1 font-semibold text-[var(--foreground)]">{article.title}</h1>
          <p className="mt-2 text-body text-[var(--muted-foreground)]">{article.summary}</p>
        </header>

        <div className="hairline-t pt-6 space-y-4">
          {paragraphs.map((paragraph, i) => (
            <p key={i} className="text-body leading-relaxed text-[var(--foreground)]">
              {paragraph.trim()}
            </p>
          ))}
        </div>
      </article>

      {/* Related articles */}
      {relatedArticles.length > 0 && (
        <div>
          <h2 className="mb-3 text-headline text-[var(--foreground)]">Related Articles</h2>
          <div className="space-y-2">
            {relatedArticles.map((related) => (
              <Link
                key={related.slug}
                href={`/help/${categorySlug}/${related.slug}`}
                className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-warm-sm transition-all hover:shadow-warm-md"
              >
                <div className="flex-1">
                  <h3 className="text-callout font-medium text-[var(--foreground)]">{related.title}</h3>
                  <p className="mt-0.5 text-footnote text-[var(--muted-foreground)]">{related.summary}</p>
                </div>
                <ChevronRight className="h-4 w-4 flex-shrink-0 text-[var(--muted-foreground)]" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Back link */}
      <div className="pt-4">
        <Link
          href={`/help/${categorySlug}`}
          className="inline-flex items-center gap-1 text-callout text-[var(--primary)] btn-press"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to {category.name}
        </Link>
      </div>
    </div>
  )
}
