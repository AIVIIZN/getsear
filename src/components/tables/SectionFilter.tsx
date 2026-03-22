'use client'

import { cn } from '@/lib/utils'

interface SectionFilterProps {
  sections: string[]
  activeSection: string | null
  onSelect: (section: string | null) => void
}

export function SectionFilter({ sections, activeSection, onSelect }: SectionFilterProps) {
  if (sections.length === 0) return null

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={cn(
          'touch-target flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors duration-150',
          activeSection === null
            ? 'bg-primary text-primary-foreground'
            : 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        )}
      >
        All
      </button>
      {sections.map((section) => (
        <button
          key={section}
          type="button"
          onClick={() => onSelect(activeSection === section ? null : section)}
          className={cn(
            'touch-target flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors duration-150',
            activeSection === section
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
          )}
        >
          {section}
        </button>
      ))}
    </div>
  )
}
