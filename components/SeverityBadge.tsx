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
  CRITICAL: { label: "Critical", className: "bg-red-100 text-red-700 ring-red-300" },
  HIGH: { label: "High", className: "bg-orange-100 text-orange-700 ring-orange-300" },
  MEDIUM: { label: "Medium", className: "bg-amber-100 text-amber-800 ring-amber-300" },
  LOW: { label: "Low", className: "bg-lime-100 text-lime-800 ring-lime-300" },
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
