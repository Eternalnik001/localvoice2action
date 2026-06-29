// ============================================================
// RecentIssuesStrip — horizontal scrollable strip of the most recent issues.
// Pure presentational; sits below the map on the home page. On mobile it
// scrolls horizontally; cards stack naturally within the scroll row.
// ============================================================

import Link from "next/link"
import { timeAgo } from "@/lib/format"
import { SeverityBadge } from "@/components/SeverityBadge"
import type { Issue } from "@/lib/types"

export interface RecentIssuesStripProps {
  issues: Issue[]
  /** "now" injected so the server render is deterministic. */
  now: number
}

const STATUS_LABEL: Record<Issue["status"], { text: string; className: string }> = {
  OPEN: { text: "Open", className: "bg-red-100 text-red-700" },
  ACKNOWLEDGED: { text: "Acknowledged", className: "bg-violet-100 text-violet-700" },
  IN_PROGRESS: { text: "In progress", className: "bg-amber-100 text-amber-800" },
  RESOLVED: { text: "Resolved", className: "bg-emerald-100 text-emerald-700" },
  CLOSED: { text: "Closed", className: "bg-slate-100 text-slate-600" },
}

export function RecentIssuesStrip({ issues, now }: RecentIssuesStripProps) {
  if (issues.length === 0) return null
  const nowDate = new Date(now)
  return (
    <section className="mt-6">
      <h2 className="mb-3 text-lg font-semibold text-slate-900">
        Recently reported
      </h2>
      {/* Mobile: stack vertically (each card full width). sm+: horizontal scroll strip. */}
      <div className="no-scrollbar flex flex-col gap-3 sm:-mx-4 sm:flex-row sm:overflow-x-auto sm:px-4 sm:pb-2">
        {issues.map((issue) => {
          const status = STATUS_LABEL[issue.status]
          return (
            <Link
              key={issue.id}
              href={`/issues/${issue.id}`}
              className="w-full flex-shrink-0 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 transition hover:ring-brand-primary sm:w-60"
            >
              <div className="flex items-center justify-between gap-2">
                <SeverityBadge severity={issue.severity} />
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${status.className}`}
                >
                  {status.text}
                </span>
              </div>
              <p className="mt-2 line-clamp-2 font-medium text-slate-900">
                {issue.title}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {issue.location.area} · {timeAgo(issue.created_at, nowDate)}
              </p>
            </Link>
          )
        })}
      </div>
    </section>
  )
}

export default RecentIssuesStrip
