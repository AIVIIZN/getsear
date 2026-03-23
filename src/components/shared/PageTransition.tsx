'use client'

// ---------------------------------------------------------------------------
// PageTransition — wrapper for subtle page fade-in animation
// Uses CSS animation defined in globals.css. No framer-motion dependency.
// Respects prefers-reduced-motion via the CSS media query.
// ---------------------------------------------------------------------------

interface PageTransitionProps {
  children: React.ReactNode
  className?: string
}

export function PageTransition({ children, className = '' }: PageTransitionProps) {
  return (
    <div className={`animate-page-fade-in ${className}`}>
      {children}
    </div>
  )
}
