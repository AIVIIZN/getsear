"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { searchHelpTopics } from "@/lib/help";

export function HelpSearch({ onNavigate }: { onNavigate?: () => void }) {
  const [query, setQuery] = useState("");
  const results = useMemo(() => searchHelpTopics(query, 8), [query]);

  return (
    <div className="space-y-3">
      <label className="relative block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-subtle)]" />
        <span className="sr-only">Search help topics</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search help topics"
          className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--color-bg-subtle)] pl-10 pr-3 text-sm text-[var(--color-text)] outline-none transition-shadow placeholder:text-[var(--color-text-subtle)] focus:ring-2 focus:ring-[var(--color-primary)]"
        />
      </label>
      <div className="space-y-2">
        {results.map((topic) => (
          <Link
            key={`${topic.category}/${topic.slug}`}
            href={topic.href}
            onClick={onNavigate}
            className="block rounded-xl border border-[var(--border)] bg-[var(--color-surface)] p-3 transition-colors hover:bg-[var(--color-surface-hover)] active:bg-[var(--color-surface-active)]"
          >
            <span className="block text-xs font-semibold uppercase text-[var(--color-primary)]">
              {topic.categoryName}
            </span>
            <span className="mt-1 block text-sm font-semibold leading-5 text-[var(--color-text)]">
              {topic.title}
            </span>
            <span className="mt-1 line-clamp-2 block text-xs leading-4 text-[var(--color-text-muted)]">
              {topic.summary}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
