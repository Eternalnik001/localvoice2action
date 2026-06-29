// ============================================================
// Small formatting helpers (pure, dependency-free).
// ============================================================

import type { IssueStatus } from "@/lib/types"

/** Title-case issue-status labels — single source of truth for display text. */
export const STATUS_TEXT: Record<IssueStatus, string> = {
  OPEN: "Open",
  ACKNOWLEDGED: "Acknowledged",
  IN_PROGRESS: "In progress",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
}

/** Human-friendly status label, e.g. "In progress". */
export function statusText(status: IssueStatus): string {
  return STATUS_TEXT[status]
}

/** Human "time ago" string, e.g. "3 days ago", "just now". */
export function timeAgo(date: Date, now: Date = new Date()): string {
  const sec = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000))
  if (sec < 60) return "just now"
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min} min ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} hour${hr === 1 ? "" : "s"} ago`
  const day = Math.floor(hr / 24)
  if (day < 30) return `${day} day${day === 1 ? "" : "s"} ago`
  const mon = Math.floor(day / 30)
  if (mon < 12) return `${mon} month${mon === 1 ? "" : "s"} ago`
  const yr = Math.floor(mon / 12)
  return `${yr} year${yr === 1 ? "" : "s"} ago`
}

/** Short absolute date, e.g. "22 Jun 2026". */
export function shortDate(date: Date): string {
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}
