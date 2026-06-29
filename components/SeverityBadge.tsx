// ============================================================
// SeverityBadge — small reusable severity pill. Maps the uppercase Severity
// enum to the brand severity colors. Pure presentational, explicit props.
// ============================================================

import type { Severity } from "@/lib/types"

export interface SeverityBadgeProps {
  severity: Severity
  className?: string
}

const STYLE: Record<Severity, { label: string; className: string }> = {
  CRITICAL: { label: "Critical", className: "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 ring-red-300 dark:ring-red-800" },
  HIGH: { label: "High", className: "bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 ring-orange-300 dark:ring-orange-800" },
  MEDIUM: { label: "Medium", className: "bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 ring-amber-300 dark:ring-amber-800" },
  LOW: { label: "Low", className: "bg-lime-100 dark:bg-lime-900/40 text-lime-800 dark:text-lime-300 ring-lime-300 dark:ring-lime-800" },
}

export function SeverityBadge({ severity, className = "" }: SeverityBadgeProps) {
  const s = STYLE[severity]
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${s.className} ${className}`}
    >
      {s.label}
    </span>
  )
}

export default SeverityBadge
