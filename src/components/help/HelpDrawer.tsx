"use client";

import { BookOpen, Film, HelpCircle, PlayCircle, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { HelpSearch } from "@/components/help/HelpSearch";
import {
  deferredHelpVideos,
  getContextualHelpTopics,
  getHelpTopicCount,
} from "@/lib/help";
import { cn } from "@/lib/utils";

export function HelpDrawer() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname() ?? "/";
  const contextualTopics = useMemo(() => getContextualHelpTopics(pathname, 4), [pathname]);
  const deferredVideos = deferredHelpVideos.slice(0, 4);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-lg",
          "text-[var(--color-text-muted)] transition-colors duration-100",
          "hover:bg-black/[0.04] active:bg-black/[0.06]",
        )}
        aria-label="Open contextual help"
      >
        <HelpCircle className="h-5 w-5" strokeWidth={1.9} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            className="absolute inset-0 bg-black/10 backdrop-blur-sm"
            aria-label="Close help"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-[var(--border)] bg-[var(--color-surface)] shadow-[var(--shadow-xl)]">
            <header className="border-b border-[var(--border)] p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase text-[var(--color-primary)]">
                    <BookOpen className="h-4 w-4" />
                    Help center
                  </div>
                  <h2 className="mt-2 text-xl font-semibold leading-7 text-[var(--color-text)]">
                    Context for this screen
                  </h2>
                  <p className="mt-1 text-sm leading-5 text-[var(--color-text-muted)]">
                    Search {getHelpTopicCount()} help topics or open the articles most relevant to this page.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-hover)]"
                  aria-label="Close help"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </header>

            <div className="flex-1 space-y-6 overflow-y-auto p-5">
              <section>
                <h3 className="text-sm font-semibold text-[var(--color-text)]">
                  Search help
                </h3>
                <div className="mt-3">
                  <HelpSearch onNavigate={() => setOpen(false)} />
                </div>
              </section>

              <section>
                <h3 className="text-sm font-semibold text-[var(--color-text)]">
                  Recommended for this page
                </h3>
                <div className="mt-3 grid gap-2">
                  {contextualTopics.map((topic) => (
                    <Link
                      key={`${topic.category}/${topic.slug}`}
                      href={topic.href}
                      onClick={() => setOpen(false)}
                      className="rounded-xl border border-[var(--border)] bg-[var(--color-bg-subtle)] p-3 transition-colors hover:bg-[var(--color-surface-hover)]"
                    >
                      <span className="text-xs font-semibold text-[var(--color-primary)]">
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
              </section>

              <section>
                <div className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text)]">
                  <Film className="h-4 w-4 text-[var(--color-primary)]" />
                  Screencasts
                </div>
                <div className="mt-3 grid gap-2">
                  {deferredVideos.map((video) => (
                    <div
                      key={video.id}
                      className="flex items-center gap-3 rounded-xl border border-dashed border-[var(--border)] bg-[var(--color-bg-subtle)] p-3"
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--accent)] text-[var(--color-primary)]">
                        <PlayCircle className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-[var(--color-text)]">
                          {video.title}
                        </p>
                        <p className="text-xs text-[var(--color-text-muted)]">
                          Recording pending
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
