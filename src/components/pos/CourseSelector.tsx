'use client'

import { useOrderStore } from '@/stores/order-store'
import { cn } from '@/lib/utils'

interface CourseSelectorProps {
  maxCourses?: number
}

/**
 * Horizontal course tabs for the order panel.
 * Tapping a course number sets the active course — new items will be assigned to that course.
 */
export function CourseSelector({ maxCourses = 5 }: CourseSelectorProps) {
  const activeCourse = useOrderStore((s) => s.activeCourse)
  const { setActiveCourse } = useOrderStore((s) => s.actions)

  return (
    <div className="flex items-center gap-1">
      <span className="mr-1 text-xs font-medium text-muted-foreground">Course</span>
      {Array.from({ length: maxCourses }, (_, i) => i + 1).map((course) => (
        <button
          key={course}
          type="button"
          onClick={() => setActiveCourse(course)}
          className={cn(
            'btn-press flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold transition-all duration-150',
            activeCourse === course
              ? 'bg-[var(--primary)] text-white shadow-warm-sm'
              : 'bg-[var(--secondary)] text-muted-foreground hover:bg-[var(--muted)] hover:text-foreground'
          )}
        >
          {course}
        </button>
      ))}
    </div>
  )
}
