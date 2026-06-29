// ============================================================
// BadgePills — compact row of earned badges (emoji + label).
// Pure presentational; used on the issue detail page near the reporter line.
// ============================================================

import type { Badge } from "@/lib/badges"

export interface BadgePillsProps {
  badges: Badge[]
  className?: string
}

export function BadgePills({ badges, className = "" }: BadgePillsProps) {
  if (badges.length === 0) return null
  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {badges.map((b) => (
        <span
          key={b.id}
          title={b.description}
          className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800 ring-1 ring-amber-200"
        >
          <span aria-hidden>{b.emoji}</span>
          {b.label}
        </span>
      ))}
    </div>
  )
}

export default BadgePills
