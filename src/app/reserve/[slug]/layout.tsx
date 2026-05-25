import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Make a Reservation',
  description: 'Book a table at our restaurant',
}

/**
 * Public reservation widget layout.
 * No auth, no sidebar, no POS chrome.
 */
export default function ReserveLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-[var(--color-marketing-bg-muted)]">
      {children}
    </div>
  )
}
