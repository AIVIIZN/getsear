'use client'

/**
 * KDS Allergen Alert Banner
 *
 * Full-width RED banner at ticket top when ANY item has allergens.
 * CANNOT be dismissed. Persists for entire ticket lifecycle.
 * Uses role="alert" for accessibility.
 */

interface KdsAllergenBannerProps {
  allergens: string[]
}

export function KdsAllergenBanner({ allergens }: KdsAllergenBannerProps) {
  if (allergens.length === 0) return null

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="flex items-center justify-center gap-2 bg-[#FF0000] px-3 py-2.5"
      style={{ pointerEvents: 'none' }}
    >
      {/* Warning icon */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5 flex-shrink-0 text-white"
      >
        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
      </svg>
      <span className="text-subhead font-black uppercase tracking-wider text-white">
        ALLERGY: {allergens.join(', ')}
      </span>
    </div>
  )
}
