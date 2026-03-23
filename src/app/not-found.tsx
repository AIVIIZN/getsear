import Link from 'next/link'
import { MapPinOff } from 'lucide-react'

// ---------------------------------------------------------------------------
// Branded 404 page — matches Sear design system
// ---------------------------------------------------------------------------

export default function NotFound() {
  return (
    <div
      className="flex min-h-screen items-center justify-center px-6"
      style={{ background: 'var(--background)' }}
    >
      <div className="text-center animate-page-fade-in">
        {/* Brand */}
        <h1
          className="text-2xl font-bold tracking-tight mb-8"
          style={{ color: 'var(--primary)' }}
        >
          SEAR
        </h1>

        {/* Icon */}
        <div
          className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl mb-6"
          style={{ background: 'var(--accent)' }}
        >
          <MapPinOff
            className="h-10 w-10"
            style={{ color: 'var(--primary)' }}
            strokeWidth={1.5}
          />
        </div>

        {/* 404 number */}
        <p
          className="text-7xl font-bold tracking-tight mb-2"
          style={{ color: 'var(--foreground)' }}
        >
          404
        </p>

        {/* Message */}
        <h2
          className="text-xl font-semibold mb-2"
          style={{ color: 'var(--foreground)' }}
        >
          Page not found
        </h2>
        <p
          className="text-sm max-w-sm mx-auto mb-8"
          style={{ color: 'var(--muted-foreground)' }}
        >
          The page you are looking for does not exist or has been moved.
          Check the URL or head back to the dashboard.
        </p>

        {/* CTA */}
        <Link
          href="/"
          className="btn-press inline-flex items-center justify-center rounded-[var(--radius-button)] px-6 py-3 text-sm font-semibold text-white transition-colors focus-ring"
          style={{ background: 'var(--primary)' }}
        >
          Go to Dashboard
        </Link>
      </div>
    </div>
  )
}
